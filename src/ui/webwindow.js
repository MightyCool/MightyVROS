/** Real iframe web window. A DOM iframe cannot be drawn into the WebGL scene, so this is a 2D overlay with one iframe per eye. */
export function toEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return 'https://www.youtube.com/embed/' + u.pathname.slice(1);
    if (/(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === '/watch' && u.searchParams.get('v')) return 'https://www.youtube.com/embed/' + u.searchParams.get('v');
  } catch { /* not a URL */ }
  return url;
}

function forEye(url, eye) {
  try {
    const u = new URL(url);
    if (/(^|\.)youtube\.com$/.test(u.hostname) && u.pathname.startsWith('/embed/')) {
      u.searchParams.set('playsinline', '1');
      if (eye === 1) u.searchParams.set('mute', '1'); // avoid doubled audio
      return u.toString();
    }
  } catch { /* not a URL */ }
  return url;
}

export function openWebWindow(url) {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:20;background:#05070d;display:flex';
  const close = () => { root.remove(); document.body.classList.remove('web'); };
  [0, 1].forEach((eye) => {
    const half = document.createElement('div');
    half.style.cssText = 'flex:1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center';
    const f = document.createElement('iframe');
    f.src = forEye(url, eye);
    f.allow = 'autoplay; fullscreen; encrypted-media';
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation');
    f.style.cssText = 'width:80%;height:80%;border:0;border-radius:12px;background:#fff';
    const x = document.createElement('button');
    x.textContent = '✕';
    x.style.cssText = 'position:absolute;top:6px;right:12%;font-size:20px;border:0;border-radius:16px;padding:4px 12px;background:#ff5a5a;color:#fff;z-index:2';
    x.addEventListener('click', close);
    const cap = document.createElement('div');
    cap.textContent = 'Blank? This site blocks embedding.';
    cap.style.cssText = 'position:absolute;bottom:4px;left:0;right:0;text-align:center;font:12px sans-serif;color:#7f8fb8;transition:opacity 1s';
    setTimeout(() => { cap.style.opacity = '0'; }, 6000);
    half.append(f, x, cap);
    root.append(half);
  });
  document.body.append(root);
  document.body.classList.add('web');
}
