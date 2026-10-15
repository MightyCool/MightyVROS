import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

/** Splits an Annex-B H.264 byte stream into access units at AUD NAL units (type 9). */
export function frameSplitter(onFrame) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    const pos = [];
    for (let i = 0; i + 3 < buf.length; i++) {
      if (buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 1 && (buf[i + 3] & 0x1f) === 9) {
        pos.push(i > 0 && buf[i - 1] === 0 ? i - 1 : i);
        i += 2;
      }
    }
    if (pos.length < 2) return;
    for (let k = 0; k + 1 < pos.length; k++) onFrame(buf.subarray(pos[k], pos[k + 1]));
    buf = buf.subarray(pos[pos.length - 1]);
  };
}

const ENC = {
  libx264: ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-profile:v', 'baseline', '-level', '3.1'],
  h264_nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p1', '-tune', 'll', '-profile:v', 'baseline', '-rc', 'cbr'],
  h264_qsv: ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-profile:v', 'baseline'],
  h264_amf: ['-c:v', 'h264_amf', '-usage', 'ultralowlatency', '-profile:v', 'constrained_baseline'],
};

function source({ fps, screen }) {
  if (process.env.VROS_SOURCE === 'test') return ['-f', 'lavfi', '-i', `testsrc2=size=1920x1080:rate=${fps}`];
  if (process.platform === 'win32') {
    const size = screen ? ['-offset_x', '0', '-offset_y', '0', '-video_size', `${screen.w}x${screen.h}`] : [];
    return ['-f', 'gdigrab', '-framerate', String(fps), '-draw_mouse', '1', ...size, '-i', 'desktop'];
  }
  if (process.platform === 'darwin') return ['-f', 'avfoundation', '-framerate', String(fps), '-capture_cursor', '1', '-i', '1:none'];
  return ['-f', 'x11grab', '-framerate', String(fps), '-i', process.env.DISPLAY || ':0'];
}

function args(enc, { width, kbps, fps, screen }) {
  return ['-hide_banner', '-loglevel', 'error', ...source({ fps, screen }),
    '-vf', `scale=${width}:-2,format=yuv420p`, '-r', String(fps),
    ...ENC[enc], '-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${Math.round(kbps / 2)}k`, '-g', String(fps * 2), '-bf', '0',
    '-bsf:v', 'dump_extra=freq=keyframe,h264_metadata=aud=insert', '-flush_packets', '1', '-f', 'h264', '-'];
}

/** Starts ffmpeg (hardware H.264 encoder if one works, else libx264). Resolves to {stop(), encoder}. */
export async function startCapture(opts, onFrame, onExit) {
  const order = process.env.VROS_ENCODER ? [process.env.VROS_ENCODER]
    : process.platform === 'win32' ? ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'] : ['libx264'];
  for (const enc of order) {
    const p = spawn(ffmpegPath, args(enc, opts), { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 2000) err = err.slice(-2000); });
    const split = frameSplitter(onFrame);
    const ok = await new Promise((res) => {
      const t = setTimeout(() => res(false), 4000);
      p.stdout.once('data', (d) => { clearTimeout(t); split(d); p.stdout.on('data', split); res(true); });
      p.once('exit', () => { clearTimeout(t); res(false); });
    });
    if (ok) {
      p.once('exit', () => onExit && onExit());
      return { encoder: enc, stop: () => { try { p.kill(); } catch { /* already gone */ } } };
    }
    try { p.kill(); } catch { /* already gone */ }
    if (process.env.VROS_DEBUG) console.log(`encoder ${enc} unavailable: ${err.trim().split('\n').pop()}`);
  }
  throw new Error('No H.264 encoder could start (ffmpeg failed)');
}
