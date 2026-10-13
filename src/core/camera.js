/** One shared rear-camera stream for passthrough, hand tracking and controller tracking (ref-counted). */
export class Camera {
  constructor() {
    this.video = document.getElementById('ptv');
    this.users = new Set();
    this.stream = null;
    this.pending = null;
  }

  async open() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera not supported here');
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    });
    this.video.srcObject = s;
    await this.video.play();
    this.stream = s;
  }

  async use(name) {
    this.users.add(name);
    try {
      if (!this.pending) this.pending = this.open();
      await this.pending;
    } catch (e) {
      this.users.delete(name); this.pending = null;
      throw e;
    }
    return this.video;
  }

  release(name) {
    this.users.delete(name);
    if (this.users.size || !this.stream) return;
    this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null; this.pending = null; this.video.srcObject = null;
  }

  get ready() { return !!this.stream && this.video.readyState >= 2 && this.video.videoWidth > 0; }
  get aspect() { return this.video.videoWidth / this.video.videoHeight || 16 / 9; }
}
