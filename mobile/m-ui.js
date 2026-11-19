/* Comportamento exclusivo do celular: navegação, folhas de baixo, botão voltar */
(function () {
  const $ = s => document.querySelector(s);
  document.documentElement.classList.add('mob');
  try { if (localStorage.getItem('sl_fsb') === null) localStorage.setItem('sl_fsb', '0') } catch (e) { }
  const lab = { 'Páginas': 'Páginas', 'Funis': 'Funis', 'Dashboard': 'Painel', 'Configurações': 'Config.' };
  function nav() {
    document.querySelectorAll('#side .nav').forEach(n => {
      if (n.querySelector('i')) return; const t = n.textContent.trim(), m = t.match(/^(\S)\s+(.*)$/); if (!m) return;
      n.innerHTML = `<i>${m[1]}</i><span>${lab[m[2]] || m[2]}</span>`;
    });
  }
  document.addEventListener('DOMContentLoaded', nav); nav();

  // folha de baixo do editor (painel do elemento)
  function sheet() {
    const sp = $('#sp'); if (!sp) return;
    if (!sp.dataset.s) sp.dataset.s = 'min';
    if (!sp.querySelector('.sphd')) { const h = document.createElement('div'); h.className = 'sphd'; h.innerHTML = '<i></i>'; h.onclick = () => { sp.dataset.s = sp.dataset.s == 'open' ? 'min' : 'open' }; sp.prepend(h) }
  }
  function hook() {
    if (typeof window.side != 'function' || window.side.__m) return;
    const o = window.side; let last = null;
    window.side = function () { const r = o.apply(this, arguments); try { sheet(); const sp = $('#sp'); if (sp && typeof si != 'undefined') { const now = si ? JSON.stringify(si).length + (si.t || '') : null; if (si && last == null) sp.dataset.s = 'open'; if (!si && last != null) sp.dataset.s = 'min'; last = si ? 1 : null } } catch (e) { } return r };
    window.side.__m = 1;
    // o app chama "side()" por nome global; reatribuir a função global basta
  }
  // botão "+" para as peças
  function fab() {
    const ed = document.querySelector('.ed .pal');
    document.body.classList.toggle('mob-ed', !!ed);
    if (!ed) { document.body.classList.remove('mob-pal'); const f = $('#palfab'); f && f.remove(); return }
    if (!$('#palfab')) { const b = document.createElement('button'); b.id = 'palfab'; b.textContent = '+'; b.setAttribute('aria-label', 'Adicionar elemento'); b.onclick = () => document.body.classList.toggle('mob-pal'); document.body.append(b) }
    if (!ed.__m) { ed.__m = 1; ed.addEventListener('click', e => { if (e.target.closest('.tile')) setTimeout(() => document.body.classList.remove('mob-pal'), 120) }) }
  }
  new MutationObserver(() => { nav(); hook(); hookF(); fab(); const sp = $('#sp'); if (sp && !sp.querySelector('.sphd')) sheet() }).observe(document.body, { childList: true, subtree: true });
  function hookF() {
    if (typeof window.fnSelect != 'function' || window.fnSelect.__m) return;
    const o = window.fnSelect;
    window.fnSelect = function (id) { const r = o.apply(this, arguments); try { if (id && typeof fnSbOpen != 'undefined' && !fnSbOpen && typeof fnSideTog == 'function') fnSideTog() } catch (e) { } return r };
    window.fnSelect.__m = 1;
  }
  window.addEventListener('load', () => { hook(); hookF() });

  // zoom com dois dedos no mapa de funis
  let pz = null; const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const pmove = e => {
    if (!pz || e.touches.length != 2) return; e.preventDefault();
    const r = pz.cv.getBoundingClientRect(), cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
    const want = pz.z0 * dist(e.touches) / pz.d0; if (Math.abs(want - fzm) / fzm > 0.03) fnZoomAt(want / fzm, cx, cy);
  };
  const pend = e => { if (e.touches.length < 2) pz = null };
  document.addEventListener('touchstart', e => {
    const cv = e.target.closest && e.target.closest('#fcv'); if (!cv || e.touches.length != 2) return;
    try { fnPn = null; fnMq = null; if (typeof fnDr != 'undefined' && fnDr) { fnDr.mv = 0; fnDr = null; const g = document.getElementById('fg'); g && (g.innerHTML = '') } const m = document.getElementById('fmq'); m && m.remove() } catch (x) { }
    pz = { cv, d0: dist(e.touches), z0: fzm };
    // a peça tocada pode ser redesenhada durante o gesto: escuta direto nela também
    const tg = e.target; ['touchmove'].forEach(n => tg.addEventListener(n, pmove, { passive: false })); ['touchend', 'touchcancel'].forEach(n => tg.addEventListener(n, pend, { passive: true }));
  }, { passive: true, capture: true });
  document.addEventListener('touchmove', pmove, { passive: false, capture: true });
  document.addEventListener('touchend', pend, { passive: true, capture: true });

  // botão voltar do Android
  function back() {
    const ov = document.querySelector('.ov'); if (ov) { ov.remove(); return true }
    if (document.body.classList.contains('mob-pal')) { document.body.classList.remove('mob-pal'); return true }
    const sp = $('#sp'); if (sp && sp.dataset.s == 'open') { sp.dataset.s = 'min'; return true }
    try { if (view == 'edit') { sair(); return true } if (view == 'fmap') { go('fnl'); return true } if (view != 'list') { go('list'); return true } } catch (e) { }
    return false;
  }
  window.SL_back = back;
  try {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
      const App = Capacitor.registerPlugin('App');
      App.addListener('backButton', () => { if (!back()) App.minimizeApp && App.minimizeApp() });
      const Br = Capacitor.registerPlugin('Browser');
      window.open = (u) => { try { Br.open({ url: String(u) }) } catch (e) { } return null };
    }
  } catch (e) { }
})();
