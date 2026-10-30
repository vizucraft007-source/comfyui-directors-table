/* Director's Table — правки по итогам тестов: отмена/повтор, ножницы, голос, пресеты в окне промпта,
   выбор workflow перед запуском, прогресс фильма, закрепление верхней панели и др. Подключается последним. */
'use strict';

/* ---------- Ctrl+Z / Ctrl+Shift+Z: связи, пресеты, позиции ---------- */
const HIST = [], REDO = [];
function histSnap() {
  return S.cards.map(c => ({ id: c.id, x: c.x, y: c.y, bound: c.bound ? { ...c.bound } : undefined, unlinked: c.unlinked ? [...c.unlinked] : undefined, lastInput: c.lastInput, presets: c.presets ? [...c.presets] : undefined }));
}
function histApply(snap) {
  const m = new Map(snap.map(x => [x.id, x]));
  for (const c of S.cards) { const x = m.get(c.id); if (!x) continue; c.x = x.x; c.y = x.y; c.bound = x.bound; c.unlinked = x.unlinked; c.lastInput = x.lastInput; c.presets = x.presets; }
  save(); render();
}
function histPush(label) { HIST.push({ label, snap: histSnap(), t: Date.now() }); if (HIST.length > 60) HIST.shift(); REDO.length = 0; }
function histUndo() {
  const h = HIST.pop(); if (!h) return false;
  REDO.push({ label: h.label, snap: histSnap() }); histApply(h.snap); toast(`↶ Отменено: ${esc(h.label)}`); return true;
}
function histRedo() {
  const h = REDO.pop(); if (!h) { toast('Нечего повторять.'); return; }
  HIST.push({ label: h.label, snap: histSnap(), t: Date.now() }); histApply(h.snap); toast(`↷ Повторено: ${esc(h.label)}`);
}
// записываем шаг перед действиями, которые меняют связи и пресеты
(function wrapForHistory() {
  const wrap = (name, label) => { const f = window[name]; if (typeof f !== 'function') return; window[name] = function (...a) { histPush(label); return f.apply(this, a); }; };
  wrap('bindToWidget', 'подключение'); wrap('attachPreset', 'пресет'); wrap('detachPreset', 'снятие пресета');
  // cutThread из ножниц и Alt-клика пишет шаг сам (один шаг на весь разрез)
})();
// перемещение карточек: запоминаем, где лежали, перед началом перетаскивания
cardsEl.addEventListener('pointerdown', e => { if (e.button === 0 && e.target.closest('.card')) { const s = histSnap(); setTimeout(() => { if (!G || G.mode !== 'drag') return; HIST.push({ label: 'перемещение', snap: s, t: Date.now() }); REDO.length = 0; }, 260); } }, true);
window.addEventListener('keydown', e => {
  const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  if (typing || !(e.ctrlKey || e.metaKey)) return;
  if (e.code === 'KeyZ' && e.shiftKey || e.code === 'KeyY') { e.preventDefault(); e.stopImmediatePropagation(); histRedo(); return; }
  if (e.code === 'KeyZ' && !S.locked) {
    // свежее удаление карточек отменяем старым способом, остальное — по истории
    if (undoBuf && (!HIST.length || (undoBuf.t || 0) > HIST[HIST.length - 1].t)) return; // пусть сработает обычный undo()
    if (HIST.length) { e.preventDefault(); e.stopImmediatePropagation(); histUndo(); }
  }
}, true);
const _removeCardsBase = removeCards;
removeCards = function (ids) { const r = _removeCardsBase(ids); if (undoBuf) undoBuf.t = Date.now(); return r; };

/* ---------- ножницы: Alt + протянуть мышью поперёк линий ---------- */
function startScissors(e) {
  e.preventDefault();
  const ns = 'http://www.w3.org/2000/svg';
  const path = document.createElementNS(ns, 'polyline'); path.setAttribute('class', 'scissor'); threadHits.appendChild(path);
  const pts = [], doomed = new Map();
  const toC = (x, y) => { const m = threadHits.getScreenCTM(); return [(x - m.e) / m.a, (y - m.f) / m.d]; };
  const mark = (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) if (el.classList?.contains('hit')) {
      const k = el.dataset.w + ':' + el.dataset.p; if (doomed.has(k)) continue;
      doomed.set(k, [+el.dataset.w, +el.dataset.p]);
      const g = document.createElementNS(ns, 'path'); g.setAttribute('d', el.getAttribute('d')); g.setAttribute('class', 'doomed'); threadHits.insertBefore(g, threadHits.firstChild);
    }
  };
  const mv = ev => { pts.push(toC(ev.clientX, ev.clientY).join(',')); path.setAttribute('points', pts.join(' ')); mark(ev.clientX, ev.clientY); };
  const up = () => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    path.remove(); threadHits.querySelectorAll('.doomed').forEach(x => x.remove());
    if (!doomed.size) return;
    histPush(doomed.size > 1 ? `разрыв ${doomed.size} связей` : 'разрыв связи');
    const keepToast = toast; let n = 0;
    for (const [w, p] of doomed.values()) { cutThread(w, p); n++; }
    keepToast(`✂ Разорвано связей: ${n}. Ctrl+Z — вернуть.`);
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

/* ---------- точка-коннектор с той стороны, куда ближе курсор ---------- */
cardsEl.addEventListener('pointermove', e => {
  const el = e.target.closest('.card:not(.widget)'); if (!el || cdot.hidden) return;
  const c = byId(+el.dataset.id); if (!c || c !== cdotCard) return;
  const r = el.getBoundingClientRect(), left = e.clientX < r.left + r.width / 2;
  cdot.style.left = (left ? c.x : c.x + CW) + 'px'; cdot.dataset.side = left ? 'l' : 'r';
});

/* ---------- голос: кнопка 🎙 — клик = старт/стоп, удержание = говорить, пока держите ---------- */
let micHoldT = 0, micHeldBtn = null;
function micStartFor(btn) {
  if (btn.matches('[data-sp="dict"]')) { const ta = $('#scriptTa'); return startDictation(ta, () => ta.oninput && ta.oninput()); }
  if (btn.matches('[data-ap="mic"]')) { dictTarget = null; return startRec(); }
  if (btn.matches('[data-dict]')) { const v = btn.dataset.dict; const t = document.getElementById(v) || document.getElementById('p_' + v) || sheet.elements?.[v]; if (t) return startDictation(t); }
  return startRec();
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('#btnMic, [data-sp="dict"], [data-ap="mic"], [data-dict]'); if (!b || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  if (rec) { stopRec(); micHeldBtn = null; return; }
  micHoldT = Date.now(); micHeldBtn = b; micStartFor(b);
}, true);
document.addEventListener('pointerup', () => { if (micHeldBtn && Date.now() - micHoldT > 450 && rec) stopRec(); micHeldBtn = null; }, true);
document.addEventListener('click', e => { if (e.target.closest('#btnMic, [data-sp="dict"], [data-ap="mic"], [data-dict]')) { e.preventDefault(); e.stopPropagation(); } }, true);
// Ё вне полей: короткое нажатие — старт, ещё нажатие — стоп; удержание — говорить, пока держите.
// Ё в поле ввода: короткое нажатие печатает букву «ё» как обычно, удержание (дольше 0,35 с) — диктовка в это поле.
let yoDownAt = 0, yoField = null, yoKey = '', yoT = null;
const insertAtCaret = (t, ch) => { const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a; t.setRangeText(ch, a, b, 'end'); t.dispatchEvent(new Event('input', { bubbles: true })); };
window.addEventListener('keydown', e => {
  if (e.code !== 'Backquote') return;
  const t = e.target.closest && e.target.closest('textarea, input[type="text"], input[type="search"], input:not([type])');
  if (e.repeat) { if (t) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
  if (rec) { e.preventDefault(); e.stopImmediatePropagation(); stopRec(); yoDownAt = 0; yoField = null; return; }
  yoDownAt = Date.now();
  if (!t) { if (!sheetBack.hidden) yoDownAt = 0; return; }
  e.preventDefault(); e.stopImmediatePropagation();
  yoField = t; yoKey = e.key && e.key.length === 1 ? e.key : 'ё';
  clearTimeout(yoT);
  yoT = setTimeout(() => { if (!yoField) return; const f = yoField; yoField = null; startDictation(f, () => { f.oninput && f.oninput(); f.dispatchEvent(new Event('input', { bubbles: true })); }); }, 350);
}, true);
window.addEventListener('keyup', e => {
  if (e.code !== 'Backquote') return;
  clearTimeout(yoT);
  if (yoField) { const f = yoField; yoField = null; e.stopImmediatePropagation(); insertAtCaret(f, yoKey); return; } // короткое нажатие в поле — просто буква
  if (yoDownAt && Date.now() - yoDownAt < 400 && !e.target.closest?.('textarea, input')) { e.stopImmediatePropagation(); return; } // вне полей короткое — запись идёт до следующего Ё
  if (rec) stopRec();
}, true);

/* ---------- голосом по имени: «лтх два три» = «LTX 2.3» ---------- */
function voiceNorm(s) {
  return String(s || '').toLowerCase()
    .replace(/л\s*т\s*х|эл\s*тэ\s*икс|элтикс|лтикс/g, 'ltx').replace(/в\s*ф\s*икс|вфикс|вэфэикс/g, 'vfx')
    .replace(/(два|2)\s*(точка|и|,|\.)?\s*(три|3)/g, '2.3').replace(/\bдва\b/g, '2').replace(/\bтри\b/g, '3').replace(/\bодин\b/g, '1')
    .replace(/[«»"'`,:!?]/g, ' ').replace(/\s+/g, ' ').trim();
}
function matchWidgetByVoice(text, ws) {
  const t = voiceNorm(text), tw = new Set(t.split(' '));
  let best = null, score = 0;
  for (const c of ws) {
    const title = voiceNorm(wfById(c.wf)?.title), words = title.split(' ').filter(w => w.length > 1 || /\d/.test(w));
    let s = words.reduce((a, w) => a + (tw.has(w) ? (/\d/.test(w) ? 3 : 2) : t.includes(w) ? 1 : 0), 0);
    if (t.includes(title)) s += 5;
    if (s > score) { score = s; best = c; }
  }
  return score >= 2 ? best : null;
}

/* ---------- окно промпта: видно, какие пресеты добавятся ---------- */
function presetChips(wf, w) {
  w = w || S.cards.find(c => c.type === 'widget' && c.sheet === S.sheet && c.wf === wf.id);
  const list = (w?.presets || []).map(preById).filter(Boolean);
  if (!list.length) return '';
  return `<div class="pchips-line" data-w="${w.id}"><span>При запуске добавится:</span>${list.map(p => `<button type="button" class="pchip2" data-pdel2="${esc(p.id)}" title="Убрать пресет">${esc(p.icon)} ${esc(p.title)} <i>×</i></button>`).join('')}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pdel2]'); if (!b) return;
  const w = byId(+b.closest('.pchips-line').dataset.w); if (w) detachPreset(w, b.dataset.pdel2);
  b.remove();
});
/* ---------- окно параметров: сменить workflow перед запуском ---------- */
document.addEventListener('change', e => {
  if (e.target.id !== 'pWfSel') return;
  const ctx = window.__pctx, nwf = wfById(e.target.value); if (!ctx || !nwf) return;
  const pp = promptParam(ctx.wf), cur = pp ? sheet.elements[pp.id]?.value : '';
  closeSheet();
  const cards = (ctx.cards || []).filter(Boolean);
  if ((nwf.params || []).some(p => p.type === 'card') && !cards.some(c => nwf.accepts.includes(c.kind))) {
    const last = visibleCards().filter(c => c.type === 'file' && isReady(c) && nwf.accepts.includes(c.kind)).sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    if (!last) return toast(`«${esc(nwf.title)}» нужен ${nwf.accepts.map(k => KIND_RU[k]).join(' / ')}. Положите файл на стол.`);
    cards.push(last);
  }
  dispatch(cards, nwf, { ask: true, params: cur ? { __prompt: cur } : {} });
});

/* ---------- фильм: прогресс прямо под сценарием ---------- */
setInterval(() => {
  const sp = $('.zone-panel[data-panel="script"]'); if (!sp) return;
  let el = sp.querySelector('#filmProg');
  const items = S.plan.filter(x => x.opts?.film && S.films?.[x.opts.film]?.sheet === S.sheet);
  const active = items.filter(x => x.status === 'wait' || x.status === 'sent');
  if (!active.length) { el && el.remove(); return; }
  const film = S.films[active[0].opts.film], all = film.items.map(id => S.plan.find(x => x.id === id)).filter(Boolean);
  const cur = all.find(x => x.status === 'sent'), job = cur && byId(cur.jobId);
  if (!el) { el = document.createElement('div'); el.id = 'filmProg'; el.className = 'film-prog'; sp.appendChild(el); }
  const dots = all.map(x => `<i class="${x.status}" title="${esc(x.name || '')}"></i>`).join('');
  const now = cur ? `кадр ${all.indexOf(cur) + 1}/${all.length} · ${job ? (job.status === 'running' ? (job.stage || 'идёт') + ' ' + Math.round((job.progress || 0) * 100) + '%' : 'в очереди') : (cur.enhance && !cur.enhanced ? '✨ пишу промпт…' : 'готовлю…')}` : (S.planOn ? 'ждёт очереди' : `на паузе · ${all.filter(x => x.status === 'done').length}/${all.length} готово`);
  el.innerHTML = `<span class="fp-t">🎬 ${esc(now)}</span><span class="fp-d">${dots}</span>`;
}, 1000);

/* ---------- верхняя панель: клик — закрепить, ещё клик — открепить ---------- */
