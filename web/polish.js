/* Director's Table — доводка: удержание для очистки памяти, точки-коннекторы на карточках,
   порталы зон, раскладки из файлов. Подключается последним. */
'use strict';

/* ---------- 🗑 освободить память: держать 1 секунду (случайный клик ничего не сделает) ---------- */
(function holdFree() {
  const b = $('#btnHoldFree'); if (!b) return;
  let t = null;
  const stop = () => { clearTimeout(t); t = null; b.classList.remove('holding'); };
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); b.classList.add('holding');
    t = setTimeout(async () => { stop(); b.classList.add('done'); await freeMemory?.(); setTimeout(() => b.classList.remove('done'), 900); }, 1000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
  b.addEventListener('click', e => { if (!b.classList.contains('done')) toast('Чтобы освободить память, удерживайте кнопку 1 секунду. Модели выгрузятся — следующий запуск загрузит их заново.'); });
})();

/* ---------- точка-коннектор: навели на карточку — справа точка; тянете от неё линию к виджету ---------- */
const cdot = document.createElement('div');
cdot.className = 'cdot'; cdot.title = 'Тяните к виджету, чтобы подключить'; cdot.hidden = true;
canvasEl.appendChild(cdot);
let cdotCard = null, cdotHideT = null;
cardsEl.addEventListener('pointerover', e => {
  const el = e.target.closest('.card:not(.widget)'); if (!el || G || M) return;
  const c = byId(+el.dataset.id); if (!c || !isReady(c)) return;
  clearTimeout(cdotHideT); cdotCard = c;
  cdot.style.left = (c.x + CW) + 'px'; cdot.style.top = (c.y + CH * .4) + 'px';
  cdot.style.setProperty('--c', KIND_C[c.kind] || '#fff'); cdot.hidden = false;
});
cardsEl.addEventListener('pointerout', e => { if (e.target.closest('.card:not(.widget)')) cdotHideT = setTimeout(() => { if (!cdot.matches(':hover')) cdot.hidden = true; }, 350); });
cdot.addEventListener('pointerleave', () => { cdotHideT = setTimeout(() => (cdot.hidden = true), 300); });
cdot.addEventListener('pointerdown', e => {
  if (!cdotCard) return; e.preventDefault(); e.stopPropagation();
  const c = cdotCard, ns = 'http://www.w3.org/2000/svg';
  const line = document.createElementNS(ns, 'path'); line.setAttribute('class', 'drawline'); threadHits.appendChild(line);
  const toCanvas = (x, y) => { const m = threadHits.getScreenCTM(); return [(x - m.e) / m.a, (y - m.f) / m.d]; };
  const x1 = c.x + CW, y1 = c.y + CH * .4;
  let hot = null;
  const move = ev => {
    const [x2, y2] = toCanvas(ev.clientX, ev.clientY), dx = Math.max(40, Math.abs(x2 - x1) * .45);
    line.setAttribute('d', `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
    const w = document.elementsFromPoint(ev.clientX, ev.clientY).map(el => el.closest?.('.card.widget')).find(Boolean);
    if (hot && hot !== w) hot.classList.remove('drop-in');
    hot = w || null; if (hot) hot.classList.add('drop-in');
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    line.remove(); cdot.hidden = true;
    if (!hot) return; hot.classList.remove('drop-in');
    const w = byId(+hot.dataset.id), wf = w && wfById(w.wf);
    if (!wf) return;
    if (bindToWidget(w, c)) toast(`🔗 «${esc(c.title)}» подключён к «${esc(wf.title)}». Запуск — двойной клик по виджету или правый клик → Запустить.`);
    else toast(`«${esc(wf.title)}» не принимает ${KIND_RU[c.kind] || 'такой файл'}.`);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
});

/* ---------- раскладки зон из файлов: ComfyUI/user/directors-table/layouts/*.json ---------- */
// формат как у редактора зон: {"id":"my","label":"Моя","areas":[{id,label,c,x,y,w,h,corner,kinds,…}]}
async function loadLayoutFiles() {
  try {
    const list = await API.json('/directors-table/api/layouts');
    S.customLayouts = S.customLayouts || {};
    for (const L of list) if (L && SAFE_ID.test(String(L.id)) && Array.isArray(L.areas)) S.customLayouts[L.id] = normalize({ ...S, customLayouts: { [L.id]: L } }).customLayouts[L.id] || S.customLayouts[L.id];
    if (typeof updateLayoutSel === 'function') updateLayoutSel();
  } catch (_) { }
}
setTimeout(loadLayoutFiles, 1500);
/* Shift+Z — следующая раскладка для этой сцены */
window.addEventListener('keydown', e => {
  const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  if (typing || !e.shiftKey || e.code !== 'KeyZ' || e.ctrlKey || e.altKey) return;
  e.preventDefault();
  const ids = [...Object.keys(LAYOUTS), ...Object.keys(S.customLayouts || {})];
  const sh = S.sheets.find(s => s.id === S.sheet); if (!sh) return;
  sh.layout = ids[(ids.indexOf(sh.layout) + 1) % ids.length];
  save(); render(); toast(`Раскладка: <b>${esc(layoutDef(sh.layout).label || sh.layout)}</b> (Shift+Z — следующая)`);
});

/* ---------- круговое меню виджета: «Входы» — файл с компьютера прямо в нужный вход, промпт, негатив, пресеты ---------- */
function pickFileFor(w, kind) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = kind + '/*';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    toast('Загружаю «' + esc(f.name) + '»…');
    try {
      const file = await API.upload(f);
      const c = { id: S.nextId++, type: 'file', sheet: w.sheet, kind, title: f.name.replace(/\.[^.]+$/, ''), file, status: 'ready', created: Date.now(), parked: false };
      S.cards.push(c); placeCard(c, areaForKind(kind, c.title, w.sheet)); save(); render([c.id]);
      if (bindToWidget(w, c)) toast(`🔗 «${esc(c.title)}» загружен и подключён к «${esc(wfById(w.wf)?.title || '')}».`);
    } catch (e) { toast('Не загрузилось: ' + esc(e.message)); }
  };
  inp.click();
}
function quickNeg(w) {
  const wf = wfById(w.wf); const neg = (wf?.params || []).find(p => p.type === 'text' && (p.role === 'neg' || /neg/i.test(p.id)));
  if (!neg) return toast('В этом workflow нет негативного промпта.');
  const cur = paramDefaults(wf)[neg.id] ?? '';
  sheetOpen(`<h3>Негативный промпт · ${esc(wf.title)}</h3><div class="sub">Чего НЕ должно быть в кадре. Сохранится для следующих запусков.</div><div class="field"><textarea name="ng" rows="5">${esc(cur)}</textarea></div><div class="acts"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Сохранить</button></div>`,
    f => { S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [neg.id]: f.ng.value }; save(); toast('Негатив сохранён.'); });
}
const _widgetMenuBase = widgetMenu;
widgetMenu = function (w) {
  const items = _widgetMenuBase(w), wf = wfById(w.wf);
  if (!wf) return items;
  const takes = k => wf.accepts.includes(k) || wfTakes(wf, k);
  const ins = [
    takes('image') && { label: '🖼 Картинка…', enabled: true, act: () => pickFileFor(w, 'image') },
    takes('video') && { label: '🎞 Видео…', enabled: true, act: () => pickFileFor(w, 'video') },
    takes('audio') && { label: '♪ Звук…', enabled: true, act: () => pickFileFor(w, 'audio') },
    promptParam(wf) && { label: '✎ Промпт', enabled: true, act: () => quickPrompt(w) },
    (wf.params || []).some(p => p.type === 'text' && (p.role === 'neg' || /neg/i.test(p.id))) && { label: '⊖ Негатив', enabled: true, act: () => quickNeg(w) },
    { label: '◉ Пресеты', enabled: true, act: () => { setSel([w.id]); maestroOpen(); } },
  ].filter(Boolean);
  items.splice(2, 0, { label: 'Входы', enabled: true, children: ins });
  return items;
};
