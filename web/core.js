/* Director's Table v0.3 — ядро: состояние, API ComfyUI, библиотека workflow, задачи.
   Файлы core.js → ui.js → extras.js подключаются по порядку и делят общие переменные. */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CID = 'dt-' + Math.random().toString(36).slice(2, 10);
// все запросы к API стола несут X-DT: 1 — сервер без него отвечает «нельзя» (защита от чужих сайтов)
const _rawFetch = window.fetch.bind(window);
window.fetch = (u, o = {}) => (typeof u === 'string' && u.includes('/directors-table/api/')) ? _rawFetch(u, { ...o, headers: { ...(o.headers || {}), 'X-DT': '1' } }) : _rawFetch(u, o);
/* ---- проверка чужих данных: id, цвета, числа (файлы workflow и проекты могут прийти от кого угодно) ---- */
const SAFE_ID = /^[\w:.-]{1,64}$/;
const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i;
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v)) ? v : (isFinite(+v) && v !== '' && v !== null ? +v : d);
const PARAM_TYPES = ['card', 'image', 'audio', 'video', 'text', 'number', 'select', 'seed', 'point'];
function cleanAction(a) {
  if (!a || typeof a !== 'object' || !SAFE_ID.test(String(a.id || '')) || !a.workflow || typeof a.workflow !== 'object') return null;
  if (Object.keys(a.workflow).some(k => !SAFE_ID.test(k))) return null;
  const params = (Array.isArray(a.params) ? a.params : []).filter(p => p && SAFE_ID.test(String(p.id || '')) && PARAM_TYPES.includes(p.type)).map(p => {
    const q = { ...p, label: String(p.label ?? p.id).slice(0, 200) };
    if (p.type === 'number') { q.min = num(p.min, 0); q.max = num(p.max, 100); q.step = num(p.step, 1) || 1; q.default = num(p.default, q.min); }
    if (p.type === 'select') { q.options = (Array.isArray(p.options) ? p.options : []).map(o => ({ ...o, label: String(o?.label ?? '').slice(0, 120) })); q.default = num(p.default, 0); if (!q.options.length) return null; }
    if (p.type === 'seed' && p.max != null) q.max = num(p.max, 2 ** 47);
    if (p.type === 'point') q.default = Array.isArray(p.default) ? [num(p.default[0], .5), num(p.default[1], .5)] : [.5, .5];
    q.targets = (Array.isArray(p.targets) ? p.targets : []).filter(t => t && SAFE_ID.test(String(t.node)) && typeof t.field === 'string');
    return q;
  }).filter(Boolean);
  const out = a.output && SAFE_ID.test(String(a.output.node)) ? { node: String(a.output.node), kind: ['video', 'image', 'audio'].includes(a.output.kind) ? a.output.kind : 'video' } : null;
  if (!out) return null;
  return { ...a, id: String(a.id), title: String(a.title || a.id).slice(0, 120), about: String(a.about || '').slice(0, 400), zone: SAFE_ID.test(String(a.zone || '')) ? a.zone : undefined, params, output: out };
}
const KINDS = ['image', 'video', 'audio'];
const KIND_RU = { image: 'картинка', video: 'видео', audio: 'звук', text: 'текст' };
const KIND_C = { image: '#f0ff41', video: '#3fd2ff', audio: '#ff8a3d', text: '#6f8cff' };
const W = 1600; let H = 1000;       // логический размер холста: ширина постоянная, высота под окно
// «Вид» стола (как значки в Windows): крупные / средние / мелкие / минимализм — меняет размер карточек и виджетов
const VIEW_K = { large: [0.85, 1.0], medium: [0.7, 0.86], small: [0.56, 0.7], mini: [0.5, 0.62] };
// на больших мониторах стол растягивается, и карточки выходят крупными — по умолчанию берём «мелкие»
let VIEW = innerWidth > 1800 ? 'small' : 'medium'; try { VIEW = (JSON.parse(localStorage.getItem('dt-state-v3') || 'null')?.cfg?.view) || VIEW; } catch (_) { }
if (!VIEW_K[VIEW]) VIEW = 'medium';
let CARD_K = VIEW_K[VIEW][0];        // карточки компактные, при наведении раскрываются
let CW = Math.round(150 * CARD_K), CH = Math.round(124 * CARD_K);   // карточка файла
let WIDGET_K = VIEW_K[VIEW][1];       // виджет заметно крупнее карточек файлов
let WW = Math.round(156 * WIDGET_K), WH = Math.round(126 * WIDGET_K);   // виджет workflow
document.documentElement.dataset.view = VIEW;
document.documentElement.style.setProperty('--card-k', CARD_K);
document.documentElement.style.setProperty('--widget-k', WIDGET_K);

/* ================= раскладки областей ================= */
const LAYOUTS = {
  '3x3': {
    label: 'Режиссёрская', areas: [
      { id: 'video', label: 'Видео', note: 'генерация и исходники', c: '#3fd2ff', x: 0, y: 0, w: .41, h: .38, corner: 'tl', kinds: ['video'] },
      { id: 'script', label: 'Сценарий', note: 'по строке на кадр', c: '#f0ff41', x: .425, y: .015, w: .15, h: .29, corner: 'top', kinds: [], panel: 'script' },
      { id: 'image', label: 'Картинки', note: 'кадры, референсы', c: '#f0ff41', x: .59, y: 0, w: .41, h: .38, corner: 'tr', kinds: ['image'] },
      { id: 'fx', label: 'Эффекты', note: 'VFX, переходы', c: '#ff5fa8', x: 0, y: .38, w: .23, h: .25, corner: 'l', kinds: [] },
      { id: 'cut', label: 'Монтаж', note: 'всё стекается сюда · слева направо', c: '#ff6b5e', x: .23, y: .38, w: .54, h: .25, corner: 'c', kinds: [], montage: true },
      { id: 'text', label: 'Текст · дизайн', note: 'титры, графика', c: '#6f8cff', x: .77, y: .38, w: .23, h: .25, corner: 'r', kinds: ['text'] },
      { id: 'sound', label: 'Звук', note: 'шумы и эффекты', c: '#ff8a3d', x: 0, y: .63, w: .41, h: .37, corner: 'bl', kinds: ['audio'], match: /sfx|fx|шум|whoosh|hit|удар|ambient|амбиент|звук|sound|foley/i },
      { id: 'assist', label: 'Ассистент', note: 'скажите или напишите', c: '#8f74f2', x: .425, y: .65, w: .15, h: .335, corner: 'bot', kinds: [], panel: 'assistant' },
      { id: 'voice', label: 'Музыка · озвучка', note: 'голос, музыка', c: '#5fe3a1', x: .59, y: .63, w: .41, h: .37, corner: 'br', kinds: ['audio'] },
    ]
  },
  'vi': {
    label: 'Видео + картинки', areas: [
      { id: 'video', label: 'Видео', note: 'генерация и исходники', c: '#3fd2ff', x: 0, y: 0, w: .5, h: .7, corner: 'tl', kinds: ['video', 'audio'] },
      { id: 'image', label: 'Картинки', note: 'кадры, референсы', c: '#f0ff41', x: .5, y: 0, w: .5, h: .7, corner: 'tr', kinds: ['image'] },
      { id: 'cut', label: 'Монтаж', note: 'порядок слева направо', c: '#ff6b5e', x: 0, y: .7, w: 1, h: .3, corner: 'c', kinds: [], montage: true },
    ]
  },
  'video': {
    label: 'Только видео', areas: [
      { id: 'video', label: 'Видео', note: 'всё для видео', c: '#3fd2ff', x: 0, y: 0, w: 1, h: .7, corner: 'tl', kinds: ['video', 'image', 'audio'] },
      { id: 'cut', label: 'Монтаж', note: 'порядок слева направо', c: '#ff6b5e', x: 0, y: .7, w: 1, h: .3, corner: 'c', kinds: [], montage: true },
    ]
  },
  'free': { label: 'Без областей', areas: [] },
};
// зоны раскладки + личные настройки зон (имя, цвет, линии) из шестерёнки
const layoutDef = id => LAYOUTS[id] || S.customLayouts?.[id] || LAYOUTS['3x3']; // свои раскладки из редактора зон
const areasOf = (sheet = S.sheet) => layoutDef((S.sheets.find(s => s.id === sheet) || {}).layout).areas.map(a => S.zoneCfg?.[a.id] ? { ...a, ...S.zoneCfg[a.id] } : a);
const areaRect = a => ({ x: a.x * W, y: a.y * H, w: a.w * W, h: a.h * H });
function areaAt(x, y, sheet) { return areasOf(sheet).find(a => { const r = areaRect(a); return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }) || null; }
function areaForKind(kind, title = '', sheet) {
  const list = areasOf(sheet).filter(a => !a.montage && a.kinds.includes(kind));
  return list.find(a => a.match && a.match.test(title)) || list.find(a => !a.match) || list[0] || null;
}

/* ================= состояние ================= */
const LS = 'dt-state-v3';
const LAYOUT_VER = 2;
const DEFAULT_CFG = {
  holdMs: 300, moveTol: 6, backend: '', magnet: true, sortBy: 'date', pianoRows: 2, pianoScale: 1,
  voiceEngine: 'whisper', voiceModel: 'small', voiceDevice: 'cpu', voiceLang: 'ru',
  llmUrl: 'http://127.0.0.1:11434', llmModel: '', spill: true, preview: 'auto', midi: true, lowVram: 'auto', tutorialDone: false,
  codewords: 'video: видео, ролик, клип, оживи\nimage: картинка, кадр, фото, изображение\naudio: звук, озвучка, голос, музыка\ncut: монтаж',
};
function fresh() {
  return {
    v: 3, cfg: { ...DEFAULT_CFG },
    sheets: [{ id: 1, name: 'Сцена 1', layout: '3x3', key: 0 }],
    sheet: 1, groups: [], favs: { KeyQ: '@cut', KeyW: '@open' }, keymap: {},
    cards: [], inbox: [], plan: [], zoneCfg: {}, lastRun: {}, customLayouts: {}, planAuto: true, planOn: false, lastParams: {}, timings: {}, zoneMode: 'full', locked: false, nextId: 1,
    radio: { tracks: [], mode: 'order', vol: 0.6, idx: 0, url: '' }, scripts: {}, savedAt: 0,
  };
}
function normalize(s) {
  if (!s || !Array.isArray(s.cards)) return null;
  const f = fresh();
  const out = { ...f, ...s, cfg: { ...DEFAULT_CFG, ...(s.cfg || {}) }, radio: { ...f.radio, ...(s.radio || {}) } };
  out.cards = out.cards.filter(c => c.type === 'widget' || c.file || ((c.status === 'queued' || c.status === 'running') && c.promptId) || c.status === 'error');
  out.inbox = (out.inbox || []).filter(c => c.file);
  out.radio.tracks = (out.radio.tracks || []).filter(t => t.file || t.url || (t.local && typeof t.path === 'string' && !t.path.includes('..')) || (t.idb && typeof t.idb === 'string'));
  out.sheets.forEach((sh, i) => { if (!sh.layout) sh.layout = '3x3'; if (sh.key == null) sh.key = i; }); // у сцены своя белая клавиша
  out.scripts = out.scripts || {};
  // чужой проект не должен уводить запросы на посторонний сервер и подсовывать HTML через цвета и id
  const be = String(out.cfg.backend || '');
  if (be) { try { const u = new URL(be); if (!['127.0.0.1', 'localhost', '[::1]', location.hostname].includes(u.hostname) || !/^https?:$/.test(u.protocol)) out.cfg.backend = ''; } catch (_) { out.cfg.backend = ''; } }
  for (const [k, z] of Object.entries(out.zoneCfg || {})) { if (!SAFE_ID.test(k) || !z || typeof z !== 'object') { delete out.zoneCfg[k]; continue; } if (z.c && !SAFE_COLOR.test(z.c)) delete z.c; if (z.label) z.label = String(z.label).slice(0, 60); if (z.note) z.note = String(z.note).slice(0, 80); }
  for (const [k, L] of Object.entries(out.customLayouts || {})) {
    if (!SAFE_ID.test(k) || !L || !Array.isArray(L.areas)) { delete out.customLayouts[k]; continue; }
    L.label = String(L.label || k).slice(0, 60);
    L.areas = L.areas.filter(a => a && SAFE_ID.test(String(a.id))).map(a => ({ ...a, c: SAFE_COLOR.test(a.c || '') ? a.c : '#8f74f2', x: num(a.x), y: num(a.y), w: num(a.w, .2), h: num(a.h, .2), corner: ['tl', 'tr', 'bl', 'br', 'l', 'r', 'c', 'top', 'bot'].includes(a.corner) ? a.corner : 'c', panel: ['script', 'assistant', 'radio', 'maestro', 'wstudio'].includes(a.panel) ? a.panel : undefined, wf: SAFE_ID.test(String(a.wf || '')) ? String(a.wf) : undefined, subs: Array.isArray(a.subs) ? a.subs.filter(x => ['screen', 'prompt', 'inputs', 'params', 'history', 'info'].includes(x)) : undefined, montage: !!a.montage, fs: Math.min(2, Math.max(.6, Number(a.fs) || 1)), label: String(a.label || '').slice(0, 60), note: String(a.note || '').slice(0, 80), kinds: (Array.isArray(a.kinds) ? a.kinds : []).filter(k => ['video', 'image', 'audio', 'text'].includes(k)) }));
  }
  out.cards = out.cards.filter(c => c && Number.isFinite(+c.id)).map(c => ({ ...c, id: +c.id, x: num(c.x), y: num(c.y), w: c.w == null ? c.w : num(c.w), h: c.h == null ? c.h : num(c.h), kind: c.type === 'widget' ? c.kind : (['image', 'video', 'audio', 'text'].includes(c.kind) ? c.kind : 'image'), wf: c.wf == null || SAFE_ID.test(String(c.wf)) ? c.wf : null }));
  out.sheets = out.sheets.filter(sh => sh && Number.isFinite(+sh.id)).map(sh => ({ ...sh, id: +sh.id, name: String(sh.name || 'Сцена').slice(0, 40) }));
  if (!out.sheets.length) out.sheets = f.sheets;
  if (out.cfg.lineStyle === 'classic') out.cfg.lineStyle = 'full';
  if (!out.zoneMode) out.zoneMode = s.hints === false ? 'dim' : 'full';
  return out;
}
function loadLocal() { try { return normalize(JSON.parse(localStorage.getItem(LS))); } catch (_) { return null; } }
let S = loadLocal() || fresh();
let saveT, serverSaveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    S.savedAt = Date.now();
    const data = snapshot();
    try { localStorage.setItem(LS, JSON.stringify(data)); } catch (_) { }
    clearTimeout(serverSaveT);
    serverSaveT = setTimeout(() => { fetch(API.url('/directors-table/api/project'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(() => { }); }, 1500);
  }, 250);
}
function snapshot() {
  const strip = ({ blob, preview, ...rest }) => rest;
  return { ...S, cards: S.cards.map(strip), inbox: S.inbox.map(strip) };
}
const byId = id => S.cards.find(c => c.id === id) || S.inbox.find(c => c.id === id);
const sheetName = id => (S.sheets.find(s => s.id === id) || {}).name || 'Сцена';
const visibleCards = (sh = S.sheet) => S.cards.filter(c => c.sheet === sh && !c.parked);
const widgetOf = c => c.owner ? S.cards.find(w => w.id === c.owner) : null;
const isReady = c => c && (c.status === 'done' || c.status === 'ready') && (c.file || c.blob);

/* ================= ComfyUI API ================= */
const API = {
  base() { return (S.cfg.backend || (location.protocol.startsWith('http') ? location.origin : 'http://127.0.0.1:8188')).replace(/\/$/, ''); },
  url(p) { return this.base() + p; },
  view(f) { return this.url(`/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder || '')}&type=${encodeURIComponent(f.type || 'output')}`); },
  async json(p, opt) {
    const r = await fetch(this.url(p), opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(errText(j) || ('HTTP ' + r.status)); e.data = j; throw e; }
    return j;
  },
  async upload(file, sub = 'directors-table') {
    const fd = new FormData();
    fd.append('image', file, file.name); fd.append('type', 'input'); fd.append('subfolder', sub);
    const j = await this.json('/upload/image', { method: 'POST', body: fd });
    return { filename: j.name, subfolder: j.subfolder || '', type: j.type || 'input' };
  },
  queue(prompt) { return this.json('/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, client_id: CID, extra_data: { preview_method: S.cfg.preview === 'off' ? 'none' : (S.cfg.preview || 'auto') } }) }); },
  history(pid) { return this.json('/history/' + encodeURIComponent(pid)); },
  queueState() { return this.json('/queue'); },
  stats() { return this.json('/directors-table/api/stats'); },
  sysStats() { return this.json('/system_stats'); },
  free() { return fetch(this.url('/free'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unload_models: true, free_memory: true }) }); },
  // глубокая очистка: модели, кэш нод, видеопамять и возврат оперативной памяти системе
  async freeAll() { await this.free().catch(() => { }); const r = await fetch(this.url('/directors-table/api/free-all'), { method: 'POST' }).catch(() => null); return r && r.ok ? r.json() : null; },
  interrupt(pid) { return fetch(this.url('/interrupt'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt_id: pid }) }); },
  dequeue(pid) { return fetch(this.url('/queue'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delete: [pid] }) }); },
};
function errText(j) {
  if (!j || typeof j !== 'object') return '';
  const parts = [];
  if (j.error) parts.push(typeof j.error === 'string' ? j.error : (j.error.message || '') + (j.error.details ? ': ' + j.error.details : ''));
  for (const [nid, ne] of Object.entries(j.node_errors || {})) for (const e of ne.errors || []) parts.push(`Нода ${nid} (${ne.class_type}): ${e.message}${e.details ? ' — ' + e.details : ''}`);
  return parts.join('\n');
}

/* ================= библиотека workflow ================= */
const BUILTIN = [
  { id: '@cut', title: 'В монтаж', menu: ['В монтаж'], accepts: KINDS, local: true },
  { id: '@open', title: 'Развернуть', menu: ['Развернуть'], accepts: KINDS, local: true },
  { id: '@dup', title: 'Дублировать', menu: ['Ещё', 'Дублировать'], accepts: KINDS, local: true },
  { id: '@ren', title: 'Переименовать', menu: ['Ещё', 'Переименовать'], accepts: KINDS, local: true },
  { id: '@del', title: 'Удалить', menu: ['Ещё', 'Удалить'], accepts: KINDS, local: true },
];
let WFS = [];                                  // настоящие workflow
let ACTIONS = [...BUILTIN];
async function loadActions() {
  try {
    const list = await API.json('/directors-table/api/actions');
    const byIdMap = new Map();   // свой сохранённый вариант (actions/user) перекрывает встроенный с тем же id
    for (const a of list.map(cleanAction).filter(Boolean)) if (!byIdMap.has(a.id) || a.origin === 'user') byIdMap.set(a.id, a);
    WFS = [...byIdMap.values()].map(a => ({ ...a, accepts: [].concat(a.accepts || []), kind: a.output.kind || 'video' }));
  } catch (_) { WFS = []; }
  ACTIONS = [...WFS, ...BUILTIN];
  if (typeof onLibraryChanged === 'function') onLibraryChanged();
}
const wfById = id => WFS.find(a => a.id === id);
const actionById = id => ACTIONS.find(a => a.id === id);
const wfLabel = a => a ? a.title : '—';
const actionLabel = a => a ? (a.menu && a.menu.length > 1 ? a.menu[a.menu.length - 1] : a.title) : '—';

/* ---- автопоиск входов в workflow формата API ---- */
const OUTPUT_NODES = { VHS_VideoCombine: 'video', SaveVideo: 'video', SaveWEBM: 'video', 'SaveAnimatedWEBP': 'video', SaveAnimatedPNG: 'video', SaveImage: 'image', 'Image Save': 'image', PreviewImage: 'image', SaveAudio: 'audio', SaveAudioMP3: 'audio', SaveAudioOpus: 'audio', PreviewAudio: 'audio' };
const OUT_RANK = { video: 3, audio: 2, image: 1 };
function isLink(v) { return Array.isArray(v) && v.length === 2 && typeof v[0] === 'string'; }
function analyzeWorkflow(api, fileName = '') {
  if (!api || typeof api !== 'object') throw new Error('Файл не похож на workflow.');
  if (Array.isArray(api.nodes) && api.links) { const e = new Error('ui-format'); e.uiFormat = true; throw e; }
  const ids = Object.keys(api).filter(k => api[k] && api[k].class_type);
  if (!ids.length) throw new Error('В файле нет нод ComfyUI.');
  if (ids.some(k => !SAFE_ID.test(k))) throw new Error('Странные номера нод в файле — такой workflow не загружаю (возможна подделка).');
  const title = n => api[n]._meta?.title || api[n].class_type;
  // какие тексты идут в positive / negative
  const role = {};
  const walk = (start, r, depth = 0) => {
    if (!start || depth > 6 || !api[start]) return;
    const n = api[start];
    if (typeof n.inputs?.text === 'string' || typeof n.inputs?.prompt === 'string') { role[start] = role[start] || r; return; }
    const ins = n.inputs || {};
    // нода с обоими входами (например, LTXVConditioning): идём только по тому, что совпадает с ролью
    if (isLink(ins.positive) && isLink(ins.negative)) { walk((r === 'neg' ? ins.negative : ins.positive)[0], r, depth + 1); return; }
    for (const [k, v] of Object.entries(ins)) if (isLink(v) && /cond|positive|negative|conditioning|text|clip_?l?/i.test(k)) walk(v[0], r, depth + 1);
  };
  for (const id of ids) {
    const inp = api[id].inputs || {};
    if (isLink(inp.positive)) walk(inp.positive[0], 'pos');
    if (isLink(inp.negative)) walk(inp.negative[0], 'neg');
  }
  const params = [];
  let fps = 24;
  for (const id of ids) { const r = api[id].inputs?.frame_rate ?? api[id].inputs?.fps; if (typeof r === 'number') { fps = r; break; } }
  // частота кадров, заданная константой с названием «Frame Rate» / «fps»
  for (const id of ids) { const n = api[id]; if (/^Primitive(Int|Float)$|Constant$/.test(n.class_type) && /frame.?rate|fps/i.test(n._meta?.title || '') && typeof n.inputs?.value === 'number') { fps = n.inputs.value; break; } }
  let firstImage = true;
  const sizeTargets = [];
  for (const id of ids) {
    const n = api[id], ct = n.class_type, inp = n.inputs || {};
    if (ct === 'LoadImage' && typeof inp.image === 'string') {
      params.push({ id: 'img_' + id, type: firstImage ? 'card' : 'image', label: firstImage ? T('Картинка (карточка)') : title(id), on: true, targets: [{ node: id, field: 'image', transform: 'file' }], src: `${id} · ${ct}` });
      firstImage = false; continue;
    }
    if ((ct === 'LoadAudio' || ct === 'VHS_LoadAudioUpload') && typeof inp.audio === 'string') {
      params.push({ id: 'aud_' + id, type: 'audio', label: title(id) === ct ? T('Звук') : title(id), required: true, on: true, targets: [{ node: id, field: 'audio', transform: 'file' }], src: `${id} · ${ct}` }); continue;
    }
    if ((ct === 'VHS_LoadVideo' || ct === 'LoadVideo') && (typeof inp.video === 'string' || typeof inp.file === 'string')) {
      const field = typeof inp.video === 'string' ? 'video' : 'file';
      params.push({ id: 'vid_' + id, type: firstImage ? 'card' : 'video', label: T('Видео'), on: true, targets: [{ node: id, field, transform: 'file' }], src: `${id} · ${ct}` });
      firstImage = false; continue;
    }
    for (const f of ['text', 'prompt', 'tts_text', 'instruct_text', 'voice_instruct', 'lyrics', 'tags']) {
      if (typeof inp[f] === 'string' && !isLink(inp[f])) {
        const r = role[id];
        const label = r === 'neg' ? T('Негативный промпт') : r === 'pos' ? T('Промпт') : title(id);
        params.push({ id: (r === 'neg' ? 'neg_' : 'txt_') + id, type: 'text', label, default: inp[f], on: true, role: r || 'text', targets: [{ node: id, field: f }], src: `${id} · ${ct}` });
      }
    }
    for (const f of ['seed', 'noise_seed']) if (typeof inp[f] === 'number') params.push({ id: 'seed_' + id, type: 'seed', label: T('Seed (случайный)'), on: true, targets: [{ node: id, field: f }], src: `${id} · ${ct}` });
    if (typeof inp.width === 'number' && typeof inp.height === 'number') sizeTargets.push({ id, w: inp.width, h: inp.height, ct });
    if (/LTXV/i.test(ct) && typeof inp.length === 'number') params.push({ id: 'len_' + id, type: 'number', label: T('Длительность, с'), min: 1, max: 20, step: 1, default: Math.max(1, Math.round((inp.length - 1) / fps)), on: true, targets: [{ node: id, field: 'length', transform: 'frames', fps, mult: 8 }], src: `${id} · ${ct}` });
    else for (const f of ['length', 'frames', 'num_frames', 'video_frames']) if (typeof inp[f] === 'number') params.push({ id: 'frm_' + id, type: 'number', label: T('Кадров'), min: 1, max: 481, step: 1, default: inp[f], on: true, targets: [{ node: id, field: f }], src: `${id} · ${ct}` });
    if (typeof inp.steps === 'number') params.push({ id: 'steps_' + id, type: 'number', label: T('Шаги'), min: 1, max: 80, step: 1, default: inp.steps, on: false, targets: [{ node: id, field: 'steps' }], src: `${id} · ${ct}` });
    if (typeof inp.cfg === 'number') params.push({ id: 'cfg_' + id, type: 'number', label: T('CFG'), min: 0, max: 20, step: .1, default: inp.cfg, on: false, targets: [{ node: id, field: 'cfg' }], src: `${id} · ${ct}` });
    if (/^(Primitive(Int|Float|String|StringMultiline)|INTConstant|FloatConstant|StringConstant(Multiline)?)$/.test(ct) && n._meta?.title && n._meta.title !== ct && 'value' in inp && !isLink(inp.value)) {
      const isNum = typeof inp.value === 'number';
      // «Length» / «Frames» в кадрах → показываем секунды (LTX: кадров = 8n+1)
      if (isNum && Number.isInteger(inp.value) && /^(length|frames?|num.?frames|длина|кадр\S*)$/i.test(n._meta.title.trim()) && inp.value > 8) {
        params.push({ id: 'len_' + id, type: 'number', label: T('Длительность, с'), min: 1, max: 20, step: 1, default: Math.max(1, Math.round((inp.value - 1) / fps)), on: true, targets: [{ node: id, field: 'value', transform: 'frames', fps, mult: 8 }], src: `${id} · ${ct}` });
        continue;
      }
      params.push({ id: 'prim_' + id, type: isNum ? 'number' : 'text', label: n._meta.title, default: inp.value, min: 0, max: isNum ? Math.max(100, inp.value * 4) : undefined, step: ct === 'PrimitiveFloat' ? .1 : 1, on: !/^fps$|frame.?rate/i.test(n._meta.title), targets: [{ node: id, field: 'value' }], src: `${id} · ${ct}` });
    }
  }
  if (sizeTargets.length) {
    const { w, h } = sizeTargets[0];
    const area = w * h, sq = Math.round(Math.sqrt(area) / 32) * 32;
    const opts = [{ label: `${T('Как в workflow')} · ${w}×${h}`, value: [w, h] }];
    if (w !== h) opts.push({ label: `${T('Повернуть')} · ${h}×${w}`, value: [h, w] });
    opts.push({ label: `${T('Квадрат')} · ${sq}×${sq}`, value: [sq, sq] }, { label: T('По картинке (авто)'), value: 'auto' });
    params.push({ id: 'format', type: 'select', label: T('Формат'), default: 0, options: opts, on: true, targets: sizeTargets.flatMap(t => [{ node: t.id, field: 'width', transform: 'index', index: 0 }, { node: t.id, field: 'height', transform: 'index', index: 1 }]), src: sizeTargets.map(t => `${t.id} · ${t.ct}`).join(', ') });
  }
  // выход
  let out = null;
  for (const id of ids) { const k = OUTPUT_NODES[api[id].class_type]; if (k && (!out || OUT_RANK[k] > OUT_RANK[out.kind] || (OUT_RANK[k] === OUT_RANK[out.kind] && !/^Preview/.test(api[id].class_type)))) out = { node: id, kind: k }; }
  // свои ноды сохранения из сторонних пакетов (YuE, MMAudio, TTS…): ищем по имени класса, тип — по словам в имени и входам
  if (!out) {
    const guess = (ct, ins) => { const t = (ct + ' ' + Object.keys(ins || {}).join(' ')).toLowerCase(); return /audio|music|sound|wav|mp3|flac|song|voice|speech|tts|yue/.test(t) ? 'audio' : /video|mp4|gif|webm|combine|frames/.test(t) ? 'video' : /image|png|jpg|picture/.test(t) ? 'image' : null; };
    for (const id of ids) { const ct = String(api[id].class_type || ''); if (!/save|preview|export|output|write/i.test(ct)) continue; const k = guess(ct, api[id].inputs); if (k && (!out || /save|export|write/i.test(ct))) out = { node: id, kind: k }; }
  }
  if (!out) throw new Error('Не нашёл ноду сохранения результата (SaveImage, Video Combine, SaveAudio…).');
  const card = params.find(p => p.type === 'card');
  const accepts = card ? [card.targets[0].field === 'image' ? 'image' : 'video'] : (params.some(p => p.type === 'audio') ? ['audio'] : []);
  const name = (fileName || '').replace(/\.json$/i, '').replace(/[_-]+/g, ' ').trim();
  return { title: name || 'Новый workflow', menu: null, accepts, output: out, params, workflow: api };
}
async function saveWorkflow(def) {
  const clean = { ...def, params: def.params.filter(p => p.on !== false).map(({ on, src, role, ...p }) => p) };
  if (!clean.menu || !clean.menu.length) clean.menu = [{ video: 'Видео', image: 'Картинки', audio: 'Звук' }[clean.output.kind] || 'Workflow', clean.title];
  clean.workflow = JSON.parse(JSON.stringify(def.workflow));
  if (def.ui) clean.ui = def.ui;   // обычная версия с раскладкой — для показа внутри стола
  const r = await API.json('/directors-table/api/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) });
  await loadActions();
  return r.id;
}

/* ================= соединение ================= */
let ws = null, connected = false, httpOk = false, wsInfo = '', runningPid = null;
const online = () => connected || httpOk;
function connectWS() {
  try { ws = new WebSocket(API.base().replace(/^http/, 'ws') + '/ws?clientId=' + CID); } catch (e) { wsInfo = e.message; setTimeout(connectWS, 4000); return; }
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => { connected = true; wsInfo = ''; resync(); loadActions(); updateConn(); };
  ws.onclose = ev => { connected = false; wsInfo = `код ${ev.code}${ev.reason ? ', ' + ev.reason : ''}`; updateConn(); setTimeout(connectWS, 5000); };
  ws.onmessage = ev => {
    if (typeof ev.data !== 'string') return onPreview(ev.data);
    let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
    onMsg(m.type, m.data || {});
  };
}
/* понятный этап генерации по типу ноды */
function stageOf(ct) {
  if (/Sampler|Guider|Noise|Scheduler/i.test(ct)) return 'генерация';
  if (/Decode/i.test(ct)) return 'сборка кадров';
  if (/Combine|Save/i.test(ct)) return 'сохранение';
  if (/Loader|Load(?!Image|Audio)|GGUF|Lora/i.test(ct)) return 'загрузка моделей';
  if (/TextEncode|Conditioning|CLIP/i.test(ct)) return 'читаю промпт';
  if (/Audio/i.test(ct)) return 'звук';
  if (/Image|Resize|Preprocess|Latent|Mask/i.test(ct)) return 'подготовка';
  return 'обработка';
}
const jobByPid = pid => S.cards.find(c => c.promptId && c.promptId === pid);
function onMsg(type, d) {
  if (type === 'crystools.monitor') { if (typeof onCrystools === 'function') onCrystools(d); return; }
  const c = d.prompt_id ? jobByPid(d.prompt_id) : (runningPid ? jobByPid(runningPid) : null);
  if (type === 'execution_start') { runningPid = d.prompt_id; if (c) { c.status = 'running'; c.progress = 0; c.step = ''; c.started = Date.now(); jobChanged(c); } return; }
  if (!c) return;
  const wf = wfById(c.actionId);
  if (type === 'executing') {
    if (d.node === null) { finish(c); return; }
    const nd = wf?.workflow?.[d.node];
    if (c.nodeId !== d.node) {
      c.nodeId = d.node; c.step = ''; c.stepLeft = null; c.stepAvg = null; c.lastStepAt = null; c.nodeT0 = Date.now();
      // журнал шагов: какая нода сколько шла — чтобы видеть, где застряло
      c.trace = c.trace || []; const last = c.trace[c.trace.length - 1]; if (last && !last.end) last.end = Date.now();
      c.trace.push({ node: d.node, title: nd?._meta?.title || d.node, ct: nd?.class_type || '', t0: Date.now() });
      if (c.trace.length > 80) c.trace.shift();
    }
    c.stage = stageOf(nd?.class_type || '');
    c.nodeTitle = nd?._meta?.title || d.node; if (c.status !== 'running') { c.status = 'running'; c.started = c.started || Date.now(); } jobChanged(c, true);
  } else if (type === 'progress') {
    c.status = 'running'; c.progress = d.max ? d.value / d.max : 0; c.step = `${d.value}/${d.max}`;
    // время на шаг — чтобы при первом запуске (когда нет истории) хоть примерно показать остаток
    const now = Date.now(), key = (d.node || '') + '/' + d.max;
    if (c.stepKey !== key || d.value <= 1) { c.stepKey = key; c.stepT0 = now; c.stepV0 = d.value; }
    else if (d.value > c.stepV0) c.stepRate = (now - c.stepT0) / 1000 / (d.value - c.stepV0), c.stepLeft = (d.max - d.value) * c.stepRate;
    if (c.lastStepAt && d.value > 1) { const dt = (now - c.lastStepAt) / 1000; c.stepAvg = c.stepAvg ? (c.stepAvg * 0.6 + dt * 0.4) : dt; }
    c.lastStepAt = now;
    jobChanged(c, true);
  } else if (type === 'executed') {
    const f = pickFile(d.output);
    if (f && (!wf || String(d.node) === String(wf.output.node) || !c.file)) c.file = f;
  } else if (type === 'execution_success') finish(c);
  else if (type === 'execution_error') fail(c, `${d.node_type || ''} ${d.exception_message || 'Ошибка выполнения'}`.trim());
  else if (type === 'execution_interrupted') fail(c, 'Остановлено', { stopped: true });
}
function extKind(name) {
  const e = (name.split('.').pop() || '').toLowerCase();
  if (['mp4', 'webm', 'mov', 'mkv', 'gif', 'avi'].includes(e)) return 'video';
  if (['wav', 'mp3', 'flac', 'ogg', 'opus', 'm4a', 'aac'].includes(e)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'].includes(e)) return 'image';
  return null;
}
function pickFile(out) {
  if (!out) return null;
  let f = (out.gifs || out.videos || out.video || out.images || out.audio || [])[0];
  if (!f) for (const v of Object.values(out)) if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && v[0].filename) { f = v[0]; break; } // нестандартный ключ у сторонних нод
  return f && f.filename ? { filename: f.filename, subfolder: f.subfolder || '', type: f.type || 'output' } : null;
}
const closeTrace = c => { const l = c.trace?.[c.trace.length - 1]; if (l && !l.end) l.end = Date.now(); };
async function finish(c) {
  if (c.status === 'done' || c.status === 'error') return;
  closeTrace(c);
  if (runningPid === c.promptId) runningPid = null;
  const wf = wfById(c.actionId);
  let realSec = null;
  try {
    const rec = (await API.history(c.promptId))[c.promptId];
    if (rec && !c.file) c.file = pickFile(rec.outputs?.[wf?.output?.node]) || Object.values(rec.outputs || {}).map(pickFile).find(Boolean) || null;
    // точное время берём у самого ComfyUI (метки начала и конца выполнения)
    const ms = rec?.status?.messages || [], ts = n => ms.find(m => m[0] === n)?.[1]?.timestamp;
    const a = ts('execution_start'), b = ts('execution_success');
    if (a && b && b > a) realSec = (b - a) / 1000;
  } catch (_) { }
  if (!c.file) return fail(c, 'ComfyUI закончил, но файла результата нет. Проверьте ноду сохранения в workflow.');
  c.kind = extKind(c.file.filename) || c.kind;
  c.status = 'done'; c.progress = 1; c.done = Date.now();
  if (c.preview) { URL.revokeObjectURL(c.preview); c.preview = null; }
  if ((c.started || realSec) && c.units) { const t = (S.timings[c.actionId] = S.timings[c.actionId] || []); t.push({ u: c.units, s: realSec || (c.done - c.started) / 1000 }); c.took = realSec || (c.done - c.started) / 1000; if (t.length > 30) t.shift(); }
  const w = widgetOf(c);
  if (c.toCut) { const a = areasOf(c.sheet).find(x => x.montage); c.parked = false; c.owner = null; placeCard(c, a || areaForKind(c.kind, c.title, c.sheet)); }
  else if (w && S.cfg.spill !== false && typeof spillResult === 'function') spillResult(c, w); // результат сам выходит на стол рядом с виджетом
  if (typeof planJobEnded === 'function') setTimeout(() => planJobEnded(c), 0);
  if (c.chain) { const next = wfById(c.chain); if (next) setTimeout(() => dispatch([c], next, { params: { ...(c.chainParams || S.lastParams[next.id] || {}), ...(c.params?.__prompt ? { __prompt: c.params.__prompt } : {}) }, silent: true }), 50); }
  save(); jobChanged(c);
  if (c.sheet !== S.sheet) toast(`Готово в «${esc(sheetName(c.sheet))}»: <b>${esc(c.title)}</b>`);
  else if (w) flashCard(w.id);
}
function fail(c, msg, { stopped = false } = {}) {
  if (runningPid === c.promptId) runningPid = null;
  if (c.status === 'error') return;
  closeTrace(c);
  // остановка пользователем — не ошибка: без красного значка
  c.status = 'error'; c.error = msg; c.stopped = stopped; c.errSeen = stopped; save(); jobChanged(c);
  if (typeof planJobEnded === 'function') setTimeout(() => planJobEnded(c), 0);
  if (stopped) { toast(`Остановлено: <b>${esc(c.title)}</b>.`); if (typeof renderErrors === 'function') renderErrors(); }
  else toast(`Ошибка: <b>${esc(c.title)}</b>. Подробности — красный значок вверху.`);
}
function onPreview(buf) {
  if (!runningPid) return;
  const c = jobByPid(runningPid); if (!c) return;
  const dv = new DataView(buf), ev = dv.getUint32(0);
  let data;
  if (ev === 1) data = buf.slice(8);
  else if (ev === 4) { const ml = dv.getUint32(4); data = buf.slice(8 + ml); }
  else return;
  // формат определяем по самим байтам: превью бывает JPEG, PNG, WebP (в т.ч. анимированный) или GIF
  const b = new Uint8Array(data.slice(0, 12));
  const type = b[0] === 0xFF && b[1] === 0xD8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0x47 && b[1] === 0x49 ? 'image/gif' : b[8] === 0x57 && b[9] === 0x45 ? 'image/webp' : null;
  if (!type) return; // непонятный формат — лучше пустое окно, чем значок битой картинки
  const blob = new Blob([data], { type });
  if (c.preview) URL.revokeObjectURL(c.preview);
  c.preview = URL.createObjectURL(blob); jobChanged(c);
}
async function resync() {
  const pend = S.cards.filter(c => (c.status === 'queued' || c.status === 'running') && c.promptId);
  if (!pend.length) return;
  let q = null; try { q = await API.queueState(); } catch (_) { return; }
  const run = new Set((q.queue_running || []).map(x => x[1])), wait = new Set((q.queue_pending || []).map(x => x[1]));
  for (const c of pend) {
    if (run.has(c.promptId)) { runningPid = c.promptId; c.status = 'running'; continue; }
    if (wait.has(c.promptId)) { c.status = 'queued'; continue; }
    try { const h = await API.history(c.promptId); if (h[c.promptId]) { finish(c); continue; } } catch (_) { }
    fail(c, 'Задача потерялась: ComfyUI перезапускали, пока она ждала в очереди.');
  }
  jobChanged();
}
let polling = false;
async function pollJobs() {   // запасной режим без живого канала
  if (connected || !httpOk || polling) return;
  const pend = S.cards.filter(c => (c.status === 'queued' || c.status === 'running') && c.promptId);
  if (!pend.length) return;
  polling = true;
  try {
    const q = await API.queueState();
    const run = new Set((q.queue_running || []).map(x => x[1])), wait = new Set((q.queue_pending || []).map(x => x[1]));
    for (const c of pend) {
      if (run.has(c.promptId)) { if (c.status !== 'running') { c.status = 'running'; c.started = Date.now(); c.nodeTitle = 'генерация'; jobChanged(c); } continue; }
      if (wait.has(c.promptId)) continue;
      const rec = (await API.history(c.promptId).catch(() => ({})))[c.promptId];
      if (!rec) continue;
      const err = (rec.status?.messages || []).find(m => m[0] === 'execution_error');
      if (err) fail(c, `${err[1].node_type || ''} ${err[1].exception_message || 'Ошибка выполнения'}`.trim()); else finish(c);
    }
  } catch (_) { }
  polling = false;
}
setInterval(pollJobs, 1500);

/* ================= запуск workflow ================= */
function setTarget(prompt, t, v, ctx) {
  const node = prompt[t.node];
  if (!node) throw new Error(`В workflow нет ноды ${t.node}`);
  let val = v;
  if (t.transform === 'file') {
    const f = ctx.fileOf(v); if (!f) throw new Error('Не найден файл для входа «' + t.field + '». Выберите его в параметрах.');
    val = (f.subfolder ? f.subfolder + '/' : '') + f.filename + (f.type === 'output' ? ' [output]' : f.type === 'temp' ? ' [temp]' : '');
  } else if (t.transform === 'frames') { const fps = t.fps || 24, m = t.mult || 8; val = Math.round((Number(v) * fps) / m) * m + 1; }
  else if (t.transform === 'index') val = v[t.index];
  node.inputs[t.field] = val;
}
function paramDefaults(wf, extra = {}) {
  const last = S.lastParams[wf.id] || {};
  const out = {};
  for (const p of wf.params || []) { if (p.type === 'card' || p.type === 'seed') continue; out[p.id] = last[p.id] !== undefined ? last[p.id] : p.default; }
  return { ...out, ...extra };
}
function promptParam(wf) { return (wf.params || []).find(p => p.type === 'text' && p.role !== 'neg' && !/neg/i.test(p.id)) || (wf.params || []).find(p => p.type === 'text'); }
function missingParams(wf, vals) {
  return (wf.params || []).filter(p => p.required && p.type !== 'card' && (vals[p.id] === undefined || vals[p.id] === null || vals[p.id] === '' || (['audio', 'image', 'video'].includes(p.type) && !byId(vals[p.id])?.file)));
}
function autoSize(card, base) {
  const r = card && card.w && card.h ? card.w / card.h : null;
  if (!r) return base;
  const area = base[0] * base[1];
  let w = Math.sqrt(area * r), h = w / r;
  w = Math.max(256, Math.round(w / 32) * 32); h = Math.max(256, Math.round(h / 32) * 32);
  return [w, h];
}
function estimate(wf, units) {
  const t = S.timings[wf.id];
  if (!t || !t.length || !units) return null;
  const rates = t.map(x => x.s / x.u).sort((a, b) => a - b);
  const est = rates[Math.floor(rates.length / 2)] * units;
  return est > 4 * 3600 ? null : est; // больше 4 часов — оценка явно сбилась (первый запуск с загрузкой моделей и т. п.)
}
function unitsOf(wf, vals, card) {
  let w = 1024, h = 1024, frames = 1;
  const fp = (wf.params || []).find(p => p.type === 'select' && p.id === 'format');
  if (fp) { const v = (fp.options[Number(vals.format) || 0] || fp.options[0]).value; [w, h] = v === 'auto' ? autoSize(card, fp.options[0].value) : v; }
  const lp = (wf.params || []).find(p => p.targets?.some(t => t.transform === 'frames'));
  if (lp) frames = Number(vals[lp.id] || lp.default || 1) * (lp.targets.find(t => t.transform === 'frames').fps || 24);
  return (w * h * frames) / 1e6;
}
const fmtSec = s => s == null || s > 4 * 3600 ? '' : s < 90 ? `≈${Math.round(s)} ${T('с')}` : `≈${Math.round(s / 60)} ${T('мин')}`; // больше 4 часов — оценка явно сбилась, не показываем
async function runJob(src, wf, vals, opts = {}) {
  if (!online()) { toast('ComfyUI не отвечает. Запустите его и обновите страницу.'); return null; }
  const prompt = JSON.parse(JSON.stringify(wf.workflow));
  const ctx = { fileOf: v => (v === '@card' ? src?.file : byId(v)?.file) };
  try {
    for (const p of wf.params || []) {
      let v = p.type === 'card' ? '@card' : vals[p.id];
      if (p.type === 'card' && !src) throw new Error('Этому workflow нужен входной файл: перетащите его на виджет.');
      if (p.type === 'seed') v = Math.floor(Math.random() * Math.min(2 ** 47, p.max || 2 ** 47));
      if (p.type === 'select') { v = (p.options[Number(v) || 0] || p.options[0]).value; if (v === 'auto') v = autoSize(src, p.options[0].value); }
      if (p.type === 'number') v = Number(v);
      for (const t of p.targets || []) setTarget(prompt, t, v, ctx);
    }
  } catch (e) { toast(esc(e.message)); return null; }
  S.lastParams[wf.id] = { ...vals };
  S.lastRun = S.lastRun || {}; S.lastRun[wf.id] = prompt; // что реально ушло в ComfyUI — покажем во вкладке workflow
  if (typeof syncTabToRun === 'function') setTimeout(() => syncTabToRun(wf.id), 0);
  const widget = ensureWidget(wf, src ? src.sheet : S.sheet, src);
  if (src) { widget.lastInput = src.id; if (widget.unlinked) widget.unlinked = widget.unlinked.filter(x => x !== src.id); }
  const units = unitsOf(wf, vals, src);
  const pp = promptParam(wf);
  const job = {
    id: S.nextId++, type: 'file', sheet: widget.sheet, kind: wf.output.kind || 'video', title: (pp && vals[pp.id] ? String(vals[pp.id]).slice(0, 40) : wf.title),
    from: src ? src.title : null, parent: src ? src.id : null, owner: widget.id, parked: true, actionId: wf.id, params: { ...vals }, presets: opts.presets ? [...opts.presets] : undefined,
    status: 'queued', progress: 0, created: Date.now(), units, est: estimate(wf, units), ...opts,
  };
  S.cards.push(job); jobChanged(job);
  try { const r = await API.queue(prompt); job.promptId = r.prompt_id; }
  catch (e) { job.status = 'error'; job.error = e.message || String(e); job.errSeen = false; toast('ComfyUI не принял задачу. Подробности — красный значок вверху.'); }
  save(); jobChanged(job);
  return job;
}
async function cancelJob(c) {
  if (!c.promptId) return;
  if (c.status === 'running') await API.interrupt(c.promptId).catch(() => { });
  else await API.dequeue(c.promptId).catch(() => { });
  fail(c, 'Остановлено', { stopped: true });
}
