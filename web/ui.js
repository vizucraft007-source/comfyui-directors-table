/* Director's Table v0.3 — интерфейс: холст, карточки, виджеты, перетаскивание, круговое меню, пианино, края. */
'use strict';
const board = $('#board'), canvasEl = $('#canvas'), cardsEl = $('#cards'), areasEl = $('#areas'), threadsEl = $('#threads'), areaLinesEl = $('#areaLines');
// невидимые «ручки» линий лежат поверх карточек, чтобы по линии можно было кликнуть
const threadHits = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
threadHits.setAttribute('class', 'threads thread-hits'); canvasEl.appendChild(threadHits);
let scale = 1, ox = 0, oy = 0;
const els = new Map();
const sel = new Set();
let builtSheet = null;

/* ================= масштаб холста ================= */
function fit() {
  const r = board.getBoundingClientRect();
  if (!r.width) return;
  scale = r.width / W; ox = 0; oy = 0;
  const nh = Math.max(600, Math.round(r.height / scale));
  canvasEl.style.transform = `scale(${scale})`;
  if (nh !== H) {
    // зоны заданы долями высоты — карточки сдвигаем пропорционально, чтобы они оставались в своих зонах
    // первый раз берём высоту, при которой карточки были сохранены (иначе при каждом открытии они уплывали)
    if (!fit.init) { fit.init = true; if (S.viewH > 0) H = S.viewH; }
    const k = H > 0 ? nh / H : 1;
    H = nh; S.viewH = H; canvasEl.style.height = H + 'px'; threadsEl.style.height = H + 'px'; areaLinesEl.style.height = H + 'px';
    S.cards.forEach(c => { if (typeof c.y === 'number') c.y = Math.round(c.y * k); if (c.y > H - 60) c.y = H - (c.type === 'widget' ? WH : CH) - 10; });
    // полную перерисовку откладываем, пока размер не перестанет меняться — иначе при выезде панели стол «подвисает»
    clearTimeout(fit.t);
    fit.t = setTimeout(() => { if (typeof renderAreas === 'function' && builtSheet !== null) { if (typeof deOverlap === 'function') deOverlap(); renderAreas(); render(); } }, 90);
  }
}
new ResizeObserver(fit).observe(board);
const toLogical = (cx, cy) => { const r = board.getBoundingClientRect(); return [(cx - r.left - ox) / scale, (cy - r.top - oy) / scale]; };
const clampX = x => Math.max(0, Math.min(W - CW, x)), clampY = y => Math.max(0, Math.min(H - CH, y));

/* ================= области ================= */
function areaPaths(a) {
  // контур области: две «главные» стороны — переливающейся линией, остальные — пунктиром, внутренний угол скруглён
  const r = areaRect(a), i = 5, x0 = r.x + i, y0 = r.y + i, x1 = r.x + r.w - i, y1 = r.y + r.h - i, R = 26;
  const round = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl', l: 'r', r: 'l' }[a.corner];
  const k = c => round === c || (round === 'r' && (c === 'tr' || c === 'br')) || (round === 'l' && (c === 'tl' || c === 'bl')) ? R : 6;
  const full = `M${x0 + k('tl')},${y0} H${x1 - k('tr')} Q${x1},${y0} ${x1},${y0 + k('tr')} V${y1 - k('br')} Q${x1},${y1} ${x1 - k('br')},${y1} H${x0 + k('bl')} Q${x0},${y1} ${x0},${y1 - k('bl')} V${y0 + k('tl')} Q${x0},${y0} ${x0 + k('tl')},${y0} Z`;
  // главная линия заканчивается там, где начинается скругление соседнего угла — стык ровный
  const L = { tl: `M${x0},${y1 - k('bl')} V${y0 + k('tl')} Q${x0},${y0} ${x0 + k('tl')},${y0} H${x1 - k('tr')}`, tr: `M${x0 + k('tl')},${y0} H${x1 - k('tr')} Q${x1},${y0} ${x1},${y0 + k('tr')} V${y1 - k('br')}`,
    bl: `M${x0},${y0 + k('tl')} V${y1 - k('bl')} Q${x0},${y1} ${x0 + k('bl')},${y1} H${x1 - k('br')}`, br: `M${x0 + k('bl')},${y1} H${x1 - k('br')} Q${x1},${y1} ${x1},${y1 - k('br')} V${y0 + k('tr')}`,
    l: `M${x0},${y1 - k('bl')} V${y0 + k('tl')} Q${x0},${y0} ${x0 + k('tl')},${y0} H${x1 - k('tr')}`, r: `M${x0 + k('tl')},${y0} H${x1 - k('tr')} Q${x1},${y0} ${x1},${y0 + k('tr')} V${y1 - k('br')}`, c: full, top: '', bot: '' }[a.corner] || '';
  const g = { tl: [x0, y0, x1, y1], tr: [x1, y0, x0, y1], bl: [x0, y1, x1, y0], br: [x1, y1, x0, y0], l: [x0, y0, x1, y1], r: [x1, y0, x0, y1], c: [x0, y0, x1, y1], top: [x0, y0, x0, y1], bot: [x0, y1, x0, y0] }[a.corner];
  // вид линий: edge — только внешний край стола (вертикали по бокам), corner — уголки и скобки, classic — как было
  const st = S.cfg.lineStyle || 'edge';
  if (st === 'edge') {
    const side = { tl: 'l', l: 'l', bl: 'l', tr: 'r', r: 'r', br: 'r', c: 'c' }[a.corner];
    const E = side === 'l' ? `M${x0},${y0} V${y1}` : side === 'r' ? `M${x1},${y0} V${y1}` : side === 'c' ? full : '';
    return { full, L: E, g: side === 'c' ? g : [x0, y0, x0, y1], flat: side !== 'c', acc: '', r };
  }
  if (st === 'straight') {
    // четвёртый вид: только прямые линии по периметру стола, без скруглений.
    // Угловые зоны — острый «L», боковые — прямая по краю, Сценарий/Ассистент — прямая по верхнему/нижнему краю стола
    const top = i, bot = H - i;
    const S2 = {
      tl: `M${x0},${y1} V${y0} H${x1}`, tr: `M${x0},${y0} H${x1} V${y1}`,
      bl: `M${x0},${y0} V${y1} H${x1}`, br: `M${x0},${y1} H${x1} V${y0}`,
      l: `M${x0},${y0} V${y1}`, r: `M${x1},${y0} V${y1}`, c: full,
      top: `M${x0},${top} H${x1}`, bot: `M${x0},${bot} H${x1}`,
    }[a.corner] || '';
    return { full, L: S2, g, acc: '', r };
  }
  if (st === 'corner' || st === 'full') {
    const lift = 8, yb = y1 - lift, T = 46; // нижние уголки приподняты — не сливаются с полосой над клавишами
    const C = {
      tl: `M${x0},${y1} V${y0 + 8} Q${x0},${y0} ${x0 + 8},${y0} H${x1}`,
      tr: `M${x0},${y0} H${x1 - 8} Q${x1},${y0} ${x1},${y0 + 8} V${y1}`,
      bl: `M${x0},${y0} V${yb - 8} Q${x0},${yb} ${x0 + 8},${yb} H${x1}`,
      br: `M${x0},${yb} H${x1 - 8} Q${x1},${yb} ${x1},${yb - 8} V${y0}`,
      l: `M${x0 + T},${y0} H${x0 + 8} Q${x0},${y0} ${x0},${y0 + 8} V${y1 - 8} Q${x0},${y1} ${x0 + 8},${y1} H${x0 + T}`,
      r: `M${x1 - T},${y0} H${x1 - 8} Q${x1},${y0} ${x1},${y0 + 8} V${y1 - 8} Q${x1},${y1} ${x1 - 8},${y1} H${x1 - T}`,
      c: full,
      // третий вид: «П» у Сценария (сверху, загибы вниз) и у Ассистента (снизу, загибы вверх)
      top: st === 'full' ? `M${x0},${y0 + 30} V${y0 + 8} Q${x0},${y0} ${x0 + 8},${y0} H${x1 - 8} Q${x1},${y0} ${x1},${y0 + 8} V${y0 + 30}` : '',
      bot: st === 'full' ? `M${x0},${y1 - 30} V${y1 - 8} Q${x0},${y1} ${x0 + 8},${y1} H${x1 - 8} Q${x1},${y1} ${x1},${y1 - 8} V${y1 - 30}` : '',
    }[a.corner] || '';
    return { full, L: C, g, acc: '', r };
  }
  const acc = { tl: `M${x0},${y0 + 70} V${y0 + 6} Q${x0},${y0} ${x0 + 6},${y0} H${x0 + 70}`, tr: `M${x1 - 70},${y0} H${x1 - 6} Q${x1},${y0} ${x1},${y0 + 6} V${y0 + 70}`, bl: `M${x0},${y1 - 70} V${y1 - 6} Q${x0},${y1} ${x0 + 6},${y1} H${x0 + 70}`, br: `M${x1 - 70},${y1} H${x1 - 6} Q${x1},${y1} ${x1},${y1 - 6} V${y1 - 70}` }[a.corner] || '';
  return { full, L, g, acc, r };
}
let areaKey = '';
function renderAreas() {
  const list = areasOf();
  const key = [S.sheet, (S.sheets.find(x => x.id === S.sheet) || {}).layout, H, S.cfg.lineStyle || 'edge', JSON.stringify(S.zoneCfg || {}), S.locked].join('|');
  let hint = $('.empty-hint', canvasEl);
  if (key === areaKey) { if (hint) hint.hidden = visibleCards().length > 0; return; }
  areaKey = key;
  let defs = '', lines = '';
  const FLOW = false; // анимированные линии выключены
  list.forEach((a, i) => {
    const { full, L, g, acc, flat } = areaPaths(a);
    defs += flat
      ? `<linearGradient id="ag${i}" gradientUnits="userSpaceOnUse" x1="${g[0]}" y1="${g[1]}" x2="${g[2]}" y2="${g[3]}"><stop offset="0" stop-color="${a.c}" stop-opacity=".25"/><stop offset=".12" stop-color="${a.c}" stop-opacity=".95"/><stop offset=".88" stop-color="${a.c}" stop-opacity=".95"/><stop offset="1" stop-color="${a.c}" stop-opacity=".25"/></linearGradient>`
      : `<linearGradient id="ag${i}" gradientUnits="userSpaceOnUse" x1="${g[0]}" y1="${g[1]}" x2="${g[2]}" y2="${g[3]}"><stop offset="0" stop-color="${a.c}" stop-opacity="1"/><stop offset=".45" stop-color="${a.c}" stop-opacity=".55"/><stop offset="1" stop-color="${a.c}" stop-opacity=".08"/></linearGradient>`;
    lines += `<g class="aline${a.lines === false ? ' nolines' : ''}" data-area="${a.id}" data-corner="${a.corner}" style="--c:${a.c}"><path class="dash" d="${full}"/>${L ? `<path class="main" d="${L}"/>` : ''}</g>`;
  });
  areaLinesEl.innerHTML = `<defs>${defs}</defs>${lines}`;
  areasEl.classList.toggle('ls-corner', ['corner', 'full'].includes(S.cfg.lineStyle || 'edge'));
  areaLinesEl.classList.toggle('ls-edge', (S.cfg.lineStyle || 'edge') === 'edge');
  areasEl.innerHTML = list.map(a => { const r = areaRect(a); return `<div class="area" data-area="${a.id}" data-corner="${a.corner}" style="--c:${a.c};left:${r.x + 4}px;top:${r.y + 4}px;width:${r.w - 8}px;height:${r.h - 8}px"><span class="al"><span class="alt"${S.customLayouts?.[(S.sheets.find(x => x.id === S.sheet) || {}).layout] || S.zoneCfg?.[a.id]?.label ? ' data-noi18n' : ''}>${esc(T(a.label))}</span>${S.locked ? '' : `<button class="zgear" data-zone="${a.id}" title="Настройки зоны и «Как это работает»"><svg viewBox="0 0 16 16" width="11" height="11"><path d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zm6.3 3.6-.1-1.6 1.3-1-1.5-2.6-1.6.5-1.3-.8L10.8 1.6H7.8l-.4 1.7-1.3.8-1.6-.5L3 6.2l1.3 1-.1 1.6-1.2 1 1.5 2.6 1.6-.5 1.3.8.4 1.7h3l.4-1.7 1.3-.8 1.6.5 1.5-2.6z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>`}<span class="an">${esc(T(a.note || ''))}</span></span></div>`; }).join('')
    + list.filter(a => a.panel).map(a => { const r = areaRect(a); return `<div class="zone-panel" data-panel="${a.panel}" data-area="${a.id}" style="--c:${a.c};left:${r.x + 14}px;top:${r.y + 50}px;width:${r.w - 28}px;height:${r.h - 64}px"></div>`; }).join('')
    + `<div class="empty-hint" ${visibleCards().length ? 'hidden' : ''}><b>Перетащите файлы на холст</b> или в правую панель «Файлы».<br>Workflow — через «Инструменты» слева вверху.<br>Зажмите карточку — откроется круговое меню.</div>`;
  if (typeof fillPanels === 'function') fillPanels();
}
function setActiveArea(id) { $$('.area', areasEl).forEach(a => a.classList.toggle('active', a.dataset.area === id)); $$('.aline', areaLinesEl).forEach(a => a.classList.toggle('active', a.dataset.area === id)); }

/* ================= карточки ================= */
function srcOf(c) { return c.file ? API.view(c.file) : c.blob || null; }
function bars(seed, n = 24) { let s = seed * 9301 + 49297, h = ''; for (let i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; h += `<i style="height:${18 + (s / 233280) * 62}%"></i>`; } return `<div class="audio-face">${h}</div>`; }
function mediaHTML(c, { under = false, autoplay = false, controls = false } = {}) {
  const src = srcOf(c);
  if (c.kind === 'audio') return controls && src ? `<audio controls src="${esc(src)}" style="width:100%"></audio>` : bars(c.id);
  if (!src) return '';
  if (c.kind === 'image') return `<img class="${under ? 'under' : ''}" src="${esc(src)}" alt="" draggable="false">`;
  return `<video class="${under ? 'under' : ''}" src="${esc(src)}#t=0.1" muted loop playsinline preload="metadata" ${autoplay ? 'autoplay' : ''} ${controls ? 'controls' : ''}></video>`;
}
const sndIcon = () => S.cfg.peekSound ? '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' : '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.5"/></svg>';
/* у звука три вида: эффекты, озвучка, музыка — свой цвет и подпись */
const AUDIO_SUB = { sfx: 'звук', voice: 'озвучка', music: 'музыка' };
const MUSIC_RX = /music|track|song|beat|ost|instrumental|музык|трек|песн|мелоди/i, SFX_RX = /sfx|fx|шум|whoosh|hit|удар|ambient|амбиент|foley/i;
function audioSub(c) {
  if (c.kind !== 'audio') return null;
  if (c.sub) return c.sub;
  const a = c.sheet != null && !c.parked ? areaAt(c.x + CW / 2, c.y + CH / 2, c.sheet) : null;
  if (a?.id === 'sound') return 'sfx';
  if (MUSIC_RX.test(c.title) || c.dur > 60) return 'music';
  if (a?.id === 'voice') return 'voice';
  return SFX_RX.test(c.title) ? 'sfx' : 'voice';
}
function fileHTML(c) {
  const pend = c.status === 'queued' || c.status === 'running';
  let media = pend ? ((byId(c.parent) ? mediaHTML(byId(c.parent), { under: true }) : '') + (c.preview ? `<img class="live" src="${esc(c.preview)}" alt="">` : '')) : mediaHTML(c);
  let badge = c.status === 'uploading' ? '<span class="badge">загрузка…</span>' : c.status === 'error' ? (c.stopped ? '<span class="badge">остановлено</span>' : '<span class="badge err">ошибка</span>') : '';
  const len = c.dur ? `<span class="len">${c.dur.toFixed(1)} с</span>` : '';
  const took = !pend && c.took ? `<span class="took" title="Сколько шла генерация">⏱ ${mmss(c.took)}</span>` : '';
  const subt = c.from ? `из «${c.from}»` : c.offline ? 'только в браузере' : (c.w ? `${c.w}×${c.h}` : (audioSub(c) ? AUDIO_SUB[audioSub(c)] : KIND_RU[c.kind]));
  const snd = !pend && c.kind === 'video' ? `<button class="snd${S.cfg.peekSound ? ' on' : ''}" data-snd title="Звук при просмотре: ${S.cfg.peekSound ? 'включён' : 'выключен'}">${sndIcon()}</button>` : '';
  const sub = audioSub(c);
  return `<div class="media">${media}${badge}<span class="kind">${sub ? AUDIO_SUB[sub] : KIND_RU[c.kind] || ''}</span>${len}${took}${snd}</div><div class="cap"><b>${esc(c.title)}</b><span>${esc(subt)}</span></div>`;
}
const jobsOf = w => S.cards.filter(c => c.owner === w.id);
const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
/* шаг идёт подозрительно долго? (обычно — кончилась видеопамять, и ComfyUI гоняет данные через обычную память) */
function slowInfo(run) {
  if (run.status !== 'running') return null;
  const now = Date.now();
  if (run.lastStepAt && run.stepAvg) { const wait = (now - run.lastStepAt) / 1000; if (wait > Math.max(60, run.stepAvg * 4)) return { wait, avg: run.stepAvg, kind: 'step' }; }
  if (!run.lastStepAt && run.nodeT0) { const wait = (now - run.nodeT0) / 1000; if (wait > 240) return { wait, kind: 'node' }; }
  return null;
}
function runBadge(run) { return (slowInfo(run) ? '⚠ ' : '') + (run.stage || 'генерация…') + (run.step ? ' · шаг ' + run.step : ''); }
/* «идёт 2:14 · осталось ≈5 мин»: по истории прошлых запусков, а при первом запуске — по скорости шагов */
function runStatus(run) {
  const el = run.started ? (Date.now() - run.started) / 1000 : 0;
  let left = run.est ? run.est - el : null;
  if (left != null && left < 5) left = run.stepLeft ?? null; // история промахнулась — не показываем «0 с» вечно
  const sl = slowInfo(run);
  if (sl) return `⚠ ${sl.kind === 'step' ? 'шаг' : 'этап'} висит ${mmss(sl.wait)} — нажмите, чтобы узнать почему`;
  let s = 'идёт ' + mmss(el);
  if (left != null && left >= 1) s += ' · осталось ' + fmtSec(left);
  else if (run.stepLeft >= 1) s += ' · этап ещё ' + fmtSec(run.stepLeft);
  return s;
}
function widgetHTML(w) {
  const wf = wfById(w.wf);
  const color = wfColor(wf) || '#8f74f2';
  const jobs = jobsOf(w), results = jobs.filter(c => c.status === 'done'), run = jobs.find(c => c.status === 'running'), wait = jobs.filter(c => c.status === 'queued');
  const errs = jobs.filter(c => c.status === 'error' && !c.errSeen).length;
  const last = results.sort((a, b) => (b.done || 0) - (a.done || 0))[0];
  let media;
  if (run) media = (byId(run.parent) ? mediaHTML(byId(run.parent), { under: true }) : '') + (run.preview ? `<img class="live" src="${esc(run.preview)}" alt="">` : '') + `<span class="badge run" title="${esc(run.nodeTitle || '')}">${esc(runBadge(run))}</span><div class="prog"><i style="width:${Math.round((run.progress || 0) * 100)}%"></i></div>`;
  else if (last) media = mediaHTML(last);
  else media = `<div class="wph">${wf ? (wf.accepts.length ? `Бросьте сюда ${wf.accepts.map(k => ({ image: 'картинку', video: 'видео', audio: 'звук' }[k])).join(' / ')}<br>двойной клик — внутрь` : 'Двойной клик — внутрь') : 'Workflow не найден'}</div>`;
  let status;
  if (run) status = `<span class="rstat">${esc(runStatus(run))}</span>`;
  else if (wait.length) status = `в очереди ${wait.length}`;
  else if (errs) status = `<span style="color:var(--rec)">ошибок: ${errs}</span>`;
  else status = wf ? (estimate(wf, unitsOf(wf, paramDefaults(wf), byId(w.lastInput))) ? 'готов · ' + fmtSec(estimate(wf, unitsOf(wf, paramDefaults(wf), byId(w.lastInput)))) : 'готов') : '—';
  const stop = run || wait.length ? `<button class="wstop" data-wstop title="Остановить генерацию этого виджета">■</button>` : '';
  return { color, html: `<div class="wh"><i></i><b>${esc(wf ? wf.title : w.wf)}</b>${typeof presetBadges === 'function' ? presetBadges(w) : ''}<span>${esc(KIND_RU[wf?.kind] || '')}</span></div><div class="media">${media}</div><div class="wf">${stop}<span>${status}</span><span class="stack" title="Результаты">${results.length ? results.length + ' ▸' : ''}</span></div>` };
}
function sigOf(c) {
  if (c.type === 'widget') { const j = jobsOf(c); return 'w|' + (c.presets || []).join(',') + '|' + c.wf + '|' + (wfById(c.wf)?.title || '-') + '|' + j.map(x => x.status + (x.status === 'running' ? x.preview : '') + (x.errSeen ? 1 : 0)).join(','); }
  return [c.status, c.file?.filename, c.blob, c.preview, c.dur, c.took, c.title, c.w, c.kind === 'video' ? !!S.cfg.peekSound : '', audioSub(c) || ''].join('|');
}
function updCard(c) {
  const el = els.get(c.id); if (!el) return;
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  const sig = sigOf(c);
  if (el.dataset.sig !== sig) {
    if (c.type === 'widget') { const { color, html } = widgetHTML(c); el.style.setProperty('--c', color); el.innerHTML = html; }
    else { el.innerHTML = fileHTML(c); bindMedia(el, c); }
    el.dataset.sig = sig;
  } else if (c.type === 'widget') {
    const run = jobsOf(c).find(x => x.status === 'running');
    if (run) { const i = el.querySelector('.prog i'); if (i) i.style.width = Math.round((run.progress || 0) * 100) + '%'; const b = el.querySelector('.badge.run'); if (b) { b.textContent = runBadge(run); b.title = (run.nodeTitle || '') + ' — клик: что сейчас происходит'; b.classList.toggle('slow', !!slowInfo(run)); } const rs = el.querySelector('.rstat'); if (rs) rs.textContent = runStatus(run); }
  }
  el.className = 'card ' + (c.type === 'widget' ? 'widget' : 'k-' + c.kind + (c.kind === 'audio' ? ' a-' + audioSub(c) : '')) + (c.status === 'error' ? ' err' : '') + (sel.has(c.id) ? ' sel' : '');
}
setInterval(() => {
  for (const c of S.cards) if (c.type === 'widget' && jobsOf(c).some(x => x.status === 'running')) updCard(c);
  const tb = document.getElementById('traceBox'); if (tb) { const j = byId(+tb.dataset.id); if (j && j.status === 'running') tb.innerHTML = traceHTML(j); }
}, 1000);
function bindMedia(el, c) {
  const img = el.querySelector('img:not(.under):not(.live)');
  if (img && !c.w) img.addEventListener('load', () => { c.w = img.naturalWidth; c.h = img.naturalHeight; save(); updCard(c); }, { once: true });
  const v = el.querySelector('video:not(.under)');
  if (v) v.addEventListener('loadedmetadata', () => { let ch = false; if (isFinite(v.duration) && !c.dur) { c.dur = v.duration; ch = true; } if (!c.w && v.videoWidth) { c.w = v.videoWidth; c.h = v.videoHeight; ch = true; } if (ch) { save(); updCard(c); } }, { once: true });
  if (c.kind === 'audio' && !c.dur) { const src = srcOf(c); if (src) { const a = new Audio(); a.preload = 'metadata'; a.src = src; a.onloadedmetadata = () => { if (isFinite(a.duration)) { c.dur = a.duration; save(); updCard(c); } }; } }
}
function render(newIds = []) {
  if (builtSheet !== S.sheet) { cardsEl.innerHTML = ''; els.clear(); builtSheet = S.sheet; }
  const list = visibleCards();
  const alive = new Set(list.map(c => c.id));
  for (const [id, el] of els) if (!alive.has(id)) { el.remove(); els.delete(id); }
  for (const c of list) {
    let el = els.get(c.id);
    if (!el) { el = document.createElement('div'); el.dataset.id = c.id; el.tabIndex = 0; els.set(c.id, el); cardsEl.appendChild(el); }
    updCard(c);
    if (newIds.includes(c.id)) { el.classList.add('new'); setTimeout(() => el.classList.remove('new'), 500); }
  }
  renderAreas(); drawThreads(); renderPiano(); updateConn(); renderErrors();
  if (typeof renderSidePanels === 'function') renderSidePanels();
}
let jcT = null;
function jobChanged(c, light) {
  // лёгкие события прогресса: обновляем только виджет
  if (c && light) { const w = widgetOf(c); if (w && w.sheet === S.sheet) updCard(w); updateConn(); return; }
  if (jcT) return;
  jcT = requestAnimationFrame(() => { jcT = null; render(); });
}
function flashCard(id) { const el = els.get(id); if (el) { el.animate([{ boxShadow: '0 0 0 0 rgba(240,255,65,.8)' }, { boxShadow: '0 0 0 14px rgba(240,255,65,0)' }], { duration: 700 }); } }
/* подключения: файл → виджет. Картинка/видео как главный вход — через запуск; звук, второй кадр и т.п. —
   «подключить»: виджет запомнит файл и подставит его сам. Линию видно на столе. */
const wfTakes = (wf, kind) => (wf.params || []).some(p => p.type === kind);
function bindToWidget(w, c) {
  const wf = wfById(w.wf); if (!wf || !c) return false;
  w.bound = w.bound || {};
  if ((wf.params || []).some(p => p.type === 'card') && wf.accepts.includes(c.kind)) { w.lastInput = c.id; w.bound.card = c.id; }
  else if (wfTakes(wf, c.kind)) w.bound[c.kind] = c.id;
  else return false;
  if (w.unlinked) w.unlinked = w.unlinked.filter(x => x !== c.id);
  save(); drawThreads(); return true;
}
function dropOnWidget(files, t) {
  const w = t.w, wf = t.wf;
  const main = files.filter(f => wf.accepts.includes(f.kind) && (wf.params || []).some(p => p.type === 'card'));
  const extra = files.filter(f => !main.includes(f) && wfTakes(wf, f.kind));
  extra.forEach(f => bindToWidget(w, f));
  if (extra.length) toast(`🔗 Подключено к «${esc(wf.title)}»: ${extra.map(f => esc(f.title)).join(', ')}. Виджет подставит ${extra.length > 1 ? 'их' : 'его'} сам.`);
  if (main.length) dispatch(main, wf, { ask: true });
  else if (!(wf.params || []).some(p => p.type === 'card') && extra.length) { /* только подключили */ }
}
/* подставить подключённые файлы в параметры */
function applyBound(wf, vals) {
  const w = S.cards.find(c => c.type === 'widget' && c.sheet === S.sheet && c.wf === wf.id); if (!w?.bound) return vals;
  for (const p of wf.params || []) if (['audio', 'image', 'video'].includes(p.type) && w.bound[p.type] && isReady(byId(w.bound[p.type]))) { vals[p.id] = w.bound[p.type]; break; }
  return vals;
}
/* разорвать связь: Alt + клик по линии, или Alt + провести мышью поперёк */
function cutThread(wid, pid, kind) {
  const w = byId(wid); if (!w) return;
  w.unlinked = [...new Set([...(w.unlinked || []), pid])];
  if (w.lastInput === pid) w.lastInput = null;
  if (w.bound) for (const k of Object.keys(w.bound)) if (w.bound[k] === pid) delete w.bound[k];
  save(); drawThreads(); toast('✂ Связь разорвана: виджет больше не возьмёт этот файл сам.');
}
let altCut = false, altHeld = false;
const setAlt = on => { if (altHeld === on) return; altHeld = on; document.body.classList.toggle('alt-cut', on); if (!on) cutGlowOff(); };
window.addEventListener('keydown', e => { if (e.key === 'Alt') { setAlt(true); e.preventDefault(); } });
window.addEventListener('keyup', e => { if (e.key === 'Alt') setAlt(false); });
window.addEventListener('blur', () => setAlt(false));
threadHits.addEventListener('pointerdown', e => { const h = e.target.closest('.hit'); if (!h || !e.altKey) return; e.stopPropagation(); e.preventDefault(); if (typeof histPush === 'function') histPush('разрыв связи'); cutThread(+h.dataset.w, +h.dataset.p); });
/* подсветка: сама линия краснеет, яркое пятно бежит за курсором */
function cutGlowOff() { threadHits.querySelectorAll('.glow').forEach(g => g.remove()); }
window.addEventListener('pointermove', e => {
  if (!e.altKey) { if (altHeld) setAlt(false); return; }
  setAlt(true);
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const hit = el && el.classList?.contains('hit') ? el : null;
  cutGlowOff();
  if (!hit) return;
  if (altCut) { cutThread(+hit.dataset.w, +hit.dataset.p); return; }
  const m = threadHits.getScreenCTM(); if (!m) return;
  const x = (e.clientX - m.e) / m.a, y = (e.clientY - m.f) / m.d;
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'glow');
  g.innerHTML = `<defs><radialGradient id="cutG" gradientUnits="userSpaceOnUse" cx="${x}" cy="${y}" r="110"><stop offset="0" stop-color="#ff2d3d"/><stop offset=".35" stop-color="#ff4d5a" stop-opacity=".95"/><stop offset="1" stop-color="#ff9aa2" stop-opacity=".35"/></radialGradient></defs><path d="${hit.getAttribute('d')}" style="stroke:url(#cutG);opacity:1;stroke-dasharray:none;animation:none"/>`;
  threadHits.insertBefore(g, threadHits.firstChild);
});
window.addEventListener('pointerup', () => { altCut = false; });
/* линии связей: цвет плавно переходит от зоны-источника к зоне виджета; если они в разных зонах —
   линия уходит в «портал» в углу своей зоны и выходит из портала зоны виджета (не тянется через весь стол) */
const hex2rgb = h => { h = String(h || '#8f74f2').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mixHex = (a, b, t = .5) => { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function portalOf(area) {
  const r = areaRect(area), m = 16;
  if (area.montage || ['c', 'top', 'bot'].includes(area.corner)) return [r.x + r.w / 2, (r.y + r.h / 2 < H / 2) ? r.y + r.h - m : r.y + m];
  return [(r.x + r.w / 2 < W / 2) ? r.x + r.w - m : r.x + m, (r.y + r.h / 2 < H / 2) ? r.y + r.h - m : r.y + m];
}
// форма линий как в ComfyUI: плавная кривая / прямая / под прямым углом
const curve = (x1, y1, x2, y2) => {
  const st = S.cfg.linkStyle || 'curve';
  if (st === 'straight') return `M${x1},${y1} L${x2},${y2}`;
  if (st === 'angled') { const mx = Math.round((x1 + x2) / 2); return `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`; }
  const dx = Math.max(30, Math.abs(x2 - x1) * .45) * (x2 >= x1 ? 1 : -1); return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
};
function drawThreads() {
  let hits = '', defs = '', out = '', portals = new Map(), gi = 0; const links = [];
  const grad = (x1, y1, x2, y2, c1, c2) => { const id = 'tg' + (gi++); defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`; return id; };
  for (const w of visibleCards().filter(c => c.type === 'widget')) {
    const jobs = jobsOf(w).sort((a, b) => b.created - a.created);
    const seen = new Map();
    for (const j of jobs) { const p = byId(j.parent); if (!p || p.parked || p.sheet !== S.sheet || seen.has(p.id)) continue; seen.set(p.id, j.status === 'queued' || j.status === 'running'); if (seen.size >= 6) break; }
    for (const id of Object.values(w.bound || {})) { const p = byId(id); if (p && !p.parked && p.sheet === S.sheet && !seen.has(id)) seen.set(id, false); }
    const wa = areaAt(w.x + WW / 2, w.y + WH / 2);
    for (const [pid, wait] of seen) { if (!(w.unlinked || []).includes(pid)) links.push({ w, p: byId(pid), wait, wa }); }
  }
  // у каждой связи своя линия: если от файла (или к виджету) идёт несколько, точки выхода разводятся по краю
  const spread = (key, l) => { (groups[key] = groups[key] || []).push(l); };
  const groups = {}, lanes = {};
  const geo = links.map(l => {
    const { w, p } = l, pw = p.type === 'widget' ? WW : CW, ph = p.type === 'widget' ? WH : CH;
    const pcx = p.x + pw / 2, pcy = p.y + ph / 2, wcx = w.x + WW / 2, wcy = w.y + WH / 2;
    const vert = Math.abs(wcy - pcy) > Math.abs(wcx - pcx) && (w.y >= p.y + ph + 20 || w.y + WH <= p.y - 20);
    const g = { ...l, pw, ph, pcx, pcy, wcx, wcy, vert, down: wcy > pcy, right: w.x >= p.x + pw - 4 };
    const pa = areaAt(pcx, pcy), wa = l.wa;
    if (pa && wa && pa.id !== wa.id) {
      const [ax] = portalOf(pa), [bx] = portalOf(wa);
      spread('P' + p.id + (ax >= pcx ? 'r' : 'l'), g); spread('W' + w.id + (bx < wcx ? 'l' : 'r'), g);
      (lanes['A' + pa.id] = lanes['A' + pa.id] || []).push(g); (lanes['B' + wa.id] = lanes['B' + wa.id] || []).push(g);
      return g;
    }
    spread('p' + p.id + (vert ? (g.down ? 'b' : 't') : (g.right ? 'r' : 'l')), g);
    spread('w' + w.id + (vert ? (g.down ? 't' : 'b') : (g.right ? 'l' : 'r')), g);
    return g;
  });
  const frac = (key, g, axisVal) => { const arr = groups[key]; if (arr.length < 2) return null; const sorted = [...arr].sort((a, b) => axisVal(a) - axisVal(b)); const i = sorted.indexOf(g), n = arr.length; return .25 + (.5 * i) / (n - 1); };
  for (const g of geo) {
    const { w, p, pw, ph, wait, vert, down, right } = g;
    const pa = areaAt(g.pcx, g.pcy), wa = g.wa;
    const c1 = pa?.c || KIND_C[p.kind] || '#8f74f2', c2 = wa?.c || wfColor(wfById(w.wf)) || '#3fd2ff';
    const cls = wait ? 'wait' : '';
    let x1, y1, x2, y2, d;
    if (pa && wa && pa.id !== wa.id) {
      // разные зоны — через порталы, но у каждой связи своя дорожка: рядом идущие линии не сливаются в одну
      const [ax, ay] = portalOf(pa), [bx, by] = portalOf(wa);
      const right1 = ax >= p.x + pw / 2, left2 = bx < w.x + WW / 2;
      const fp = frac('P' + p.id + (right1 ? 'r' : 'l'), g, o => o.w.y) ?? .4, fw = frac('W' + w.id + (left2 ? 'l' : 'r'), g, o => o.p.y) ?? .4;
      const sx = right1 ? p.x + pw : p.x, sy = p.y + ph * fp, ex = left2 ? w.x : w.x + WW, ey = w.y + WH * fw;
      const lane = (key) => { const arr = lanes[key], n = arr.length; return n < 2 ? 0 : (arr.indexOf(g) - (n - 1) / 2) * 5; };
      const o1 = lane('A' + pa.id), o2 = lane('B' + wa.id);
      const d1 = curve(sx, sy, ax, ay + o1), d2 = curve(bx, by + o2, ex, ey);
      out += `<path class="${cls}" d="${d1}" style="stroke:url(#${grad(sx, sy, ax, ay, c1, c2)})"/><path class="${cls}" d="${d2}" style="stroke:url(#${grad(bx, by, ex, ey, c1, c2)})"/><circle cx="${sx}" cy="${sy}" r="2.2" style="fill:${c1}"/><circle cx="${ex}" cy="${ey}" r="2.2" style="fill:${c2}"/>`;
      portals.set(pa.id, [ax, ay, pa.c, (portals.get(pa.id)?.[3] || 0) + 1]); portals.set(wa.id, [bx, by, wa.c, (portals.get(wa.id)?.[3] || 0) + 1]);
      hits += `<path class="hit" data-w="${w.id}" data-p="${p.id}" d="${d1}"><title>Alt + клик — разорвать связь</title></path><path class="hit" data-w="${w.id}" data-p="${p.id}" d="${d2}"><title>Alt + клик — разорвать связь</title></path>`;
      continue;
    }
    if (vert) {
      const fp = frac('p' + p.id + (down ? 'b' : 't'), g, o => o.wcx) ?? .5, fw = frac('w' + w.id + (down ? 't' : 'b'), g, o => o.pcx) ?? .5;
      x1 = p.x + pw * fp; y1 = down ? p.y + ph : p.y; x2 = w.x + WW * fw; y2 = down ? w.y : w.y + WH;
      const dy = Math.max(30, Math.abs(y2 - y1) * .45) * (down ? 1 : -1); const st = S.cfg.linkStyle || 'curve';
      d = st === 'straight' ? `M${x1},${y1} L${x2},${y2}` : st === 'angled' ? `M${x1},${y1} L${x1},${Math.round((y1 + y2) / 2)} L${x2},${Math.round((y1 + y2) / 2)} L${x2},${y2}` : `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
    } else {
      const fp = frac('p' + p.id + (right ? 'r' : 'l'), g, o => o.wcy) ?? .4, fw = frac('w' + w.id + (right ? 'l' : 'r'), g, o => o.pcy) ?? .4;
      x1 = right ? p.x + pw : p.x; y1 = p.y + ph * fp; x2 = right ? w.x : w.x + WW; y2 = w.y + WH * fw; d = curve(x1, y1, x2, y2);
    }
    out += `<path class="${cls}" d="${d}" style="stroke:url(#${grad(x1, y1, x2, y2, c1, c2)})"/><circle cx="${x1}" cy="${y1}" r="2.2" style="fill:${c1}"/><circle cx="${x2}" cy="${y2}" r="2.2" style="fill:${c2}"/>`;
    hits += `<path class="hit" data-w="${w.id}" data-p="${p.id}" d="${d}"><title>Alt + клик — разорвать связь</title></path>`;
  }
  let pg = '';
  for (const [, [x, y, c, n]] of portals) pg += `<g class="portal" transform="translate(${x},${y})" style="--pc:${c}"><circle class="pg" r="15"/><circle class="p1" r="10"/><circle class="p2" r="6.5"/><circle class="p3" r="2.6"/>${n > 1 ? `<text class="pn" x="13" y="-11">${n}</text>` : ''}</g>`;
  threadsEl.innerHTML = `<defs>${defs}</defs>${out}${pg}${hits.replace(/class="hit"/g, 'class="hov"').replace(/<title>[^<]*<\/title>/g, '')}`;
  threadHits.innerHTML = hits; threadHits.style.height = threadsEl.style.height;
}

/* ================= расстановка ================= */
const overlap = (a, b, m = 6) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const rectOf = c => ({ x: c.x, y: c.y, w: c.type === 'widget' ? WW : CW, h: c.type === 'widget' ? WH : CH });
function slotsFor(area) {
  const r = areaRect(area), pad = 18, g = 12, sx = CW + g, sy = CH + g;
  const top = r.y + pad + 22, bottom = r.y + r.h - pad - CH, left = r.x + pad, right = r.x + r.w - pad - CW;
  const out = [];
  const col = (x, from, to) => { const st = from <= to ? sy : -sy; for (let y = from; st > 0 ? y <= to + .1 : y >= to - .1; y += st) out.push({ x, y }); };
  const row = (y, from, to) => { const st = from <= to ? sx : -sx; for (let x = from; st > 0 ? x <= to + .1 : x >= to - .1; x += st) out.push({ x, y }); };
  for (let L = 0; L < 6; L++) {
    const l = left + L * sx, rr = right - L * sx, t = top + L * sy, b = bottom - L * sy;
    if (l > rr + 1 || t > b + 1) break;
    switch (area.corner) {
      case 'tl': col(l, b, t); row(t, l + sx, rr); break;              // снизу вверх по левой, затем слева направо по верхней
      case 'tr': row(t, l, rr); col(rr, t + sy, b); break;              // слева направо по верхней, затем сверху вниз по правой
      case 'bl': col(l, t, b); row(b, l + sx, rr); break;
      case 'br': row(b, l, rr); col(rr, b - sy, t); break;
      case 'l': col(l, t, b); break;
      case 'r': col(rr, t, b); break;
      default: row(t, l, rr); break;
    }
    if (area.corner === 'c' || area.corner === 'l' || area.corner === 'r') { /* следующие ряды */ }
  }
  if (['c', 'l', 'r'].includes(area.corner)) { // для середины — сеткой
    out.length = 0;
    const cols = [];
    if (area.corner === 'r') for (let x = right; x >= left - .1; x -= sx) cols.push(x); else for (let x = left; x <= right + .1; x += sx) cols.push(x);
    for (let y = top; y <= bottom + .1; y += sy) for (const x of cols) out.push({ x, y });
  }
  return out;
}
/* с какой стороны виджета выпадают готовые результаты: к внешнему краю зоны */
const spillSide = area => !area || ['tl', 'bl', 'l', 'c', 'top', 'bot'].includes(area.corner) ? 1 : -1;
function widgetSpot(area) {
  // виджет стоит у угла зоны, но с отступом в одну колонку карточек — туда падают результаты
  const r = areaRect(area), m = 22, col = CW + 28;
  const spots = { tl: [r.x + r.w - WW - m - col, r.y + r.h - WH - m], tr: [r.x + m + col, r.y + r.h - WH - m], bl: [r.x + r.w - WW - m - col, r.y + m + 18], br: [r.x + m + col, r.y + m + 18], l: [r.x + r.w - WW - m - col, r.y + (r.h - WH) / 2], r: [r.x + m + col, r.y + (r.h - WH) / 2], c: [r.x + (r.w - WW) / 2, r.y + (r.h - WH) / 2] };
  return spots[area.corner] || spots.c;
}
/* готовый результат сам выходит на стол: колонкой сверху вниз рядом с виджетом */
function spillResult(c, w) {
  const area = areaAt(w.x + WW / 2, w.y + WH / 2, w.sheet);
  const side = spillSide(area), g = 12;
  const r = area ? areaRect(area) : { x: 0, y: 40, w: W, h: H - 140 };
  const top = r.y + 40, bottom = Math.min(r.y + r.h, H - 10) - CH - 8;
  const panels = areasOf(w.sheet).filter(a => a.panel).map(a => { const q = areaRect(a); return { x: q.x, y: q.y, w: q.w, h: q.h }; });
  const others = visibleCards(w.sheet).filter(o => o.id !== c.id).map(rectOf).concat(panels);
  c.parked = false;
  for (let k = 0; k < 8; k++) {
    const cx = side > 0 ? (k === 0 ? w.x + WW + 14 : k % 2 ? w.x + WW + 14 - Math.ceil(k / 2) * (CW + g) : w.x + WW + 14 + (k / 2) * (CW + g))
      : (k === 0 ? w.x - CW - 14 : k % 2 ? w.x - CW - 14 + Math.ceil(k / 2) * (CW + g) : w.x - CW - 14 - (k / 2) * (CW + g));
    if (cx < r.x + 4 || cx + CW > r.x + r.w - 4 || cx < 0 || cx + CW > W) continue;
    for (let y = top; y <= bottom + .1; y += CH + g) { const me = { x: cx, y, w: CW, h: CH }; if (!others.some(o => overlap(me, o, 4))) { c.x = cx; c.y = y; return true; } }
  }
  placeCard(c, area || areaForKind(c.kind, c.title, w.sheet)); return true;
}
function placeCard(c, area, avoid = []) {
  // зоны-панели (Сценарий, Ассистент) — не место для карточек
  const panels = areasOf(c.sheet).filter(a => a.panel).map(a => { const r = areaRect(a); return { x: r.x, y: r.y, w: r.w, h: r.h }; });
  const others = visibleCards(c.sheet).filter(o => o.id !== c.id && !avoid.includes(o.id)).map(rectOf).concat(panels);
  const me = rectOf(c);
  if (c.type === 'widget') {
    const [bx, by] = area ? widgetSpot(area) : [W / 2 - WW / 2, H / 2 - WH / 2];
    const dir = area && ['tl', 'bl', 'l'].includes(area.corner) ? -1 : 1;
    for (let i = 0; i < 12; i++) { const x = bx + dir * i * (WW + 16) * (i % 2 ? 0 : 1), y = by - (i % 2) * (WH + 16) * Math.ceil(i / 2); const r = { ...me, x: Math.max(0, Math.min(W - WW, x)), y: Math.max(0, Math.min(H - WH, y)) }; if (!others.some(o => overlap(r, o))) { c.x = r.x; c.y = r.y; return; } }
    c.x = bx; c.y = by; return;
  }
  const slots = area ? slotsFor(area) : [];
  for (const s of slots) { const r = { ...me, x: s.x, y: s.y }; if (!others.some(o => overlap(r, o))) { c.x = s.x; c.y = s.y; return; } }
  for (let y = 60; y < H - CH; y += CH + 12) for (let x = 20; x < W - CW; x += CW + 12) { const r = { ...me, x, y }; if (!others.some(o => overlap(r, o))) { c.x = x; c.y = y; return; } }
  c.x = 40 + Math.random() * 200; c.y = 80 + Math.random() * 200;
}
function ensureWidget(wf, sheet, src) {
  let w = S.cards.find(c => c.type === 'widget' && c.sheet === sheet && c.wf === wf.id);
  if (w) return w;
  w = { id: S.nextId++, type: 'widget', sheet, wf: wf.id, created: Date.now(), x: 0, y: 0 };
  const area = (wf.zone && areasOf(sheet).find(a => a.id === wf.zone)) || areaForKind(wf.kind, wf.title, sheet) || areasOf(sheet).find(a => !a.montage);
  S.cards.push(w); placeCard(w, area);
  return w;
}
function sortKey(c) { return S.cfg.sortBy === 'name' ? (c.title || '').toLowerCase() : (c.done || c.created || 0); }
function autoSort(sheet = S.sheet) {
  const list = visibleCards(sheet);
  const areas = areasOf(sheet);
  const byArea = new Map(areas.map(a => [a.id, { area: a, files: [], widgets: [] }]));
  const loose = [];
  for (const c of list) {
    const r = rectOf(c), a = areaAt(r.x + r.w / 2, r.y + r.h / 2, sheet);
    if (a) byArea.get(a.id)[c.type === 'widget' ? 'widgets' : 'files'].push(c);
    else loose.push(c);
  }
  for (const c of loose) {
    const a = c.type === 'widget' ? areaForKind(wfById(c.wf)?.kind || 'video', '', sheet) : areaForKind(c.kind, c.title, sheet);
    if (a) byArea.get(a.id)[c.type === 'widget' ? 'widgets' : 'files'].push(c);
  }
  cardsEl.classList.add('sorting');
  const placed = [];
  for (const { area, files, widgets } of byArea.values()) {
    if (area.panel && !files.length && !widgets.length) continue;
    for (const w of widgets) { w.x = -9999; }
    for (const w of widgets) { placeCard(w, area, files.map(f => f.id)); placed.push(w.id); }
    let ordered;
    if (area.montage) ordered = [...files].sort((a, b) => (Math.abs(a.y - b.y) < 60 ? a.x - b.x : a.y - b.y));
    else ordered = [...files].sort((a, b) => { const ka = sortKey(a), kb = sortKey(b); return ka < kb ? -1 : ka > kb ? 1 : 0; });
    const slots = slotsFor(area).filter(s => !widgets.some(w => overlap({ x: s.x, y: s.y, w: CW, h: CH }, rectOf(w))));
    ordered.forEach((c, i) => { const s = slots[i]; if (s) { c.x = s.x; c.y = s.y; } else placeCard(c, area); });
  }
  save(); render();
  setTimeout(() => { cardsEl.classList.remove('sorting'); drawThreads(); }, 500);
  toast('Разложено по областям.');
}

/* ================= выделение, удаление ================= */
function setSel(ids, add) { if (!add) sel.clear(); ids.forEach(i => sel.add(i)); for (const [id, el] of els) el.classList.toggle('sel', sel.has(id)); renderPiano(); }
function toggleSel(id, add) { if (!add) { const only = sel.has(id) && sel.size === 1; sel.clear(); if (!only) sel.add(id); } else sel.has(id) ? sel.delete(id) : sel.add(id); for (const [cid, el] of els) el.classList.toggle('sel', sel.has(cid)); renderPiano(); }
let undoBuf = null;
function removeCards(ids) {
  const set = new Set(ids);
  // удаляя виджет, удаляем и его результаты
  for (const c of S.cards) if (c.owner && set.has(c.owner)) set.add(c.id);
  const gone = S.cards.filter(c => set.has(c.id));
  if (!gone.length) return;
  gone.forEach(c => { if (c.status === 'queued' || c.status === 'running') cancelJob(c); });
  S.cards = S.cards.filter(c => !set.has(c.id));
  ids.forEach(i => sel.delete(i));
  undoBuf = gone; save(); render();
  toast(`Удалено: <b>${gone.length}</b>`, { label: 'Вернуть', fn: undo });
}
function undo() { if (!undoBuf) return; S.cards.push(...undoBuf.map(c => (c.status === 'running' || c.status === 'queued') ? { ...c, status: 'error', error: 'Отменено при удалении' } : c)); undoBuf = null; save(); render(); toast('Вернул.'); }

/* ================= файлы ================= */
const kindOfFile = f => f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : extKind(f.name);
function makeFileCard(f, extra) {
  const kind = kindOfFile(f);
  const c = { id: S.nextId++, type: 'file', kind, title: f.name.replace(/\.[^.]+$/, ''), status: 'uploading', progress: 0, created: Date.now(), blob: URL.createObjectURL(f), ...extra };
  API.upload(f).then(file => { c.file = file; c.status = 'ready'; save(); if (c.sheet === S.sheet && !c.parked) updCard(c); if (typeof renderSidePanels === 'function') renderSidePanels(); })
    .catch(e => { c.status = online() ? 'error' : 'ready'; c.error = online() ? 'Не удалось загрузить в ComfyUI: ' + e.message : ''; c.offline = !online(); if (els.get(c.id)) updCard(c); });
  return c;
}
function addFilesToCanvas(files, at = null, sheet = S.sheet) {
  const list = [...files].filter(kindOfFile);
  if (!list.length) { toast('Подходят картинки, видео и звук.'); return []; }
  const made = [];
  list.forEach((f, i) => {
    const c = makeFileCard(f, { sheet, x: 0, y: 0 });
    S.cards.push(c); made.push(c);
    if (at && sheet === S.sheet) { c.x = clampX(at[0] - CW / 2 + (i % 5) * 26); c.y = clampY(at[1] - CH / 2 + Math.floor(i / 5) * 26 + (i % 5) * 8); }
    else placeCard(c, areaForKind(c.kind, c.title, sheet));
  });
  save(); render(made.map(c => c.id));
  toast(`На холст: <b>${list.length}</b>`);
  return made;
}

/* ================= перетаскивание и жесты на холсте ================= */
const ghost = $('#ghost');
let G = null, lastXY = [0, 0];
function stopWidget(w) {
  const jobs = jobsOf(w).filter(x => x.status === 'running' || x.status === 'queued');
  if (!jobs.length) return toast('Этот виджет сейчас ничего не генерирует.');
  jobs.forEach(cancelJob);
}
/* клик по бейджу «генерация · шаг» — журнал шагов: что идёт и где застряло */
canvasEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('.badge.run, .rstat'); if (!b) return;
  const el = b.closest('.card.widget'); const w = el && byId(+el.dataset.id); const run = w && jobsOf(w).find(x => x.status === 'running'); if (!run) return;
  e.stopPropagation(); e.preventDefault(); openDetails(run);
}, true);
/* кнопка ■ на виджете */
canvasEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-wstop]'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  const el = b.closest('.card'); const w = el && byId(+el.dataset.id); if (w) stopWidget(w);
}, true);
/* значок звука на видео: по умолчанию выключен, клик — увеличенный просмотр со звуком */
canvasEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-snd]'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  S.cfg.peekSound = !S.cfg.peekSound; save();
  // звук включается сразу, без перезагрузки видео
  const pv = peek.querySelector('video');
  if (pv && !peek.hidden) { pv.muted = !S.cfg.peekSound; if (S.cfg.peekSound) { pv.volume = 0.8; pv.play().catch(() => { }); } const ps = peek.querySelector('.psnd'); if (ps) ps.innerHTML = sndIcon(); }
  else { const el = b.closest('.card'); if (el) showPeek(+el.dataset.id, el); }
  $$('.card [data-snd]', cardsEl).forEach(x => { x.innerHTML = sndIcon(); x.classList.toggle('on', !!S.cfg.peekSound); x.title = 'Звук при просмотре: ' + (S.cfg.peekSound ? 'включён' : 'выключен'); });
  toast(S.cfg.peekSound ? 'Звук при просмотре включён.' : 'Звук выключен.');
}, true);
canvasEl.addEventListener('pointerdown', e => {
  if (e.target.closest('.zone-panel')) return;
  for (const [n, el] of Object.entries(edges)) if (!el.classList.contains('pinned')) el.classList.remove('open');
  if (M && M.sticky) return;
  const el = e.target.closest('.card');
  if (!el) { if (e.button === 0) startMarquee(e); return; }
  if (e.button === 1) return;
  e.preventDefault();
  const id = +el.dataset.id;
  G = { id, x0: e.clientX, y0: e.clientY, t0: performance.now(), pid: e.pointerId, btn: e.button, mode: 'press', samples: [], copy: e.ctrlKey || e.altKey };
  lastXY = [e.clientX, e.clientY];
  hidePeek();
  if (e.button === 2) { if (openRadialFor(id, e.clientX, e.clientY)) G.mode = 'menu'; else G = null; }
  else G.timer = setTimeout(() => { if (G && G.mode === 'press' && openRadialFor(id, G.x0, G.y0)) G.mode = 'menu'; }, S.cfg.holdMs);
  if (G) addG();
});
function addG() { window.addEventListener('pointermove', gMove); window.addEventListener('pointerup', gUp); window.addEventListener('pointercancel', gCancel); }
function remG() { window.removeEventListener('pointermove', gMove); window.removeEventListener('pointerup', gUp); window.removeEventListener('pointercancel', gCancel); }
function gMove(e) {
  if (!G || e.pointerId !== G.pid) return;
  lastXY = [e.clientX, e.clientY];
  G.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY }); while (G.samples.length > 8) G.samples.shift();
  if (G.mode === 'press' && Math.hypot(e.clientX - G.x0, e.clientY - G.y0) > S.cfg.moveTol) {
    clearTimeout(G.timer);
    if (G.src === 'res') return; // результаты начинают перетаскивание сами
    if (S.locked) { G.mode = 'none'; toast('Стол на замке.'); return; }
    if (G.src === 'row') { const items = G.items(); if (!items.length) { G.mode = 'none'; return; } startExtDrag(e, items, G.from); }
    else startCanvasDrag(e);
  }
  if (G.mode === 'drag') moveCanvasDrag(e);
  else if (G.mode === 'ext') moveExtDrag(e);
  else if (G.mode === 'menu' && M) trackRadial(e.clientX, e.clientY);
}
function gUp(e) {
  if (!G || e.pointerId !== G.pid) return;
  clearTimeout(G.timer);
  const quick = performance.now() - G.t0 < 260 && Math.hypot(e.clientX - G.x0, e.clientY - G.y0) <= S.cfg.moveTol;
  if (G.mode === 'press') { if (G.src === 'row') rowClick(G, e); else if (G.src !== 'res') toggleSel(G.id, e.shiftKey || e.ctrlKey || e.metaKey); }
  else if (G.mode === 'drag') endCanvasDrag(e);
  else if (G.mode === 'ext') endExtDrag(e);
  else if (G.mode === 'menu' && M) { if (quick && G.btn === 2) { M.sticky = true; drawRadial(); } else closeRadial(true); }
  G = null; remG();
}
function gCancel() { if (!G) return; clearTimeout(G.timer); if (G.mode === 'drag') endCanvasDrag(null); if (G.mode === 'ext') endExtDrag(null); closeRadial(false); G = null; remG(); }

function startCanvasDrag(e) {
  const primary = byId(G.id);
  if (!sel.has(G.id)) setSel([G.id], e.shiftKey);
  let group = [...sel].map(byId).filter(c => c && !c.parked && c.sheet === S.sheet);
  if (G.copy) { // Ctrl/Alt — тащим копии
    group = group.filter(c => c.type === 'file' && isReady(c)).map(c => { const n = { ...c, id: S.nextId++, created: Date.now() }; delete n.preview; S.cards.push(n); return n; });
    if (!group.length) { G.mode = 'none'; return; }
    render(); setSel(group.map(c => c.id));
    G.id = group[0].id;
  }
  const [lx, ly] = toLogical(e.clientX, e.clientY);
  G.group = group.map(c => ({ c, dx: c.x - lx, dy: c.y - ly, x0: c.x, y0: c.y }));
  G.mode = 'drag';
  G.group.forEach(({ c }) => { const el = els.get(c.id); if (el) { el.classList.add('dragging'); el.style.pointerEvents = 'none'; } }); cardsEl.classList.add('dragging-any');
  G.primary = primary;
}
let dropT = null;
function dropTargetAt(cx, cy, files) {
  const under = document.elementFromPoint(cx, cy);
  if (!under) return null;
  const key = under.closest('.key[data-sheet]'); if (key) return { type: 'sheet', el: key, sheet: +key.dataset.sheet };
  const blank = under.closest('.key[data-new]'); if (blank && files.some(f => f.type === 'widget')) return { type: 'bind', el: blank, code: WHITE[+blank.dataset.new] };
  const ck = under.closest('[data-bind]'); if (ck) return { type: 'bind', el: ck, code: ck.dataset.bind };
  const wEl = under.closest('.card.widget');
  if (wEl) { const w = byId(+wEl.dataset.id); const wf = w && wfById(w.wf); if (wf && files.some(f => f.type === 'file' && (wf.accepts.includes(f.kind) || wfTakes(wf, f.kind)))) return { type: 'widget', el: wEl, w, wf }; }
  if (under.closest('#tabCut') || under.closest('[data-tab="cut"]')) return { type: 'cut', el: $('#right') };
  if (under.closest('#tabFiles')) return { type: 'inbox', el: $('#tabFiles') };
  return null;
}
function highlightTarget(t) {
  $$('.key.hot, .ck.hot, .bk.hot2, .card.widget.drop-in').forEach(x => x.classList.remove('hot', 'drop-in'));
  if (!t) return;
  if (t.type === 'widget') t.el.classList.add('drop-in'); else if (t.el && t.type !== 'cut' && t.type !== 'inbox') t.el.classList.add('hot');
}
function moveCanvasDrag(e) {
  const [lx, ly] = toLogical(e.clientX, e.clientY);
  for (const g of G.group) { g.c.x = Math.max(-40, Math.min(W - 60, lx + g.dx)); g.c.y = Math.max(-40, Math.min(H - 40, ly + g.dy)); const el = els.get(g.c.id); if (el) { el.style.left = g.c.x + 'px'; el.style.top = g.c.y + 'px'; } }
  const a = areaAt(lx, ly); $$('.area', areasEl).forEach(x => x.classList.toggle('drop', a && x.dataset.area === a.id));
  G.target = dropTargetAt(e.clientX, e.clientY, G.group.map(g => g.c));
  highlightTarget(G.target);
  edgeHover(e.clientX);
  drawThreads();
}
function endCanvasDrag(e) {
  $$('.area.drop', areasEl).forEach(x => x.classList.remove('drop'));
  highlightTarget(null);
  const group = G.group || [];
  group.forEach(({ c }) => { const el = els.get(c.id); if (el) { el.classList.remove('dragging'); el.style.pointerEvents = ''; } }); cardsEl.classList.remove('dragging-any');
  const t = e ? G.target : null;
  const back = () => group.forEach(g => { g.c.x = g.x0; g.c.y = g.y0; });
  const files = group.map(g => g.c).filter(c => c.type === 'file');
  if (t) {
    back();
    if (t.type === 'widget') dropOnWidget(files, t);
    else if (t.type === 'sheet') { files.forEach(c => copyToSheet(c, t.sheet, e.altKey)); if (!files.length && group.some(g => g.c.type === 'widget')) toast('Эта клавиша занята сценой. Положите виджет на пустую клавишу «+» (или скройте/удалите сцену), на чёрную клавишу или на нижние ряды.'); }
    else if (t.type === 'bind') { const ws = group.map(g => g.c).filter(c => c.type === 'widget'); if (ws.length) bindOpen(t.code, ws[0].wf); else runBinding(t.code, files); }
    else if (t.type === 'cut') files.forEach(c => moveToCut(c));
    else if (t.type === 'inbox') { files.forEach(c => { S.inbox.push({ ...c, id: S.nextId++, sheet: null, parked: false }); }); toast('Добавлено во «Входящие».'); }
    save(); render(); return;
  }
  if (!e) { back(); render(); return; }
  // инерция + мягкий магнит
  const s = G.samples, n = s.length;
  let vx = 0, vy = 0;
  if (n >= 2) { const a = s[0], b = s[n - 1], dt = Math.max(1, b.t - a.t); if (performance.now() - b.t < 60) { vx = (b.x - a.x) / dt / scale; vy = (b.y - a.y) / dt / scale; } }
  const speed = Math.hypot(vx, vy);
  if (S.cfg.magnet && speed > 0.5) fling(group.map(g => g.c), vx, vy);
  else settle(group.map(g => g.c));
}
function fling(cards, vx, vy) {
  let last = performance.now();
  const step = now => {
    const dt = Math.min(32, now - last); last = now;
    vx *= Math.pow(0.92, dt / 16); vy *= Math.pow(0.92, dt / 16);
    for (const c of cards) {
      c.x += vx * dt; c.y += vy * dt;
      const r = rectOf(c);
      if (c.x < 0 || c.x > W - r.w) { c.x = Math.max(0, Math.min(W - r.w, c.x)); vx = 0; }
      if (c.y < 0 || c.y > H - r.h) { c.y = Math.max(0, Math.min(H - r.h, c.y)); vy = 0; }
      const el = els.get(c.id); if (el) { el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; }
    }
    drawThreads();
    if (Math.hypot(vx, vy) > 0.04) requestAnimationFrame(step); else settle(cards);
  };
  requestAnimationFrame(step);
}
function settle(cards) {
  // мягкий магнит: карточка, центр которой в области, мягко заезжает внутрь целиком
  cardsEl.classList.add('sorting');
  for (const c of cards) {
    const r = rectOf(c);
    c.x = Math.max(0, Math.min(W - r.w, c.x)); c.y = Math.max(0, Math.min(H - r.h, c.y));
    if (!S.cfg.magnet) continue;
    const a = areaAt(c.x + r.w / 2, c.y + r.h / 2); if (!a) continue;
    const ar = areaRect(a), p = 12;
    c.x = Math.max(ar.x + p, Math.min(ar.x + ar.w - r.w - p, c.x));
    c.y = Math.max(ar.y + p, Math.min(ar.y + ar.h - r.h - p, c.y));
  }
  save(); render();
  setTimeout(() => { cardsEl.classList.remove('sorting'); drawThreads(); }, 480);
}
function copyToSheet(c, sheetId, move) {
  if (c.sheet === sheetId) return;
  if (move) { c.sheet = sheetId; sel.delete(c.id); placeCard(c, c.type === 'widget' ? areaForKind(wfById(c.wf)?.kind, '', sheetId) : areaForKind(c.kind, c.title, sheetId)); }
  else { if (!isReady(c)) return toast('Скопировать можно только готовый файл.'); const n = { ...c, id: S.nextId++, sheet: sheetId, created: Date.now() }; delete n.preview; S.cards.push(n); placeCard(n, areaForKind(n.kind, n.title, sheetId)); }
  toast(`${move ? 'Перенесено' : 'Скопировано'} в <b>${esc(sheetName(sheetId))}</b>`);
}
function moveToCut(c) {
  const a = areasOf(c.sheet).find(x => x.montage);
  if (!a) { toast('В этой раскладке нет области монтажа.'); return; }
  if (c.parked) { c.parked = false; c.owner = null; }
  placeCard(c, a);
}

/* ---- внешнее перетаскивание (из панелей, из результатов) ---- */
function startExtDrag(e, items, from) {
  G.mode = 'ext'; G.items = items; G.from = from;
  const c = items[0];
  ghost.innerHTML = `<div class="media">${isReady(c) ? mediaHTML(c) : ''}</div>${items.length > 1 ? `<span class="cnt">${items.length}</span>` : ''}<span class="tag" hidden></span>`;
  ghost.hidden = false; moveExtDrag(e);
}
function moveExtDrag(e) {
  ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
  G.target = dropTargetAt(e.clientX, e.clientY, G.items);
  highlightTarget(G.target);
  const overBoard = !G.target && document.elementFromPoint(e.clientX, e.clientY)?.closest('#board');
  const tag = ghost.querySelector('.tag');
  const copy = e.ctrlKey || e.altKey || G.from === 'lib';
  tag.hidden = !(G.target || overBoard);
  tag.textContent = G.target ? ({ widget: '→ в workflow', sheet: '+ на сцену', bind: '→ клавиша', cut: '+ в монтаж', inbox: '+ во входящие' }[G.target.type] || '') : (copy ? '+ копия' : '→ на холст');
  if (overBoard) { const [lx, ly] = toLogical(e.clientX, e.clientY); const a = areaAt(lx, ly); $$('.area', areasEl).forEach(x => x.classList.toggle('drop', a && x.dataset.area === a.id)); }
  edgeHover(e.clientX, true);
}
function endExtDrag(e) {
  ghost.hidden = true; highlightTarget(null); $$('.area.drop', areasEl).forEach(x => x.classList.remove('drop'));
  if (!e) return;
  const copy = e.ctrlKey || e.altKey || G.from === 'lib';
  const items = G.items, t = G.target;
  const takeOut = c => { // достать файл из источника (входящие / результаты), вернуть карточку для холста
    if (G.from === 'result') { if (copy) { const n = { ...c, id: S.nextId++, parked: false, owner: null, created: Date.now() }; S.cards.push(n); return n; } c.parked = false; c.owner = null; return c; }
    const n = { ...c, id: S.nextId++, type: 'file', sheet: S.sheet, parked: false, owner: null, created: Date.now() };
    if (G.from === 'inbox' && !copy) S.inbox = S.inbox.filter(x => x.id !== c.id);
    S.cards.push(n); return n;
  };
  if (t && t.type === 'widget') { const cards = items.map(takeOut); cards.forEach(c => { c.sheet = S.sheet; placeCard(c, areaForKind(c.kind, c.title)); }); dropOnWidget(cards, t); }
  else if (t && t.type === 'sheet') items.forEach(c => { const n = takeOut(c); n.sheet = t.sheet; placeCard(n, areaForKind(n.kind, n.title, t.sheet)); });
  else if (t && t.type === 'cut') items.forEach(c => { const n = takeOut(c); n.sheet = S.sheet; moveToCut(n); });
  else if (t && t.type === 'bind') { const cards = items.map(takeOut); cards.forEach(c => { c.sheet = S.sheet; placeCard(c, areaForKind(c.kind, c.title)); }); runBinding(t.code, cards); }
  else if (t && t.type === 'inbox') { if (G.from !== 'inbox') items.forEach(c => S.inbox.push({ ...c, id: S.nextId++, sheet: null, parked: false, owner: null })); }
  else if (document.elementFromPoint(e.clientX, e.clientY)?.closest('#board')) {
    const [lx, ly] = toLogical(e.clientX, e.clientY);
    items.forEach((c, i) => { const n = takeOut(c); n.sheet = S.sheet; n.x = clampX(lx - CW / 2 + (i % 5) * 24); n.y = clampY(ly - CH / 2 + Math.floor(i / 5) * 24 + (i % 5) * 8); });
    settle([]);
  }
  save(); render(); if (typeof renderSidePanels === 'function') renderSidePanels();
}

/* ---- рамка выделения ---- */
const marquee = $('#marquee');
function startMarquee(e) {
  if (e.altKey && typeof startScissors === 'function') return startScissors(e); // Alt + протяжка — ножницы для линий, не выделение
  if (!e.shiftKey && !e.ctrlKey) setSel([]);
  const [x0, y0] = toLogical(e.clientX, e.clientY);
  const base = new Set(sel);
  const mv = ev => {
    const [x1, y1] = toLogical(ev.clientX, ev.clientY);
    const r = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    if (r.w + r.h < 6) return;
    Object.assign(marquee.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); marquee.hidden = false;
    const hit = visibleCards().filter(c => overlap(rectOf(c), r, 0)).map(c => c.id);
    setSel([...base, ...hit]);
  };
  const up = () => { marquee.hidden = true; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
document.addEventListener('contextmenu', e => { if (e.target.closest('.card, .row, .res, #piano') || M) e.preventDefault(); });

/* ================= круговое меню (до трёх уровней) ================= */
const radial = $('#radial'), rsvg = $('#rsvg');
// главный круг толстый, каждый следующий уровень тоньше (по высоте), но шире по углу
const RING = [[44, 132], [136, 190], [194, 238], [242, 278]], SPAN = [0, 32, 24, 19], LEVELS = RING.length;
const AWAY = 110; // увели курсор дальше внешнего кольца на столько — меню в режиме «отмена»
let M = null;
const deg = a => a * Math.PI / 180, norm = a => ((a % 360) + 360) % 360;
function arc(r0, r1, a0, a1) { const p = (r, a) => `${(r * Math.cos(deg(a))).toFixed(2)},${(r * Math.sin(deg(a))).toFixed(2)}`; const lg = (a1 - a0) > 180 ? 1 : 0; return `M${p(r1, a0)} A${r1},${r1} 0 ${lg} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 ${lg} 0 ${p(r0, a0)} Z`; }
function wfTree(kind) {
  const groups = [];
  for (const wf of WFS.filter(w => w.accepts.includes(kind))) {
    const path = wf.menu && wf.menu.length ? wf.menu : [wf.title];
    let level = groups;
    path.forEach((name, i) => {
      if (i === path.length - 1) level.push({ label: name, enabled: true, run: () => wf });
      else { let g = level.find(x => x.label === name && x.children); if (!g) { g = { label: name, children: [], enabled: true }; level.push(g); } level = g.children; }
    });
  }
  return groups;
}
function fileMenu(c) {
  const items = [];
  const wfs = wfTree(c.kind);
  if (wfs.length === 1 && wfs[0].children) items.push(wfs[0]); else if (wfs.length) items.push(...wfs.slice(0, 4));
  if (!wfs.length) items.push({ label: 'Workflow', enabled: true, act: () => importWorkflowDialog(), note: 'добавить' });
  items.push({ label: 'В монтаж', enabled: isReady(c), act: () => moveToCut(c) });
  const targets = visibleCards().filter(w => w.type === 'widget' && wfById(w.wf) && (wfById(w.wf).accepts.includes(c.kind) || wfTakes(wfById(w.wf), c.kind)));
  if (targets.length && isReady(c)) items.push({ label: 'Подключить к…', enabled: true, children: targets.slice(0, 8).map(w => ({ label: (wfById(w.wf).title.length > 15 ? wfById(w.wf).title.slice(0, 14) + '…' : wfById(w.wf).title), enabled: true, act: () => { if (bindToWidget(w, c)) toast(`🔗 «${esc(c.title)}» подключён к «${esc(wfById(w.wf).title)}». Линию видно на столе.`); } })) });
  if (c.kind === 'audio') items.push({ label: 'Это…', enabled: true, children: Object.entries(AUDIO_SUB).map(([k, l]) => ({ label: (audioSub(c) === k ? '● ' : '') + l, enabled: true, act: () => { c.sub = k; save(); updCard(c); toast(`Теперь это <b>${l}</b>.`); } })) });
  items.push({ label: 'Развернуть', enabled: true, act: () => openDetails(c) });
  items.push({ label: 'Ещё', enabled: true, children: [
    { label: 'Поделиться', enabled: isReady(c) && c.kind !== 'audio', act: () => shareSheet(c) },
    { label: 'Последний кадр', enabled: isReady(c) && c.kind === 'video', act: () => lastFrameCard(c, true) },
    { label: 'Дублировать', enabled: isReady(c), act: () => { const n = { ...c, id: S.nextId++, created: Date.now(), title: c.title + ' (копия)' }; delete n.preview; S.cards.push(n); placeCard(n, areaForKind(n.kind, n.title)); save(); render([n.id]); } },
    { label: 'Переименовать', enabled: true, act: () => renameCard(c) },
    { label: 'Во входящие', enabled: isReady(c), act: () => { S.inbox.push({ ...c, id: S.nextId++, sheet: null }); save(); renderSidePanels(); toast('Добавлено во «Входящие».'); } },
    { label: 'Удалить', enabled: true, act: () => removeCards([c.id]) },
  ] });
  return items;
}
function widgetMenu(w) {
  const wf = wfById(w.wf);
  const others = WFS.filter(x => x.kind === (wf?.kind || x.kind));
  const all = WFS.map(x => ({ label: x.title.length > 16 ? x.title.slice(0, 15) + '…' : x.title, enabled: x.id !== w.wf, act: () => { w.wf = x.id; save(); render(); toast(`В виджете теперь <b>${esc(x.title)}</b>`); } }));
  const wfChildren = all.length <= 9 ? all : groupBy(WFS, x => ({ video: 'Видео', image: 'Картинки', audio: 'Звук' }[x.kind] || 'Другое')).map(([g, xs]) => ({ label: g, enabled: true, children: xs.map(x => ({ label: x.title.slice(0, 14), enabled: x.id !== w.wf, act: () => { w.wf = x.id; save(); render(); } })) }));
  return [
    { label: 'Результаты', enabled: true, act: () => openResults(w) },
    { label: 'Запустить', enabled: !!wf, children: [
      { label: 'Как в прошлый раз', enabled: true, act: () => runWidget(w, false) },
      { label: 'Изменить промпт', enabled: !!(wf && promptParam(wf)), act: () => quickPrompt(w) },
      { label: 'Все настройки', enabled: true, act: () => runWidget(w, true) },
    ] },
    jobsOf(w).some(x => x.status === 'running' || x.status === 'queued')
      ? { label: '■ Стоп', enabled: true, act: () => stopWidget(w) }
      : { label: 'Параметры', enabled: !!wf, act: () => runWidget(w, true) },
    { label: 'Workflow', enabled: WFS.length > 0, children: [...wfChildren, { label: '+ Добавить', enabled: true, act: () => importWorkflowDialog() }].slice(0, 10) },
    { label: 'Внутрь', enabled: !!wf, act: () => openWorkflowTab(wf.id) },
    { label: 'На клавишу', enabled: !!wf, act: () => pickKeyFor(wf.id) },
    { label: 'Убрать', enabled: true, act: () => removeCards([w.id]) },
  ];
}
function groupBy(arr, fn) { const m = new Map(); arr.forEach(x => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return [...m.entries()]; }
let radialSource = null;
function openRadialFor(id, x, y) {
  const c = byId(id); if (!c) return false;
  radialSource = c.type === 'file' ? c : null;
  if (S.locked) { toast('Стол на замке. Снимите замок, чтобы запускать действия.'); return false; }
  const items = c.type === 'widget' ? widgetMenu(c) : fileMenu(c);
  return openRadial(items, x, y, () => els.get(id)?.classList.remove('lifted'), () => els.get(id)?.classList.add('lifted'));
}
function openRadial(items, x, y, onClose, onOpen) {
  const pad = RING[2][1] + 10; // запас на два уровня; глубже кольца могут выйти за край — это нормально
  const cx = Math.min(Math.max(x, pad), innerWidth - pad), cy = Math.min(Math.max(y, pad), innerHeight - pad);
  M = { items, cx, cy, path: [], sticky: false, onClose, span: 360 / items.length };
  radial.style.setProperty('--cx', cx + 'px'); radial.style.setProperty('--cy', cy + 'px');
  radial.hidden = false; onOpen && onOpen(); hidePeek(); drawRadial();
  return true;
}
function levelLayout(level) {
  // возвращает [{node, a0, a1, mid}] для уровня
  if (level === 0) return M.items.map((n, i) => { const mid = -90 + i * M.span; return { node: n, a0: mid - M.span / 2, a1: mid + M.span / 2, mid }; });
  const parentL = levelLayout(level - 1)[M.path[level - 1]];
  if (!parentL || !parentL.node.children) return [];
  const kids = parentL.node.children, sp = Math.min(SPAN[level], 300 / kids.length), start = parentL.mid - kids.length * sp / 2;
  return kids.map((n, i) => ({ node: n, a0: start + i * sp, a1: start + (i + 1) * sp, mid: start + (i + .5) * sp }));
}
/* подпись, которая влезает в сектор: одна строка или две, с многоточием */
function fitLabel(text, maxW, fs) {
  const cw = fs * 0.56, max = Math.max(3, Math.floor(maxW / cw));
  if (text.length <= max) return [text];
  const cut = t => t.length <= max ? t : t.slice(0, max - 1) + '…';
  const words = text.split(' ');
  if (words.length > 1) {
    let best = null;
    for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '); const m = Math.max(a.length, b.length); if (!best || m < best[2]) best = [a, b, m]; }
    return [cut(best[0]), cut(best[1])];
  }
  return [cut(text)];
}
function shownLevels() { let n = 0; while (n < LEVELS && levelLayout(n).length) n++; return n; }
function drawRadial() {
  let s = `<g transform="translate(${M.cx},${M.cy})" class="${M.away ? 'away' : ''}">`;
  for (let L = 0; L < LEVELS; L++) {
    const lay = levelLayout(L); if (!lay.length) break;
    const [r0, r1] = RING[L], lr = (r0 + r1) / 2 + (L === 0 ? 4 : 0);
    const fs = [12.5, 11, 10.5, 10][L], cls = L === 0 ? '' : L === 1 ? ' child' : ' grand';
    lay.forEach(({ node, a0, a1, mid }, i) => {
      const on = M.path[L] === i, off = !node.enabled ? ' off' : '';
      s += `<path class="sec${cls}${on ? ' on' : ''}${off}" d="${arc(r0 + 2, r1, a0 + .8, a1 - .8)}"/>`;
      const lx = lr * Math.cos(deg(mid)), ly = lr * Math.sin(deg(mid));
      // ширина подписи: хорда сектора и толщина кольца (у горизонтальных секторов ограничивает толщина)
      const chord = 2 * lr * Math.sin(deg((a1 - a0) / 2)) * 0.9, thick = (r1 - r0) * 1.6;
      const horiz = Math.abs(Math.sin(deg(mid)));
      const maxW = L === 0 ? Math.min(chord, 96) : Math.max(chord * horiz + thick * (1 - horiz), 40);
      const label = node.label + (node.children && L > 0 ? ' ›' : '');
      const lines = fitLabel(label, maxW, fs), lh = fs + 1;
      const y0 = ly - (node.children && L === 0 ? 6 : 0) - (lines.length - 1) * lh / 2;
      lines.forEach((t, k) => { s += `<text class="lbl${L ? (L >= 2 ? ' tiny' : ' small') : ''}${on ? ' on' : ''}${off}" style="font-size:${fs}px" x="${lx}" y="${y0 + k * lh}">${esc(t)}</text>`; });
      if (node.children && L === 0) s += `<text class="more${on ? ' on' : ''}" x="${lx}" y="${ly + 10}">${node.children.length} ›</text>`;
      else if (node.note && L === 0) s += `<text class="more${on ? ' on' : ''}" x="${lx}" y="${ly + 11}">${esc(node.note)}</text>`;
    });
  }
  const t = radialTarget();
  s += `<circle class="hub" r="${RING[0][0] - 2}"/>`;
  const hl = t ? fitLabel(t.label, 74, 11) : [];
  s += t ? hl.map((x, k) => `<text class="hubtxt go" y="${-6 - (hl.length - 1) * 6 + k * 12}">${esc(x)}</text>`).join('') + `<text class="hubtxt" y="${hl.length > 1 ? 15 : 9}">${M.sticky ? 'кликните' : 'отпустите'}</text>`
    : `<text class="hubtxt" y="-5">${M.away ? 'отмена' : 'отмена'}</text><text class="hubtxt" y="8">${M.away ? 'отпустите' : 'или уведите'}</text>`;
  rsvg.innerHTML = s + '</g>';
}
function radialTarget() {
  if (!M || !M.path.length) return null;
  let lay = null, node = null;
  for (let L = 0; L < M.path.length; L++) { lay = levelLayout(L); node = lay[M.path[L]]?.node; if (!node) return null; }
  return node && node.enabled && !node.children ? node : null;
}
function trackRadial(x, y) {
  const dx = x - M.cx, dy = y - M.cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) * 180 / Math.PI;
  const pick = L => { const lay = levelLayout(L); for (let i = 0; i < lay.length; i++) { const d = norm(a - lay[i].a0), span = lay[i].a1 - lay[i].a0; if (d <= span) return i; } return -1; };
  // курсор увели далеко за последнее открытое кольцо — это «передумал»: ничего не выбрано, отпустить = закрыть
  const outer = RING[Math.max(0, shownLevels() - 1)][1];
  const away = r > outer + AWAY;
  $('#radial')?.classList.toggle('away', away);
  let path = [];
  if (away || r < RING[0][0]) path = [];
  else if (r < RING[0][1] + 3 || !M.path.length) { const i = pick(0); path = i >= 0 ? [i] : []; }
  else {
    path = [M.path[0]];
    let L = 1;
    while (L < LEVELS && r >= RING[L][0] - 3) {
      const i = pick(L);
      if (i < 0) { if (L === 1) { const j = pick(0); path = j >= 0 ? [j] : []; } else path = path.slice(0, L); break; }
      path[L] = i; if (r < RING[L][1] + 3) break; L++;
    }
  }
  if (path.join() !== M.path.join() || away !== !!M.away) { M.path = path; M.away = away; drawRadial(); }
}
function closeRadial(commit) {
  if (!M) return;
  const t = commit ? radialTarget() : null, cb = M.onClose;
  radial.hidden = true; rsvg.innerHTML = ''; M = null; cb && cb();
  if (t) { if (t.act) t.act(); else if (t.run) { const wf = t.run(); dispatch([...(sel.size ? [...sel].map(byId).filter(c => c && c.type === 'file' && wf.accepts.includes(c.kind)) : []), ...(radialSource ? [radialSource] : [])].filter((v, i, arr) => v && arr.indexOf(v) === i), wf, { ask: true }); } }
  radialSource = null;
}
window.addEventListener('pointermove', e => { if (M && M.sticky && !G) trackRadial(e.clientX, e.clientY); });
window.addEventListener('pointerdown', e => { if (M && M.sticky && !G) { e.preventDefault(); e.stopPropagation(); trackRadial(e.clientX, e.clientY); closeRadial(true); } }, true);

/* ================= запуск ================= */
function dispatch(cards, wf, { ask = false, params = {}, silent = false, opts = {} } = {}) {
  if (!wf) return;
  if (wf.local) { cards.forEach(c => localAction(c, wf)); return; }
  const needsCard = (wf.params || []).some(p => p.type === 'card');
  const ok = needsCard ? cards.filter(c => c && c.type === 'file' && wf.accepts.includes(c.kind) && isReady(c)) : [];
  if (needsCard && !ok.length) { if (!silent) toast(`«${esc(wf.title)}» ждёт: ${wf.accepts.map(k => KIND_RU[k]).join(', ')}. Выделите или перетащите файл.`); return; }
  const vals = applyBound(wf, paramDefaults(wf, params));
  if (params.__prompt) { const pp = promptParam(wf); if (pp) vals[pp.id] = params.__prompt; delete vals.__prompt; }
  if (ask || missingParams(wf, vals).length) openParams(needsCard ? ok : [null], wf, vals, opts);
  else (needsCard ? ok : [null]).forEach(c => runJob(c, wf, vals, opts));
}
function localAction(c, a) {
  if (a.id === '@cut') moveToCut(c);
  else if (a.id === '@open') openDetails(c);
  else if (a.id === '@dup') { const n = { ...c, id: S.nextId++, created: Date.now() }; delete n.preview; S.cards.push(n); placeCard(n, areaForKind(n.kind, n.title)); }
  else if (a.id === '@ren') renameCard(c);
  else if (a.id === '@del') removeCards([c.id]);
  save(); render();
}
/* быстрый перезапуск: тот же кадр и настройки, меняем только текст промпта */
function quickPrompt(w) {
  const wf = wfById(w.wf); const pp = wf && promptParam(wf); if (!pp) return runWidget(w, true);
  const cur = paramDefaults(wf)[pp.id] ?? '';
  const src = byId(w.lastInput);
  sheetOpen(`<h3>Изменить промпт · ${esc(wf.title)}</h3><div class="sub">${src ? `кадр «${esc(src.title)}», ` : ''}остальные настройки — как в прошлый раз</div>
    ${typeof presetChips === 'function' ? presetChips(wf, w) : ''}<div class="field"><label for="qp">${esc(pp.label)} <button type="button" class="btn small ghost" data-dict="qp" title="Надиктовать">🎙</button> <button type="button" class="btn small ghost" data-a="enh" title="Локальная модель превратит пожелание в правильный промпт">✨ Улучшить</button></label><textarea id="qp" name="qp" rows="6">${esc(cur)}</textarea></div>
    <div class="acts"><button type="button" class="btn ghost" data-a="all">Все настройки…</button><button type="button" class="btn ghost" data-close>Отмена <kbd>Esc</kbd></button><button type="button" class="btn" data-a="plan">В план</button><button type="submit" class="btn primary">Запустить <kbd>Ctrl+Enter</kbd></button></div>`,
    () => { const text = sheet.elements.qp.value.trim(); if (!text) { toast('Промпт пустой.'); return false; } runWidgetWith(w, { __prompt: text }); },
    { init: () => { const t = sheet.elements.qp; t.focus(); t.setSelectionRange(t.value.length, t.value.length); },
      onClick: e => {
        const eb = e.target.closest('[data-a="enh"]');
        if (eb) { const ta = sheet.elements.qp, idea = ta.value.trim(); if (!idea) return; const o = eb.textContent; eb.textContent = '✨ думаю…'; eb.disabled = true;
          enhancePrompt(wf, idea, src ? `${src.kind}: ${src.title}${src.w ? ` (${src.w}x${src.h})` : ''}` : '').then(j => { ta.value = j.text; toast(`Готово: ${esc(j.model)}. Поправьте, если нужно.`); }).catch(err => toast('✨ ' + esc(err.message))).finally(() => { eb.textContent = o; eb.disabled = false; }); return; }
        if (e.target.closest('[data-a="plan"]')) { const text = sheet.elements.qp.value.trim(); if (!text) return toast('Промпт пустой.'); const vals = paramDefaults(wf); vals[pp.id] = text; closeSheet(); addToPlan(wf, src ? [src] : [], vals); return; }
        if (e.target.closest('[data-a="all"]')) { const text = sheet.elements.qp.value.trim(); closeSheet(); runWidgetWith(w, text ? { __prompt: text } : {}, true); }
        if (e.target.closest('[data-dict]') && typeof startDictation === 'function') startDictation(sheet.elements.qp);
      } });
}
function runWidgetWith(w, params, ask = false) {
  const wf = wfById(w.wf); if (!wf) return;
  const needsCard = (wf.params || []).some(p => p.type === 'card');
  const src = needsCard ? [byId(w.lastInput)].filter(Boolean) : [];
  if (needsCard && !src.length) { toast(`Перетащите на виджет: ${wf.accepts.map(k => KIND_RU[k]).join(', ')}.`); return; }
  dispatch(src, wf, { ask, params });
}
function runWidget(w, ask) {
  const wf = wfById(w.wf); if (!wf) return;
  const needsCard = (wf.params || []).some(p => p.type === 'card');
  const src = needsCard ? ([...sel].map(byId).filter(c => c && c.type === 'file' && wf.accepts.includes(c.kind))[0] ? [...sel].map(byId).filter(c => c && c.type === 'file' && wf.accepts.includes(c.kind)) : [byId(w.lastInput)].filter(Boolean)) : [];
  if (needsCard && !src.length) { toast(`Перетащите на виджет: ${wf.accepts.map(k => KIND_RU[k]).join(', ')}.`); return; }
  dispatch(src, wf, { ask });
}
function openGraph(wf) {
  const blob = new Blob([JSON.stringify(wf.workflow, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (wf.id || 'workflow') + '_api.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  window.open(API.base() + '/', '_blank');
  toast('Скачал workflow. Перетащите файл в открывшийся ComfyUI, чтобы увидеть ноды.');
}
function renameCard(c) {
  sheetOpen(`<h3>Переименовать</h3><div class="field"><input type="text" id="rnIn" name="t" value="${esc(c.title)}" maxlength="80"></div><div class="acts"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Сохранить</button></div>`, f => { c.title = f.t.value.trim() || c.title; save(); render(); });
}

/* ================= пианино ================= */
const piano = $('#piano');
const WHITE = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
const BLACK = [{ after: 0, code: 'KeyQ' }, { after: 1, code: 'KeyW' }, { after: 3, code: 'KeyE' }, { after: 4, code: 'KeyR' }, { after: 5, code: 'KeyT' }, { after: 7, code: 'KeyY' }, { after: 8, code: 'KeyU' }];
const ROWS = [null, ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'], ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM']];
const KEY_SYM = { Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', IntlBackslash: '\\' };
const codeLabel = c => c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : KEY_SYM[c] || c.replace(/^r(\d)k(\d+)$/, '·');
const GROUP_COLORS = ['#8f74f2', '#3fd2ff', '#ff5fa8', '#5fe3a1', '#f2b94c', '#ff8a3d', '#6f8cff', '#c9f05a'];
/* цвет новой группы: сначала тот, которого нет ни у одной группы; если все заняты — не как у соседей */
function pickGroupColor(lo, hi, others) {
  const used = new Set(others.map(g => g.color));
  const free = GROUP_COLORS.find(c => !used.has(c)); if (free) return free;
  const near = new Set(others.filter(g => g.to === lo - 1 || g.from === hi + 1).map(g => g.color));
  return GROUP_COLORS.find(c => !near.has(c)) || GROUP_COLORS[0];
}
function groupColorHTML(gi) { return `<div class="pop-sub">Цвет группы</div><div class="swatches">${GROUP_COLORS.map(c => `<button data-gc="${c}" class="${S.groups[gi]?.color === c ? 'cur' : ''}" style="--sw:${c}" title="${c}"></button>`).join('')}</div>`; }
function bindGroupColor(pop, gi) { pop.addEventListener('click', ev => { const b = ev.target.closest('[data-gc]'); if (!b || !S.groups[gi]) return; ev.stopPropagation(); S.groups[gi].color = b.dataset.gc; save(); renderPiano(); closePop(); }); }
function rowCodes(r) { return ROWS[r] || Array.from({ length: 8 }, (_, i) => `r${r}k${i}`); }
function groupOf(i) { return S.groups.findIndex(g => i >= g.from && i <= g.to); }
let pianoT = null;
function renderPianoSoon() { if (!pianoT) pianoT = requestAnimationFrame(() => { pianoT = null; renderPiano(); }); }
function renderPiano() {
  document.documentElement.style.setProperty('--ps', S.cfg.pianoScale);
  let h = '<div class="prow r1">';
  WHITE.forEach((code, i) => {
    const sh = sheetAtKey(i), wb = bindAction(S.keymap[code]), gi = groupOf(i), g = S.groups[gi];
    const gcls = g ? ` g${i === g.from ? ' gs' : ''}${i === g.to ? ' ge' : ''}` : '';
    const style = g ? ` style="background:linear-gradient(180deg,${g.color}66,var(--ivory) 30%)"` : '';
    if (wb) {
      // белая клавиша с workflow
      h += `<button class="key wfk${gcls}${sel.size ? ' hot' : ''}" data-i="${i}" data-bind="${code}" style="--c:${wfColor(wb) || '#8f74f2'}${g ? `;background:linear-gradient(180deg,${g.color}66,var(--ivory) 30%)` : ''}" title="${esc(wb.title)} (${codeLabel(code)}). Правый клик — сменить или освободить"><i class="wbar"></i><span class="n">${codeLabel(code)}</span><span class="t">${esc(wb.title.replace(/^↗ /, ''))}</span><span class="c">${wb.open ? '↗ открыть' : '▶ workflow'}</span></button>`;
    } else if (sh) {
      const cs = S.cards.filter(c => c.sheet === sh.id && !c.parked), busy = S.cards.some(c => c.sheet === sh.id && (c.status === 'running' || c.status === 'queued'));
      if (sh.hidden) h += `<button class="key hid${gcls}" data-i="${i}" data-sheet="${sh.id}" title="${esc(sh.name)} — скрыта, файлы сохранены (${cs.length} шт.). Клик — вернуть"><span class="n">${codeLabel(code)}</span><span class="t">${esc(sh.name)}</span><span class="c">скрыта · ${cs.length}</span></button>`;
      else h += `<button class="key${sh.id === S.sheet ? ' on' : ''}${gcls}" data-i="${i}" data-sheet="${sh.id}"${style} title="${esc(sh.name)} (${codeLabel(code)}). Двойной клик — имя, правый клик — меню, протяните к соседней — группа">${busy ? '<span class="busy"></span>' : ''}<span class="n">${codeLabel(code)}</span><span class="t">${esc(sh.name)}</span><span class="c">${cs.length} шт.</span></button>`;
    } else h += `<button class="key blank${gcls}" data-i="${i}" data-new="${i}" title="Пустая (${codeLabel(code)}): клик — новая сцена, правый клик или перетащите виджет — workflow"><span class="n">${codeLabel(code)}</span><span class="t">+</span><span class="c">&nbsp;</span></button>`;
  });
  for (const b of BLACK) {
    const a = bindAction(S.favs[b.code]);
    const left = (((b.after + 1) / WHITE.length) * 100 - 3.3).toFixed(2);
    h += `<button class="bk${sel.size && a ? ' hot' : ''}" style="left:${left}%" data-bind="${b.code}" title="${a ? esc(a.title) : 'Пусто'} (${codeLabel(b.code)}). Правый клик — назначить"><span class="led"></span><span class="t">${a ? esc(actionLabel(a)) : '—'}</span><span class="n">${codeLabel(b.code)}</span></button>`;
  }
  h += '</div>';
  for (let r = 1; r < Math.max(1, S.cfg.pianoRows); r++) {
    if (S.cfg.rowsHidden?.[r]) continue;
    const rh = Math.max(22, 34 - (r - 1) * 5);
    h += `<div class="prow" style="--rh:${rh}px">`;
    for (const code of rowCodes(r)) {
      const a = bindAction(S.keymap[code]);
      const c = a ? (KIND_C[a.kind] || '#8f74f2') : '#5a5070';
      h += `<button class="ck${a ? '' : ' empty'}${a && sel.size ? ' hot' : ''}" style="--c:${c}" data-bind="${code}" title="${a ? esc(a.title) : 'Пусто — правый клик, чтобы назначить workflow'}${ROWS[r] ? ' (' + codeLabel(code) + ')' : ''}"><span class="t">${a ? esc(a.title) : '+'}</span><span class="n">${ROWS[r] ? codeLabel(code) : ''}</span></button>`;
    }
    h += '</div>';
  }
  piano.innerHTML = h;
  const tg = $('#pToggles');
  if (tg) {
    let t = '';
    for (let r = 1; r < S.cfg.pianoRows; r++) t += `<button data-row="${r}" class="${S.cfg.rowsHidden?.[r] ? '' : 'on'}" title="Показать или скрыть ряд (все ряды — Shift+J). Клавиши работают и скрытыми">${ROWS[r] ? codeLabel(ROWS[r][0]) + '–' + codeLabel(ROWS[r].at(-1)) : 'ряд ' + (r + 1)}</button>`;
    t += `<button data-collapse="1" class="${S.cfg.pianoCollapsed ? '' : 'on'}" title="Свернуть или показать клавиши (Shift+K). Клавиши работают и свёрнутыми">${S.cfg.pianoCollapsed ? '▴ клавиши' : '▾ клавиши'}</button>`;
    tg.innerHTML = t;
  }
  document.body.classList.toggle('piano-collapsed', !!S.cfg.pianoCollapsed);
}
function bindAction(v) {
  if (v && v.startsWith('open:')) { const wf = wfById(v.slice(5)); return wf ? { id: v, title: '↗ ' + wf.title, kind: wf.kind, open: wf.id } : null; }
  return actionById(v);
}
$('#pToggles').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.row) { S.cfg.rowsHidden = { ...(S.cfg.rowsHidden || {}), [b.dataset.row]: !S.cfg.rowsHidden?.[b.dataset.row] }; }
  if (b.dataset.collapse) S.cfg.pianoCollapsed = !S.cfg.pianoCollapsed;
  save(); renderPiano();
});
let keyDrag = null;
piano.addEventListener('pointerdown', e => { const k = e.target.closest('.key'); if (!k || e.button !== 0) return; keyDrag = { from: +k.dataset.i, to: +k.dataset.i, moved: false }; });
window.addEventListener('pointermove', e => {
  if (!keyDrag) return;
  const k = document.elementFromPoint(e.clientX, e.clientY)?.closest('.key');
  if (k && +k.dataset.i !== keyDrag.to) { keyDrag.to = +k.dataset.i; keyDrag.moved = true; $$('.key', piano).forEach(el => { const i = +el.dataset.i; el.classList.toggle('linking', i >= Math.min(keyDrag.from, keyDrag.to) && i <= Math.max(keyDrag.from, keyDrag.to)); }); }
});
window.addEventListener('pointerup', () => {
  if (!keyDrag) return;
  const { from, to, moved } = keyDrag; keyDrag = null;
  if (!moved) return;
  if (S.locked) { toast('Стол на замке.'); renderPiano(); return; }
  const a = Math.min(from, to), b = Math.max(from, to);
  const keep = S.groups.filter(g => g.to < a || g.from > b), merged = S.groups.filter(g => !(g.to < a || g.from > b));
  const lo = Math.min(a, ...merged.map(g => g.from)), hi = Math.max(b, ...merged.map(g => g.to));
  keep.push({ from: lo, to: hi, color: merged[0]?.color || pickGroupColor(lo, hi, keep) });
  S.groups = keep.sort((x, y) => x.from - y.from);
  save(); renderPiano(); toast(`Клавиши ${lo + 1}–${hi + 1} объединены в группу (общий цвет). Правый клик → «Разгруппировать».`);
  piano.dataset.justLinked = '1'; setTimeout(() => delete piano.dataset.justLinked, 50);
});
piano.addEventListener('click', e => {
  if (piano.dataset.justLinked) return;
  const k = e.target.closest('button'); if (!k) return;
  if (k.dataset.sheet) openSheet(+k.dataset.sheet);
  else if (k.dataset.new) newSheet(+k.dataset.new);
  else if (k.dataset.bind) runBinding(k.dataset.bind);
});
piano.addEventListener('dblclick', e => { const k = e.target.closest('.key[data-sheet]'); if (k) renameSheet(+k.dataset.sheet, k); });
piano.addEventListener('contextmenu', e => {
  const k = e.target.closest('button'); if (!k) return; e.preventDefault();
  if (k.dataset.bind) bindMenu(k.dataset.bind, k);
  else if (k.dataset.new) bindMenu(WHITE[+k.dataset.new], k);
  else if (k.dataset.sheet) sheetMenu(+k.dataset.sheet, +k.dataset.i, k);
});
function switchSheet(id) { if (S.sheet === id) return; S.sheet = id; sel.clear(); save(); render(); updateLayoutSel(); if (typeof cutStop === 'function') cutStop(); }
const sheetAtKey = i => S.sheets.find(s => s.key === i);
const visibleSheets = () => S.sheets.filter(s => !s.hidden).sort((a, b) => a.key - b.key);
function freeWhite() { for (let i = 0; i < WHITE.length; i++) if (!sheetAtKey(i) && !S.keymap[WHITE[i]]) return i; return -1; }
function openSheet(id) { const sh = S.sheets.find(s => s.id === id); if (!sh) return; if (sh.hidden) { sh.hidden = false; toast(`«${esc(sh.name)}» снова на месте.`); } switchSheet(id); renderPiano(); }
function newSheet(i) {
  if (S.locked) return toast('Стол на замке.');
  if (i == null || sheetAtKey(i) || S.keymap[WHITE[i]]) i = freeWhite();
  if (i < 0) return toast('Свободных белых клавиш нет.');
  const id = Math.max(0, ...S.sheets.map(s => s.id)) + 1;
  S.sheets.push({ id, name: 'Сцена ' + (S.sheets.length + 1), layout: '3x3', key: i }); S.sheet = id; sel.clear(); save(); render(); renderPiano(); updateLayoutSel();
}
/* клавиша открывает workflow внутри стола */
function bindOpen(code, wfId) {
  bindingTarget(code)[code] = 'open:' + wfId; save(); renderPiano();
  toast(`Клавиша <b>${codeLabel(code)}</b> теперь открывает «${esc(wfById(wfId)?.title || wfId)}». Правый клик по клавише — очистить.`);
}
let keyPick = null;
let keyPickT = null, keyPickAt = 0;
function pickKeyFor(wfId) {
  keyPick = wfId; keyPickAt = performance.now(); piano.classList.add('picking');
  clearTimeout(keyPickT); keyPickT = setTimeout(() => { if (keyPick) { endKeyPick(); toast('Назначение клавиши отменено.'); } }, 15000);
  toast(`Нажмите клавишу <b>Q–U</b>, <b>A–L</b> или <b>Z–M</b> (или кликните по ней на пианино). Esc — отмена.`);
}
function endKeyPick() { keyPick = null; clearTimeout(keyPickT); piano.classList.remove('picking'); }
window.addEventListener('keydown', e => {
  if (!keyPick) return;
  // F5, F12, Ctrl+… и прочие системные клавиши не трогаем
  if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code === 'Escape') { endKeyPick(); toast('Отменено.'); return; }
  const ok = BLACK.some(b => b.code === e.code) || ROWS.some(r => r && r.includes(e.code));
  if (!ok) { endKeyPick(); toast('Эта клавиша не подходит (нужны Q–U, A–L или Z–M). Назначение отменено.'); return; }
  const id = keyPick; endKeyPick(); bindOpen(e.code, id);
}, true);
window.addEventListener('pointerdown', e => { if (keyPick && performance.now() - keyPickAt > 300 && !e.target.closest('#piano')) endKeyPick(); }, true);
piano.addEventListener('click', e => { if (!keyPick) return; const k = e.target.closest('[data-bind]'); if (!k) return; e.stopImmediatePropagation(); const id = keyPick; endKeyPick(); bindOpen(k.dataset.bind, id); }, true);
function bindingTarget(code) { return BLACK.some(b => b.code === code) ? S.favs : S.keymap; }
function runBinding(code, cards) {
  if (S.locked && !code.startsWith('Digit')) { toast('Стол на замке: работают только белые клавиши.'); return; }
  const a = bindAction(bindingTarget(code)[code]);
  if (!a) { toast(`Клавиша ${codeLabel(code)} пустая. Правый клик — назначить, или перетащите на неё виджет.`); return; }
  if (a.open) { openWorkflowTab(a.open); return; }
  const list = cards || [...sel].map(byId).filter(c => c && c.type === 'file');
  if (a.local) { if (!list.length) return toast(`Выделите файл, затем ${codeLabel(code)} — «${esc(a.title)}».`); list.forEach(c => localAction(c, a)); return; }
  const needsCard = (a.params || []).some(p => p.type === 'card');
  if (needsCard && !list.length) { const w = S.cards.find(c => c.type === 'widget' && c.sheet === S.sheet && c.wf === a.id); if (w) { flashCard(w.id); runWidget(w, true); } else toast(`Выделите файл, затем ${codeLabel(code)} отправит его в «${esc(a.title)}».`); return; }
  dispatch(list, a);
}
function confirmSheet(title, text, btn, go) {
  sheetOpen(`<h3>${title}</h3><p>${text}</p><div class="acts"><button type="button" class="btn ghost" data-close>Отмена</button><button type="button" class="btn primary" data-go>${btn}</button></div>`, null, { onClick: e => { if (e.target.closest('[data-go]')) { closeSheet(); go(); } } });
}
function leaveSheet(id) { if (S.sheet === id) { const v = visibleSheets().find(s => s.id !== id); if (v) S.sheet = v.id; } }
function hideSheet(id) {
  const sh = S.sheets.find(s => s.id === id);
  if (visibleSheets().length <= 1) return toast('Это единственная открытая сцена.');
  sh.hidden = true; leaveSheet(id); sel.clear();
  save(); render(); renderPiano(); updateLayoutSel();
  toast(`«${esc(sh.name)}» скрыта. Файлы сохранены — клик по клавише вернёт сцену.`);
}
function deleteSheet(id) {
  const sh = S.sheets.find(s => s.id === id);
  if (S.sheets.length <= 1) return toast('Нельзя удалить единственную сцену.');
  const n = S.cards.filter(c => c.sheet === id).length;
  const go = () => {
    const ids = S.cards.filter(c => c.sheet === id).map(c => c.id);
    leaveSheet(id);
    if (ids.length) removeCards(ids);
    S.sheets = S.sheets.filter(s => s.id !== id);
    if (!S.sheets.some(s => s.id === S.sheet)) S.sheet = S.sheets[0].id;
    save(); render(); renderPiano(); updateLayoutSel(); toast(`Сцена удалена${n ? ', файлов: ' + n + ' (Ctrl+Z — вернуть файлы)' : ''}.`);
  };
  if (!n) return go();
  confirmSheet(`Удалить «${esc(sh.name)}» навсегда?`, `На сцене файлов: <b>${n}</b>. Если хотите просто убрать клавишу с глаз — выберите «Скрыть»: файлы останутся.`, 'Удалить', go);
}
function clearSheet(id) {
  const ids = S.cards.filter(c => c.sheet === id && !c.owner).map(c => c.id);
  if (!ids.length) return toast('Сцена и так пустая.');
  confirmSheet(`Убрать всё со сцены «${esc(sheetName(id))}»?`, `С холста уйдут <b>${ids.length}</b> карточек. Сами файлы в ComfyUI останутся, а сразу после этого можно вернуть всё через Ctrl+Z.`, 'Убрать всё', () => removeCards(ids));
}
function renameSheet(id, anchor) {
  if (S.locked) return;
  const sh = S.sheets.find(s => s.id === id);
  popAt(anchor, `<h4>Название сцены</h4><input id="renIn" value="${esc(sh.name)}" maxlength="24">`, pop => {
    const inp = pop.querySelector('#renIn'); inp.focus(); inp.select();
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { sh.name = inp.value.trim() || sh.name; save(); renderPiano(); closePop(); } });
  });
}
function sheetMenu(id, i, anchor) {
  const gi = groupOf(i);
  popAt(anchor, `<h4>${esc(sheetName(id))}</h4><button data-a="ren">Переименовать</button>${gi >= 0 ? '<button data-a="ungroup">Разгруппировать</button>' : ''}${gi >= 0 ? groupColorHTML(gi) : ''}<button data-a="hide">Скрыть (файлы сохранятся)</button><button data-a="clear">Убрать всё со сцены…</button>${S.sheets.length > 1 ? '<button data-a="del">Удалить сцену навсегда…</button>' : ''}`, pop => {
    if (gi >= 0) bindGroupColor(pop, gi);
    pop.onclick = ev => { const a = ev.target.dataset.a; if (!a) return; closePop();
      if (a === 'ren') renameSheet(id, anchor);
      if (a === 'ungroup') { S.groups.splice(gi, 1); save(); renderPiano(); }
      if (a === 'hide' && !S.locked) hideSheet(id);
      if (a === 'clear' && !S.locked) clearSheet(id);
      if (a === 'del' && !S.locked) deleteSheet(id); };
  });
}
function bindMenu(code, anchor) {
  const map = bindingTarget(code);
  const items = [...WFS.map(a => `<button data-id="${esc(a.id)}" class="${map[code] === a.id ? 'cur' : ''}">◆ ${esc(a.title)}</button>`), ...BUILTIN.map(a => `<button data-id="${esc(a.id)}" class="${map[code] === a.id ? 'cur' : ''}">${esc(a.title)}</button>`)].join('');
  const opens = WFS.map(a => `<button data-id="open:${esc(a.id)}" class="${map[code] === 'open:' + a.id ? 'cur' : ''}">↗ Открыть: ${esc(a.title)}</button>`).join('');
  const wi = WHITE.indexOf(code), gi = wi >= 0 ? groupOf(wi) : -1, gOpt = gi >= 0 ? groupColorHTML(gi) + '<button data-id="@ungroup">Разгруппировать</button>' : '', sceneOpt = wi >= 0 && !sheetAtKey(wi) ? `<button data-id="@scene">＋ Новая сцена на этой клавише</button>` : '';
  popAt(anchor, `<h4>Клавиша ${codeLabel(code)}</h4>${gOpt}${sceneOpt}<div class="pop-sub">Запустить</div>${items}<div class="pop-sub">Открыть внутри</div>${opens}<button data-id="">Очистить клавишу</button>`, pop => {
    if (gi >= 0) bindGroupColor(pop, gi);
    pop.onclick = ev => { const b = ev.target.closest('button'); if (!b || b.dataset.gc) return; closePop(); if (b.dataset.id === '@ungroup') { S.groups.splice(gi, 1); save(); renderPiano(); return; } if (b.dataset.id === '@scene') { delete map[code]; return newSheet(wi); } if (b.dataset.id) map[code] = b.dataset.id; else delete map[code]; save(); renderPiano(); };
  });
}

/* ================= края: выезд при наведении ================= */
const edges = { left: $('#left'), right: $('#right') };
let edgeCloseT = {};
// мышка ушла из окна (на второй монитор) — открытые незакреплённые панели закрываются
document.addEventListener('mouseout', e => { if (e.relatedTarget) return; for (const n of Object.keys(edges)) if (edges[n].classList.contains('open') && !edges[n].classList.contains('pinned') && !(G && (G.mode === 'drag' || G.mode === 'ext'))) { clearTimeout(edgeCloseT[n]); edgeCloseT[n] = setTimeout(() => edges[n].classList.remove('open'), 350); } });
function openEdge(name, on) {
  const el = edges[name];
  clearTimeout(edgeCloseT[name]);
  if (on) { el.classList.add('open'); if (typeof renderSidePanels === 'function') renderSidePanels(); }
  else edgeCloseT[name] = setTimeout(() => { if (!el.matches(':hover') && !(G && (G.mode === 'drag' || G.mode === 'ext'))) el.classList.remove('open'); }, 350);
}
for (const [name, el] of Object.entries(edges)) {
  // открываем, только если мышка задержалась у края (0,3 с) — пролёт мимо, например на второй монитор, не считается
  const grip = el.querySelector('.edge-grip'); let gripT = null;
  grip.addEventListener('pointerenter', () => { clearTimeout(gripT); gripT = setTimeout(() => openEdge(name, true), 300); });
  grip.addEventListener('pointerleave', () => clearTimeout(gripT));
  el.querySelector('.edge-body').addEventListener('pointerleave', () => openEdge(name, false));
  el.querySelector('.edge-body').addEventListener('pointerenter', () => clearTimeout(edgeCloseT[name]));
  el.querySelector('.pin').addEventListener('click', () => { const p = !el.classList.contains('pinned'); el.classList.toggle('pinned', p); S.cfg['pin_' + name] = p; save(); });
  if (S.cfg['pin_' + name]) el.classList.add('pinned');
}
function edgeHover(cx, ext) { // при перетаскивании к правому краю — открыть правую панель
  if (cx > innerWidth - 16) openEdge('right', true);
  else if (cx < 16 && ext) openEdge('left', true);
}
const rightResize = $('#rightResize');
rightResize.addEventListener('pointerdown', e => {
  e.preventDefault();
  const mv = ev => { const w = Math.max(320, Math.min(innerWidth - 200, innerWidth - ev.clientX)); document.documentElement.style.setProperty('--right-w', w + 'px'); S.cfg.rightW = w; };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); save(); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
});
if (S.cfg.rightW) document.documentElement.style.setProperty('--right-w', S.cfg.rightW + 'px');
const corner = $('#corner');

/* ================= верх: показатели ================= */
let lastStats = null;
async function pollStats() {
  try {
    const st = await API.stats(); httpOk = true; lastStats = st; showStats(st);
  } catch (_) {
    try { const st = await API.sysStats(); httpOk = true; const d = (st.devices || [])[0] || {}; showStats({ gpu: d.vram_total ? { name: d.name, vram_used: d.vram_total - d.vram_free, vram_total: d.vram_total } : {}, ram_used: st.system?.ram_total - st.system?.ram_free, ram_total: st.system?.ram_total }); }
    catch (_) { httpOk = false; }
  }
  if (httpOk && !WFS.length && !loadActions.busy) { loadActions.busy = true; loadActions().finally(() => { loadActions.busy = false; }); }
  updateConn();
}
const gb = b => (b / 1073741824).toFixed(1);
/* одна шкала везде: градиент растянут на всю длину полосы, видна только заполненная часть —
   при высокой загрузке в конце проступает оранжевый, у самого края — мягкий красный */
const barStyle = v => { v = Math.max(0.005, Math.min(1, v)); return `width:${(v * 100).toFixed(1)}%;background-size:${(100 / v).toFixed(1)}% 100%`; };
function setBar(id, v) { const i = $('#' + id); if (!i) return; i.style.cssText = barStyle(v); }
function showStats(st) {
  const g = st.gpu || {};
  if (g.vram_total) { $('#sVram').textContent = `${gb(g.vram_used)}/${gb(g.vram_total)}`; setBar('bVram', g.vram_used / g.vram_total); }
  if (st.ram_total) { $('#sRam').textContent = `${gb(st.ram_used)}/${gb(st.ram_total)}`; setBar('bRam', st.ram_used / st.ram_total); }
  $('#sGpu').textContent = g.util != null ? g.util + '%' : '—';
  const t = $('#sTemp'); t.textContent = g.temp != null ? g.temp + '°' : '—'; t.className = g.temp > 83 ? 'max-t' : g.temp > 74 ? 'hot-t' : '';
  const q = S.cards.filter(c => c.status === 'queued').length, run = S.cards.find(c => c.status === 'running');
  const tiles = [
    ['Видеокарта', g.name || '—', g.clock ? `${g.clock} МГц` : ''],
    ['Загрузка GPU', g.util != null ? g.util + '%' : '—', g.power ? `${Math.round(g.power)} / ${Math.round(g.power_limit || 0)} Вт` : '', g.util != null ? g.util / 100 : null],
    ['Видеопамять', g.vram_total ? `${gb(g.vram_used)} из ${gb(g.vram_total)} ГБ` : '—', '', g.vram_total ? g.vram_used / g.vram_total : null],
    ['Температура GPU', g.temp != null ? g.temp + ' °C' : '—', g.fan != null ? (g.fan === 0 ? 'вентиляторы карты стоят — тихий режим' : `вентиляторы карты ${g.fan}%`) : ''],
    ['Процессор', st.cpu != null ? Math.round(st.cpu) + '%' : '—', '', st.cpu != null ? st.cpu / 100 : null],
    ['Оперативная память', st.ram_total ? `${gb(st.ram_used)} из ${gb(st.ram_total)} ГБ` : '—', '', st.ram_total ? st.ram_used / st.ram_total : null],
    ['Генерации', run ? `идёт 1 · ждут ${q}` : q ? `ждут ${q}` : 'нет задач', (S.plan || []).some(x => x.status === 'wait') ? `план: ещё ${(S.plan || []).filter(x => x.status === 'wait').length}${S.planOn ? (S.planAuto ? ' · авто' : ' · с вопросом') : ' · на паузе'}` : run && run.est && run.started ? 'осталось ' + fmtSec(Math.max(0, run.est - (Date.now() - run.started) / 1000)) : ''],
  ];
  $('#tmGrid').innerHTML = tiles.map(([k, v, s, b]) => `<div class="tm"><span>${k}</span><b>${esc(v)}</b>${b != null ? `<i class="bar"><i style="${barStyle(b)}"></i></i>` : ''}${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('')
    + `<div class="tm tm-act"><button class="btn small tm-free" data-free title="Выгрузить модели и вернуть видеопамять и оперативную память системе — чтобы работать в других программах">🧹 Освободить память</button></div>`;
}
function updateConn() {
  const el = $('#conn'); if (!el) return;
  const busy = S.cards.some(c => c.status === 'running' || c.status === 'queued');
  el.classList.toggle('ok', online()); el.classList.toggle('half', httpOk && !connected); el.classList.toggle('busy', online() && busy);
  el.title = connected ? 'Живой канал (WebSocket) работает' : httpOk ? 'ComfyUI отвечает, но живой канал не открылся' + (wsInfo ? ': ' + wsInfo : '') + '. Стол опрашивает очередь сам, шаги не видны.' : 'Нет ответа от ' + API.base();
  const r = S.cards.filter(c => c.status === 'running').length, q = S.cards.filter(c => c.status === 'queued').length;
  $('#connTxt').textContent = !online() ? 'ComfyUI не отвечает' : busy ? `в работе ${r} · очередь ${q}` : connected ? 'ComfyUI подключён' : 'подключён · без живого канала';
}
function renderErrors() {
  const errs = S.cards.filter(c => c.status === 'error' && !c.errSeen);
  const b = $('#errBadge'); b.hidden = !errs.length; b.textContent = `! ${errs.length}`;
}
/* ошибки: навели — список выпал, увели — спрятался; клик — закрепить, пока не кликнете в пустое место */
let errPinned = false, errHideT = null;
function showErrPop() {
  const errs = S.cards.filter(c => c.status === 'error' && !c.errSeen);
  if (!errs.length) return;
  popAt($('#errBadge'), `<h4>Ошибки${errPinned ? ' · закреплено' : ''}</h4>${errs.map(c => `<button data-id="${c.id}">${esc(c.title)} — ${esc((c.error || '').slice(0, 60))}</button>`).join('')}<button data-all="1">Отметить все как просмотренные</button>`, p => {
    p.classList.add('errpop');
    p.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; errPinned = false; closePop(); if (b.dataset.all) { errs.forEach(c => c.errSeen = true); save(); render(); } else openDetails(byId(+b.dataset.id)); };
    p.onmouseenter = () => clearTimeout(errHideT);
    p.onmouseleave = () => { if (!errPinned) errHideT = setTimeout(closePop, 250); };
  }, 'below');
}
$('#errBadge').onmouseenter = () => { clearTimeout(errHideT); if (pop.hidden || !pop.classList.contains('errpop')) showErrPop(); };
$('#errBadge').onmouseleave = () => { if (!errPinned) errHideT = setTimeout(() => { if (!pop.matches(':hover')) closePop(); }, 250); };
$('#errBadge').onclick = () => { errPinned = !errPinned; showErrPop(); };

/* ================= просмотр, детали ================= */
const peek = $('#peek'); let peekT = null;
document.addEventListener('pointerover', e => {
  const el = e.target.closest('.card:not(.widget), .row, .res'); if (!el || G || M) return;
  clearTimeout(peekT);
  const v = el.querySelector('video:not(.under)'); if (v) v.play().catch(() => { });
  peekT = setTimeout(() => showPeek(+el.dataset.id, el), 750);
});
document.addEventListener('pointerout', e => {
  const el = e.target.closest('.card:not(.widget), .row, .res'); if (!el || el.contains(e.relatedTarget)) return;
  clearTimeout(peekT);
  // превью живое: можно зайти в него мышкой и двигать ползунок — прячем с небольшой задержкой
  if (!peek.hidden && !peek.contains(e.relatedTarget)) peekLater();
  const v = el.querySelector('video:not(.under)'); if (v) v.pause();
});
let peekHideT = null;
const peekLater = () => { clearTimeout(peekHideT); peekHideT = setTimeout(hidePeek, 320); };
peek.addEventListener('pointerenter', () => clearTimeout(peekHideT));
peek.addEventListener('pointerleave', e => { if (!e.relatedTarget?.closest?.('.card, .row, .res')) peekLater(); });
function showPeek(id, el) {
  const c = byId(id); if (!c || !isReady(c)) return;
  clearTimeout(peekHideT);
  const src = srcOf(c); if (!src) return;
  const meta = `${esc(c.title)}${c.w ? ' · ' + c.w + '×' + c.h : ''}${c.dur ? ' · ' + c.dur.toFixed(1) + ' ' + T('с') : ''}`;
  peek.classList.toggle('aud', c.kind === 'audio'); peek.classList.toggle('vid', c.kind === 'video');
  if (c.kind === 'audio') peek.innerHTML = `<div class="paud"><b>♪</b><span data-noi18n>${meta}</span></div><audio src="${esc(src)}" controls autoplay preload="auto"></audio>`;
  else if (c.kind === 'video') peek.innerHTML = `<video src="${esc(src)}" controls autoplay loop playsinline ${S.cfg.peekSound ? '' : 'muted'}></video><span class="psnd">${sndIcon()}</span><div class="pt top" data-noi18n>${meta}</div>`;
  else peek.innerHTML = mediaHTML(c, { autoplay: true }) + `<div class="pt" data-noi18n>${meta}</div>`;
  const pv = peek.querySelector('video'); if (pv && S.cfg.peekSound) { pv.muted = false; pv.volume = 0.8; pv.play().catch(() => {}); }
  const pa = peek.querySelector('audio'); if (pa) { pa.volume = 0.8; pa.play().catch(() => {}); }
  const r = el.getBoundingClientRect(); peek.hidden = false;
  const w = peek.offsetWidth, h = peek.offsetHeight;
  let x = r.right + 8; if (x + w > innerWidth - 8) x = r.left - w - 8; if (x < 8) x = 8;
  peek.style.left = x + 'px'; peek.style.top = Math.min(Math.max(8, r.top), innerHeight - h - 8) + 'px';
}
function hidePeek() { clearTimeout(peekT); clearTimeout(peekHideT); peek.hidden = true; peek.innerHTML = ''; }
canvasEl.addEventListener('dblclick', e => { const el = e.target.closest('.card'); if (!el) return; const c = byId(+el.dataset.id); if (c.type === 'widget') { if (typeof openWorkflowTab === 'function') openWorkflowTab(c.wf); } else openDetails(c); });
canvasEl.addEventListener('click', e => { const st = e.target.closest('.card.widget .stack'); if (st && st.textContent) openResults(byId(+st.closest('.card').dataset.id)); });

const sheetBack = $('#sheetBack'), sheet = $('#sheet');
function sheetOpen(html, onSubmit, { wide = false, init, onClick } = {}) {
  sheet.className = 'sheet' + (wide ? ' wide' : '');
  sheet.innerHTML = html;
  sheet.onsubmit = e => { e.preventDefault(); if (onSubmit && onSubmit(sheet.elements, e) === false) return; closeSheet(); };
  sheet.onclick = e => { if (e.target.closest('[data-close]')) { closeSheet(); return; } onClick && onClick(e); };
  sheet.oninput = e => { const o = e.target.parentNode.querySelector('output'); if (o) o.textContent = e.target.value; };
  sheetBack.hidden = false;
  init && init(sheet);
  setTimeout(() => (sheet.querySelector('textarea, input[type=text], select') || sheet.querySelector('[type=submit], .btn.primary'))?.focus(), 30);
}
function closeSheet() { sheetBack.hidden = true; sheet.innerHTML = ''; sheet.onsubmit = sheet.onclick = sheet.onchange = sheet.oninput = null; }
sheetBack.addEventListener('pointerdown', e => { if (e.target === sheetBack) closeSheet(); });

function traceHTML(c) {
  const now = Date.now(), sl = slowInfo(c);
  const st = lastStats || {}, g = st.gpu || {};
  const vram = g.vram_total ? `${gb(g.vram_used)} из ${gb(g.vram_total)} ГБ` : null;
  const ram = st.ram_total ? `${gb(st.ram_used)} из ${gb(st.ram_total)} ГБ` : null;
  let warn = '';
  if (sl) warn = `<div class="trace-warn"><b>⚠ ${sl.kind === 'step' ? `Шаг ${esc(c.step || '')} идёт уже ${mmss(sl.wait)}, а обычный шаг шёл ≈${mmss(sl.avg)}.` : `Этап «${esc(c.stage || '')}» идёт уже ${mmss(sl.wait)} без движения.`}</b><br>
    Чаще всего это нехватка видеопамяти${vram ? ` (сейчас занято ${vram})` : ''}: ComfyUI начинает перекладывать данные в обычную память${ram ? ` (${ram})` : ''}, и работа замедляется в десятки раз.
    Что поможет: закройте программы, которые используют видеокарту (игры, Roblox Studio, браузер с видео), или остановите задачу и запустите короче или в меньшем размере. После остановки — «Освободить видеопамять» в уголке инструментов.</div>`;
  const rows = (c.trace || []).slice(-14).map((t, i, arr) => {
    const on = !t.end && c.status === 'running', dur = ((t.end || now) - t.t0) / 1000;
    return `<div class="tr${on ? ' on' : ''}"><span class="xn">${esc(t.title)}</span><span class="xc">${esc(t.ct)}</span><span class="xd">${on ? '▶ ' : ''}${mmss(dur)}</span></div>`;
  }).join('');
  return `${warn}<div class="trace"><div class="trace-h">Что делает ComfyUI${c.status === 'running' ? ' сейчас' : ''} <small>— последние шаги, время каждого</small></div>${rows}</div>`;
}
function openDetails(c) {
  if (!c) return;
  const wf = wfById(c.actionId);
  if (c.status === 'error') { c.errSeen = true; save(); renderErrors(); }
  const rows = [['Тип', KIND_RU[c.kind]]];
  if (c.from) rows.push(['Из', c.from]);
  if (wf) rows.push(['Workflow', wf.title]);
  if (c.params && wf) for (const p of wf.params || []) { if (!(p.id in c.params)) continue; let v = c.params[p.id]; if (p.type === 'select') v = p.options[Number(v)]?.label; if (['audio', 'image', 'video'].includes(p.type)) v = byId(v)?.title || '—'; rows.push([p.label, v]); }
  if (c.w) rows.push(['Размер', `${c.w}×${c.h}`]);
  if (c.file) rows.push(['Файл', (c.file.subfolder ? c.file.subfolder + '/' : '') + c.file.filename]);
  if (c.done && c.started) rows.push(['Генерация', fmtSec((c.done - c.started) / 1000).replace('≈', '')]);
  const big = isReady(c) ? (c.kind === 'audio' ? mediaHTML(c, { controls: true }) : `<div class="big">${c.kind === 'video' ? `<video src="${esc(srcOf(c))}" controls autoplay loop playsinline></video>` : mediaHTML(c)}</div>`) : '';
  const pend = c.status === 'queued' || c.status === 'running';
  sheetOpen(`<h3>${esc(c.title)}</h3>${big}${c.error ? `<div class="err-box">${esc(c.error)}</div>` : ''}${c.trace?.length ? `<div id="traceBox" data-id="${c.id}">${traceHTML(c)}</div>` : ''}<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="acts">${c.nodeId && wf ? '<button type="button" class="btn ghost" data-a="node">Показать в графе</button>' : ''}${pend ? '<button type="button" class="btn ghost" data-a="cancel">Остановить</button>' : ''}${wf && byId(c.parent) ? '<button type="button" class="btn ghost" data-a="redo">Изменить и перезапустить</button><button type="button" class="btn" data-a="again">Ещё вариант</button>' : ''}${c.file ? `<a class="btn ghost" href="${esc(API.view(c.file))}" download>Скачать</a>` : ''}<button type="button" class="btn primary" data-close>Закрыть</button></div>`, null, { wide: true, onClick: e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const p = byId(c.parent);
    closeSheet();
    if (b.dataset.a === 'cancel') cancelJob(c);
    if (b.dataset.a === 'node' && typeof showNodeInTab === 'function') showNodeInTab(wf.id, c.nodeId);
    if (b.dataset.a === 'again') runJob(p, wf, { ...c.params });
    if (b.dataset.a === 'redo') openParams([p], wf, { ...c.params });
  } });
}

/* черновик VFX: сервер рисует эффект на уменьшенном кадре и отдаёт GIF */
async function vfxPreview(wf, vals, src, box, btn) {
  if (!src?.file || !box) return;
  const node = Object.entries(wf.workflow).find(([, n]) => n.class_type === 'DTVFXGuide')?.[0];
  const val = id => { const p = (wf.params || []).find(x => x.id === id); if (!p) return undefined; const v = vals[id] ?? p.default; return p.type === 'select' ? (p.options[Number(v) || 0] || p.options[0]).value : v; };
  const byTarget = field => (wf.params || []).find(p => (p.targets || []).some(t => t.node === node && t.field === field));
  const pt = vals[byTarget('center_x')?.id] || [0.5, 0.5];
  const body = { file: src.file, effect: val(byTarget('effect')?.id) || 'portal', cx: pt[0], cy: pt[1], size: val(byTarget('size')?.id) ?? 0.35, intensity: val(byTarget('intensity')?.id) ?? 1, seconds: val('seconds') ?? 3, seed: 7 };
  const old = btn.textContent; btn.textContent = '⏳ рисую…'; btn.disabled = true;
  try {
    const r = await fetch(API.url('/directors-table/api/vfx-preview'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'ошибка');
    const url = URL.createObjectURL(await r.blob());
    const im = box.querySelector('img'); if (im) { if (!im.dataset.still) im.dataset.still = im.src; im.src = url; }
    toast('Это черновик: LTX превратит его в реалистичный эффект. Клик по кадру — снова выбрать точку.');
  } catch (e) { toast('Черновик не получился: ' + esc(e.message) + '. Нужен перезапуск ComfyUI после обновления.'); }
  btn.textContent = old; btn.disabled = false;
}
/* ---- параметры запуска (развёрнутый виджет) ---- */
function openParams(cards, wf, vals, opts = {}) {
  window.__pctx = { cards, wf, opts };
  const sheetId = cards[0] ? cards[0].sheet : S.sheet;
  const pick = kind => S.cards.filter(c => c.sheet === sheetId && !c.parked && c.type === 'file' && c.kind === kind && c.file);
  const fieldHTML = p => {
    const v = vals[p.id];
    if (p.type === 'text') return `<div class="field"><label for="p_${esc(p.id)}">${esc(p.label)} <button type="button" class="btn small ghost" data-dict="${esc(p.id)}" title="Надиктовать">🎙</button>${p === promptParam(wf) ? ` <button type="button" class="btn small ghost" data-enh="${esc(p.id)}" title="Локальная модель превратит пожелание в правильный промпт под эту модель (файл режиссёра)">✨ Улучшить</button><button type="button" class="btn small ghost" data-unenh="${esc(p.id)}" hidden title="Вернуть как было">↶</button>` : ''}</label><textarea id="p_${esc(p.id)}" name="${esc(p.id)}">${esc(v ?? '')}</textarea></div>`;
    if (p.type === 'number') return `<div class="field"><label for="p_${esc(p.id)}">${esc(p.label)}</label><div class="row2"><input type="range" id="p_${esc(p.id)}" name="${esc(p.id)}" min="${num(p.min, 0)}" max="${num(p.max, 100)}" step="${num(p.step, 1) || 1}" value="${esc(v ?? p.default)}"><output>${esc(v ?? p.default)}</output></div></div>`;
    if (p.type === 'select') return `<div class="field"><label for="p_${esc(p.id)}">${esc(p.label)}</label><select id="p_${esc(p.id)}" name="${esc(p.id)}">${p.options.map((o, i) => `<option value="${i}" ${Number(v) === i ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    if (p.type === 'point') {
      // точка на кадре: где будет эффект
      const src = cards.filter(Boolean)[0], v = vals[p.id] || p.default || [0.5, 0.5], url = src && src.kind === 'image' ? srcOf(src) : null;
      const vfxNode = Object.values(wf.workflow || {}).some(n => n.class_type === 'DTVFXGuide');
      return `<div class="field"><label>${esc(p.label)}${vfxNode && url ? ` <button type="button" class="btn small ghost" data-vfxprev="${esc(p.id)}" title="Быстро показать черновик эффекта на этом кадре (без LTX, пара секунд)">👁 Черновик</button>` : ''}</label><div class="ptpick" data-point="${esc(p.id)}">${url ? `<img src="${esc(url)}" draggable="false" alt="">` : '<div class="pt-empty">Кадр появится, когда на виджет брошена картинка</div>'}<i class="ptm" style="left:${num(v[0], .5) * 100}%;top:${num(v[1], .5) * 100}%"></i></div></div>`;
    }
    if (['audio', 'image', 'video'].includes(p.type)) {
      const list = pick(p.type);
      if (!list.find(x => x.id === v)) vals[p.id] = list[0]?.id;
      return `<div class="field"><label>${esc(p.label)}${p.required ? '' : ' (необязательно)'}</label><div class="picker" data-pick="${esc(p.id)}">${list.map(x => `<button type="button" data-id="${esc(x.id)}" class="${vals[p.id] === x.id ? 'cur' : ''}">${p.type === 'audio' ? '♪' : '▣'} ${esc(x.title)}</button>`).join('')}<button type="button" data-upload="${p.type}">Загрузить файл…</button></div>${list.length ? '' : `<span class="hint">На этой сцене нет файла «${KIND_RU[p.type]}». Загрузите или перетащите на холст.</span>`}<input type="file" accept="${p.type}/*" hidden data-file="${esc(p.id)}"></div>`;
    }
    return '';
  };
  const readForm = () => { for (const p of wf.params || []) { const el = sheet.elements[p.id]; if (!el) continue; vals[p.id] = ['number', 'select'].includes(p.type) ? Number(el.value) : el.value; } };
  const draw = () => {
    const src = cards.filter(Boolean);
    const est = estimate(wf, unitsOf(wf, vals, src[0]));
    sheetOpen(`<h3>${esc(wf.title)}</h3><div class="sub">${src.length ? (src.length === 1 ? `«${esc(src[0].title)}»` : `${src.length} файлов, каждый — отдельной задачей`) : 'без входного файла'}${wf.about ? ' · ' + esc(wf.about) : ''}</div>${typeof lowVramNote === 'function' ? lowVramNote(wf) : ''}${(() => { const alts = WFS.filter(x => x.kind === wf.kind && x.id !== wf.id); return alts.length ? `<div class="field wfswitch"><label for="pWfSel">Workflow</label><select id="pWfSel"><option value="${esc(wf.id)}" selected>${esc(wf.title)}</option>${alts.map(x => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></div>` : ''; })()}${typeof presetChips === 'function' ? presetChips(wf) : ''}
      ${(wf.params || []).map(fieldHTML).join('')}
      <div class="acts"><span class="est">${est ? 'по опыту этого ПК: ' + fmtSec(est * Math.max(1, src.length)) : wf.estimate ? esc(wf.estimate) : 'время ещё не замерено'}</span><button type="button" class="btn ghost" data-close>Отмена <kbd>Esc</kbd></button><button type="button" class="btn" data-plan title="Поставить в «План» — запустится по очереди, можно менять порядок">В план</button><button type="submit" class="btn primary">Запустить <kbd>Ctrl+Enter</kbd></button></div>`,
      () => { readForm(); const miss = missingParams(wf, vals); if (miss.length) { toast('Не хватает: <b>' + miss.map(p => esc(p.label)).join(', ') + '</b>'); return false; } (src.length ? src : [null]).forEach(c => runJob(c, wf, { ...vals }, opts)); },
      { wide: (wf.params || []).length > 5, onClick: e => {
        const en = e.target.closest('[data-enh]');
        if (en) {
          const ta = sheet.elements[en.dataset.enh]; if (!ta) return;
          const idea = ta.value.trim(); if (!idea) return toast('Напишите или надиктуйте пожелание — хоть парой слов, на любом языке.');
          readForm();
          const src0 = cards.filter(Boolean)[0];
          const desc = [src0 ? `${src0.kind}: ${src0.title}${src0.w ? ` (${src0.w}x${src0.h})` : ''}${src0.dur ? `, ${src0.dur.toFixed(1)} s` : ''}` : '',
            ...(wf.params || []).filter(p => ['audio', 'image', 'video'].includes(p.type) && vals[p.id]).map(p => { const c = byId(vals[p.id]); return c ? `${p.type}: ${c.title}${c.dur ? ` (${c.dur.toFixed(1)} s${p.type === 'audio' ? ', speech/voice track for lip-sync' : ''})` : ''}` : ''; }),
            vals.seconds ? `duration: ${vals.seconds} s` : '', vals.effect != null && (wf.params || []).find(p => p.id === 'effect') ? `effect: ${(wf.params.find(p => p.id === 'effect').options[Number(vals.effect) || 0] || {}).value}` : ''].filter(Boolean).join('; ');
          const old = en.textContent; en.textContent = '✨ думаю…'; en.disabled = true;
          enhancePrompt(wf, idea, desc).then(j => {
            ta.dataset.before = idea; ta.value = j.text; vals[en.dataset.enh] = j.text;
            const u = sheet.querySelector(`[data-unenh="${en.dataset.enh}"]`); if (u) u.hidden = false;
            toast(`Готово: ${esc(j.model)}${j.guide ? ' · правила «' + esc(j.guide) + '»' : ''}. Поправьте, если нужно.`);
          }).catch(err => toast('✨ ' + esc(err.message))).finally(() => { en.textContent = old; en.disabled = false; });
          return;
        }
        const un = e.target.closest('[data-unenh]');
        if (un) { const ta = sheet.elements[un.dataset.unenh]; if (ta && ta.dataset.before != null) { ta.value = ta.dataset.before; vals[un.dataset.unenh] = ta.value; un.hidden = true; } return; }
        const vp = e.target.closest('[data-vfxprev]');
        if (vp) { readForm(); vfxPreview(wf, vals, cards.filter(Boolean)[0], sheet.querySelector(`.ptpick[data-point="${vp.dataset.vfxprev}"]`), vp); return; }
        const pt = e.target.closest('.ptpick');
        if (pt) { const im0 = pt.querySelector('img'); if (im0 && im0.dataset.still) { im0.src = im0.dataset.still; delete im0.dataset.still; } const im = pt.querySelector('img'); const r = (im && im.getBoundingClientRect().width > 4 ? im : pt).getBoundingClientRect(); if (!r.width || !r.height) return; const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)); vals[pt.dataset.point] = [+x.toFixed(3), +y.toFixed(3)]; const m = pt.querySelector('.ptm'); m.style.left = x * 100 + '%'; m.style.top = y * 100 + '%'; return; }
        const pk = e.target.closest('.picker button');
        if (pk) { const pid = pk.parentNode.dataset.pick; if (pk.dataset.upload) sheet.querySelector(`[data-file="${pid}"]`).click(); else { readForm(); vals[pid] = +pk.dataset.id; draw(); } }
        const d = e.target.closest('[data-dict]'); if (d && typeof startDictation === 'function') startDictation(sheet.elements[d.dataset.dict]);
        if (e.target.closest('[data-plan]')) { readForm(); const miss = missingParams(wf, vals); if (miss.length) { toast('Не хватает: <b>' + miss.map(p => esc(p.label)).join(', ') + '</b>'); return; } closeSheet(); addToPlan(wf, src, vals, opts); }
      } });
    sheet.onchange = e => {
      const inp = e.target.closest('[data-file]'); if (!inp || !inp.files.length) return;
      readForm();
      const [c] = addFilesToCanvas(inp.files, null, sheetId);
      if (c) { vals[inp.dataset.file] = c.id; const wait = () => (c.file || c.status === 'error') ? draw() : setTimeout(wait, 200); wait(); }
    };
  };
  draw();
}

/* ---- результаты виджета (развёртка вывода) ---- */
const overlay = $('#overlay');
let ovW = null, ovSel = new Set();
function openResults(w) {
  ovW = w; ovSel = new Set();
  drawResults();
  overlay.hidden = false;
}
function drawResults() {
  const w = ovW; if (!w) return;
  const wf = wfById(w.wf);
  const jobs = jobsOf(w).sort((a, b) => (b.done || b.created) - (a.done || a.created));
  const color = wfColor(wf) || '#8f74f2';
  overlay.innerHTML = `<div class="ov" style="--c:${color}"><header><h3>${esc(wf ? wf.title : 'Workflow')}</h3><span>${jobs.filter(j => j.status === 'done').length} готово · клик — выбрать, перетащите на холст, двойной клик — подробно</span><div class="spacer"></div><button class="btn ghost small" data-a="all">Выбрать все</button><button class="btn ghost small" data-a="close">Закрыть <kbd>Esc</kbd></button></header>
    <div class="grid">${jobs.length ? jobs.map(j => `<div class="res k-${j.kind}${ovSel.has(j.id) ? ' sel' : ''}" data-id="${j.id}"><span class="ck2">${ovSel.has(j.id) ? '✓' : ''}</span>${fileHTML(j).replace('<div class="media">', `<div class="media">${j.status === 'running' ? `<span class="badge run">${esc(j.step || 'идёт')}</span>` : j.status === 'queued' ? '<span class="badge">в очереди</span>' : ''}`)}</div>`).join('') : '<div class="empty">Здесь будут результаты этого workflow.<br>Пока пусто: перетащите картинку на виджет — откроются параметры, нажмите «Запустить».</div>'}</div>
    <div class="acts"><span style="margin-right:auto;font-size:12px;color:var(--dim)">${ovSel.size ? 'Выбрано: ' + ovSel.size : jobs.length ? 'Кликните по результату, чтобы выбрать' : ''}</span><button class="btn ghost" data-a="del" ${ovSel.size ? '' : 'disabled'}>Удалить выбранные</button><button class="btn ghost" data-a="cut" ${ovSel.size ? '' : 'disabled'}>В монтаж</button><button class="btn primary" data-a="out" ${ovSel.size ? '' : 'disabled'}>На холст</button></div></div>`;
}
overlay.addEventListener('pointerdown', e => {
  if (e.target === overlay) { closeResults(); return; }
  const r = e.target.closest('.res'); if (!r || e.button !== 0) return;
  e.preventDefault();
  const id = +r.dataset.id;
  G = { id, x0: e.clientX, y0: e.clientY, t0: performance.now(), pid: e.pointerId, btn: 0, mode: 'press', samples: [], src: 'res' };
  const mvStart = ev => {
    if (!G || G.mode !== 'press' || Math.hypot(ev.clientX - G.x0, ev.clientY - G.y0) <= S.cfg.moveTol) return;
    const ids = ovSel.has(id) ? [...ovSel] : [id];
    const items = ids.map(byId).filter(isReady);
    window.removeEventListener('pointermove', mvStart);
    if (!items.length) { G.mode = 'none'; return; }
    closeResults(); startExtDrag(ev, items, 'result');
  };
  window.addEventListener('pointermove', mvStart);
  addG();
});
overlay.addEventListener('click', e => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  const r = e.target.closest('.res');
  if (r && !a) { const id = +r.dataset.id; ovSel.has(id) ? ovSel.delete(id) : ovSel.add(id); drawResults(); return; }
  if (!a) return;
  const picked = [...ovSel].map(byId).filter(Boolean);
  if (a === 'close') closeResults();
  if (a === 'all') { jobsOf(ovW).forEach(j => j.status === 'done' && ovSel.add(j.id)); drawResults(); }
  if (a === 'del') { removeCards(picked.map(c => c.id)); ovSel.clear(); drawResults(); }
  if (a === 'out' || a === 'cut') {
    const area = a === 'cut' ? areasOf(ovW.sheet).find(x => x.montage) : (areaForKind(wfById(ovW.wf)?.kind, '', ovW.sheet));
    picked.filter(isReady).forEach(c => { c.parked = false; c.owner = null; placeCard(c, area); });
    save(); closeResults(); render(picked.map(c => c.id));
  }
});
overlay.addEventListener('dblclick', e => { const r = e.target.closest('.res'); if (r) { closeResults(); openDetails(byId(+r.dataset.id)); } });
function closeResults() { overlay.hidden = true; overlay.innerHTML = ''; ovW = null; }

/* ================= всплывашки ================= */
const pop = $('#pop');
function popAt(anchor, html, init, where) {
  pop.innerHTML = html; pop.hidden = false;
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px';
  pop.style.top = (where === 'below' ? Math.min(r.bottom + 8, innerHeight - h - 8) : Math.max(8, r.top - h - 8)) + 'px';
  init && init(pop);
}
function closePop() { pop.hidden = true; pop.innerHTML = ''; pop.onclick = null; pop.onmouseenter = pop.onmouseleave = null; pop.classList.remove('errpop'); errPinned = false; }
document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target)) closePop(); });
const toastEl = $('#toast'); let toastT;
function toast(html, action) {
  toastEl.innerHTML = `<span>${html}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  if (action) toastEl.querySelector('button').onclick = () => { action.fn(); toastEl.hidden = true; };
  toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (toastEl.hidden = true), action ? 5000 : 3000);
}
