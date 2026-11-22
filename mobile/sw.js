/* Serve as páginas clonadas (o "espelho") para o editor, como o computador faz com mirror:// */
const te = new TextEncoder(), td = new TextDecoder();
const MT = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'text/xml', '.avif': 'image/avif', '.otf': 'font/otf', '.map': 'application/json', '.webm': 'video/webm', '.mp3': 'audio/mpeg' };
let dbp = null;
const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('sharklab', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('files')) d.createObjectStore('files') }; r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error) } }));
const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
const fGet = async (id, p) => { const d = await db(); const r = await rq(d.transaction('files').objectStore('files').get(id + p)); return r ? new Uint8Array(r) : null };
const CM = new Map();
const cmGet = async c => { if (CM.has(c)) return CM.get(c); try { const d = await db(), m = await rq(d.transaction('kv').objectStore('kv').get('cmap')); if (m && m[c]) { CM.set(c, m[c]); return m[c] } } catch (e) { } return null };
const cmSet = async (c, id) => { if (!c || CM.get(c) == id) return; CM.set(c, id); try { const d = await db(), s = d.transaction('kv', 'readwrite').objectStore('kv'); const m = (await rq(s.get('cmap'))) || {}; const k = Object.keys(m); if (k.length > 60) k.slice(0, 30).forEach(x => delete m[x]); m[c] = id; s.put(m, 'cmap') } catch (e) { } };
const rt = {}; const stat = n => rt[n] || (rt[n] = fetch('/__sl/' + n, { cache: 'no-store' }).then(r => r.text()));
const ext = p => { const m = /\.[a-z0-9]+$/i.exec(p); return m ? m[0].toLowerCase() : '' };
/* arquivos que a pagina pede e a copia nao tem (a verificacao baixa do site original) */
const MISS = new Map(); const noteMiss = (id, p) => { let s = MISS.get(id); if (!s) MISS.set(id, s = new Set()); if (s.size < 400) s.add(p) };
self.addEventListener('message', e => { const d = e.data || {}, port = e.ports && e.ports[0]; if (!port) return; if (d.t == 'miss') port.postMessage([...(MISS.get(d.id) || [])]); else if (d.t == 'missReset') { MISS.set(d.id, new Set()); port.postMessage(1) } });

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

async function page(id, path, u) {
  let b = await fGet(id, '/index.html'); if (!b) return new Response('', { status: 404 });
  const q = u.searchParams, edit = q.has('edit'), orig = q.has('orig');
  let ops = '[]'; if (!orig) { const o = await fGet(id, '/_sl_ops.json'); if (o) ops = td.decode(o) }
  const sp = new URLSearchParams(u.search); sp.set('__sl', id);
  const fix = `<script>try{history.replaceState(null,'',${JSON.stringify(path + '?' + sp.toString() + u.hash)})}catch(e){}<\/script>`;
  const x = (q.has('diag') ? '<script src="/__sl/diag.js"><\/script>' : '') + fix + '<style>html{scrollbar-width:none}::-webkit-scrollbar{display:none}</style>' + `<script>${edit ? 'window.__SL_EDIT=1;' : ''}window.__SL_OPS=${ops.replace(/</g, '\\u003c')}<\/script><script src="/__sl/patch.js"><\/script>` + (/data-sl-x/.test(ops) ? '<script src="/__sl/patch-x.js"><\/script>' : '') + (edit ? '<script src="/__sl/agent.js"><\/script>' : '');
  let h = td.decode(b); h = /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, m => m + x) : x + h;
  return new Response(h, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
async function serve(id, path, u, nav) {
  let p; try { p = decodeURIComponent(path) } catch (e) { p = path }
  if (p.endsWith('/')) p += 'index.html';
  if (p == '/index.html') return page(id, '/' + (path == '/' ? '' : ''), u);
  let b = await fGet(id, p);
  if (!b) { if (nav || !ext(p) || ext(p) == '.html') return page(id, path, u); noteMiss(id, p); return new Response('', { status: 404 }) }
  return new Response(b, { headers: { 'content-type': MT[ext(p)] || 'application/octet-stream', 'cache-control': 'no-store' } });
}

self.addEventListener('fetch', e => {
  const r = e.request; let u; try { u = new URL(r.url) } catch (x) { return }
  if (u.origin !== location.origin) return;
  if (u.pathname.startsWith('/__sl/') || u.pathname == '/sw.js') return;
  const m = u.pathname.match(/^\/m\/([a-z0-9]+)(\/.*)?$/);
  if (m) { e.respondWith((async () => { await cmSet(e.resultingClientId, m[1]); const rest = m[2] || '/'; return serve(m[1], rest, u, r.mode == 'navigate') })()); return }
  // pedidos feitos de dentro de uma página clonada
  const tag = u.searchParams.get('__sl');
  e.respondWith((async () => {
    let id = null;
    if (r.mode == 'navigate' || r.destination == 'iframe') {
      id = tag; if (!id && r.referrer) { try { id = new URL(r.referrer).searchParams.get('__sl') } catch (x) { } }
      if (id) await cmSet(e.resultingClientId, id);
    } else { id = await cmGet(e.clientId); if (!id && r.referrer) { try { id = new URL(r.referrer).searchParams.get('__sl') } catch (x) { } } }
    if (!id) return fetch(r);
    return serve(id, u.pathname, u, r.mode == 'navigate');
  })());
});
