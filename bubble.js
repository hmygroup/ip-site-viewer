// Burbuja flotante con la IP del sitio. Se activa/desactiva desde el popup (chrome.storage.local.bubble).
(() => {
  if (window.top !== window) return;
  if (!/^https?:$/.test(location.protocol)) return;

  let host = null, root = null, info = null, dragged = false;

  const STYLE = `
    .b { font: 600 12px ui-monospace, Consolas, monospace; background: rgba(24,24,28,.92); color: #fff;
         border-radius: 14px; padding: 6px 10px; box-shadow: 0 2px 10px rgba(0,0,0,.35);
         cursor: grab; user-select: none; max-width: 300px; touch-action: none; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; margin-right: 6px; }
    .dot.warn { background: #f59e0b; }
    #det { display: none; margin-top: 6px; font-weight: 400; font-size: 11px; line-height: 1.4;
           white-space: pre-line; word-break: break-all; color: #d4d4da; }
    .open #det { display: block; }`;

  function build() {
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:12px;right:12px;';
    root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${STYLE}</style>
      <div class="b" id="b"><span class="dot" id="dot"></span><span id="main">…</span><div id="det"></div></div>`;
    document.documentElement.appendChild(host);

    const b = root.getElementById('b');
    let start = null;
    b.addEventListener('pointerdown', (e) => {
      const r = host.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      dragged = false;
      b.setPointerCapture(e.pointerId);
    });
    b.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < 4) return;
      dragged = true;
      const w = host.offsetWidth, h = host.offsetHeight;
      const left = Math.min(Math.max(0, start.left + dx), window.innerWidth - w);
      const top = Math.min(Math.max(0, start.top + dy), window.innerHeight - h);
      host.style.right = 'auto';
      host.style.left = left + 'px';
      host.style.top = top + 'px';
    });
    b.addEventListener('pointerup', () => {
      if (!start) return;
      start = null;
      if (dragged) {
        const r = host.getBoundingClientRect();
        chrome.storage.local.set({ bubblePos: { left: r.left, top: r.top } }).catch(() => {});
      } else b.classList.toggle('open');
    });
    b.addEventListener('dblclick', () => {
      const ip = root.getElementById('main').textContent;
      navigator.clipboard.writeText(ip).catch(() => {});
    });

    chrome.storage.local.get('bubblePos').then(({ bubblePos }) => {
      if (!bubblePos || !host) return;
      host.style.right = 'auto';
      host.style.left = Math.min(bubblePos.left, window.innerWidth - 60) + 'px';
      host.style.top = Math.min(bubblePos.top, window.innerHeight - 30) + 'px';
    }).catch(() => {});
  }

  function render() {
    if (!root) return;
    const main = root.getElementById('main'), dot = root.getElementById('dot'), det = root.getElementById('det');
    if (!info) { main.textContent = 'sin IP'; det.textContent = 'Sin datos de esta pestaña. Recarga la página.'; return; }

    main.textContent = (info.ips && info.ips[0]) || info.conn || 'sin IP';
    const warn = info.proxy === true || (info.proxy === null && info.proxyLikely);
    dot.className = 'dot' + (warn ? ' warn' : '');

    const lines = [info.host];
    if (info.conn) lines.push('Conexión: ' + info.conn);
    if (info.ips && info.ips.length) lines.push('Sitio: ' + info.ips.join(', ') + ' (' + info.src + ')');
    else lines.push('Sitio: no resuelto (' + info.src + ')');
    if (info.proxy === true) lines.push('⚠ Proxy/balanceador: la conexión no va a la IP del sitio.');
    else if (info.proxy === false) lines.push('Conexión directa.');
    else if (info.proxyLikely) lines.push('⚠ Probable proxy: esta IP se repite en varios sitios.');
    det.textContent = lines.join('\n');
  }

  async function refresh() {
    try { info = await chrome.runtime.sendMessage({ type: 'info' }); } catch { info = null; }
    render();
  }

  function apply(enabled) {
    if (enabled && !host) { build(); refresh(); }
    else if (!enabled && host) { host.remove(); host = root = null; }
  }

  try {
    chrome.storage.local.get('bubble').then(({ bubble }) => apply(!!bubble));
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && ch.bubble) apply(!!ch.bubble.newValue);
    });
  } catch { /* extensión recargada: esta página necesita refrescarse */ }
})();
