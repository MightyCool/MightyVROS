import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const Y = new THREE.Vector3(0, 1, 0);

/**
 * Learn how the Joy-Con's sensor axes map onto a "wand" model (X right, Y up, -Z forward) using gravity only.
 * q0: IMU orientation (sensor -> y-up world) holding the Joy-Con level, pointing forward, buttons up.
 * q1: IMU orientation holding it with the tip pointing straight up.
 * Returns B (quaternion, model -> sensor). World orientation of the wand = q * B.
 */
export function calibrateBasis(q0, q1) {
  const u = UP.clone().applyQuaternion(q0.clone().invert());          // model up, in sensor coordinates
  const f = UP.clone().applyQuaternion(q1.clone().invert());          // model forward, in sensor coordinates
  f.addScaledVector(u, -f.dot(u)).normalize();                         // make forward perpendicular to up
  const r = new THREE.Vector3().crossVectors(f, u).normalize();       // model right
  const m = new THREE.Matrix4().makeBasis(r, u, f.clone().negate());
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Yaw (about world Y) that turns the wand's current heading to VR forward (-Z). */
export function yawToForward(q, B) {
  const F = new THREE.Vector3(0, 0, -1).applyQuaternion(q.clone().multiply(B));
  return new THREE.Quaternion().setFromAxisAngle(Y, Math.atan2(F.x, -F.z));
}

/** Final VR orientation of the wand. */
export function wandQuat(q, B, yaw, out = new THREE.Quaternion()) {
  return out.copy(yaw).multiply(q).multiply(B);
}
