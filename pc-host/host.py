#!/usr/bin/env python3
"""VR OS PC helper: serves the host page on http://localhost:8765 and applies mouse/keyboard input from the headset.
Setup: pip install pyautogui     Run: python host.py
Optional Joy-Con relay (IMU + buttons to the headset): pip install joycon-python hidapi, pair the Joy-Cons to this PC by Bluetooth first."""
import json, os, sys, threading, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

try:
    import pyautogui
except ImportError:
    sys.exit('Missing dependency. Run:  pip install pyautogui')

JOY = {'L': None, 'R': None}   # latest Joy-Con state, read by the host page through GET /joy
pyautogui.PAUSE = 0
pyautogui.FAILSAFE = False
W, H = pyautogui.size()
KEYS = {'Enter': 'enter', 'Backspace': 'backspace', 'Esc': 'esc', ' ': 'space'}


def handle(m):
    t = m.get('t')
    if t in ('move', 'click'):
        x = int(max(0.0, min(1.0, float(m['x']))) * (W - 1))
        y = int(max(0.0, min(1.0, float(m['y']))) * (H - 1))
        pyautogui.moveTo(x, y)
        if t == 'click':
            pyautogui.click(button=m.get('b', 'left'))
    elif t == 'wheel':
        pyautogui.scroll(-int(m['dy']))  # pyautogui: positive = up; we send positive = page down
    elif t == 'key':
        k = str(m['k'])
        if k in KEYS:
            pyautogui.press(KEYS[k])
        elif len(k) == 1:
            pyautogui.write(k)


def start_joycons():
    try:
        from pyjoycon import PythonicJoyCon, get_L_id, get_R_id
        from joyfusion import Fusion
    except Exception as e:  # missing package or hid library: just no controllers
        print('Joy-Con support off:', e)
        return
    btn_names = {'L': ['l', 'zl', 'up', 'down', 'left', 'right', 'minus', 'capture', 'left_sl', 'left_sr'],
                 'R': ['r', 'zr', 'a', 'b', 'x', 'y', 'plus', 'home', 'right_sl', 'right_sr']}
    for side, getter in (('L', get_L_id), ('R', get_R_id)):
        try:
            ids = getter()
            if ids[0] is None:
                continue
            jc = PythonicJoyCon(*ids)
        except Exception as e:
            print(f'Joy-Con {side}: not available ({e})')
            continue
        fus = Fusion()

        def hook(j, side=side, fus=fus):
            for a, g in zip(j.accel_in_g, j.gyro_in_rad):
                fus.update(g, a, 1 / 180)
            sx, sy = j.stick_l if side == 'L' else j.stick_r
            JOY[side] = {
                'q': fus.xyzw(),
                'b': [n for n in btn_names[side] if getattr(j, n, False)],
                'st': [max(-1, min(1, (sx - 2048) / 1500)), max(-1, min(1, (sy - 2048) / 1500))],
                'ts': time.time(),
            }
        jc.register_update_hook(hook)
        print(f'Joy-Con {side}: connected')


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == '/joy':
            body = json.dumps(JOY).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body)
        elif self.path == '/ping':
            self.send_response(200); self.send_header('Content-Type', 'text/plain'); self.end_headers(); self.wfile.write(b'ok')
        else:
            super().do_GET()

    def do_POST(self):
        # Custom header + JSON type force a CORS preflight for other websites, which this server never answers,
        # so random web pages cannot drive your mouse through localhost.
        if self.path != '/input' or self.headers.get('X-VROS') != '1':
            self.send_error(403); return
        try:
            handle(json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0)))))
        except Exception as e:  # keep running on bad input
            print('input error:', e)
        self.send_response(204); self.end_headers()


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    threading.Thread(target=start_joycons, daemon=True).start()
    print(f'Screen {W}x{H}. Open http://localhost:8765 in Chrome/Edge. Ctrl+C to stop.')
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
