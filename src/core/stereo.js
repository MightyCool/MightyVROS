import * as THREE from 'three';

THREE.ColorManagement.enabled = false; // no sRGB round trips: cheaper, colours as authored

const VERT = 'varying vec2 v; void main(){ v=uv; gl_Position=vec4(position.xy,0.,1.); }';
const FRAG = `uniform sampler2D t; uniform float k1,k2,zoom; varying vec2 v;
void main(){
  float e=step(0.5,v.x);
  vec2 c=vec2((v.x-e*0.5)*2.0,v.y)*2.0-1.0;
  float r2=dot(c,c);
  c*=(1.0+k1*r2+k2*r2*r2)/zoom;
  if(abs(c.x)>1.0||abs(c.y)>1.0){gl_FragColor=vec4(0.,0.,0.,1.);return;}
  vec2 u=c*0.5+0.5; u.x=u.x*0.5+e*0.5;
  gl_FragColor=texture2D(t,u);
}`;

/** Renders both eyes into one render target, then one fullscreen barrel-distortion pass. */
export class StereoRenderer {
  constructor(canvas, settings) {
    this.s = settings;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.r.info.autoReset = false;
    this.maxPR = Math.min(window.devicePixelRatio || 1, 1.5);
    this.head = new THREE.Object3D();
    this.eyes = [new THREE.PerspectiveCamera(), new THREE.PerspectiveCamera()];
    this.eyes.forEach((c) => this.head.add(c));
    this.rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: this.rt.texture }, k1: { value: 0 }, k2: { value: 0 }, zoom: { value: 1 } },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Scene();
    this.quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.r.setPixelRatio(this.maxPR);
    this.r.setSize(window.innerWidth, window.innerHeight, false);
    this.resizeTarget();
  }

  resizeTarget() {
    const c = this.r.domElement;
    this.rt.setSize(Math.max(2, Math.floor(c.width * this.s.scale)), Math.max(2, Math.floor(c.height * this.s.scale)));
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
    r.setRenderTarget(rt);
    rt.scissorTest = false; rt.viewport.set(0, 0, w, h); rt.scissor.set(0, 0, w, h);
    r.clear();
    rt.scissorTest = true;
    for (let i = 0; i < 2; i++) {
      const x = i * Math.floor(w / 2);
      rt.viewport.set(x, 0, Math.floor(w / 2), h);
      rt.scissor.set(x, 0, Math.floor(w / 2), h);
      r.render(scene, this.eyes[i]);
    }
    r.setRenderTarget(null);
    const u = this.mat.uniforms;
    u.k1.value = s.k1; u.k2.value = s.k2; u.zoom.value = 1 + s.k1 + s.k2;
    r.render(this.quad, this.quadCam);
  }

  get calls() { return this.r.info.render.calls; }
}
