/* Director's Table — «Маэстро»: сфера между сценарием и монтажом. Нажал — голограмма с пресетами
   (камера, эффекты, синема, время, план). Пресет = проверенная заготовка промпта (+ эффект-черновик кодом, + настройки).
   Пресет цепляется к виджету (значок на виджете) и при запуске склеивается с вашим промптом.
   Пресеты — JSON в presets/ и в ComfyUI/user/directors-table/presets: свои может добавить кто угодно. */
'use strict';
let PRE = { categories: [], presets: [] };
const preById = id => PRE.presets.find(p => p.id === id);
const catById = id => PRE.categories.find(c => c.id === id);
async function loadPresets() {
  try { PRE = await API.json('/directors-table/api/presets'); } catch (_) { }
  PRE.presets = (PRE.presets || []).filter(p => p && SAFE_ID.test(String(p.id)) && typeof p.prompt === 'string');
  PRE.categories = (PRE.categories || []).filter(c => c && SAFE_ID.test(String(c.id)));
}
loadPresets();

/* ---------- пресеты на виджете ---------- */
// на виджете — максимум один пресет каждой категории (камера + синема + эффект можно вместе)
function attachPreset(w, pid, quiet) {
  const p = preById(pid); if (!w || !p) return;
  w.presets = (w.presets || []).filter(id => preById(id)?.cat !== p.cat);
  w.presets.push(pid);
  save(); updCard(w); flashCard(w.id);
  if (!quiet) toast(`${esc(p.icon || '✦')} <b>${esc(p.title)}</b> → «${esc(wfById(w.wf)?.title || '')}». При запуске добавится к вашему промпту.`);
}
function detachPreset(w, pid) { w.presets = (w.presets || []).filter(x => x !== pid); save(); updCard(w); toast('Пресет снят.'); }
function presetBadges(w) {
  const list = (w.presets || []).map(preById).filter(Boolean);
  return list.length ? `<span class="pbadges">${list.map(p => `<span class="pb" data-pdel="${esc(p.id)}" title="${esc(p.title)} — клик, чтобы снять">${esc(p.icon || '✦')}</span>`).join('')}</span>` : '';
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-pdel]'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  const w = byId(+b.closest('.card')?.dataset.id); if (w) detachPreset(w, b.dataset.pdel);
}, true);
/* «в руке»: пресет выбран, а виджет ещё нет — применится к следующему запуску */
let ARMED = [];
function armPreset(pid) {
  const p = preById(pid); if (!p) return;
  ARMED = ARMED.filter(id => preById(id)?.cat !== p.cat).concat(pid);
  renderArmed();
  toast(`${esc(p.icon)} <b>${esc(p.title)}</b> в руке — выделите виджет и запустите, или перетащите пресет на виджет.`);
}
function renderArmed() {
  let el = $('#armed');
  if (!ARMED.length) { el && el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'armed'; document.body.appendChild(el); }
  el.innerHTML = `<span>В руке:</span>${ARMED.map(id => { const p = preById(id); return p ? `<b>${esc(p.icon)} ${esc(p.title)}</b>` : ''; }).join('')}<button type="button" data-unarm title="Сбросить">×</button>`;
}
document.addEventListener('click', e => { if (e.target.closest('[data-unarm]')) { ARMED = []; renderArmed(); } });

/* склейка промпта при запуске */
function composePrompt(presets, text) {
  let out = String(text || '').trim();
  const order = ['char', 'shot', 'lens', 'camera', 'time', 'light', 'cinema', 'color', 'genre', 'fx'];
  [...presets].sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat)).forEach(p => {
    const tpl = p.prompt.includes('{prompt}') ? p.prompt : '{prompt}. ' + p.prompt;
    out = tpl.replace('{prompt}', (out || p.fallback || 'A cinematic scene').replace(/[\s.,;]+$/, '')).replace(/^\.\s*/, '');
  });
  return out;
}
const _runJobBase = runJob;
runJob = async function (src, wf, vals, opts = {}) {
  const sheetId = src ? src.sheet : S.sheet;
  const w = S.cards.find(c => c.type === 'widget' && c.sheet === sheetId && c.wf === wf.id);
  if (ARMED.length && w) { ARMED.forEach(id => attachPreset(w, id, true)); ARMED = []; renderArmed(); }
  const list = (w?.presets || []).map(preById).filter(Boolean);
  if (!list.length) return _runJobBase(src, wf, vals, opts);
  const clean = { ...vals }, v2 = { ...vals };
  const pp = promptParam(wf);
  if (pp) v2[pp.id] = composePrompt(list, vals[pp.id]);
  const neg = (wf.params || []).find(p => p.type === 'text' && (p.role === 'neg' || /neg/i.test(p.id)));
  const negAdd = list.map(p => p.neg).filter(Boolean).join(', ');
  if (neg && negAdd) v2[neg.id] = [vals[neg.id], negAdd].filter(Boolean).join(', ');
  // эффект-черновик кодом: если это VFX-виджет — выбираем нужный эффект
  const fxp = list.find(p => p.vfx), effP = (wf.params || []).find(p => p.id === 'effect' && p.type === 'select');
  if (fxp && effP) { const i = effP.options.findIndex(o => o.value === fxp.vfx); if (i >= 0) v2.effect = i; }
  const lp = (wf.params || []).find(p => p.targets?.some(t => t.transform === 'frames'));
  list.forEach(p => { if (p.seconds && lp) v2[lp.id] = p.seconds; });
  const job = await _runJobBase(src, wf, v2, { ...opts, presets: list.map(p => p.id) });
  S.lastParams[wf.id] = clean; // в памяти — ваш текст без заготовок, чтобы они не копились
  return job;
};

/* ---------- сфера ---------- */
const orb = document.createElement('button');
orb.type = 'button'; orb.id = 'maestroOrb'; orb.title = 'Маэстро — пресеты: камера, эффекты, синема (Tab)';
orb.innerHTML = '<span class="orb-core"></span><span class="orb-slit"></span><span class="orb-label">Маэстро</span>';
canvasEl.appendChild(orb);
function placeOrb() {
  const areas = areasOf(S.sheet), sc = areas.find(a => a.id === 'script'), cut = areas.find(a => a.montage);
  let x = W / 2, y;
  if (sc && cut) { const r = areaRect(sc), c = areaRect(cut); x = r.x + r.w / 2; y = (r.y + r.h + c.y) / 2 - 2; }
  else if (cut) { const c = areaRect(cut); x = c.x + c.w / 2; y = c.y - 4; }
  else y = 56;
  orb.style.left = x + 'px'; orb.style.top = y + 'px';
}
const _renderBase = render;
render = function (...a) { _renderBase(...a); placeOrb(); };
placeOrb();

/* ---------- голограмма ---------- */
const holo = document.createElement('div');
holo.id = 'maestro'; holo.hidden = true;
holo.innerHTML = `<div class="mh-beam"><i></i><i></i><i></i></div><div class="mh-scan"></div>
  <div class="mh-top"><span class="mh-title">МАЭСТРО</span><span class="mh-path" id="mhPath"></span><button type="button" class="mh-dir" data-mh="dir" title="Куда раскрывается голограмма: вверх / вниз / на весь экран">⇅</button><button type="button" class="mh-x" data-mh="close" title="Закрыть (Tab / Esc)">×</button></div>
  <div class="mh-stage"><button type="button" class="mh-nav l" data-mh="prev">‹</button><div class="mh-ring" id="mhRing"></div><button type="button" class="mh-nav r" data-mh="next">›</button></div>
  <div class="mh-hint" id="mhHint"></div>`;
document.body.appendChild(holo);
const MH = { level: 'cats', cat: null, sub: null, rot: 0, items: [] };
// подгруппы эффектов: рабочие (кино, реклама, переходы…) отдельно от «соцсетевых» сердечек
const FX_SUBS = [{ id: 'cine', title: 'Кино и экшн', icon: '🎬', about: 'взрывы, удары, огонь, искры' }, { id: 'atmo', title: 'Атмосфера и погода', icon: '🌩', about: 'гроза, дождь, туман, ветер' }, { id: 'ads', title: 'Реклама и продукт', icon: '🛍', about: 'брызги, блик, пар, появление' }, { id: 'trans', title: 'Переходы', icon: '🔀', about: 'вспышка, рывок, глитч, чернила' }, { id: 'fantasy', title: 'Фэнтези и мульт', icon: '🪄', about: 'молнии из рук, портал, аура' }, { id: 'social', title: 'Для соцсетей', icon: '💖', about: 'сердечки, блёстки, лепестки' }];
function maestroOpen(cat) {
  if (!PRE.presets.length) loadPresets().then(() => { if (!holo.hidden) mhDraw(); });
  holo.hidden = false; holo.classList.remove('out'); void holo.offsetWidth; holo.classList.add('in');
  const r = orb.getBoundingClientRect(); holo.style.setProperty('--ox', (r.left + r.width / 2) + 'px'); holo.style.setProperty('--oy', (r.top + r.height / 2) + 'px');
  holo.dataset.dir = S.cfg.holoDir || 'up';
  // вверх: карточки встают над сферой, сколько бы места ни было (луч тянется от сферы к ним)
  const oy = r.top + r.height / 2, stH = Math.min(330, Math.max(260, oy - 40));
  holo.style.setProperty('--stTop', Math.max(44, oy - stH - 30) + 'px'); holo.style.setProperty('--stH', stH + 'px');
  holo.style.setProperty('--beamH', Math.max(120, oy - Math.max(44, oy - stH - 30) - stH / 2) + 'px');
  MH.level = cat ? 'presets' : 'cats'; MH.cat = cat || null; MH.sub = null; MH.rot = 0;
  orb.classList.add('on'); mhDraw();
}
function maestroClose() {
  if (holo.hidden) return;
  holo.classList.remove('in'); holo.classList.add('out'); orb.classList.remove('on');
  setTimeout(() => { if (holo.classList.contains('out')) holo.hidden = true; }, 260);
}
const maestroToggle = () => holo.hidden ? maestroOpen() : maestroClose();
function mhDraw() {
  const ring = $('#mhRing');
  const inCat = PRE.presets.filter(p => p.cat === MH.cat);
  const subsView = MH.level === 'presets' && !MH.sub && inCat.some(p => p.sub) && FX_SUBS.some(s => inCat.some(p => p.sub === s.id));
  MH.items = MH.level === 'cats' ? PRE.categories.map(c => ({ kind: 'cat', ...c, count: PRE.presets.filter(p => p.cat === c.id).length }))
    : subsView ? FX_SUBS.map(s => ({ kind: 'sub', ...s, count: inCat.filter(p => p.sub === s.id).length })).filter(s => s.count).concat(inCat.some(p => !p.sub || !FX_SUBS.some(s => s.id === p.sub)) ? [{ kind: 'sub', id: '_other', title: 'Свои', icon: '✦', about: 'ваши пресеты', count: inCat.filter(p => !p.sub || !FX_SUBS.some(s => s.id === p.sub)).length }] : [])
    : inCat.filter(p => !MH.sub || (MH.sub === '_other' ? !p.sub || !FX_SUBS.some(s => s.id === p.sub) : p.sub === MH.sub)).map(p => ({ kind: 'preset', ...p }));
  const grid = MH.level === 'cats' || subsView;
  const n = Math.max(MH.items.length, 1);
  const step = grid ? Math.min(40, 360 / Math.max(n, 9)) : Math.min(24, 300 / n);
  MH.step = step;
  if (MH.rot === 0 && n % 2 === 0) MH.rot = step / 2; // при чётном числе карточек — одна строго по центру
  const R = grid ? 560 : 820;
  ring.style.setProperty('--R', R + 'px');
  ring.innerHTML = MH.items.map((it, i) => `<div class="mh-card${it.kind !== 'preset' ? ' cat' : ''}" data-i="${i}" style="--a:${(i - (n - 1) / 2) * step}deg;--d:${i * 40}ms">
      <span class="mh-ic a-${esc(it.anim || 'pulse')}">${esc(it.icon || '✦')}</span><b>${esc(it.title)}</b><small>${esc(it.about || '')}</small>${it.kind !== 'preset' ? `<em>${it.count}</em>` : (it.vfx ? '<em title="эффект рисуется кодом и ведёт LTX точнее">код</em>' : '')}</div>`).join('');
  mhRotate(0);
  $('#mhPath').innerHTML = MH.level === 'cats' ? '' : `<button type="button" data-mh="back">‹ ${MH.sub ? esc(T(catById(MH.cat)?.title || '')) : esc(T('Категории'))}</button><span>${esc(T(catById(MH.cat)?.title || ''))}${MH.sub ? ' · ' + esc(T((FX_SUBS.find(x => x.id === MH.sub) || { title: 'Свои' }).title)) : ''}</span>`;
  const selW = [...sel].map(byId).filter(c => c?.type === 'widget');
  $('#mhHint').innerHTML = subsView ? 'Выберите группу эффектов · колесо мыши — крутить' : MH.level === 'cats' ? 'Выберите раздел · колесо мыши — крутить · категорию можно перетащить на клавишу'
    : (selW.length ? `<span data-noi18n>${esc(T('Клик — добавить к виджету'))} «${esc(wfById(selW[0].wf)?.title || '')}» · ${esc(T('или тащите на любой виджет / клавишу'))}</span>` : 'Клик — взять в руку · перетащите на виджет или на клавишу пианино');
}
function mhRotate(d) {
  const n = MH.items.length; if (!n) return;
  const max = (n - 1) / 2 * MH.step;
  // по кругу: дальше последней карточки — снова первая, назад от первой — последняя
  const t = MH.rot + d, eps = MH.step / 4;
  MH.rot = d && t > max + eps ? -max : d && t < -max - eps ? max : Math.max(-max, Math.min(max, t));
  $('#mhRing').style.setProperty('--rot', (-MH.rot) + 'deg');
  $$('#mhRing .mh-card').forEach((el, i) => { const a = (i - (n - 1) / 2) * MH.step - MH.rot; el.classList.toggle('front', Math.abs(a) < MH.step / 2); el.style.setProperty('--fade', Math.max(.25, 1 - Math.abs(a) / 70)); });
}
holo.addEventListener('wheel', e => { e.preventDefault(); mhRotate((e.deltaY + e.deltaX) > 0 ? MH.step : -MH.step); }, { passive: false });
holo.addEventListener('click', e => {
  const a = e.target.closest('[data-mh]')?.dataset.mh;
  if (a === 'close') return maestroClose();
  if (a === 'dir') { const order = ['up', 'down', 'full']; S.cfg.holoDir = order[(order.indexOf(S.cfg.holoDir || 'up') + 1) % 3]; save(); holo.dataset.dir = S.cfg.holoDir; toast('Голограмма: ' + ({ up: 'вверх', down: 'вниз', full: 'на весь экран' })[S.cfg.holoDir]); return; }
  if (a === 'back') { if (MH.sub) MH.sub = null; else MH.level = 'cats'; MH.rot = 0; return mhDraw(); }
  if (a === 'prev') return mhRotate(-MH.step);
  if (a === 'next') return mhRotate(MH.step);
  if (MH.dragged) { MH.dragged = false; return; }
  const card = e.target.closest('.mh-card');
  if (!card) { if (e.target === holo || e.target.classList.contains('mh-stage')) maestroClose(); return; }
  const it = MH.items[+card.dataset.i]; if (!it) return;
  if (it.kind === 'cat') { MH.level = 'presets'; MH.cat = it.id; MH.sub = null; MH.rot = 0; return mhDraw(); }
  if (it.kind === 'sub') { MH.sub = it.id; MH.rot = 0; return mhDraw(); }
  usePreset(it.id);
});
function usePreset(pid) {
  const ws = [...sel].map(byId).filter(c => c?.type === 'widget');
  if (ws.length) { ws.forEach(w => attachPreset(w, pid)); ARMED = ARMED.filter(x => x !== pid); renderArmed(); maestroClose(); }
  else { armPreset(pid); maestroClose(); }
}
/* перетаскивание карточки из голограммы: на виджет — прицепить, на клавишу — назначить */
holo.addEventListener('pointerdown', e => {
  const card = e.target.closest('.mh-card'); if (!card || e.button !== 0) return;
  const it = MH.items[+card.dataset.i]; if (!it) return;
  e.preventDefault(); // без выделения текста на столе при перетаскивании
  const x0 = e.clientX, y0 = e.clientY; let ghost = null;
  const move = ev => {
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
    if (!ghost) { ghost = document.createElement('div'); ghost.className = 'mh-ghost'; ghost.innerHTML = `${esc(it.icon)} ${esc(it.title)}`; document.body.appendChild(ghost); holo.classList.add('dragging'); }
    ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
    const t = mhTargetAt(ev.clientX, ev.clientY);
    $$('.mh-hot').forEach(x => x.classList.remove('mh-hot')); if (t) t.el.classList.add('mh-hot');
  };
  const up = ev => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    $$('.mh-hot').forEach(x => x.classList.remove('mh-hot'));
    if (!ghost) return;
    ghost.remove(); holo.classList.remove('dragging'); MH.dragged = true;
    const t = mhTargetAt(ev.clientX, ev.clientY); if (!t || it.kind === 'sub') return;
    const val = it.kind === 'cat' ? 'maestro:c:' + it.id : 'maestro:p:' + it.id;
    if (t.type === 'widget' && it.kind === 'preset') { attachPreset(t.w, it.id); maestroClose(); }
    else if (t.type === 'busy') toast('На этой клавише сцена. Положите пресет на пустую белую клавишу «+», на чёрную или на нижние ряды.');
    else if (t.type === 'key') bindKeySafe(t.code, val, it.icon + ' ' + it.title);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
});
function mhTargetAt(x, y) {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (el.closest('#maestro') && !el.closest('.mh-ghost')) continue;
    const w = el.closest('.card.widget'); if (w) return { type: 'widget', el: w, w: byId(+w.dataset.id) };
    const k = el.closest('[data-bind]'); if (k) return { type: 'key', el: k, code: k.dataset.bind };
    const nk = el.closest('.key[data-new]'); if (nk) return { type: 'key', el: nk, code: WHITE[+nk.dataset.new] };
    const sk = el.closest('.key[data-sheet]'); if (sk) return { type: 'key', el: sk, code: WHITE[+sk.dataset.i] };
  }
  return null;
}
/* сферу саму можно перетащить на клавишу — клавиша будет открывать Маэстро */
orb.addEventListener('pointerdown', e => {
  if (e.button !== 0) return; e.stopPropagation();
  const x0 = e.clientX, y0 = e.clientY; let drag = false, ghost = null;
  const move = ev => {
    if (!drag && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { drag = true; ghost = document.createElement('div'); ghost.className = 'mh-ghost'; ghost.textContent = '◉ Маэстро'; document.body.appendChild(ghost); }
    if (drag) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
  };
  const up = ev => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    if (!drag) return maestroToggle();
    ghost.remove();
    const t = mhTargetAt(ev.clientX, ev.clientY);
    if (t?.type === 'key') bindKeySafe(t.code, 'maestro:all', '◉ Маэстро');
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
});

/* ---------- клавиши ---------- */
const _bindActionBase = bindAction;
bindAction = function (v) {
  if (typeof v === 'string' && v.startsWith('maestro:')) {
    const [, t, id] = v.split(':');
    if (t === 'all') return { id: v, title: '◉ Маэстро', kind: 'fx', maestro: { all: true } };
    if (t === 'c') { const c = catById(id); return { id: v, title: (c?.icon || '◉') + ' ' + (c?.title || id), kind: 'fx', maestro: { cat: id } }; }
    if (t === 'p') { const p = preById(id); return { id: v, title: (p?.icon || '✦') + ' ' + (p?.title || id), kind: 'fx', maestro: { preset: id } }; }
  }
  return _bindActionBase(v);
};
const _runBindingBase = runBinding;
runBinding = function (code, cards) {
  const a = bindAction(bindingTarget(code)[code]);
  if (a?.maestro) {
    if (a.maestro.all) return maestroToggle();
    if (a.maestro.cat) return maestroOpen(a.maestro.cat);
    if (a.maestro.preset) return usePreset(a.maestro.preset);
  }
  return _runBindingBase(code, cards);
};
window.addEventListener('keydown', e => {
  const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  if (e.key === 'Tab' && !typing && sheetBack.hidden && !e.ctrlKey && !e.altKey) { e.preventDefault(); maestroToggle(); return; }
  if (e.key === 'Escape' && !holo.hidden) { e.stopImmediatePropagation(); maestroClose(); }
}, true);

/* ---------- голос: «маэстро, огонь, LTX 2.3: девушка идёт по пляжу» ---------- */
function maestroVoice(text) {
  const raw = String(text || '').trim();
  const m = raw.match(/^(?:маэстро|maestro|маестро)[\s,:—-]*(.*)$/i); if (!m) return false;
  let rest = m[1].trim();
  if (!rest) { maestroOpen(); reply('Маэстро открыт — выберите пресет.'); return true; }
  const low = rest.toLowerCase();
  // пресеты, названные в начале фразы (до двоеточия)
  const head = low.split(':')[0];
  const found = PRE.presets.filter(p => head.includes(p.title.toLowerCase()) || head.includes(p.id.split('-').pop()));
  const cat = !found.length ? PRE.categories.find(c => head.trim() === c.title.toLowerCase()) : null;
  if (cat) { maestroOpen(cat.id); reply(`Открыл раздел «${esc(cat.title)}».`); return true; }
  // виджет по имени
  const ws = S.cards.filter(c => c.type === 'widget' && c.sheet === S.sheet && wfById(c.wf));
  const w = typeof matchWidgetByVoice === 'function' ? matchWidgetByVoice(head, ws) : ws.find(c => head.includes(wfById(c.wf).title.toLowerCase()));
  const prompt = rest.includes(':') ? rest.slice(rest.indexOf(':') + 1).trim() : (found.length ? '' : rest);
  if (!found.length && !w) { maestroOpen(); reply('Не нашёл такой пресет — открыл Маэстро, выберите рукой.'); return true; }
  const target = w || ws.find(c => c.id === [...sel].find(id => byId(id)?.type === 'widget')) || ws.find(c => wfById(c.wf).kind === 'video');
  if (!target) { found.forEach(p => armPreset(p.id)); reply('Пресет в руке — добавьте видео-виджет на стол.'); return true; }
  found.forEach(p => attachPreset(target, p.id, true));
  const wf = wfById(target.wf);
  reply(`${found.map(p => esc(p.icon + ' ' + p.title)).join(' + ')} → «${esc(wf.title)}»${prompt ? '' : '. Скажите или впишите, что происходит в кадре.'}`);
  const files = [...sel].map(byId).filter(c => c && c.type === 'file');
  const src = files.length ? files : (byId(target.lastInput) && !(target.unlinked || []).includes(target.lastInput) ? [byId(target.lastInput)] : []);
  dispatch(src, wf, { ask: true, params: prompt ? { __prompt: prompt } : {} });
  return true;
}
const _runCommandBase = runCommand;
runCommand = function (text, o) { if (maestroVoice(text)) return 'maestro'; return _runCommandBase(text, o); };
