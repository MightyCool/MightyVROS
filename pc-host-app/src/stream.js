import nd from 'node-datachannel';

/** One H.264 video track to one headset. Signalling messages travel over the PeerJS data connection. */
export class VideoSender {
  constructor(send, log = () => {}) {
    this.send = send; this.log = log;
    this.t0 = performance.now();
    this.frames = 0; this.bytes = 0;
    this.pc = new nd.PeerConnection('mightyvr-host', { iceServers: process.env.VROS_NO_STUN ? [] : ['stun:stun.l.google.com:19302'] });
    const ssrc = 42;
    const video = new nd.Video('video', 'SendOnly');
    video.addH264Codec(96, 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f');
    video.addSSRC(ssrc, 'vros');
    this.track = this.pc.addTrack(video);
    this.rtp = new nd.RtpPacketizationConfig(ssrc, 'vros', 96, 90000);
    const pk = new nd.H264RtpPacketizer('StartSequence', this.rtp, 1200);
    const sr = new nd.RtcpSrReporter(this.rtp);
    pk.addToChain(sr); sr.addToChain(new nd.RtcpNackResponder());
    this.track.setMediaHandler(pk);
    this.offered = false; this.early = []; this.remoteSet = false; this.lateIce = [];
    this.pc.onLocalDescription((sdp, type) => {
      if (type !== 'offer') return;
      this.send({ t: 'offer', sdp });
    });
    // Hold our candidates until the answer is in: otherwise the viewer can start ICE/DTLS before we know its fingerprint and the handshake fails.
    this.pc.onLocalCandidate((c, mid) => { const m = { t: 'ice', c, mid }; if (this.remoteSet) this.send(m); else this.early.push(m); });
    this.track.onOpen(() => { if (this.onOpen) this.onOpen(); });
    this.pc.onStateChange((st) => this.log('video link ' + st));
    this.pc.onIceStateChange((st) => this.log('video ice ' + st));
    this.pc.setLocalDescription('offer');
  }

  answer(sdp) {
    this.pc.setRemoteDescription(sdp, 'answer');
    this.remoteSet = true;
    this.early.forEach((m) => this.send(m)); this.early = [];
    this.lateIce.forEach(([c, mid]) => this.ice(c, mid)); this.lateIce = [];
  }

  ice(c, mid) {
    if (!this.remoteSet) { this.lateIce.push([c, mid]); return; }
    try { this.pc.addRemoteCandidate(c, mid); } catch { /* malformed candidate */ }
  }
  get open() { return this.track.isOpen(); }

  frame(buf) {
    if (!this.track.isOpen()) return;
    this.rtp.timestamp = Math.round((performance.now() - this.t0) * 90) >>> 0;
    this.track.sendMessageBinary(Buffer.from(buf)); // own copy: node-datachannel ignores a Buffer view offset
    this.frames++; this.bytes += buf.length;
  }

  stats() { return { frames: this.frames, bytes: this.bytes, state: this.pc.state(), rtt: this.pc.state() === 'connected' ? undefined : undefined }; }
  close() { try { this.track.close(); this.pc.close(); } catch { /* already closed */ } }
}
