/* Shark Lab - verificacao da copia da pagina (so roda quando a copia e aberta com ?diag=1, nunca na pagina publicada).
   Faz o relogio da pagina andar mais rapido para a animacao completa rodar em poucos segundos e anota o que deu errado. */
(function () {
  if (window.__SL_DIAG) return;
  var K = 5;
  var D = window.__SL_DIAG = { errs: [], bad: [], t0: Date.now() }, seen = {};
  function add(a, v) { var s = a === D.bad ? 'b|' + v : 'e|' + v.m + '|' + v.f; if (seen[s]) return; seen[s] = 1; if (a.length < 80) a.push(v) }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href || t.currentSrc)) { add(D.bad, String(t.currentSrc || t.src || t.href)); return }
    var sk = e.error && e.error.stack ? String(e.error.stack) : '';
    add(D.errs, { m: String(e.message || ''), f: String(e.filename || ''), l: e.lineno | 0, fr: /\n\s*at /.test(sk), st: sk.slice(0, 160) });
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; add(D.errs, { m: 'rej:' + String(r && r.message || r).slice(0, 200), f: '', l: 0 });
  });
  try { Object.defineProperty(document, 'hidden', { get: function () { return false } }); Object.defineProperty(document, 'visibilityState', { get: function () { return 'visible' } }) } catch (x) { }
  var st = window.setTimeout, si = window.setInterval; window.__slST = st;
  window.setTimeout = function (f, d) { var a = [].slice.call(arguments); a[1] = Math.max(0, (+d || 0) / K); return st.apply(window, a) };
  window.setInterval = function (f, d) { var a = [].slice.call(arguments); a[1] = Math.max(4, (+d || 0) / K); return si.apply(window, a) };
  try {
    var pn = performance.now.bind(performance), p0 = pn(); performance.now = function () { return p0 + (pn() - p0) * K };
    var dn = Date.now.bind(Date), d0 = dn(); Date.now = function () { return d0 + (dn() - d0) * K };
  } catch (x) { }
  si(function () { try { document.getAnimations().forEach(function (a) { if (a.playbackRate !== K) a.playbackRate = K }) } catch (x) { } }, 150);
})();
