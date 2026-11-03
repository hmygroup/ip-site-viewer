// Guarda, por pestaña, la IP a la que Chrome se conectó realmente (details.ip).
// Con proxy, esa IP es la del PROXY, no la del sitio. Se contrasta con la resolución DNS.
const IPS_KEY = 'ipHosts'; // { ip: [hosts...] } -> heurística: misma IP para muchos hosts = proxy
const NATIVE = 'com.pedro.ipresolver';
const DNS_TTL = 60_000;

chrome.webRequest.onResponseStarted.addListener(
  async (d) => {
    if (d.tabId < 0) return;
    let host;
    try { host = new URL(d.url).hostname; } catch { return; }

    const tabKey = 'tab:' + d.tabId;
    const store = await chrome.storage.session.get([IPS_KEY, tabKey]);
    const prev = store[tabKey];
    const map = store[IPS_KEY] || {};

    let ip = d.ip;
    if (!ip && prev && prev.host === host) ip = prev.ip; // respuesta de caché: no trae IP

    let proxyLikely = false;
    if (ip) {
      const hosts = new Set(map[ip] || []);
      hosts.add(host);
      map[ip] = [...hosts].slice(-30);
      proxyLikely = map[ip].length >= 5;
    }

    await chrome.storage.session.set({
      [IPS_KEY]: map,
      [tabKey]: { host, url: d.url, ip: ip || null, fromCache: !!d.fromCache, proxyLikely, ts: Date.now() }
    });

    const text = !ip ? '?' : ip.includes(':') ? 'v6' : ip.split('.').pop();
    chrome.action.setBadgeText({ tabId: d.tabId, text });
    chrome.action.setBadgeBackgroundColor({ tabId: d.tabId, color: proxyLikely ? '#d9730d' : '#2b7de9' });
  },
  { urls: ['<all_urls>'], types: ['main_frame'] }
);

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove('tab:' + tabId));

// ---- Resolución para la burbuja ----
const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');

function nativeResolve(host) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE, { host }, (r) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!r || r.error) return reject(new Error((r && r.error) || 'sin respuesta'));
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

async function resolveHost(host) {
  if (isIp(host)) return { ips: [host], src: 'el host ya es una IP' };
  const key = 'dns:' + host;
  const cached = (await chrome.storage.session.get(key))[key];
  if (cached && Date.now() - cached.ts < DNS_TTL) return cached;

  let res;
  try { res = { ips: await nativeResolve(host), src: 'resolver del sistema' }; }
  catch {
    const { doh } = await chrome.storage.local.get('doh');
    if (doh) {
      try { res = { ips: await dohResolve(host), src: 'DNS público Cloudflare' }; }
      catch { res = { ips: [], src: 'DoH falló' }; }
    } else res = { ips: [], src: 'sin host nativo' };
  }
  res.ts = Date.now();
  await chrome.storage.session.set({ [key]: res });
  return res;
}

async function getInfo(tabId) {
  const tabKey = 'tab:' + tabId;
  let st;
  for (let i = 0; i < 5 && !st; i++) { // el content script puede llegar antes que el estado
    st = (await chrome.storage.session.get(tabKey))[tabKey];
    if (!st) await new Promise((r) => setTimeout(r, 200));
  }
  if (!st) return null;
  const { ips, src } = await resolveHost(st.host);
  return {
    host: st.host, conn: st.ip, ips, src,
    proxy: st.ip && ips.length ? !ips.includes(st.ip) : null, // null = no se sabe
    proxyLikely: st.proxyLikely
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'info' && sender.tab) {
    getInfo(sender.tab.id).then(sendResponse, () => sendResponse(null));
    return true; // respuesta asíncrona
  }
});
