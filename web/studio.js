/* Director's Table — «Конструктор студии»: собери себе рабочее пространство сам.
   Блоки (Видео, Картинки, Звук, Текст, Дизайн, Монтаж, Сценарий, Ассистент, Радио, Маэстро) тащатся на стол,
   зоны двигаются и растягиваются, у подписи своё место, цвет и размер. Раскладку можно повесить на клавишу.
   Здесь же: вид виджетов (как значки в Windows), Маэстро в разных местах, стиль и длина рядов клавиш. */
'use strict';

/* ================= готовые студии ================= */
Object.assign(LAYOUTS, {
  studio: {
    label: 'Студия (как MiniMax)', areas: [
      { id: 'gen', label: 'Генерация', note: 'виджеты и настройки', c: '#3fd2ff', x: 0, y: 0, w: .25, h: 1, corner: 'tl', kinds: ['video', 'image', 'audio', 'text'] },
      { id: 'script', label: 'Промпт · сценарий', note: 'по строке на кадр', c: '#f0ff41', x: .26, y: 0, w: .52, h: .3, corner: 'top', kinds: [], panel: 'script' },
      { id: 'maestro', label: 'Маэстро', note: 'пресеты', c: '#b8a8ff', x: .79, y: 0, w: .21, h: .3, corner: 'top', kinds: [], panel: 'maestro' },
      { id: 'cut', label: 'Галерея', note: 'готовые видео · монтаж', c: '#ff6b5e', x: .26, y: .31, w: .74, h: .69, corner: 'tl', kinds: [], montage: true },
    ]
  },
  bottomcut: {
    label: 'Монтаж внизу', areas: [
      { id: 'video', label: 'Видео', note: 'генерация и исходники', c: '#3fd2ff', x: 0, y: 0, w: .41, h: .6, corner: 'tl', kinds: ['video', 'audio'] },
      { id: 'script', label: 'Сценарий', note: 'по строке на кадр', c: '#f0ff41', x: .425, y: .015, w: .15, h: .56, corner: 'top', kinds: [], panel: 'script' },
      { id: 'image', label: 'Картинки', note: 'кадры, референсы', c: '#f0ff41', x: .59, y: 0, w: .41, h: .6, corner: 'tr', kinds: ['image', 'text'] },
      { id: 'cut', label: 'Монтаж', note: 'таймлайн · слева направо', c: '#ff6b5e', x: 0, y: .61, w: 1, h: .39, corner: 'tl', kinds: [], montage: true },
    ]
  },
  simple: {
    label: 'Новичок', areas: [
      { id: 'gen', label: 'Создать', note: 'один виджет — один клик', c: '#3fd2ff', x: 0, y: 0, w: .62, h: .62, corner: 'tl', kinds: ['video', 'image', 'audio', 'text'] },
      { id: 'assist', label: 'Скажите, что сделать', note: 'голосом или текстом', c: '#8f74f2', x: .63, y: 0, w: .37, h: .62, corner: 'top', kinds: [], panel: 'assistant' },
      { id: 'cut', label: 'Готовое', note: 'результаты и монтаж', c: '#ff6b5e', x: 0, y: .63, w: 1, h: .37, corner: 'tl', kinds: [], montage: true },
    ]
  },
});

/* ================= вид: крупные / средние / мелкие / минимализм ================= */
const VIEW_RU = { large: 'Крупные', medium: 'Средние', small: 'Мелкие', mini: 'Минимализм' };
function setView(v) {
  if (!VIEW_K[v]) return;
  VIEW = v; S.cfg.view = v; save();
  CARD_K = VIEW_K[v][0]; WIDGET_K = VIEW_K[v][1];
  CW = Math.round(150 * CARD_K); CH = Math.round(124 * CARD_K); WW = Math.round(156 * WIDGET_K); WH = Math.round(126 * WIDGET_K);
  document.documentElement.style.setProperty('--card-k', CARD_K); document.documentElement.style.setProperty('--widget-k', WIDGET_K);
  document.documentElement.dataset.view = v;
  render(); drawThreads?.();
  toast(`Вид: <b>${VIEW_RU[v]}</b>. Правый клик по пустому месту стола → «Вид» — поменять.`);
}
// пункт «Вид» в меню правого клика по столу (меню само — из v23)
board.addEventListener('contextmenu', () => {
  setTimeout(() => {
    const m = pop.querySelector('.bmenu'); if (!m || m.querySelector('.bview')) return;
    m.insertAdjacentHTML('beforeend', `<div class="bview"><span>Вид</span>${Object.keys(VIEW_RU).map(k => `<button type="button" data-view="${k}" class="${VIEW === k ? 'on' : ''}">${VIEW_RU[k]}</button>`).join('')}</div><button type="button" data-bm2="build">🧩 Конструктор студии</button>`);
    const prev = pop.onclick;
    pop.onclick = ev => { const v = ev.target.closest('button[data-view]'); if (v) { closePop(); return setView(v.dataset.view); } if (ev.target.closest('[data-bm2="build"]')) { closePop(); return showRight('build'); } prev && prev(ev); };
  }, 0);
});

/* ================= радио и Маэстро как блоки на столе ================= */
const radioHome = radioEl.parentElement, radioNext = radioEl.nextSibling;
{ const _ra = renderAreas; renderAreas = function () {
  if (areasEl.contains(radioEl)) { radioHome.insertBefore(radioEl, radioNext); radioEl.classList.remove('docked'); }
  const r = _ra.apply(this, arguments);
  const slot = $('.zone-panel[data-panel="radio"]');
  if (slot) { slot.appendChild(radioEl); radioEl.classList.add('docked'); }
  const ms = $('.zone-panel[data-panel="maestro"]');
  if (ms && !ms.dataset.f) { ms.dataset.f = 1; ms.innerHTML = '<div class="ms-hint">Маэстро живёт здесь. Клик по сфере — пресеты.</div>'; }
  return r;
}; }
{ const _po = placeOrb; placeOrb = function () {
  const mode = S.cfg.orbMode || 'desk';
  document.body.dataset.orb = mode;
  orb.style.setProperty('--orbS', (S.cfg.orbSize || 46) + 'px');
  if (mode !== 'desk') { if (orb.parentElement !== document.body) document.body.appendChild(orb); orb.style.left = orb.style.top = ''; return; }
  if (orb.parentElement !== canvasEl) canvasEl.appendChild(orb);
  const ma = areasOf(S.sheet).find(a => a.panel === 'maestro');
  const at = (S.cfg.orbAt || {})[(S.sheets.find(s => s.id === S.sheet) || {}).layout];
  if (ma) { const r = areaRect(ma); orb.style.left = (r.x + r.w / 2) + 'px'; orb.style.top = (r.y + r.h / 2 + 8) + 'px'; return; }
  if (at) { orb.style.left = at[0] + 'px'; orb.style.top = at[1] + 'px'; return; }
  _po.apply(this, arguments);
}; }

/* ================= Маэстро: режимы, размер, цвета ================= */
const ORB_MODES = { desk: 'Сфера на столе', top: 'Сканер сверху', piano: 'Луч от пианино', list: 'Список в левой панели' };
function applyOrbLook() {
  const h = S.cfg.holoHue || 0, o = S.cfg.orbHue || 0;
  document.documentElement.style.setProperty('--holoHue', h + 'deg');
  document.documentElement.style.setProperty('--orbHue', o + 'deg');
  document.documentElement.style.setProperty('--orbS', (S.cfg.orbSize || 46) + 'px');
  holo.dataset.glow = S.cfg.holoGlow || 'soft';
  placeOrb();
}
function maestroSettings() {
  sheetOpen(`<h3>◉ Маэстро — настройки</h3><div class="sub">Где живёт сфера и как светится голограмма. Сферу можно и просто перетащить: на стол, в верхнюю панель, к пианино или к левому краю.</div>
    <div class="field"><span class="flabel">Где Маэстро</span><div class="seg">${Object.entries(ORB_MODES).map(([k, l]) => `<button type="button" data-om="${k}" class="${(S.cfg.orbMode || 'desk') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="orbSz">Размер сферы</label><input type="range" id="orbSz" min="30" max="90" value="${S.cfg.orbSize || 46}"></div>
    <div class="field"><label for="orbHue">Цвет сферы</label><input type="range" id="orbHue" class="hue" min="0" max="359" value="${S.cfg.orbHue || 0}"></div>
    <div class="field"><label for="holoHue">Цвет голограммы</label><input type="range" id="holoHue" class="hue" min="0" max="359" value="${S.cfg.holoHue || 0}"></div>
    <div class="field"><span class="flabel">Свечение</span><div class="seg">${[['soft', 'Мягкое'], ['bright', 'Яркое'], ['off', 'Без свечения']].map(([k, l]) => `<button type="button" data-hg="${k}" class="${(S.cfg.holoGlow || 'soft') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="acts"><button type="button" class="btn ghost" data-mreset>Как было</button><button type="button" class="btn ghost" data-mtry>Показать голограмму</button><button type="button" class="btn primary" data-close>Готово</button></div>`, null, {
    init: box => box.addEventListener('input', e => { const t = e.target; if (t.id === 'orbSz') S.cfg.orbSize = +t.value; if (t.id === 'orbHue') S.cfg.orbHue = +t.value; if (t.id === 'holoHue') S.cfg.holoHue = +t.value; save(); applyOrbLook(); }),
    onClick: e => {
      const om = e.target.closest('[data-om]'); if (om) { S.cfg.orbMode = om.dataset.om; save(); applyOrbLook(); sheet.querySelectorAll('[data-om]').forEach(b => b.classList.toggle('on', b === om)); }
      const hg = e.target.closest('[data-hg]'); if (hg) { S.cfg.holoGlow = hg.dataset.hg; save(); applyOrbLook(); sheet.querySelectorAll('[data-hg]').forEach(b => b.classList.toggle('on', b === hg)); }
      if (e.target.closest('[data-mreset]')) { ['orbMode', 'orbSize', 'orbHue', 'holoHue', 'holoGlow', 'orbAt'].forEach(k => delete S.cfg[k]); save(); applyOrbLook(); closeSheet(); maestroSettings(); }
      if (e.target.closest('[data-mtry]')) { closeSheet(); maestroOpen(); }
    }
  });
}
// шестерёнка у сферы
const orbGear = document.createElement('button'); orbGear.type = 'button'; orbGear.className = 'orb-gear'; orbGear.title = 'Настройки Маэстро: место, размер, цвет'; orbGear.textContent = '⚙';
orb.appendChild(orbGear);
orbGear.addEventListener('pointerdown', e => e.stopPropagation(), true);
orbGear.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); maestroSettings(); });
// перетащили сферу не на клавишу — переносим: стол / верх / пианино / левый край
orb.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target === orbGear) return;
  const x0 = e.clientX, y0 = e.clientY;
  const up = ev => {
    window.removeEventListener('pointerup', up, true);
    if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 10) return;
    const under = document.elementsFromPoint(ev.clientX, ev.clientY);
    if (under.some(el => el.closest?.('[data-bind], .key'))) return; // на клавишу — назначение, как раньше
    let mode = null;
    if (ev.clientX < 60) mode = 'list';
    else if (under.some(el => el.closest?.('#top'))) mode = 'top';
    else if (under.some(el => el.closest?.('#piano, .piano-wrap, #pToggles')) || ev.clientY > innerHeight - 90) mode = 'piano';
    else if (under.some(el => el.closest?.('#board'))) {
      mode = 'desk';
      const [lx, ly] = toLogical(ev.clientX, ev.clientY), lay = (S.sheets.find(s => s.id === S.sheet) || {}).layout;
      S.cfg.orbAt = { ...(S.cfg.orbAt || {}), [lay]: [Math.round(lx), Math.round(ly)] };
    }
    if (!mode) return;
    S.cfg.orbMode = mode; save(); applyOrbLook();
    setTimeout(() => { $$('.mh-ghost').forEach(g => g.remove()); }, 0);
    toast(`◉ Маэстро: <b>${ORB_MODES[mode]}</b>. ⚙ у сферы — размер и цвет.`);
  };
  window.addEventListener('pointerup', up, true);
});
// голограмма раскрывается от того места, где живёт сфера
{ const _mo = maestroOpen; maestroOpen = function () {
  const r = _mo.apply(this, arguments);
  const mode = S.cfg.orbMode || 'desk';
  holo.dataset.mode = mode;
  if (mode === 'top') holo.dataset.dir = 'down';
  if (mode === 'piano') {
    holo.dataset.dir = 'up';
    const o = orb.getBoundingClientRect(), ox = o.left + o.width / 2, oy = o.top + o.height / 2;
    const ang = Math.atan2(innerWidth / 2 - ox, oy - innerHeight * .4) * 180 / Math.PI;
    holo.style.setProperty('--beamRot', ang.toFixed(1) + 'deg');
    holo.style.setProperty('--beamH', Math.hypot(innerWidth / 2 - ox, oy - innerHeight * .4) + 'px');
    holo.style.setProperty('--stTop', Math.max(60, innerHeight * .4 - 160) + 'px'); holo.style.setProperty('--stH', '320px');
  }
  return r;
}; }
applyOrbLook();

/* ================= клавиши: стиль, длина рядов, свёрнутые, раскладка на клавише ================= */
const KEY_STYLES = { classic: 'Классика', color: 'Цветные', mono: 'Монохром' };
function applyKeyStyle() { document.body.dataset.keys = S.cfg.keyStyle || 'classic'; }
applyKeyStyle();
{ const _rc = rowCodes; rowCodes = function (r) { const all = _rc(r), n = (S.cfg.rowLen || {})[r]; return n ? all.slice(0, Math.max(1, Math.min(all.length, n))) : all; }; }
// свёрнутые клавиши: по умолчанию работают; можно отключить в конструкторе
window.addEventListener('keydown', e => {
  if (!S.cfg.pianoCollapsed || !S.cfg.collapsedOff || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (WHITE.includes(e.code) || BLACK.some(b => b.code === e.code) || ROWS.some(r => r && r.includes(e.code))) e.stopImmediatePropagation();
}, true);
// клавиша может переключать раскладку сцены: значение 'layout:<id>'
{ const _ba = bindAction; bindAction = function (v) {
  if (typeof v === 'string' && v.startsWith('layout:')) { const id = v.slice(7); const L = LAYOUTS[id] || S.customLayouts?.[id]; return L ? { id: v, title: '▦ ' + (L.label || id), kind: 'layout', layout: id } : null; }
  return _ba.apply(this, arguments);
}; }
{ const _rb = runBinding; runBinding = function (code) {
  const v = bindingTarget(code)[code];
  if (typeof v === 'string' && v.startsWith('layout:')) { applyLayout(v.slice(7)); return; }
  return _rb.apply(this, arguments);
}; }
KIND_C.layout = '#b8a8ff';
// после смены раскладки карточки, оказавшиеся в панели (сценарий, ассистент…) или вне зон, переезжают в подходящую зону
function refitCards() {
  const areas = areasOf();
  for (const c of visibleCards()) {
    const w = c.type === 'widget' ? WW : CW, h = c.type === 'widget' ? WH : CH, a = areaAt(c.x + w / 2, c.y + h / 2);
    if (a && !a.panel) continue;
    const kind = c.type === 'widget' ? wfById(c.wf)?.kind : c.kind;
    const to = areaForKind(kind || 'video', c.title || '') || areas.find(x => !x.panel && !x.montage) || areas.find(x => !x.panel);
    if (to) placeCard(c, to);
  }
}
function applyLayout(id) {
  const sh = S.sheets.find(s => s.id === S.sheet); if (!sh || !(LAYOUTS[id] || S.customLayouts?.[id])) return;
  if (sh.closed) return toast('Сцена закрыта — раскладку не меняю.');
  sh.layout = id; refitCards(); save(); render(); updateLayoutSel();
  toast(`▦ Раскладка: <b>${esc(layoutDef(id).label || id)}</b>`);
  if (rTab === 'build') renderBuild();
}
// в меню клавиши — раздел «Раскладка»
{ const _bm = bindMenu; bindMenu = function (code, anchor) {
  _bm.apply(this, arguments);
  const map = bindingTarget(code);
  const lays = [...Object.entries(LAYOUTS), ...Object.entries(S.customLayouts || {})].filter(([k]) => k !== 'free' || true);
  pop.insertAdjacentHTML('beforeend', `<div class="pop-sub">Раскладка студии</div>${lays.map(([k, L]) => `<button data-id="layout:${esc(k)}" class="${map[code] === 'layout:' + k ? 'cur' : ''}">▦ ${esc(L.label || k)}</button>`).join('')}`);
}; }

/* ================= конструктор ================= */
const BLOCKS = [
  { t: 'video', label: 'Видео', c: '#3fd2ff', kinds: ['video'], icon: '🎬' },
  { t: 'image', label: 'Картинки', c: '#f0ff41', kinds: ['image'], icon: '🖼' },
  { t: 'audio', label: 'Звук', c: '#ff8a3d', kinds: ['audio'], icon: '🔊' },
  { t: 'text', label: 'Текст', c: '#6f8cff', kinds: ['text'], icon: '✍' },
  { t: 'design', label: 'Дизайн', c: '#c084fc', kinds: [], icon: '🎨' },
  { t: 'fx', label: 'Эффекты', c: '#ff5fa8', kinds: [], icon: '✨' },
  { t: 'cut', label: 'Монтаж · вывод', c: '#ff6b5e', kinds: [], montage: true, one: true, icon: '🎞' },
  { t: 'script', label: 'Сценарий · промпт', c: '#f0ff41', kinds: [], panel: 'script', one: true, icon: '📜', w: .18, h: .3 },
  { t: 'assist', label: 'Ассистент', c: '#8f74f2', kinds: [], panel: 'assistant', one: true, icon: '🎙', w: .18, h: .3 },
  { t: 'radio', label: 'Радио', c: '#5fe3a1', kinds: [], panel: 'radio', one: true, icon: '📻', w: .16, h: .14 },
  { t: 'maestro', label: 'Маэстро', c: '#b8a8ff', kinds: [], panel: 'maestro', one: true, icon: '◉', w: .14, h: .18 },
  { t: 'zone', label: 'Своя зона', c: '#a49cb3', kinds: [], icon: '▢' },
];
const CORNERS = [['tl', '↖'], ['top', '↑'], ['tr', '↗'], ['bl', '↙'], ['bot', '↓'], ['br', '↘']];
let buildSel = null;
const curLayoutId = () => (S.sheets.find(s => s.id === S.sheet) || {}).layout || '3x3';
const isCustom = id => !!S.customLayouts?.[id] && !LAYOUTS[id];
function editableLayout() {
  const sh = S.sheets.find(s => s.id === S.sheet); if (!sh) return null;
  if (sh.closed) { toast('Сцена закрыта — сначала откройте её.'); return null; }
  if (isCustom(sh.layout)) return S.customLayouts[sh.layout];
  const base = layoutDef(sh.layout);
  let n = 1; while (S.customLayouts?.['my' + n]) n++;
  const id = 'my' + n;
  S.customLayouts = S.customLayouts || {};
  S.customLayouts[id] = { id, label: (base.label || 'Раскладка') + ' · моя', areas: areasOf(S.sheet).map(a => { const x = { ...a }; delete x.match; return x; }) };
  sh.layout = id; save(); updateLayoutSel();
  toast(`Сделал свою копию раскладки — правьте сколько угодно, оригинал не тронут.`);
  return S.customLayouts[id];
}
function relayout() { areaKey = ''; render(); }
function addBlock(b, fx, fy) {
  const L = editableLayout(); if (!L) return;
  if (b.one && L.areas.some(a => (b.panel && a.panel === b.panel) || (b.montage && a.montage))) return toast(`«${b.label}» на столе уже есть — он бывает только один.`);
  histPush('новый блок');
  const w = b.w || .26, h = b.h || .32;
  let id = b.t, k = 2; while (L.areas.some(a => a.id === id)) id = b.t + (k++);
  const a = { id, label: b.label, note: '', c: b.c, x: Math.max(0, Math.min(1 - w, fx - w / 2)), y: Math.max(0, Math.min(1 - h, fy - h / 2)), w, h, corner: b.panel ? 'top' : 'tl', kinds: [...b.kinds], fs: 1 };
  if (b.panel) a.panel = b.panel; if (b.montage) a.montage = true;
  L.areas.push(a); buildSel = id; save(); relayout(); renderBuild();
}
function selArea() { const L = S.customLayouts?.[curLayoutId()]; return L?.areas.find(a => a.id === buildSel) || null; }
function updArea(fn, label = 'правка зоны') {
  const L = editableLayout(); if (!L) return; const a = L.areas.find(x => x.id === buildSel); if (!a) return;
  histPush(label); fn(a); if (S.zoneCfg?.[a.id]) delete S.zoneCfg[a.id]; save(); relayout(); renderBuild();
}
function renderBuild() {
  const box = $('#tabBuild'); if (!box) return;
  const lid = curLayoutId(), L = layoutDef(lid), a = selArea();
  const lays = [...Object.entries(LAYOUTS), ...Object.entries(S.customLayouts || {})];
  box.innerHTML = `<div class="bld">
    <section><h4>Раскладка этой сцены</h4>
      <select id="bLay">${lays.map(([k, v]) => `<option value="${esc(k)}" ${k === lid ? 'selected' : ''}>${esc(v.label || k)}</option>`).join('')}</select>
      <div class="bld-row"><button type="button" data-b="new">＋ Пустая</button><button type="button" data-b="copy">⧉ Копия</button>${isCustom(lid) ? `<button type="button" data-b="ren">✎ Имя</button><button type="button" data-b="del">🗑</button>` : ''}<button type="button" data-b="file">💾 В файл</button><button type="button" data-b="where">📂 Где файл</button></div>
      <div class="bld-hint">${isCustom(lid) ? 'Тяните зону за подпись или пустое место, угол — растянуть. Клик по зоне — настройки ниже.' : 'Это готовая раскладка. Начните двигать зону или бросьте блок — стол сам сделает вашу копию.'}</div></section>
    <section><h4>Блоки — перетащите на стол</h4><div class="blk-grid">${BLOCKS.map(b => `<div class="blk" data-blk="${b.t}" style="--c:${b.c}"><i>${b.icon}</i>${esc(b.label)}</div>`).join('')}</div></section>
    ${a ? `<section class="bsel" style="--c:${esc(a.c)}"><h4>Зона «${esc(a.label)}»</h4>
      <div class="bld-f"><label>Подпись<input id="bLabel" maxlength="40" value="${esc(a.label)}"></label><label>Пояснение<input id="bNote" maxlength="60" value="${esc(a.note || '')}"></label></div>
      <div class="bld-f"><label>Цвет<input type="color" id="bColor" value="${esc(a.c)}"></label><label>Размер подписи<input type="range" id="bFs" min="0.6" max="2" step="0.1" value="${a.fs || 1}"></label></div>
      <div class="bld-f"><span class="flabel">Где подпись</span><div class="corners">${CORNERS.map(([k, s]) => `<button type="button" data-corner="${k}" class="${a.corner === k ? 'on' : ''}">${s}</button>`).join('')}</div></div>
      ${a.panel || a.montage ? '' : `<div class="bld-f"><span class="flabel">Что сюда ложится</span><div class="seg">${['video', 'image', 'audio', 'text'].map(k => `<button type="button" data-kind="${k}" class="${a.kinds.includes(k) ? 'on' : ''}">${KIND_RU[k]}</button>`).join('')}</div></div>`}
      <div class="bld-row"><button type="button" data-b="fit">⤢ Подогнать размер</button><button type="button" data-b="rm" class="danger">Убрать зону</button></div></section>` : ''}
    <section><h4>Вид виджетов</h4><div class="seg">${Object.entries(VIEW_RU).map(([k, l]) => `<button type="button" data-view="${k}" class="${VIEW === k ? 'on' : ''}">${l}</button>`).join('')}</div></section>
    <section><h4>Шторки (👁)</h4><div class="seg">${[['lines', 'Линии'], ['maestro', 'Голограмма Маэстро']].map(([k, l]) => `<button type="button" data-rs="${k}" class="${(S.cfg.restStyle || 'lines') === k ? 'on' : ''}">${l}</button>`).join('')}</div></section>
    <section><h4>Звуки интерфейса</h4><label class="chk"><input type="checkbox" id="bSnd" ${S.cfg.uiSounds ? 'checked' : ''}> Тихие звуки: клавиши, панели, Маэстро, «готово»</label></section>
    <section><h4>Линии связей</h4><div class="seg">${[['curve', '⌒ Кривые'], ['straight', '／ Прямые'], ['angled', '⌐ Углом']].map(([k, l]) => `<button type="button" data-ls="${k}" class="${(S.cfg.linkStyle || 'curve') === k ? 'on' : ''}">${l}</button>`).join('')}</div></section>
    <section><h4>Панели</h4><div class="seg">${[['push', 'Закреплённая сдвигает стол'], ['overlay', 'Закреплённая поверх стола']].map(([k, l]) => `<button type="button" data-pm="${k}" class="${(S.cfg.pinMode || 'push') === k ? 'on' : ''}">${l}</button>`).join('')}</div></section>
    <section><h4>Маэстро</h4><div class="bld-row"><button type="button" data-b="maestro">⚙ Место, размер, цвет</button></div></section>
    <section><h4>Клавиши</h4>
      <div class="seg">${Object.entries(KEY_STYLES).map(([k, l]) => `<button type="button" data-ks="${k}" class="${(S.cfg.keyStyle || 'classic') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="bld-f"><label>Клавиш в ряду A–L<input type="number" id="bRow1" min="1" max="9" value="${(S.cfg.rowLen || {})[1] || 9}"></label><label>Клавиш в ряду Z–M<input type="number" id="bRow2" min="1" max="7" value="${(S.cfg.rowLen || {})[2] || 7}"></label></div>
      <label class="chk"><input type="checkbox" id="bColOff" ${S.cfg.collapsedOff ? 'checked' : ''}> Свёрнутые клавиши не срабатывают</label>
      <div class="bld-row"><button type="button" data-b="demo">▦ Студии на клавиши Z X C V B</button></div>
      <div class="bld-hint">Любой клавише можно дать раскладку: правый клик по клавише → «Раскладка студии».</div></section>
    <section class="dev"><h4>В разработке</h4><div class="dev-list"><span>🤖 Раскладка по описанию (Ollama) <em>скоро</em></span><span>🌐 Перевод видео с липсинком <em>скоро</em></span><span>👤 Инфлюенсер: обучение LoRA <em>скоро</em></span><span>🗣 Замена голоса <em>скоро</em></span><span>📖 Ролик-объяснение <em>скоро</em></span></div></section>
  </div>`;
}
// конструктор перерисовываем только при открытии вкладки и после своих правок — иначе общие обновления панели
// (статистика, рендер стола) пересоздавали бы кнопки прямо под мышкой и клики терялись
let buildShown = false;
{ const _rr = renderRight; renderRight = function () { _rr.apply(this, arguments); $('#tabBuild') && ($('#tabBuild').hidden = rTab !== 'build'); if (rTab === 'build' && !buildShown) renderBuild(); buildShown = rTab === 'build'; syncBuildMode(); }; }
function syncBuildMode() { const R = $('#right'); document.body.classList.toggle('build-mode', rTab === 'build' && !!R && (R.classList.contains('open') || R.classList.contains('pinned'))); }
new MutationObserver(syncBuildMode).observe($('#right'), { attributes: true, attributeFilter: ['class'] });
// вкладка в правой панели
{ const tabs = $('#rTabs'); tabs.insertAdjacentHTML('beforeend', '<button data-tab="build" title="Собрать свою студию: зоны, блоки, вид, клавиши">🧩 Конструктор</button>');
  const sec = document.createElement('section'); sec.className = 'tab'; sec.dataset.tab = 'build'; sec.id = 'tabBuild'; sec.hidden = true; $('#right .edge-body').appendChild(sec); }
$('#right').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'bLay') applyLayout(t.value);
  if (t.id === 'bColOff') { S.cfg.collapsedOff = t.checked; save(); }
  if (t.id === 'bSnd') { S.cfg.uiSounds = t.checked; save(); if (t.checked) uiSound('done'); }
  if (t.id === 'bRow1' || t.id === 'bRow2') { const r = t.id === 'bRow1' ? 1 : 2; S.cfg.rowLen = { ...(S.cfg.rowLen || {}), [r]: +t.value }; save(); renderPiano(); }
  if (t.id === 'bColor') updArea(a => { a.c = t.value; }, 'цвет зоны');
  if (t.id === 'bLabel') updArea(a => { a.label = t.value.trim().slice(0, 40) || a.label; }, 'подпись зоны');
  if (t.id === 'bNote') updArea(a => { a.note = t.value.trim().slice(0, 60); }, 'пояснение зоны');
  if (t.id === 'bFs') updArea(a => { a.fs = +t.value; }, 'размер подписи');
});
$('#right').addEventListener('click', e => {
  if (!e.target.closest('#tabBuild')) return;
  const v = e.target.closest('button[data-view]'); if (v) { setView(v.dataset.view); return renderBuild(); }
  const rs = e.target.closest('[data-rs]'); if (rs) { S.cfg.restStyle = rs.dataset.rs; save(); renderBuild(); return openRest(); }
  const ls = e.target.closest('[data-ls]'); if (ls) { S.cfg.linkStyle = ls.dataset.ls; save(); drawThreads(); return renderBuild(); }
  const pm = e.target.closest('[data-pm]'); if (pm) { S.cfg.pinMode = pm.dataset.pm; save(); syncPins(); return renderBuild(); }
  const ks = e.target.closest('[data-ks]'); if (ks) { S.cfg.keyStyle = ks.dataset.ks; save(); applyKeyStyle(); renderPiano(); return renderBuild(); }
  const c = e.target.closest('[data-corner]'); if (c) return updArea(a => { a.corner = c.dataset.corner; }, 'место подписи');
  const k = e.target.closest('[data-kind]'); if (k) return updArea(a => { a.kinds = a.kinds.includes(k.dataset.kind) ? a.kinds.filter(x => x !== k.dataset.kind) : [...a.kinds, k.dataset.kind]; }, 'что ложится в зону');
  const b = e.target.closest('[data-b]')?.dataset.b; if (!b) return;
  const sh = S.sheets.find(s => s.id === S.sheet);
  if (b === 'new') { let n = 1; while (S.customLayouts?.['my' + n]) n++; const id = 'my' + n; histPush('новая раскладка'); S.customLayouts = { ...(S.customLayouts || {}), [id]: { id, label: 'Моя студия ' + n, areas: [] } }; save(); applyLayout(id); toast('Пустая студия. Перетащите блоки из конструктора на стол.'); }
  if (b === 'copy') { const cur = sh.layout; if (isCustom(cur)) { const L = S.customLayouts[cur]; let n = 1; while (S.customLayouts['my' + n]) n++; S.customLayouts['my' + n] = { ...JSON.parse(JSON.stringify(L)), id: 'my' + n, label: L.label + ' (копия)' }; save(); applyLayout('my' + n); } else { editableLayout(); relayout(); renderBuild(); } }
  if (b === 'ren') { const L = S.customLayouts[sh.layout]; const a2 = document.createElement('div'); popAt(e.target.closest('button'), `<h4>Имя раскладки</h4><input id="lrIn" maxlength="40" value="${esc(L.label)}">`, p => { const i = p.querySelector('#lrIn'); i.focus(); i.select(); i.onkeydown = ev => { if (ev.key === 'Enter') { L.label = i.value.trim() || L.label; save(); updateLayoutSel(); closePop(); renderBuild(); } }; }, 'below'); }
  if (b === 'del') { const id = sh.layout; confirmSheet(`Удалить раскладку «${esc(S.customLayouts[id].label)}»?`, 'Сцены с ней перейдут на «Режиссёрскую». Файлы и карточки не трогаются. Ctrl+Z — вернуть.', 'Удалить', () => { histPush('удаление раскладки'); delete S.customLayouts[id]; S.sheets.forEach(s => { if (s.layout === id) s.layout = '3x3'; }); save(); relayout(); updateLayoutSel(); renderBuild(); }); }
  if (b === 'file') saveLayoutFile();
  if (b === 'where') whereLayouts();
  if (b === 'fit') updArea(a => { const n = visibleCards().filter(c => areaAt(c.x + CW / 2, c.y + CH / 2)?.id === a.id).length; a.w = Math.min(1 - a.x, Math.max(.14, Math.ceil(Math.sqrt(Math.max(1, n))) * (CW + 14) / W + .02)); a.h = Math.min(1 - a.y, Math.max(.14, Math.ceil(Math.max(1, n) / Math.ceil(Math.sqrt(Math.max(1, n)))) * (CH + 14) / H + .08)); }, 'размер зоны');
  if (b === 'rm') { const L = editableLayout(); if (!L) return; histPush('удаление зоны'); L.areas = L.areas.filter(a => a.id !== buildSel); buildSel = null; save(); relayout(); renderBuild(); }
  if (b === 'maestro') maestroSettings();
  if (b === 'demo') demoStudios();
});
async function saveLayoutFile() {
  const L = editableLayout(); if (!L) return;
  try { const r = await jpost('/directors-table/api/layouts/save', { id: L.id, label: L.label, areas: L.areas }); if (r.error) throw new Error(r.error); toast(`💾 Сохранил: <code data-noi18n>${esc(r.file)}</code>. Рядом можно положить вариант «${esc(L.id)}-2.json» — он появится в списке, переключение Shift+Z.`); }
  catch (e) { toast('Не сохранилось: ' + esc(e.message)); }
}
async function whereLayouts() {
  let folder = 'ComfyUI/user/directors-table/layouts'; try { folder = (await API.json('/directors-table/api/layouts/where')).folder || folder; } catch (_) { }
  sheetOpen(`<h3>📂 Где лежат раскладки</h3><div class="sub">Каждая студия — это маленький JSON-файл. Его можно отдать ChatGPT или Claude и попросить: «добавь зону для промптов справа, сделай монтаж внизу». Новый файл положите рядом с другим именем, например <b>${esc(curLayoutId())}-2.json</b> — стол подхватит его сам, переключение Shift+Z или в списке конструктора.</div>
    <div class="field"><label>Папка</label><input readonly value="${esc(folder)}" data-noi18n></div>
    <div class="hint">Что можно писать в файле: <code data-noi18n>id, label, areas[]</code>; у зоны — <code data-noi18n>label, note, c (цвет), x, y, w, h (доли 0…1), corner (где подпись: tl top tr l c r bl bot br), kinds (video, image, audio, text), panel (script, assistant, radio, maestro), montage, fs (размер подписи)</code>.</div>
    <div class="acts"><button type="button" class="btn ghost" data-close>Закрыть</button><button type="button" class="btn primary" data-wsave>💾 Сохранить текущую туда</button></div>`, null, { onClick: e => { if (e.target.closest('[data-wsave]')) { closeSheet(); saveLayoutFile(); } } });
}
function demoStudios() {
  histPush('студии на клавиши');
  const ids = ['3x3', 'studio', 'bottomcut', 'simple', 'free'];
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB'].forEach((code, i) => { S.keymap[code] = 'layout:' + ids[i]; });
  S.cfg.pianoRows = Math.max(3, S.cfg.pianoRows || 1); S.cfg.rowLen = { ...(S.cfg.rowLen || {}), 2: 5 };
  if (S.cfg.rowsHidden) S.cfg.rowsHidden[2] = false;
  save(); renderPiano(); renderBuild();
  toast('▦ На Z X C V B — пять студий: Режиссёрская, Студия, Монтаж внизу, Новичок и пустая для сборки. Ctrl+Z — отменить.');
}

/* ---------- палитра: тащим блок на стол ---------- */
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('#tabBuild .blk'); if (!el || e.button !== 0) return;
  e.preventDefault();
  const b = BLOCKS.find(x => x.t === el.dataset.blk); if (!b) return;
  const g = document.createElement('div'); g.className = 'blk-ghost'; g.style.setProperty('--c', b.c); g.innerHTML = `<i>${b.icon}</i>${esc(b.label)}`; document.body.appendChild(g);
  const mv = ev => { g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px'; }; mv(e);
  const up = ev => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); g.remove();
    const br = board.getBoundingClientRect();
    if (ev.clientX < br.left || ev.clientX > br.right || ev.clientY < br.top || ev.clientY > br.bottom || ev.target.closest?.('#right')) return;
    const [lx, ly] = toLogical(ev.clientX, ev.clientY);
    addBlock(b, lx / W, ly / H);
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
});
/* ---------- двигаем и растягиваем зоны прямо на столе ---------- */
{ const _ra2 = renderAreas; renderAreas = function () {
  const r = _ra2.apply(this, arguments);
  $$('.area', areasEl).forEach(el => {
    const a = areasOf().find(x => x.id === el.dataset.area); if (!a) return;
    if (a.fs && a.fs !== 1) el.style.setProperty('--fs', a.fs);
    if (!el.querySelector('.rz')) el.insertAdjacentHTML('beforeend', '<i class="rz" title="Растянуть"></i>');
    el.classList.toggle('bsel', a.id === buildSel);
  });
  return r;
}; }
areasEl.addEventListener('pointerdown', e => {
  if (!document.body.classList.contains('build-mode') || e.button !== 0) return;
  const el = e.target.closest('.area'); if (!el || e.target.closest('.zgear')) return;
  e.preventDefault(); e.stopPropagation();
  const L = editableLayout(); if (!L) return;
  const id = el.dataset.area; buildSel = id; renderBuild();
  const a = L.areas.find(x => x.id === id); if (!a) { relayout(); return; }
  const resize = !!e.target.closest('.rz');
  const [sx, sy] = toLogical(e.clientX, e.clientY), a0 = { ...a };
  let moved = false, pushed = false;
  $$('.area', areasEl).forEach(x => x.classList.toggle('bsel', x.dataset.area === id));
  const mv = ev => {
    const [x, y] = toLogical(ev.clientX, ev.clientY), dx = (x - sx) / W, dy = (y - sy) / H;
    if (!moved && Math.hypot(x - sx, y - sy) < 4) return;
    if (!pushed) { histPush(resize ? 'размер зоны' : 'перемещение зоны'); pushed = true; }
    moved = true;
    const snap = v => Math.round(v * 200) / 200; // шаг 0,5% — зоны легко встают ровно
    if (resize) { a.w = snap(Math.max(.08, Math.min(1 - a.x, a0.w + dx))); a.h = snap(Math.max(.08, Math.min(1 - a.y, a0.h + dy))); }
    else { a.x = snap(Math.max(0, Math.min(1 - a.w, a0.x + dx))); a.y = snap(Math.max(0, Math.min(1 - a.h, a0.y + dy))); }
    const r = areaRect(a); el.style.left = (r.x + 4) + 'px'; el.style.top = (r.y + 4) + 'px'; el.style.width = (r.w - 8) + 'px'; el.style.height = (r.h - 8) + 'px';
  };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) { save(); relayout(); } renderBuild(); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}, true);

/* шторки: два вида — линии или голограмма Маэстро */
{ const r = $('#rest'); if (r) r.insertAdjacentHTML('afterbegin', '<div class="rest-beam"></div><div class="rest-orb"></div>'); }
{ const _or = openRest; openRest = function () { $('#rest')?.classList.toggle('rmaestro', S.cfg.restStyle === 'maestro'); return _or.apply(this, arguments); }; }
$('#btnRest').onclick = () => openRest();
// пунктир контура зоны: подгоняем шаг под длину линии, чтобы в месте стыка не было двух штрихов рядом
{ const _ra3 = renderAreas; renderAreas = function () {
  const r = _ra3.apply(this, arguments);
  $$('.aline .dash', areaLinesEl).forEach(p => { try { const L = p.getTotalLength(); if (!L) return; const n = Math.max(4, Math.round(L / 10)), per = L / n; p.style.strokeDasharray = `${(per * .3).toFixed(3)} ${(per * .7).toFixed(3)}`; } catch (_) { } });
  return r;
}; }

// пустая чёрная клавиша: вместо «—» — ничего, остаётся только буква
{ const _rp4 = renderPiano; renderPiano = function () { _rp4.apply(this, arguments); $$('.bk[data-bind] .t', piano).forEach(t => { if (t.textContent.trim() === '—') { t.textContent = ''; t.closest('.bk').classList.add('empty'); } }); }; }
