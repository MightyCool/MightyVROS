import * as THREE from 'three';

THREE.ColorManagement.enabled = false; // no sRGB round trips: cheaper, colours as authored

const VERT = 'varying vec2 v; void main(){ v=uv; gl_Position=vec4(position.xy,0.,1.); }';
const FRAG = `uniform sampler2D t; uniform float sharp, mir, swp; uniform vec2 texel; varying vec2 v;
void main(){
  vec2 u=v;
  float e=step(0.5,u.x);
  float lx=(u.x-e*0.5)*2.0;
  if(mir>0.5) lx=1.0-lx;
  if(swp>0.5) e=1.0-e;
  u.x=lx*0.5+e*0.5;
  vec4 c0=texture2D(t,u);
  if(sharp>0.0){
    vec3 n=texture2D(t,u+vec2(texel.x,0.)).rgb+texture2D(t,u-vec2(texel.x,0.)).rgb+texture2D(t,u+vec2(0.,texel.y)).rgb+texture2D(t,u-vec2(0.,texel.y)).rgb;
    c0.rgb=clamp(c0.rgb+sharp*(4.0*c0.rgb-n),0.0,1.0);
  }
  gl_FragColor=c0;
}`;

/** Renders both eyes into one render target, then one fullscreen copy/sharpen pass (no lens warping: your headset lenses do that). */
export class StereoRenderer {
  constructor(canvas, settings) {
    this.s = settings;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.r.info.autoReset = false;
    this.head = new THREE.Object3D();
    this.eyes = [new THREE.PerspectiveCamera(), new THREE.PerspectiveCamera()];
    this.eyes.forEach((c) => this.head.add(c));
    this.rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, samples: settings.aa });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: this.rt.texture }, sharp: { value: 0 }, mir: { value: 0 }, swp: { value: 0 }, texel: { value: new THREE.Vector2(1, 1) } },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Scene();
    this.quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get maxPR() { return Math.min(window.devicePixelRatio || 1, this.s.pr); }

  /** Re-create the render target after changing MSAA samples. */
  applyQuality() { this.rt.samples = this.s.aa; this.rt.dispose(); this.resize(); }

  resize() {
    this.r.setPixelRatio(this.maxPR);
    this.r.setSize(window.innerWidth, window.innerHeight, false);
    this.resizeTarget();
  }

  resizeTarget() {
    const c = this.r.domElement;
    const w = Math.max(2, Math.floor(c.width * this.s.scale)), h = Math.max(2, Math.floor(c.height * this.s.scale));
    this.rt.setSize(w, h);
    this.mat.uniforms.texel.value.set(1 / w, 1 / h);
  }

  render(scene) {
    const { r, rt, s } = this;
    const w = rt.width, h = rt.height;
    r.info.reset();
    this.eyes.forEach((c, i) => {
      c.position.x = (i ? 1 : -1) * s.ipd / 2;
      c.fov = s.fov; c.aspect = (w / 2) / h; c.near = 0.05; c.far = 60;
      c.updateProjectionMatrix();
    });
    this.head.updateMatrixWorld(true);
    const half = Math.floor(w / 2);
    for (let i = 0; i < 2; i++) {
      // three copies viewport/scissor inside setRenderTarget(), so set them first, then (re)bind
      rt.viewport.set(i * half, 0, half, h);
      rt.scissor.set(i * half, 0, half, h);
      rt.scissorTest = true;
      r.setRenderTarget(rt);
      r.render(scene, this.eyes[i]); // autoClear clears just this eye's scissor region
    }
    r.setRenderTarget(null);
    const u = this.mat.uniforms;
    u.sharp.value = s.sharpen; u.mir.value = s.mirror ? 1 : 0; u.swp.value = s.swap ? 1 : 0;
    r.render(this.quad, this.quadCam);
  }

  get calls() { return this.r.info.render.calls; }
}
