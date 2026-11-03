/* Director's Table v0.23 — правки по тестам 27.10: закрепление панелей, круговое меню, очистка стола и плана и др.
   Подключается последним. */
'use strict';
let keyMoveFrom = null; // перестановка сцены на другую клавишу (см. ниже)

/* ---------- круговое меню: правый клик или уход мышкой далеко — закрыть ---------- */
let radialClosedAt = 0, radialAwayT = null;
{ const _cr = closeRadial; closeRadial = function (commit) { if (M) radialClosedAt = Date.now(); clearTimeout(radialAwayT); return _cr.apply(this, arguments); }; }
let radialOpenedAt = 0;
{ const _or = openRadial; openRadial = function () { radialOpenedAt = Date.now(); return _or.apply(this, arguments); }; }
// меню браузера не показываем, пока открыто круговое (и сразу после него); второй правый клик — закрыть
window.addEventListener('contextmenu', e => { if (M || Date.now() - radialClosedAt < 400) e.preventDefault(); }, true);
window.addEventListener('pointerdown', e => { if (M && e.button === 2 && Date.now() - radialOpenedAt > 250) { e.preventDefault(); e.stopPropagation(); closeRadial(false); } }, true);
window.addEventListener('pointermove', () => {
  if (!M) return;
  if (M.away) { if (!radialAwayT) radialAwayT = setTimeout(() => { radialAwayT = null; if (M && M.away) closeRadial(false); }, 600); }
  else { clearTimeout(radialAwayT); radialAwayT = null; }
});

/* ---------- панели: одно правило. Навели — выехала поверх стола; клик по пустому месту панели — закрепить,
   ещё клик — открепить. Закреплённая панель не перекрывает стол: стол ужимается рядом с ней. ---------- */
const INTERACTIVE = 'button, input, select, textarea, a, label, video, audio, img, canvas, summary, [contenteditable], [draggable="true"], [data-id], [data-act], [data-i], [data-k], [role="button"], .resize, .chip, .card, .pin';
function syncPins() {
  const L = $('#left'), R = $('#right'), T = $('#top');
  document.body.classList.toggle('pin-left', !!L?.classList.contains('pinned'));
  document.body.classList.toggle('pin-right', !!R?.classList.contains('pinned'));
  const top = !!T?.classList.contains('open');
  document.body.classList.toggle('pin-top', top);
  document.body.classList.toggle('pin-push', S.cfg.pinMode !== 'overlay');
  if (top) { const tm = $('#topMore'); const m = () => document.documentElement.style.setProperty('--tm-h', (tm ? tm.getBoundingClientRect().height : 0) + 'px'); m(); setTimeout(m, 320); } // меряем после раскрытия
}
function togglePin(name) {
  const el = name === 'top' ? $('#top') : $('#' + name); if (!el) return;
  if (name === 'top') { el.classList.toggle('open'); S.cfg.pin_top = el.classList.contains('open'); }
  else { const p = !el.classList.contains('pinned'); el.classList.toggle('pinned', p); S.cfg['pin_' + name] = p; }
  save(); syncPins();
  const on = name === 'top' ? S.cfg.pin_top : S.cfg['pin_' + name];
  toast(on ? 'Панель закреплена. Клик по пустому месту панели — открепить.' : 'Панель откреплена — выезжает при наведении.');
}
for (const name of ['left', 'right']) {
  const body = $('#' + name + ' .edge-body'); if (!body) continue;
  body.addEventListener('click', e => { if (e.target.closest(INTERACTIVE) || String(getSelection() || '')) return; togglePin(name); });
}
// верхняя панель: старые обработчики на #mini и #conn меняем на общее правило (клик по пустому месту плашки тоже)
{ const tm = $('#topMore'); tm && tm.addEventListener('click', e => { if (!e.target.closest(INTERACTIVE)) togglePin('top'); }); }
['#mini', '#conn'].forEach(sel => $(sel)?.addEventListener('click', e => { if (e.target.closest('button, a, input, select')) return; togglePin('top'); }));
if (S.cfg.pin_top) $('#top')?.classList.add('open');
new MutationObserver(syncPins).observe($('#left'), { attributes: true, attributeFilter: ['class'] });
new MutationObserver(syncPins).observe($('#right'), { attributes: true, attributeFilter: ['class'] });
new MutationObserver(syncPins).observe($('#top'), { attributes: true, attributeFilter: ['class'] });
syncPins();

/* ---------- Ctrl+Z шире: клавиши, сцены, группы, план и убранные со стола карточки ---------- */
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
{ const _snap = histSnap, _apply = histApply;
  histSnap = function () {
    const cards = _snap();
    cards.full = S.cards.filter(c => c.type === 'file' || c.type === 'widget').map(c => { const x = { ...c }; delete x.preview; return x; });
    cards.extra = { keymap: clone(S.keymap), favs: clone(S.favs), sheets: clone(S.sheets), groups: clone(S.groups), plan: clone(S.plan), sheet: S.sheet };
    return cards;
  };
  histApply = function (snap) {
    if (snap.full) { const have = new Set(S.cards.map(c => c.id)); for (const c of snap.full) if (!have.has(c.id)) S.cards.push((c.status === 'running' || c.status === 'queued') ? { ...c, status: 'error', error: 'Отменено при удалении', stopped: true, errSeen: true } : { ...c }); } // вернуть убранное
    if (snap.extra) { const e = snap.extra; S.keymap = e.keymap || {}; S.favs = e.favs || {}; S.sheets = e.sheets || S.sheets; S.groups = e.groups || []; if (e.plan) S.plan = e.plan; if (S.sheets.some(s => s.id === e.sheet)) S.sheet = e.sheet; }
    _apply(snap); renderPiano(); if (typeof renderRight === 'function' && $('#right')?.matches('.open, .pinned')) renderRight(); fillPanels?.();
  };
}

/* ---------- назначение на клавишу: на занятую — с вопросом «Заменить?», сцену можно переселить ---------- */
function keyLabelOf(code) { const a = bindAction(bindingTarget(code)[code]); return a ? a.title : ''; }
function bindKeySafe(code, val, title, done) {
  const wi = WHITE.indexOf(code), sh = wi >= 0 ? sheetAtKey(wi) : null;
  const cur = keyLabelOf(code);
  const doBind = () => { histPush('клавиша ' + codeLabel(code)); bindingTarget(code)[code] = val; save(); renderPiano(); toast(`Клавиша <b>${codeLabel(code)}</b> → «${esc(title)}». Ctrl+Z — отменить.`); done && done(); };
  if (sh) {
    const free = freeWhite();
    if (free < 0) return toast(`На клавише ${codeLabel(code)} сцена «${esc(sh.name)}», а свободных белых клавиш нет — некуда её переселить.`);
    return sheetOpen(`<h3>Клавиша ${codeLabel(code)} занята сценой</h3><div class="sub">Там сцена «<b data-noi18n>${esc(sh.name)}</b>». Переселить её на клавишу <b>${codeLabel(WHITE[free])}</b> (файлы сцены не трогаются) и поставить сюда «${esc(title)}»?</div><div class="acts"><button type="button" class="btn ghost" data-close>Нет</button><button class="btn primary">Переселить и поставить</button></div>`,
      () => { histPush('клавиша ' + codeLabel(code)); sh.key = free; bindingTarget(code)[code] = val; save(); renderPiano(); toast(`Сцена «${esc(sh.name)}» теперь на <b>${codeLabel(WHITE[free])}</b>, на ${codeLabel(code)} — «${esc(title)}».`); done && done(); });
  }
  if (cur && bindingTarget(code)[code] !== val) return sheetOpen(`<h3>Заменить клавишу ${codeLabel(code)}?</h3><div class="sub">Сейчас там «<b data-noi18n>${esc(cur)}</b>». Поставить вместо неё «${esc(title)}»?</div><div class="acts"><button type="button" class="btn ghost" data-close>Нет</button><button class="btn primary">Заменить</button></div>`, doBind);
  doBind();
}

/* ---------- 🧹 Очистить стол: файлы и результаты уходят со стола (на диске и во «Выводе» остаются), Ctrl+Z — вернуть ---------- */
{ const _snap = histSnap, _apply = histApply;
  histSnap = function () { const s = _snap(); s.park = S.cards.map(c => [c.id, !!c.parked, c.cleared || 0]); return s; };
  histApply = function (snap) { if (snap.park) { const m = new Map(snap.park.map(x => [x[0], x])); for (const c of S.cards) { const x = m.get(c.id); if (x) { c.parked = x[1]; c.cleared = x[2] || undefined; } } } return _apply(snap); };
}
function sceneLocked(id = S.sheet) { return !!S.sheets.find(s => s.id === id)?.closed; }
function clearDesk(withWidgets = false) {
  if (sceneLocked()) return toast('Сцена закрыта на замок — очистка недоступна.');
  const busy = c => c.status === 'running' || c.status === 'queued' || c.status === 'uploading';
  const list = visibleCards().filter(c => !busy(c) && (c.type === 'file' || (withWidgets && c.type === 'widget' && !jobsOf(c).some(busy))));
  if (!list.length) return toast('На столе нечего убирать.');
  histPush('очистка стола');
  const t = Date.now();
  const wids = new Set(list.filter(c => c.type === 'widget').map(c => c.id));
  for (const c of list) { c.parked = true; c.cleared = t; }
  for (const c of S.cards) if (c.owner && wids.has(c.owner)) { c.parked = true; c.cleared = t; }
  sel.clear(); save(); render();
  toast(`🧹 Стол очищен: ${list.length}. Файлы на диске и во «Выводе». Ctrl+Z — вернуть.`, { label: '↶ Вернуть', fn: () => histUndo() });
}
board.addEventListener('contextmenu', e => {
  if (e.target.closest('.card, .zone-panel, .edge, #maestro, .orb, #piano') || M) return;
  e.preventDefault();
  const a = document.createElement('div'); a.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY + 14}px;width:1px;height:1px`; document.body.appendChild(a);
  popAt(a, `<div class="bmenu"><button type="button" data-bm="clear">🧹 Очистить стол <small>файлы и результаты</small></button><button type="button" data-bm="all">🧹 Очистить всё <small>вместе с виджетами</small></button></div>`, pop => {
    a.remove();
    pop.onclick = ev => { const b = ev.target.closest('[data-bm]'); if (!b) return; closePop(); clearDesk(b.dataset.bm === 'all'); };
  });
});

/* ---------- значки пресетов на карточке результата: сразу видно, с чем делалось ---------- */
{ const _fh = fileHTML; fileHTML = function (c) {
  let h = _fh(c);
  const ps = (c.presets || []).map(id => typeof preById === 'function' ? preById(id) : null).filter(Boolean);
  if (ps.length) h = h.replace('</div><div class="cap">', `<span class="rpb" title="Пресеты: ${esc(ps.map(p => p.title).join(', '))}">${ps.map(p => esc(p.icon || '✦')).join('')}</span></div><div class="cap">`);
  return h;
}; }
{ const _sig = sigOf; sigOf = function (c) { return _sig(c) + (c.type === 'file' ? '|' + (c.presets || []).join(',') : ''); }; }
/* пресет повесили на виджет, у которого уже есть задачи в очереди — предупредить */
{ const _ap = attachPreset; attachPreset = function (w, pid, quiet) {
  const r = _ap.apply(this, arguments);
  const waiting = w ? jobsOf(w).filter(c => c.status === 'queued' || c.status === 'running').length : 0;
  if (waiting && !quiet) setTimeout(() => toast(`Пресет добавится к <b>следующим</b> запускам. Уже в очереди (${waiting}) — без него.`), 50);
  return r;
}; }

/* ================= сцены: два имени, замок, перестановка, отмена ================= */
// виджет, брошенный на клавишу, тоже спрашивает «Заменить?»
bindOpen = function (code, wfId) { const wf = wfById(wfId); bindKeySafe(code, 'open:' + wfId, '↗ ' + (wf?.title || wfId)); };
// шаги для Ctrl+Z: новая, скрытая, удалённая, очищенная сцена, группа
['newSheet', 'hideSheet', 'deleteSheet', 'clearSheet'].forEach(n => { const f = window[n]; if (typeof f !== 'function') return; const lab = { newSheet: 'новая сцена', hideSheet: 'скрытие сцены', deleteSheet: 'удаление сцены', clearSheet: 'очистка сцены' }[n];
  window[n] = function (id) { if (n !== 'newSheet' && sceneLocked(id)) return toast('Сцена закрыта на замок. Правый клик по клавише → «Открыть».'); if (n !== 'clearSheet' && n !== 'deleteSheet') histPush(lab); return f.apply(this, arguments); }; });
// удаление и очистка спрашивают подтверждение — шаг пишем в момент самого удаления
{ const _rc = removeCards; removeCards = function (ids) { if (sceneLocked()) return toast('Сцена закрыта — только просмотр.'); histPush('удаление'); const r = _rc.apply(this, arguments); undoBuf = null; return r; }; }
undo = function () { histUndo(); }; // кнопка «Вернуть» в подсказке — тоже через общую историю
window.addEventListener('pointerup', () => {
  if (!keyDrag || !keyDrag.moved) return;
  const a = Math.min(keyDrag.from, keyDrag.to), b = Math.max(keyDrag.from, keyDrag.to);
  const locked = S.sheets.find(s => s.closed && s.key >= a && s.key <= b);
  if (locked) { keyDrag = null; $$('.key', piano).forEach(el => el.classList.remove('linking')); toast(`Сцена «${esc(locked.name)}» закрыта — её нельзя группировать.`); return; }
  histPush('группа клавиш');
}, true);
document.addEventListener('click', e => { const b = e.target.closest('#pop [data-a="ungroup"], #pop button[data-id]'); if (b && !b.dataset.gc) histPush(b.dataset.a || b.dataset.id === '@ungroup' ? 'разгруппировка' : 'клавиша'); }, true);

const sheetFull = sh => sh.full || sh.name;
renameSheet = function (id, anchor) {
  if (S.locked) return; const sh = S.sheets.find(s => s.id === id); if (!sh) return;
  if (sh.closed) return toast('Сцена закрыта — сначала откройте её.');
  popAt(anchor, `<h4>Название сцены</h4><label class="ren-l">Коротко — на клавише<input id="renIn" value="${esc(sh.name)}" maxlength="14"></label><label class="ren-l">Полностью — при наведении<input id="renFull" value="${esc(sh.full || '')}" maxlength="60" placeholder="например: Реклама кроссовок, версия 2"></label><div class="ren-acts"><button type="button" class="btn small primary" id="renOk">Готово</button></div>`, pop => {
    const a = pop.querySelector('#renIn'), b = pop.querySelector('#renFull'); a.focus(); a.select();
    const ok = () => { histPush('переименование'); sh.name = a.value.trim() || sh.name; sh.full = b.value.trim() || undefined; save(); renderPiano(); closePop(); };
    pop.querySelector('#renOk').onclick = ok;
    [a, b].forEach(x => x.addEventListener('keydown', ev => { if (ev.key === 'Enter') ok(); }));
  }, 'above');
};
{ const _rp = renderPiano; renderPiano = function () {
  _rp.apply(this, arguments);
  for (const k of $$('.key[data-sheet]', piano)) {
    const sh = S.sheets.find(s => s.id === +k.dataset.sheet); if (!sh) continue;
    k.title = `${sheetFull(sh)} (${codeLabel(WHITE[sh.key])})${sh.closed ? ' — 🔒 закрыта: только просмотр. Правый клик → «Открыть»' : '. Двойной клик — имя, правый клик — меню, протяните к соседней — группа'}`;
    if (sh.closed) { k.classList.add('closed'); const t = k.querySelector('.t'); if (t && !t.textContent.startsWith('🔒')) t.textContent = '🔒 ' + t.textContent; }
  }
  if (keyMoveFrom != null) piano.classList.add('moving');
}; }
// меню сцены
sheetMenu = function (id, i, anchor) {
  const sh = S.sheets.find(s => s.id === id); if (!sh) return;
  const gi = groupOf(i), cl = !!sh.closed;
  popAt(anchor, `<h4 title="${esc(sheetFull(sh))}">${esc(sh.name)}</h4>${sh.full ? `<div class="pop-sub" style="margin-top:-4px">${esc(sh.full)}</div>` : ''}
    ${cl ? '<button data-a="open">🔓 Открыть сцену</button>' : `<button data-a="ren">Переименовать</button><button data-a="close">🔒 Закрыть проект (только просмотр)</button><button data-a="move">↔ Переставить на другую клавишу</button>`}
    ${gi >= 0 && !cl ? '<button data-a="ungroup">Разгруппировать</button>' + groupColorHTML(gi) : ''}
    <button data-a="save">💾 Сохранить сцену в файл</button>
    ${cl ? '' : `<button data-a="hide">Скрыть (файлы сохранятся)</button><button data-a="clear">🧹 Очистить стол сцены</button>${S.sheets.length > 1 ? '<button data-a="del">Удалить сцену навсегда…</button>' : ''}`}`, pop => {
    if (gi >= 0 && !cl) bindGroupColor(pop, gi);
    pop.onclick = ev => { const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; closePop();
      if (a === 'ren') renameSheet(id, anchor);
      if (a === 'open') { histPush('открытие сцены'); sh.closed = false; save(); renderPiano(); render(); toast(`«${esc(sh.name)}» снова открыта для работы.`); }
      if (a === 'close') closeScene(sh);
      if (a === 'move') startKeyMove(sh);
      if (a === 'save') saveSceneFile(sh);
      if (a === 'ungroup') { S.groups.splice(gi, 1); save(); renderPiano(); }
      if (a === 'hide' && !S.locked) hideSheet(id);
      if (a === 'clear' && !S.locked) { if (S.sheet !== id) switchSheet(id); clearDesk(false); }
      if (a === 'del' && !S.locked) deleteSheet(id); };
  });
};
function saveSceneFile(sh) {
  const cards = S.cards.filter(c => c.sheet === sh.id).map(c => { const x = { ...c }; delete x.preview; delete x.blob; return x; });
  const data = { app: "Director's Table", kind: 'scene', version: 1, saved: new Date().toISOString(), sheet: { ...sh }, script: S.scripts?.[sh.id] || '', cards };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = 'scene-' + String(sh.name).replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 30) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('💾 Файл сцены скачан (только описание и ссылки на файлы — сами видео остаются в ComfyUI/output).');
}
function closeScene(sh) {
  sheetOpen(`<h3>🔒 Закрыть проект «${esc(sh.name)}»?</h3><div class="sub">Сцену можно будет только смотреть: её нельзя случайно сгруппировать, перезаписать, очистить или удалить. Открыть снова — правый клик по клавише → «Открыть». Сохранить копию в файл на всякий случай?</div>
    <div class="acts"><button type="button" class="btn ghost" data-close>Отмена</button><button type="button" class="btn ghost" data-cs="nofile">Закрыть без файла</button><button type="button" class="btn primary" data-cs="file">💾 Сохранить и закрыть</button></div>`, null, {
    onClick: e => { const b = e.target.closest('[data-cs]'); if (!b) return; closeSheet(); if (b.dataset.cs === 'file') saveSceneFile(sh); histPush('закрытие сцены'); sh.closed = true; S.groups = S.groups.filter(g => !(sh.key >= g.from && sh.key <= g.to)); save(); renderPiano(); render(); toast(`🔒 «${esc(sh.name)}» закрыта — только просмотр.`); }
  });
}
// перестановка: выбрали «Переставить» — кликаете клавишу, куда
function startKeyMove(sh) { keyMoveFrom = sh.id; piano.classList.add('moving'); toast(`Кликните белую клавишу, куда переставить «${esc(sh.name)}». Esc — отмена.`); }
function endKeyMove() { keyMoveFrom = null; piano.classList.remove('moving'); }
window.addEventListener('keydown', e => { if (keyMoveFrom != null && e.key === 'Escape') { endKeyMove(); toast('Перестановка отменена.'); } }, true);
piano.addEventListener('click', e => {
  if (keyMoveFrom == null) return;
  const k = e.target.closest('.key'); if (!k) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const sh = S.sheets.find(s => s.id === keyMoveFrom); endKeyMove(); if (!sh) return;
  const j = +k.dataset.i, i = sh.key; if (j === i) return;
  const other = sheetAtKey(j);
  if (other?.closed) return toast(`«${esc(other.name)}» закрыта — её клавишу трогать нельзя.`);
  histPush('перестановка сцены');
  const ci = WHITE[i], cj = WHITE[j], bj = S.keymap[cj];
  if (other) other.key = i;
  if (bj) { delete S.keymap[cj]; S.keymap[ci] = bj; }
  sh.key = j; S.groups = S.groups.filter(g => !((i >= g.from && i <= g.to) || (j >= g.from && j <= g.to)));
  save(); renderPiano(); toast(`«${esc(sh.name)}» теперь на клавише <b>${codeLabel(cj)}</b>${other ? `, «${esc(other.name)}» — на ${codeLabel(ci)}` : ''}. Ctrl+Z — отменить.`);
}, true);
// закрытая сцена: на её клавишу нельзя ничего положить, на столе — только просмотр
{ const _bk = bindKeySafe; bindKeySafe = function (code) { const wi = WHITE.indexOf(code), sh = wi >= 0 ? sheetAtKey(wi) : null; if (sh?.closed) return toast(`«${esc(sh.name)}» закрыта — её клавишу нельзя перезаписать.`); return _bk.apply(this, arguments); }; }
{ const _d = dispatch; dispatch = function () { if (sceneLocked()) return toast('Сцена закрыта — только просмотр. Правый клик по клавише → «Открыть».'); return _d.apply(this, arguments); }; }
cardsEl.addEventListener('pointerdown', e => {
  if (!sceneLocked() || !e.target.closest('.card')) return;
  if (e.target.closest('video, [data-snd]')) return;
  e.stopPropagation(); e.preventDefault();
  if (!cardsEl.dataset.lockTold || Date.now() - cardsEl.dataset.lockTold > 4000) { cardsEl.dataset.lockTold = Date.now(); toast('🔒 Сцена закрыта — только просмотр. Правый клик по клавише сцены → «Открыть».'); }
}, true);
{ const _r = render; render = function () { document.body.classList.toggle('scene-closed', sceneLocked()); return _r.apply(this, arguments); }; }

/* ================= свои клавиши: призрачные «+» в конце белых и в промежутках чёрных ================= */
const KEY_OK = c => /^Key[A-Z]$|^Digit\d$|^(Minus|Equal|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash|Backslash|IntlBackslash)$/.test(c);
const keyUsed = c => WHITE.includes(c) || BLACK.some(b => b.code === c) || ROWS.some(r => r && r.includes(c)) || c === 'Backquote';
(function applyExtraKeys() {
  for (const c of S.cfg.extraWhite || []) if (KEY_OK(c) && !keyUsed(c)) WHITE.push(c);
  for (const b of S.cfg.extraBlack || []) if (KEY_OK(b.code) && !keyUsed(b.code) && Number.isInteger(b.after)) BLACK.push({ after: b.after, code: b.code });
})();
const isExtraKey = c => (S.cfg.extraWhite || []).includes(c) || (S.cfg.extraBlack || []).some(b => b.code === c);
let addKeyMode = null;
function startAddKey(kind, after) {
  addKeyMode = { kind, after }; piano.classList.add('adding');
  toast(`Нажмите клавишу на клавиатуре — она станет ${kind === 'white' ? 'новой белой (сцена или что угодно)' : 'новой чёрной (пресет, workflow…)'}. Подходят свободные буквы (I, O, P), цифры и знаки - = [ ] ; ' , . /. Esc — отмена.`);
}
window.addEventListener('keydown', e => {
  if (!addKeyMode) return;
  if (e.ctrlKey || e.metaKey || e.altKey || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const m = addKeyMode; addKeyMode = null; piano.classList.remove('adding');
  if (e.code === 'Escape') return toast('Отменено.');
  if (!KEY_OK(e.code)) return toast('Эта клавиша не подходит. Попробуйте букву I, O, P или знак - = [ ] ; , . /');
  if (keyUsed(e.code)) return toast(`Клавиша <b>${codeLabel(e.code)}</b> уже есть на пианино.`);
  histPush('новая клавиша');
  if (m.kind === 'white') { WHITE.push(e.code); S.cfg.extraWhite = [...(S.cfg.extraWhite || []), e.code]; }
  else { BLACK.push({ after: m.after, code: e.code }); S.cfg.extraBlack = [...(S.cfg.extraBlack || []), { after: m.after, code: e.code }]; }
  save(); renderPiano(); toast(`Новая клавиша <b>${codeLabel(e.code)}</b>. Правый клик — назначить, перетащите на неё виджет или пресет.`);
}, true);
function removeExtraKey(code) {
  const wi = WHITE.indexOf(code);
  if (wi >= 0 && sheetAtKey(wi)) return toast('На этой клавише сцена — сначала переставьте или удалите её.');
  if (wi >= 0 && wi !== WHITE.length - 1) return toast('Убрать можно только последнюю добавленную белую клавишу.');
  histPush('удаление клавиши');
  if (wi >= 0) { WHITE.splice(wi, 1); S.cfg.extraWhite = (S.cfg.extraWhite || []).filter(c => c !== code); }
  else { const bi = BLACK.findIndex(b => b.code === code); if (bi >= 0) BLACK.splice(bi, 1); S.cfg.extraBlack = (S.cfg.extraBlack || []).filter(b => b.code !== code); }
  delete S.keymap[code]; delete S.favs[code]; save(); renderPiano(); toast(`Клавиша ${codeLabel(code)} убрана.`);
}
// призраки рисуем после обычной отрисовки пианино; белый «+» занимает 26px, чёрные считаем от остальной ширины
const blackLeft = (after, half) => { const k = (after + 1) / WHITE.length, g = WHITE.length < 14 ? 26 : 0; return `calc(${(k * 100).toFixed(3)}% - ${(k * g).toFixed(2)}px - ${half}%)`; };
{ const _rp2 = renderPiano; renderPiano = function () {
  _rp2.apply(this, arguments);
  const r1 = piano.querySelector('.prow.r1'); if (!r1) return;
  if (WHITE.length < 14) r1.insertAdjacentHTML('beforeend', `<button class="key ghost-add" data-addw title="Добавить белую клавишу"><span class="t">+</span></button>`);
  const usedAfter = new Set(BLACK.map(b => b.after));
  for (let a = 0; a < WHITE.length - 1; a++) if (!usedAfter.has(a)) {
    r1.insertAdjacentHTML('beforeend', `<button class="bk ghost-addb" data-addb="${a}" style="left:${blackLeft(a, 1.6)}" title="Добавить чёрную клавишу здесь">+</button>`);
  }
  // чёрные клавиши стоят по долям ширины ряда — с призраком белых доли меняются, пересчитываем
  for (const el of r1.querySelectorAll('.bk[data-bind]')) { const b = BLACK.find(x => x.code === el.dataset.bind); if (b) el.style.left = blackLeft(b.after, 3.3); }
}; }
piano.addEventListener('click', e => {
  const w = e.target.closest('[data-addw]'), bb = e.target.closest('[data-addb]');
  if (!w && !bb) return; e.stopImmediatePropagation(); e.preventDefault();
  if (S.locked) return toast('Стол на замке.');
  startAddKey(w ? 'white' : 'black', bb ? +bb.dataset.addb : null);
}, true);
piano.addEventListener('contextmenu', e => {
  const k = e.target.closest('[data-bind], .key[data-i]'); if (!k) return;
  const code = k.dataset.bind || WHITE[+k.dataset.i]; if (!isExtraKey(code)) return;
  if (k.dataset.bind ? bindAction(bindingTarget(code)[code]) : sheetAtKey(+k.dataset.i)) return; // занятую — обычное меню
  e.preventDefault(); e.stopImmediatePropagation();
  popAt(k, `<h4>Клавиша ${codeLabel(code)}</h4><button data-xk="bind">Назначить…</button><button data-xk="del">Убрать эту клавишу</button>`, pop => { pop.onclick = ev => { const b = ev.target.closest('[data-xk]'); if (!b) return; closePop(); if (b.dataset.xk === 'del') removeExtraKey(code); else bindMenu(code, k); }; });
}, true);
renderPiano();
// двойной клик по клавише сцены: пианино перерисовывается после первого клика, и браузер теряет dblclick — ловим сами
{ let lastK = null, lastT = 0;
  piano.addEventListener('click', e => {
    const k = e.target.closest('.key[data-sheet]'); if (!k) { lastK = null; return; }
    const i = k.dataset.i, now = Date.now();
    if (lastK === i && now - lastT < 380) { lastK = null; e.stopImmediatePropagation(); setTimeout(() => { const el = piano.querySelector(`.key[data-i="${i}"]`); if (el) renameSheet(+el.dataset.sheet, el); }, 0); return; }
    lastK = i; lastT = now;
  }, true);
}

/* ================= зона «Монтаж»: вкладки «Вывод» и «Монтаж» ================= */
// «Вывод» — все готовые результаты сцены маленькими значками: навели — значок растёт и играет.
// «→» или перетаскивание значка на вкладку «Монтаж» — клип уходит в монтаж.
{ const _sp = spillResult; spillResult = function (c, w) {
  const mode = S.cfg.spillMode || 'output';
  if (mode === 'output' && c.owner) { c.parked = true; c.fresh = Date.now(); setTimeout(renderOutbox, 0); return true; }
  return _sp.apply(this, arguments);
}; }
// «Вывод» — тонкая лента сверху зоны «Монтаж»: все готовые результаты сцены маленькими значками.
// Навели — рядом всплывает крупное превью и играет. Перетащили значок вниз, в монтаж (или «→») — клип встаёт в ряд.
const outSel = new Set();
const outItems = () => S.cards.filter(c => c.sheet === S.sheet && c.type === 'file' && c.status === 'done' && c.file && c.parked && (c.owner || c.cleared)).sort((a, b) => (b.done || b.created || 0) - (a.done || a.created || 0));
const outBox = document.createElement('div'); outBox.className = 'outstrip'; outBox.hidden = true; canvasEl.appendChild(outBox);
const outPeek = document.createElement('div'); outPeek.className = 'outpeek'; outPeek.hidden = true; document.body.appendChild(outPeek);
let outSig = '';
const OUT_H = 54; // лента «Вывод» стоит в строке подписи зоны
function renderOutbox() {
  const a = areasOf().find(x => x.montage);
  const items = outItems();
  if (!a || S.cfg.outStrip === false || !items.length) { outBox.hidden = true; outSig = ''; return; } // пусто — ленты нет, монтаж целиком твой
  const r = areaRect(a);
  outBox.hidden = false;
  outBox.style.cssText = `left:${r.x + 170}px;top:${r.y + 7}px;width:${Math.max(120, r.w - 180)}px;height:${OUT_H - 12}px`;
  const sig = [r.x, r.y, r.w, items.map(c => c.id + (outSel.has(c.id) ? 's' : '')).join(',')].join('|');
  if (sig === outSig) return; outSig = sig;
  const icon = c => { const src = srcOf(c); const m = c.kind === 'image' ? `<img src="${esc(src)}" alt="" draggable="false">` : c.kind === 'video' ? `<video src="${esc(src)}#t=0.1" muted playsinline preload="metadata"></video>` : `<span class="oaud">♪</span>`;
    return `<div class="oi${outSel.has(c.id) ? ' sel' : ''}" data-oi="${c.id}" draggable="true">${m}<button class="ogo" data-ogo="${c.id}" title="В монтаж">→</button></div>`; };
  outBox.innerHTML = `<span class="ol" title="Готовые результаты этой сцены. Перетащите значок в монтаж или нажмите «→»">Вывод <b>${items.length}</b></span><div class="ogrid">${items.length ? items.map(icon).join('') : '<span class="oempty">готовые результаты появятся здесь</span>'}</div>${outSel.size ? `<button class="oall" data-oall>→ в монтаж: ${outSel.size}</button>` : ''}`;
}
function outToCut(ids, at) {
  const list = ids.map(byId).filter(Boolean); if (!list.length) return;
  histPush('в монтаж');
  list.forEach((c, i) => { c.cleared = undefined; moveToCut(c); if (at) { c.x = Math.max(0, Math.min(W - CW, at[0] - CW / 2 + i * (CW + 8))); c.y = Math.max(0, Math.min(H - CH, at[1] - CH / 2)); } outSel.delete(c.id); });
  if (at && typeof settle === 'function') settle(list); else { save(); render(); }
  toast(`🎬 В монтаж: ${list.length}.`);
}
function showOutPeek(it) {
  const c = byId(+it.dataset.oi); if (!c) return;
  const r = it.getBoundingClientRect(), src = srcOf(c);
  outPeek.innerHTML = (c.kind === 'image' ? `<img src="${esc(src)}" alt="">` : c.kind === 'video' ? `<video src="${esc(src)}" muted loop playsinline autoplay controls></video>` : `<div class="oaud big">♪</div><audio src="${esc(src)}" controls autoplay preload="auto"></audio>`) + `<div class="pk-t"><b data-noi18n>${esc(c.title)}</b><span>${c.took ? '⏱ ' + mmss(c.took) + ' · ' : ''}${c.dur ? c.dur.toFixed(1) + ' ' + T('с') : ''}${c.from ? ' · ' + T('из') + ' «' + esc(c.from) + '»' : ''}</span></div>`;
  outPeek.hidden = false; clearTimeout(outPeekT);
  const w = 300, x = Math.min(innerWidth - w - 10, Math.max(10, r.left + r.width / 2 - w / 2)), y = r.bottom + 10 + 230 > innerHeight ? r.top - 240 : r.bottom + 10;
  outPeek.style.left = x + 'px'; outPeek.style.top = y + 'px';
  const v = outPeek.querySelector('video'); if (v) { v.muted = !S.cfg.peekSound; v.play().catch(() => { }); }
}
outBox.addEventListener('pointerdown', e => { if (e.target.closest('.oi, button')) e.stopPropagation(); });
outBox.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
let outLastClick = { id: 0, t: 0 };
outBox.addEventListener('click', e => {
  const go = e.target.closest('[data-ogo]'); if (go) return outToCut([+go.dataset.ogo]);
  if (e.target.closest('[data-oall]')) return outToCut([...outSel]);
  const it = e.target.closest('[data-oi]'); if (!it) return;
  const id = +it.dataset.oi;
  // лента перерисовывается после первого клика, и браузер теряет dblclick — двойной клик ловим сами
  const now = Date.now(); if (outLastClick.id === id && now - outLastClick.t < 400) { outLastClick = { id: 0, t: 0 }; outPeek.hidden = true; return openDetails(byId(id)); }
  outLastClick = { id, t: now };
  if (e.ctrlKey || e.metaKey || e.shiftKey) outSel.has(id) ? outSel.delete(id) : outSel.add(id);
  else { const only = outSel.has(id) && outSel.size === 1; outSel.clear(); if (!only) outSel.add(id); }
  outSig = ''; renderOutbox();
});

outBox.addEventListener('pointerover', e => { const it = e.target.closest('[data-oi]'); if (it) showOutPeek(it); });
// превью живое: в него можно зайти мышкой и двигать ползунок видео / звука
let outPeekT = null;
const outPeekHide = () => { outPeek.hidden = true; outPeek.innerHTML = ''; };
outBox.addEventListener('pointerout', e => { const it = e.target.closest('[data-oi]'); if (it && !it.contains(e.relatedTarget) && !outPeek.contains(e.relatedTarget)) { clearTimeout(outPeekT); outPeekT = setTimeout(outPeekHide, 320); } });
outPeek.addEventListener('pointerenter', () => clearTimeout(outPeekT));
outPeek.addEventListener('pointerleave', e => { if (!e.relatedTarget?.closest?.('[data-oi]')) { clearTimeout(outPeekT); outPeekT = setTimeout(outPeekHide, 320); } });
outBox.addEventListener('wheel', e => { const g = outBox.querySelector('.ogrid'); if (g && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { g.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
outBox.addEventListener('dragstart', e => { const it = e.target.closest('[data-oi]'); if (!it) return; outPeek.hidden = true; const id = +it.dataset.oi; const ids = outSel.has(id) ? [...outSel] : [id]; e.dataTransfer.setData('text/dt-out', ids.join(',')); e.dataTransfer.effectAllowed = 'move'; });
board.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/dt-out')) e.preventDefault(); });
board.addEventListener('drop', e => { const v = e.dataTransfer.getData('text/dt-out'); if (!v) return; e.preventDefault(); e.stopPropagation(); outToCut(v.split(',').map(Number), toLogical(e.clientX, e.clientY)); }, true);
{ const _r2 = render; render = function () { if (clampCut()) save(); const r = _r2.apply(this, arguments); renderOutbox(); return r; }; }
// карточки монтажа не залезают под ленту «Вывод»
const cutTop = () => (S.cfg.outStrip !== false && outItems().length) ? OUT_H : 34;
{ const _pc = placeCard; placeCard = function (c, area) { const r = _pc.apply(this, arguments); if (area?.montage) { const ar = areaRect(area); if (c.y < ar.y + cutTop()) c.y = ar.y + cutTop(); } return r; }; }
// карточка, которая наполовину залезла в монтаж (или стоит над его краем), встаёт внутрь — ниже подписи и ленты
function clampCut() {
  const a = areasOf().find(x => x.montage); if (!a) return false;
  const ar = areaRect(a), top = ar.y + cutTop(); let moved = false;
  for (const c of visibleCards()) {
    if (c.type !== 'file' || (G && G.mode === 'drag')) continue;
    const ix = Math.min(c.x + CW, ar.x + ar.w) - Math.max(c.x, ar.x), iy = Math.min(c.y + CH, ar.y + ar.h) - Math.max(c.y, ar.y);
    if (ix <= 0 || iy <= 0 || ix * iy < CW * CH * .15) continue;
    const nx = Math.max(ar.x + 8, Math.min(ar.x + ar.w - CW - 8, c.x)), ny = Math.max(top, Math.min(ar.y + ar.h - CH - 6, c.y));
    if (nx !== c.x || ny !== c.y) { c.x = nx; c.y = ny; moved = true; }
  }
  return moved;
}

/* ================= магнит в монтаже: клип прилипает к соседу — цепочки и ряды. Shift при отпускании — без магнита ================= */
let shiftHeld = false;
window.addEventListener('keydown', e => { if (e.key === 'Shift') shiftHeld = true; });
window.addEventListener('keyup', e => { if (e.key === 'Shift') shiftHeld = false; });
window.addEventListener('blur', () => { shiftHeld = false; });
{ const _st = settle; settle = function (cards) {
  if (!shiftHeld && S.cfg.cutMagnet !== false) {
    const moving = new Set(cards.map(c => c.id)), g = 8, R = 48;
    for (const c of cards) {
      if (c.type !== 'file') continue;
      const a = areaAt(c.x + CW / 2, c.y + CH / 2); if (!a?.montage) continue;
      const others = visibleCards().filter(o => o.type === 'file' && !moving.has(o.id) && areaAt(o.x + CW / 2, o.y + CH / 2)?.id === a.id);
      let best = null;
      for (const o of others) for (const [x, y] of [[o.x + CW + g, o.y], [o.x - CW - g, o.y], [o.x, o.y + CH + g]]) {
        if (others.some(q => q !== o && Math.abs(q.x - x) < CW - 4 && Math.abs(q.y - y) < CH - 4)) continue; // место занято
        const d = Math.hypot(c.x - x, c.y - y); if (d < R && (!best || d < best.d)) best = { x, y, d };
      }
      if (best) { c.x = best.x; c.y = best.y; c.snapped = true; }
    }
  }
  return _st.apply(this, arguments);
}; }

/* ================= 📚 Шаблоны Comfy: официальные шаблоны, которые уже стоят вместе с ComfyUI ================= */
// Берём только то, что отдаёт сам ComfyUI (/templates — пакет comfyui-workflow-templates). Ничего не качаем из интернета.
let TPL = null;
async function loadTemplates() {
  if (TPL) return TPL;
  const r = await fetch(API.url('/templates/index.json')); if (!r.ok) throw new Error('ComfyUI не отдал список шаблонов (нужен свежий ComfyUI).');
  const cats = await r.json(); TPL = [];
  for (const c of Array.isArray(cats) ? cats : []) for (const t of c.templates || []) if (t && /^[\w.\-]{1,120}$/.test(String(t.name))) TPL.push({ ...t, cat: c.title || c.category || '', type: c.type || t.mediaType || '' });
  return TPL;
}
function tplModels(ui) {
  const out = [], seen = new Set();
  const walk = nodes => (nodes || []).forEach(n => (n?.properties?.models || []).forEach(m => { if (m?.name && !seen.has(m.name)) { seen.add(m.name); out.push({ name: String(m.name), dir: String(m.directory || ''), url: String(m.url || '') }); } }));
  walk(ui.nodes); (ui.definitions?.subgraphs || []).forEach(sg => walk(sg.nodes));
  return out;
}
const tplKind = t => { const s = (t.tags || []).join(' ') + ' ' + t.cat + ' ' + t.name; return /video|видео/i.test(s) ? 'video' : /audio|music|sound|speech|tts/i.test(s) ? 'audio' : /3d/i.test(s) ? '3d' : 'image'; };
const tplF = { q: '', kind: 'all', src: 'local' };
// облачные шаблоны (Partner Nodes / API) — платные и не «открытые веса»; по умолчанию скрыты
const tplApi = t => t.openSource === false || /^api_/i.test(t.name) || (t.tags || []).some(x => /^(api|partner nodes?)$/i.test(x)) || /partner|closed.?source|\bapi\b/i.test(t.cat || '');
async function templatesSheet() {
  let list;
  try { list = await loadTemplates(); } catch (e) { return toast('📚 ' + esc(e.message)); }
  const draw = () => {
    const q = tplF.q.toLowerCase();
    const nApi = list.filter(tplApi).length;
    const shown = list.filter(t => (tplF.src === 'all' || (tplF.src === 'api') === tplApi(t)) && (tplF.kind === 'all' || tplKind(t) === tplF.kind) && (!q || (t.title + ' ' + (t.description || '') + ' ' + (t.tags || []).join(' ') + ' ' + (t.models || []).join(' ')).toLowerCase().includes(q))).slice(0, 120);
    const kinds = [['all', 'Все'], ['video', 'Видео'], ['image', 'Картинки'], ['audio', 'Звук'], ['3d', '3D']];
    sheetOpen(`<h3>📚 Шаблоны Comfy</h3><div class="sub">Официальные шаблоны, которые уже установлены вместе с ComfyUI. Клик — проверю, какие модели у вас есть, и сделаю виджет. Из интернета ничего не скачивается.</div>
      <div class="tpl-bar"><input id="tplQ" placeholder="поиск: ltx, wan, flux, видео…" value="${esc(tplF.q)}">${kinds.map(([k, l]) => `<button type="button" data-tk="${k}" class="${tplF.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="tpl-bar tpl-src">${[['local', '🖥 Локальные · бесплатно'], ['api', T('☁ Облако API · платно') + ` (${nApi})`], ['all', 'Все']].map(([k, l]) => `<button type="button" data-ts="${k}" data-noi18n class="${tplF.src === k ? 'on' : ''}">${esc(T(l))}</button>`).join('')}${tplF.src !== 'local' ? '<span class="hint">Облачные шаблоны работают через платные Partner Nodes ComfyUI (нужен аккаунт и кредиты) и это не открытые модели.</span>' : ''}</div>
      <div class="tpl-grid">${shown.map(t => `<button type="button" class="tpl${tplApi(t) ? ' api' : ''}" data-tpl="${esc(t.name)}">${tplApi(t) ? '<i class="tpl-api">☁ API</i>' : ''}<img src="${esc(API.url('/templates/' + t.name + '-1.' + (t.mediaSubtype || 'webp')))}" alt="" loading="lazy"><b data-noi18n>${esc(t.title || t.name)}</b><small data-noi18n>${esc((t.description || '').slice(0, 90))}</small>${(t.models || []).length ? `<em data-noi18n>${esc(t.models.join(', '))}</em>` : ''}</button>`).join('') || '<div class="hint">Ничего не нашлось.</div>'}</div>
      <div class="acts"><button type="button" class="btn ghost" data-close>Закрыть</button></div>`, null, {
      wide: true,
      init: box => { box.querySelectorAll('.tpl img').forEach(i => i.addEventListener('error', () => { i.style.visibility = 'hidden'; })); const q = box.querySelector('#tplQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { tplF.q = q.value; draw(); }, 250); }; },
      onClick: e => { const k = e.target.closest('[data-tk]'); if (k) { tplF.kind = k.dataset.tk; return draw(); } const sb = e.target.closest('[data-ts]'); if (sb) { tplF.src = sb.dataset.ts; return draw(); } const b = e.target.closest('[data-tpl]'); if (b) templateDetail(list.find(t => t.name === b.dataset.tpl)); }
    });
  };
  draw();
}
async function templateDetail(t) {
  if (!t) return;
  let ui;
  try { ui = await (await fetch(API.url('/templates/' + t.name + '.json'))).json(); } catch (e) { return toast('Не открылся шаблон: ' + esc(e.message)); }
  const ms = tplModels(ui), have = {};
  for (const d of [...new Set(ms.map(m => m.dir).filter(d => /^[\w-]{1,40}$/.test(d)))]) { try { have[d] = await (await fetch(API.url('/models/' + d))).json(); } catch (_) { have[d] = []; } }
  const ok = m => (have[m.dir] || []).some(f => String(f).replace(/\\/g, '/').split('/').pop() === m.name);
  const miss = ms.filter(m => !ok(m));
  sheetOpen(`<h3 data-noi18n>${esc(t.title || t.name)}</h3><div class="sub" data-noi18n>${esc(t.description || '')}</div>
    <div class="tpl-models">${ms.length ? ms.map(m => `<div class="${ok(m) ? 'ok' : 'no'}"><b>${ok(m) ? '✓' : '✗'}</b><span data-noi18n>${esc(m.name)}</span><small title="ComfyUI/models/${esc(m.dir)}/">→ models/${esc(m.dir)}/</small>${!ok(m) && /^https:\/\/(huggingface\.co|github\.com|civitai\.com)\//.test(m.url) ? `<a class="tpl-dl" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" title="Скачать с официальной страницы. Потом положите файл в ComfyUI/models/${esc(m.dir)}">⬇ скачать</a>` : ''}</div>`).join('') : '<div class="hint">Шаблон не перечисляет модели — проверю при запуске.</div>'}</div>
    ${miss.length ? `<div class="hint" style="margin-top:8px" data-noi18n>${esc(T('Не хватает моделей:'))} ${miss.length}. ${esc(T('Нажмите «⬇ скачать» — файл скачается браузером в «Загрузки». Перенесите его в папку ComfyUI/models/(папка из списка) и перезапустите ComfyUI. Виджет можно сделать уже сейчас.'))}</div>` : ms.length ? '<div class="hint" style="margin-top:8px;color:#5fe3a1">Все модели на месте.</div>' : ''}
    <div class="acts"><button type="button" class="btn ghost" data-tback>← К шаблонам</button><button type="button" class="btn primary" data-tmake>Сделать виджет</button></div>`, null, {
    onClick: async e => {
      if (e.target.closest('[data-tback]')) return templatesSheet();
      if (!e.target.closest('[data-tmake]')) return;
      closeSheet(); toast('Перевожу шаблон в виджет…');
      try { await importWorkflowFiles([new File([JSON.stringify(ui)], (t.title || t.name).replace(/[^\p{L}\p{N} _.-]+/gu, '_').slice(0, 60) + '.json', { type: 'application/json' })]); }
      catch (err) { toast('Не получилось: ' + esc(err.message)); }
    }
  });
}

/* ✨ Хочу такой workflow: описываете словами — стол ищет среди установленных шаблонов и ваших workflow (локально, без интернета) */
const WISH_MAP = [[/видео|ролик|clip|video/i, 'video'], [/картин|фото|изображ|image|picture|photo/i, 'image'], [/ожив|анимир|из картинки|из фото|i2v|image to video/i, 'image to video i2v'], [/из текста|по тексту|t2v|text to video/i, 'text to video t2v'], [/звук|аудио|sound|audio/i, 'audio'], [/музык|песн|music|song/i, 'music'], [/озвуч|голос|речь|speech|voice|tts/i, 'tts speech'], [/апскейл|увелич|чётче|четче|upscale/i, 'upscale'], [/замен|убрать|удалить|inpaint|редакт|edit/i, 'edit inpaint'], [/фон|background/i, 'background'], [/липсинк|губ|lip/i, 'lipsync avatar'], [/3d|3д|модел/i, '3d'], [/камер|ракурс|camera|angle/i, 'camera'], [/персонаж|character|лицо|face/i, 'character face'], [/стил|style/i, 'style']];
function wishWords(q) { const add = WISH_MAP.filter(([rx]) => rx.test(q)).map(([, w]) => w).join(' '); return (q + ' ' + add).toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter(w => w.length > 1); }
async function wishSheet(q0 = '') {
  let tpl = []; try { tpl = await loadTemplates(); } catch (_) { }
  const draw = q => {
    const words = q ? wishWords(q) : [];
    const score = txt => { txt = txt.toLowerCase(); return words.reduce((s, w) => s + (txt.includes(w) ? (w.length > 3 ? 2 : 1) : 0), 0); };
    const mine = WFS.map(w => ({ w, s: score(w.title + ' ' + (w.about || '') + ' ' + w.kind) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4);
    const tops = tpl.map(t => ({ t, s: score([t.title, t.description, (t.tags || []).join(' '), (t.models || []).join(' '), t.name.replace(/_/g, ' ')].join(' ')) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8);
    sheetOpen(`<h3>✨ Хочу такой workflow</h3><div class="sub">Опишите своими словами, что нужно сделать: «оживить фото», «видео из текста со звуком», «увеличить картинку». Стол поищет у вас на компьютере: среди ваших виджетов и установленных шаблонов ComfyUI.</div>
      <div class="field"><input id="wishQ" placeholder="например: оживить фотографию и добавить звук" value="${esc(q)}"></div>
      ${q ? `${mine.length ? `<div class="pop-sub">Уже есть у вас</div><div class="cw-list">${mine.map(({ w }) => `<button type="button" class="cw-row" data-wmine="${esc(w.id)}"><b data-noi18n>${esc(w.title)}</b><small>${esc(KIND_RU[w.kind] || '')} · клик — поставить виджет на стол</small></button>`).join('')}</div>` : ''}
        <div class="pop-sub">Шаблоны ComfyUI</div><div class="tpl-grid">${tops.map(({ t }) => `<button type="button" class="tpl" data-tpl="${esc(t.name)}"><img src="${esc(API.url('/templates/' + t.name + '-1.' + (t.mediaSubtype || 'webp')))}" alt="" loading="lazy"><b data-noi18n>${esc(t.title || t.name)}</b><small data-noi18n>${esc((t.description || '').slice(0, 90))}</small></button>`).join('') || `<div class="hint">${tpl.length ? 'Подходящих шаблонов не нашлось — попробуйте другими словами.' : 'ComfyUI не отдал шаблоны (нужен свежий ComfyUI).'}</div>`}</div>` : ''}
      <div class="acts"><button type="button" class="btn ghost" data-close>Закрыть</button><button type="button" class="btn primary" data-wgo>Найти</button></div>`, null, {
      wide: true,
      init: box => { box.querySelectorAll('.tpl img').forEach(i => i.addEventListener('error', () => { i.style.visibility = 'hidden'; })); const i = box.querySelector('#wishQ'); i.focus(); i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); draw(i.value.trim()); } }; },
      onClick: e => {
        if (e.target.closest('[data-wgo]')) return draw($('#wishQ').value.trim());
        const m = e.target.closest('[data-wmine]'); if (m) { closeSheet(); const wf = wfById(m.dataset.wmine); const w = ensureWidget(wf, S.sheet); save(); render(); flashCard(w.id); return toast(`«${esc(wf.title)}» на столе.`); }
        const b = e.target.closest('[data-tpl]'); if (b) templateDetail(tpl.find(t => t.name === b.dataset.tpl));
      }
    });
  };
  draw(q0);
}

/* ================= подсказки в графе: ноды раскрашены по ролям + легенда ================= */
const ROLE_C = { 'загрузка моделей': ['#3a3644', 'Загрузка моделей'], 'читаю промпт': ['#6b5a1e', 'Промпт (текст)'], 'генерация': ['#1f4a73', 'Генерация'], 'сборка кадров': ['#3d2f6b', 'Сборка кадров (VAE)'], 'подготовка': ['#24524a', 'Подготовка входа'], 'звук': ['#6a2f4c', 'Звук'], 'сохранение': ['#2c5a2c', 'Сохранение'], 'обработка': ['#353041', 'Прочее'] };
const roleOf = type => /Upscale/i.test(type) ? 'сборка кадров' : stageOf(type || '');
let graphHints = false;
function applyGraphHints(on) {
  const t = wfTabs.find(x => x.wfId === activeTab); if (!t?.app?.graph) return toast('ComfyUI ещё загружается.');
  const nodes = t.app.graph._nodes || t.app.graph.nodes || [];
  for (const n of nodes) {
    if (on) { if (!n.__dtc) n.__dtc = [n.color, n.bgcolor]; const [c] = ROLE_C[roleOf(n.type)] || ROLE_C['обработка']; n.bgcolor = c; n.color = c; }
    else if (n.__dtc) { [n.color, n.bgcolor] = n.__dtc; delete n.__dtc; }
  }
  try { t.app.canvas.setDirty(true, true); } catch (_) { }
  graphHints = on; $('#wfvHints')?.classList.toggle('on', on);
  let lg = $('#wfLegend');
  if (on) {
    if (!lg) { lg = document.createElement('div'); lg.id = 'wfLegend'; $('#wfView').appendChild(lg); }
    const used = [...new Set(nodes.map(n => roleOf(n.type)))];
    lg.innerHTML = `<b>Что за что отвечает</b>${used.map(r => `<span><i style="background:${ROLE_C[r]?.[0] || '#353041'}"></i>${esc(ROLE_C[r]?.[1] || r)}</span>`).join('')}<small>Обычно править нужно жёлтые (промпт). Синие — сама генерация: шаги и сила.</small>`;
  } else lg?.remove();
}
{ const bar = $('#wfView .wfbar'), save = $('#wfvSave');
  if (bar && save) { const b = document.createElement('button'); b.id = 'wfvHints'; b.className = 'btn small ghost'; b.type = 'button'; b.textContent = '🎨 Подсказки'; b.title = 'Раскрасить ноды по ролям: что загружает модели, где промпт, где генерация'; save.before(b); b.onclick = () => applyGraphHints(!graphHints); }
  // перед сохранением в виджет — вернуть родные цвета нод, чтобы раскраска не попала в workflow
  if (save) save.addEventListener('click', () => { if (graphHints) applyGraphHints(false); }, true);
  $('#wfvBack')?.addEventListener('click', () => { if (graphHints) applyGraphHints(false); }, true);
}

/* ================= 👤 Персонажи: конструктор как «AI Influencer» — один и тот же герой в каждом кадре ================= */
// Без обучения LoRA: точное описание внешности добавляется к каждому промпту, портрет можно сделать картинкой
// и снимать от него (первый кадр), а фильм тянет последний кадр в следующий — герой не «плывёт».
const CHAR_OPT = {
  type: ['человек', 'аниме-персонаж', 'герой 3D-мультфильма', 'фэнтези-существо', 'робот / андроид'],
  gender: ['женщина', 'мужчина', 'не важно'],
  age: ['около 20', 'около 30', 'около 40', 'около 60', 'пожилой'],
  skin: ['светлая кожа', 'оливковая кожа', 'смуглая кожа', 'тёмная кожа', 'бледная кожа'],
  eyes: ['карие глаза', 'голубые глаза', 'зелёные глаза', 'серые глаза', 'янтарные глаза'],
  hair: ['короткие тёмные волосы', 'длинные русые волнистые', 'рыжее каре', 'светлый хвост', 'бритая голова', 'кудрявые чёрные', 'седые волосы', 'розовые волосы'],
  body: ['стройное телосложение', 'спортивное', 'крепкое, широкие плечи', 'полное', 'высокий рост'],
  marks: ['веснушки', 'шрам на щеке', 'татуировки', 'очки', 'борода', 'пирсинг', 'родинка'],
  style: ['кэжуал: джинсы и белая футболка', 'стритвир: чёрное худи', 'деловой костюм', 'кожаная куртка', 'летнее платье', 'киберпанк-куртка с неоном', 'фэнтези-доспех', 'спортивная форма'],
};
const CHAR_EN = { 'человек': 'a real person', 'аниме-персонаж': 'an anime character', 'герой 3D-мультфильма': 'a stylized 3D animated character', 'фэнтези-существо': 'a fantasy creature', 'робот / андроид': 'a humanoid android robot', 'женщина': 'woman', 'мужчина': 'man', 'не важно': '', 'около 20': 'in {pr} early 20s', 'около 30': 'in {pr} 30s', 'около 40': 'in {pr} 40s', 'около 60': 'in {pr} 60s', 'пожилой': 'elderly', 'светлая кожа': 'fair skin', 'оливковая кожа': 'olive skin', 'смуглая кожа': 'tan skin', 'тёмная кожа': 'dark skin', 'бледная кожа': 'pale skin', 'карие глаза': 'brown eyes', 'голубые глаза': 'blue eyes', 'зелёные глаза': 'green eyes', 'серые глаза': 'grey eyes', 'янтарные глаза': 'amber eyes', 'короткие тёмные волосы': 'short dark hair', 'длинные русые волнистые': 'long wavy light-brown hair', 'рыжее каре': 'a ginger bob haircut', 'светлый хвост': 'blonde hair in a ponytail', 'бритая голова': 'a shaved head', 'кудрявые чёрные': 'curly black hair', 'седые волосы': 'silver-grey hair', 'розовые волосы': 'pink hair', 'стройное телосложение': 'slim build', 'спортивное': 'athletic build', 'крепкое, широкие плечи': 'strong build with broad shoulders', 'полное': 'heavy-set build', 'высокий рост': 'tall', 'веснушки': 'freckles', 'шрам на щеке': 'a scar on the cheek', 'татуировки': 'visible tattoos', 'очки': 'glasses', 'борода': 'a beard', 'пирсинг': 'piercings', 'родинка': 'a beauty mark', 'кэжуал: джинсы и белая футболка': 'jeans and a plain white t-shirt', 'стритвир: чёрное худи': 'a black oversized hoodie and cargo pants', 'деловой костюм': 'a tailored dark business suit', 'кожаная куртка': 'a black leather jacket', 'летнее платье': 'a light summer dress', 'киберпанк-куртка с неоном': 'a cyberpunk jacket with neon accents', 'фэнтези-доспех': 'ornate fantasy armor', 'спортивная форма': 'sportswear' };
const SAFE_TXT = (s, n) => String(s || '').replace(/[<>{}]/g, '').slice(0, n);
function charPrompt(ch) {
  const e = k => CHAR_EN[ch[k]] ?? '';
  const pr = { woman: 'her', man: 'his' }[e('gender')] || 'their';
  const g = e('gender') ? 'a ' + e('gender') : (e('age') ? 'a person' : '');
  const who = [e('type') === 'a real person' ? '' : e('type'), [g, e('age').replace('{pr}', pr)].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'a person';
  const looks = [e('skin'), e('eyes'), e('hair'), e('body'), ...(ch.marks || []).map(m => CHAR_EN[m]).filter(Boolean)].filter(Boolean).join(', ');
  const wear = e('style') ? 'wearing ' + e('style') : '';
  const extra = SAFE_TXT(ch.extra, 200);
  return `The same recurring character ${SAFE_TXT(ch.name, 30) || ''}: ${who}${looks ? ', ' + looks : ''}${wear ? ', ' + wear : ''}${extra ? ', ' + extra : ''}. Keep exactly the same face, hairstyle and outfit in every shot.`.replace(/\s+/g, ' ');
}
function charsToPresets() {
  S.characters = (Array.isArray(S.characters) ? S.characters : []).filter(c => c && SAFE_ID.test(String(c.id))).slice(0, 40);
  PRE.categories = PRE.categories.filter(c => c.id !== 'char');
  PRE.categories.unshift({ id: 'char', title: 'Персонаж', icon: '👤', about: 'один и тот же герой в каждом кадре' });
  PRE.presets = PRE.presets.filter(p => p.cat !== 'char').concat([{ id: 'char-new', cat: 'char', title: '＋ Новый персонаж', icon: '✚', anim: 'pulse', about: 'собрать героя: лицо, волосы, одежда', prompt: '{prompt}' }], S.characters.map(ch => ({ id: ch.id, cat: 'char', title: SAFE_TXT(ch.name, 30) || 'Персонаж', icon: '👤', anim: 'pulse', about: SAFE_TXT([ch.gender, ch.age, ch.hair].filter(Boolean).join(', '), 60), prompt: '{prompt}. ' + charPrompt(ch), origin: 'user' })));
}
{ const _lp = loadPresets; loadPresets = async function () { await _lp.apply(this, arguments); charsToPresets(); }; }
charsToPresets(); setTimeout(charsToPresets, 2500); // список с сервера мог прийти позже
function charSheet(editId) {
  const ch = editId ? { ...(S.characters || []).find(c => c.id === editId) } : { type: 'человек', gender: 'женщина', age: 'около 30', marks: [] };
  const chip = (k, multi) => `<div class="ch-row"><span>${{ type: 'Кто', gender: 'Пол', age: 'Возраст', skin: 'Кожа', eyes: 'Глаза', hair: 'Волосы', body: 'Телосложение', marks: 'Особенности', style: 'Одежда' }[k]}</span><div>${CHAR_OPT[k].map(v => `<button type="button" class="ch${multi ? ((ch.marks || []).includes(v) ? ' on' : '') : (ch[k] === v ? ' on' : '')}" data-ck="${k}" data-cv="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`;
  const list = (S.characters || []).map(c => `<span class="ch-saved"><button type="button" data-cedit="${esc(c.id)}">👤 ${esc(c.name || 'без имени')}</button><button type="button" data-cdel="${esc(c.id)}" title="Удалить">×</button></span>`).join('');
  sheetOpen(`<h3>👤 ${editId ? 'Персонаж' : 'Новый персонаж'}</h3><div class="sub">Соберите героя — он будет одинаковым в каждом кадре: описание добавится к промпту, когда вы повесите персонажа на виджет (как пресет). Можно сразу сделать портрет и снимать от него.</div>
    ${list ? `<div class="ch-list">${list}</div>` : ''}
    <div class="field"><label for="chName">Имя</label><input id="chName" maxlength="30" value="${esc(ch.name || '')}" placeholder="например: Мила"></div>
    ${['type', 'gender', 'age', 'skin', 'eyes', 'hair', 'body'].map(k => chip(k)).join('')}${chip('marks', true)}${chip('style')}
    <div class="field"><label for="chExtra">Своими словами (по-английски точнее)</label><input id="chExtra" maxlength="200" value="${esc(ch.extra || '')}" placeholder="red scarf, silver earrings"></div>
    <div class="ch-prev" id="chPrev"></div>
    <div class="acts"><button type="button" class="btn ghost" data-close>Закрыть</button><button type="button" class="btn ghost" data-cport>🖼 Сохранить и сделать портрет</button><button type="button" class="btn primary" data-csave>Сохранить</button></div>`, null, {
    wide: true,
    init: box => { const upd = () => { ch.name = box.querySelector('#chName').value; ch.extra = box.querySelector('#chExtra').value; box.querySelector('#chPrev').textContent = charPrompt(ch); }; box.oninput = upd; upd(); box._ch = ch; box._upd = upd; },
    onClick: e => {
      const box = sheet, c2 = box._ch;
      const b = e.target.closest('[data-ck]');
      if (b) { const k = b.dataset.ck, v = b.dataset.cv; if (k === 'marks') { c2.marks = c2.marks || []; c2.marks = c2.marks.includes(v) ? c2.marks.filter(x => x !== v) : [...c2.marks, v]; b.classList.toggle('on'); } else { c2[k] = c2[k] === v ? '' : v; box.querySelectorAll(`[data-ck="${k}"]`).forEach(x => x.classList.toggle('on', x === b && c2[k] === v)); } box._upd(); return; }
      const ed = e.target.closest('[data-cedit]'); if (ed) return charSheet(ed.dataset.cedit);
      const del = e.target.closest('[data-cdel]'); if (del) { histPush('удаление персонажа'); S.characters = S.characters.filter(c => c.id !== del.dataset.cdel); save(); charsToPresets(); return charSheet(); }
      const sv = e.target.closest('[data-csave], [data-cport]'); if (!sv) return;
      c2.name = SAFE_TXT(c2.name, 30).trim() || 'Герой'; c2.extra = SAFE_TXT(c2.extra, 200);
      if (!c2.id) c2.id = 'char-' + Date.now().toString(36);
      S.characters = (S.characters || []).filter(c => c.id !== c2.id).concat([c2]); save(); charsToPresets(); closeSheet();
      toast(`👤 «${esc(c2.name)}» сохранён. Маэстро → «Персонаж» → перетащите на виджет — герой будет в каждом кадре.`);
      if (sv.dataset.cport != null) charPortrait(c2);
    }
  });
}
function charPortrait(ch) {
  const noReq = x => !(x.params || []).some(p => p.required && p.type !== 'card') && !(x.params || []).some(p => p.type === 'card');
  const wf = WFS.find(x => x.kind === 'image' && noReq(x) && promptParam(x));
  if (!wf) return toast('Для портрета нужен workflow «текст → картинка» (например Flux / SDXL). Добавьте его: «Инструменты» → «📚 Шаблоны Comfy».');
  ensureWidget(wf, S.sheet); save(); render();
  dispatch([null], wf, { params: { __prompt: `Character reference portrait, front view, head and shoulders, neutral studio background, soft even light, photorealistic. ${charPrompt(ch)}` } });
  toast(`🖼 Делаю портрет «${esc(ch.name)}» в «${esc(wf.title)}». Потом используйте его как первый кадр фильма.`);
}

{ const _up = usePreset; usePreset = function (pid) { if (pid === 'char-new') { try { maestroClose?.(); } catch (_) { } return charSheet(); } return _up.apply(this, arguments); }; }
{ const _at = attachPreset; attachPreset = function (w, pid) { if (pid === 'char-new') return charSheet(); return _at.apply(this, arguments); }; }
// номер белой клавиши — для цветного стиля пианино
{ const _rp3 = renderPiano; renderPiano = function () { _rp3.apply(this, arguments); $$('.prow.r1 .key[data-i]', piano).forEach(k => k.style.setProperty('--ki', k.dataset.i)); }; }

/* стол сжался (закрепили панель) — карточки, которые налезли друг на друга, раскладываем в той же зоне */
function deOverlap() {
  const R = c => ({ x: c.x, y: c.y, w: c.type === 'widget' ? WW : CW, h: c.type === 'widget' ? WH : CH });
  const ov = (a, b) => { const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return ix > 0 && iy > 0 && ix * iy > Math.min(a.w * a.h, b.w * b.h) * .12; };
  for (let pass = 0; pass < 3; pass++) {
    const vis = visibleCards(); let moved = false;
    for (let i = 0; i < vis.length; i++) {
      if (!vis.some((o, j) => j !== i && ov(R(vis[i]), R(o)))) continue;
      const r = R(vis[i]), a = areaAt(r.x + r.w / 2, r.y + r.h / 2);
      if (a && !a.panel) { const x0 = vis[i].x, y0 = vis[i].y; placeCard(vis[i], a); if (vis[i].x !== x0 || vis[i].y !== y0) moved = true; }
    }
    if (!moved) break;
  }
}
// при открытии: карточки, попавшие на Сценарий/Ассистента, — в свои зоны; налезшие — развести
setTimeout(() => {
  for (const c of visibleCards()) { const w = c.type === 'widget' ? WW : CW, h = c.type === 'widget' ? WH : CH, a = areaAt(c.x + w / 2, c.y + h / 2); if (a?.panel) { const to = areaForKind((c.type === 'widget' ? wfById(c.wf)?.kind : c.kind) || 'video', c.title || ''); if (to) placeCard(c, to); } }
  deOverlap(); save(); render();
}, 1200);

/* ================= виджет: кнопка запуска при наведении, заметная ошибка ================= */
{ const _wh2 = widgetHTML; widgetHTML = function (w) {
  const r = _wh2(w), jobs = jobsOf(w), busy = jobs.some(c => c.status === 'running' || c.status === 'queued');
  if (!busy && wfById(w.wf)) r.html = r.html.replace('<div class="media">', '<div class="media"><button type="button" class="wrun" data-wrun title="Запустить (как правый клик → Запустить)">▶</button>');
  r.html = r.html.replace(/<span style="color:var\(--rec\)">ошибок: (\d+)<\/span>/, '<span class="werr" data-werr>⚠ ошибок: $1</span>');
  return r;
}; }
cardsEl.addEventListener('pointerdown', e => { if (e.target.closest('[data-wrun]')) e.stopPropagation(); }, true);
cardsEl.addEventListener('click', e => {
  const b = e.target.closest('[data-wrun]'); if (!b) return;
  e.stopPropagation();
  const w = byId(+b.closest('.card').dataset.id), wf = w && wfById(w.wf); if (!wf) return;
  const files = [...sel].map(byId).filter(c => c?.type === 'file' && wf.accepts.includes(c.kind));
  const src = files.length ? files : [byId(w.lastInput)].filter(c => c && wf.accepts.includes(c.kind));
  dispatch(src.length ? src : [], wf, { ask: true });
}, true);
cardsEl.addEventListener('click', e => { if (e.target.closest('[data-werr]')) { e.stopPropagation(); if (typeof showErrPop === 'function') showErrPop(e.target.closest('[data-werr]'), true); else $('#errBtn')?.click(); } }, true);

/* понятная ошибка, когда в ComfyUI нет нужной модели или ноды (типичный первый запуск у нового человека) */
{ const _fail = fail; fail = function (c, msg, o) {
  let m = String(msg || '');
  const miss = [...m.matchAll(/(\w+):\s*'([^']+\.(?:safetensors|gguf|ckpt|pt|pth|bin))'\s*not in/gi)].map(x => [x[1], x[2]]);
  if (miss.length) {
    const folder = k => /lora/i.test(k) ? 'loras' : /vae/i.test(k) ? 'vae' : /clip|text|gemma|encoder/i.test(k) ? 'text_encoders' : /unet|diffusion/i.test(k) ? 'diffusion_models' : /upscale/i.test(k) ? 'latent_upscale_models' : 'checkpoints';
    m = 'Не хватает моделей: ' + [...new Map(miss.map(([k, f]) => [f, `«${f}» → ComfyUI/models/${folder(k)}`])).values()].join('; ') + '. Скачайте их (Инструменты → «Модели и железо» или README → Models) и перезапустите ComfyUI.';
  } else if (/does not exist|not found|Cannot execute because node .* does not exist|missing node/i.test(m) && /node|class/i.test(m)) {
    m = 'В ComfyUI не установлены ноды этого workflow. Откройте его в самом ComfyUI → Manager → «Install Missing Custom Nodes», перезапустите ComfyUI. Подробно: ' + m;
  }
  return _fail.call(this, c, m, o);
}; }
// круговое меню рисуется в SVG и режет подписи на строки — переводим подписи целиком до отрисовки
{ const _or2 = openRadial; openRadial = function (items, ...rest) {
  if (window.T && window.DT_LANG && DT_LANG !== 'ru') { const tr = list => (list || []).map(n => ({ ...n, label: T(n.label), note: n.note ? T(n.note) : n.note, children: n.children ? tr(n.children) : n.children })); items = tr(items); }
  return _or2.call(this, items, ...rest);
}; }
