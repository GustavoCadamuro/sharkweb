/* Shark Lab no celular (v61): navegação, barra de ferramentas do editor, painéis com 3 alturas, botão voltar */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  document.documentElement.classList.add('mob');
  try { if (localStorage.getItem('sl_fsb') === null) localStorage.setItem('sl_fsb', '0') } catch (e) { }

  /* ---------- leitura segura das variáveis do app (ficam no escopo global do app.js) ---------- */
  const A = {
    get si() { try { return si } catch (e) { return null } },
    get msi() { try { return msi } catch (e) { return null } },
    get tab() { try { return tab } catch (e) { return 'el' } },
    set tab(v) { try { tab = v } catch (e) { } },
    get prev() { try { return prev } catch (e) { return 0 } },
    get view() { try { return view } catch (e) { return '' } },
    get fctx() { try { return fctx } catch (e) { return null } },
    get rv() { try { return rv } catch (e) { return null } },
    get cur() { try { return cur } catch (e) { return null } },
    get sm() { try { return sm } catch (e) { return 0 } },
    get rs() { try { return rs } catch (e) { return 0 } },
    get orig() { try { return orig } catch (e) { return 0 } },
    get dev() { try { return dev } catch (e) { return 'm' } },
    set dev(v) { try { dev = v } catch (e) { } }
  };
  const LANDQ = window.matchMedia ? window.matchMedia('(orientation:landscape) and (max-height:520px)') : { matches: false };
  const LAND = () => !!LANDQ.matches;
  const call = (n, ...a) => { try { const f = window[n]; return typeof f == 'function' ? f(...a) : undefined } catch (e) { console.error(n, e) } };
  const tellFr = m => { try { if (typeof tell == 'function') tell(m) } catch (e) { } };
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e };

  /* ---------- ícones ---------- */
  const P = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC = {
    pages: P('<rect x="5" y="3" width="14" height="18" rx="3.2"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
    prod: P('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    funnel: P('<path d="M3.5 4.5h17l-6.6 7.9V19l-3.8 1.8v-8.4z"/>'),
    dash: P('<path d="M5.5 20v-7M12 20V5M18.5 20v-10"/>'),
    cfg: P('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    item: P('<path d="M5.5 3.5l13 6.4-5.7 1.9L10.6 17.6z"/><path d="M13 12.5l5 5"/>'),
    ai: P('<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
    eye: P('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    edit: P('<path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z"/><path d="M14.5 7.5l3 3"/>'),
    more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/></svg>',
    back: P('<path d="M15 5l-7 7 7 7"/>'),
    undo: P('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
    redo: P('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>'),
    close: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    history: P('<path d="M3.5 12a8.5 8.5 0 108.5-8.5A9 9 0 005.6 6L3.5 8"/><path d="M3.5 3.5V8H8"/><path d="M12 7.5V12l3 2"/>'),
    compare: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor" stroke="none" opacity=".55"/>'),
    multi: P('<rect x="3.5" y="3.5" width="11" height="11" rx="2" stroke-dasharray="3 2.6"/><path d="M11.5 11.5l8.5 3.2-3.8 1.7-1.7 3.8z" fill="currentColor"/>'),
    resize: P('<path d="M14.5 3.5h6v6M9.5 20.5h-6v-6M20.5 3.5L14 10M3.5 20.5L10 14"/>'),
    upload: P('<path d="M12 16V4.5M7 9l5-5 5 5"/><path d="M4.5 19.5h15"/>'),
    gauge: P('<path d="M4.5 17.5a8 8 0 1 1 15 0"/><path d="M12 17.5l3.6-5.2"/><circle cx="12" cy="17.5" r="1.1"/>'),
    ad: P('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="M20.5 15.5l-4.8-4.8L7 19.5"/>'),
    review: P('<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M3.8 6.6l1.3 1.3 2.2-2.6M3.8 12.1l1.3 1.3 2.2-2.6M3.8 17.6l1.3 1.3 2.2-2.6"/>'),
    up: P('<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>'),
    down: P('<path d="M12 5v14M5.5 12.5L12 19l6.5-6.5"/>'),
    parent: P('<path d="M9 13.5L4 8.5l5-5"/><path d="M20 20v-7a4 4 0 00-4-4H4"/>'),
    drop: P('<path d="M12 3.2s6.3 6.2 6.3 10.6a6.3 6.3 0 01-12.6 0C5.7 9.4 12 3.2 12 3.2z"/>'),
    paste: P('<rect x="8" y="3" width="8" height="4.2" rx="1.6"/><path d="M16 5h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2"/>'),
    dup: P('<rect x="9" y="9" width="11.5" height="11.5" rx="2.6"/><path d="M5 15.2V6.6A2.6 2.6 0 017.6 4H16"/>'),
    trash: P('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12.2A2 2 0 009 21h6a2 2 0 002-1.8L18 7"/><path d="M9 7V4.6c0-.3.2-.6.6-.6h4.8c.4 0 .6.3.6.6V7"/>')
  };

  /* ---------- navegação de baixo (páginas / funis / painel / config) ---------- */
  const NAV = { list: ['pages', 'Páginas'], prod: ['prod', 'Produtos'], fnl: ['funnel', 'Funis'], dash: ['dash', 'Painel'], cfg: ['cfg', 'Config.'] };
  function nav() {
    $$('#side .nav').forEach(n => {
      if (n.dataset.mi) return; const k = NAV[n.dataset.v]; if (!k) return;
      n.dataset.mi = '1'; n.innerHTML = '<i>' + IC[k[0]] + '</i><span>' + k[1] + '</span>';
    });
  }

  /* ---------- botão ✕ em todas as janelas ---------- */
  function closers() {
    $$('.ov > .md').forEach(m => {
      if (m.querySelector(':scope > .mx')) return;
      const b = mk('button', 'mx', '✕'); b.type = 'button'; b.setAttribute('aria-label', 'Fechar');
      b.onclick = e => { e.stopPropagation(); const o = m.parentNode; o && o.remove() }; m.prepend(b);
    });
    const hs = $('#hist');
    if (hs && !hs.querySelector(':scope > .mx')) {
      const b = mk('button', 'mx', '✕'); b.type = 'button'; b.setAttribute('aria-label', 'Fechar'); b.onclick = () => hs.remove(); hs.prepend(b);
    }
  }

  /* ---------- barra de cima do editor: voltar · nome + situação · desfazer · refazer · Publicar ---------- */
  function topbar() {
    const t = $('#main .top'); if (!t || t.classList.contains('mtop')) return;
    if (!t.querySelector('#pbtn')) return;           // só a barra do editor
    t.classList.add('mtop');
    const kids = Array.from(t.children), btns = kids.filter(k => k.tagName == 'BUTTON');
    const back = btns[0], nm = t.querySelector('#nm'), svs = t.querySelector('#svs'), pb = t.querySelector('#pbtn'), chip = t.querySelector('.fx-chip');
    const swb = t.querySelector('#swb');
    const un = btns.find(b => /^↶/.test(b.textContent.trim())), re = btns.find(b => /^↷/.test(b.textContent.trim()));
    const keep = [back, nm, svs, pb, chip, un, re, swb], tools = mk('div', 'tools');
    kids.forEach(k => { if (keep.indexOf(k) < 0) tools.append(k) });   // seletor de aparelho, lápis, original, histórico… ficam guardados (o menu "Mais" usa as mesmas funções)
    if (back) { back.className = 'b2 tb-ic tb-back'; back.innerHTML = IC.back; back.setAttribute('aria-label', 'Voltar'); back.removeAttribute('title') }
    if (un) { un.className = 'b2 tb-ic tb-u'; un.innerHTML = IC.undo; un.setAttribute('aria-label', 'Desfazer'); un.removeAttribute('title') }
    if (re) { re.className = 'b2 tb-ic tb-r'; re.innerHTML = IC.redo; re.setAttribute('aria-label', 'Refazer'); re.removeAttribute('title') }
    const mid = mk('div', 'tb-mid'), st = mk('div', 'tb-st', '<i class="tb-dot"></i><span id="tbtx"></span>');
    st.id = 'tbst'; if (chip) st.dataset.chip = chip.textContent.trim(); if (svs) st.append(svs); if (swb) st.append(swb);
    mid.append(nm, st);
    const rvt = mk('div', 'rvt', 'Ver minhas modificações');
    t.innerHTML = ''; [back, mid, rvt, un, re, pb, tools].forEach(x => x && t.append(x));
    statSync();
  }
  function statSync() {
    const st = $('#tbst'), tx = $('#tbtx'); if (!st || !tx) return;
    const pb = $('#pbtn'), idle = !!(pb && pb.classList.contains('idle')), c = A.cur;
    let k = 'n', s = 'Rascunho';
    if (A.prev) { s = 'Visualização' }
    else if (A.fctx) { s = st.dataset.chip || 'Etapa do funil'; k = idle ? 'n' : 'y' }
    else if (c && c.pub) { if (idle) { k = 'g'; s = 'Publicada' } else { k = 'y'; s = $('#swb') ? 'Pendente' : 'Alterações pendentes' } }
    st.className = 'tb-st ' + k + (st.classList.contains('sav') ? ' sav' : '');
    if (tx.textContent !== s) tx.textContent = s;
    const sv = $('#svs'); st.classList.toggle('sav', !!(sv && /^Salvando/.test(sv.textContent)));
  }

  /* ---------- painel (folha de baixo) com 3 alturas ---------- */
  let S = 'none', kbOn = false, lastTab = '';
  const sp = () => $('#sp');
  const stageH = () => { const ed = $('.ed'); return ed ? ed.getBoundingClientRect().height : innerHeight };
  function peekH(el) { const hd = el.querySelector('.sphd'), eh = el.querySelector('.eh'); return Math.ceil((hd ? hd.offsetHeight : 28) + (eh ? eh.offsetHeight : 130) + 6) }
  function targetH(s, el) {
    if (s == 'none' || LAND()) return 0;
    if (kbOn || document.body.classList.contains('mob-pal')) return 0;
    if (s == 'peek') return peekH(el);
    if (s == 'open') return Math.min(innerHeight * .54, 540);
    return stageH() - dockH() - 6;
  }
  const dockH = () => { const d = $('#dock'); return d && d.offsetParent !== null ? d.offsetHeight : 0 };
  function setS(next) {
    const el = sp(); if (!el) return;
    if (next == 'peek' && !el.querySelector('.eh')) next = 'open';
    S = next; el.dataset.s = next; document.body.dataset.sh = next;
    if (next == 'peek') el.style.setProperty('--peek', peekH(el) + 'px');
    { const hd = el.querySelector('.sphd'), eh = el.querySelector('.eh'); if (eh && el.offsetParent !== null) el.style.setProperty('--ehh', Math.ceil((hd ? hd.offsetHeight : 28) + eh.offsetHeight + 10) + 'px') }
    dockSync(); padSync();
  }
  let lastPad = -1;
  function padSync(force) {
    const el = sp(); const px = el && !A.rv ? Math.round(targetH(S, el)) : 0;
    if (px === lastPad && !force) return; lastPad = px;
    tellFr({ cmd: 'pad', px: Math.round(px / (FS || 1)) });
  }
  window.SL_swap = () => { lastPad = -1; setTimeout(() => padSync(true), 30) };   // página recarregada: manda o espaço de novo
  function decorate(el) {
    if (!el.querySelector(':scope > .sphd')) {
      const h = mk('div', 'sphd', '<i></i>'); el.prepend(h); drag(el, h);
      h.onclick = e => { if (h.__moved) return; cycle() };
    }
    const eh1 = el.querySelector('.eh .eh1');
    if (eh1 && !eh1.querySelector('.sh-x')) { const x = mk('button', 'sh-x', IC.close); x.type = 'button'; x.setAttribute('aria-label', 'Fechar painel'); x.onclick = () => closeSheet(); eh1.append(x) }
    el.querySelectorAll('.ea button').forEach(b => {
      if (b.dataset.i) return;
      const t = (b.dataset.t || '') + ' ' + (b.getAttribute('aria-label') || '');
      const m = /pai/.test(t) ? ['parent', 'Pai'] : /cima/.test(t) ? ['up', 'Subir'] : /baixo/.test(t) ? ['down', 'Descer'] : /Colar|Copie um/.test(t) ? ['paste', 'Colar estilo'] : /Copiar o estilo/.test(t) ? ['drop', 'Copiar estilo'] : /Duplicar/.test(t) ? ['dup', 'Duplicar'] : /Excluir/.test(t) ? ['trash', 'Excluir'] : null;
      if (!m) return; b.dataset.i = '1'; b.innerHTML = IC[m[0]] + '<span>' + m[1] + '</span>';
    });
  }
  function afterSide() {
    const el = sp(); if (!el) return;
    const fresh = !el.dataset.s; if (fresh) { S = 'none'; el.dataset.s = 'none'; lastPad = -1 }
    decorate(el);
    const t = A.tab, has = !!(A.si || A.msi); let next = S;
    if (t !== lastTab) { lastTab = t; el.scrollTop = 0 }
    if (A.prev) next = fresh ? 'none' : S;
    else if (t == 'el') next = !has ? 'none' : (S == 'none' ? 'peek' : S);
    else next = (S == 'none' || S == 'peek') ? 'open' : S;
    setS(next);
  }
  function cycle() {
    const el = sp(); if (!el) return; const hasEh = !!el.querySelector('.eh');
    if (S == 'peek') setS('open'); else if (S == 'open') setS(hasEh ? 'peek' : 'full'); else if (S == 'full') setS(hasEh ? 'open' : 'open');
  }
  function closeSheet() {
    if (A.tab == 'el') { tellFr({ cmd: 'desel' }); if (S !== 'none') setS('none'); try { si = null; msi = null } catch (e) { } call('side'); }
    else { A.tab = 'el'; setS('none') }
    dockSync();
  }
  function drag(el, h) {
    let y0 = 0, h0 = 0, id = null, moved = false;
    h.addEventListener('pointerdown', e => { id = e.pointerId; try { h.setPointerCapture(id) } catch (x) { } y0 = e.clientY; h0 = el.getBoundingClientRect().height; moved = false; h.__moved = false });
    h.addEventListener('pointermove', e => {
      if (id !== e.pointerId) return; const dy = e.clientY - y0;
      if (!moved && Math.abs(dy) > 8) { moved = true; h.__moved = true; el.classList.add('drag') }
      if (moved) el.style.height = Math.max(30, Math.min(stageH() - dockH() - 6, h0 - dy)) + 'px';
    });
    const end = e => {
      if (id !== e.pointerId) return; id = null;
      if (!moved) return;
      const hh = el.getBoundingClientRect().height, hasEh = !!el.querySelector('.eh');
      el.classList.remove('drag'); el.style.height = '';
      const opts = hasEh ? [['peek', peekH(el)], ['open', Math.min(innerHeight * .54, 540)], ['full', stageH() - dockH() - 6]] : [['open', Math.min(innerHeight * .54, 540)], ['full', stageH() - dockH() - 6]];
      const lowest = opts[0][1];
      if (hh < lowest * .6) { closeSheet(); setTimeout(() => { h.__moved = false }, 60); return }
      let best = opts[0]; opts.forEach(o => { if (Math.abs(o[1] - hh) < Math.abs(best[1] - hh)) best = o });
      setS(best[0]); setTimeout(() => { h.__moved = false }, 60);
    };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  }
  function hook() {
    if (typeof window.side != 'function' || window.side.__m) return;
    const o = window.side;
    window.side = function () { const r = o.apply(this, arguments); try { afterSide() } catch (e) { console.error(e) } statSync(); return r };
    window.side.__m = 1;
    const sg = window.secGo;
    if (typeof sg == 'function' && !sg.__m) {          // tocar numa categoria (Texto, Fundo…) abre o painel antes de rolar até ela
      window.secGo = function () { const a = arguments; if (S == 'peek') { setS('open'); setTimeout(() => sg.apply(this, a), 260) } else sg.apply(this, a) };
      window.secGo.__m = 1;
    }
    const ps = window.pubState;
    if (typeof ps == 'function' && !ps.__m) { window.pubState = function () { const r = ps.apply(this, arguments); statSync(); return r }; window.pubState.__m = 1 }
    const tr = window.togRs, ts = window.togSm;
    const quiet = f => function () { const t = window.toast; window.toast = () => { }; try { return f.apply(this, arguments) } finally { window.toast = t; modeSync() } };   // o aviso fixo no topo da página já explica o modo
    if (typeof tr == 'function' && !tr.__m) { window.togRs = quiet(tr); window.togRs.__m = 1 }
    if (typeof ts == 'function' && !ts.__m) { window.togSm = quiet(ts); window.togSm.__m = 1 }
  }

  /* ---------- barra de ferramentas fixa (embaixo) ---------- */
  function dockBuild() {
    const ed = $('.ed'), ok = ed && $('#sp'), want = !ok ? null : (A.prev ? 'p' : 'e'), cur = $('#dock');
    document.body.classList.toggle('mob-ed', !!ok); document.body.classList.toggle('mob-prev', !!(ok && A.prev));
    if (!ok) { if (cur) cur.remove(); document.body.classList.remove('mob-pal', 'kb', 'kb-fr'); S = 'none'; return }
    if (cur && cur.parentNode === ed && cur.dataset.m === want) return;
    if (cur) cur.remove();
    const d = mk('div'); d.id = 'dock'; d.dataset.m = want;
    const btn = (k, ic, lb) => { const b = mk('button', 'dk dk-' + k, ic + '<span>' + lb + '</span>'); b.type = 'button'; b.dataset.k = k; b.onclick = () => dockClick(k); return b };
    if (want == 'e') d.append(btn('add', IC.plus, 'Adicionar'), btn('item', IC.item, 'Item'), btn('ai', IC.ai, 'Claude'), btn('view', IC.eye, 'Visualizar'), btn('more', IC.more, 'Mais'));
    else d.append(btn('edit', IC.edit, 'Voltar a editar'), btn('pub', IC.upload, 'Publicação'));
    ed.append(d);
    if (!ed.__m) { ed.__m = 1; ed.addEventListener('click', e => { if (e.target.closest && e.target.closest('.pal .tile')) setTimeout(palClose, 120) }) }
    const stage = ed.querySelector('.stage');
    if (stage && !$('#donebtn')) { const b = mk('button', '', '✓ Pronto'); b.id = 'donebtn'; b.type = 'button'; b.onclick = blurFr; stage.append(b) }
    dockSync();
  }
  function dockSync() {
    const d = $('#dock'); if (!d) return;
    const has = !!(A.si || A.msi), pal = document.body.classList.contains('mob-pal');
    d.querySelectorAll('.dk').forEach(b => {
      const k = b.dataset.k; let on = false;
      if (k == 'add') on = pal; else if (k == 'item') on = !pal && A.tab == 'el' && S != 'none'; else if (k == 'ai') on = !pal && A.tab == 'ai' && S != 'none'; else if (k == 'pub') on = A.tab == 'pub' && S != 'none';
      b.classList.toggle('on', on);
      if (k == 'item') { b.classList.toggle('has', has); b.classList.toggle('dim', !has) }
    });
  }
  function palOpen() {
    const pal = $('.ed .pal'); if (!pal) return;
    if (!pal.querySelector(':scope > .pal-h')) { const hd = mk('div', 'pal-h', '<b>Adicionar à página</b><button type="button" aria-label="Fechar">' + IC.close + '</button>'); hd.querySelector('button').onclick = palClose; pal.prepend(hd) }
    document.body.classList.add('mob-pal'); dockSync(); padSync();
  }
  function palClose() { document.body.classList.remove('mob-pal'); dockSync(); padSync() }
  function dockClick(k) {
    if (k == 'add') { document.body.classList.contains('mob-pal') ? palClose() : palOpen(); return }
    if (document.body.classList.contains('mob-pal')) palClose();
    if (k == 'item') {
      if (!(A.si || A.msi)) { call('toast', 'Toque em algo na página para editar'); return }
      if (A.tab != 'el') { A.tab = 'el'; call('side'); setS('open'); return }
      setS(S == 'open' || S == 'full' ? 'peek' : 'open'); return;
    }
    if (k == 'ai') {
      if (A.tab == 'ai' && S != 'none') { closeSheet(); return }
      A.tab = 'ai'; call('side'); setS('open'); return;
    }
    if (k == 'view') { call('setPrev', 1); return }
    if (k == 'edit') { A.tab = 'el'; call('setPrev', 0); return }
    if (k == 'pub') { if (A.tab == 'pub' && S != 'none') { setS('none'); dockSync(); return } A.tab = 'pub'; call('side'); setS('open'); return }
    if (k == 'more') { moreOpen(); return }
  }

  /* ---------- menu "Mais" ---------- */
  function moreOpen() {
    if ($('.mvov')) return;
    const pr = A.prev, fc = A.fctx, rows = [];
    if (!pr) {
      if (!fc) rows.push(['rv', IC.review, 'Ver minhas modificações', 'Confira tudo o que mudou desde a última publicação']);
      rows.push(['hist', IC.history, 'Histórico de alterações', 'Volte para uma versão anterior da página']);
      rows.push(['orig', IC.compare, A.orig ? 'Sair da comparação' : 'Comparar com a original', 'Veja a página como era antes das suas edições', A.orig]);
      rows.push(['sm', IC.multi, 'Selecionar vários itens', 'Arraste sobre a página para pegar vários de uma vez', A.sm]);
      rows.push(['rs', IC.resize, 'Redimensionar itens', 'Arraste as bolinhas do item escolhido', A.rs]);
    }
    if (!pr) rows.push(['imgs', IC.gauge, 'Imagens pesadas', 'Veja o que deixa a página lenta e otimize']);
    rows.push(['pub', IC.upload, 'Publicação e endereço', 'Domínio, link da página e opções de envio']);
    if (!pr && !fc) rows.push(['ad', IC.ad, 'Imagens para anúncios', 'Prontas para Facebook e Instagram']);
    if (fc && !pr) rows.push(['fn', IC.funnel, 'Etapa do funil', 'Opções desta etapa']);
    rows.push(['exit', IC.pages, fc ? 'Voltar ao mapa do funil' : 'Voltar às páginas', 'Suas alterações já ficam salvas', 0, 'sep']);
    const o = mk('div', 'ov mvov'), m = mk('div', 'md msheet', '<h3>Mais opções</h3><div class="mrows">' + rows.map(r => '<button type="button" class="mrow ' + (r[5] || '') + '" data-a="' + r[0] + '"><i>' + r[1] + '</i><div><b>' + r[2] + '</b><span>' + r[3] + '</span></div>' + (r[4] ? '<em>Ligado</em>' : '') + '</button>').join('') + '</div>');
    o.append(m); document.body.append(o);
    o.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.mrow');
      if (!b) { if (e.target === o) o.remove(); return }
      const a = b.dataset.a; o.remove();
      setTimeout(() => {
        if (a == 'rv') call('rvOpen'); else if (a == 'hist') call('histToggle'); else if (a == 'orig') call('origTog'); else if (a == 'sm') call('togSm'); else if (a == 'rs') call('togRs');
        else if (a == 'imgs') call('imgsOpen'); else if (a == 'ad') call('adOpen'); else if (a == 'pub') { A.tab = 'pub'; call('side'); setS('open') } else if (a == 'fn') { A.tab = 'fn'; call('side'); setS('open') } else if (a == 'exit') call('sair');
      }, 30);
    });
  }
  /* aviso fixo quando um modo está ligado + botão para desligar */
  function modeSync() {
    const stage = $('.ed .stage'); let p = $('#modepill');
    const m = A.sm ? 'sm' : A.rs ? 'rs' : '';
    if (!stage || !m) { p && p.remove(); return }
    if (p && p.dataset.m === m) return; p && p.remove();
    p = mk('div', '', '<span>' + (m == 'sm' ? '<b>Seleção em grupo ligada.</b> Arraste sobre a página para pegar vários itens.' : '<b>Redimensionar ligado.</b> Arraste as bolinhas do item escolhido.') + '</span><button type="button">Desligar</button>');
    p.id = 'modepill'; p.dataset.m = m; p.querySelector('button').onclick = () => call(m == 'sm' ? 'togSm' : 'togRs'); stage.append(p);
  }
  function origSync() {
    const b = $('#orb'); if (!b || b.__m) return; b.__m = 1;
    b.textContent = 'Página original · toque aqui para voltar'; b.onclick = () => call('origTog');
  }

  /* ---------- tamanho da prévia: Celular · Tablet · PC (só no modo Visualizar; no editor a página usa sempre o tamanho real do aparelho) ---------- */
  const DVW = { m: 0, t: 768, d: 1280 }, DVL = { m: 'Celular', t: 'Tablet', d: 'PC' }, DVI = {
    m: P('<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M10.8 18.6h2.4"/>'),
    t: P('<rect x="3" y="4.5" width="18" height="15" rx="2.6"/><path d="M17.8 11v2"/>'),
    d: P('<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M9 20.5h6M12 16.5v4"/>')
  };
  let fitKey = '', FS = 1;
  function devSync() {
    const st = $('.ed .stage'), fr = $('#fr');
    if (!st || !fr) { fitKey = ''; if (FS !== 1) { FS = 1; padSync(true) } return }
    const k = A.prev ? (DVW[A.dev] != null ? A.dev : 'm') : 'm', W = DVW[k] || 0;
    let pill = $('#dvpill');
    if (A.prev && !pill) {
      pill = mk('div'); pill.id = 'dvpill'; pill.setAttribute('role', 'group'); pill.setAttribute('aria-label', 'Tamanho da tela');
      ['m', 't', 'd'].forEach(x => { const b = mk('button', '', DVI[x] + '<span>' + DVL[x] + '</span>'); b.type = 'button'; b.dataset.k = x; b.setAttribute('aria-label', DVL[x]); b.onclick = () => { A.dev = x; devSync() }; pill.append(b) });
      st.append(pill);
    } else if (!A.prev && pill) pill.remove();
    if (pill) pill.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    const sw = st.clientWidth, sh = st.clientHeight, key = k + '|' + sw + '|' + sh + '|' + (st.classList.contains('vw') ? 1 : 0);
    if (key === fitKey) return; fitKey = key;
    const old = FS;
    if (!W) { st.classList.remove('vw'); ['--vw', '--vh', '--vs', '--vl'].forEach(v => st.style.removeProperty(v)); FS = 1 }
    else {
      const s = Math.min(1, sw / W);
      st.classList.add('vw'); st.style.setProperty('--vw', W + 'px'); st.style.setProperty('--vh', Math.ceil(sh / s) + 'px'); st.style.setProperty('--vs', String(s)); st.style.setProperty('--vl', Math.max(0, Math.round((sw - W * s) / 2)) + 'px'); FS = s;
    }
    fitKey = k + '|' + sw + '|' + sh + '|' + (st.classList.contains('vw') ? 1 : 0);
    if (old !== FS) padSync(true);
  }
  const onTurn = () => { fitKey = ''; lastPad = -1; setTimeout(() => { try { devSync(); padSync(true); dockSync() } catch (e) { } }, 60) };
  if (LANDQ.addEventListener) LANDQ.addEventListener('change', onTurn); window.addEventListener('orientationchange', onTurn); window.addEventListener('resize', () => { fitKey = ''; devSync() });

  /* ---------- teclado na tela ---------- */
  let base = innerHeight, bw = innerWidth;
  function kbSync() {
    const vv = window.visualViewport, h = Math.min(innerHeight, vv ? vv.height : 1e9);
    if (innerWidth !== bw) { bw = innerWidth; base = innerHeight } if (innerHeight > base) base = innerHeight;
    const on = $('.ed') ? h < base - 140 : false, b = document.body;
    const ae = document.activeElement, fr = !!(on && ae && ae.tagName == 'IFRAME');
    if (on !== kbOn || fr !== b.classList.contains('kb-fr')) {
      kbOn = on; b.classList.toggle('kb', on); b.classList.toggle('kb-fr', fr); padSync();
    }
  }
  function blurFr() {
    try { const f = $('#fr'); if (f) { f.blur(); const w = f.contentWindow; w && w.getSelection && w.getSelection().removeAllRanges() } const a = document.activeElement; a && a.blur && a.blur() } catch (e) { }
    setTimeout(kbSync, 80);
  }
  window.addEventListener('resize', kbSync); window.addEventListener('focusin', () => setTimeout(kbSync, 60)); window.addEventListener('focusout', () => setTimeout(kbSync, 200));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', kbSync);

  /* ---------- avisos vindos da página em edição ---------- */
  window.addEventListener('message', e => {
    const d = e.data; if (!d || !d.sl) return;
    if (d.evt == 'sel' && !d.none) {
      if (document.body.classList.contains('kb-fr')) blurFr();       // escolheu outro item: guarda o teclado
      try { if (d.txt && !localStorage.getItem('sl_h2')) { localStorage.setItem('sl_h2', '1'); call('toast', 'Para digitar no texto, toque nele de novo') } } catch (x) { }
    }
  });

  /* o aplicativo nunca deve rolar por inteiro (só a página, o painel e as listas) */
  document.addEventListener('scroll', e => { const t = e.target; if ((t === document || t === document.body || t === document.documentElement) && (window.scrollY || window.scrollX)) window.scrollTo(0, 0) }, true);

  /* ---------- varredura (leve) quando a tela muda ---------- */
  let q = 0;
  const PH = 'Cole o endereço da página';
  function tick() { nav(); hook(); hookF(); topbar(); dockBuild(); devSync(); closers(); modeSync(); origSync(); statSync(); const cu = document.getElementById('cu'); if (cu && cu.placeholder != PH) cu.placeholder = PH; const el = sp(); if (el && !el.querySelector(':scope > .sphd')) afterSide() }
  new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; try { tick() } catch (e) { console.error(e) } }) }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', tick); nav();
  function hookF() {
    if (typeof window.fnSelect != 'function' || window.fnSelect.__m) return;
    const o = window.fnSelect;
    window.fnSelect = function (id) { const r = o.apply(this, arguments); try { if (id && typeof fnSbOpen != 'undefined' && !fnSbOpen && typeof fnSideTog == 'function') fnSideTog() } catch (e) { } return r };
    window.fnSelect.__m = 1;
  }
  window.addEventListener('load', () => { hook(); hookF(); tick() });

  /* ---------- zoom com dois dedos no mapa de funis ---------- */
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
    const tg = e.target; ['touchmove'].forEach(n => tg.addEventListener(n, pmove, { passive: false })); ['touchend', 'touchcancel'].forEach(n => tg.addEventListener(n, pend, { passive: true }));
  }, { passive: true, capture: true });
  document.addEventListener('touchmove', pmove, { passive: false, capture: true });
  document.addEventListener('touchend', pend, { passive: true, capture: true });

  /* ---------- botão voltar do Android ---------- */
  function back() {
    if ($('#adv')) { call('adClose'); return true }
    const ov = $('.ov'); if (ov) { ov.remove(); return true }
    const hs = $('#hist'); if (hs) { hs.remove(); return true }
    if (A.rv) { call('rvClose'); return true }
    if (document.body.classList.contains('mob-pal')) { palClose(); return true }
    if (document.body.classList.contains('kb-fr')) { blurFr(); return true }
    if (A.view == 'edit' && S != 'none') {
      if (S == 'open' || S == 'full') { if (A.tab == 'el' && sp() && sp().querySelector('.eh')) setS('peek'); else closeSheet(); return true }
      closeSheet(); return true;
    }
    try { if (view == 'edit') { sair(); return true } if (view == 'fmap') { go('fnl'); return true } if (view != 'list') { go('list'); return true } } catch (e) { }
    return false;
  }
  window.SL_back = back;
  try {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
      Capacitor.addListener('App', 'backButton', () => { if (!back()) Capacitor.nativePromise('App', 'minimizeApp', {}).catch(() => { }) });
      window.open = (u) => { try { Capacitor.nativePromise('Browser', 'open', { url: String(u) }).catch(() => { }) } catch (e) { } return null };
    }
  } catch (e) { }
})();
