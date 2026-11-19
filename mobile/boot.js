/* Liga o armazenamento e o servidor das páginas clonadas, depois carrega o aplicativo. */
(async () => {
  const go = () => { const s = document.createElement('script'); s.src = 'app.js?v=' + (window.SL_VER || '1'); document.body.appendChild(s) };
  try { await SL.init() } catch (e) { console.error('armazenamento', e) }
  try {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js');
      await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 4000))]);
      if (!navigator.serviceWorker.controller) await Promise.race([new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })), new Promise(r => setTimeout(r, 1500))]);
    }
  } catch (e) { console.error('servidor de páginas', e) }
  window.SL_SWOK = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  go();
  if (!window.SL_SWOK) setTimeout(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:10px;right:10px;top:calc(var(--sat,0px) + 6px);z-index:99;background:#3a181c;border:1px solid #7a2a32;color:#fecaca;padding:9px 12px;border-radius:12px;font-size:12px'; d.textContent = 'Aviso: o servidor das páginas clonadas não iniciou. Feche e abra o app. Se continuar, me avise.'; d.onclick = () => d.remove(); document.body.append(d) }, 2500);
})();
