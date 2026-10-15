import http from 'node:http';

const PAGE = `<!doctype html><meta charset="utf-8"><title>VR OS Host</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:16px system-ui,sans-serif;background:#0b0f1a;color:#e8edff;max-width:560px;margin:32px auto;padding:0 16px}
button,select{font-size:16px;padding:8px 14px;border-radius:8px;border:0;margin:4px 4px 4px 0}button{background:#4f7cff;color:#fff}button.no{background:#555}
#code{font:700 56px monospace;letter-spacing:8px;color:#7CFC9A;margin:8px 0}.dim{color:#9fb0d8}#ask{background:#1b2547;padding:12px;border-radius:10px;margin:12px 0}</style>
<h1>VR OS Host</h1><div class="dim">Type this code on the headset's start screen:</div><div id="code">······</div>
<div id="ask" hidden>Headset <b id="who"></b> wants to connect. <button id="allow">Allow</button><button id="deny" class="no">Deny</button></div>
<div id="info" class="dim"></div><pre id="log" class="dim"></pre>
<div>Resolution <select id="w"><option value="1280">720p</option><option value="1600">900p</option><option value="1920">1080p</option></select>
Bitrate <select id="k"><option value="2000">2 Mbps</option><option value="4000">4 Mbps</option><option value="8000">8 Mbps</option><option value="12000">12 Mbps</option></select>
<button id="apply">Apply</button></div><p><button class="no" id="quit">Quit host</button> <span class="dim">You can close this tab; the host keeps running in the background.</span></p>
<script>const $=id=>document.getElementById(id),H={'X-VROS':'1'};let first=true;
const post=(p,b)=>fetch(p,{method:'POST',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify(b||{})});
$('allow').onclick=()=>post('/allow');$('deny').onclick=()=>post('/deny');$('quit').onclick=()=>{post('/quit');document.body.innerHTML='<h1>Host stopped</h1>'};
$('apply').onclick=()=>post('/settings',{width:$('w').value,kbps:$('k').value});
async function tick(){try{const s=await(await fetch('/state')).json();$('code').textContent=s.code;$('ask').hidden=!s.pending;$('who').textContent=s.pending||'';
if(first){$('w').value=s.settings.width;$('k').value=s.settings.kbps;first=false}
$('info').textContent=(s.streaming?'Streaming with '+s.streaming.encoder+': '+s.streaming.frames+' frames, '+s.streaming.mb+' MB. ':'State: '+s.state+'. ')+'Remote control: '+(s.control?'on':'off')+'. Joy-Con L/R: '+(s.joy.L?'yes':'no')+'/'+(s.joy.R?'yes':'no');
$('log').textContent=s.log.join('\\n')}catch(e){}setTimeout(tick,700)}tick();</script>`;

export function startUi(host, onQuit, port = +process.env.VROS_UI_PORT || 8765) {
  const srv = http.createServer((req, res) => {
    const okHost = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || ''); // blocks DNS-rebinding pages
    if (!okHost) { res.writeHead(403).end(); return; }
    if (req.method === 'GET' && req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE); return; }
    if (req.method === 'GET' && req.url === '/state') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(host.status())); return; }
    if (req.method === 'POST' && req.headers['x-vros'] === '1') { // custom header forces a CORS preflight, so other websites cannot call this
      let body = '';
      req.on('data', (d) => { body += d; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        let j = {}; try { j = JSON.parse(body || '{}'); } catch { /* ignore bad json */ }
        if (req.url === '/allow') host.approve();
        else if (req.url === '/deny') host.deny();
        else if (req.url === '/settings') host.set(j);
        else if (req.url === '/quit') { res.writeHead(200).end('bye'); onQuit(); return; }
        res.writeHead(200).end('ok');
      });
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve, reject) => { srv.once('error', reject); srv.listen(port, '127.0.0.1', () => resolve(srv)); });
}
