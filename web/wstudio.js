/* Director's Table — «Студия виджета»: рабочее место одного workflow, собранное из под-блоков,
   как интерфейс из нод: 🖥 экран · ✎ промпт и запуск · 🖼 входы · ⚙ параметры · 🕘 история · ⏱ время и модель.
   Блок ставится из Конструктора; под-блоки включаются галочками. */
'use strict';

const WS_SUBS = [['screen', '🖥 Экран'], ['prompt', '✎ Промпт и запуск'], ['inputs', '🖼 Входы'], ['params', '⚙ Параметры'], ['history', '🕘 История'], ['info', '⏱ Время и модель']];
const WS_DEFAULT = ['screen', 'prompt', 'inputs', 'params', 'history', 'info'];
const wsSel = {}; // area.id → id выбранного результата в истории
BLOCKS.push({ t: 'wstudio', label: 'Студия виджета', c: '#3fd2ff', kinds: [], panel: 'wstudio', icon: '🎛', w: .44, h: .62 });
// готовая студия: одно большое рабочее место + монтаж
Object.assign(LAYOUTS, {
  wsvideo: {
    label: 'Рабочее место (один workflow)', areas: [
      { id: 'ws', label: 'Студия', note: 'выберите workflow', c: '#3fd2ff', x: 0, y: 0, w: .62, h: 1, corner: 'tl', kinds: [], panel: 'wstudio', subs: WS_DEFAULT.slice() },
      { id: 'src', label: 'Исходники', note: 'картинки, видео, звук', c: '#f0ff41', x: .63, y: 0, w: .37, h: .5, corner: 'tr', kinds: ['image', 'video', 'audio', 'text'] },
      { id: 'cut', label: 'Монтаж', note: 'клипы по порядку', c: '#ff6b5e', x: .63, y: .51, w: .37, h: .49, corner: 'tr', kinds: [], montage: true },
    ]
  },
});
const wsArea = id => areasOf().find(a => a.id === id && a.panel === 'wstudio');
function wsWidget(wf) {
  if (!wf) return null;
  const w = S.cards.find(c => c.type === 'widget' && c.sheet === S.sheet && c.wf === wf.id); if (w) return w;
  const n = ensureWidget(wf, S.sheet); save(); setTimeout(render, 0); return n;
}
const wsModels = wf => [...new Set(JSON.stringify(wf?.workflow || {}).match(/[\w.\-]+\.(?:safetensors|gguf)/g) || [])];
function wsSetArea(id, fn, label) {
  const L = editableLayout(); if (!L) return; const a = L.areas.find(x => x.id === id); if (!a) return;
  histPush(label || 'студия виджета'); fn(a); save(); areaKey = ''; render();
}
function wsHistory(wf) { return S.cards.filter(c => c.type === 'file' && c.actionId === wf.id && c.status === 'done' && c.file && c.sheet === S.sheet).sort((a, b) => (b.done || 0) - (a.done || 0)); }

/* ---------- отрисовка ---------- */
function wsFill(el, a) {
  const wf = a.wf && wfById(a.wf);
  if (!wf) {
    if (el.dataset.sig === 'pick') return; el.dataset.sig = 'pick';
    el.innerHTML = `<div class="ws-pick"><b>Какой workflow здесь будет?</b><span>Выберите — зона станет его рабочим местом.</span><div class="ws-wfs">${WFS.map(w => `<button type="button" data-wspick="${esc(w.id)}" style="--c:${KIND_C[w.kind] || '#8f74f2'}"><i></i><span data-noi18n>${esc(T(w.title))}</span><em>${esc(KIND_RU[w.kind] || '')}</em></button>`).join('') || '<span class="hint">Сначала добавьте workflow (Инструменты).</span>'}</div></div>`;
    return;
  }
  const subs = (a.subs && a.subs.length ? a.subs : WS_DEFAULT);
  const sig = wf.id + '|' + subs.join(',');
  if (el.dataset.sig !== sig) {
    el.dataset.sig = sig;
    el.style.setProperty('--c', KIND_C[wf.kind] || '#3fd2ff');
    el.innerHTML = `<div class="ws-head"><i></i><b data-noi18n>${esc(T(wf.title))}</b><span class="ws-kind">${esc(KIND_RU[wf.kind] || '')}</span><button type="button" class="ws-gear" data-wsgear title="Под-блоки и workflow">⚙</button></div>
      <div class="ws-body">${(() => { const d = s => `<div class="ws-sub ws-${s}" data-sub="${s}"></div>`, side = ['prompt', 'inputs', 'params'].filter(s => subs.includes(s));
        return `<div class="ws-top${subs.includes('screen') ? '' : ' noscreen'}${side.length ? '' : ' noside'}">${subs.includes('screen') ? d('screen') : ''}${side.length ? `<div class="ws-side">${side.map(d).join('')}</div>` : ''}</div>${['history', 'info'].filter(s => subs.includes(s)).map(d).join('')}`; })()}</div>`;
    const pp = promptParam(wf), box = el.querySelector('.ws-prompt');
    if (box) {
      box.innerHTML = pp ? `<textarea data-wsprompt placeholder="${esc(T('Опишите, что снять…'))}" data-noi18n></textarea><div class="ws-row"><span class="ws-presets"></span><button type="button" class="zp-btn main" data-wsrun>▶ Запуск</button></div>` : `<div class="ws-row"><span class="hint">В этом workflow нет промпта.</span><button type="button" class="zp-btn main" data-wsrun>▶ Запуск</button></div>`;
      const ta = box.querySelector('textarea'); if (ta) ta.value = paramDefaults(wf)[pp.id] ?? '';
    }
  }
  wsUpdate(el, a, wf);
}
function wsUpdate(el, a, wf) {
  const w = wsWidget(wf), jobs = w ? jobsOf(w) : [], run = jobs.find(c => c.status === 'running'), waiting = jobs.filter(c => c.status === 'queued').length;
  const hist = wsHistory(wf), selC = byId(wsSel[a.id]) || hist[0];
  const scr = el.querySelector('.ws-screen');
  if (scr) {
    const key = run ? 'run' + run.id + (run.preview || '') + Math.round((run.progress || 0) * 50) : 'c' + (selC?.id || 0);
    if (scr.dataset.k !== key) {
      scr.dataset.k = key;
      if (run) scr.innerHTML = `${run.preview ? `<img src="${esc(run.preview)}" alt="">` : (byId(run.parent) ? mediaHTML(byId(run.parent), { under: true }) : '<div class="ws-empty">генерация идёт…</div>')}<div class="ws-run"><span>${esc(runStatus(run))}</span><i style="width:${Math.round((run.progress || 0) * 100)}%"></i></div>`;
      else if (selC) scr.innerHTML = mediaHTML(selC, { controls: true, autoplay: false });
      else scr.innerHTML = '<div class="ws-empty">Здесь появится результат</div>';
    }
  }
  const inp = el.querySelector('.ws-inputs');
  if (inp) {
    const ins = [...new Set([...Object.values(w?.bound || {}), w?.lastInput].filter(Boolean))].map(byId).filter(c => c && c.type === 'file');
    const kinds = [...new Set([...(wf.accepts || []), ...(wf.params || []).filter(p => ['image', 'video', 'audio'].includes(p.type)).map(p => p.type)])];
    const k = ins.map(c => c.id).join(',') + '|' + kinds.join();
    if (inp.dataset.k !== k) {
      inp.dataset.k = k;
      inp.innerHTML = `<span class="ws-l" data-noi18n>${esc(T('Входы'))}</span>${ins.map(c => `<span class="ws-in" title="${esc(c.title)}">${c.kind === 'audio' ? '<i class="ws-aud">♪</i>' : mediaHTML(c)}</span>`).join('')}${kinds.map(kd => `<button type="button" class="ws-add" data-wsadd="${kd}" title="Добавить: ${esc(KIND_RU[kd])}">＋ ${esc(KIND_RU[kd])}</button>`).join('')}${!kinds.length && !ins.length ? '<span class="hint">не нужны</span>' : ''}`;
    }
  }
  const par = el.querySelector('.ws-params');
  if (par && !par.contains(document.activeElement)) {
    const vals = paramDefaults(wf), ps = (wf.params || []).filter(p => ['number', 'select', 'seed'].includes(p.type)).slice(0, 8);
    const k = ps.map(p => p.id + '=' + vals[p.id]).join('|');
    if (par.dataset.k !== k) {
      par.dataset.k = k;
      par.innerHTML = ps.length ? ps.map(p => `<label><span>${esc(p.label || p.id)}</span>${p.type === 'select' ? `<select data-wspar="${esc(p.id)}">${(p.options || []).map((o, i) => `<option value="${i}" ${+vals[p.id] === i ? 'selected' : ''}>${esc(o.label ?? o)}</option>`).join('')}</select>` : `<input type="number" data-wspar="${esc(p.id)}" value="${esc(vals[p.id] ?? '')}" ${p.min != null ? `min="${p.min}"` : ''} ${p.max != null ? `max="${p.max}"` : ''} step="${p.step || 'any'}">`}</label>`).join('') : '<span class="hint">Настраиваемых параметров нет.</span>';
    }
  }
  const his = el.querySelector('.ws-history');
  if (his) {
    const k = hist.slice(0, 40).map(c => c.id).join(',') + '|' + (selC?.id || '');
    if (his.dataset.k !== k) {
      his.dataset.k = k;
      his.innerHTML = `<span class="ws-l" data-noi18n>${esc(T('История'))} ${hist.length}</span><div class="ws-strip">${hist.slice(0, 40).map(c => `<button type="button" class="ws-h${selC && c.id === selC.id ? ' on' : ''}" data-wshist="${c.id}" title="${esc(c.title)}">${c.kind === 'audio' ? '<i class="ws-aud">♪</i>' : mediaHTML(c)}</button>`).join('') || '<span class="hint">пока пусто</span>'}</div>`;
    }
  }
  const inf = el.querySelector('.ws-info');
  if (inf) {
    const ms = wsModels(wf), c = selC;
    const parts = [run ? `⏳ ${esc(T('идёт'))} · ${esc(runStatus(run))}` : waiting ? `${esc(T('в очереди'))} ${waiting}` : '', c?.took ? `⏱ ${mmss(c.took)}` : '', c?.w ? `${c.w}×${c.h}` : '', c?.dur ? `${c.dur.toFixed(1)} ${esc(T('с'))}` : '', c?.params?.seed != null ? `seed ${esc(c.params.seed)}` : '', (c?.presets || []).length ? '✦ ' + c.presets.map(id => T(preById(id)?.title || id)).map(esc).join(', ') : ''].filter(Boolean);
    inf.innerHTML = `<span data-noi18n>${parts.join(' · ') || esc(T('ещё не запускали'))}</span>${ms.length ? `<span class="ws-models" title="${esc(ms.join('\n'))}" data-noi18n>🧠 ${esc(ms.slice(0, 2).join(', '))}${ms.length > 2 ? ' +' + (ms.length - 2) : ''}</span>` : ''}`;
  }
  const pr = el.querySelector('.ws-presets'); if (pr && w) pr.innerHTML = typeof presetBadges === 'function' ? presetBadges(w) : '';
}
function wsRefreshAll() {
  $$('.zone-panel[data-panel="wstudio"]').forEach(el => { const a = wsArea(el.dataset.area); if (!a) return; try { wsFill(el, a); } catch (e) { console.warn('wstudio', e); } });
}
{ const _r = render; render = function () { const x = _r.apply(this, arguments); wsRefreshAll(); return x; }; }
let wsRaf = 0;
{ const _jc = jobChanged; jobChanged = function () { const x = _jc.apply(this, arguments); if (!wsRaf) wsRaf = requestAnimationFrame(() => { wsRaf = 0; wsRefreshAll(); }); return x; }; }
setInterval(() => { if ($('.zone-panel[data-panel="wstudio"]') && S.cards.some(c => c.status === 'running')) wsRefreshAll(); }, 1000);

/* ---------- действия ---------- */
areasEl.addEventListener('click', e => {
  const el = e.target.closest('.zone-panel[data-panel="wstudio"]'); if (!el) return;
  const a = wsArea(el.dataset.area); if (!a) return;
  const pick = e.target.closest('[data-wspick]'); if (pick) return wsSetArea(a.id, x => { x.wf = pick.dataset.wspick; x.note = ''; x.label = T(wfById(pick.dataset.wspick)?.title || '').slice(0, 40) || x.label; if (!x.subs) x.subs = WS_DEFAULT.slice(); }, 'workflow студии');
  const wf = wfById(a.wf); if (!wf) return;
  const w = wsWidget(wf);
  if (e.target.closest('[data-wsrun]')) {
    const pp = promptParam(wf), ta = el.querySelector('[data-wsprompt]');
    if (pp && ta) { S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [pp.id]: ta.value }; save(); }
    runWidgetWith(w, pp && ta && ta.value.trim() ? { __prompt: ta.value } : {});
    return;
  }
  const add = e.target.closest('[data-wsadd]'); if (add) return pickFileFor(w, add.dataset.wsadd);
  const h = e.target.closest('[data-wshist]'); if (h) { wsSel[a.id] = +h.dataset.wshist; wsUpdate(el, a, wf); return; }
  if (e.target.closest('[data-wsgear]')) {
    const subs = a.subs && a.subs.length ? a.subs : WS_DEFAULT;
    popAt(e.target.closest('[data-wsgear]'), `<h4>Под-блоки</h4>${WS_SUBS.map(([k, l]) => `<label class="chk"><input type="checkbox" data-wssub="${k}" ${subs.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}<div class="pop-sub">Workflow</div><button data-wschange>Сменить workflow…</button>`, pop => {
      pop.onchange = ev => { const k = ev.target.dataset.wssub; if (!k) return; wsSetArea(a.id, x => { const cur = x.subs && x.subs.length ? x.subs.slice() : WS_DEFAULT.slice(); x.subs = ev.target.checked ? WS_DEFAULT.filter(s => cur.includes(s) || s === k) : cur.filter(s => s !== k); }, 'под-блоки'); };
      pop.onclick = ev => { if (ev.target.closest('[data-wschange]')) { closePop(); wsSetArea(a.id, x => { delete x.wf; }, 'смена workflow'); } };
    }, 'below');
  }
});
areasEl.addEventListener('dblclick', e => { const h = e.target.closest('[data-wshist]'); if (h) openDetails(byId(+h.dataset.wshist)); });
areasEl.addEventListener('input', e => {
  const el = e.target.closest('.zone-panel[data-panel="wstudio"]'); if (!el) return;
  const a = wsArea(el.dataset.area), wf = a && wfById(a.wf); if (!wf) return;
  if (e.target.matches('[data-wsprompt]')) { const pp = promptParam(wf); if (pp) { S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [pp.id]: e.target.value }; save(); } }
  if (e.target.matches('[data-wspar]')) { const p = (wf.params || []).find(x => x.id === e.target.dataset.wspar); if (p) { const v = p.type === 'select' ? +e.target.value : e.target.value === '' ? '' : +e.target.value; S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [p.id]: v }; save(); } }
});
areasEl.addEventListener('keydown', e => { if (e.target.matches?.('[data-wsprompt]') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.target.closest('.zone-panel')?.querySelector('[data-wsrun]')?.click(); } });
// файл с компьютера на «Входы» — сразу подключается к этому workflow
areasEl.addEventListener('dragover', e => { if (e.target.closest('.zone-panel[data-panel="wstudio"]') && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); e.stopPropagation(); } }, true);
areasEl.addEventListener('drop', async e => {
  const el = e.target.closest('.zone-panel[data-panel="wstudio"]'); if (!el || !e.dataTransfer?.files?.length) return;
  const a = wsArea(el.dataset.area), wf = a && wfById(a.wf); if (!wf) return;
  e.preventDefault(); e.stopPropagation();
  const w = wsWidget(wf);
  for (const f of [...e.dataTransfer.files].filter(f => !/\.json$/i.test(f.name))) {
    const kind = kindOfFile(f); if (!kind) continue;
    try { const file = await API.upload(f); const c = { id: S.nextId++, type: 'file', sheet: S.sheet, kind, title: f.name.replace(/\.[^.]+$/, ''), file, status: 'ready', created: Date.now(), parked: false }; S.cards.push(c); placeCard(c, areaForKind(kind, c.title)); if (!bindToWidget(w, c)) toast(`«${esc(wf.title)}» не принимает ${KIND_RU[kind] || 'такой файл'}.`); }
    catch (err) { toast('Не загрузилось: ' + esc(err.message)); }
  }
  save(); render();
}, true);
// новый блок «Студия виджета» сразу получает все под-блоки
{ const _ab = addBlock; addBlock = function (b, fx, fy) { const r = _ab.apply(this, arguments); if (b.panel === 'wstudio') { const L = S.customLayouts?.[curLayoutId()], a = L?.areas.find(x => x.id === buildSel); if (a && !a.subs) { a.subs = WS_DEFAULT.slice(); save(); areaKey = ''; render(); } } return r; }; }

/* ---------- имя виджета: «Ваш LTX workflow» → своё название (хранится в проекте, файл workflow не трогаем) ---------- */
// формат: к любому workflow добавляем горизонталь 16:9 и вертикаль 9:16 той же площади (если их ещё нет)
function addAspectOptions(wf) {
  const p = (wf.params || []).find(x => x.id === 'format' && x.type === 'select' && Array.isArray(x.options)); if (!p) return;
  const base = p.options.find(o => Array.isArray(o.value)); if (!base) return;
  const [w0, h0] = base.value, area = w0 * h0, r32 = v => Math.max(256, Math.round(v / 32) * 32);
  const has = ar => p.options.some(o => Array.isArray(o.value) && Math.abs(o.value[0] / o.value[1] - ar) < .1);
  const add = (ar, label) => { if (has(ar)) return; const w = r32(Math.sqrt(area * ar)), h = r32(Math.sqrt(area / ar)); p.options.push({ label: `${label} · ${w}×${h}`, value: [w, h] }); }; // в конец: сохранённые номера вариантов не сдвигаются
  add(16 / 9, T('Горизонтально 16:9')); add(9 / 16, T('Вертикально 9:16'));
}
function applyWfTitles() {
  for (const wf of WFS) try { addAspectOptions(wf); } catch (_) { }
  const t = S.wfTitles && typeof S.wfTitles === 'object' ? S.wfTitles : {};
  for (const wf of WFS) { if (!wf.origTitle) wf.origTitle = wf.title; const n = t[wf.id]; wf.title = typeof n === 'string' && n.trim() ? n.trim().slice(0, 60) : wf.origTitle; }
}
{ const _la = loadActions; loadActions = async function () { const r = await _la.apply(this, arguments); applyWfTitles(); return r; }; }
applyWfTitles();
function renameWf(wf) {
  if (!wf) return;
  sheetOpen(`<h3>Название виджета</h3><div class="sub">Так он будет называться на столе, на клавишах и в студии. Файл workflow не меняется.</div><div class="field"><input type="text" id="wfRn" name="t" value="${esc(wf.title)}" maxlength="60" data-noi18n></div><div class="acts"><button type="button" class="btn ghost" data-a="reset">Как было: <span data-noi18n>${esc(wf.origTitle || wf.title)}</span></button><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Сохранить</button></div>`,
    () => { const v = sheet.elements.wfRn.value.trim(); S.wfTitles = { ...(S.wfTitles || {}), [wf.id]: v }; if (!v) delete S.wfTitles[wf.id]; applyWfTitles(); save(); areaKey = ''; render(); renderPiano?.(); },
    { init: () => { const i = sheet.elements.wfRn; i.focus(); i.select(); }, onClick: e => { if (e.target.closest('[data-a="reset"]')) { delete (S.wfTitles || {})[wf.id]; applyWfTitles(); save(); closeSheet(); areaKey = ''; render(); renderPiano?.(); } } });
}
{ const _wm = widgetMenu; widgetMenu = function (w) { const items = _wm.apply(this, arguments); const wf = wfById(w.wf); if (wf) { const i = items.findIndex(x => x.label === 'Убрать'); items.splice(i < 0 ? items.length : i, 0, { label: 'Переименовать', enabled: true, act: () => renameWf(wf) }); } return items; }; }

/* большое превью при наведении и на виджете: показывает его последний готовый результат (как у карточек — справа, у края — слева) */
let wPeekT = null;
document.addEventListener('pointerover', e => {
  const m = e.target.closest('.card.widget .media'); if (!m || G || M) return;
  const el = m.closest('.card.widget'), w = byId(+el.dataset.id); if (!w) return;
  const jobs = jobsOf(w); if (jobs.some(c => c.status === 'running')) return;
  const last = jobs.filter(c => c.status === 'done' && isReady(c)).sort((a, b) => (b.done || 0) - (a.done || 0))[0]; if (!last) return;
  clearTimeout(wPeekT); wPeekT = setTimeout(() => showPeek(last.id, el), 650);
});
document.addEventListener('pointerout', e => {
  const m = e.target.closest('.card.widget .media'); if (!m || m.contains(e.relatedTarget)) return;
  clearTimeout(wPeekT); if (!peek.hidden && !peek.contains(e.relatedTarget)) peekLater();
});
document.addEventListener('pointerdown', () => { clearTimeout(wPeekT); }, true);
