/* Director's Table — новые фишки:
   живое превью, MIDI-клавиатура, фильм по сценарию, сборка монтажа в mp4, «Поделиться»,
   знакомство при первом запуске, режим для слабых видеокарт. Подключается после extras.js. */
'use strict';
const jpost = async (path, body) => {
  const r = await fetch(API.url(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
};
const fileRef = c => c && c.file ? { ...c.file, kind: c.kind } : null;
/* новая карточка-файл на столе (результат склейки, кадр, ролик) */
function addFileCard(file, kind, title, { area, near } = {}) {
  const c = { id: S.nextId++, type: 'file', sheet: S.sheet, kind, title, file, status: 'ready', created: Date.now(), done: Date.now(), parked: false };
  S.cards.push(c);
  if (near) { const w = { ...near }; if (typeof spillResult === 'function' && near.type === 'widget') spillResult(c, w); else placeCard(c, area || areaForKind(kind, title)); }
  else placeCard(c, area || areaForKind(kind, title));
  save(); render([c.id]); flashCard(c.id);
  return c;
}

/* ================= живое превью ================= */
let previewAsked = false, PREVIEW_INFO = null;
async function enablePreview() {
  if (S.cfg.preview === 'off') return;
  try { PREVIEW_INFO = await jpost('/directors-table/api/preview-method', { method: S.cfg.preview || 'auto' }); } catch (_) { }
}
setInterval(() => { if (!previewAsked && online()) { previewAsked = true; enablePreview(); checkLtxPreviewNode(); } }, 1500);
// У LTX-2 своё превью ComfyUI пока не показывает. Если стоит KJNodes, на время запуска вставляем их ноду
// «LTX2 Sampling Preview Override» между моделью и сэмплером. Не принял ComfyUI — отправляем как было.
let LTX_PREVIEW_NODE = false, TAELTX = null;
async function checkLtxPreviewNode() {
  try { const j = await API.json('/object_info/LTX2SamplingPreviewOverride'); LTX_PREVIEW_NODE = !!j.LTX2SamplingPreviewOverride; } catch (_) { }
  // маленький декодер taeltx (лежит в models/vae) — с ним превью чёткое и цветное, без него — грубые цветные пятна
  try { const j = await API.json('/object_info/VAELoader'); const list = j.VAELoader?.input?.required?.vae_name?.[0] || []; const t = list.filter(n => /taeltx/i.test(n)); TAELTX = t.find(n => /2[._]?3/.test(n)) || t[0] || null; } catch (_) { }
}
function withLtxPreview(prompt) {
  if (!LTX_PREVIEW_NODE || S.cfg.preview === 'off') return prompt;
  const ids = Object.keys(prompt);
  if (!ids.some(k => /^LTXV|LTXAV/.test(prompt[k]?.class_type || ''))) return prompt;
  if (ids.some(k => prompt[k]?.class_type === 'LTX2SamplingPreviewOverride')) return prompt;
  const p = JSON.parse(JSON.stringify(prompt)), made = new Map();
  let n = 0;
  for (const k of ids) {
    const nd = p[k], m = nd?.inputs?.model;
    if (!/Guider|Sampler/i.test(nd?.class_type || '') || !isLink(m)) continue;
    const key = m.join(':');
    if (!made.has(key)) {
      const nid = 'dtprev' + (++n), inputs = { model: m, preview_rate: 8 };
      if (TAELTX) { if (!p.dttae) p.dttae = { class_type: 'VAELoader', inputs: { vae_name: TAELTX }, _meta: { title: 'taeltx (preview)' } }; inputs.vae = ['dttae', 0]; }
      p[nid] = { class_type: 'LTX2SamplingPreviewOverride', inputs, _meta: { title: 'Live preview (Director\'s Table)' } }; made.set(key, nid);
    }
    nd.inputs.model = [made.get(key), 0];
  }
  return n ? p : prompt;
}
const _queue = API.queue.bind(API);
const PREV_BY_PID = new Map(); // prompt_id → состояние живого превью для LTX (показываем на виджете)
const isLtxPrompt = p => Object.values(p || {}).some(n => /^LTXV|LTXAV/.test(n?.class_type || ''));
API.queue = async prompt => {
  const ltx = isLtxPrompt(prompt) && S.cfg.preview !== 'off';
  const mark = (r, st) => { if (ltx && r?.prompt_id) PREV_BY_PID.set(r.prompt_id, st); return r; };
  const p2 = withLtxPreview(prompt);
  if (p2 === prompt) return mark(await _queue(prompt), LTX_PREVIEW_NODE ? 'nolink' : 'nonode');
  try { return mark(await _queue(p2), TAELTX ? 'on' : 'notae'); }
  catch (_) { LTX_PREVIEW_NODE = false; return mark(await _queue(prompt), 'rejected'); }
};
const PREV_TXT = { on: ['превью: ждём кадры…', 'Стол подключил живое превью KJNodes. Первые кадры появятся через несколько шагов сэмплера.'], notae: ['превью грубое', 'Нет маленького декодера taeltx в models/vae — превью будет цветными пятнами.'], nonode: ['превью: нет узла KJNodes', 'Для живого превью LTX обновите ComfyUI-KJNodes (нужен узел «LTX2 Sampling Preview Override») и перезапустите ComfyUI.'], rejected: ['превью: ComfyUI отказал', 'ComfyUI не принял workflow с узлом превью, поэтому запуск пошёл без него. Обновите ComfyUI-KJNodes; подробности — в консоли ComfyUI.'], nolink: ['превью: не к чему подключить', 'В этом workflow не нашлось сэмплера с входом model — узел превью некуда вставить.'] };
{ const _wh = widgetHTML; widgetHTML = function (w) {
  const r = _wh(w), run = jobsOf(w).find(c => c.status === 'running');
  const st = run && PREV_BY_PID.get(run.promptId);
  if (st && !(run.preview && st === 'on')) { const [t, tip] = PREV_TXT[st] || []; if (t) r.html = r.html.replace('<div class="wf">', `<div class="prevst ${st}" title="${esc(tip)}">${esc(t)}</div><div class="wf">`); }
  return r;
}; }
/* ================= слабые видеокарты ================= */
function vramGB() {
  const t = lastStats?.gpu?.vram_total;
  return t ? t / 2 ** 30 : null;
}
// 'weak' — до 8 ГБ: короткие черновики по умолчанию; 'mid' — до 12 ГБ: выгружать модели между разными задачами
function lowVramLevel() {
  const m = S.cfg.lowVram || 'auto';
  if (m === 'off') return null;
  if (m === 'on') return 'weak';
  const v = vramGB(); if (!v) return null;
  return v <= 8.5 ? 'weak' : v <= 12.5 ? 'mid' : null;
}
const _paramDefaults = paramDefaults;
paramDefaults = function (wf, extra = {}) {
  const out = _paramDefaults(wf, extra);
  if (lowVramLevel() === 'weak' && !S.lastParams[wf.id]) {
    // первый запуск на слабой карте — сразу лёгкий вариант, чтобы не упасть по памяти
    const fp = (wf.params || []).find(p => p.id === 'format' && p.type === 'select');
    if (fp && extra.format === undefined) { const i = fp.options.findIndex(o => /черновик|draft|768|512/i.test(o.label)); if (i >= 0) out.format = i; }
    const lp = (wf.params || []).find(p => p.targets?.some(t => t.transform === 'frames'));
    if (lp && extra[lp.id] === undefined && Number(out[lp.id]) > 4) out[lp.id] = 4;
  }
  return out;
};
function lowVramNote(wf) {
  const lv = lowVramLevel(); if (!lv) return '';
  const v = vramGB();
  return `<div class="lowvram">🪫 ${lv === 'weak' ? 'Слабая видеокарта' : 'Видеокарта среднего уровня'}${v ? ` (${v.toFixed(0)} ГБ)` : ''}: ${lv === 'weak' ? 'для первого запуска выбран лёгкий формат и короткий ролик. Получилось — увеличивайте.' : 'между задачами разных моделей стол сам выгружает память.'} <a href="#" data-lowvram>Настроить</a></div>`;
}
document.addEventListener('click', e => { if (e.target.closest('[data-lowvram]')) { e.preventDefault(); closeSheet(); $('#btnSettings').click(); } });

/* подготовка задачи плана перед отправкой в ComfyUI */
let lastPlanWf = null;
async function planPrep(it, wf, src) {
  // 1) связка шотов: последний кадр прошлого шота = первый кадр этого
  if (it.chainPrev) {
    const prev = S.plan.find(x => x.id === it.chainPrev), pj = prev && byId(prev.jobId);
    if (pj && pj.status === 'done' && pj.kind === 'video') { const fr = await lastFrameCard(pj, false).catch(() => null); if (fr) { src = fr; it.src = fr.id; } }
  }
  if (!src && it.fallback) src = byId(it.fallback) || null; // прошлый шот не вышел — начинаем с исходного кадра
  // 2) улучшение промпта локальной моделью (по одному кадру — слабой модели так проще)
  if (it.enhance && !it.enhanced) {
    const pp = promptParam(wf);
    if (pp) {
      toast(`✨ Пишу промпт для кадра ${(it.opts?.shot ?? 0) + 1}…`);
      try { const j = await enhancePrompt(wf, it.raw || it.vals[pp.id] || '', src ? src.kind + ' (first frame of the shot)' : 'none'); if (j.text) { it.vals[pp.id] = j.text; it.promptEn = j.text; } }
      catch (e) { if (!it.enhanceWarned) toast('✨ Помощник недоступен — снимаю по тексту сценария. ' + esc(e.message)); }
    }
    it.enhanced = true; save();
  }
  // 3) разные модели подряд на 8–12 ГБ — освобождаем память, чтобы не упасть
  if (lowVramLevel() && lastPlanWf && lastPlanWf !== wf.id) { await API.free().catch(() => { }); }
  lastPlanWf = wf.id;
  return src;
}

/* ================= видео: последний кадр ================= */
async function lastFrameCard(c, show) {
  if (!c?.file) return null;
  try {
    const f = await jpost('/directors-table/api/last-frame', { file: c.file });
    const area = areaForKind('image', '', c.sheet);
    const n = { id: S.nextId++, type: 'file', sheet: c.sheet, kind: 'image', title: 'кадр из «' + String(c.title).slice(0, 24) + '»', file: f, status: 'ready', created: Date.now(), parked: false, from: c.title };
    S.cards.push(n); placeCard(n, area); save();
    if (c.sheet === S.sheet) { render([n.id]); if (show) flashCard(n.id); }
    if (show) toast('Последний кадр — в «Картинках». Бросьте его на виджет, чтобы продолжить сцену.');
    return n;
  } catch (e) { if (show) toast('Не получилось достать кадр: ' + esc(e.message)); return null; }
}

/* ================= монтаж → один mp4 ================= */
async function exportMontage(items, music, title = 'Ролик') {
  const clips = items.filter(c => c && c.file && c.kind !== 'audio').map(c => ({ file: c.file, kind: c.kind, dur: c.kind === 'image' ? 2.5 : c.dur || null }));
  if (!clips.length) { toast('Нечего склеивать: положите клипы в «Монтаж».'); return null; }
  toast(`⬇ Склеиваю ${clips.length} клип. — это делает ComfyUI, пара минут…`);
  try {
    const f = await jpost('/directors-table/api/montage-export', { clips, music: music?.file || null });
    const c = addFileCard(f, 'video', '🎬 ' + title, { area: areaForKind('video') });
    toast(`Готово: <b>${esc(c.title)}</b> — в зоне «Видео» и в папке output/directors-table.`, { label: 'Смотреть', fn: () => openDetails(c) });
    return c;
  } catch (e) { toast('Склейка не удалась: ' + esc(e.message)); return null; }
}
$('#cutExport') && ($('#cutExport').onclick = () => { const list = cutCards(); exportMontage(list.filter(c => c.kind !== 'audio'), list.find(c => c.kind === 'audio'), 'Монтаж ' + sheetName(S.sheet)); });

/* ================= «Поделиться»: было → черновик → стало ================= */
function shareSheet(c) {
  const parent = byId(c.parent);
  const wf = wfById(c.actionId);
  const isVfx = wf && Object.values(wf.workflow || {}).some(n => n.class_type === 'DTVFXGuide');
  const p = c.params || {};
  const ptParam = wf?.params?.find(x => x.type === 'point');
  const effP = wf?.params?.find(x => x.id === 'effect');
  const effect = effP ? (effP.options[Number(p.effect) || 0] || effP.options[0]).value : null;
  const pt = ptParam ? (p[ptParam.id] || ptParam.default || [.5, .5]) : [.5, .5];
  const text = `Made locally with Director's Table on top of ComfyUI${isVfx ? ' — code draws the VFX draft, LTX-2 makes it real' : ''}. Open weights only. #ComfyUI #LTX2 #OpenSourceHiggsfield`;
  sheetOpen(`<h3>Поделиться</h3><div class="sub">Стол соберёт вертикальный ролик 9:16: ${parent?.kind === 'image' ? '«было» (исходный кадр) → ' : ''}${isVfx && parent ? 'черновик эффекта от кода → ' : ''}результат LTX. С подписями и пометкой Director's Table.</div>
    <div class="field"><label for="shTxt">Текст поста</label><textarea id="shTxt">${esc(text)}</textarea></div>
    <div class="share-out" id="shOut"></div>
    <div class="acts"><button type="button" class="btn ghost" data-close>Закрыть</button><button type="button" class="btn primary" data-shgo>Собрать ролик</button></div>`, null, {
    onClick: async e => {
      if (e.target.closest('[data-shx]')) { window.open('https://x.com/intent/post?text=' + encodeURIComponent($('#shTxt').value), '_blank', 'noopener'); toast('В X прикрепите собранный ролик вручную — сайт не даёт загрузить видео за вас.'); }
      const go = e.target.closest('[data-shgo]'); if (!go) return;
      go.disabled = true; go.textContent = 'Собираю…';
      try {
        const body = { after: fileRef(c), after_title: isVfx ? 'LTX-2 RESULT' : (wf?.title ? 'RESULT' : 'RESULT') };
        if (parent?.file) body.before = fileRef(parent);
        if (isVfx && parent?.kind === 'image') body.vfx = { effect: effect || 'portal', cx: pt[0], cy: pt[1], size: Number(p.size) || .35, intensity: Number(p.intensity) || 1 };
        const f = await jpost('/directors-table/api/share', body);
        const url = API.view(f);
        $('#shOut').innerHTML = `<video src="${esc(url)}" controls autoplay muted playsinline></video>
          <div class="share-acts"><a class="btn primary" href="${esc(url)}" download="${esc(f.filename)}">⬇ Скачать mp4</a></div>
          <div class="share-hint">Сначала скачайте ролик, потом откройте соцсеть и прикрепите его. Текст поста уже скопирован.</div>
          <div class="share-net">${[['X', '#e7e7e7', '#000', 'X', 'https://x.com/intent/post?text=' + encodeURIComponent($('#shTxt').value)], ['YouTube Shorts', '#ff0033', '#fff', '▶', 'https://www.youtube.com/upload'], ['TikTok', '#25f4ee', '#000', '♪', 'https://www.tiktok.com/upload'], ['Instagram', '#e1306c', '#fff', '◎', 'https://www.instagram.com/'], ['Facebook', '#1877f2', '#fff', 'f', 'https://www.facebook.com/'], ['Telegram', '#29a9eb', '#fff', '➤', 'https://t.me/share/url?url=' + encodeURIComponent($('#shTxt').value)]].map(([n, bg, fg, g, u]) => `<a class="snet" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><i style="background:${bg};color:${fg}">${g}</i>${n}</a>`).join('')}</div>`;
        try { await navigator.clipboard.writeText($('#shTxt').value); } catch (_) { }
        addFileCard(f, 'video', '📣 ' + String(c.title).slice(0, 30), { area: areaForKind('video') });
        go.textContent = 'Собрать заново'; go.disabled = false;
      } catch (err) { toast('Не получилось: ' + esc(err.message)); go.disabled = false; go.textContent = 'Собрать ролик'; }
    }
  });
}

/* ================= MIDI-клавиатура ================= */
// клавиши MIDI нажимают те же клавиши стола: белые ноты от «до» — 1…0, чёрные — Q…U, дальше — ряды A–L и Z–M
const MIDI = { access: null, count: 0 };
const W_OFF = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16], B_OFF = [1, 3, 6, 8, 10, 13, 15], R1_OFF = [17, 19, 21, 23, 24, 26, 28, 29, 31], R2_OFF = [33, 35, 36, 38, 40, 41, 43];
function midiCode(note) {
  let o = note - 60; while (o < 0) o += 12;
  let i;
  if ((i = W_OFF.indexOf(o)) >= 0) return WHITE[i];
  if ((i = B_OFF.indexOf(o)) >= 0) return BLACK[i].code;
  if ((i = R1_OFF.indexOf(o)) >= 0) return ROWS[1][i];
  if ((i = R2_OFF.indexOf(o)) >= 0) return ROWS[2][i];
  return null;
}
function onMidi(ev) {
  const [st, note, vel] = ev.data || [];
  if ((st & 0xf0) !== 0x90 || !vel || S.cfg.midi === false) return;
  const code = midiCode(note); if (!code) return;
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: '', bubbles: true }));
  const el = piano.querySelector(`[data-code="${code}"], [data-bind="${code}"], [data-key="${code}"]`);
  if (el) el.animate([{ transform: 'translateY(3px)', filter: 'brightness(1.4)' }, { transform: 'none', filter: 'none' }], { duration: 220 });
}
async function midiInit(manual) {
  if (!navigator.requestMIDIAccess) { if (manual) toast('Этот браузер не умеет MIDI. Откройте стол в Chrome или Edge.'); return; }
  try { MIDI.access = await navigator.requestMIDIAccess(); }
  catch (_) { if (manual) toast('Браузер не дал доступ к MIDI. Разрешите его в адресной строке (значок замка).'); return; }
  S.cfg.midiAsked = true; save();
  const bind = () => { let n = 0; for (const inp of MIDI.access.inputs.values()) { inp.onmidimessage = onMidi; n++; } MIDI.count = n; return n; };
  MIDI.access.onstatechange = e => { bind(); if (e.port.type === 'input' && e.port.state === 'connected') toast(`🎹 MIDI: <b>${esc(e.port.name)}</b> — играйте: белые ноты от «до» = клавиши 1…0, чёрные = Q…U.`); };
  const n = bind();
  if (manual) toast(n ? `🎹 Подключено MIDI-устройств: <b>${n}</b>. Нота «до» — клавиша 1, ре — 2…, диезы — Q…U.` : '🎹 MIDI включён, но клавиатура не найдена. Подключите её — стол подхватит сам.');
}
if (S.cfg.midiAsked && S.cfg.midi !== false) setTimeout(() => midiInit(false), 1200);

/* ================= сценарий → кадры → фильм ================= */
function parseShots(text) {
  let lines = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length === 1) lines = lines[0].split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean);
  return lines.map(l => {
    l = l.replace(/^\s*(?:кадр|шот|shot|scene|сцена|plano|escena|szene|cena|plan|план)?\s*\d+\s*[:.)·\-–—]\s*/i, '');
    let sec = null;
    const m = l.match(/[([]?\s*(\d{1,2})\s*(?:с|сек|s|sec|seconds?|секунд\S*)\s*[)\]]?\s*$/i);
    if (m) { sec = +m[1]; l = l.slice(0, m.index).trim().replace(/[,.;]$/, ''); }
    return l ? { text: l, seconds: sec } : null;
  }).filter(Boolean).slice(0, 24);
}
const shotsToText = shots => shots.map((s, i) => `${i + 1} · ` + s.text + (s.seconds ? ` (${s.seconds} с)` : '')).join('\n');
let splitCtl = null, splitT0 = 0, splitTick = null;
function splitBusy(on) {
  const btn = $('.zone-panel[data-panel="script"] [data-sp="split"]'), n = $('#scriptN');
  clearInterval(splitTick);
  if (btn) { btn.classList.toggle('busy', on); btn.textContent = on ? '■' : '✨'; btn.title = on ? 'Отменить разбивку' : 'Свободный текст → кадры (локальная модель; без неё — по предложениям)'; }
  if (on) { const upd = () => { const n2 = $('#scriptN'); if (n2) n2.innerHTML = `<span class="split-wait">✨ Разбиваю на кадры… ${Math.round((Date.now() - splitT0) / 1000)} с <small>(обычно до минуты)</small></span>`; }; upd(); splitTick = setInterval(upd, 1000); }
  else if (n) { const ta = $('#scriptTa'); ta && ta.oninput && ta.oninput(); }
}
async function splitScript(ta) {
  if (splitCtl) { splitCtl.abort(); splitCtl = null; splitBusy(false); toast('Разбивка отменена.'); return; }
  const text = ta.value.trim();
  if (!text) { toast('Напишите или надиктуйте идею ролика — на любом языке. ✨ разобьёт её на кадры.'); ta.focus(); return; }
  const ctl = splitCtl = new AbortController(); splitT0 = Date.now(); splitBusy(true);
  const apply = (shots, msg) => { if (splitCtl !== ctl) return; splitCtl = null; splitBusy(false); const t = $('#scriptTa') || ta; t.value = shotsToText(shots); t.oninput && t.oninput(); toast(msg); };
  try {
    const r = await fetch('/directors-table/api/llm/script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ text, url: S.cfg.llmUrl, model: S.cfg.llmModel, cpu: S.cards.some(c => c.status === 'running') }) });
    const j = await r.json();
    if (!j.shots?.length) { if (splitCtl === ctl) { splitCtl = null; splitBusy(false); } return toast('Не получилось разобрать текст.'); }
    if (j.shots.length === 1 && text.split(/\s+/).length > 22) { const sm = smartSplit(text); if (sm.length > 1) { j.shots = sm; j.source = 'rules'; } }
    apply(j.shots, j.source === 'llm' ? `Готово: <b>${j.shots.length}</b> кадр. (модель ${esc(j.model || '')}). Поправьте, если надо, и жмите 🎬 Снять.` : `Разбил по предложениям: <b>${j.shots.length}</b> кадр. (локальный помощник не ответил).`);
  } catch (e) { if (e.name === 'AbortError') return; apply(parseShots(text), 'Разбил по предложениям — помощник недоступен.'); }
}
const filmForm = { wf: '', start: '', chain: true, enhance: true, cut: true, exportEnd: true, seconds: 4, format: '' };
function filmSources() {
  const imgs = visibleCards().filter(c => c.type === 'file' && c.kind === 'image' && isReady(c));
  const selImg = [...sel].map(byId).find(c => c && c.kind === 'image' && isReady(c));
  return { imgs, selImg };
}
/* длинная диктовка без точек: режем по «потом / затем / then», а если их нет — примерно по 18 слов */
function smartSplit(text) {
  let parts = String(text).split(/(?:[,;]\s*)?\b(?:and then|then|after that|потом|затем|после этого|а потом|и тут|далі|потім)\b/i).map(s => s.trim()).filter(s => s.split(/\s+/).length > 2);
  if (parts.length < 2) { const w = String(text).split(/\s+/); parts = []; for (let i = 0; i < w.length; i += 18) parts.push(w.slice(i, i + 18).join(' ')); }
  parts = parts.flatMap(t => { const w = t.split(/\s+/); if (w.length <= 22) return [t]; const out = []; const k = Math.ceil(w.length / Math.ceil(w.length / 16)); for (let i = 0; i < w.length; i += k) out.push(w.slice(i, i + k).join(' ')); return out; });
  return parts.slice(0, 12).map(t => ({ text: t.replace(/^[\s,.;—-]+|[\s,;—-]+$/g, ''), seconds: null }));
}
function filmSheet() {
  const taNow = $('#scriptTa'); if (taNow) { S.scripts[S.sheet] = taNow.value; save(); } // берём то, что сейчас в поле
  const shots = parseShots(S.scripts[S.sheet] || '');
  if (!shots.length) { toast('Сначала напишите сценарий в зоне «Сценарий»: по строке на кадр. Или одним абзацем — и нажмите ✨.'); $('#scriptTa')?.focus(); return; }
  const vids = WFS.filter(w => w.kind === 'video' && !Object.values(w.workflow || {}).some(n => n.class_type === 'DTVFXGuide') && !(w.params || []).some(p => p.type === 'audio' && p.required) && !(w.params || []).some(p => p.type === 'image' && p.required));
  if (!vids.length) { toast('Нужен видео-workflow (картинка или текст → видео). Добавьте свой: «Инструменты» → «Мои workflow из ComfyUI».'); return; }
  if (!vids.find(w => w.id === filmForm.wf)) filmForm.wf = (vids.find(w => w.origin === 'user' && w.accepts.includes('image')) || vids.find(w => w.accepts.includes('image')) || vids[0]).id;
  const { imgs, selImg } = filmSources();
  if (!filmForm.start || !byId(+filmForm.start)) filmForm.start = selImg ? String(selImg.id) : imgs[0] ? String(imgs[0].id) : '';
  const draw = () => {
    const wf = wfById(filmForm.wf), needsCard = (wf.params || []).some(p => p.type === 'card');
    const lp = (wf.params || []).find(p => p.targets?.some(t => t.transform === 'frames'));
    const fp = (wf.params || []).find(p => p.id === 'format' && p.type === 'select');
    const units = shots.reduce((s, sh) => s + unitsOf(wf, { ...paramDefaults(wf), ...(lp ? { [lp.id]: sh.seconds || filmForm.seconds } : {}), ...(fp && filmForm.format !== '' ? { format: +filmForm.format } : {}) }, byId(+filmForm.start)), 0);
    const est = estimate(wf, units);
    const block = needsCard && !filmForm.start;
    sheetOpen(`<h3>🎬 Фильм по сценарию</h3><div class="sub">${shots.length} кадр. · стол снимет их по очереди${filmForm.chain ? ', каждый следующий начнётся с последнего кадра предыдущего (герой не меняется)' : ''}${filmForm.cut ? ', разложит в «Монтаж»' : ''}${filmForm.exportEnd ? ' и склеит в один ролик' : ''}.</div>
      <ol class="film-shots">${shots.map((s, i) => `<li><b>${i + 1}</b><span data-noi18n>${esc(s.text)}</span><em>${s.seconds || filmForm.seconds} с</em></li>`).join('')}</ol>
      <div class="field"><label for="fWf">Чем снимать</label><select id="fWf">${vids.map(w => `<option value="${esc(w.id)}" ${w.id === filmForm.wf ? 'selected' : ''}>${esc(w.title)}</option>`).join('')}</select></div>
      ${needsCard ? `<div class="field"><label for="fStart">Первый кадр</label><select id="fStart"><option value="">— нет —</option>${imgs.map(c => `<option value="${c.id}" ${String(c.id) === filmForm.start ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>${block ? '<span class="hint" style="color:var(--warn)">Этому workflow нужен первый кадр: положите картинку в «Картинки» или выделите её.</span>' : ''}</div>` : ''}
      ${lp ? `<div class="field"><label for="fSec">Длительность кадра без пометки, с</label><div class="row2"><input type="range" id="fSec" min="2" max="10" value="${filmForm.seconds}"><output>${filmForm.seconds}</output></div><span class="hint">Своё время можно дописать в строку: «… (6 с)».</span></div>` : ''}
      ${fp ? `<div class="field"><label for="fFmt">Формат</label><select id="fFmt"><option value="">Как в параметрах виджета</option>${fp.options.map((o, i) => `<option value="${i}" ${String(filmForm.format) === String(i) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>` : ''}
      <label class="field inline"><input type="checkbox" id="fChain" ${filmForm.chain ? 'checked' : ''} ${needsCard ? '' : 'disabled'}> Связать кадры: конец одного = начало следующего</label>
      <label class="field inline"><input type="checkbox" id="fEnh" ${filmForm.enhance ? 'checked' : ''}> ✨ Перед каждым кадром локальная модель пишет промпт под модель (можно писать на любом языке)</label>
      <label class="field inline"><input type="checkbox" id="fCut" ${filmForm.cut ? 'checked' : ''}> Готовые кадры класть в «Монтаж»</label>
      <label class="field inline"><input type="checkbox" id="fExp" ${filmForm.exportEnd ? 'checked' : ''}> В конце склеить всё в один mp4 (с музыкой из «Монтажа», если она там есть)</label>
      <div class="acts"><span class="est">${est ? 'по опыту этого ПК: ' + fmtSec(est) : ''}</span><button type="button" class="btn ghost" data-close>Отмена</button><button type="button" class="btn" data-fplan ${block ? 'disabled' : ''}>Только в план</button><button type="button" class="btn primary" data-fgo ${block ? 'disabled' : ''}>🎬 Снять</button></div>`, null, {
      wide: true,
      onClick: e => { if (e.target.closest('[data-fgo]')) { closeSheet(); queueFilm(shots, true); } else if (e.target.closest('[data-fplan]')) { closeSheet(); queueFilm(shots, false); } },
    });
    sheet.onchange = e => {
      const id = e.target.id;
      if (id === 'fWf') filmForm.wf = e.target.value; else if (id === 'fStart') filmForm.start = e.target.value; else if (id === 'fSec') filmForm.seconds = +e.target.value; else if (id === 'fFmt') filmForm.format = e.target.value;
      else if (id === 'fChain') filmForm.chain = e.target.checked; else if (id === 'fEnh') filmForm.enhance = e.target.checked; else if (id === 'fCut') filmForm.cut = e.target.checked; else if (id === 'fExp') filmForm.exportEnd = e.target.checked;
      draw();
    };
  };
  draw();
}
function queueFilm(shots, start) {
  const wf = wfById(filmForm.wf); if (!wf) return;
  const pp = promptParam(wf), lp = (wf.params || []).find(p => p.targets?.some(t => t.transform === 'frames'));
  const needsCard = (wf.params || []).some(p => p.type === 'card');
  // повторное «Снять» не плодит дубли: прошлые ждущие кадры этой сцены заменяются новыми
  const old = S.plan.filter(x => x.status === 'wait' && x.opts?.film && S.films?.[x.opts.film]?.sheet === S.sheet);
  if (old.length) { S.plan = S.plan.filter(x => !old.includes(x)); toast(`Заменил прошлый фильм в плане (${old.length} кадр.).`); }
  const fid = 'f' + (S.nextId++);
  S.films = S.films || {};
  const film = S.films[fid] = { id: fid, name: sheetName(S.sheet), sheet: S.sheet, items: [], exportEnd: filmForm.exportEnd, created: Date.now() };
  let prev = null; const newItems = [];
  shots.forEach((sh, i) => {
    const vals = { ...paramDefaults(wf) };
    if (pp) vals[pp.id] = sh.text;
    if (lp) vals[lp.id] = sh.seconds || filmForm.seconds;
    if (filmForm.format !== '' && (wf.params || []).some(p => p.id === 'format')) vals.format = +filmForm.format;
    const it = { id: 'p' + (S.nextId++), wfId: wf.id, src: i === 0 && needsCard && filmForm.start ? +filmForm.start : (needsCard && !filmForm.chain && filmForm.start ? +filmForm.start : null), vals, opts: { toCut: filmForm.cut, film: fid, shot: i }, status: 'wait', name: `🎬 ${i + 1}: ${sh.text.slice(0, 26)}`, raw: sh.text, enhance: filmForm.enhance && !!pp, chainPrev: filmForm.chain && needsCard && prev ? prev : null, fallback: needsCard && filmForm.start ? +filmForm.start : null };
    film.items.push(it.id); prev = it.id; newItems.push(it);
  });
  // кадры фильма — первыми среди ждущих задач, чтобы старые задачи из плана не вклинивались
  const firstWait = S.plan.findIndex(x => x.status === 'wait');
  S.plan.splice(firstWait < 0 ? S.plan.length : firstWait, 0, ...newItems);
  save(); renderPlanBits(); showRight('tasks');
  if (start) { S.planAuto = true; planStart(); toast(`🎬 Снимаю ${shots.length} кадр. Можно закрыть шторки (👁) и отдохнуть.`); }
  else toast(`🎬 ${shots.length} кадр. в плане. Запуск — ▶ в «Задачах».`);
}
const _planJobEnded = planJobEnded;
planJobEnded = function (c) {
  _planJobEnded(c);
  const it = S.plan.find(x => x.jobId === c.id); const fid = it?.opts?.film; if (!fid) return;
  const film = S.films?.[fid]; if (!film || film.exported) return;
  const items = film.items.map(id => S.plan.find(x => x.id === id)).filter(Boolean);
  if (items.some(x => x.status === 'wait' || x.status === 'sent')) return;
  film.exported = true; save();
  const done = items.map(x => byId(x.jobId)).filter(j => j && j.status === 'done');
  if (!film.exportEnd) { toast(`🎬 Фильм снят: ${done.length} из ${items.length} кадр.`); return; }
  if (!done.length) return toast('🎬 Ни один кадр не получился — склеивать нечего.');
  const music = cutCards(film.sheet).find(x => x.kind === 'audio');
  setTimeout(() => exportMontage(done, music, 'Фильм · ' + film.name), 600);
};

/* ================= знакомство: как обучение в играх ================= */
TOURS.welcome = () => [
  { el: () => $('#board'), text: 'Это <b>режиссёрский стол</b> поверх ComfyUI. Вместо паутины нод — зоны, как на настоящем столе монтажёра. Давайте покажу за минуту.', ms: 5200 },
  { el: () => zoneEl('video') || $('#board'), text: '<b>Видео</b>. Сюда падают ролики. <b>Виджет</b> — это ваш workflow: бросьте на него картинку, и откроется окно с промптом.', click: true },
  { el: () => firstWidget() || zoneEl('video'), text: 'Готовые результаты <b>сами выходят на стол</b> колонкой рядом с виджетом. Во время генерации в виджете видно <b>живое превью</b>, стадию и сколько осталось.' },
  { el: () => zoneEl('image') || $('#board'), text: '<b>Картинки</b>. Перетащите кадр прямо из проводника. Правый клик по любой карточке — <b>круговое меню</b>.' },
  { el: () => zoneEl('fx') || $('#board'), text: '<b>Эффекты</b>. Код рисует черновик эффекта — портал, молнию, искры — точно там, где вы кликнули. LTX делает его настоящим, со звуком.' },
  { el: () => zoneEl('script') || $('#board'), text: '<b>Сценарий</b>. Пишите или надиктуйте идею на любом языке → ✨ разобьёт на кадры → <b>🎬 Снять</b>: стол снимет все кадры, свяжет их и склеит фильм.', type: 'Кадр 1: герой выходит из хижины на рассвете\nКадр 2: крупно — он улыбается (3 с)' },
  { el: () => zoneEl('cut') || $('#board'), text: '<b>Монтаж</b>. Кладите сюда клипы слева направо. Справа ▶ смотреть и <b>⬇ Собрать ролик</b> — один mp4 с музыкой.' },
  { el: () => zoneEl('assist') || $('#board'), text: '<b>Ассистент</b>. Скажите «видео: девушка идёт по пляжу» — откроется нужный workflow с этим промптом. Голос — удерживайте <b>Ё</b>.' },
  { el: () => $('#pianoWrap'), text: '<b>Клавиши как у пианино</b>. Белые 1…0 — сцены или workflow, чёрные — любимые действия. Подключите <b>MIDI-клавиатуру</b> — и играйте на ней.' },
  { el: () => $('#top'), text: 'Сверху — видеокарта и память. Если что-то зависло, стол подскажет почему. 🧹 освобождает память, 👁 закрывает шторки, пока идёт генерация.' },
  { el: () => $('#corner .corner-tab') || $('#corner'), text: 'В <b>Инструментах</b>: модели под вашу видеокарту, импорт ваших workflow, редактор зон. Это знакомство всегда можно запустить снова там же.' },
];
let welcomeRunning = false;
function startWelcome(force) {
  if (!force && S.cfg.tutorialDone) return;
  sheetOpen(`<div class="welcome"><div class="wl-logo">🎬</div><h3>Добро пожаловать за режиссёрский стол</h3><p>Минута — и вы знаете, где что. Подсказки покажут сами, курсор проведёт. Остановить можно в любой момент.</p>
    <div class="acts"><button type="button" class="btn ghost" data-wl="skip">Позже</button><button type="button" class="btn primary" data-wl="go">▶ Показать</button></div></div>`, null, {
    onClick: e => { const b = e.target.closest('[data-wl]'); if (!b) return; closeSheet(); S.cfg.tutorialDone = true; save(); if (b.dataset.wl === 'go') { welcomeRunning = true; startTour('welcome'); } },
  });
}
function onTourEnd() { if (welcomeRunning) { welcomeRunning = false; toast('Готово! Знакомство можно повторить: «Инструменты» → ▶ Знакомство со столом.'); } }
setTimeout(() => { if (!S.cfg.tutorialDone && sheetBack.hidden) startWelcome(false); }, 1800);

/* ================= оформление: цветное / минимализм ================= */
function applyTheme() { document.body.classList.toggle('theme-mini', S.cfg.theme === 'mini'); if (typeof drawThreads === 'function') drawThreads(); }
applyTheme();

/* ================= настройки: новые пункты ================= */
(function patchSettings() {
  const btn = $('#btnSettings'); const orig = btn.onclick;
  btn.onclick = () => {
    orig();
    const acts = sheet.querySelector('.acts'); if (!acts) return;
    const c = S.cfg, v = vramGB();
    const box = document.createElement('div');
    box.innerHTML = `<div class="field"><label>Новое</label>
      <label class="chk" style="gap:8px">Оформление: <select id="xTheme"><option value="color" ${(c.theme || 'color') === 'color' ? 'selected' : ''}>цветное — у каждой зоны свой цвет</option><option value="mini" ${c.theme === 'mini' ? 'selected' : ''}>минимализм — серый и лайм</option></select></label>
      <label class="chk" style="gap:8px">Куда класть готовые результаты: <select id="xSpillM"><option value="output" ${(c.spillMode || 'output') === 'output' ? 'selected' : ''}>во вкладку «Вывод» (стол не захламляется)</option><option value="widget" ${c.spillMode === 'widget' ? 'selected' : ''}>на стол колонкой рядом с виджетом</option><option value="off" ${c.spillMode === 'off' ? 'selected' : ''}>копить внутри виджета</option></select></label>
      <label class="chk"><input type="checkbox" id="xPrev" ${c.preview !== 'off' ? 'checked' : ''}> Живое превью во время генерации (почти не тратит видеопамять)</label>
      <span class="hint">${LTX_PREVIEW_NODE ? 'Для LTX стол сам подключает превью из KJNodes.' : 'Для превью LTX нужен свежий KJNodes (нода LTX2 Sampling Preview Override).'} ${TAELTX ? 'Декодер для чёткого превью: <b data-noi18n>' + esc(TAELTX) + '</b>.' : 'Для чёткого превью положите маленький декодер taeltx в models/vae (Модели и железо).'}</span>
      <label class="chk"><input type="checkbox" id="xMidi" ${c.midi !== false ? 'checked' : ''}> MIDI-клавиатура нажимает клавиши стола <button type="button" class="btn small ghost" id="xMidiGo">Подключить</button></label>
      <div class="row2" style="margin-top:6px"><span style="flex:1">Режим для слабых видеокарт</span><select id="xLow"><option value="auto" ${(c.lowVram || 'auto') === 'auto' ? 'selected' : ''}>авто${v ? ` (у вас ${v.toFixed(0)} ГБ)` : ''}</option><option value="on" ${c.lowVram === 'on' ? 'selected' : ''}>включён</option><option value="off" ${c.lowVram === 'off' ? 'selected' : ''}>выключен</option></select></div>
      <span class="hint">Авто: до 8 ГБ — первый запуск в лёгком формате и короче; до 12 ГБ — между задачами разных моделей память освобождается сама.</span>
      <button type="button" class="btn small ghost" id="xTour" style="margin-top:8px">▶ Показать знакомство снова</button></div>`;
    acts.before(box);
    box.querySelector('#xMidiGo').onclick = () => midiInit(true);
    box.querySelector('#xTour').onclick = () => { closeSheet(); welcomeRunning = true; startTour('welcome'); };
    const prevSubmit = sheet.onsubmit;
    sheet.onsubmit = e => {
      c.theme = box.querySelector('#xTheme').value; applyTheme();
      c.spillMode = box.querySelector('#xSpillM').value; c.spill = c.spillMode !== 'off'; c.preview = box.querySelector('#xPrev').checked ? 'auto' : 'off'; c.midi = box.querySelector('#xMidi').checked; c.lowVram = box.querySelector('#xLow').value;
      if (c.preview !== 'off') enablePreview();
      prevSubmit(e);
    };
  };
})();

/* панели перерисовались во время разбивки — вернуть «занято» */
{ const _fp = fillPanels; fillPanels = function () { _fp.apply(this, arguments); if (splitCtl) splitBusy(true); }; }

/* линии идут под карточками; навели на видимую часть линии — она целиком рисуется поверх всего */
threadsEl.addEventListener('pointerover', e => {
  const h = e.target.closest?.('path.hov'); if (!h) return;
  threadHits.querySelectorAll('.hovtop').forEach(x => x.remove());
  const ns = 'http://www.w3.org/2000/svg';
  threadsEl.querySelectorAll(`path.hov[data-w="${h.dataset.w}"][data-p="${h.dataset.p}"]`).forEach(src => {
    const vis = [...threadsEl.querySelectorAll('path:not(.hov)')].find(x => x.getAttribute('d') === src.getAttribute('d'));
    const g = document.createElementNS(ns, 'path'); g.setAttribute('class', 'hovtop'); g.setAttribute('d', src.getAttribute('d'));
    if (vis) g.setAttribute('style', vis.getAttribute('style') || '');
    threadHits.insertBefore(g, threadHits.firstChild);
  });
});
threadsEl.addEventListener('pointerout', e => { if (e.target.closest?.('path.hov')) threadHits.querySelectorAll('.hovtop').forEach(x => x.remove()); });
