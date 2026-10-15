import * as poly from 'node-datachannel/polyfill';

/** Browsers queue addIceCandidate behind a pending setRemoteDescription; this polyfill throws instead, which dropped
 *  early candidates and made pairing fail about half the time. This subclass waits and retries. */
export class SafePC extends poly.RTCPeerConnection {
  constructor(...a) { super(...a); this._rd = Promise.resolve(); this._held = []; }

  // As the offerer, hold local candidates until the answer is applied (same ICE/DTLS ordering race as in stream.js).
  dispatchEvent(ev) {
    if (ev && ev.type === 'icecandidate' && ev.candidate && this.localDescription && this.localDescription.type === 'offer' && !this.remoteDescription) { this._held.push(ev); return true; }
    return super.dispatchEvent(ev);
  }

  setRemoteDescription(d) {
    const p = super.setRemoteDescription(d);
    this._rd = p.catch(() => {});
    p.then(() => { const h = this._held; this._held = []; h.forEach((e) => super.dispatchEvent(e)); }, () => {});
    return p;
  }

  async addIceCandidate(c) {
    for (let i = 0; ; i++) {
      try { await this._rd; return await super.addIceCandidate(c); } catch (e) {
        if (i >= 40 || !/without (an )?(ICE transport|remote description)/i.test(String(e && e.message))) throw e;
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }
}
export const { RTCSessionDescription, RTCIceCandidate } = poly;
