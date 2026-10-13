"""Orientation fusion for Joy-Con IMU data (Mahony filter, y-up world, gravity only: yaw drifts, so the headset has a Zero button).
Also learns the sign of each gyro axis by checking that the gyro agrees with how the accelerometer's gravity vector moves."""
import math


class Fusion:
    def __init__(self, kp=2.0):
        self.q = [1.0, 0.0, 0.0, 0.0]          # w,x,y,z : sensor -> world (y up)
        self.kp = kp
        self.sign = [1.0, 1.0, 1.0]
        self.corr = [0.0, 0.0, 0.0]
        self.prev = None
        self.bias = [0.0, 0.0, 0.0]

    def _learn(self, a, g, dt):
        if self.prev is not None:
            d = [a[i] - self.prev[i] for i in range(3)]
            for j in range(3):
                e = [0.0, 0.0, 0.0]; e[j] = 1.0
                cx = e[1] * a[2] - e[2] * a[1]; cy = e[2] * a[0] - e[0] * a[2]; cz = e[0] * a[1] - e[1] * a[0]
                pred = (-cx * g[j] * dt, -cy * g[j] * dt, -cz * g[j] * dt)   # da = -(w x a) dt, per gyro axis
                self.corr[j] = self.corr[j] * 0.9995 + (d[0] * pred[0] + d[1] * pred[1] + d[2] * pred[2])
                if abs(self.corr[j]) > 2e-4:
                    self.sign[j] = 1.0 if self.corr[j] > 0 else -1.0
        self.prev = a

    def update(self, gyro, accel, dt):
        """gyro rad/s (sensor frame), accel in g (reads +up at rest), dt seconds."""
        n = math.sqrt(sum(v * v for v in accel))
        if n < 1e-6:
            return
        a = [v / n for v in accel]
        raw = list(gyro)
        self._learn(a, raw, dt)
        still = abs(n - 1) < 0.03 and max(abs(v) for v in raw) < 0.08
        if still:
            for i in range(3):
                self.bias[i] += (raw[i] - self.bias[i]) * 0.002
        g = [(raw[i] - self.bias[i]) * self.sign[i] for i in range(3)]
        w, x, y, z = self.q
        vx, vy, vz = 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)     # world up in sensor frame
        ex, ey, ez = a[1] * vz - a[2] * vy, a[2] * vx - a[0] * vz, a[0] * vy - a[1] * vx
        gx, gy, gz = g[0] + self.kp * ex, g[1] + self.kp * ey, g[2] + self.kp * ez
        dw = 0.5 * (-x * gx - y * gy - z * gz)
        dx = 0.5 * (w * gx + y * gz - z * gy)
        dy = 0.5 * (w * gy - x * gz + z * gx)
        dz = 0.5 * (w * gz + x * gy - y * gx)
        w, x, y, z = w + dw * dt, x + dx * dt, y + dy * dt, z + dz * dt
        m = math.sqrt(w * w + x * x + y * y + z * z)
        self.q = [w / m, x / m, y / m, z / m]

    def xyzw(self):
        w, x, y, z = self.q
        return [x, y, z, w]
