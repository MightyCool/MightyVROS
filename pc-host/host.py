#!/usr/bin/env python3
"""VR OS PC helper: serves the host page on http://localhost:8765 and applies mouse/keyboard input from the headset.
Setup: pip install pyautogui     Run: python host.py"""
import json, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

try:
    import pyautogui
except ImportError:
    sys.exit('Missing dependency. Run:  pip install pyautogui')

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


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == '/ping':
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
    print(f'Screen {W}x{H}. Open http://localhost:8765 in Chrome/Edge. Ctrl+C to stop.')
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
