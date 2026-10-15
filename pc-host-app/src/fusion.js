/** Mahony orientation filter for Joy-Con IMU data (y-up world, gravity only: yaw slowly drifts, so the headset has a Zero button).
 *  Also learns the sign of each gyro axis by checking that the gyro agrees with how gravity moves in the accelerometer. */
export class Fusion {
  constructor(kp = 2.0) {
    this.q = [1, 0, 0, 0]; // w,x,y,z : sensor -> world
    this.kp = kp;
    this.sign = [1, 1, 1]; this.corr = [0, 0, 0]; this.prev = null; this.bias = [0, 0, 0];
  }

  learn(a, g, dt) {
    if (this.prev) {
      const d = [a[0] - this.prev[0], a[1] - this.prev[1], a[2] - this.prev[2]];
      for (let j = 0; j < 3; j++) {
        const e = [0, 0, 0]; e[j] = 1;
        const c = [e[1] * a[2] - e[2] * a[1], e[2] * a[0] - e[0] * a[2], e[0] * a[1] - e[1] * a[0]]; // e_j x a
        const dot = -(d[0] * c[0] + d[1] * c[1] + d[2] * c[2]) * g[j] * dt;                         // da = -(w x a) dt
        this.corr[j] = this.corr[j] * 0.9995 + dot;
        if (Math.abs(this.corr[j]) > 2e-4) this.sign[j] = this.corr[j] > 0 ? 1 : -1;
      }
    }
    this.prev = a;
  }

  /** gyro rad/s (sensor frame), accel in g (reads +up at rest), dt seconds. */
  update(gyro, accel, dt) {
    const n = Math.hypot(accel[0], accel[1], accel[2]);
    if (n < 1e-6) return;
    const a = [accel[0] / n, accel[1] / n, accel[2] / n];
    this.learn(a, gyro, dt);
    if (Math.abs(n - 1) < 0.03 && Math.max(Math.abs(gyro[0]), Math.abs(gyro[1]), Math.abs(gyro[2])) < 0.08) {
      for (let i = 0; i < 3; i++) this.bias[i] += (gyro[i] - this.bias[i]) * 0.002; // gyro bias while still
    }
    const g = [0, 1, 2].map((i) => (gyro[i] - this.bias[i]) * this.sign[i]);
    let [w, x, y, z] = this.q;
    const vx = 2 * (x * y + w * z), vy = 1 - 2 * (x * x + z * z), vz = 2 * (y * z - w * x); // world up in sensor frame
    const ex = a[1] * vz - a[2] * vy, ey = a[2] * vx - a[0] * vz, ez = a[0] * vy - a[1] * vx;
    const gx = g[0] + this.kp * ex, gy = g[1] + this.kp * ey, gz = g[2] + this.kp * ez;
    w += 0.5 * (-x * gx - y * gy - z * gz) * dt;
    const nx = x + 0.5 * (w * gx + y * gz - z * gy) * dt;
    const ny = y + 0.5 * (w * gy - x * gz + z * gx) * dt;
    const nz = z + 0.5 * (w * gz + x * gy - y * gx) * dt;
    const m = Math.hypot(w, nx, ny, nz);
    this.q = [w / m, nx / m, ny / m, nz / m];
  }

  xyzw() { const [w, x, y, z] = this.q; return [x, y, z, w]; }
}
