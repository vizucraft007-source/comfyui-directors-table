/* Director's Table v0.3 — дополнения: боковые панели (медиатека, файлы, монтаж, задачи), импорт workflow,
   голос, радио, настройки, клавиатура и запуск. */
'use strict';

/* ================= боковые панели ================= */
let rTab = 'files', libTab = 'all';
const inboxSel = [];          // порядок выбора важен: 1, 2, 3…
function rowHTML(c, { ord, color } = {}) {
  const th = c.kind === 'audio' ? bars(c.id, 10) : (isReady(c) ? mediaHTML(c) : '');
  const as = audioSub(c), AC = { sfx: KIND_C.audio, voice: '#9be85a', music: '#5fd0c0' };
  const sub = [as ? AUDIO_SUB[as] : KIND_RU[c.kind], c.dur ? c.dur.toFixed(1) + ' с' : '', c.w ? `${c.w}×${c.h}` : ''].filter(Boolean).join(' · ');
  return `<div class="row${ord ? ' sel' : ''}${as ? ' a-' + as : ''}" data-id="${c.id}" style="--c:${color || (as ? AC[as] : KIND_C[c.kind])}"><span class="th">${th}</span><span class="t"><b>${esc(c.title)}</b><small>${esc(sub)}</small></span><span class="ord">${ord || ''}</span></div>`;
}
function renderSidePanels() {
  const ae = document.activeElement;
  if (ae && ae.closest && ae.closest('#right') && ae.matches('input, textarea, select')) { if (rTab === 'tasks') renderJobsOnly(); return; }
  if ($('#left').classList.contains('open') || $('#left').classList.contains('pinned')) renderLibrary();
  if ($('#right').classList.contains('open') || $('#right').classList.contains('pinned')) renderRight();
}
function renderLibrary() {
  const all = [...S.cards.filter(c => c.type === 'file' && isReady(c)), ...S.inbox.filter(isReady)];
  const tabs = [['all', 'Все', '#f0ff41'], ['image', 'Картинки', KIND_C.image], ['video', 'Видео', KIND_C.video], ['audio', 'Звук', KIND_C.audio], ['res', 'Результаты', '#8f74f2'], ['inbox', 'Входящие', '#9e98b2']];
  $('#libTabs').innerHTML = tabs.map(([k, l, c]) => `<button data-lt="${k}" class="${libTab === k ? 'on' : ''}" style="--c:${c}">${l}</button>`).join('');
  let list = all;
  if (KINDS.includes(libTab)) list = all.filter(c => c.kind === libTab);
  if (libTab === 'res') list = all.filter(c => c.actionId);
  if (libTab === 'inbox') list = S.inbox.filter(isReady);
  list = list.sort((a, b) => (b.done || b.created) - (a.done || a.created));
  const groups = groupBy(list, c => c.sheet ? sheetName(c.sheet) : 'Входящие');
  $('#lib').innerHTML = list.length ? groups.map(([g, xs]) => `<div class="group-h" style="--c:var(--muted)">${esc(g)} · ${xs.length}</div>` + xs.map(c => rowHTML(c)).join('')).join('') : '<div class="dropbox">Здесь появятся все файлы проекта: загруженные, сгенерированные и входящие. Перетащите любой на холст — ляжет копия.</div>';
}
$('#libTabs').addEventListener('click', e => { const b = e.target.closest('[data-lt]'); if (b) { libTab = b.dataset.lt; renderLibrary(); } });

function renderRight() {
  $$('#rTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === rTab));
  $$('#right .tab').forEach(t => t.hidden = t.dataset.tab !== rTab);
  if (rTab === 'files') renderInbox();
  if (rTab === 'cut') renderCut();
  if (rTab === 'tasks') renderTasks();
}
$('#rTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { rTab = b.dataset.tab; renderRight(); } });
function showRight(tab) { rTab = tab; $('#right').classList.add('open'); renderRight(); }

/* ---- Файлы (входящие) ---- */
function inboxArea(c) { return areaForKind(c.kind, c.title) || { id: 'none', label: KIND_RU[c.kind], c: KIND_C[c.kind] }; }
function renderInbox() {
  const box = $('#tabFiles');
  const items = S.inbox;
  for (let i = inboxSel.length - 1; i >= 0; i--) if (!items.find(c => c.id === inboxSel[i])) inboxSel.splice(i, 1);
  const groups = groupBy(items.sort((a, b) => sortKey(a) < sortKey(b) ? -1 : 1), c => inboxArea(c).id);
  box.innerHTML = `<div class="dropbox" id="inboxDrop">Перетащите сюда файлы или целую папку из проводника — они разложатся по областям.<br><button class="btn small" id="inPick">Выбрать файлы…</button> <button class="btn small ghost" id="inFolder">Папку…</button></div>
    ${items.length ? `<div class="files-actions"><button class="btn small primary" id="inPlace">${inboxSel.length ? `На холст: ${inboxSel.length}` : 'Разложить всё на холст'}</button><button class="btn small ghost" id="inAll">Выбрать все</button><button class="btn small ghost" id="inTask" ${inboxSel.length ? '' : 'disabled'}>В задачи</button><button class="btn small ghost" id="inDel" ${inboxSel.length ? '' : 'disabled'}>Убрать</button></div>
    <div class="hint" style="font-size:11.5px;color:var(--dim)">Клик — выбрать (номер = порядок), перетащите на холст или на виджет. Ctrl или Alt — копия, файл останется здесь.</div>` : ''}
    ${groups.map(([aid, xs]) => { const a = inboxArea(xs[0]); return `<div class="group-h" style="--c:${a.c}">${esc(a.label)} · ${xs.length}</div>` + xs.map(c => rowHTML(c, { ord: inboxSel.indexOf(c.id) + 1 || '', color: a.c })).join(''); }).join('')}`;
  $('#inPick').onclick = () => { fileTarget = 'inbox'; $('#fileIn').click(); };
  $('#inFolder').onclick = () => { fileTarget = 'inbox'; $('#folderIn').click(); };
  const b = id => box.querySelector('#' + id);
  if (b('inPlace')) b('inPlace').onclick = () => placeInbox(inboxSel.length ? [...inboxSel] : items.map(c => c.id));
  if (b('inAll')) b('inAll').onclick = () => { inboxSel.length = 0; items.forEach(c => inboxSel.push(c.id)); renderInbox(); };
  if (b('inDel')) b('inDel').onclick = () => { S.inbox = S.inbox.filter(c => !inboxSel.includes(c.id)); inboxSel.length = 0; save(); renderInbox(); };
  if (b('inTask')) b('inTask').onclick = () => { taskForm.source = 'inbox'; showRight('tasks'); };
}
function placeInbox(ids) {
  const made = [];
  for (const id of ids) {
    const c = S.inbox.find(x => x.id === id); if (!c) continue;
    const n = { ...c, id: S.nextId++, type: 'file', sheet: S.sheet, parked: false, created: Date.now() };
    S.cards.push(n); placeCard(n, areaForKind(n.kind, n.title)); made.push(n);
  }
  S.inbox = S.inbox.filter(c => !ids.includes(c.id)); inboxSel.length = 0;
  save(); render(made.map(c => c.id)); toast(`Разложено на холст: <b>${made.length}</b>`);
  return made;
}
function addToInbox(files) {
  const list = [...files].filter(kindOfFile);
  if (!list.length) return;
  list.forEach(f => S.inbox.push(makeFileCard(f, { sheet: null })));
  save(); showRight('files');
  toast(`Во входящие: <b>${list.length}</b>. Разложено по областям.`);
}
function rowPointerDown(e, from) {
  const r = e.target.closest('.row'); if (!r || e.button !== 0) return;
  e.preventDefault();
  const id = +r.dataset.id;
  G = {
    id, x0: e.clientX, y0: e.clientY, t0: performance.now(), pid: e.pointerId, btn: 0, mode: 'press', samples: [], src: 'row', from,
    items: () => { const pool = from === 'inbox' ? S.inbox : [...S.cards, ...S.inbox]; const ids = from === 'inbox' && inboxSel.includes(id) ? inboxSel : [id]; return ids.map(i => pool.find(c => c.id === i)).filter(isReady); },
  };
  addG();
}
function rowClick(g, e) {
  if (g.from === 'inbox') { const i = inboxSel.indexOf(g.id); if (i >= 0) inboxSel.splice(i, 1); else { if (!(e.ctrlKey || e.shiftKey || e.metaKey) && false) inboxSel.length = 0; inboxSel.push(g.id); } renderInbox(); }
  else { const c = byId(g.id); if (c && c.sheet && !c.parked) { if (c.sheet !== S.sheet) switchSheet(c.sheet); setSel([c.id]); flashCard(c.id); } }
}
$('#tabFiles').addEventListener('pointerdown', e => rowPointerDown(e, 'inbox'));
$('#lib').addEventListener('pointerdown', e => rowPointerDown(e, 'lib'));
$('#lib').addEventListener('dblclick', e => { const r = e.target.closest('.row'); if (r) openDetails(byId(+r.dataset.id)); });

/* ---- Монтаж ---- */
const cutVideo = $('#cutVideo'), cutImg = $('#cutImg'), cutAudio = $('#cutAudio');
function cutCards(sheet = S.sheet) {
  const a = areasOf(sheet).find(x => x.montage); if (!a) return [];
  const r = areaRect(a);
  return visibleCards(sheet).filter(c => c.type === 'file' && isReady(c)).filter(c => { const cx = c.x + CW / 2, cy = c.y + CH / 2; return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h; })
    .sort((a, b) => (Math.abs(a.y - b.y) < 60 ? a.x - b.x : a.y - b.y));
}
function renderCut() {
  const list = cutCards(), vis = list.filter(c => c.kind !== 'audio'), music = list.find(c => c.kind === 'audio');
  const total = vis.reduce((s, c) => s + (c.kind === 'image' ? 2.5 : (c.dur || 3)), 0);
  $('#cutMeta').textContent = list.length ? `${vis.length} клип. · ${total.toFixed(1)} с${music ? ' · музыка' : ''}` : '';
  $('#cutEmpty').hidden = !!vis.length;
  $('#cutList').innerHTML = list.map(c => `<li data-id="${c.id}"><span class="n">${c.kind === 'audio' ? '♪' : vis.indexOf(c) + 1}</span><span class="th">${c.kind === 'audio' ? bars(c.id, 10) : mediaHTML(c)}</span><span class="t">${esc(c.title)}<small>${c.kind === 'audio' ? 'музыка под весь ролик' : c.kind === 'image' ? 'кадр · 2.5 с' : (c.dur ? c.dur.toFixed(1) + ' с' : 'видео')}</small></span></li>`).join('');
}
let cutPlay = null;
function cutStart() {
  const list = cutCards(), vis = list.filter(c => c.kind !== 'audio'), music = list.find(c => c.kind === 'audio');
  if (!vis.length) { toast('Положите клипы в область «Монтаж» в центре холста.'); return; }
  cutStop(); cutPlay = { i: -1, t0: performance.now() };
  if (music) { cutAudio.src = srcOf(music); cutAudio.currentTime = 0; cutAudio.play().catch(() => { }); }
  const next = () => {
    if (!cutPlay) return;
    if (++cutPlay.i >= vis.length) { cutStop(); return; }
    const c = vis[cutPlay.i];
    $$('#cutList li').forEach(li => li.classList.toggle('on', +li.dataset.id === c.id));
    if (c.kind === 'image') { cutVideo.pause(); cutVideo.hidden = true; cutImg.hidden = false; cutImg.src = srcOf(c); cutPlay.timer = setTimeout(next, 2500); }
    else { cutImg.hidden = true; cutVideo.hidden = false; cutVideo.src = srcOf(c); cutVideo.muted = !!music; cutVideo.onended = next; cutVideo.play().catch(() => setTimeout(next, 500)); }
  };
  next();
  const tick = () => { if (!cutPlay) return; const s = (performance.now() - cutPlay.t0) / 1000; $('#cutTc').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`; cutPlay.raf = requestAnimationFrame(tick); };
  tick();
}
function cutStop() { if (!cutPlay) return; clearTimeout(cutPlay.timer); cancelAnimationFrame(cutPlay.raf); cutPlay = null; cutVideo.pause(); cutVideo.onended = null; cutAudio.pause(); $$('#cutList li.on').forEach(li => li.classList.remove('on')); }
$('#cutPlay').onclick = cutStart; $('#cutStop').onclick = cutStop;


/* ---- План: задачи в ряд, порядок можно менять, запуск по одной ---- */
// задачи плана НЕ уходят в ComfyUI заранее — поэтому их можно двигать, пока до них не дошла очередь
function planLabel(it) {
  const wf = wfById(it.wfId), pp = wf && promptParam(wf), pr = pp && it.vals?.[pp.id];
  return it.name || ((wf ? wf.title : it.wfId) + (pr ? ' · ' + String(pr).slice(0, 28) : ''));
}
function addToPlan(wf, cards, vals, opts = {}) {
  (cards.length ? cards : [null]).forEach(c => S.plan.push({ id: 'p' + (S.nextId++), wfId: wf.id, src: c ? c.id : null, vals: { ...vals }, opts: { ...opts }, status: 'wait' }));
  save(); renderPlanBits();
  toast(`В плане: <b>${S.plan.filter(x => x.status === 'wait').length}</b>. ${S.planOn ? '' : 'Запуск — правая панель → «Задачи» → ▶.'}`, { label: 'Открыть', fn: () => showRight('tasks') });
}
const planBusy = () => S.plan.some(it => it.status === 'sent' && ['queued', 'running'].includes(byId(it.jobId)?.status));
let planLock = false;
async function planTick() {
  if (!S.planOn || planBusy() || planLock) return;
  const it = S.plan.find(x => x.status === 'wait');
  if (!it) { S.planOn = false; save(); renderPlanBits(); toast('План выполнен ✓'); return; }
  const wf = wfById(it.wfId);
  if (!wf) { it.status = 'error'; it.err = 'workflow не найден'; save(); renderPlanBits(); return planTick(); }
  let src = it.src != null ? byId(it.src) : null;
  it.status = 'sent'; save();
  planLock = true;
  // подготовка: последний кадр прошлого шота, улучшение промпта, освобождение памяти между разными моделями
  try { if (typeof planPrep === 'function') src = await planPrep(it, wf, src); } catch (_) { }
  planLock = false;
  const job = await runJob(src, wf, { ...it.vals }, { ...it.opts, plan: it.id });
  if (!job) { it.status = 'error'; it.err = 'не запустилось'; S.planOn = false; }
  else it.jobId = job.id;
  save(); renderPlanBits();
}
function planJobEnded(c) {
  const it = S.plan.find(x => x.jobId === c.id); if (!it) return;
  it.status = c.status === 'done' ? 'done' : c.stopped ? 'stopped' : 'error';
  save(); renderPlanBits();
  if (!S.planOn) return;
  if (it.status === 'stopped') { S.planOn = false; save(); renderPlanBits(); toast('План на паузе — вы остановили задачу.'); return; }
  const next = S.plan.find(x => x.status === 'wait');
  if (!next) return planTick();
  if (S.planAuto) return planTick();
  sheetOpen(`<h3>Готово: ${esc(planLabel(it))}</h3><p>Дальше по плану: <b>${esc(planLabel(next))}</b>. Запускать?</p><div class="acts"><button type="button" class="btn ghost" data-pp="pause">Пауза</button><button type="button" class="btn primary" data-pp="go">Продолжить</button></div>`, null,
    { onClick: e => { const b = e.target.closest('[data-pp]'); if (!b) return; closeSheet(); if (b.dataset.pp === 'go') planTick(); else { S.planOn = false; save(); renderPlanBits(); } } });
}
function planClearAll() {
  const n = S.plan.filter(x => x.status !== 'sent').length; if (!n) return;
  histPush?.('очистка плана'); S.plan = S.plan.filter(x => x.status === 'sent'); S.planOn = S.plan.length ? S.planOn : false; save(); renderPlanBits();
  toast(`План очищен (${n}). Ctrl+Z — вернуть.`);
}
document.addEventListener('contextmenu', e => { if (!e.target.closest('#planBox')) return; e.preventDefault(); popAt(e.target.closest('[data-pi]') || $('#planBox .plan-h'), '<button class="btn small ghost" data-pclr>🧹 Очистить план</button>', pop => { pop.querySelector('[data-pclr]').onclick = () => { closePop(); planClearAll(); }; }); });
function planStart() { if (!S.plan.some(x => x.status === 'wait')) return toast('В плане нет задач. Добавьте: окно параметров → «В план».'); S.planOn = true; save(); renderPlanBits(); planTick(); }
function planPause() { S.planOn = false; save(); renderPlanBits(); toast('План на паузе. Текущая генерация доработает до конца.'); }
function planHTML() {
  const st = { wait: '', sent: 'идёт', done: '✓', error: 'ошибка', stopped: 'стоп' };
  const items = S.plan.map((it, i) => {
    const wf = wfById(it.wfId), job = it.jobId ? byId(it.jobId) : null;
    const live = it.status === 'sent' && job?.status === 'running' ? Math.round((job.progress || 0) * 100) + '%' : st[it.status];
    return `<div class="pchip s-${it.status}" data-pi="${esc(it.id)}" draggable="${it.status === 'wait'}" style="--c:${KIND_C[wf?.kind] || '#8f74f2'}" title="${esc(planLabel(it))}${it.status === 'wait' ? ' — тащите, чтобы поменять порядок; двойной клик — переименовать' : ''}${it.promptEn ? '\n\nПромпт для модели (EN): ' + esc(it.promptEn) : ''}"><i></i><span class="pn">${i + 1}</span><b>${esc(planLabel(it))}</b>${live ? `<em>${esc(live)}</em>` : ''}${it.status !== 'sent' ? '<button data-prm title="Убрать">×</button>' : ''}</div>`;
  }).join('');
  const wait = S.plan.filter(x => x.status === 'wait').length;
  return `<div class="plan">
    <div class="plan-h"><h3>План</h3><label class="tog" title="Вкл — задачи идут одна за другой сами. Выкл — после каждой спросит, продолжать ли."><input type="checkbox" id="planAuto" ${S.planAuto ? 'checked' : ''}><span></span>Авто</label><div class="spacer"></div>
      ${S.planOn ? '<button class="btn small" id="planPause">❚❚ Пауза</button>' : `<button class="btn small primary" id="planGo" ${wait ? '' : 'disabled'}>▶ Запустить${wait ? ' (' + wait + ')' : ''}</button>`}
      ${S.plan.some(x => x.status !== 'wait' && x.status !== 'sent') ? '<button class="btn small ghost" id="planClean" title="Убрать выполненные">Очистить готовые</button>' : ''}${S.plan.some(x => x.status !== 'sent') ? '<button class="btn small ghost" id="planClear" title="Убрать из плана всё, кроме того, что сейчас генерируется. Ctrl+Z — вернуть">Очистить план</button>' : ''}</div>
    <div class="plan-list" id="planList">${items || '<div class="hint" style="font-size:12px;color:var(--dim)">Пусто. В окне параметров любого виджета нажмите «В план» — задача встанет сюда. Порядок меняется перетаскиванием.</div>'}</div></div>`;
}
function renderPlanBits() {
  const box = $('#planBox'), ae = document.activeElement; if (box && !(ae && box.contains(ae) && ae.matches('input, textarea'))) box.innerHTML = planHTML();
  if (lastStats && typeof showStats === 'function') showStats(lastStats);
}
document.addEventListener('click', e => {
  if (!e.target.closest('#planBox')) return;
  if (e.target.closest('#planGo')) planStart();
  else if (e.target.closest('#planPause')) planPause();
  else if (e.target.closest('#planClean')) { histPush?.('очистка готовых'); S.plan = S.plan.filter(x => x.status === 'wait' || x.status === 'sent'); save(); renderPlanBits(); }
  else if (e.target.closest('#planClear')) planClearAll();
  else if (e.target.closest('[data-prm]')) { const id = e.target.closest('[data-pi]').dataset.pi; histPush?.('задача из плана'); S.plan = S.plan.filter(x => x.id !== id); save(); renderPlanBits(); toast('Убрал из плана. Ctrl+Z — вернуть.'); }
});
document.addEventListener('change', e => { if (e.target.id === 'planAuto') { S.planAuto = e.target.checked; save(); } });
document.addEventListener('dblclick', e => {
  const ch = e.target.closest('#planBox [data-pi]'); if (!ch) return;
  const it = S.plan.find(x => x.id === ch.dataset.pi); if (!it) return;
  popAt(ch, `<h4>Название задачи</h4><input id="pnIn" value="${esc(planLabel(it))}" maxlength="40">`, pop => { const i = pop.querySelector('#pnIn'); i.focus(); i.select(); i.onkeydown = ev => { if (ev.key === 'Enter') { it.name = i.value.trim(); save(); closePop(); renderPlanBits(); } }; });
});
let planDrag = null;
document.addEventListener('dragstart', e => { const ch = e.target.closest?.('#planBox [data-pi]'); if (!ch) return; planDrag = ch.dataset.pi; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/dt-plan', planDrag); ch.classList.add('dragging'); });
document.addEventListener('dragover', e => { if (!planDrag) return; const ch = e.target.closest?.('#planBox [data-pi]'); if (!ch) return; e.preventDefault(); $$('#planBox .pchip').forEach(x => x.classList.toggle('drop-before', x === ch)); });
document.addEventListener('drop', e => {
  if (!planDrag) return; const ch = e.target.closest?.('#planBox [data-pi]'); e.preventDefault();
  const from = S.plan.findIndex(x => x.id === planDrag); let to = ch ? S.plan.findIndex(x => x.id === ch.dataset.pi) : S.plan.length;
  if (from >= 0 && to >= 0 && from !== to) { const [it] = S.plan.splice(from, 1); if (to > from) to--; S.plan.splice(to, 0, it); }
  // начатые и готовые задачи держим впереди: менять можно только то, что ещё ждёт
  S.plan.sort((a, b) => (a.status === 'wait') - (b.status === 'wait'));
  planDrag = null; save(); renderPlanBits();
});
document.addEventListener('dragend', () => { planDrag = null; $$('#planBox .pchip').forEach(x => x.classList.remove('dragging', 'drop-before')); });
setInterval(() => { if (S.plan.some(x => x.status === 'sent')) { S.plan.forEach(it => { if (it.status === 'sent' && it.jobId && !byId(it.jobId)) it.status = 'error'; }); renderPlanBits(); } if (S.planOn) planTick(); }, 2000);

/* ---- Задачи: пакетный запуск ---- */
const taskForm = { wf: '', source: 'sel', prompts: '', mode: 'line', format: '', repeat: 1, chain: '', toCut: false };
function taskSources(wf) {
  const ok = c => c && c.type !== 'widget' && isReady(c) && wf && wf.accepts.includes(c.kind);
  const fromSel = [...sel].map(byId).filter(ok);
  const fromInbox = inboxSel.map(id => S.inbox.find(c => c.id === id)).filter(ok);
  const area = wf ? areaForKind(wf.accepts[0] || 'image') : null;
  const fromArea = area ? visibleCards().filter(c => c.type === 'file' && ok(c) && areaAt(c.x + CW / 2, c.y + CH / 2)?.id === area.id).sort((a, b) => sortKey(a) < sortKey(b) ? -1 : 1) : [];
  return { sel: fromSel, inbox: fromInbox, area: fromArea, areaLabel: area?.label };
}
function buildTaskPlan() {
  const wf = wfById(taskForm.wf); if (!wf) return { wf: null, jobs: [] };
  const needsCard = (wf.params || []).some(p => p.type === 'card');
  const src = needsCard ? (taskSources(wf)[taskForm.source] || []) : [null];
  const prompts = taskForm.prompts.split('\n').map(s => s.trim()).filter(Boolean);
  const jobs = [];
  const rep = Math.max(1, Math.min(10, Number(taskForm.repeat) || 1));
  if (taskForm.mode === 'cross' && prompts.length) src.forEach(c => prompts.forEach(p => { for (let k = 0; k < rep; k++) jobs.push({ c, p }); }));
  else src.forEach((c, i) => { const p = prompts.length ? (taskForm.mode === 'one' ? prompts.join(' ') : prompts[i % prompts.length]) : null; for (let k = 0; k < rep; k++) jobs.push({ c, p }); });
  return { wf, jobs, needsCard };
}
function renderTasks() {
  const box = $('#tabTasks');
  if (!taskForm.wf && WFS.length) taskForm.wf = WFS[0].id;
  const wf = wfById(taskForm.wf);
  const srcs = wf ? taskSources(wf) : { sel: [], inbox: [], area: [] };
  const fmt = wf?.params?.find(p => p.id === 'format' && p.type === 'select');
  const plan = buildTaskPlan();
  const tot = wf ? plan.jobs.reduce((s, j) => s + (estimate(wf, unitsOf(wf, { ...paramDefaults(wf), ...(taskForm.format !== '' && fmt ? { format: Number(taskForm.format) } : {}) }, j.c)) || 0), 0) : 0;
  const chainOpts = wf ? WFS.filter(x => x.id !== wf.id && x.accepts.includes(wf.kind)) : [];
  box.innerHTML = `<div id="planBox">${planHTML()}</div><div class="tasks-form">
    <h3>Пакетный запуск</h3>
    ${WFS.length ? '' : '<div class="hint" style="color:var(--warn);font-size:12px">В библиотеке пока нет workflow. Добавьте: «Инструменты» → «Добавить workflow».</div>'}
    <div class="field"><label for="tWf">Workflow</label><select id="tWf">${WFS.map(x => `<option value="${esc(x.id)}" ${x.id === taskForm.wf ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>
    ${plan.needsCard ? `<div class="field"><label for="tSrc">Какие файлы</label><select id="tSrc">
      <option value="sel" ${taskForm.source === 'sel' ? 'selected' : ''}>Выделенные на холсте (${srcs.sel.length})</option>
      <option value="inbox" ${taskForm.source === 'inbox' ? 'selected' : ''}>Выбранные во «Входящих», по порядку (${srcs.inbox.length})</option>
      <option value="area" ${taskForm.source === 'area' ? 'selected' : ''}>Все в области «${esc(srcs.areaLabel || '—')}» (${srcs.area.length})</option></select></div>` : ''}
    <div class="field"><label for="tPr">Промпты — по строке <button type="button" class="btn small ghost" id="tTxt">Из .txt…</button> <button type="button" class="btn small ghost" data-dict="tPr" title="Надиктовать">🎙</button></label><textarea id="tPr" placeholder="Пусто — промпт из параметров виджета">${esc(taskForm.prompts)}</textarea><input type="file" id="tTxtIn" accept=".txt,text/plain" hidden></div>
    <div class="field"><label for="tMode">Как раздать промпты</label><select id="tMode"><option value="line" ${taskForm.mode === 'line' ? 'selected' : ''}>По строке на файл (по кругу)</option><option value="one" ${taskForm.mode === 'one' ? 'selected' : ''}>Один промпт для всех (все строки вместе)</option><option value="cross" ${taskForm.mode === 'cross' ? 'selected' : ''}>Каждый промпт × каждый файл</option></select></div>
    ${fmt ? `<div class="field"><label for="tFmt">Формат</label><select id="tFmt"><option value="">Как в параметрах виджета</option>${fmt.options.map((o, i) => `<option value="${i}" ${String(taskForm.format) === String(i) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>` : ''}
    <div class="field"><label for="tRep">Вариантов на каждый</label><div class="row2"><input type="range" id="tRep" min="1" max="6" value="${taskForm.repeat}"><output>${taskForm.repeat}</output></div></div>
    <div class="field"><label for="tChain">Затем передать результат в</label><select id="tChain"><option value="">— ничего —</option>${chainOpts.map(x => `<option value="${esc(x.id)}" ${x.id === taskForm.chain ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>
    <label class="field inline"><input type="checkbox" id="tCut" ${taskForm.toCut ? 'checked' : ''}> Готовое сразу класть в «Монтаж»</label>
    <div class="row2" style="display:flex;gap:10px;align-items:center"><span style="flex:1;font-family:var(--f-mono);font-size:11.5px;color:var(--muted)">${plan.jobs.length} задач${tot ? ' · ' + fmtSec(tot) : ''}</span><button class="btn" id="tPlan" ${plan.jobs.length && wf ? '' : 'disabled'} title="Добавить в «План» — запустятся по порядку, порядок можно менять">В план</button><button class="btn primary" id="tGo" ${plan.jobs.length && wf ? '' : 'disabled'}>Сразу в очередь</button></div>
  </div>
  <div class="sec-h">Очередь и история</div>
  <div class="jobs"></div>`;
  renderTasksJobsInto($('.jobs', box));
  const set = (k, v) => { taskForm[k] = v; renderTasks(); };
  $('#tWf', box) && ($('#tWf', box).onchange = e => { taskForm.chain = ''; taskForm.format = ''; set('wf', e.target.value); });
  $('#tSrc', box) && ($('#tSrc', box).onchange = e => set('source', e.target.value));
  $('#tPr', box).oninput = e => { taskForm.prompts = e.target.value; };
  $('#tPr', box).onchange = () => renderTasks();
  $('#tMode', box).onchange = e => set('mode', e.target.value);
  $('#tFmt', box) && ($('#tFmt', box).onchange = e => set('format', e.target.value));
  $('#tRep', box).oninput = e => { e.target.nextElementSibling.textContent = e.target.value; taskForm.repeat = +e.target.value; };
  $('#tRep', box).onchange = () => renderTasks();
  $('#tChain', box).onchange = e => set('chain', e.target.value);
  $('#tCut', box).onchange = e => { taskForm.toCut = e.target.checked; };
  $('#tTxt', box).onclick = () => $('#tTxtIn', box).click();
  $('#tTxtIn', box).onchange = async e => { const f = e.target.files[0]; if (!f) return; taskForm.prompts = (await f.text()).trim(); renderTasks(); };
  box.querySelector('[data-dict]').onclick = () => startDictation($('#tPr', box), () => { taskForm.prompts = $('#tPr', box).value; });
  $('#tGo', box).onclick = () => runTaskPlan(false);
  $('#tPlan', box).onclick = () => runTaskPlan(true);
}
function renderJobsOnly() { const box = $('#tabTasks .jobs'); if (box) renderTasksJobsInto(box); }
function renderTasksJobsInto(box) {
  const jobs = S.cards.filter(c => c.actionId).sort((a, b) => b.created - a.created).slice(0, 40);
  box.innerHTML = jobs.length ? jobs.map(j => `<div class="job ${j.status === 'error' ? 'err' : j.status === 'running' ? 'run' : ''}" data-id="${j.id}"><span class="th">${j.status === 'done' ? mediaHTML(j) : (byId(j.parent) && byId(j.parent).kind !== 'audio' ? mediaHTML(byId(j.parent), { under: true }) : '')}</span><span><b>${esc(j.title)}</b><small>${esc({ queued: 'в очереди', running: 'идёт ' + (j.step || ''), done: 'готово' + (j.started && j.done ? ' · ' + fmtSec((j.done - j.started) / 1000).replace('≈', '') : ''), error: j.error || 'ошибка' }[j.status] || j.status)} · ${esc(wfById(j.actionId)?.title || '')}</small></span>${j.status === 'queued' || j.status === 'running' ? '<button data-x="1" title="Остановить">✕</button>' : ''}</div>`).join('') : '<div class="hint" style="font-size:12px;color:var(--dim)">Здесь будут все задачи: что ждёт, что идёт, что упало.</div>';
}
$('#tabTasks').addEventListener('click', e => {
  const j = e.target.closest('.job'); if (!j) return;
  const c = byId(+j.dataset.id); if (!c) return;
  if (e.target.closest('[data-x]')) cancelJob(c); else openDetails(c);
});
async function runTaskPlan(toPlan = false) {
  const { wf, jobs, needsCard } = buildTaskPlan();
  if (!wf || !jobs.length) return;
  const pp = promptParam(wf);
  const fmt = wf.params?.find(p => p.id === 'format' && p.type === 'select');
  // файлы из «Входящих» сначала кладём на холст
  if (needsCard && taskForm.source === 'inbox') {
    const ids = [...new Set(jobs.map(j => j.c.id))];
    const placed = placeInbox(ids), map = new Map(ids.map((id, i) => [id, placed[i]]));
    jobs.forEach(j => j.c = map.get(j.c.id));
  }
  const batch = 'b' + Date.now();
  let n = 0;
  for (const j of jobs) {
    const vals = paramDefaults(wf);
    if (j.p && pp) vals[pp.id] = j.p;
    if (fmt && taskForm.format !== '') vals.format = Number(taskForm.format);
    const o = { batch, chain: taskForm.chain || null, toCut: taskForm.toCut && !taskForm.chain, chainParams: null };
    if (toPlan) { S.plan.push({ id: 'p' + (S.nextId++), wfId: wf.id, src: j.c ? j.c.id : null, vals, opts: o, status: 'wait' }); n++; continue; }
    const r = await runJob(j.c, wf, vals, o);
    if (r) n++;
  }
  if (toPlan) { save(); toast(`В план добавлено: <b>${n}</b>. Нажмите ▶ «Запустить» вверху вкладки.`); }
  else toast(`В очереди: <b>${n}</b> задач. Можно отойти — прогресс видно на виджете и здесь.`);
  renderTasks();
}

/* оркестратор: «подбери модель для …» → локальная модель читает AGENT.md и каталог → предлагает набор и виджет */
async function assistantPlan(request) {
  if (!request || !request.trim()) return toast('Скажите, что нужно сделать: «подбери модель для озвучки», «собери видео из картинки»…');
  toast('✨ Думаю над задачей…');
  let j;
  try {
    const r = await fetch(API.url('/directors-table/api/llm/plan'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request, url: S.cfg.llmUrl, model: S.cfg.llmModel }) });
    j = await r.json(); if (!r.ok) throw new Error(j.error === 'no-models' ? 'в Ollama нет моделей. Выполните: ollama pull gemma3:4b' : 'локальный помощник не найден. Установите Ollama (ollama.com) и модель: ollama pull gemma3:4b');
  } catch (e) { return toast('✨ ' + esc(e.message)); }
  const wf = j.action && wfById(j.action);
  sheetOpen(`<h3>✨ Предложение</h3><div class="sub">${esc(request)} · ${esc(j.model || '')}</div><p>${esc(j.reply || '')}</p>
    ${j.prompt ? `<div class="field"><label>Промпт</label><textarea readonly rows="4">${esc(j.prompt)}</textarea></div>` : ''}
    <div class="acts">${j.bundle ? `<button type="button" class="btn" data-p="models">Модели: ${esc(j.bundle)}</button>` : ''}${wf ? `<button type="button" class="btn primary" data-p="widget">Виджет «${esc(wf.title)}»</button>` : ''}<button type="button" class="btn ghost" data-close>Закрыть</button></div>`, null,
    { onClick: e => {
      const b = e.target.closest('[data-p]'); if (!b) return; closeSheet();
      if (b.dataset.p === 'models') modelsSheet();
      if (b.dataset.p === 'widget') { const w = ensureWidget(wf, S.sheet); save(); render(); flashCard(w.id); if (j.prompt) { const pp = promptParam(wf); if (pp) { S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [pp.id]: j.prompt }; save(); } } toast('Виджет на столе. Промпт подставлен.'); }
    } });
}

/* модели: что подходит вашему железу, что уже есть, скачать недостающее с проверенных источников */
let modelsPoll = null;
async function modelsSheet() {
  let j;
  try { j = await (await fetch(API.url('/directors-table/api/models'))).json(); } catch (_) { return toast('ComfyUI не отвечает.'); }
  const hw = j.hw || {}, cat = j.catalog || {}, dl = j.downloads || {};
  const fitTxt = { best: '✓ отлично подходит вашей видеокарте', ok: '✓ подходит вашей видеокарте', no: '⚠ мало видеопамяти', unknown: '' };
  const TASK = { video: 'Видео', vfx: 'VFX', tts: 'Озвучка', image: 'Картинки', music: 'Музыка' };
  const card = b => {
    const run = Object.values(dl).filter(d => d.bundle === b.id && d.status === 'run');
    const files = b.files.map(f => { const d = dl[b.id + ':' + f.filename]; const pr = d && d.status === 'run' ? `<i class="mbar"><i style="width:${d.total ? Math.round(d.done / d.total * 100) : 3}%"></i></i><em>${(d.done / 2 ** 30).toFixed(1)}${d.total ? ' / ' + (d.total / 2 ** 30).toFixed(1) : ''} ГБ</em>` : d && d.status === 'error' ? `<em class="err">ошибка: ${esc(d.error || '')}</em>` : ''; return `<li class="${f.installed ? 'ok' : ''}"><span data-noi18n>${f.installed ? '✓' : '○'} ${esc(f.filename)}</span><small>${esc(f.folder)}</small>${pr}</li>`; }).join('');
    return `<div class="mcard fit-${b.fit}${b.installed ? ' inst' : ''}"><div class="mh"><span class="mt">${esc(TASK[b.task] || b.task)}</span><b>${esc(b.title)}</b></div><p>${esc(b.about)}</p>
      <div class="mfit">${b.installed ? '✓ установлено' : esc(fitTxt[b.fit] || '')}${b.vram_min ? ` · от ${b.vram_min} ГБ видеопамяти` : ''}</div>
      ${b.auto_download ? '<div class="mfit">Модель скачается сама при первом запуске.</div>' : `<ul class="mfiles">${files}</ul>`}
      <div class="macts">${b.installed || b.auto_download ? '' : run.length ? `<button type="button" class="btn small ghost" data-mcancel="${b.id}">Отменить</button>` : `<button type="button" class="btn small${b.fit === 'no' ? ' ghost' : ' primary'}" data-mdl="${b.id}">Скачать недостающее</button>`}</div></div>`;
  };
  const html = `<h3>Модели и железо</h3>
    <div class="hwrow"><span><b>${esc(hw.gpu || 'видеокарта не определена')}</b></span><span>Видеопамять: <b>${hw.vram_gb ?? '—'} ГБ</b></span><span>Оперативная: <b>${hw.ram_gb ?? '—'} ГБ</b></span><span>Свободно на диске: <b>${hw.disk_free_gb ?? '—'} ГБ</b></span></div>
    <div class="sub">Скачивание — только с проверенных источников (официальные репозитории на Hugging Face) прямо в папки ComfyUI. Сначала показано то, что подходит вашей видеокарте.</div>
    <div class="mgrid">${[...cat.bundles].sort((a, b) => ({ best: 0, ok: 1, unknown: 2, no: 3 }[a.fit] - { best: 0, ok: 1, unknown: 2, no: 3 }[b.fit])).map(card).join('')}</div>
    <h4>Нужные расширения ComfyUI</h4><div class="sub">Ставятся через ComfyUI Manager (поиск по названию) или git clone в custom_nodes.</div>
    <div class="mnodes">${(cat.custom_nodes || []).filter(n => /^https:\/\//.test(String(n.url))).map(n => `<a href="${esc(n.url)}" target="_blank" rel="noopener" data-noi18n>${esc(n.name)}</a>`).join('')}</div>
    <h4>Локальные помощники</h4><ul class="mhelp">${(cat.local_helpers || []).map(h => `<li><b>${esc(h.title)}</b> — ${esc(h.how)}</li>`).join('')}</ul>
    <div class="acts"><button type="button" class="btn ghost" data-close>Закрыть</button></div>`;
  const open = !sheetBack.hidden && sheet.querySelector('.mgrid');
  if (open) { const sc = sheet.scrollTop; sheet.innerHTML = html; sheet.scrollTop = sc; }
  else sheetOpen(html, null, { wide: true, onClick: async e => {
    const d = e.target.closest('[data-mdl]'), c = e.target.closest('[data-mcancel]');
    if (d) { d.disabled = true; await fetch(API.url('/directors-table/api/models/download'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bundle: d.dataset.mdl }) }); toast('Скачивание началось — можно закрыть окно, оно продолжится.'); modelsSheet(); }
    if (c) { await fetch(API.url('/directors-table/api/models/cancel'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bundle: c.dataset.mcancel }) }); modelsSheet(); }
  } });
  clearTimeout(modelsPoll);
  if (Object.values(dl).some(x => x.status === 'run')) modelsPoll = setTimeout(() => { if (!sheetBack.hidden && sheet.querySelector('.mgrid')) modelsSheet(); }, 1500);
}

/* сохранённые в ComfyUI workflow — в виджеты одним кликом (обычный формат стол переведёт сам) */
async function comfyWorkflowsSheet() {
  let list = [];
  try { list = await (await fetch(API.url('/directors-table/api/comfy-workflows'))).json(); } catch (_) { }
  const known = new Set(WFS.map(w => (w.title || '').toLowerCase()));
  const rows = list.map(w => { const t = w.name.replace(/\.json$/i, ''); return `<button type="button" class="cw-row" data-cw="${esc(w.name)}"><b data-noi18n>${esc(t)}</b><small>${new Date(w.mtime * 1000).toLocaleDateString()} · ${(w.size / 1024).toFixed(0)} КБ${known.has(t.replace(/[_-]+/g, ' ').toLowerCase()) ? ' · уже на столе' : ''}</small></button>`; }).join('');
  sheetOpen(`<h3>Мои workflow из ComfyUI</h3><div class="sub">То, что вы сохранили в самом ComfyUI (Workflow → Save). Клик — стол переведёт его, найдёт поля и сделает виджет. Нужен запущенный ComfyUI.</div>
    <div class="cw-list">${rows || '<div class="hint">Сохранённых workflow не нашлось.</div>'}</div><div class="acts"><button type="button" class="btn ghost" data-close>Закрыть</button></div>`, null,
    { wide: true, onClick: async e => {
      const b = e.target.closest('[data-cw]'); if (!b) return;
      b.disabled = true; b.querySelector('small').textContent = 'перевожу…';
      try {
        const txt = await (await fetch(API.url('/directors-table/api/comfy-workflows/file?name=' + encodeURIComponent(b.dataset.cw)))).text();
        closeSheet();
        await importWorkflowFiles([new File([txt], b.dataset.cw.split('/').pop(), { type: 'application/json' })]);
      } catch (err) { toast('Не получилось: ' + esc(err.message)); }
    } });
}

/* освободить видеопамять и оперативную память — чтобы спокойно работать в других программах */
async function freeMemory() {
  const busy = S.cards.some(c => c.status === 'running' || c.status === 'queued');
  const go = async () => {
    const before = lastStats ? { v: lastStats.gpu?.vram_used, r: lastStats.ram_used } : null;
    toast('Освобождаю память…');
    await API.freeAll();
    setTimeout(async () => {
      await pollStats();
      const a = lastStats;
      if (before && a) toast(`Готово. Видеопамять: ${gb(before.v || 0)} → ${gb(a.gpu?.vram_used || 0)} ГБ · RAM: ${gb(before.r || 0)} → ${gb(a.ram_used || 0)} ГБ. Модели загрузятся заново при следующей генерации.`);
      else toast('Память освобождена. Модели загрузятся заново при следующей генерации.');
    }, 2500);
  };
  if (!busy) return go();
  sheetOpen(`<h3>Идёт генерация</h3><p>Чтобы освободить память, текущие задачи нужно остановить. Остановить и освободить?</p><div class="acts"><button type="button" class="btn ghost" data-close>Отмена</button><button type="button" class="btn primary" data-go>Остановить и освободить</button></div>`, null,
    { onClick: async e => { if (!e.target.closest('[data-go]')) return; closeSheet(); for (const c of S.cards.filter(c => c.status === 'running' || c.status === 'queued')) await cancelJob(c); setTimeout(go, 800); } });
}

/* вид линий зон — переключается по кругу, выбор запоминается */
const LINE_STYLES = [['edge', 'по краю'], ['corner', 'уголки'], ['full', 'уголки + сценарий'], ['straight', 'прямые по периметру']];
function lineStyleName() { return (LINE_STYLES.find(x => x[0] === (S.cfg.lineStyle || 'edge')) || LINE_STYLES[0])[1]; }
function cycleLines() {
  const i = LINE_STYLES.findIndex(x => x[0] === (S.cfg.lineStyle || 'edge'));
  S.cfg.lineStyle = LINE_STYLES[(i + 1) % LINE_STYLES.length][0]; save(); renderAreas();
  const n = $('#lineStyleName'); if (n) n.textContent = lineStyleName();
  toast(`Линии зон: <b>${lineStyleName()}</b>. Ещё раз — Shift+G.`);
}
setTimeout(() => { const n = $('#lineStyleName'); if (n) n.textContent = lineStyleName(); }, 0);

/* ================= импорт workflow ================= */
async function importWorkflowFiles(files) {
  for (const f of [...files].filter(f => /\.json$/i.test(f.name))) {
    let data;
    try { data = JSON.parse(await f.text()); } catch (_) { toast('Файл не читается как JSON.'); continue; }
    try { const def = analyzeWorkflow(data, f.name); importSheet(def); return; }
    catch (e) {
      if (!e.uiFormat) { toast(esc(e.message)); continue; }
      // обычный формат: переводим в API тем же ComfyUI, раскладку сохраняем
      toast('Обычный формат ComfyUI — перевожу для запуска…');
      try { const r = await convertUi(data); const def = analyzeWorkflow(r.api, f.name); def.ui = r.ui; importSheet(def); return; }
      catch (err) { toast('Не получилось перевести: ' + esc(err.message) + '. Можно сохранить через Workflow → Export (API).'); }
    }
  }
}
// невидимый ComfyUI для перевода обычного формата в API
let convFrame = null;
async function comfyFrameReady(frame, types, timeout = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const win = frame.contentWindow, app = win?.app || win?.comfyAPI?.app?.app, reg = win?.LiteGraph?.registered_node_types;
    const known = reg ? types.filter(ct => reg[ct]).length : 0;
    if (app && app.graph && ((reg && known === types.length) || (reg && known > 0 && Date.now() - t0 > 25000) || (!reg && Date.now() - t0 > 15000))) return app;
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('ComfyUI не загрузился');
}
async function convertUi(ui) {
  if (!convFrame) {
    convFrame = document.createElement('iframe');
    Object.assign(convFrame.style, { position: 'fixed', left: '-10000px', top: '0', width: '1200px', height: '800px', opacity: '0', pointerEvents: 'none' });
    convFrame.src = API.base() + '/?directors-table=convert';
    document.body.appendChild(convFrame);
    await new Promise(r => convFrame.addEventListener('load', r, { once: true }));
  }
  const types = [...new Set((ui.nodes || []).map(n => n.type).filter(Boolean))];
  const app = await comfyFrameReady(convFrame, types);
  await app.loadGraphData(JSON.parse(JSON.stringify(ui)), true, false);
  await new Promise(r => setTimeout(r, 300));
  const p = await app.graphToPrompt();
  if (!p || !p.output || !Object.keys(p.output).length) throw new Error('пустой результат');
  return { api: p.output, ui: p.workflow || ui };
}
function importWorkflowDialog() { $('#wfIn').click(); }
$('#wfIn').onchange = e => { importWorkflowFiles(e.target.files); e.target.value = ''; };
function importSheet(def) {
  const typeRu = { card: 'файл карточки', image: 'картинка', audio: 'звук', video: 'видео', text: 'текст', number: 'число', select: 'выбор', seed: 'seed' };
  sheetOpen(`<h3>Новый workflow</h3><div class="sub">Нашёл входы автоматически. Снимите галочки с лишнего и переименуйте поля, как вам удобно. Выход: <b>${esc(KIND_RU[def.output.kind])}</b> (нода ${esc(def.output.node)}). Принимает: ${def.accepts.length ? def.accepts.map(k => KIND_RU[k]).join(', ') : 'без входного файла'}.</div>
    <div class="field"><label for="wTitle">Название</label><input type="text" id="wTitle" name="title" value="${esc(def.title)}"></div>
    <div class="field"><label for="wMenu">Где в круговом меню (Группа / Пункт)</label><input type="text" id="wMenu" name="menu" value="${esc(T(({ video: 'Видео', image: 'Картинки', audio: 'Звук' }[def.output.kind] || 'Workflow')) + ' / ' + def.title)}"><span class="hint">Можно три уровня: «Видео / Камера / Облёт».</span></div>
    <div class="field"><span class="flabel">Поля</span><div class="det"><span class="h"></span><span class="h">Название поля</span><span class="h">Откуда</span><span class="h">Тип</span>
      ${def.params.map((p, i) => `<input type="checkbox" name="on_${i}" ${p.on !== false ? 'checked' : ''} ${p.type === 'card' ? 'disabled checked' : ''}><input type="text" name="lb_${i}" value="${esc(p.label)}"><code>${esc(p.src || '')}</code><span class="ty">${typeRu[p.type] || p.type}</span>`).join('')}
    </div></div>
    <div class="acts"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Добавить в библиотеку</button></div>`,
    f => {
      def.title = f.title.value.trim() || def.title;
      def.menu = f.menu.value.split('/').map(s => s.trim()).filter(Boolean).map((s, i) => i ? s : (['Видео', 'Картинки', 'Звук'].find(r => T(r) === s) || s)); // группа хранится по-русски, на экране переводится
      def.params.forEach((p, i) => { if (p.type !== 'card') p.on = !!f['on_' + i]?.checked; p.label = f['lb_' + i]?.value.trim() || p.label; });
      saveWorkflow(def).then(id => {
        const wf = wfById(id); if (!wf) return;
        const w = ensureWidget(wf, S.sheet);
        const free = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'].find(k => !S.keymap[k]);
        if (free && !Object.values(S.keymap).includes(id)) S.keymap[free] = id;
        save(); render([w.id]); flashCard(w.id);
        toast(`Добавлен <b>${esc(wf.title)}</b>${free ? ' · клавиша ' + free.slice(3) : ''}. Перетащите на виджет файл.`);
      }).catch(e => toast('Не сохранилось: ' + esc(e.message)));
    }, { wide: true });
}
function onLibraryChanged() { renderPiano(); render(); if (rTab === 'tasks') renderSidePanels(); }

/* ================= уголок «Инструменты» ================= */
function updateLayoutSel() {
  const sh = S.sheets.find(s => s.id === S.sheet);
  $('#layoutSel').innerHTML = [...Object.entries(LAYOUTS), ...Object.entries(S.customLayouts || {})].map(([k, v]) => `<option value="${k}" ${sh?.layout === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
  $('#sortSel').value = S.cfg.sortBy;
  $$('[data-tool="hints"]').forEach(b => b.classList.toggle('on', S.zoneMode !== 'off'));
  $$('[data-tool="lock"]').forEach(b => b.classList.toggle('on', S.locked));
}
$('#layoutSel').onchange = e => { const sh = S.sheets.find(s => s.id === S.sheet); sh.layout = e.target.value; save(); render(); autoSort(); };
$('#sortSel').onchange = e => { S.cfg.sortBy = e.target.value; save(); };
$('#corner').addEventListener('click', e => {
  const t = e.target.closest('[data-tool]')?.dataset.tool; if (!t) return;
  if (t === 'sort') autoSort();
  if (t === 'import-wf') importWorkflowDialog();
  if (t === 'import-folder') { fileTarget = 'inbox'; $('#folderIn').click(); }
  if (t === 'hints') toggleHints();
  if (t === 'lock') toggleLock();
  if (t === 'free') freeMemory();
  if (t === 'lines') cycleLines();
  if (t === 'comfy-wf') comfyWorkflowsSheet();
  if (t === 'templates') templatesSheet();
  if (t === 'chars') charSheet();
  if (t === 'wish') wishSheet();
  if (t === 'tour') startWelcome(true);
  if (t === 'film') filmSheet();
  if (t === 'midi') midiInit(true);
  if (t === 'models') modelsSheet();
  if (t === 'zedit') openZoneEditor();
  if (t === 'export') { const blob = new Blob([JSON.stringify(snapshot(), null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'directors-table-project.json'; a.click(); }
  if (t === 'clear') { if (e.target.dataset.sure) { removeCards(S.cards.filter(c => c.sheet === S.sheet && !c.owner).map(c => c.id)); delete e.target.dataset.sure; e.target.textContent = 'Очистить сцену'; } else { e.target.dataset.sure = '1'; e.target.textContent = 'Точно очистить? Нажмите ещё раз'; } }
});
const ZONE_MODES = ['full', 'dim', 'off'];
const ZONE_RU = { full: 'зоны видны', dim: 'зоны еле заметны', off: 'зоны скрыты — наведите на кнопку, чтобы увидеть' };
function applyZones() {
  ZONE_MODES.forEach(m => document.body.classList.toggle('zones-' + m, S.zoneMode === m));
  const b = $('#zonesBtn'); if (b) { b.dataset.mode = S.zoneMode; b.title = `Зоны: ${ZONE_RU[S.zoneMode]}. Наведите — подсветить все, клик — сменить режим (Shift+H)`; }
}
function toggleHints() { S.zoneMode = ZONE_MODES[(ZONE_MODES.indexOf(S.zoneMode) + 1) % 3]; applyZones(); save(); updateLayoutSel(); toast(ZONE_RU[S.zoneMode][0].toUpperCase() + ZONE_RU[S.zoneMode].slice(1) + '.'); }
$('#zonesBtn').onclick = toggleHints;
$('#zonesBtn').onpointerenter = () => document.body.classList.add('zones-peek');
$('#zonesBtn').onpointerleave = () => document.body.classList.remove('zones-peek');
function toggleLock() { S.locked = !S.locked; document.body.classList.toggle('locked', S.locked); save(); updateLayoutSel(); renderAreas(); toast(S.locked ? 'Замок включён: клавиши только переключают сцены.' : 'Замок снят.'); }

/* ================= файлы из проводника ================= */
let fileTarget = 'canvas';
$('#fileIn').onchange = e => { (fileTarget === 'inbox' ? addToInbox : f => addFilesToCanvas(f))(e.target.files); e.target.value = ''; fileTarget = 'canvas'; };
$('#folderIn').onchange = e => { addToInbox(e.target.files); e.target.value = ''; fileTarget = 'canvas'; };
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragover', e => {
  if (!hasFiles(e)) return; e.preventDefault();
  const under = document.elementFromPoint(e.clientX, e.clientY);
  if (e.clientX > innerWidth - 16) showRight('files');
  $('#inboxDrop')?.classList.toggle('over', !!under?.closest('#tabFiles'));
  $$('.card.widget.drop-in').forEach(x => x.classList.remove('drop-in'));
  under?.closest('.card.widget')?.classList.add('drop-in');
});
window.addEventListener('drop', async e => {
  if (!hasFiles(e)) return; e.preventDefault();
  $$('.card.widget.drop-in').forEach(x => x.classList.remove('drop-in'));
  const files = [...e.dataTransfer.files];
  if (files.some(f => /\.json$/i.test(f.name))) { importWorkflowFiles(files); return; }
  const under = document.elementFromPoint(e.clientX, e.clientY);
  if (under?.closest('#right')) { addToInbox(files); return; }
  const key = under?.closest('.key[data-sheet]'); if (key) { addFilesToCanvas(files, null, +key.dataset.sheet); return; }
  const wEl = under?.closest('.card.widget');
  const at = toLogical(e.clientX, e.clientY);
  const made = addFilesToCanvas(files, under?.closest('#board') ? at : null);
  if (wEl) { // файл не ложится поверх виджета — ставим рядом, слева (или справа, если слева нет места)
    const w = byId(+wEl.dataset.id);
    if (w) { made.forEach((c, i) => { const left = w.x - CW - 40; c.x = clampX(left >= 0 ? left - i * 14 : w.x + WW + 40 + i * 14); c.y = clampY(w.y + i * 14); }); save(); render(); }
  }
  if (wEl) { const w = byId(+wEl.dataset.id), wf = wfById(w?.wf); if (wf) { const wait = () => made.every(c => c.file || c.status === 'error') ? dispatch(made, wf, { ask: true }) : setTimeout(wait, 200); wait(); } }
});

/* ================= голос ================= */
const micBtn = $('#btnMic'), hud = $('#voiceHud');
let rec = null, dictTarget = null, dictDone = null;
function startDictation(target, done) { dictTarget = target; dictDone = done; target?.focus(); startRec(); }
async function startRec() {
  if (rec) return;
  if (S.cfg.voiceEngine === 'browser') return startBrowserRec();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (_) { toast('Нет доступа к микрофону. Разрешите его в адресной строке браузера.'); dictTarget = null; return; }
  const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '' });
  const chunks = [];
  mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  const ctx = new AudioContext(), an = ctx.createAnalyser(); ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Uint8Array(an.fftSize);
  rec = { mr, stream, ctx, t0: Date.now() };
  const vu = () => { if (!rec) return; an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); hud.style.setProperty('--lvl', Math.min(1, m / 60)); rec.raf = requestAnimationFrame(vu); };
  vu();
  mr.onstop = async () => {
    stream.getTracks().forEach(t => t.stop()); ctx.close();
    const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
    if (Date.now() - rec.t0 < 400 || blob.size < 2000) { rec = null; hud.hidden = true; micBtn.classList.remove('rec'); return; }
    rec = null;
    micBtn.classList.remove('rec'); micBtn.classList.add('busy'); hud.classList.add('busy'); $('#voiceTxt').textContent = 'Распознаю…';
    try {
      const q = `?model=${encodeURIComponent(S.cfg.voiceModel)}&device=${encodeURIComponent(S.cfg.voiceDevice)}&lang=${encodeURIComponent(S.cfg.voiceLang)}${dictTarget && S.cfg.dictEn !== false && !['assistIn', 'scriptTa'].includes(dictTarget.id) ? '&task=translate' : ''}`;
      const r = await fetch(API.url('/directors-table/api/transcribe' + q), { method: 'POST', body: blob });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'ошибка распознавания');
      handleSpeech(j.text || '');
    } catch (e) { toast('Голос: ' + esc(e.message)); }
    micBtn.classList.remove('busy'); hud.classList.remove('busy'); hud.hidden = true;
  };
  mr.start(); micBtn.classList.add('rec'); hud.hidden = false; $('#voiceTxt').textContent = dictTarget ? 'Диктуйте… отпустите Ё или нажмите ещё раз' : 'Слушаю команду…';
}
function stopRec() { if (rec && rec.mr) { cancelAnimationFrame(rec.raf); rec.mr.stop(); } else if (rec && rec.sr) rec.sr.stop(); }
function startBrowserRec() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Этот браузер не умеет распознавать речь. Выберите «Whisper» в настройках.'); return; }
  const sr = new SR(); sr.lang = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-US' }[S.cfg.voiceLang] || 'ru-RU'; sr.interimResults = true;
  rec = { sr }; micBtn.classList.add('rec'); hud.hidden = false; $('#voiceTxt').textContent = 'Слушаю…';
  let final = '';
  sr.onresult = e => { let t = ''; for (const r of e.results) { t += r[0].transcript; if (r.isFinal) final = t; } $('#voiceTxt').textContent = t; };
  sr.onend = () => { rec = null; micBtn.classList.remove('rec'); hud.hidden = true; if (final) handleSpeech(final); };
  sr.onerror = e => toast('Голос: ' + esc(e.error));
  sr.start();
}
micBtn.onclick = () => rec ? stopRec() : startRec();
const NUM = { 'один': 1, 'одна': 1, 'первая': 1, 'первый': 1, 'два': 2, 'две': 2, 'вторая': 2, 'три': 3, 'третья': 3, 'четыре': 4, 'четвёртая': 4, 'четвертая': 4, 'пять': 5, 'пятая': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10, 'одна́': 1 };
function codewords() {
  const m = {};
  S.cfg.codewords.split('\n').forEach(l => { const [k, v] = l.split(':'); if (k && v) v.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).forEach(w => m[w] = k.trim()); });
  return m;
}
function handleSpeech(raw) {
  const text = raw.trim(); if (!text) { toast('Ничего не расслышал.'); return; }
  // диктовка в поле
  const field = dictTarget || (document.activeElement && document.activeElement.matches('textarea, input[type=text]') ? document.activeElement : null);
  if (field) {
    const s = field.selectionStart ?? field.value.length, e2 = field.selectionEnd ?? s;
    const pre = field.value.slice(0, s), add = (pre && !/\s$/.test(pre) ? ' ' : '') + text;
    field.value = pre + add + field.value.slice(e2); field.dispatchEvent(new Event('input', { bubbles: true }));
    field.selectionStart = field.selectionEnd = (pre + add).length;
    dictDone && dictDone(); dictTarget = null; dictDone = null;
    toast(`Вставлено: «${esc(text.slice(0, 80))}»`); return;
  }
  runCommand(text);
}
let lastReply = '';
function reply(html) { html = String(html).replace(/<div class="va-row">[\s\S]*?<\/div>/, ''); lastReply = html; toast(html); const r = $('.zp-reply'); if (r) r.innerHTML = html; }
const VA_ROW = '<button type="button" class="va" data-va="video">🎬 Видео</button><button type="button" class="va" data-va="image">🖼 Картинка</button><button type="button" class="va" data-va="audio">🔊 Звук</button><button type="button" class="va" data-va="script">📜 В сценарий</button><button type="button" class="va" data-va="ask">✨ Спросить</button>';
function syncVa() { const ap = $('.zone-panel[data-panel="assistant"]'); if (!ap) return; const v = (ap.querySelector('#assistIn')?.value || '').trim(); ap.classList.toggle('has-say', !!v); }
/* ================= словарь команд ================= */
const KIND_WORD = w => /карт|кадр|фото|изобр/.test(w) ? 'image' : /вид|рол|клип/.test(w) ? 'video' : /звук|муз|голос|озв/.test(w) ? 'audio' : null;
const BUILTIN_CMDS = [
  { id: 'sheet', words: ['сцена', 'лист'], arg: 'номер', desc: 'Переключить сцену: «сцена три»', run: a => { const n = NUM[a.split(/\s+/)[0]] || parseInt(a); const sh = sheetAtKey(n - 1) || visibleSheets()[n - 1]; if (!sh) return 'Такой сцены нет.'; openSheet(sh.id); return `Сцена <b>${esc(sh.name)}</b>`; } },
  { id: 'sort', words: ['разложи', 'сортировка', 'порядок'], desc: 'Разложить всё по областям', run: () => { autoSort(); return 'Разложил по областям.'; } },
  { id: 'inbox', words: ['входящие на холст', 'разложи входящие'], desc: 'Все входящие файлы — на холст по областям', run: () => { if (!S.inbox.length) return 'Входящие пусты.'; placeInbox(S.inbox.map(c => c.id)); return 'Входящие разложены.'; } },
  { id: 'play', words: ['смотреть монтаж', 'играй монтаж'], desc: 'Открыть и проиграть черновой монтаж', run: () => { showRight('cut'); cutStart(); return 'Играю монтаж.'; } },
  { id: 'cut', words: ['монтаж'], desc: 'Открыть вкладку «Монтаж»', run: () => { showRight('cut'); return 'Открыл монтаж.'; } },
  { id: 'queue', words: ['очередь', 'задачи'], desc: 'Показать очередь задач', run: () => { showRight('tasks'); return `В работе <b>${S.cards.filter(c => c.status === 'running').length}</b>, в очереди <b>${S.cards.filter(c => c.status === 'queued').length}</b>.`; } },
  { id: 'script', words: ['сценарий'], arg: 'текст', desc: '«сценарий: текст» — добавить строку в сценарий', run: a => { if (a) { S.scripts[S.sheet] = ((S.scripts[S.sheet] || '').trim() + '\n' + a).trim(); save(); fillPanels(); return 'Добавил в сценарий.'; } $('#scriptTa')?.focus(); return 'Пишите сценарий — по строке на кадр.'; } },
  { id: 'totasks', words: ['сценарий в задачи', 'в задачи'], desc: 'Строки сценария — промптами в «Задачи»', run: () => { taskForm.prompts = (S.scripts[S.sheet] || '').trim(); showRight('tasks'); return 'Сценарий в «Задачах».'; } },
  { id: 'runtasks', words: ['поставь задачи', 'запусти задачи'], desc: 'Поставить в очередь то, что настроено в «Задачах»', run: () => { const n = buildTaskPlan().jobs.length; if (!n) return 'В «Задачах» нечего ставить: выберите файлы.'; runTaskPlan(); return `Ставлю ${n} задач.`; } },
  { id: 'selall', words: ['выдели все', 'выдели всё'], arg: 'картинки / видео / звук', desc: 'Выделить все файлы нужного типа', run: a => { const k = KIND_WORD(a); setSel(visibleCards().filter(c => c.type === 'file' && (!k || c.kind === k)).map(c => c.id)); return `Выделено: ${sel.size}`; } },
  { id: 'import', words: ['добавить workflow', 'импорт workflow'], desc: 'Добавить workflow (файл Export API)', run: () => { importWorkflowDialog(); return 'Выберите файл workflow.'; } },
  { id: 'plan', words: ['подбери', 'посоветуй', 'собери', 'какую модель', 'pick', 'recommend'], arg: 'задача', desc: 'Подобрать модель и виджет под задачу (локальная модель + каталог)', run: a => { assistantPlan(a); return 'Думаю над задачей…'; } },
  { id: 'free', words: ['освободи память', 'выгрузи модели'], desc: 'Выгрузить модели из видеопамяти', run: () => { freeMemory(); return 'Освобождаю память.'; } },
  { id: 'zones', words: ['зоны', 'подсказки'], desc: 'Сменить режим зон', run: () => { toggleHints(); return 'Режим зон: ' + ZONE_RU[S.zoneMode]; } },
  { id: 'lock', words: ['замок'], desc: 'Включить / снять замок', run: () => { toggleLock(); return S.locked ? 'Замок включён.' : 'Замок снят.'; } },
  { id: 'stop', words: ['стоп', 'останови'], desc: 'Остановить текущую генерацию', run: () => { S.cards.filter(c => c.status === 'running').forEach(cancelJob); return 'Остановил.'; } },
  { id: 'go', words: ['поехали', 'запуск', 'старт'], desc: 'Запустить открытое окно параметров', run: () => { if (sheetBack.hidden) return 'Нечего запускать.'; sheet.requestSubmit(); return 'Запустил.'; } },
  { id: 'close', words: ['закрой', 'отмена'], desc: 'Закрыть окно', run: () => { closeSheet(); closeResults(); return 'Закрыл.'; } },
  { id: 'wait', words: ['подожди', 'жди'], arg: 'секунд', desc: 'Пауза в сценарии: «подожди 5»', run: a => `Жду ${parseInt(a) || 2} с.` },
];
let CMD = { words: {}, macros: [] };   // свои названия команд и свои сценарии — хранятся файлом на сервере
const cmdWords = c => CMD.words[c.id] || c.words;
async function loadCommands() { try { const j = await API.json('/directors-table/api/commands'); if (j && j.macros) CMD = { words: j.words || {}, macros: j.macros || [] }; } catch (_) { } }
async function saveCommands() { try { await API.json('/directors-table/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(CMD) }); return true; } catch (e) { toast('Словарь не сохранился: ' + esc(e.message)); return false; } }
let recording = null;
const normCmd = s => s.toLowerCase().replace(/[.,!?;«»"]/g, ' ').replace(/\s+/g, ' ').trim();
function matchCommand(t) {
  const list = [];
  for (const m of CMD.macros) for (const w of [].concat(m.words || [])) list.push({ w: normCmd(w), macro: m });
  for (const c of BUILTIN_CMDS) for (const w of cmdWords(c)) list.push({ w: normCmd(w), cmd: c });
  list.sort((a, b) => b.w.length - a.w.length);
  for (const x of list) if (x.w && (t === x.w || t.startsWith(x.w + ' ') || t.startsWith(x.w + ':'))) return { ...x, arg: t.slice(x.w.length).replace(/^[\s:,—-]+/, '') };
  return null;
}
function runCommand(text, { fromMacro = false } = {}) {
  const t = normCmd(text);
  if (!t) return null;
  const m = matchCommand(t);
  if (m && m.macro) { runMacro(m.macro); return 'macro'; }
  if (m && m.cmd) {
    const n = m.w.split(' ').length, rawArg = text.trim().split(/\s+/).slice(n).join(' ').replace(/^[\s:,—-]+/, '');
    const out = m.cmd.run(rawArg);
    if (recording && !fromMacro) { recording.push(text.trim()); fillPanels(); }
    if (!fromMacro || out) reply(out || 'Готово.');
    return m.cmd.id;
  }
  // кодовое слово + промпт (можно и с вводным словом: «сделай видео…», «нарисуй кадр…»)
  const cw = codewords();
  const FILLER = /^(?:сделай|сделайте|сними|снимите|создай|сгенерируй|покажи|хочу|нужно|нужен|нужна|давай|пожалуйста|make|create|generate|show|зроби|створи|зніми)\s+/i;
  let lead = '';
  { const m = text.trim().match(FILLER); if (m) lead = m[0]; }
  const t2 = (lead ? normCmd(text.trim().slice(lead.length)) : t).replace(/^(\S+?):/, '$1 ');
  const first = t2.split(/\s+/)[0];
  let key = Object.keys(cw).find(w => t2.startsWith(w + ' ') || first === w);
  if (!key && /^нарису/i.test(t)) key = Object.keys(cw).find(w => cw[w] === 'image');
  if (key) {
    const kind = cw[key], body = lead ? text.trim().slice(lead.length) : text.trim();
    const rest = (/^нарису/i.test(t) && !body.toLowerCase().startsWith(key) ? text.trim().replace(/^нарису\S*\s*/i, '') : body.slice(key.length)).replace(/^[\s:,—-]+/, '');
    if (kind === 'cut') { showRight('cut'); return 'cut'; }
    if (recording && !fromMacro) { recording.push(text.trim()); fillPanels(); }
    routeVoice(kind, rest, !fromMacro);
    return 'gen';
  }
  if (!fromMacro && !sheetBack.hidden) { const ta = sheet.querySelector('textarea'); if (ta) { ta.value = (ta.value ? ta.value + ' ' : '') + text; reply('Добавил в промпт.'); return 'prompt'; } }
  // не команда — значит, похоже на описание сцены: предлагаем, что с ним сделать
  pendingSay = text.trim();
  { const inp = $('#assistIn'); if (inp) { inp.value = pendingSay; syncVa(); } }
  reply('Не команда. Выберите ниже, что сделать с текстом в поле (можно поправить).');
  return null;
}
let pendingSay = '';
document.addEventListener('click', e => {
  const b = e.target.closest('[data-va]'); if (!b) return;
  const inp = $('#assistIn'), text = (inp?.value || pendingSay || '').trim(); pendingSay = '';
  if (!text) return;
  if (inp) { inp.value = ''; syncVa(); }
  if (what === 'script') { S.scripts[S.sheet] = ((S.scripts[S.sheet] || '').trim() + '\n' + text).trim(); save(); fillPanels(); reply('Добавил строку в сценарий. Ещё кадры — диктуйте, потом 🎬 Снять.'); return; }
  if (what === 'ask') { if (typeof assistantPlan === 'function') assistantPlan(text); return; }
  routeVoice(what, text, true);
});
/* голос → какой workflow и какие файлы.
   Ничего не выделено — берём workflow, которому файлы не нужны (текст → видео); старую картинку и звук сами не подставляем.
   Только если такого нет — workflow с одной картинкой и самый подходящий кадр. Выделили файлы — работаем с ними. */
function routeVoice(kind, text, ask = true) {
  const noReq = x => !(x.params || []).some(p => p.required && p.type !== 'card');
  const needsCard = x => (x.params || []).some(p => p.type === 'card');
  const isVfx = x => Object.values(x.workflow || {}).some(n => n.class_type === 'DTVFXGuide');
  const list = WFS.filter(x => x.kind === kind && noReq(x));
  const files = [...sel].map(byId).filter(c => c && c.type === 'file' && isReady(c));
  const onSheet = S.cards.filter(c => c.type === 'widget' && c.sheet === S.sheet).map(c => ({ w: c, wf: wfById(c.wf) })).filter(x => x.wf && list.includes(x.wf));
  let wf = null, src = [];
  if (files.length) {
    const fits = x => needsCard(x) && files.some(f => x.accepts.includes(f.kind));
    wf = onSheet.find(x => fits(x.wf))?.wf || list.find(x => fits(x) && x.origin === 'user' && !isVfx(x)) || list.find(x => fits(x) && !isVfx(x)) || list.find(fits) || null;
    if (wf) src = files.filter(f => wf.accepts.includes(f.kind));
  }
  if (!wf) wf = onSheet.find(x => !needsCard(x.wf))?.wf || list.find(x => !needsCard(x) && x.origin === 'user') || list.find(x => !needsCard(x)) || null;
  if (!wf) {
    wf = onSheet.find(x => !isVfx(x.wf))?.wf || list.find(x => x.origin === 'user' && !isVfx(x)) || list.find(x => !isVfx(x)) || list[0] || null;
    if (wf) { const w = onSheet.find(x => x.wf === wf)?.w; src = voiceSrc(wf, w); if (src === null) return; if (src.length) toast(`Для «${esc(KIND_RU[kind])}» без картинки workflow нет — беру «${esc(wf.title)}» с кадром. Добавьте свой «текст → видео»: Инструменты → Мои workflow из ComfyUI.`); }
  }
  if (!wf) { reply(`Нет workflow для «${KIND_RU[kind]}», которому хватит текста. Добавьте его: Инструменты → Мои workflow из ComfyUI.`); return; }
  dispatch(src, wf, { ask, params: text ? { __prompt: text } : {} });
}
/* какой workflow взять, если на сцене нет виджета: без лишних обязательных входов, свой — в приоритете */
function pickWf(kind) {
  const isVfx = x => Object.values(x.workflow || {}).some(n => n.class_type === 'DTVFXGuide');
  const simple = WFS.filter(x => x.kind === kind && !(x.params || []).some(p => p.required && p.type !== 'card'));
  return simple.find(x => x.origin === 'user' && !isVfx(x)) || simple.find(x => !isVfx(x)) || simple[0] || WFS.find(x => x.kind === kind);
}
/* какой кадр взять для голосовой команды: выделенный → тот, что был в виджете → самый свежий на сцене */
function voiceSrc(wf, w) {
  const needs = (wf.params || []).some(p => p.type === 'card');
  const ok = c => c && c.type === 'file' && isReady(c) && wf.accepts.includes(c.kind);
  const files = [...sel].map(byId).filter(ok);
  if (files.length) return files;
  if (w && ok(byId(w.lastInput))) return [byId(w.lastInput)];
  if (!needs) return [];
  const last = visibleCards().filter(ok).sort((a, b) => (b.done || b.created || 0) - (a.done || a.created || 0))[0];
  if (last) { toast(`Беру кадр «${esc(last.title)}» — самый свежий на сцене. Другой — выделите его и скажите ещё раз.`); return [last]; }
  reply(`«${esc(wf.title)}» нужен первый кадр (${wf.accepts.map(k => KIND_RU[k]).join(', ')}). Перетащите картинку на стол и скажите ещё раз.`);
  return null;
}
async function runMacro(m) {
  const steps = (m.steps || []).map(s => s.trim()).filter(Boolean);
  reply(`Сценарий <b>${esc(m.name)}</b>: ${steps.length} шаг.`);
  for (const [i, st] of steps.entries()) {
    const w = normCmd(st).match(/^(подожди|жди)\s*(\d+)?/);
    if (w) { await new Promise(r => setTimeout(r, (parseInt(w[2]) || 2) * 1000)); continue; }
    const r = runCommand(st, { fromMacro: true });
    if (r === null) { reply(`Сценарий «${esc(m.name)}» остановлен на шаге ${i + 1}: «${esc(st)}» — не понял.`); return; }
    await new Promise(r => setTimeout(r, 600));
  }
  reply(`Сценарий <b>${esc(m.name)}</b> выполнен.`);
}
function toggleRecording() {
  if (!recording) { recording = []; reply('● Запись: выполняйте команды — я их запоминаю.'); fillPanels(); return; }
  const steps = recording; recording = null; fillPanels();
  if (!steps.length) { reply('Запись пустая.'); return; }
  sheetOpen(`<h3>Сохранить сценарий</h3><div class="sub">Записано команд: ${steps.length}. Его можно запускать кодовым словом голосом или текстом.</div>
    <div class="field"><label for="mName">Название</label><input type="text" id="mName" name="name" value="Мой сценарий ${CMD.macros.length + 1}"></div>
    <div class="field"><label for="mWord">Кодовое слово (можно несколько через запятую)</label><input type="text" id="mWord" name="words" placeholder="например: разбор"></div>
    <div class="field"><label for="mSteps">Шаги — по строке, можно править</label><textarea id="mSteps" name="steps" style="min-height:140px">${esc(steps.join('\n'))}</textarea></div>
    <div class="acts"><button type="button" class="btn ghost" data-close>Не сохранять</button><button class="btn primary">Сохранить в словарь</button></div>`,
    f => { const words = f.words.value.split(',').map(x => x.trim()).filter(Boolean); if (!words.length) { toast('Нужно кодовое слово.'); return false; } CMD.macros.push({ id: 'm' + Date.now(), name: f.name.value.trim() || 'Сценарий', words, steps: f.steps.value.split('\n').map(x => x.trim()).filter(Boolean) }); saveCommands(); reply(`Сохранил. Скажите «${esc(words[0])}» — и всё повторится.`); });
}
function openBook(tab = 'macros') {
  const draw = () => {
    const macros = CMD.macros.map((m, i) => `<div class="book-m" data-i="${i}"><div class="zp-row"><input type="text" data-f="name" value="${esc(m.name)}" class="grow"><input type="text" data-f="words" value="${esc([].concat(m.words).join(', '))}" placeholder="кодовые слова" style="max-width:200px"><button type="button" class="btn small" data-run="${i}">▶</button><button type="button" class="btn small ghost" data-del="${i}">✕</button></div><textarea data-f="steps" rows="3">${esc((m.steps || []).join('\n'))}</textarea></div>`).join('') || '<div class="hint" style="color:var(--dim);font-size:12.5px">Пока нет. Нажмите «● Запись» в Ассистенте, выполните несколько команд и сохраните — или соберите здесь вручную.</div>';
    const cmds = BUILTIN_CMDS.map(c => `<div class="book-c"><code>${esc(c.id)}</code><input type="text" data-cmd="${c.id}" value="${esc(cmdWords(c).join(', '))}"><span>${esc(c.desc)}</span></div>`).join('');
    sheetOpen(`<h3>📖 Словарь ассистента</h3><div class="sub">Свои сценарии — цепочки команд, как экшены в Photoshop. Команды можно переименовать под себя. Всё хранится отдельным файлом, каждая версия сохраняется — можно откатить.</div>
      <nav class="tabs"><button type="button" data-tab="macros" class="${tab === 'macros' ? 'on' : ''}">Мои сценарии</button><button type="button" data-tab="cmds" class="${tab === 'cmds' ? 'on' : ''}">Команды</button><button type="button" data-tab="gen" class="${tab === 'gen' ? 'on' : ''}">Генерация</button></nav>
      ${tab === 'macros' ? `<div class="book">${macros}</div><div class="zp-row"><button type="button" class="btn small" data-add="1">+ Новый сценарий</button><span class="hint" style="font-size:11.5px;color:var(--dim)">Шаги — обычные команды по строке. «подожди 5» — пауза.</span></div>` : ''}
      ${tab === 'cmds' ? `<div class="book">${cmds}</div><span class="hint" style="font-size:11.5px;color:var(--dim)">Слова через запятую. Можно на любом языке: «scene», «сцена», «кадр»…</span>` : ''}
      ${tab === 'gen' ? `<div class="field"><label>Кодовые слова генерации</label><textarea name="cw" style="min-height:120px">${esc(S.cfg.codewords)}</textarea><span class="hint">«video: видео, ролик» — фраза «ролик девушка идёт по пляжу» откроет видео-workflow с этим промптом.</span></div>` : ''}
      <div class="acts"><button type="button" class="btn ghost" data-undo="1">↶ Откатить к прошлой версии</button><button type="button" class="btn ghost" data-close>Закрыть</button><button class="btn primary">Сохранить</button></div>`,
      () => { readBook(); saveCommands().then(ok => ok && toast('Словарь сохранён.')); }, {
        wide: true, onClick: async e => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.tab) { readBook(); tab = b.dataset.tab; draw(); }
          if (b.dataset.add) { readBook(); CMD.macros.push({ id: 'm' + Date.now(), name: 'Новый сценарий', words: [], steps: [] }); draw(); }
          if (b.dataset.del) { readBook(); CMD.macros.splice(+b.dataset.del, 1); draw(); }
          if (b.dataset.run) { readBook(); const m = CMD.macros[+b.dataset.run]; closeSheet(); runMacro(m); }
          if (b.dataset.undo) {
            try { const r = await API.json('/directors-table/api/commands/undo', { method: 'POST' }); CMD = { words: r.words || {}, macros: r.macros || [] }; toast('Откатил к прошлой версии словаря.'); draw(); }
            catch (err) { toast('Откатывать некуда: ' + esc(err.message)); }
          }
        }
      });
  };
  const readBook = () => {
    $$('.book-m', sheet).forEach(el => { const m = CMD.macros[+el.dataset.i]; if (!m) return; m.name = el.querySelector('[data-f=name]').value.trim() || m.name; m.words = el.querySelector('[data-f=words]').value.split(',').map(x => x.trim()).filter(Boolean); m.steps = el.querySelector('[data-f=steps]').value.split('\n').map(x => x.trim()).filter(Boolean); });
    $$('[data-cmd]', sheet).forEach(inp => { const c = BUILTIN_CMDS.find(x => x.id === inp.dataset.cmd); const w = inp.value.split(',').map(x => x.trim()).filter(Boolean); if (w.length && w.join() !== c.words.join()) CMD.words[c.id] = w; else delete CMD.words[c.id]; });
    if (sheet.elements.cw) { S.cfg.codewords = sheet.elements.cw.value; save(); }
  };
  draw();
}

/* ================= маленькие зоны: Сценарий и Ассистент ================= */
function fillPanels() {
  const sp = $('.zone-panel[data-panel="script"]');
  if (sp) {
    const txt = S.scripts[S.sheet] || '';
    const n = typeof parseShots === 'function' ? parseShots(txt).length : txt.split('\n').filter(l => l.trim()).length;
    sp.innerHTML = `<textarea id="scriptTa" placeholder="Кадр 1: герой входит в таверну…&#10;Кадр 2: крупно — улыбка…&#10;&#10;По строке на кадр. Можно надиктовать.">${esc(txt)}</textarea>
      <div class="zp-row"><span class="zp-meta grow" id="scriptN">${n} кадр.</span><button class="zp-btn" data-sp="dict" title="Надиктовать (или удерживайте Ё)">🎙</button><button class="zp-btn" data-sp="split" title="Свободный текст → кадры (локальная модель; без неё — по предложениям)">✨</button><button class="zp-btn" data-sp="tasks" title="Отправить строки в «Задачи»">→</button><button class="zp-btn main" data-sp="film" title="Снять все кадры по очереди, связать их и склеить в ролик">🎬 Снять</button></div>`;
    const ta = sp.querySelector('textarea');
    ta.oninput = () => { S.scripts[S.sheet] = ta.value; save(); if (!splitCtl) sp.querySelector('#scriptN').textContent = parseShots(ta.value).length + ' кадр.'; };
    sp.onclick = e => {
      const a = e.target.closest('[data-sp]')?.dataset.sp;
      if (a === 'dict') startDictation(ta, () => ta.oninput());
      if (a === 'split') splitScript(ta);
      if (a === 'film') filmSheet();
      if (a === 'tasks') { taskForm.prompts = ta.value.trim(); taskForm.mode = 'line'; showRight('tasks'); toast('Сценарий в «Задачах»: выберите workflow и файлы.'); }
    };
  }
  const ap = $('.zone-panel[data-panel="assistant"]');
  if (ap) {
    const keep = $('#assistIn')?.value || pendingSay || '';
    ap.innerHTML = `<div class="zp-row"><input class="grow" id="assistIn" type="text" placeholder="видео: девушка идёт по пляжу…"><button class="zp-btn" data-ap="mic" title="Сказать (или удерживайте Ё)">🎙</button></div>
      <div class="va-row">${VA_ROW}</div>
      <div class="zp-reply">${recording ? `● Запись: ${recording.length} команд` : (lastReply || 'Скажите или напишите, что сделать.')}</div>
      <div class="zp-chips">${[...CMD.macros.slice(0, 3).map(m => [].concat(m.words)[0]).filter(Boolean), 'разложи', 'смотреть монтаж', 'очередь'].slice(0, 4).map(c => `<button data-cmd="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="zp-row zp-bottom"><button class="zp-btn grow" data-ap="book">📖 Словарь</button><button class="zp-btn${recording ? ' main' : ''}" data-ap="rec">${recording ? '■ Сохранить' : '● Запись'}</button></div>`;
    ap.querySelector('#assistIn').value = keep; ap.classList.toggle('has-say', !!keep.trim());
    const inp = ap.querySelector('input');
    inp.onkeydown = e => { if (e.key === 'Enter' && inp.value.trim()) { const v = inp.value.trim(); inp.value = ''; syncVa(); runCommand(v); } };
    inp.oninput = syncVa;
    ap.onclick = e => {
      const c = e.target.closest('[data-cmd]'); if (c) runCommand(c.dataset.cmd);
      if (e.target.closest('[data-ap="mic"]')) { dictTarget = null; startRec(); }
      if (e.target.closest('[data-ap="book"]')) openBook();
      if (e.target.closest('[data-ap="rec"]')) toggleRecording();
    };
  }
}

/* ================= радио ================= */
const rAudio = $('#rAudio'), radioEl = $('#radio'), rPanel = $('#rPanel');
let R = S.radio;
rAudio.volume = R.vol;
function rTrackSrc(t) { return t.url || (t.file ? API.view(t.file) : ''); }
function rPlayIdx(i) {
  if (!R.tracks.length) { rPanel.hidden = false; drawRadio(); return; }
  R.idx = (i + R.tracks.length) % R.tracks.length;
  rAudio.src = rTrackSrc(R.tracks[R.idx]); rAudio.play().catch(() => toast('Не удалось включить: ' + esc(R.tracks[R.idx].title)));
  save(); drawRadio();
}
function rNext(auto) {
  if (!R.tracks.length) return;
  if (auto && R.mode === 'one') { rAudio.currentTime = 0; rAudio.play(); return; }
  if (R.mode === 'shuffle') return rPlayIdx(Math.floor(Math.random() * R.tracks.length));
  if (auto && R.mode === 'order' && R.idx >= R.tracks.length - 1) { drawRadio(); return; }
  rPlayIdx(R.idx + 1);
}
rAudio.onended = () => rNext(true);
rAudio.onplay = rAudio.onpause = () => drawRadio();
$('#rPlay').onclick = () => { if (!rAudio.src) rPlayIdx(R.idx || 0); else rAudio.paused ? rAudio.play() : rAudio.pause(); };
$('#rNext').onclick = () => rNext(false);
$('#rPrev').onclick = () => { if (rAudio.currentTime > 3) { rAudio.currentTime = 0; return; } rPlayIdx(R.idx - 1); };
$('#rOpen').onclick = () => { rPanel.hidden = !rPanel.hidden; drawRadio(); };
$('#rAddUrl').onclick = () => { rPanel.hidden = false; drawRadio(); setTimeout(() => $('#rUrl')?.focus(), 30); };
$('#rAddFolder').onclick = () => $('#rFolderIn').click();
$('#rAddFiles').onclick = () => $('#rFilesIn').click();
async function rUpload(files) {
  const list = [...files].filter(f => (f.type || '').startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac|opus)$/i.test(f.name));
  if (!list.length) return toast('В папке нет аудиофайлов.');
  toast(`Загружаю треки: <b>${list.length}</b>…`);
  for (const f of list) { try { const file = await API.upload(f, 'directors-table-music'); R.tracks.push({ id: Date.now() + Math.random(), title: f.name.replace(/\.[^.]+$/, ''), file }); } catch (err) { toast('Не загрузился ' + esc(f.name)); } }
  save(); drawRadio(); toast(`В плейлисте: <b>${R.tracks.length}</b>`);
}
$('#rFolderIn').onchange = e => { rUpload(e.target.files); e.target.value = ''; };
$('#rFilesIn').onchange = e => { rUpload(e.target.files); e.target.value = ''; };
document.addEventListener('pointerdown', e => { if (!rPanel.hidden && !radioEl.contains(e.target)) { rPanel.hidden = true; drawRadio(); } });
function drawRadio() {
  radioEl.classList.toggle('playing', !rAudio.paused);
  radioEl.classList.toggle('open', !rPanel.hidden);
  $('#rPlay').textContent = rAudio.paused ? '♪' : '❚❚';
  const t = R.tracks[R.idx];
  $('#rTitle').textContent = t ? t.title : 'Радио · музыка';
  $('#rSub').textContent = t ? (t.url ? 'интернет-радио' : `трек ${R.idx + 1} из ${R.tracks.length}`) + ' · ' + { order: 'по порядку', all: 'повтор всех', one: 'повтор трека', shuffle: 'вперемешку' }[R.mode] : 'добавьте треки или ссылку';
  if (rPanel.hidden) return;
  rPanel.innerHTML = `<h4>Режим</h4><div class="r-modes">${[['order', 'По порядку'], ['all', 'Повтор всех'], ['one', 'Повтор трека'], ['shuffle', 'Вперемешку']].map(([k, l]) => `<button data-mode="${k}" class="${R.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="r-row"><span style="font-size:11px;color:var(--dim)">Громкость</span><input type="range" id="rVol" min="0" max="1" step="0.05" value="${R.vol}"></div>
    <h4>Плейлист</h4><div class="r-list">${R.tracks.map((t, i) => `<div data-i="${i}" class="${i === R.idx ? 'on' : ''}"><span>${t.url ? '📻 ' : '♪ '}${esc(t.title)}</span><button data-del="${i}" title="Убрать">✕</button></div>`).join('') || '<span class="r-note">Пусто.</span>'}</div>
    <div class="r-row"><button class="btn small" id="rAdd">Добавить треки…</button><input type="file" id="rFiles" accept="audio/*" multiple hidden></div>
    <div class="r-row"><input type="text" id="rUrl" placeholder="Ссылка на поток радио (https://…mp3)"><button class="btn small" id="rUrlAdd">Добавить</button></div>
    <div class="r-note">Треки загружаются в ComfyUI и остаются между запусками. Музыка играет отдельно от монтажа.</div>`;
}
rPanel.addEventListener('click', e => {
  const m = e.target.closest('[data-mode]'); if (m) { R.mode = m.dataset.mode; save(); drawRadio(); return; }
  const d = e.target.closest('[data-del]'); if (d) { const i = +d.dataset.del; R.tracks.splice(i, 1); if (R.idx >= R.tracks.length) R.idx = 0; save(); drawRadio(); return; }
  const it = e.target.closest('[data-i]'); if (it) { rPlayIdx(+it.dataset.i); return; }
  if (e.target.id === 'rAdd') $('#rFiles').click();
  if (e.target.id === 'rUrlAdd') { const u = $('#rUrl').value.trim(); if (!/^https?:\/\//.test(u)) return toast('Нужна ссылка вида https://…'); R.tracks.push({ id: Date.now(), title: u.replace(/^https?:\/\//, '').slice(0, 40), url: u }); save(); drawRadio(); }
});
rPanel.addEventListener('input', e => { if (e.target.id === 'rVol') { R.vol = +e.target.value; rAudio.volume = R.vol; save(); } });
rPanel.addEventListener('change', e => { if (e.target.id === 'rFiles') rUpload(e.target.files); });

/* ================= настройки ================= */
$('#btnSettings').onclick = () => {
  const c = S.cfg;
  sheetOpen(`<h3>Настройки</h3>
    <div class="field"><label for="sLang">Язык интерфейса</label><select id="sLang" name="lang" data-noi18n>${(window.DT_LANGS || []).map(([k, n, f]) => `<option value="${k}" ${k === (window.DT_LANG || 'ru') ? 'selected' : ''}>${f} ${n}</option>`).join('')}</select></div>
    <div class="field"><label for="sBackend">Адрес ComfyUI</label><input type="text" id="sBackend" name="backend" placeholder="${esc(API.base())}" value="${esc(c.backend)}"><span class="hint">Пусто — тот ComfyUI, из которого открыт стол. Удалённый сервер или арендованная видеокарта: укажите адрес и запустите там ComfyUI с флагом --enable-cors-header.</span></div>
    <div class="field"><label for="sHold">Задержка кругового меню при удержании, мс</label><div class="row2"><input type="range" id="sHold" name="hold" min="150" max="900" step="50" value="${c.holdMs}"><output>${c.holdMs}</output></div><span class="hint">Правая кнопка — сразу. Пробел во время перетаскивания — тоже.</span></div>
    <label class="field inline"><input type="checkbox" name="magnet" ${c.magnet ? 'checked' : ''}> Мягкий магнит и инерция при броске карточки</label>
    <div class="field"><label for="sRows">Рядов клавиш</label><div class="row2"><input type="range" id="sRows" name="rows" min="1" max="5" value="${c.pianoRows}"><output>${c.pianoRows}</output></div><span class="hint">1 — только белые и чёрные. 2 — цветной ряд A–L. 3 — ряд Z–M. Дальше — ряды без клавиатуры, только мышью.</span></div>
    <div class="field"><label for="sScale">Размер клавиш</label><div class="row2"><input type="range" id="sScale" name="scale" min="0.6" max="1.4" step="0.05" value="${c.pianoScale}"><output>${c.pianoScale}</output></div></div>
    <div class="field"><label for="sVE">Распознавание речи</label><select id="sVE" name="ve"><option value="whisper" ${c.voiceEngine === 'whisper' ? 'selected' : ''}>Whisper на этом компьютере (без интернета)</option><option value="browser" ${c.voiceEngine === 'browser' ? 'selected' : ''}>Встроенное в браузер (Chrome, через интернет)</option></select></div>
    <div class="field"><label>Whisper</label><div class="row2"><select name="vm">${['tiny', 'base', 'small', 'medium', 'turbo'].map(m => `<option ${c.voiceModel === m ? 'selected' : ''}>${m}</option>`).join('')}</select><select name="vd"><option value="cpu" ${c.voiceDevice === 'cpu' ? 'selected' : ''}>процессор (не мешает генерации)</option><option value="cuda" ${c.voiceDevice === 'cuda' ? 'selected' : ''}>видеокарта (быстрее)</option></select><select name="vl">${[['ru', 'русский'], ['uk', 'украинский'], ['en', 'английский'], ['', 'авто']].map(([k, l]) => `<option value="${k}" ${c.voiceLang === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div><span class="hint">small — хорошо понимает русский и украинский. При первом использовании модель скачается (~0,5 ГБ).</span><label class="chk"><input type="checkbox" name="den" ${c.dictEn !== false ? 'checked' : ''}> Диктовка в поля сразу переводится на английский (модели лучше понимают английские промпты; turbo не умеет переводить — берите small или medium)</label></div>
    <div class="field"><label for="sCW">Кодовые слова</label><textarea id="sCW" name="cw">${esc(c.codewords)}</textarea><span class="hint">«video: видео, ролик» — фраза «ролик девушка идёт по пляжу» откроет видео-workflow с этим промптом. Также понимаю: «сцена три», «разложи», «монтаж», «смотреть монтаж», «замок», «стоп», «поехали», «выдели все картинки».</span></div>
    <div class="field"><label>✨ Помощник промптов (локально, Ollama)</label><div class="row2"><input type="text" name="llmu" value="${esc(c.llmUrl || '')}" placeholder="http://127.0.0.1:11434"><select name="llmm" id="llmModels"><option value="">${c.llmModel ? esc(c.llmModel) : 'первая установленная'}</option></select></div><span class="hint" id="llmHint">Превращает ваше пожелание в правильный промпт под модель по «файлу режиссёра». Модель выгружается сразу после ответа — видеопамять остаётся генерации. Нет Ollama? Установите с ollama.com и выполните <code>ollama pull gemma3:4b</code>.</span></div>
    <div class="acts"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Сохранить</button></div>`,
    f => {
      c.llmUrl = f.llmu.value.trim() || 'http://127.0.0.1:11434'; c.llmModel = f.llmm.value;
      if (f.lang && f.lang.value !== (window.DT_LANG || 'ru')) { c.lang = f.lang.value; save(); setTimeout(() => location.reload(), 400); }
      const changed = f.backend.value.trim() !== c.backend;
      Object.assign(c, { backend: f.backend.value.trim(), holdMs: +f.hold.value, magnet: f.magnet.checked, pianoRows: +f.rows.value, pianoScale: +f.scale.value, voiceEngine: f.ve.value, voiceModel: f.vm.value, voiceDevice: f.vd.value, voiceLang: f.vl.value, dictEn: f.den.checked, codewords: f.cw.value });
      save(); renderPiano();
      if (changed) { try { ws && ws.close(); } catch (_) { } loadActions(); pollStats(); }
    }, { wide: true, init: () => loadLlmModels() });
};
async function loadLlmModels() {
  const sel = $('#llmModels'), hint = $('#llmHint'); if (!sel) return;
  try {
    const j = await (await fetch(API.url('/directors-table/api/llm/models?url=' + encodeURIComponent(S.cfg.llmUrl || '')))).json();
    if (!j.ok) { hint.innerHTML = '⚠ Ollama не отвечает. Установите с <b>ollama.com</b>, запустите и выполните <code>ollama pull gemma3:4b</code> — небольшая модель, хватит и при генерации.'; return; }
    if (!j.models.length) { hint.innerHTML = 'Ollama работает, но моделей нет. Выполните в терминале: <code>ollama pull gemma3:4b</code>'; return; }
    sel.innerHTML = `<option value="">первая установленная</option>` + j.models.map(m => `<option ${m === S.cfg.llmModel ? 'selected' : ''}>${esc(m)}</option>`).join('');
    hint.textContent = `Ollama на связи: моделей ${j.models.length}. Модель выгружается сразу после ответа — видеопамять остаётся генерации.`;
  } catch (_) { }
}
/* ✨ улучшить промпт: пожелание → промпт под модель (по файлу режиссёра) */
async function enhancePrompt(wf, text, inputsDesc) {
  const r = await fetch(API.url('/directors-table/api/llm/enhance'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wf: wf.id, idea: text, inputs: inputsDesc, url: S.cfg.llmUrl, model: S.cfg.llmModel, cpu: S.cards.some(c => c.status === 'running') }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === 'no-models') throw new Error('в Ollama нет моделей. Выполните: ollama pull gemma3:4b');
    if (j.error === 'no-ollama') throw new Error('локальный помощник не найден. Установите Ollama (ollama.com) и модель: ollama pull gemma3:4b');
    throw new Error(j.error || 'ошибка');
  }
  return j;
}

/* ================= клавиатура ================= */
window.addEventListener('keydown', e => {
  const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  if (e.key === 'Escape' && !$('#wfView').hidden && sheetBack.hidden) { showTab(null); return; }
  if (e.key === 'Escape') { if (M) { closeRadial(false); if (G) { G = null; remG(); } } else if (!overlay.hidden) closeResults(); else if (!sheetBack.hidden) closeSheet(); else if (!pop.hidden) closePop(); else { setSel([]); } return; }
  if (!sheetBack.hidden) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && sheet.querySelector('.btn.primary')) { e.preventDefault(); sheet.requestSubmit(); } if (e.code === 'Backquote' && !e.repeat && typing) { e.preventDefault(); startDictation(e.target); } return; }
  if (e.code === 'Backquote' && !e.repeat && !typing) { e.preventDefault(); startRec(); return; }
  if (typing) return;
  if (e.code === 'Space' && G && G.mode === 'drag') { // Пробел во время перетаскивания — меню
    e.preventDefault();
    const id = G.id; endCanvasDragSilently();
    if (openRadialFor(id, lastXY[0], lastXY[1])) { G.mode = 'menu'; trackRadial(lastXY[0], lastXY[1]); }
    return;
  }
  if (e.code === 'Space' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); autoSort(); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !S.locked) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') { e.preventDefault(); setSel(visibleCards().map(c => c.id)); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.shiftKey && e.code === 'KeyL') return toggleLock();
  if (e.shiftKey && e.code === 'KeyK') { S.cfg.pianoCollapsed = !S.cfg.pianoCollapsed; save(); renderPiano(); return; }
  if (e.shiftKey && e.code === 'KeyJ') { const any = Object.values(S.cfg.rowsHidden || {}).some(Boolean); S.cfg.rowsHidden = {}; if (!any) for (let r = 1; r < S.cfg.pianoRows; r++) S.cfg.rowsHidden[r] = true; save(); renderPiano(); return; }
  if (e.shiftKey && e.code === 'KeyH') return toggleHints();
  if (e.shiftKey && e.code === 'KeyG') return cycleLines();
  if (e.shiftKey && e.code === 'KeyM') { const r = $('#right'); if (r.classList.contains('open') && rTab === 'cut') r.classList.remove('open'); else showRight('cut'); return; }
  const wi = WHITE.indexOf(e.code);
  if (wi >= 0) { e.preventDefault(); if (S.keymap[e.code]) { runBinding(e.code); return; } const sh = sheetAtKey(wi); sh ? openSheet(sh.id) : newSheet(wi); return; }
  if (S.locked) return;
  if (BLACK.some(b => b.code === e.code) || (ROWS[1].includes(e.code) && S.cfg.pianoRows >= 2) || (ROWS[2].includes(e.code) && S.cfg.pianoRows >= 3)) { e.preventDefault(); runBinding(e.code); pressKeyVisual(e.code); return; }
  if ((e.code === 'Delete' || e.code === 'Backspace') && sel.size) { e.preventDefault(); removeCards([...sel]); return; }
  if (e.code === 'Enter' && document.activeElement?.classList.contains('card')) { const c = byId(+document.activeElement.dataset.id); c.type === 'widget' ? openResults(c) : openDetails(c); }
});
window.addEventListener('keyup', e => { if (e.code === 'Backquote' && rec) stopRec(); });
function pressKeyVisual(code) { const el = piano.querySelector(`[data-bind="${code}"]`); if (el) el.animate([{ transform: 'translateY(3px)' }, { transform: 'none' }], { duration: 160 }); }
function endCanvasDragSilently() {
  (G.group || []).forEach(g => { g.c.x = g.x0; g.c.y = g.y0; const el = els.get(g.c.id); if (el) { el.classList.remove('dragging'); el.style.pointerEvents = ''; el.style.left = g.c.x + 'px'; el.style.top = g.c.y + 'px'; } });
  highlightTarget(null); $$('.area.drop', areasEl).forEach(x => x.classList.remove('drop'));
}


/* ================= workflow внутри стола: вкладки с настоящим ComfyUI ================= */
const wfTabs = [];           // { wfId, frame, ready, error }
let activeTab = null;
function renderTabs() {
  const nav = $('#wfTabs');
  nav.innerHTML = wfTabs.length ? `<button data-tab="" class="${activeTab ? '' : 'on'}">Стол</button>` + wfTabs.map(t => { const wf = wfById(t.wfId); return `<button data-tab="${esc(t.wfId)}" draggable="true" title="Перетащите на клавишу — она будет открывать этот workflow" class="${activeTab === t.wfId ? 'on' : ''}" style="--c:${KIND_C[wf?.kind] || '#8f74f2'}"><i></i>${esc(wf ? wf.title : t.wfId)}<em class="x" data-close-tab="${esc(t.wfId)}" title="Закрыть вкладку">×</em></button>`; }).join('') : '';
}
$('#wfTabs').addEventListener('click', e => {
  const x = e.target.closest('[data-close-tab]'); if (x) { closeTab(x.dataset.closeTab); return; }
  const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab || null);
});
/* вкладку workflow можно перетащить на клавишу пианино */
$('#wfTabs').addEventListener('dragstart', e => { const b = e.target.closest('[data-tab]'); if (!b || !b.dataset.tab) return; e.dataTransfer.setData('text/dt-wf', b.dataset.tab); e.dataTransfer.effectAllowed = 'link'; piano.classList.add('picking'); });
$('#wfTabs').addEventListener('dragend', () => { piano.classList.remove('picking'); $$('#piano .hot').forEach(x => x.classList.remove('hot')); });
piano.addEventListener('dragover', e => { if (!e.dataTransfer.types.includes('text/dt-wf')) return; const k = e.target.closest('[data-bind]'); $$('#piano .hot').forEach(x => x !== k && x.classList.remove('hot')); if (k) { e.preventDefault(); k.classList.add('hot'); } });
piano.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/dt-wf') && e.target.closest('.key[data-sheet], [data-new]')) e.preventDefault(); });
piano.addEventListener('drop', e => {
  if (!e.dataTransfer.types.includes('text/dt-wf') || e.target.closest('[data-bind]')) return;
  const nk = e.target.closest('[data-new]'); if (nk) { e.preventDefault(); bindOpen(WHITE[+nk.dataset.new], e.dataTransfer.getData('text/dt-wf')); return; }
  if (e.target.closest('.key[data-sheet]')) { e.preventDefault(); toast('Эта клавиша занята сценой. Положите workflow на пустую клавишу «+», на чёрную или на нижние ряды.'); }
});
piano.addEventListener('drop', e => { const id = e.dataTransfer.getData('text/dt-wf'); const k = e.target.closest('[data-bind]'); if (!id || !k) return; e.preventDefault(); e.stopPropagation(); bindOpen(k.dataset.bind, id); });
function openWorkflowTab(wfId) {
  const wf = wfById(wfId); if (!wf) { toast('Workflow не найден в библиотеке.'); return; }
  let t = wfTabs.find(x => x.wfId === wfId);
  if (!t) {
    const frame = document.createElement('iframe');
    frame.src = API.base() + '/?directors-table=' + encodeURIComponent(wfId);
    frame.dataset.wf = wfId;
    t = { wfId, frame, ready: false };
    wfTabs.push(t);
    $('#wfFrames').appendChild(frame);
    const load = document.createElement('div'); load.className = 'wfload'; load.textContent = 'Загружаю ComfyUI…'; load.dataset.wf = wfId; $('#wfFrames').appendChild(load);
    frame.addEventListener('load', () => injectWorkflow(t, load));
  }
  showTab(wfId);
}
async function injectWorkflow(t, load) {
  const wf = wfById(t.wfId);
  const started = Date.now();
  // ждём, пока внутри iframe поднимется приложение ComfyUI
  const types = wf.ui ? [...new Set((wf.ui.nodes || []).map(n => n.type).filter(Boolean))] : [...new Set(Object.values(wf.workflow).map(n => n.class_type).filter(Boolean))];
  let waitedTypes = false;
  while (Date.now() - started < 90000) {
    const win = t.frame.contentWindow;
    const app = win?.app || win?.comfyAPI?.app?.app;
    // ждём не только приложение, но и регистрацию нод — иначе ComfyUI посчитает их «неизвестными»
    const reg = win?.LiteGraph?.registered_node_types;
    const known = reg ? types.filter(ct => reg[ct]).length : 0;
    const allKnown = reg && known === types.length;
    if (reg && !allKnown) load.textContent = `Загружаю ноды ComfyUI… ${known} из ${types.length}`;
    // если каких-то нод так и нет (не установлен пакет) — через 25 с открываем как есть, ComfyUI покажет, чего не хватает
    if (!allKnown && reg && known > 0 && Date.now() - started > 25000) waitedTypes = true;
    if (!reg && app && app.graph && Date.now() - started > 15000) waitedTypes = true; // запасной путь, если реестр нод не виден
    if (app && app.graph && typeof app.loadApiJson === 'function' && (allKnown || waitedTypes)) {
      try {
        if (wf.ui && typeof app.loadGraphData === 'function') await app.loadGraphData(JSON.parse(JSON.stringify(wf.ui)), true, true, wf.title);
        else await app.loadApiJson(JSON.parse(JSON.stringify(wf.workflow)), wf.title);
        t.ready = true; t.app = app; load.remove();
        tidyFrame(t, app, wf);
        if (S.lastRun?.[wf.id]) setTimeout(() => applyPromptToGraph(app, S.lastRun[wf.id]), 300); // последняя реальная картинка и промпт
        if (!wf.ui) toast('Этот workflow импортирован без раскладки — ноды стоят столбиком. Перетащите на стол его обычный файл, чтобы вернуть группы и связи.');
        return;
      }
      catch (e) { load.textContent = 'ComfyUI не смог открыть workflow: ' + e.message; return; }
    }
    await new Promise(r => setTimeout(r, 400));
  }
  load.textContent = 'ComfyUI не загрузился внутри стола. Можно открыть его в отдельной вкладке браузера.';
}
/* внутри стола — только workflow виджета: прячем панель вкладок ComfyUI и закрываем лишние вкладки */
function tidyFrame(t, app, wf) {
  try {
    const d = t.frame.contentDocument;
    if (d && !d.getElementById('dt-tidy')) {
      const st = d.createElement('style'); st.id = 'dt-tidy';
      st.textContent = '.workflow-tabs-container,.workflow-tabs-container-desktop,.workflow-tabs{display:none!important}';
      d.head.appendChild(st);
    }
  } catch (e) {}
  t.types = typesOf(wf.ui, wf.workflow);
  setTimeout(() => { // стартовый «Unsaved Workflow» ComfyUI нам не нужен
    try {
      const ws = app.extensionManager?.workflow, act = ws?.activeWorkflow;
      for (const w of [...(ws?.openWorkflows || [])]) if (w !== act && !w.isModified && typeof ws.closeWorkflow === 'function') ws.closeWorkflow(w);
    } catch (e) {}
  }, 800);
}
/* во вкладке workflow показываем то, что реально запускалось: картинку, звук, промпт, seed */
function applyPromptToGraph(app, prompt) {
  const g = app?.graph; if (!g || typeof g.getNodeById !== 'function' || !prompt) return 0;
  let n = 0;
  for (const [id, nd] of Object.entries(prompt)) {
    const node = g.getNodeById(+id) || g.getNodeById(id); if (!node || !node.widgets) continue;
    for (const [k, v] of Object.entries(nd.inputs || {})) {
      if (Array.isArray(v) || v === undefined) continue;
      const w = node.widgets.find(x => x.name === k); if (!w || w.value === v) continue;
      w.value = v; try { w.callback && w.callback(v, app.canvas, node); } catch (_) { } n++;
    }
  }
  try { g.setDirtyCanvas && g.setDirtyCanvas(true, true); } catch (_) { }
  return n;
}
function syncTabToRun(wfId) { const t = wfTabs.find(x => x.wfId === wfId); if (t && t.app && S.lastRun?.[wfId]) applyPromptToGraph(t.app, S.lastRun[wfId]); }
/* открыть вкладку workflow и показать ноду, на которой сейчас работа */
function showNodeInTab(wfId, nodeId) {
  openWorkflowTab(wfId);
  const t0 = Date.now();
  const go = () => {
    const t = wfTabs.find(x => x.wfId === wfId);
    if (!t || !t.app) { if (Date.now() - t0 < 60000) setTimeout(go, 400); return; }
    const g = t.app.graph, node = g?.getNodeById?.(+nodeId) || g?.getNodeById?.(nodeId);
    if (!node) return toast('Эту ноду не нашёл в графе.');
    try { t.app.canvas.centerOnNode(node); t.app.canvas.selectNode(node, false); t.app.canvas.setDirty(true, true); } catch (_) { }
    toast(`Сейчас работает: <b>${esc(node.title || node.type)}</b> — выделена в графе.`);
  };
  go();
}
function typesOf(ui, api) {
  if (ui?.nodes) return ui.nodes.map(n => n.type).filter(Boolean);
  return Object.values(api || {}).map(n => n.class_type).filter(Boolean);
}
/* открыт ли внутри именно наш workflow (а не стартовый шаблон ComfyUI) */
function frameHasOurGraph(t) {
  const now = (t.app.graph?._nodes || t.app.graph?.nodes || []).map(n => n.type);
  if (!now.length || !t.types?.length) return true; // не можем проверить — не мешаем
  const mine = new Set(t.types);
  const hit = now.filter(x => mine.has(x)).length;
  return hit / Math.max(now.length, 1) >= 0.5;
}
async function reloadOurGraph(t) {
  const wf = wfById(t.wfId);
  if (wf.ui) await t.app.loadGraphData(JSON.parse(JSON.stringify(wf.ui)), true, true, wf.title);
  else await t.app.loadApiJson(JSON.parse(JSON.stringify(wf.workflow)), wf.title);
}
function showTab(wfId) {
  activeTab = wfId;
  $('#wfView').hidden = !wfId;
  wfTabs.forEach(t => { t.frame.hidden = t.wfId !== wfId; $$(`.wfload[data-wf="${CSS.escape(t.wfId)}"]`).forEach(l => l.hidden = t.wfId !== wfId); });
  if (wfId) $('#wfvTitle').textContent = wfById(wfId)?.title || wfId;
  renderTabs();
}
function closeTab(wfId) {
  const i = wfTabs.findIndex(t => t.wfId === wfId); if (i < 0) return;
  wfTabs[i].frame.remove(); $$(`.wfload[data-wf="${CSS.escape(wfId)}"]`).forEach(l => l.remove());
  wfTabs.splice(i, 1);
  showTab(activeTab === wfId ? null : activeTab);
}
$('#wfvBack').onclick = () => showTab(null);
/* во вкладке workflow видно, что сейчас считается этим виджетом */
setInterval(() => {
  const el = $('#wfvRun'); if (!el) return;
  const run = activeTab && S.cards.find(c => c.actionId === activeTab && c.status === 'running');
  const wait = activeTab ? S.cards.filter(c => c.actionId === activeTab && c.status === 'queued').length : 0;
  el.hidden = !run && !wait;
  if (run) el.textContent = `● Сейчас: ${byId(run.parent)?.title || 'задача'} → ${runBadge(run)} · ${runStatus(run)}${wait ? ' · ждут ' + wait : ''}`;
  else if (wait) el.textContent = `В очереди: ${wait}`;
  $('#wfvHint').hidden = !!run;
}, 1000);
$('#wfvSave').onclick = async () => {
  const t = wfTabs.find(x => x.wfId === activeTab); if (!t || !t.app) { toast('ComfyUI ещё загружается.'); return; }
  const wf = wfById(t.wfId);
  if (!frameHasOurGraph(t)) {
    sheetOpen(`<h3>Внутри открыт другой workflow</h3><p>Сейчас во вкладке не «${esc(wf.title)}», а другой граф (например, стартовый шаблон ComfyUI). Сохранять его в виджет не буду, чтобы не испортить виджет.</p><div class="acts"><button type="button" class="btn primary" data-act="reload">Вернуть «${esc(wf.title)}»</button><button type="button" class="btn ghost" data-close>Отмена</button></div>`, null,
      { onClick: async e => { const b = e.target.closest('[data-act]'); if (!b) return; closeSheet(); if (b.dataset.act === 'reload') { await reloadOurGraph(t); toast('Workflow виджета открыт заново.'); } } });
    return;
  }
  try {
    const p = await t.app.graphToPrompt();
    const api = p.output || p;
    const def = { ...wf, workflow: api };
    if (p.workflow) def.ui = p.workflow;
    delete def.origin; delete def.kind;
    const ok = (wf.params || []).every(pr => (pr.targets || []).every(tg => api[tg.node]));
    if (!ok) { // ноды поменялись — определяем поля заново, название и место в меню сохраняем
      const fresh = analyzeWorkflow(api, wf.title);
      def.params = fresh.params.filter(x => x.on !== false).map(({ on, src, role, ...x }) => x);
      def.output = fresh.output; def.accepts = fresh.accepts;
    }
    if (!api[def.output.node]) throw new Error('В workflow больше нет ноды сохранения результата.');
    await API.json('/directors-table/api/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(def) });
    await loadActions();
    toast(ok ? `Сохранено в виджет <b>${esc(wf.title)}</b>.` : `Сохранено. Ноды изменились — поля виджета определены заново.`);
  } catch (e) { toast('Не сохранилось: ' + esc(e.message)); }
};

/* подсветка области под курсором */
board.addEventListener('pointermove', e => {
  if (G) return; const [x, y] = toLogical(e.clientX, e.clientY); const a = areaAt(x, y); setActiveArea(a ? a.id : null);
  // шестерёнка проявляется, только когда курсор над названием зоны (или над самой шестерёнкой)
  let hit = null;
  if (a) { const al = $(`.area[data-area="${a.id}"] .al`, areasEl); if (al) { const r = al.getBoundingClientRect(); if (e.clientX >= r.left - 8 && e.clientX <= r.right + 30 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6) hit = a.id; } }
  $$('.zgear', areasEl).forEach(g => g.classList.toggle('show', g.dataset.zone === hit));
});
areasEl.addEventListener('pointerdown', e => { if (e.target.closest('.zgear')) e.stopPropagation(); });
areasEl.addEventListener('click', e => { const g = e.target.closest('.zgear'); if (g) { e.stopPropagation(); zoneSettings(g.dataset.zone); } });
board.addEventListener('pointerleave', () => setActiveArea(null));

/* ================= запуск ================= */
async function boot() {
  try {
    const srv = normalize(await API.json('/directors-table/api/project'));
    if (srv && (srv.savedAt || 0) > (S.savedAt || 0)) { S = srv; R = S.radio; rAudio.volume = R.vol; }
  } catch (_) { }
  applyZones();
  document.body.classList.toggle('locked', S.locked);
  fit(); render(); updateLayoutSel(); drawRadio();
  loadCommands().then(() => fillPanels());
  connectWS(); loadActions(); pollStats(); setInterval(pollStats, 2000);
  setInterval(() => { if (S.cards.some(c => c.status === 'running')) jobChanged(); }, 5000);
}
boot();
window.__dt = { get S() { return S; }, API, get WFS() { return WFS; }, analyzeWorkflow };

/* ================= настройки зоны (шестерёнка) ================= */
const ZONE_COLORS = ['#3fd2ff', '#f0ff41', '#ff5fa8', '#ff6b5e', '#6f8cff', '#ff8a3d', '#8f74f2', '#5fe3a1', '#c9f05a', '#f2b94c'];
function zoneSettings(id) {
  const a = areasOf().find(x => x.id === id); if (!a) return;
  const cfg = S.zoneCfg[id] || {}, base = layoutDef((S.sheets.find(s => s.id === S.sheet) || {}).layout).areas.find(x => x.id === id) || a;
  let color = a.c;
  const draw = () => sheetOpen(`<h3 style="color:${color}">⚙ ${esc(a.label)}</h3><div class="sub">${esc(a.note || '')}</div>
    <div class="field"><label for="zName">Название</label><input type="text" id="zName" name="zn" value="${esc(a.label)}" maxlength="30"></div>
    <div class="field"><label>Цвет</label><div class="swatches big">${[...new Set([base.c, ...ZONE_COLORS])].map(c => `<button type="button" data-zc="${c}" class="${c === color ? 'cur' : ''}" style="--sw:${c}"></button>`).join('')}</div></div>
    <label class="chk"><input type="checkbox" name="zl" ${a.lines === false ? '' : 'checked'}> Показывать линии этой зоны</label>
    <div class="acts"><button type="button" class="btn ghost" data-z="reset">Как было</button><button type="button" class="btn ghost" data-z="edit">Редактор зон…</button><button type="button" class="btn" data-z="tour">▶ Как это работает</button><button type="submit" class="btn primary">Сохранить</button></div>`,
    f => { const v = { label: f.zn.value.trim() || base.label, c: color, lines: f.zl.checked }; const d = {}; if (v.label !== base.label) d.label = v.label; if (v.c !== base.c) d.c = v.c; if (!v.lines) d.lines = false; if (Object.keys(d).length) S.zoneCfg[id] = d; else delete S.zoneCfg[id]; save(); renderAreas(); },
    { onClick: e => {
        const sw = e.target.closest('[data-zc]'); if (sw) { color = sw.dataset.zc; $$('.swatches [data-zc]', sheet).forEach(b => b.classList.toggle('cur', b === sw)); sheet.querySelector('h3').style.color = color; return; }
        const z = e.target.closest('[data-z]')?.dataset.z;
        if (z === 'reset') { delete S.zoneCfg[id]; save(); renderAreas(); closeSheet(); toast('Зона как была.'); }
        if (z === 'tour') { closeSheet(); startTour(id); }
        if (z === 'edit') { closeSheet(); openZoneEditor(); }
      } });
  draw();
}

/* ================= «Как это работает»: живой показ курсором ================= */
let TOUR = null;
const zoneEl = id => $(`.area[data-area="${id}"]`, areasEl);
const zoneLabel = id => $(`.area[data-area="${id}"] .al`, areasEl);
const firstWidget = () => $('.card.widget', cardsEl);
const TOURS = {
  video: () => [
    { el: () => zoneLabel('video'), text: '<b>Видео</b> — сюда ложатся видео: исходники и всё, что сгенерировано.' },
    { el: () => firstWidget() || zoneEl('video'), text: '<b>Виджет</b> — это ваш workflow ComfyUI. Перетащите на него картинку — откроется окно с промптом и настройками.', click: true },
    { el: () => firstWidget() || zoneEl('video'), text: '<b>Правый клик</b> по виджету — круговое меню: «Запустить» (как в прошлый раз / изменить промпт / все настройки), «■ Стоп», «Внутрь», «На клавишу».' },
    { el: () => firstWidget() || zoneEl('video'), text: '<b>Двойной клик</b> — открыть сам граф ComfyUI во вкладке сверху. Поправили ноды → «Сохранить в виджет».' },
    { el: () => $('#piano'), text: 'Перетащите виджет на <b>пустую клавишу</b> — она будет открывать этот workflow одним нажатием.' },
    { el: () => $('.card.widget .stack', cardsEl) || firstWidget() || zoneEl('video'), text: 'Готовые видео копятся в виджете: <b>«N ▸»</b> — посмотреть результаты, вытащить на стол или в монтаж.' },
  ],
  cut: () => [
    { el: () => zoneEl('cut'), text: '<b>Монтаж</b> — положите сюда клипы. Порядок — слева направо.', click: true },
    { el: () => zoneEl('cut'), text: 'Чёрная клавиша <b>Q</b> или пункт меню «В монтаж» — отправить выделенное сюда одним нажатием.' },
    { el: () => $('#right .edge-grip') || $('#right'), text: '<b>Shift+M</b> — правая панель «Монтаж»: смотреть все клипы подряд, с музыкой из зоны «Музыка».' },
  ],
  assist: () => [
    { el: () => zoneEl('assist'), text: '<b>Ассистент</b> — скажите или напишите, что сделать. Всё работает локально.' },
    { el: () => $('#assistIn'), text: 'Начните с кодового слова: <b>«видео: девушка идёт по пляжу»</b> — откроется видео-workflow с этим промптом.', type: 'видео: девушка идёт по пляжу' },
    { el: () => $('.zone-panel[data-panel="assistant"] [data-ap="mic"]'), text: 'Или голосом: удерживайте <b>Ё</b> (`) и говорите. Команды: «разложи», «стоп», «сцена три», «смотреть монтаж».', click: true },
    { el: () => $('.zone-panel[data-panel="assistant"] [data-ap="book"]') || zoneEl('assist'), text: '<b>Словарь</b> — свои команды и макросы (цепочки действий, как экшены в Photoshop), с откатом версий.' },
    { el: () => $('.zone-panel[data-panel="assistant"] [data-ap="rec"]') || zoneEl('assist'), text: '<b>● Запись</b> — выполните несколько команд, и они сохранятся как один макрос.' },
  ],
  fx: () => [
    { el: () => zoneLabel('fx'), text: '<b>Эффекты</b> — VFX на LTX: портал, огонь, искры, дождь, молния, ударная волна, рассыпание в пыль…' },
    { el: () => $('.card.widget', cardsEl) && [...$$('.card.widget', cardsEl)].find(x => byId(+x.dataset.id)?.wf === 'ltx2-vfx') || zoneEl('fx'), text: 'Бросьте картинку на виджет <b>«VFX-эффект»</b>, выберите эффект и <b>кликните по кадру</b> — там он и появится.', click: true },
    { el: () => zoneEl('fx'), text: '<b>Как это устроено:</b> код рисует черновик — где и как движется эффект, а LTX превращает его в реалистичное видео со звуком.' },
    { el: () => zoneEl('fx'), text: 'Кнопка <b>«👁 Черновик»</b> за пару секунд покажет черновик на вашем кадре — до долгой генерации.' },
  ],
  script: () => [
    { el: () => zoneEl('script'), text: '<b>Сценарий</b> — пишите или диктуйте по одной строке на кадр.' },
    { el: () => $('.zone-panel[data-panel="script"] textarea'), text: 'Например: «Кадр 1: герой выходит из хижины» / «Кадр 2: крупно — улыбается».', type: 'Кадр 1: герой выходит из хижины\nКадр 2: крупно — улыбается' },
    { el: () => $('.zone-panel[data-panel="script"] [data-sp="tasks"]'), text: '<b>«В задачи →»</b> — каждая строка станет отдельной генерацией. Выберите workflow и картинки → «В план» или сразу в очередь.', click: true },
  ],
};
function genericTour(id) {
  const a = areasOf().find(x => x.id === id) || {};
  const kinds = (a.kinds || []).map(k => ({ image: 'картинки', video: 'видео', audio: 'звук', text: 'текст' }[k])).filter(Boolean).join(', ');
  return [
    { el: () => zoneLabel(id), text: `<b>${esc(a.label || '')}</b> — ${esc(a.note || '')}.` },
    { el: () => zoneEl(id), text: kinds ? `Сюда стол сам раскладывает: <b>${kinds}</b>. Перетащите файлы из проводника — разложатся по зонам.` : 'Перетащите сюда нужные карточки — зона просто держит их вместе.' },
    { el: () => zoneEl(id), text: '<b>Ctrl+Пробел</b> — разложить всё по зонам. Правый клик по карточке — круговое меню действий.' },
  ];
}
function startTour(id) {
  stopTour();
  const steps = (TOURS[id] || (() => genericTour(id)))();
  const cur = document.createElement('div'); cur.className = 'tour-cursor';
  cur.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#f0ff41" stroke="#18131f" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const hl = document.createElement('div'); hl.className = 'tour-hl';
  const bar = document.createElement('div'); bar.className = 'tour-bar';
  document.body.append(hl, cur, bar);
  cur.style.left = innerWidth / 2 + 'px'; cur.style.top = innerHeight / 2 + 'px';
  TOUR = { steps, i: -1, cur, hl, bar, restore: [], timer: null };
  bar.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'next') tourStep(); else stopTour(); });
  setTimeout(() => window.addEventListener('pointerdown', tourAway, true), 50);
  tourStep();
}
function tourAway(e) { if (TOUR && !e.target.closest('.tour-bar')) stopTour(); }
function tourStep() {
  const T = TOUR; if (!T) return;
  clearTimeout(T.timer);
  T.i++;
  if (T.i >= T.steps.length) return stopTour();
  const st = T.steps[T.i];
  const el = st.el && st.el();
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2 - 100, top: innerHeight / 2 - 40, width: 200, height: 80 };
  const pad = 6;
  Object.assign(T.hl.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
  T.cur.style.left = Math.min(innerWidth - 30, r.left + Math.min(r.width * 0.55, r.width - 10)) + 'px';
  T.cur.style.top = Math.min(innerHeight - 30, r.top + Math.min(r.height * 0.55, r.height - 10)) + 'px';
  T.bar.innerHTML = `<span class="tn">${T.i + 1}/${T.steps.length}</span><span class="tt">${st.text}</span><button class="btn small ghost" data-t="stop">Стоп</button><button class="btn small primary" data-t="next">${T.i + 1 < T.steps.length ? 'Дальше' : 'Готово'}</button>`;
  // понарошку печатаем в поле — после показа вернём как было
  if (st.type && el && 'value' in el) {
    T.restore.push([el, el.value]);
    let k = 0; el.value = '';
    const tick = () => { if (!TOUR || TOUR !== T) return; el.value = st.type.slice(0, ++k); if (k < st.type.length) setTimeout(tick, 45); };
    setTimeout(tick, 900);
  }
  if (st.act) { try { st.act(); } catch (_) { } }
  if (st.click) setTimeout(() => { if (TOUR === T) { T.cur.classList.remove('click'); void T.cur.offsetWidth; T.cur.classList.add('click'); } }, 950);
  const dur = 1800 + st.text.replace(/<[^>]+>/g, '').length * 45 + (st.type ? st.type.length * 45 : 0);
  T.timer = setTimeout(tourStep, st.ms || Math.min(9000, dur));
}
function stopTour() {
  if (!TOUR) return;
  clearTimeout(TOUR.timer);
  TOUR.restore.forEach(([el, v]) => { el.value = v; });
  TOUR.cur.remove(); TOUR.hl.remove(); TOUR.bar.remove();
  window.removeEventListener('pointerdown', tourAway, true);
  TOUR = null;
  if (typeof onTourEnd === 'function') onTourEnd();
}
window.addEventListener('keydown', e => { if (TOUR && e.key === 'Escape') { e.stopImmediatePropagation(); stopTour(); } }, true);
document.addEventListener('click', e => { if (e.target.closest('#tmGrid [data-free]')) freeMemory(); });


/* ================= шторки: режим отдыха ================= */
// стол закрывается двумя шторками с плавными линиями; в центре — лампочка и что сейчас делает ComfyUI
const restEl = $('#rest');
// одна общая картина на весь экран; каждая шторка показывает свою половину — сходятся без шва.
// Механика как у экрана загрузки ComfyUI: один большой контур (у нас — наклонная «D»), обведённый лаймовым
// градиентом, а маска из мягких овалов оставляет видимыми только куски линии; овалы медленно плывут.
function restScene() {
  const D = 'M 160 -60 L 470 -60 A 190 190 0 0 1 660 130 L 660 430 A 190 190 0 0 1 470 620 L 160 620 A 40 40 0 0 1 120 580 L 120 -20 A 40 40 0 0 1 160 -60 Z M 290 110 L 450 110 A 60 60 0 0 1 510 170 L 510 390 A 60 60 0 0 1 450 450 L 290 450 Z';
  // фон маски почти чёрный — линия в основном скрыта; белые овалы «высвечивают» её куски и плавают
  const blobs = [[200, -40, 170, 110, 'w', .95, 13], [120, 300, 120, 200, 'w', .85, 17], [330, 640, 220, 90, 'w', 1, 11], [660, 330, 110, 170, 'w', .7, 15], [470, 120, 120, 60, 'w', .55, 12], [400, 460, 140, 50, 'w', .8, 14]];
  return `<svg viewBox="-40 -30 860 620" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="rbeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f74f2" stop-opacity=".55"/><stop offset=".55" stop-color="#6a4fd0" stop-opacity=".12"/><stop offset="1" stop-color="#6a4fd0" stop-opacity="0"/></linearGradient>
    <filter id="rblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
    <filter id="rsoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter>
    <linearGradient id="rga" x1="120" y1="80" x2="660" y2="520" gradientUnits="userSpaceOnUse"><stop stop-color="#F0FF41" stop-opacity="0"/><stop offset=".5" stop-color="#F0FF41" stop-opacity=".95"/><stop offset="1" stop-color="#F0FF41" stop-opacity="0"/></linearGradient>
    <linearGradient id="rgb" x1="660" y1="-60" x2="160" y2="620" gradientUnits="userSpaceOnUse"><stop stop-color="#F0FF41" stop-opacity="0"/><stop offset=".45" stop-color="#e9f56a" stop-opacity=".7"/><stop offset="1" stop-color="#F0FF41" stop-opacity="0"/></linearGradient>
    <mask id="rmask" maskUnits="userSpaceOnUse" x="-260" y="-150" width="1240" height="860">
      <rect x="-260" y="-150" width="1240" height="860" fill="#141414"/>
      <g filter="url(#rsoft)">${blobs.map(([cx, cy, rx, ry, c, o, t], i) => `<ellipse class="rb" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c === 'w' ? 'white' : 'black'}" fill-opacity="${o}" style="animation-duration:${t}s;animation-delay:${-i * 1.7}s"/>`).join('')}</g>
    </mask>
    <mask id="rmask2" maskUnits="userSpaceOnUse" x="-260" y="-150" width="1240" height="860">
      <rect x="-260" y="-150" width="1240" height="860" fill="black"/>
      <g filter="url(#rsoft)">${[[150, 80, 90, 160, 19], [560, 40, 130, 90, 23], [640, 470, 90, 150, 17], [260, 600, 160, 70, 21]].map(([cx, cy, rx, ry, t], i) => `<ellipse class="rb" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white" fill-opacity=".9" style="animation-duration:${t}s;animation-delay:${-i * 3.1}s"/>`).join('')}</g>
    </mask>
    <filter id="rglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="rglow2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>
  <polygon class="beam" points="560,-200 700,-200 640,330 430,330" fill="url(#rbeam)" filter="url(#rblur)"/>
  <g transform="skewX(-15) translate(130 0)" mask="url(#rmask)">
    <path d="${D}" fill="none" stroke="url(#rga)" stroke-width=".9" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <path d="${D}" fill="none" stroke="url(#rgb)" stroke-width=".9" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <path d="${D}" fill="none" stroke="url(#rga)" stroke-opacity=".7" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round" filter="url(#rglow2)"/>
    ${[[12, .85, 1.3], [36, .32, 1.2], [80, .15, 1.1], [150, .07, 1], [250, .035, 1]].map(([L, o, w], i) => `<path class="rrun" d="${D}" fill="none" stroke="#f6ffb0" stroke-opacity="${o}" stroke-width="${w}" vector-effect="non-scaling-stroke" stroke-linecap="${i ? 'butt' : 'round'}" pathLength="1000" stroke-dasharray="${L} ${1000 - L}" style="--o0:${L};--o1:${L - 1000}" filter="url(#rglow2)"/>`).join('')}
  </g>
  </svg>`;
}
$$('#rest .scene').forEach(el => el.innerHTML = restScene());
let restT = null;
function restState() {
  const run = S.cards.find(c => c.status === 'running'), q = S.cards.filter(c => c.status === 'queued').length;
  const errs = S.cards.filter(c => c.status === 'error' && !c.errSeen && (c.created || 0) > (restEl.dataset.since || 0));
  const done = S.cards.filter(c => c.status === 'done' && (c.done || 0) > (restEl.dataset.since || 0));
  const planLeft = (S.plan || []).filter(x => x.status === 'wait').length;
  if (run) return { cls: 'run', txt: `${runBadge(run).replace('⚠ ', '')} · ${runStatus(run)}${q ? ' · ждут ' + q : ''}${planLeft ? ' · в плане ещё ' + planLeft : ''}`, p: run.progress || 0, slow: !!slowInfo(run) };
  if (q) return { cls: 'run', txt: `В очереди: ${q}`, p: 0 };
  if (errs.length) return { cls: 'err', txt: `Ошибка: ${errs[errs.length - 1].title}`, p: 0 };
  if (done.length) return { cls: 'done', txt: `Готово: ${done.length === 1 ? done[0].title : done.length + ' результатов'}`, p: 1 };
  return { cls: 'idle', txt: online() ? 'Простой — ComfyUI ждёт задач' : 'ComfyUI не подключён', p: 0 };
}
function restTick() {
  const st = restState();
  $('#restLamp').className = 'lamp ' + st.cls + (st.slow ? ' slow' : '');
  $('#restTxt').textContent = st.txt;
  $('#restBar').style.width = Math.round(st.p * 100) + '%';
}
function openRest() {
  if (!restEl.hidden) return;
  restEl.dataset.since = Date.now();
  restEl.hidden = false; void restEl.offsetWidth; restEl.classList.add('on');
  hidePeek(); restTick(); restT = setInterval(restTick, 1000);
}
function closeRest() {
  if (restEl.hidden || restEl.classList.contains('closing')) return;
  clearInterval(restT); restEl.classList.remove('on'); restEl.classList.add('closing');
  setTimeout(() => { restEl.hidden = true; restEl.classList.remove('closing'); }, 650);
}
$('#btnRest').onclick = openRest;
// навели мышь — в углу проявляется глаз «вернуться»; замерли — глаз и курсор прячутся
let restIdle = null;
restEl.addEventListener('pointermove', () => { restEl.classList.add('awake'); clearTimeout(restIdle); restIdle = setTimeout(() => restEl.classList.remove('awake'), 2200); });
restEl.addEventListener('pointerdown', e => { e.stopPropagation(); if (restEl.classList.contains('on')) closeRest(); });
window.addEventListener('keydown', e => {
  if (!restEl.hidden) { e.preventDefault(); e.stopImmediatePropagation(); closeRest(); return; }
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (!typing && e.shiftKey && e.code === 'KeyP' && !e.ctrlKey && !e.altKey) { e.preventDefault(); openRest(); }
}, true);

/* ================= редактор зон ================= */
// очистить поле, добавить свои зоны, двигать и растягивать их мышкой, задать имя, цвет и что туда раскладывать
let ZE = null;
const ZE_KINDS = [['video', 'видео'], ['image', 'картинки'], ['audio', 'звук'], ['text', 'текст']];
function cornerOf(a) {
  const L = a.x < 0.02, R = a.x + a.w > 0.98, T = a.y < 0.02, B = a.y + a.h > 0.98;
  return L && T ? 'tl' : R && T ? 'tr' : L && B ? 'bl' : R && B ? 'br' : L ? 'l' : R ? 'r' : T ? 'top' : B ? 'bot' : 'c';
}
function openZoneEditor() {
  if (S.locked) return toast('Стол на замке.');
  const sh = S.sheets.find(s => s.id === S.sheet);
  ZE = { areas: JSON.parse(JSON.stringify(areasOf())), sel: null, layout: sh.layout, label: layoutDef(sh.layout).label };
  // имена и цвета из шестерёнки становятся частью своей раскладки
  document.body.classList.add('zone-edit');
  const bar = document.createElement('div'); bar.className = 'ze-bar'; bar.id = 'zeBar';
  bar.innerHTML = `<b>Редактор зон</b><span class="ze-hint">тащите зону — двигать, уголок — растянуть, клик — настроить</span><button class="btn small" data-ze="add">＋ Зона</button><button class="btn small ghost" data-ze="clear">Очистить поле</button><button class="btn small ghost" data-ze="cancel">Отмена</button><button class="btn small primary" data-ze="done">Готово</button>`;
  document.body.appendChild(bar);
  const lay = document.createElement('div'); lay.className = 'ze-layer'; lay.id = 'zeLayer'; canvasEl.appendChild(lay);
  const side = document.createElement('div'); side.className = 'ze-side'; side.id = 'zeSide'; side.hidden = true; document.body.appendChild(side);
  bar.addEventListener('click', zeBarClick);
  lay.addEventListener('pointerdown', zeDown);
  side.addEventListener('input', zeSideInput); side.addEventListener('click', zeSideClick);
  zeRender();
}
function zeRender() {
  const lay = $('#zeLayer'); if (!lay) return;
  lay.innerHTML = ZE.areas.map((a, i) => { const r = areaRect(a); return `<div class="ze-box${ZE.sel === i ? ' sel' : ''}" data-i="${i}" style="--c:${a.c};left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"><span class="ze-l">${esc(a.label)}</span><small>${a.montage ? 'монтаж' : (a.kinds || []).map(k => (ZE_KINDS.find(x => x[0] === k) || [k, k])[1]).join(', ') || (a.panel ? 'панель' : 'свободная')}</small><i class="ze-h" data-h="br"></i><i class="ze-h" data-h="tl"></i></div>`; }).join('') + (ZE.areas.length ? '' : '<div class="ze-empty">Поле пустое. Нажмите «＋ Зона» вверху.</div>');
  zeSideRender();
}
function zeSideRender() {
  const side = $('#zeSide'); const a = ZE.areas[ZE.sel];
  if (!a) { side.hidden = true; return; }
  side.hidden = false;
  side.innerHTML = `<h4>Зона</h4><label>Название<input type="text" data-zf="label" value="${esc(a.label)}" maxlength="30"></label>
    <label>Подпись<input type="text" data-zf="note" value="${esc(a.note || '')}" maxlength="40"></label>
    <div class="ze-sub">Цвет</div><div class="swatches">${ZONE_COLORS.map(c => `<button type="button" data-zc="${c}" class="${a.c === c ? 'cur' : ''}" style="--sw:${c}"></button>`).join('')}</div>
    <div class="ze-sub">Что сюда раскладывать</div>${ZE_KINDS.map(([k, l]) => `<label class="chk"><input type="checkbox" data-zk="${k}" ${(a.kinds || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}
    <label class="chk"><input type="checkbox" data-zm ${a.montage ? 'checked' : ''}> монтаж — сюда стекаются клипы</label>
    <button type="button" class="btn small ghost danger" data-zdel>Удалить зону</button>`;
}
function zeBarClick(e) {
  const b = e.target.closest('[data-ze]'); if (!b) return;
  const act = b.dataset.ze;
  if (act === 'add') {
    const used = new Set(ZE.areas.map(a => a.c)), c = ZONE_COLORS.find(x => !used.has(x)) || ZONE_COLORS[0];
    ZE.areas.push({ id: 'z' + Date.now().toString(36), label: 'Зона ' + (ZE.areas.length + 1), note: '', c, x: 0.35, y: 0.3, w: 0.3, h: 0.3, corner: 'c', kinds: [] });
    ZE.sel = ZE.areas.length - 1; zeRender();
  }
  if (act === 'clear') { ZE.areas = []; ZE.sel = null; zeRender(); toast('Поле очищено. Карточки остались на месте.'); }
  if (act === 'cancel') closeZoneEditor(false);
  if (act === 'done') closeZoneEditor(true);
}
function zeSideInput(e) {
  const a = ZE.areas[ZE.sel]; if (!a) return;
  const f = e.target.dataset.zf; if (f) { a[f] = e.target.value; const box = $(`#zeLayer .ze-box[data-i="${ZE.sel}"] .ze-l`); if (box && f === 'label') box.textContent = a.label; }
  const k = e.target.dataset.zk; if (k) { a.kinds = ZE_KINDS.map(x => x[0]).filter(x => $(`#zeSide [data-zk="${x}"]`).checked); zeRender(); }
  if (e.target.hasAttribute('data-zm')) { a.montage = e.target.checked; zeRender(); }
}
function zeSideClick(e) {
  const a = ZE.areas[ZE.sel]; if (!a) return;
  const sw = e.target.closest('[data-zc]'); if (sw) { a.c = sw.dataset.zc; zeRender(); }
  if (e.target.closest('[data-zdel]')) { ZE.areas.splice(ZE.sel, 1); ZE.sel = null; zeRender(); }
}
function zeDown(e) {
  const box = e.target.closest('.ze-box'); if (!box) { ZE.sel = null; zeRender(); return; }
  e.stopPropagation(); e.preventDefault();
  const i = +box.dataset.i, a = ZE.areas[i], h = e.target.dataset.h || null;
  ZE.sel = i; zeSideRender(); $$('#zeLayer .ze-box').forEach(b => b.classList.toggle('sel', +b.dataset.i === i));
  const [x0, y0] = toLogical(e.clientX, e.clientY), st = { ...a };
  const snap = v => Math.round(v * 200) / 200;
  const move = ev => {
    const [x, y] = toLogical(ev.clientX, ev.clientY), dx = (x - x0) / W, dy = (y - y0) / H;
    if (!h) { a.x = snap(Math.min(1 - st.w, Math.max(0, st.x + dx))); a.y = snap(Math.min(1 - st.h, Math.max(0, st.y + dy))); }
    else if (h === 'br') { a.w = snap(Math.max(0.06, Math.min(1 - st.x, st.w + dx))); a.h = snap(Math.max(0.06, Math.min(1 - st.y, st.h + dy))); }
    else if (h === 'tl') { const nx = snap(Math.max(0, Math.min(st.x + st.w - 0.06, st.x + dx))), ny = snap(Math.max(0, Math.min(st.y + st.h - 0.06, st.y + dy))); a.w = st.w + (st.x - nx); a.h = st.h + (st.y - ny); a.x = nx; a.y = ny; }
    const r = areaRect(a); Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}
function closeZoneEditor(apply) {
  if (!ZE) return;
  if (apply) {
    const sh = S.sheets.find(s => s.id === S.sheet);
    const id = S.customLayouts?.[ZE.layout] ? ZE.layout : 'my-' + Date.now().toString(36);
    const n = Object.keys(S.customLayouts || {}).length + 1;
    S.customLayouts = S.customLayouts || {};
    S.customLayouts[id] = { label: S.customLayouts[id]?.label || 'Моя раскладка ' + n, areas: ZE.areas.map(a => { const { ...b } = a; b.corner = b.panel ? b.corner : cornerOf(b); if (!b.kinds) b.kinds = []; return b; }) };
    // настройки шестерёнки уже вписаны в зоны — чистим, чтобы не наложились второй раз
    ZE.areas.forEach(a => delete S.zoneCfg[a.id]);
    sh.layout = id; save(); render(); updateLayoutSel();
    toast(`Сохранено: «${esc(S.customLayouts[id].label)}». Вернуть стандартную — «Раскладка сцены» в инструментах.`);
  }
  ZE = null; document.body.classList.remove('zone-edit');
  ['#zeBar', '#zeLayer', '#zeSide'].forEach(sel => $(sel)?.remove());
  areaKey = ''; renderAreas();
}
window.addEventListener('keydown', e => { if (ZE && e.key === 'Escape') { e.stopImmediatePropagation(); closeZoneEditor(false); } }, true);
