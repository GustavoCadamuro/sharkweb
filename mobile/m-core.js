/* Shark Lab (celular) — camada que faz o papel do "main.js" do computador.
   Guarda as páginas no aparelho (IndexedDB), cuida de clonar, publicar (Netlify/FTP) e exportar. */
(function () {
  'use strict';
  const te = new TextEncoder(), td = new TextDecoder();
  const NATIVE = () => { try { return window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() } catch (e) { return false } };
  // o "ponte" do Capacitor sem empacotador só tem nativePromise (não existe registerPlugin)
  const plug = n => { try { const C = window.Capacitor; if (!C || !C.nativePromise) return null; return new Proxy({}, { get: (_, m) => m === 'then' ? undefined : (o => C.nativePromise(n, String(m), o || {})) }) } catch (e) { return null } };
  const SN = () => NATIVE() ? (SN.p || (SN.p = plug('SharkNative'))) : null;

  /* ---------- utilidades binárias ---------- */
  const u8b64 = u => { let s = '', c = 0x8000; for (let i = 0; i < u.length; i += c) s += String.fromCharCode.apply(null, u.subarray(i, i + c)); return btoa(s) };
  const b64u8 = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u };
  const toU8 = x => x instanceof Uint8Array ? x : typeof x == 'string' ? te.encode(x) : new Uint8Array(x);
  const same = (a, b) => { if (a.length != b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] != b[i]) return false; return true };
  const sha1 = async u => [...new Uint8Array(await crypto.subtle.digest('SHA-1', u))].map(x => x.toString(16).padStart(2, '0')).join('');

  /* ---------- armazenamento (IndexedDB) ---------- */
  let db = null;
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('sharklab', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('files')) d.createObjectStore('files') }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  const st = (n, m) => db.transaction(n, m || 'readonly').objectStore(n);
  const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error) });
  const kvGet = k => rq(st('kv').get(k));
  const kvSet = (k, v) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); return done(t) };
  const range = id => IDBKeyRange.bound(id + '/', id + '/\uffff');
  const HC = new Map(); let GEN = 0; const hcDrop = (id, p) => { GEN++; if (p == null) HC.delete(id); else { const m = HC.get(id); if (m) m.delete(p) } };
  const fGet = async (id, p) => { const r = await rq(st('files').get(id + p)); return r ? new Uint8Array(r) : null };
  const fPut = (id, p, u) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(toU8(u).buffer.slice(toU8(u).byteOffset, toU8(u).byteOffset + toU8(u).byteLength), id + p); return done(t).then(() => hcDrop(id, p)) };
  const fKeys = async id => (await rq(st('files').getAllKeys(range(id)))).map(k => k.slice(id.length));
  const fDelAll = id => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').delete(range(id)); return done(t).then(() => hcDrop(id)) };
  const fCopy = async (a, b) => { const keys = await rq(st('files').getAllKeys(range(a))), vals = await rq(st('files').getAll(range(a))); const t = db.transaction('files', 'readwrite'), s = t.objectStore('files'); s.delete(range(b)); keys.forEach((k, i) => { if (!/_sl_bak/.test(k)) s.put(vals[i], b + k.slice(a.length)) }); return done(t).then(() => hcDrop(b)) };
  const fMany = async (id, items) => { const t = db.transaction('files', 'readwrite'), s = t.objectStore('files'); s.delete(range(id)); for (const [p, u] of items) { const x = toU8(u); s.put(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength), id + p) } return done(t).then(() => hcDrop(id)) };

  let PAGES = null, CFG = '';
  const saveP = p => { PAGES = p; return kvSet('pages', JSON.stringify(p)).then(() => ({ ok: true }), e => ({ ok: false, error: String(e && e.message || e) })) };

  /* ---------- mime / injeção do editor ---------- */
  const TX = /\.(html|js|mjs|css|json|svg|txt|xml)$/i;
  const rt = (() => { const m = {}; return n => m[n] || (m[n] = fetch('/__sl/' + n).then(r => r.text())) })();
  const opsOf = async id => { const u = await fGet(id, '/_sl_ops.json'); return u ? td.decode(u) : '[]' };
  async function injectInline(html, id, ops) {
    if (!/<meta[^>]+name=["']google["'][^>]*notranslate/i.test(html) && !/<meta[^>]+notranslate[^>]*name=["']google["']/i.test(html)) html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + '<meta name="google" content="notranslate">') : '<meta name="google" content="notranslate">' + html;
    html = html.replace(/<html\b([^>]*)>/i, (m, a) => /\btranslate\s*=/i.test(a) ? m : '<html' + a + ' translate="no">');
    const x = `<script>window.__SL_OPS=${asciiJs((ops || await opsOf(id)).replace(/</g, '\\u003c'))}<\/script><script>${await rt('patch.js')}<\/script>`;
    return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + x) : x + html;
  }
  async function siteFiles(id, inject, ops) {
    const F = {};
    for (const p of (await fKeys(id)).sort()) {
      if (p.startsWith('/_sl')) continue;
      let b = await fGet(id, p);
      if (p == '/index.html') { let h = await injectInline(td.decode(b), id, ops ? JSON.stringify(ops) : null); if (inject) h = h.replace(/<\/head>/i, () => inject + '</head>'); h = fixCharset(h); b = te.encode(h) }
      F[p] = b;
    }
    if (!F['/_redirects']) F['/_redirects'] = te.encode('/*  /index.html  200\n');
    return F;
  }
  const SPA_RE = /<div\s+id=["']root["']\s*>\s*<\/div>/i, KEEP1 = /^\/(favicon[^/]*|robots\.txt|placeholder\.svg|sitemap\.xml|manifest[^/]*|apple-touch-icon[^/]*|og[^/]*\.(png|jpg|webp))$/i;
  const HASHED = p => { const m = /[-_.]([A-Za-z0-9_]{8,32})\.(?:m?js|css)$/.exec(p); if (!m) return false; const k = m[1]; return /^[0-9a-f]{8,32}$/i.test(k) || (k.length == 8 && !/^[A-Z]?[a-z]+$/.test(k) && /\d|[A-Z].*[A-Z]|[a-z].*[A-Z]/.test(k)) };
  function isSpaHtml(h) { const mod = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=|<script\b[^>]*\bsrc=[^>]*\btype=["']module["']/i.test(h) || /<script\b[^>]*\btype=["']module["'][^>]*>[^<]*import\(\s*["']\/[^"']+\.m?js/i.test(h), abs = /["'(]\/(assets|_next|build)\/[^"')\s]+\.m?js/i.test(h); return SPA_RE.test(h) || (/<div\s+id=["']root["'][^>]*>/i.test(h) && mod) || (mod && abs) || /\$_TSR|__TSR__|__remixContext|__NEXT_DATA__/.test(h) }
  async function funnelFiles(steps) {
    const out = {}, srcOf = {}; let spa = false;
    for (const s of steps) {
      const F = await siteFiles(s.pid, s.inject, s.ops || null), slug = String(s.slug || '').replace(/^\/+|\/+$/g, '');
      let h = td.decode(F['/index.html'] || new Uint8Array()); delete F['/index.html']; delete F['/_redirects']; delete F['/.htaccess'];
      const isSpa = isSpaHtml(h);
      if (slug) {
        if (isSpa) { spa = true; h = h.replace(/<head[^>]*>/i, m => m + '<script>(function(){try{var p=location.pathname.replace(/\\/+$/,"");if(p){var q=location.search;history.replaceState(history.state,"","/?sl=' + slug + '"+(q?"&"+q.slice(1):"")+location.hash)}}catch(e){}})()<\/script>') }
        out['/' + slug + '/index.html'] = te.encode(h);
      } else out['/index.html'] = te.encode(h);
      for (const p in F) {
        const b = F[p];
        if (out[p]) { if (!same(out[p], b) && !KEEP1.test(p) && !HASHED(p) && !(s.origin && srcOf[p] && s.origin === srcOf[p])) throw new Error('As páginas do funil usam o mesmo arquivo ' + p + ' com conteúdos diferentes (etapa "' + (s.name || slug || 'Front') + '"). Use páginas feitas do mesmo modelo ou me peça ajuda para separar.') } else { out[p] = b; srcOf[p] = s.origin || '' }
        if (slug && !isSpa) { const q = '/' + slug + p; if (!out[q]) out[q] = b }
      }
    }
    if (spa && out['/index.html']) out['/index.html'] = te.encode(td.decode(out['/index.html']).replace(/<head[^>]*>/i, m => m + '<script>(function(){try{var m=/[?&]sl=([\\w-]+)/.exec(location.search);if(m){var r=location.search.replace(/([?&])sl=[\\w-]+&?/,"$1").replace(/[?&]$/,"");location.replace("/"+m[1]+"/"+r+location.hash)}}catch(e){}})()<\/script>'));
    if (!out['/index.html']) { const f = steps.find(x => x.slug) || {}; out['/index.html'] = te.encode('<!doctype html><meta charset=utf-8><meta http-equiv=refresh content="0;url=/' + (f.slug || '') + '/">') }
    if (!out['/_redirects']) out['/_redirects'] = te.encode('/*  /index.html  200\n');
    return out;
  }
  /* ---------- publicar na Hostinger pelo ponto de encontro (mesmas regras do computador) ---------- */
  const HTC = '\n# Shark Lab: o navegador e o CDN sempre confirmam se ha versao mais nova das paginas\n<IfModule mod_headers.c>\n<FilesMatch "\\.(html?|php)$">\nHeader set Cache-Control "no-cache, must-revalidate"\n</FilesMatch>\n</IfModule>\n';
  const cat = (a, b) => { const u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u };
  async function hostFiles(mirror, inject, ops, steps) {
    const F = steps ? await funnelFiles(steps) : await siteFiles(mirror, inject, ops); delete F['/_redirects'];
    if (!F['/.htaccess']) F['/.htaccess'] = te.encode(HTA + HTC); else if (!/Cache-Control/i.test(td.decode(F['/.htaccess']))) F['/.htaccess'] = cat(F['/.htaccess'], te.encode(HTC));
    return F;
  }
  async function pathFiles(mirror, inject, ops, slug, nr) {
    const out = await funnelFiles([{ pid: mirror, slug, name: slug, inject, ops }]); delete out['/index.html']; delete out['/_redirects']; delete out['/.htaccess'];
    const k = '/' + slug + '/index.html';
    if (out[k]) {
      let h0 = td.decode(out[k]); const _a = 'history.replaceState(history.state,"","/?sl=' + slug + '"+(q?"&"+q.slice(1):"")+location.hash)', _b = 'history.replaceState(history.state,"","/"+q+location.hash)';
      if (h0.indexOf(_a) >= 0) { h0 = h0.replace(_a, () => _b); out[k] = te.encode(h0) }
      if (!nr && h0.indexOf(_b) >= 0) out[k] = te.encode(h0.replace(/<head[^>]*>/i, m => m + '<script>' + prettyJs(slug) + '<\/script>'));
    }
    out['/' + slug + '/.htaccess'] = te.encode(HTC.replace(/^\n/, ''));
    return out;
  }
  async function liveCheck(domain, tok, gap) {
    const d = String(domain || '').trim().replace(/\/+$/, ''), B = /^https?:\/\//i.test(d) ? d : 'https://' + d, out = { state: 'net', status: 0, srv: '', err: '' };
    const get = async u => { try { const r = await nfetch(u, { headers: { accept: 'text/html,*/*' } }); const body = await r.text(); return { status: r.status, server: r.headers.get('server') || '', body } } catch (e) { return { err: String(e && e.message || e) } } };
    for (let i = 0; i < 4; i++) {
      if (i) await new Promise(r => setTimeout(r, gap || 3000));
      const a = await get(B + '/_sl_pub.json?r=' + Date.now() + 'x' + i); if (a.err) { out.state = 'net'; out.err = a.err; continue }
      out.err = ''; out.status = a.status; out.srv = a.server; let srv = false; try { srv = JSON.parse(a.body).token === tok } catch { }
      if (!srv) { out.state = /netlify/i.test(a.server) ? 'netlify' : 'outro'; continue }
      const p = await get(B + '/'); if (p.err) { out.state = 'net'; out.err = p.err; continue }
      if (p.body.indexOf('sl-pub:' + tok) >= 0) { out.state = 'ok'; return out }
      out.state = 'cache';
    }
    return out;
  }
  const hubNeeds = 'Para publicar pelo celular, conecte a sincronização com o computador (Configurações > Sincronização entre aparelhos).';
  /* ---------- velocidade (imagens leves, carregamento) ---------- */
  async function speedRun(F, o) {
    try {
      if (typeof makeSpeed != 'function' || typeof OffscreenCanvas == 'undefined' || typeof createImageBitmap == 'undefined') return { imgs: 0, from: 0, to: 0, files: 0, notes: ['sem suporte'], failed: 1 };
      const G = Object.assign({}, F);
      const E = {
        sha1,
        enc: async (u, mime, w, q) => { const r = await speedCanvasEnc(u8b64(u), mime, w, q); if (!r || !r.b64) return null; return { u8: b64u8(r.b64), w: r.w, h: r.h } },
        cacheGet: async k => { try { const v = await kvGet('spd:' + k); return v ? new Uint8Array(v) : null } catch { return null } },
        cachePut: async (k, v) => { try { await kvSet('spd:' + k, v) } catch { } }
      };
      const rep = await makeSpeed(E).apply(G, o);
      for (const p in G) F[p] = G[p];
      return rep;
    } catch (e) { return { imgs: 0, from: 0, to: 0, files: 0, notes: ['falhou: ' + String(e && e.message || e).slice(0, 120)], failed: 1 } }
  }
  async function hubPublish({ h, mirror, inject, ops, steps, owner, domain, force, liveGap, path: sp, mk, nr, speed }) {
    const HUB = window.SLHUB; if (!HUB) return { ok: false, error: hubNeeds };
    const dir = String((h && h.dir) || '').trim().replace(/\\/g, '/').replace(/\/+$/, ''); if (!dir || dir == '/') return { ok: false, error: hubNeeds };
    const slug = String(sp || '').replace(/^\/+|\/+$/g, '');
    const F = slug && !steps ? await pathFiles(mirror, inject, ops, slug, nr) : await hostFiles(mirror, inject, ops, steps);
    let spr = null; if (speed && speed.on) spr = await speedRun(F, { slug, trk: !!speed.trk });
    const tok = [...crypto.getRandomValues(new Uint8Array(8))].map(x => x.toString(16).padStart(2, '0')).join('');
    for (const p in F) if (/(^|\/)index\.html$/.test(p)) F[p] = cat(F[p], te.encode('\n<!--sl-pub:' + tok + '-->'));
    const man = {}, list = []; for (const p of Object.keys(F).sort()) { const u = F[p], hh = await sha1(u); man[p] = [u.length, hh]; list.push({ h: hh, u8: u }) }
    let r = null;
    for (let t = 0; t < 3; t++) {
      await HUB.putBlobs(list);
      r = await HUB.hubJson('publish', '', { dir, slug, files: man, tok, owner: owner || {}, force: !!force, mk: !!mk });
      if (r.status == 422 && r.json && r.json.error == 'faltam') continue; break;
    }
    if (r.status == 404) return { ok: false, error: 'O ponto de encontro na Hostinger está desatualizado. Abra o Shark Lab no computador (v48 ou mais novo) e deixe a sincronização rodar uma vez.' };
    const j = r.json || {}; if (r.status != 200 || !j.ok) { if (j.conflict || j.noDir) return j; if (/já existem neste domínio/.test(j.error || '')) return { ok: false, error: 'O ponto de encontro na Hostinger ainda é de uma versão antiga e não consegue publicar esta página. Abra o Shark Lab (versão mais recente) no computador (ele atualiza o ponto de encontro sozinho em alguns segundos) e publique de novo.' }; return { ok: false, error: j.error || ('O servidor respondeu ' + r.status) } }
    const live = domain ? await liveCheck(domain, tok, liveGap) : null;
    return { ok: true, n: j.n, live, speed: spr, kept: (j.kept || []).filter(p => !HASHED(p)).length };
  }
  const HTA = 'RewriteEngine On\nRewriteBase /\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule . /index.html [L]\n';
  async function filesStatic(mirror, inject, ops, steps) { const F = steps ? await funnelFiles(steps) : await siteFiles(mirror, inject, ops); delete F['/_redirects']; if (!F['/.htaccess']) F['/.htaccess'] = te.encode(HTA); return F }

  /* ---------- rede sem as limitações do navegador ---------- */
  async function nfetch(url, opt) {
    opt = opt || {}; const n = SN();
    if (!n) return fetch(url, opt);
    const headers = {}; if (opt.headers) { if (opt.headers.forEach && !Array.isArray(opt.headers)) opt.headers.forEach((v, k) => headers[k] = v); else Object.assign(headers, opt.headers) }
    let b64 = ''; if (opt.body != null) b64 = u8b64(toU8(opt.body instanceof URLSearchParams ? opt.body.toString() : opt.body));
    const r = await n.http({ url, method: opt.method || 'GET', headers, b64 });
    const body = [101, 204, 205, 304].includes(r.status) ? null : b64u8(r.b64 || '');
    return new Response(body, { status: r.status, headers: r.headers || {} });
  }

  /* ---------- clonar ---------- */
  function procClone(id, res, finUrl) {
    const fin = new URL(finUrl), origin = fin.origin, items = []; let doc = false;
    for (const f of res) {
      let u; try { u = new URL(f.u) } catch { continue } if (u.origin != origin) continue;
      let p; try { p = decodeURIComponent(u.pathname) } catch { p = u.pathname }
      if (f.main || f.t == 'Document') { if (doc || (p.includes('.') && !p.endsWith('.html') && !f.main)) continue; doc = true; p = '/index.html' } else if (p.endsWith('/')) continue;
      let b = f.b;
      if (p == '/index.html') {
        let h = td.decode(b).split(origin).join('');
        if (fin.pathname != '/' && !fin.pathname.includes('.')) { const s = `<script>history.replaceState(null,'','${fin.pathname}')<\/script>`; h = /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, m => m + s) : s + h }
        b = te.encode(h);
      }
      items.push([p, b]);
    }
    return { doc, items };
  }
  async function cloneNative(n, id, url) {
    const r = await n.cloneStart({ url });
    try {
      const res = [];
      const same = r.files.filter(f => { try { return new URL(f.u).origin == new URL(r.url).origin } catch { return false } });
      for (const f of same) { const x = await n.cloneRead({ ticket: r.ticket, i: f.i }); res.push({ u: f.u, t: f.t, main: f.main, b: b64u8(x.b64) }) }
      return { url: r.url, res, thumb: r.thumb };
    } finally { try { await n.cloneDone({ ticket: r.ticket }) } catch { } }
  }
  async function cloneRaw(n, url, onp) {
    const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
    const get = async u => { const r = await n.http({ url: u, method: 'GET', headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'pt-BR,pt;q=0.9' } }); const h = r.headers || {}; return { u: r.url, st: r.status, ct: h['Content-Type'] || h['content-type'] || '', b: b64u8(r.b64 || '') } };
    const main = await get(url); if (main.st >= 400) throw new Error('O site respondeu com erro ' + main.st + '.');
    const base = new URL(main.u), seen = new Set([main.u]), res = [{ u: main.u, t: 'Document', main: true, b: main.b }], q = [];
    const refs = (txt, from, isCss, isJs) => {
      const out = new Set(); let m;
      if (!isCss && !isJs) { const re = /(?:src|href|poster|data-src|data-bg)\s*=\s*["']([^"'#]+)["']/gi; while ((m = re.exec(txt))) out.add(m[1]); const ss = /srcset\s*=\s*["']([^"']+)["']/gi; while ((m = ss.exec(txt))) m[1].split(',').forEach(x => out.add(x.trim().split(/\s+/)[0])) }
      const cu = /url\(\s*["']?([^"')]+)["']?\s*\)/gi; while ((m = cu.exec(txt))) out.add(m[1]);
      if (isCss) { const im = /@import\s+["']([^"']+)["']/gi; while ((m = im.exec(txt))) out.add(m[1]) }
      if (isJs) { const a = /["'`](\/[^"'`\s]+\.(?:js|mjs|css|png|jpe?g|webp|svg|gif|avif|woff2?|ttf|mp4|ico))["'`]/gi; while ((m = a.exec(txt))) out.add(m[1]); const r = /["'`]\.\/([^"'`\s]+\.(?:js|mjs|css))["'`]/gi; while ((m = r.exec(txt))) out.add('./' + m[1]) }
      const ok = []; out.forEach(x => { try { if (/^(data:|mailto:|tel:|javascript:|blob:)/i.test(x)) return; const u = new URL(x, from); if (u.origin == base.origin) { u.hash = ''; ok.push(u.href) } } catch (e) { } }); return ok;
    };
    const txt = b => td.decode(b);
    refs(txt(main.b), main.u, false, false).forEach(u => { if (!seen.has(u)) { seen.add(u); q.push(u) } });
    let n2 = 0;
    while (q.length && n2 < 500) {
      const batch = q.splice(0, 6); n2 += batch.length; if (onp) onp(n2);
      await Promise.all(batch.map(async u => {
        try {
          const f = await get(u); if (f.st >= 300) return; const ct = f.ct.toLowerCase();
          res.push({ u: f.u, t: '', b: f.b });
          const isCss = /css/.test(ct) || /\.css(\?|$)/i.test(u), isJs = /javascript/.test(ct) || /\.m?js(\?|$)/i.test(u);
          if ((isCss || isJs) && f.b.length < 3e6) refs(txt(f.b), f.u, isCss, isJs).forEach(x => { if (!seen.has(x)) { seen.add(x); q.push(x) } });
        } catch (e) { }
      }));
    }
    return { url: main.u, res, thumb: '' };
  }
  async function cloneWeb(url) { // só para testes no computador / quando o plugin não existe
    const base = new URL(url), seen = new Map(), res = [];
    const get = async (u, main) => { if (seen.has(u)) return; seen.set(u, 1); let r; try { r = await fetch(u) } catch { return } if (!r.ok) return; const b = new Uint8Array(await r.arrayBuffer()); res.push({ u: r.url, t: main ? 'Document' : '', main, b }); return { b, ct: r.headers.get('content-type') || '' } };
    const d = await get(url, true); if (!d) throw new Error('Não consegui abrir o endereço.');
    const html = td.decode(d.b), refs = new Set();
    for (const m of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)) refs.add(m[1]);
    for (const m of html.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) refs.add(m[1]);
    for (const r of refs) { try { const u = new URL(r, base); if (u.origin == base.origin) { const g = await get(u.href, false); if (g && /css/.test(g.ct)) for (const m of td.decode(g.b).matchAll(/url\(["']?([^"')]+)["']?\)/gi)) { try { const q = new URL(m[1], u); if (q.origin == base.origin) await get(q.href, false) } catch { } } } } catch { } }
    return { url, res, thumb: '' };
  }

  /* ---------- FTP ---------- */
  const ftpErr = e => {
    const m = String(e && e.message || e);
    if (/530|Login|auth|incorret/i.test(m) && !/Unable to resolve|UnknownHost/.test(m)) return 'Usuário ou senha do FTP incorretos. Confira em hPanel > Arquivos > Contas FTP.';
    if (/UnknownHost|Unable to resolve|ENOTFOUND/i.test(m)) return 'Servidor FTP não encontrado. Confira o endereço do servidor.';
    if (/timed out|timeout/i.test(m)) return 'O servidor FTP demorou demais para responder. Confira o servidor e a internet.';
    if (/refused/i.test(m)) return 'O servidor FTP recusou a conexão. Confira o servidor.';
    if (/SSL|TLS|certificate|handshake/i.test(m)) return 'Falha na conexão criptografada. Se o servidor não aceitar, desmarque "Conexão criptografada" nas configurações. Detalhe: ' + m;
    return m;
  };
  const ftpOpts = h => { const m = String(h.host || '').trim().match(/^(.*?)(?::(\d+))?$/); return { host: m[1], port: +m[2] || 21, user: String(h.user || '').trim(), pass: String(h.pass || ''), secure: h.tls === 0 ? false : true } };

  /* ---------- zip / compartilhar ---------- */
  async function zipOf(F) { const z = new JSZip(); for (const p in F) z.file(p.replace(/^\/+/, ''), F[p]); return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }) }
  async function saveOut(name, u8, mime) {
    if (NATIVE()) {
      const fsP = plug('Filesystem'), sh = plug('Share');
      const w = await fsP.writeFile({ path: name, data: u8b64(u8), directory: 'CACHE', recursive: true });
      await sh.share({ title: name, url: w.uri, dialogTitle: 'Salvar ou enviar' });
      return { ok: true, path: name };
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: mime || 'application/zip' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return { ok: true, path: name };
  }

  /* ---------- IA / painéis (copiados do computador) ---------- */
  const AISYS = `Você é o assistente de edição do Shark Lab, dentro de um editor visual de páginas de vendas. A página já está clonada e é renderizada em JavaScript. Você a modifica pelas ferramentas, que agem em elementos identificados por "caminho": lista de índices de filhos a partir de <body> (ex.: [0,2,1]).
Você recebe o mapa da página (linhas "[caminho] tag.classes "texto" LarguraxAltura") e, quando houver, o elemento que o usuário selecionou.
Regras:
- Use somente caminhos que existam no mapa. Se faltar informação (qual elemento, qual texto), pergunte antes de agir.
- Com várias mudanças estruturais (remover, inserir, duplicar, mover), aplique do FIM da página para o INÍCIO, para os caminhos anteriores continuarem válidos.
- Estilos: CSS concreto (cores hex, px/rem). Eles são aplicados com !important.
- HTML inserido: autocontido, estilos inline, responsivo (mobile primeiro, flex-wrap, max-width), visual profissional: espaçamento generoso, tipografia limpa, bom contraste, botões com cantos arredondados. Sem scripts. Imagens só com URLs dadas pelo usuário; senão use blocos de cor/gradiente.
- Texto puro: set_text. Texto com formatação: set_html.
- Responda sempre em português do Brasil, em 1 a 3 frases, dizendo o que mudou.`;
  const PATH = { type: 'array', items: { type: 'integer' }, description: 'caminho do elemento' };
  const AITOOLS = [
    { name: 'set_text', description: 'Troca o texto do elemento (texto puro).', input_schema: { type: 'object', properties: { path: PATH, text: { type: 'string' } }, required: ['path', 'text'] } },
    { name: 'set_html', description: 'Troca o HTML interno do elemento.', input_schema: { type: 'object', properties: { path: PATH, html: { type: 'string' } }, required: ['path', 'html'] } },
    { name: 'set_style', description: 'Aplica estilos CSS ao elemento.', input_schema: { type: 'object', properties: { path: PATH, props: { type: 'object', description: 'propriedade CSS -> valor, ex.: {"color":"#fff","font-size":"28px"}', additionalProperties: { type: 'string' } } }, required: ['path', 'props'] } },
    { name: 'set_attr', description: 'Define um atributo (href, src, alt...).', input_schema: { type: 'object', properties: { path: PATH, name: { type: 'string' }, value: { type: 'string' } }, required: ['path', 'name', 'value'] } },
    { name: 'remove', description: 'Remove o elemento.', input_schema: { type: 'object', properties: { path: PATH }, required: ['path'] } },
    { name: 'duplicate', description: 'Duplica o elemento logo abaixo dele.', input_schema: { type: 'object', properties: { path: PATH }, required: ['path'] } },
    { name: 'move', description: 'Move o elemento uma posição para cima (-1) ou para baixo (1) entre os irmãos.', input_schema: { type: 'object', properties: { path: PATH, dir: { type: 'integer', enum: [-1, 1] } }, required: ['path', 'dir'] } },
    { name: 'insert_html', description: 'Insere HTML novo antes/depois de um elemento, ou no fim da página (position "end", path []).', input_schema: { type: 'object', properties: { path: PATH, position: { type: 'string', enum: ['before', 'after', 'end'] }, html: { type: 'string' } }, required: ['position', 'html'] } }];
  const okPath = p => Array.isArray(p) && p.length < 40 && p.every(n => Number.isInteger(n) && n >= 0);
  const escH = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const safeH = h => String(h).replace(/<script[\s\S]*?<\/script\s*>/gi, '').replace(/<script[^>]*>/gi, '').replace(/javascript:/gi, '');
  function toOps(n, i) {
    i = i || {}; const p = i.path;
    if (n == 'insert_html') { const e = i.position == 'end' || !p || !p.length; if (!e && !okPath(p)) return []; return [{ op: 'ins', path: e ? [] : p, pos: e ? 'end' : (i.position == 'before' ? 'before' : 'after'), html: safeH(i.html) }] }
    if (!okPath(p)) return [];
    switch (n) {
      case 'set_text': return [{ op: 'text', path: p, html: escH(i.text) }]; case 'set_html': return [{ op: 'text', path: p, html: safeH(i.html) }];
      case 'set_style': { const pr = {}; for (const k in (i.props || {})) if (/^[a-z-]+$/i.test(k)) pr[k] = String(i.props[k]); return Object.keys(pr).length ? [{ op: 'style', path: p, props: pr }] : [] }
      case 'set_attr': return /^on/i.test(i.name) || !/^[a-z-]+$/i.test(i.name) ? [] : [{ op: 'attr', path: p, k: i.name, v: /^javascript:/i.test(i.value) ? '' : String(i.value) }];
      case 'remove': return [{ op: 'rm', path: p }]; case 'duplicate': return [{ op: 'dup', path: p }]; case 'move': return [{ op: 'mv', path: p, dir: i.dir < 0 ? -1 : 1 }]
    } return [];
  }
  const CKU = 'https://api.cakto.com.br', FBU = 'https://graph.facebook.com';
  async function jf(url, opt) { const r = await nfetch(url, opt), t = await r.text(); let j = null; try { j = JSON.parse(t) } catch { } if (!r.ok) { const e = new Error((j && ((j.error && (j.error.message || j.error)) || j.detail || j.message)) || t.slice(0, 160) || ('Erro ' + r.status)); e.status = r.status; throw e } return j }
  let ckTok = null;
  async function ckToken(id, sec) { const k = id + '|' + sec; if (ckTok && ckTok.k == k && ckTok.exp > Date.now() + 60000) return ckTok.t; const j = await jf(CKU + '/public_api/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: id, client_secret: sec }).toString() }); ckTok = { k, t: j.access_token, exp: Date.now() + (j.expires_in || 36000) * 1000 }; return ckTok.t }
  const spDay = s => s ? new Date(s).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) : '';
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) };
  async function ckOrders(id, sec, from) {
    const tok = await ckToken(id, sec), H = { Authorization: 'Bearer ' + tok }, stop = addDay(from, -6), out = []; let url = CKU + '/public_api/orders/?limit=100&ordering=-createdAt', pages = 0, dn = false;
    while (url && !dn && pages++ < 400) { const j = await jf(url, { headers: H }); for (const o of j.results || []) { if (spDay(o.createdAt) < stop) { dn = true; break } out.push({ id: o.id, ref: o.refId, st: String(o.status || '').toLowerCase(), amount: +o.amount || 0, fees: +o.fees || 0, created: o.createdAt, paid: o.paidAt || null, refunded: o.refundedAt || null, cb: o.chargedbackAt || null, pm: o.paymentMethod || '', type: o.type || '', offer: o.offer_type || '', prod: (o.product && o.product.name) || '', camp: o.utm_campaign || '', src: o.utm_source || '', med: o.utm_medium || '', cont: o.utm_content || '', sck: o.sck || '' }) } url = j.next || null }
    return out;
  }
  async function mtRows(token, acct, from, to, ver) {
    const id = String(acct).replace(/\D/g, ''), q = new URLSearchParams({ level: 'campaign', fields: 'campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,account_currency', time_range: JSON.stringify({ since: from, until: to }), time_increment: '1', limit: '500', access_token: token }); let url = FBU + '/' + (ver ? ver + '/' : '') + 'act_' + id + '/insights?' + q, pages = 0; const out = [];
    while (url && pages++ < 100) { const j = await jf(url); for (const r of j.data || []) out.push({ date: r.date_start, cid: r.campaign_id, name: r.campaign_name, spend: +r.spend || 0, imps: +r.impressions || 0, clicks: +(r.inline_link_clicks || r.clicks) || 0, cur: r.account_currency || '' }); url = (j.paging && j.paging.next) || null } return out;
  }
  const doh = async (name, type) => { try { const r = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + type); const j = await r.json(); return (j.Answer || []).filter(a => a.type == (type == 'A' ? 1 : 5)).map(a => a.data) } catch { try { const r = await nfetch('https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + type); const j = await r.json(); return (j.Answer || []).filter(a => a.type == (type == 'A' ? 1 : 5)).map(a => a.data) } catch { return [] } } };

  /* ---------- a "api" que a tela usa ---------- */
  const TMPW = new Map();
  /* ---------- verificação da cópia (v60): abre a cópia escondida, acelera a animação e baixa do site original o que falta ou está danificado ---------- */
  const swAsk = m => new Promise(res => { const sw = navigator.serviceWorker && navigator.serviceWorker.controller; if (!sw) return res(null); const ch = new MessageChannel(); ch.port1.onmessage = e => res(e.data); try { sw.postMessage(m, [ch.port2]) } catch (e) { return res(null) } setTimeout(() => res(null), 4000) });
  async function diagRun(id, ms) {
    await swAsk({ t: 'missReset', id });
    const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;left:0;top:0;width:412px;height:800px;border:0;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(f);
    try {
      await new Promise(res => { f.onload = res; setTimeout(res, 20000); f.src = '/m/' + id + '/?orig=1&diag=1' });
      const t0 = Date.now();
      do {
        try { const W = f.contentWindow, d = W.document, h = Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0), st = Math.max(260, Math.round(h / 10)); for (let y = 0; y <= h; y += st) { W.scrollTo(0, y); await new Promise(r => setTimeout(r, 160)) } W.scrollTo(0, 0) } catch (e) { }
        await new Promise(r => setTimeout(r, 500));
      } while (Date.now() - t0 < ms);
      let D = {}; try { D = JSON.parse(JSON.stringify(f.contentWindow.__SL_DIAG || {})) } catch (e) { }
      return { diag: D, miss: (await swAsk({ t: 'miss', id })) || [] };
    } finally { f.remove() }
  }
  /* conferência de código (v60): um .js que não "fecha" quebra a animação inteira. Lê o arquivo sem executar nada (acorn). */
  let ACORN_P = null;
  const acornLoad = () => ACORN_P || (ACORN_P = new Promise(res => { if (window.acorn) return res(window.acorn); const s = document.createElement('script'); s.src = '/__sl/acorn.js'; s.onload = () => res(window.acorn || null); s.onerror = () => res(null); document.head.appendChild(s); setTimeout(() => res(window.acorn || null), 8000) }));
  const sxParse = (A, code) => {
    const o = { ecmaVersion: 'latest', allowHashBang: true }; let e1;
    try { A.parse(code, Object.assign({ sourceType: 'module' }, o)); return null } catch (e) { e1 = e }
    try { A.parse(code, Object.assign({ sourceType: 'script', allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true }, o)); return null } catch (e) { }
    const m = String(e1 && e1.message || ''); if (/regular expression|regexp/i.test(m)) return null;
    return { msg: m.slice(0, 120), line: e1 && e1.loc ? e1.loc.line : 0 };
  };
  const JS_RE = /\.(m?js|cjs)$/i;
  const sameBytes = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true };
  const isParseErr = e => /SyntaxError/i.test(e && e.m || '') && !(e && e.fr) && !/JSON|regular expression|regexp/i.test(e && e.m || '');
  async function healFetch(O, id, p, accept) {
    try {
      const r = await Promise.race([nfetch(O + p.split('/').map(encodeURIComponent).join('/'), { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', 'Referer': O + '/' } }), new Promise((_, rj) => setTimeout(() => rj(new Error('t')), 25000))]);
      if (!r.ok) return false;
      const u = new Uint8Array(await r.arrayBuffer()); if (!u.length || u.length > 80 * 1048576) return false;
      if (accept && !accept(u)) return false;
      if (/text\/html/i.test(r.headers.get('content-type') || '') && !/\.html?$/i.test(p)) return false;
      if (p.startsWith('/_sl')) return false;
      const old = await fGet(id, p); if (old && !(await fGet(id, '/_sl_bak/heal' + p))) await fPut(id, '/_sl_bak/heal' + p, old);
      await fPut(id, p, u); return true;
    } catch (e) { return false }
  }
  async function healMirror(id, origin, o) {
    o = o || {};
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(id || ''))) return { ok: false, error: 'id inválido' };
    if (!(await fGet(id, '/index.html'))) return { ok: false, error: 'A página não tem arquivos.' };
    if (!(navigator.serviceWorker && navigator.serviceWorker.controller)) return { ok: false, error: 'O visualizador ainda não iniciou. Feche e abra o app e tente de novo.' };
    let O = ''; try { O = new URL(origin).origin } catch (e) { }
    const STATIC = /\.(m?js|css|map|json|png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|mov|m4v|mp3|ogg|wav|wasm|txt|xml|webmanifest)$/i;
    const fixed = [], failed = [], tried = new Set(), syntax = []; let rounds = 0, last = null;
    const pth = u => { try { const a = new URL(u, location.href); if (a.origin != location.origin) return ''; let q = a.pathname; const m = q.match(/^\/m\/([^/]+)(\/.*)$/); if (m) { if (m[1] != id) return ''; q = m[2] } if (q.startsWith('/__sl/') || q == '/sw.js') return ''; return decodeURIComponent(q) } catch (e) { return '' } };
    const T0 = Date.now(), BUDGET = o.budget || 100000;
    /* 0) confere o código de todos os .js da cópia; o que estiver quebrado e o site original tiver inteiro, baixa de novo */
    let scanned = 0;
    if (O) {
      const A = await acornLoad();
      if (A) {
        const bad = [];
        try { for (const p of (await fKeys(id))) { if (p.startsWith('/_sl') || !/\.(m?js|cjs)$/i.test(p)) continue; const u = await fGet(id, p); if (!u || !u.length || u.length > 15 * 1048576) continue; if (sxParse(A, td.decode(u))) bad.push({ p }); await new Promise(r => setTimeout(r, 0)) } } catch (e) { }
        scanned = bad.length;
        const it = bad.slice(0, 40);
        const pool = async () => { while (it.length) { const { p } = it.shift(); if (Date.now() - T0 > BUDGET) break; tried.add(p); const cur = await fGet(id, p); if (await healFetch(O, id, p, u => !sameBytes(u, cur) && !sxParse(A, td.decode(u)))) { fixed.push({ p, why: 'danificado' }); if (!syntax.includes(p)) syntax.push(p) } } };
        await Promise.all([pool(), pool(), pool()]);
      }
    }
    for (let r = 0; r < 4 && (r == 0 || Date.now() - T0 < BUDGET); r++) {
      rounds++; last = await diagRun(id, r ? 8000 : Math.max(5000, o.ms || 12000));
      const T = new Map();
      for (const m of last.miss) if (!tried.has(m)) T.set(m, 'falta');
      for (const e of (last.diag.errs || [])) { if (isParseErr(e)) { const p = pth(e.f); if (p && JS_RE.test(p) && !p.startsWith('/_sl')) { if (!syntax.includes(p)) syntax.push(p); if (!tried.has(p)) T.set(p, 'danificado') } } }
      for (const b of (last.diag.bad || [])) { const p = pth(b); if (p && !tried.has(p) && STATIC.test(p) && !last.miss.includes(p) && !T.has(p)) T.set(p, 'invalido') }
      if (!T.size || !O) break;
      let n = 0; const it = [...T].slice(0, 80);
      const pool = async () => { while (it.length) { const [p, why] = it.shift(); tried.add(p); if (Date.now() - T0 > BUDGET + 60000) { failed.push({ p, why: 'tempo' }); continue } if (await healFetch(O, id, p)) { fixed.push({ p, why }); n++ } else failed.push({ p, why }) } };
      await Promise.all([pool(), pool(), pool(), pool()]);
      if (!n) break;
    }
    const left = last ? (last.diag.errs || []).filter(e => isParseErr(e) && JS_RE.test(pth(e.f) || '')).length : 0;
    return { ok: true, rounds, scanned, fixed, failed: failed.slice(0, 30), syntax, syntaxLeft: left, noOrigin: !O, errs: ((last && last.diag.errs) || []).slice(0, 8), logs: [] };
  }

  const api = {
    loadSync: () => PAGES,
    save: p => saveP(p),
    saveSync: p => { saveP(p); return 1 },
    cfgLoad: () => CFG || null,
    cfgSave: async t => { CFG = String(t); try { await kvSet('cfg', CFG); return { ok: true } } catch (e) { return { ok: false, error: String(e.message) } } },
    fs: async () => { },
    mops: async ({ id, ops }) => { try { await fPut(id, '/_sl_ops.json', JSON.stringify(ops || [])); return { ok: true } } catch (e) { return { ok: false, error: String(e.message) } } },
    mdel: async id => { try { await fDelAll(id) } catch { } },
    mhtml: async ({ id }) => { try { const ks = (await fKeys(id)).filter(p => /\.html?$/i.test(p) && !p.startsWith('/_sl')); if (!ks.length) return { ok: false, error: 'Página sem HTML' }; ks.sort((a, b) => (a == '/index.html' ? -1 : b == '/index.html' ? 1 : a.split('/').length - b.split('/').length || a.length - b.length)); return { ok: true, path: ks[0], html: td.decode(await fGet(id, ks[0])) } } catch (e) { return { ok: false, error: String(e.message) } } },
    mwrite: async ({ id, pth, html }) => { try { if (!pth || /\.\./.test(pth) || pth.startsWith('/_sl') || typeof html != 'string') return { ok: false, error: 'caminho inválido' }; const old = await fGet(id, pth); await kvSet('cbk:' + id, { pth, html: td.decode(old) }); await fPut(id, pth, te.encode(html)); return { ok: true } } catch (e) { return { ok: false, error: String(e.message) } } },
    mundo: async ({ id, peek }) => { try { const b = await kvGet('cbk:' + id); if (!b) return { ok: true, has: false }; if (peek) return { ok: true, has: true }; await fPut(id, b.pth, te.encode(b.html)); await kvSet('cbk:' + id, null); return { ok: true, has: false } } catch (e) { return { ok: false, error: String(e.message) } } },
    mdup: async ({ from, to }) => { try { await fCopy(from, to); return { ok: true } } catch (e) { return { ok: false, error: String(e.message) } } },
    mput: async ({ id, name, data }) => { try { const n = Date.now() + '-' + name.replace(/[^\w.-]/g, '_'); await fPut(id, '/uploads/' + n, b64u8(data.split(',')[1])); return { ok: true, path: '/uploads/' + n } } catch (e) { return { ok: false, error: String(e.message) } } },
    fsize: async ({ id, files }) => { const r = {}; for (const f of files || []) { try { const rel = decodeURIComponent(String(f).split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/^\/m\/[^/]+/, '')); const u = await fGet(id, rel); if (u) r[f] = u.length } catch { } } return r },
    mheal: async ({ id, origin, ms }) => { try { return await healMirror(id, origin, { ms }) } catch (e) { return { ok: false, error: String(e && e.message || e) } } },
    imgopt: async ({ id }) => {
      try {
        let n = 0, saved = 0;
        for (const p of await fKeys(id)) {
          if (!/\.(jpe?g|png)$/i.test(p) || p.startsWith('/_sl')) continue;
          const u = await fGet(id, p), sz = u.length; let bm; try { bm = await createImageBitmap(new Blob([u])) } catch { continue }
          if (sz < 250000 && bm.width <= 1600) continue;
          const w = Math.min(bm.width, 1600), h = Math.round(bm.height * w / bm.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bm, 0, 0, w, h);
          const png = /\.png$/i.test(p), out = new Uint8Array(await (await new Promise(r => cv.toBlob(r, png ? 'image/png' : 'image/jpeg', .82))).arrayBuffer());
          if (out.length < sz * 0.92) { if (!(await fGet(id, '/_sl_bak' + p))) await fPut(id, '/_sl_bak' + p, u); await fPut(id, p, out); n++; saved += sz - out.length }
        }
        return { ok: true, n, saved };
      } catch (e) { return { ok: false, error: String(e.message) } }
    },
    himp: async ({ id, html }) => {
      try {
        let h = String(html || ''); if (!h.trim()) return { ok: false, error: 'O arquivo está vazio.' };
        if (!/<html/i.test(h)) h = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + h + '</body></html>'; else if (!/<head[\s>]/i.test(h)) h = h.replace(/<html[^>]*>/i, m => m + '<head><meta charset="utf-8"></head>');
        if (!/^\s*<!doctype/i.test(h)) h = '<!doctype html>' + h;
        await fMany(id, [['/index.html', h]]); return { ok: true };
      } catch (e) { return { ok: false, error: String(e.message) } }
    },
    mirror: async ({ id, url }) => {
      try {
        const n = SN(); let c;
        if (n) {
          try { c = await Promise.race([cloneNative(n, id, url), new Promise((_, rj) => setTimeout(() => rj(new Error('tempo esgotado')), 90000))]) } catch (e1) { try { c = await cloneRaw(n, url) } catch (e2) { throw new Error('Não consegui copiar essa página (' + (e2.message || e1.message) + ').') } }
          if (!c.res.some(f => f.main)) { try { c = await cloneRaw(n, url) } catch (e2) { throw new Error('Não consegui copiar essa página (' + (e2.message || '') + ').') } }
        } else c = await cloneWeb(url);
        const { doc, items } = procClone(id, c.res, c.url);
        if (!doc) return { ok: false, error: 'Não consegui capturar a página. Confira o endereço.' };
        let more = null;
        try {
          const FF = {}; for (const [p, b] of items) FF[p] = b;
          more = await makeCloneFix({ get: async u => { try { const r = await Promise.race([nfetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', 'Referer': new URL(c.url).origin + '/' } }), new Promise((_, rj) => setTimeout(() => rj(new Error('t')), 25000))]); return { status: r.status, u8: new Uint8Array(await r.arrayBuffer()), type: r.headers.get('content-type') } } catch { return null } } }).complete(FF, c.url, {});
          const have = new Set(items.map(x => x[0])); for (const p in FF) { if (have.has(p)) { const i = items.findIndex(x => x[0] == p); items[i][1] = FF[p] } else items.push([p, FF[p]]) }
        } catch (e) { more = { error: String(e && e.message || e) } }
        if (c.thumb) items.push(['/_sl_thumb.jpg', b64u8(c.thumb)]);
        await fMany(id, items);
        let hr = null; try { hr = await healMirror(id, c.url, { ms: 10000 }) } catch (e) { }
        return { ok: true, count: items.length - (c.thumb ? 1 : 0) + (hr && hr.fixed ? hr.fixed.length : 0), thumb: c.thumb ? 1 : 0, more, heal: hr };
      } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    ckview: async ({ url, title }) => {
      try {
        const u = new URL(String(url || '')); if (!/^https?:$/.test(u.protocol)) return { ok: false, error: 'Link inválido.' };
        const n = SN(); if (n && n.ckView) { await n.ckView({ url: u.href, title: String(title || 'Checkout').slice(0, 60) }); return { ok: true } }
        return { ok: false, error: 'A prévia sem rastreio ainda não está disponível no celular.' };
      } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    test: async ({ v }) => { try { const r = await nfetch('https://api.netlify.com/api/v1/user', { headers: { Authorization: 'Bearer ' + v } }); return { ok: r.ok, status: r.status } } catch { return { ok: false } } },
    deploy: async ({ token, siteId, mirror, inject, domain, ops, steps }) => {
      try {
        const B = 'https://api.netlify.com/api/v1/', H = { Authorization: 'Bearer ' + token }, J = { ...H, 'Content-Type': 'application/json' };
        const ck = async r => { if (!r.ok) throw new Error('Netlify ' + r.status + ': ' + (await r.text()).slice(0, 200)); return r.json() };
        if (!siteId) siteId = (await ck(await nfetch(B + 'sites', { method: 'POST', headers: J, body: '{}' }))).id;
        const F = steps ? await funnelFiles(steps) : await siteFiles(mirror, inject, ops);
        const dg = {}; for (const p in F) dg[p] = await sha1(F[p]);
        const d = await ck(await nfetch(B + `sites/${siteId}/deploys`, { method: 'POST', headers: J, body: JSON.stringify({ files: dg }) }));
        const todo = Object.keys(F).filter(p => !d.required || d.required.includes(dg[p]));
        for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(p => nfetch(B + `deploys/${d.id}/files${p.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/octet-stream' }, body: F[p] }).then(r => { if (!r.ok) throw new Error('Upload ' + r.status + ' ' + p) })));
        if (domain) { const ap = domain.replace(/^www\./i, ''), apex = /^[^.]+(\.(com|net|org)\.br|\.[a-z]{2,})$/i.test(ap); await ck(await nfetch(B + 'sites/' + siteId, { method: 'PATCH', headers: J, body: JSON.stringify({ custom_domain: ap, domain_aliases: apex ? ['www.' + ap] : [] }) })) }
        const s = await ck(await nfetch(B + 'sites/' + siteId, { headers: H }));
        return { ok: true, siteId, url: (domain && s.custom_domain) ? 'https://' + s.custom_domain : (s.ssl_url || s.url), host: s.name + '.netlify.app' };
      } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    domain: async ({ token, siteId, domain }) => {
      try {
        const H = { Authorization: 'Bearer ' + token }, B = 'https://api.netlify.com/api/v1/sites/' + siteId, ap = domain.replace(/^www\./i, ''), apex = /^[^.]+(\.(com|net|org)\.br|\.[a-z]{2,})$/i.test(ap);
        let s = await (await nfetch(B, { headers: H })).json();
        if (s.custom_domain !== ap) { const pr = await nfetch(B, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ custom_domain: ap, domain_aliases: apex ? ['www.' + ap] : [] }) }); if (!pr.ok) throw new Error('Netlify ' + pr.status + ': ' + (await pr.text()).slice(0, 200)); s = await (await nfetch(B, { headers: H })).json() }
        const host = s.name + '.netlify.app', tr = c => c.replace(/\.$/, '');
        const ips = await doh(ap, 'A'), cn = await doh(apex ? 'www.' + ap : ap, 'CNAME');
        const a = apex ? ips.includes('75.2.60.5') : cn.some(c => tr(c) == host), w = apex ? cn.some(c => tr(c) == host) : true;
        if (a && !s.ssl) await nfetch(B + '/ssl', { method: 'POST', headers: H });
        s = await (await nfetch(B, { headers: H })).json();
        return { ok: true, cd: s.custom_domain || '', a, w, ssl: !!s.ssl, ips: ips.join(', ') || 'nenhum', cn: cn.join(', ') || 'nenhum' };
      } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    hftest: async ({ h }) => {
      const HUB = window.SLHUB; if (!HUB) return { ok: false, error: hubNeeds };
      try { const r = await HUB.hubJson('check', '', { dir: String((h && h.dir) || '').trim() }); return r.json && r.json.ok ? { ok: true, exists: !!r.json.exists } : { ok: false, error: 'O ponto de encontro não respondeu direito (atualize o app do computador e tente de novo).' } } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    hftp: async a => { try { return await hubPublish(a) } catch (e) { return { ok: false, error: String(e && e.message || e) } } },
    hftp_antigo: async ({ h, mirror, inject, ops, steps }) => {
      const n = SN(); if (!n) return { ok: false, error: 'O FTP só funciona no aplicativo do celular.' };
      let sid = null;
      try {
        const dir = String(h.dir || '').trim().replace(/\\/g, '/'); if (!dir || dir == '/') return { ok: false, error: 'Informe a pasta do site no servidor (a pasta do subdomínio), nas configurações.' };
        const F = await filesStatic(mirror, inject, ops, steps), ks = Object.keys(F).sort();
        sid = (await n.ftpOpen({ ...ftpOpts(h), dir })).id; let c = 0;
        for (const p of ks) { await n.ftpPut({ id: sid, path: p.replace(/^\/+/, ''), b64: u8b64(F[p]) }); c++ }
        return { ok: true, n: c };
      } catch (e) { return { ok: false, error: ftpErr(e) } } finally { if (sid) try { await n.ftpClose({ id: sid }) } catch { } }
    },
    hzip: async ({ mirror, inject, ops, name, steps }) => {
      try { const F = await filesStatic(mirror, inject, ops, steps); return await saveOut((name || 'site') + '.zip', await zipOf(F)) } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    ai: async ({ key, model, messages, ping }) => {
      try {
        if (!key) return { ok: false, error: 'nokey' };
        const body = { model: model || 'claude-sonnet-5-5', max_tokens: ping ? 16 : 8000, messages }; if (!ping) { body.system = AISYS; body.tools = AITOOLS }
        const r = await nfetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({})); if (!r.ok) return { ok: false, status: r.status, error: (j.error && j.error.message) || ('Erro ' + r.status) };
        let text = '', ops = []; for (const b of j.content || []) { if (b.type == 'text') text += b.text; else if (b.type == 'tool_use') ops.push(...toOps(b.name, b.input)) }
        return { ok: true, text: text.trim(), ops, cut: j.stop_reason == 'max_tokens' };
      } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    dash: async ({ ck, mt, from, to }) => {
      const R = { ok: true, orders: null, ads: null, err: {} };
      if (ck && ck.id && ck.sec) { try { R.orders = await ckOrders(ck.id.trim(), ck.sec.trim(), from) } catch (e) { R.err.ck = e.status == 401 || e.status == 400 ? 'A Cakto recusou as credenciais (' + (e.message || e.status) + '). Confira o client_id e o client_secret.' : String(e.message || e) } }
      if (mt && mt.tok && mt.acct) { try { R.ads = []; for (const a of String(mt.acct).split(/[,;\s]+/).filter(Boolean)) R.ads.push(...await mtRows(mt.tok.trim(), a, from, to, (mt.ver || '').trim())) } catch (e) { R.ads = null; R.err.mt = /token|OAuth|session|expired/i.test(e.message || '') ? 'O token da Meta expirou ou é inválido. Gere outro. (' + e.message + ')' : String(e.message || e) } }
      return R;
    },
    dtest: async ({ kind, ck, mt }) => {
      try {
        if (kind == 'ck') { const t = await ckToken((ck.id || '').trim(), (ck.sec || '').trim()); const j = await jf(CKU + '/public_api/orders/?limit=1', { headers: { Authorization: 'Bearer ' + t } }); return { ok: true, info: 'Conectado. Total de pedidos: ' + (j.count != null ? j.count : '?') } }
        const id = String(mt.acct || '').split(/[,;\s]+/)[0].replace(/\D/g, ''); const j = await jf(FBU + '/' + ((mt.ver || '').trim() ? (mt.ver.trim() + '/') : '') + 'act_' + id + '?fields=name,currency,account_status&access_token=' + encodeURIComponent((mt.tok || '').trim())); return { ok: true, info: 'Conectado: ' + j.name + ' (' + j.currency + ')', cur: j.currency };
      } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    /* ---------- sincronização com o computador (fase 1: ver tudo no celular) ---------- */
    mobile: true,
    shttp: async ({ url, method, headers, b64, timeout }) => {
      const run = (async () => { const r = await nfetch(url, { method: method || 'GET', headers: headers || {}, body: b64 ? b64u8(b64) : undefined }); const u = new Uint8Array(await r.arrayBuffer()), hd = {}; r.headers.forEach((v, k) => hd[k] = v); return { status: r.status, headers: hd, b64: u8b64(u) } })();
      let tm; const lim = new Promise((_, rej) => { tm = setTimeout(() => rej(new Error('tempo esgotado')), timeout || 60000) });
      try { return await Promise.race([run, lim]) } finally { clearTimeout(tm) }
    },
    sfList: async id => {
      const g0 = GEN, keys = (await fKeys(id)).filter(p => !/^\/_sl_bak/.test(p)), old = HC.get(id) || new Map(), nm = new Map(), out = [];
      for (const p of keys) { let e = old.get(p); if (!e) { const u = await fGet(id, p); if (!u) continue; e = { s: u.length, h: await sha1(u) } } nm.set(p, e); out.push({ p, s: e.s, h: e.h }) }
      if (g0 === GEN) HC.set(id, nm); else HC.delete(id);
      out.sort((a, b) => a.p < b.p ? -1 : 1); return out;
    },
    sfRead: async ({ id, p, off, len }) => { const u = await fGet(id, p); if (!u) throw new Error('arquivo não encontrado'); return { b64: u8b64(u.subarray(off || 0, (off || 0) + len)) } },
    sfWrite: async ({ id, p, b64, off, total, h }) => {
      try {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(id)) || String(p)[0] != '/' || /(^|\/)\.\.(\/|$)/.test(p)) return { ok: false, error: 'caminho inválido' };
        const k = id + p, b = b64u8(b64 || ''); let t = TMPW.get(k);
        if (!off) { t = { parts: [], n: 0 }; TMPW.set(k, t) } else if (!t || off !== t.n) return { ok: false, error: 'sequência de envio inválida' };
        t.parts.push(b); t.n += b.length;
        if (t.n >= total) {
          TMPW.delete(k); const u = new Uint8Array(t.n); let o = 0; for (const x of t.parts) { u.set(x, o); o += x.length }
          if (h && await sha1(u) !== h) return { ok: false, error: 'arquivo corrompido na transferência' };
          await fPut(id, p, u); return { ok: true, done: true };
        }
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e.message || e) } }
    },
    sfRm: async ({ id, p }) => { try { const t = db.transaction('files', 'readwrite'); t.objectStore('files').delete(id + p); await done(t); hcDrop(id, p); return { ok: true } } catch (e) { return { ok: false, error: String(e.message || e) } } },
    probe: async () => ({ ok: false, error: 'A verificação automática só existe no computador.' }),
    /* usados pela sincronização e pelos testes */
    _fKeys: fKeys, _fGet: fGet, _fPut: fPut, _fMany: fMany, _fDelAll: fDelAll, _kvGet: kvGet, _kvSet: kvSet, _nfetch: nfetch, _native: NATIVE,
  };

  window.api = api;
  window.SL = { init: async () => { db = await open(); const p = await kvGet('pages'); try { PAGES = p ? JSON.parse(p) : null } catch { PAGES = null } CFG = (await kvGet('cfg')) || ''; return true } };
})();
