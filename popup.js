const $ = (id) => document.getElementById(id);
const NATIVE = 'com.pedro.ipresolver';
const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');

function copyOnClick(el) {
  el.addEventListener('click', () => navigator.clipboard.writeText(el.textContent).catch(() => {}));
}
copyOnClick($('conn')); copyOnClick($('res'));

chrome.storage.local.get('bubble').then(({ bubble }) => { $('bubble').checked = !!bubble; });
$('bubble').addEventListener('change', (e) => chrome.storage.local.set({ bubble: e.target.checked }));

function nativeResolve(host) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE, { host }, (r) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!r || r.error) return reject(new Error(r && r.error || 'sin respuesta'));
      resolve(r.ips);
    });
  });
}

async function dohResolve(host) {
  const out = [];
  for (const type of ['A', 'AAAA']) {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
      { headers: { accept: 'application/dns-json' } });
    const j = await r.json();
    for (const a of j.Answer || []) if (a.type === (type === 'A' ? 1 : 28)) out.push(a.data);
  }
  return out;
}

async function proxyInfo() {
  try {
    const s = await chrome.proxy.settings.get({ incognito: false });
    const v = s.value || {};
    const names = { direct: 'directo', auto_detect: 'autodetección (WPAD)', pac_script: 'script PAC', fixed_servers: 'servidor fijo', system: 'del sistema' };
    return 'Proxy de Chrome: ' + (names[v.mode] || v.mode);
  } catch { return ''; }
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || '')) { $('host').textContent = 'Abre una página http(s)'; return; }
  const host = new URL(tab.url).hostname;
  $('host').textContent = host;
  $('proxy').textContent = await proxyInfo();

  const st = (await chrome.storage.session.get('tab:' + tab.id))['tab:' + tab.id];
  const conn = st && st.ip;
  $('conn').textContent = conn || 'no disponible (recarga la página)';

  const { doh } = await chrome.storage.local.get('doh');
  $('doh').checked = !!doh;
  $('doh').addEventListener('change', (e) => chrome.storage.local.set({ doh: e.target.checked }));

  let ips = [], src = '';
  if (isIp(host)) { ips = [host]; src = 'el host ya es una IP'; }
  else {
    try { ips = await nativeResolve(host); src = 'resolver del sistema (host nativo)'; }
    catch (e) {
      if (doh) {
        try { ips = await dohResolve(host); src = 'DNS público Cloudflare'; }
        catch (e2) { src = 'falló DoH: ' + e2.message; }
      } else src = 'host nativo no instalado; DoH desactivado';
    }
  }
  $('res').textContent = ips.length ? ips.join('\n') : '—';
  $('src').textContent = src;

  const v = $('verdict');
  if (conn && ips.length) {
    const same = ips.includes(conn);
    v.className = 'note' + (same ? ' good' : '');
    v.textContent = same
      ? 'Conexión directa: la IP de conexión coincide con la del sitio.'
      : 'Hay proxy (o balanceador/CDN): Chrome se conectó a ' + conn + ', que no es la IP del sitio. La IP real es la de arriba (según el DNS de este equipo).';
  } else if (st && st.proxyLikely) {
    v.className = 'note';
    v.textContent = 'La IP de conexión se repite en varios sitios: probablemente es la del proxy.';
  }
})();
