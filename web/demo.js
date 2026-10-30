/* Director's Table — «🎥 Демо для записи»: стол сам показывает, что умеет (~95 секунд), с субтитрами.
   Идёт по точной временной шкале: каждая сцена длится ровно столько, сколько указано, поэтому
   субтитры (.srt) и закадровый голос совпадают с картинкой. Ничего не генерирует и не портит:
   перед показом стол запоминает своё состояние и возвращает его в конце. Esc — выйти в любой момент. */
'use strict';

let DEMO = null;
const demoCap = document.createElement('div'); demoCap.id = 'demoCap'; demoCap.hidden = true; document.body.appendChild(demoCap);
const demoSub = document.createElement('div'); demoSub.id = 'demoSub'; demoSub.hidden = true; document.body.appendChild(demoSub);
const demoCur = document.createElement('div'); demoCur.id = 'demoCur'; demoCur.hidden = true; document.body.appendChild(demoCur);
const sleep = ms => new Promise(res => { const t = setTimeout(res, ms); if (DEMO) DEMO.timers.push(t); });
const demoEn = () => !['ru', 'uk'].includes(window.DT_LANG || 'ru');
function cap(title, sub = '') {
  demoCap.innerHTML = `<b>${esc(T(title))}</b>${sub ? `<span>${esc(T(sub))}</span>` : ''}`;
  demoCap.hidden = false; demoCap.classList.remove('in'); void demoCap.offsetWidth; demoCap.classList.add('in');
}
function subtitle(text) {
  demoSub.textContent = text; demoSub.hidden = !text; demoSub.classList.remove('in'); void demoSub.offsetWidth; demoSub.classList.add('in');
  // субтитр — над пианино, чтобы не сливался с клавишами
  const pt = $('#piano')?.getBoundingClientRect().top || innerHeight; demoSub.style.bottom = Math.max(16, innerHeight - pt + 14) + 'px';
}
async function cursorTo(el, click = false) {
  if (!DEMO || !el) return;
  const r = (typeof el === 'string' ? $(el) : el)?.getBoundingClientRect(); if (!r) return;
  demoCur.hidden = false; demoCur.style.left = (r.left + r.width / 2) + 'px'; demoCur.style.top = (r.top + r.height / 2) + 'px';
  await sleep(650);
  if (click) { demoCur.classList.add('click'); await sleep(220); demoCur.classList.remove('click'); }
}
async function typeInto(ta, text, speed = 28) {
  ta.value = ''; ta.focus?.();
  for (const ch of text) { if (!DEMO) return; ta.value += ch; ta.scrollTop = ta.scrollHeight; await sleep(speed); }
  ta.blur?.();
}
const DEMO_CFG_KEYS = ['view', 'orbMode', 'keyStyle', 'rowLen', 'pianoRows', 'rowsHidden', 'linkStyle', 'theme'];
function demoSnapshot() {
  return JSON.stringify({ sheets: S.sheets, sheet: S.sheet, customLayouts: S.customLayouts, keymap: S.keymap, favs: S.favs, scripts: S.scripts, groups: S.groups,
    cfg: { view: S.cfg.view, orbMode: S.cfg.orbMode, keyStyle: S.cfg.keyStyle, rowLen: S.cfg.rowLen, pianoRows: S.cfg.pianoRows, rowsHidden: S.cfg.rowsHidden, linkStyle: S.cfg.linkStyle, theme: S.cfg.theme },
    cards: S.cards.map(c => [c.id, c.x, c.y, c.parked, c.presets]) });
}
function demoRestore(snap) {
  const d = JSON.parse(snap);
  Object.assign(S, { sheets: d.sheets, sheet: d.sheet, customLayouts: d.customLayouts || {}, keymap: d.keymap, favs: d.favs, scripts: d.scripts, groups: d.groups });
  // JSON теряет пустые (undefined) настройки — поэтому идём по списку: чего не было до демо, то удаляем
  for (const k of DEMO_CFG_KEYS) { if (d.cfg[k] === undefined) delete S.cfg[k]; else S.cfg[k] = d.cfg[k]; }
  const m = new Map(d.cards.map(x => [x[0], x]));
  for (const c of S.cards) { const x = m.get(c.id); if (x) { c.x = x[1]; c.y = x[2]; c.parked = x[3]; c.presets = x[4]; } }
  setView(S.cfg.view || VIEW); applyKeyStyle(); applyOrbLook(); if (typeof applyTheme === 'function') applyTheme();
  areaKey = ''; save(); render(); renderPiano(); updateLayoutSel(); fillPanels();
}
function demoStop(done) {
  if (!DEMO) return;
  const d = DEMO; DEMO = null;
  d.timers.forEach(clearTimeout);
  try { maestroClose(); } catch (_) { }
  try { closeSheet(); } catch (_) { }
  $('#right')?.classList.remove('open', 'pinned');
  demoRestore(d.snap);
  window.toast = d.toast; toast = d.toast;
  demoCap.hidden = true; demoSub.hidden = true; demoCur.hidden = true; document.body.classList.remove('demo-on', 'demo-nocards');
  toast(done ? '▶ Демо закончилось — стол вернулся как был.' : 'Демо остановлено — стол вернулся как был.');
}
window.addEventListener('keydown', e => { if (DEMO && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); demoStop(false); } }, true);

/* ---------- сценарий: длительность сцены (с), субтитр EN / RU и действия ---------- */
const wOf = () => visibleCards().find(c => c.type === 'widget');
const DEMO_TL = [
  { d: 6, en: "This is Director's Table — a director's desk built on top of ComfyUI.", ru: 'Это Director’s Table — режиссёрский стол поверх ComfyUI.',
    run: async () => { applyLayout('3x3'); setView('medium'); S.cfg.theme = 'color'; applyTheme(); cap("Director's Table", 'Режиссёрский стол поверх ComfyUI · только открытые модели'); } },
  { d: 8, en: 'Every zone has a job: video, images, sound, montage. Drop a file, and the right workflow is one click away.', ru: 'У каждой зоны своя работа: видео, картинки, звук, монтаж. Бросьте файл — нужный workflow в один клик.',
    run: async () => { cap('Зоны вместо проводов', 'видео · картинки · звук · монтаж'); for (const id of ['video', 'image', 'cut']) { const a = $(`.area[data-area="${id}"]`); if (!a) continue; setActiveArea(id); await cursorTo(a); await sleep(1500); } setActiveArea(null); } },
  { d: 9, en: 'Piano keys switch whole studios — or hold scenes, presets and workflows. A real MIDI keyboard works too.', ru: 'Клавиши переключают целые студии — или хранят сцены, пресеты и workflow. Работает и настоящая MIDI-клавиатура.',
    run: async () => {
      cap('Каждая клавиша — своя студия', 'Режиссёр · Студия · Монтаж внизу · Новичок');
      S.cfg.pianoRows = Math.max(3, S.cfg.pianoRows || 1); S.cfg.rowLen = { ...(S.cfg.rowLen || {}), 2: 5 }; S.cfg.rowsHidden = { ...(S.cfg.rowsHidden || {}), 2: false };
      ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB'].forEach((k, i) => { S.keymap[k] = 'layout:' + ['3x3', 'studio', 'bottomcut', 'simple', 'free'][i]; });
      S.cfg.keyStyle = 'color'; applyKeyStyle(); renderPiano(); await sleep(700);
      for (const [k, id] of [['KeyX', 'studio'], ['KeyC', 'bottomcut'], ['KeyZ', '3x3']]) { await cursorTo(`[data-bind="${k}"]`, true); pressKeyVisual(k); applyLayout(id); await sleep(1500); }
    } },
  { d: 12, en: 'Maestro holds over a hundred presets: camera, light, lenses, genres and VFX — grouped for real work: cinema, ads, transitions, fantasy.', ru: 'В Маэстро больше сотни пресетов: камера, свет, объективы, жанры и VFX — по группам для работы: кино, реклама, переходы, фэнтези.',
    run: async () => {
      cap('Маэстро — пресеты как у Higgsfield', 'камера · свет · объектив · жанр · VFX — 109 готовых заготовок');
      await cursorTo('#maestroOrb', true); maestroOpen(); await sleep(1300);
      for (let k = 0; k < 3; k++) { mhRotate(MH.step); await sleep(380); }
      MH.level = 'presets'; MH.cat = 'fx'; MH.sub = null; MH.rot = 0; mhDraw(); await sleep(1700);
      MH.sub = 'fantasy'; MH.rot = 0; mhDraw(); await sleep(1600);
      maestroClose(); await sleep(300);
      const ww = wOf(); if (ww) { attachPreset(ww, 'cam-orbit', true); attachPreset(ww, 'fx-handbolt', true); flashCard(ww.id); await cursorTo(els.get(ww.id)); }
      cap('Пресет — на виджет', 'облёт 360° + молнии из рук добавятся к промпту при запуске');
    } },
  { d: 9, en: 'The camera sphere: drag where the camera starts and ends — the camera prompt writes itself.', ru: 'Камера-сфера: перетащите, откуда и куда едет камера — промпт движения пишется сам.',
    run: async () => {
      cap('Своя траектория камеры', 'точки на сфере — промпт движения пишется сам');
      camSphere(wOf()); await sleep(800);
      for (const q of ['orbit', 'rise', 'low']) { const b = $(`#sheet [data-cq="${q}"]`); await cursorTo(b, true); b?.click(); await sleep(1900); }
      closeSheet();
    } },
  { d: 11, en: 'Write a script in any language. One click splits it into shots, and the desk films them in order, chaining the last frames.', ru: 'Напишите сценарий на любом языке. Один клик — и он разбит на кадры, а стол снимает их по очереди, продолжая с последнего кадра.',
    run: async () => {
      cap('Сценарий на любом языке', 'написать или надиктовать — по строке на кадр');
      const ta = $('#scriptTa'); if (!ta) return;
      await cursorTo(ta, true);
      const en = demoEn();
      await typeInto(ta, en ? 'A girl in a yellow raincoat finds a glowing mushroom in the forest, touches it — and hundreds of lights spark around her' : 'Девушка в жёлтом плаще находит в лесу светящийся гриб, трогает его — и вокруг загораются сотни огоньков', 20);
      await sleep(400); await cursorTo('[data-sp="split"]', true);
      ta.value = shotsToText(en ? [{ text: 'Wide shot: a girl in a yellow raincoat walks through a misty forest', seconds: 4 }, { text: 'Close-up: a glowing blue mushroom in the moss', seconds: 3 }, { text: 'Close-up: her hand touches it, the light pulses', seconds: 3 }, { text: 'Wide shot: hundreds of lights spark up around her', seconds: 5 }] : [{ text: 'Общий план: девушка в жёлтом плаще идёт по туманному лесу', seconds: 4 }, { text: 'Крупно: светящийся голубой гриб среди мха', seconds: 3 }, { text: 'Крупно: рука касается гриба, свет пульсирует', seconds: 3 }, { text: 'Общий план: вокруг загораются сотни огоньков', seconds: 5 }]).replace(/ \((\d+) с\)/g, en ? ' ($1 s)' : ' ($1 с)');
      ta.oninput && ta.oninput();
      cap('✨ Кадры — одним кликом', '🎬 Снять — стол снимет их по очереди, каждый следующий с последнего кадра');
    } },
  { d: 7, en: 'Prefer calm? Switch the look to minimal: grey zones, lime only where it matters.', ru: 'Хочется спокойнее? Переключите оформление на минимализм: серые зоны, лайм только там, где важно.',
    run: async () => { cap('Цветное или минимализм', 'одна настройка — другой характер стола'); await sleep(900); S.cfg.theme = 'mini'; applyTheme(); S.cfg.keyStyle = 'mono'; applyKeyStyle(); await sleep(2200); setView('small'); await sleep(1400); setView('medium'); } },
  { d: 11, en: 'Or turn a zone into a workspace for one workflow: a big prompt, live preview, inputs, parameters, history, time and models.', ru: 'Или превратите зону в рабочее место одного workflow: большой промпт, живое превью, входы, параметры, история, время и модели.',
    run: async () => {
      const wf = WFS.find(w => w.kind === 'video' && promptParam(w)) || WFS[0];
      const base = LAYOUTS.wsvideo;
      S.customLayouts = { ...(S.customLayouts || {}), demows: { id: 'demows', label: base.label, areas: base.areas.map(a => a.panel === 'wstudio' ? { ...a, wf: wf?.id, note: '', label: T(wf?.title || a.label).slice(0, 40), subs: WS_DEFAULT.slice() } : { ...a }) } };
      applyLayout('demows'); cap('Рабочее место, как у MiniMax', 'экран · промпт · входы · параметры · история · время и модель');
      await sleep(900);
      const ta = $('.zone-panel[data-panel="wstudio"] [data-wsprompt]');
      if (ta) { await cursorTo(ta, true); await typeInto(ta, demoEn() ? 'The conductor raises his hands — lightning arcs between his fingers' : 'Дирижёр поднимает руки — между пальцами бьют молнии', 22); ta.value = ''; }
      await cursorTo('.zone-panel[data-panel="wstudio"] [data-wsgear]');
    } },
  { d: 12, en: 'Build your own studio from blocks — no code. Every layout is a small JSON file that any AI can edit for you.', ru: 'Соберите свою студию из блоков — без кода. Каждая раскладка — маленький JSON-файл, который поправит любой ИИ.',
    run: async () => {
      cap('Собери свою студию', 'блоки на стол · растянуть · цвет · подпись — без кода');
      S.cfg.theme = 'color'; applyTheme(); S.cfg.keyStyle = 'color'; applyKeyStyle();
      document.body.classList.add('demo-nocards'); showRight('build'); $('#right').classList.add('open'); await sleep(700);
      S.customLayouts = { ...(S.customLayouts || {}), demo: { id: 'demo', label: 'Моя студия', areas: [] } };
      applyLayout('demo'); renderBuild(); await sleep(500);
      for (const [t, x, y] of [['wstudio', .26, .34], ['image', .78, .2], ['cut', .5, .8], ['maestro', .78, .5]]) {
        const b = BLOCKS.find(q => q.t === t); if (!b) continue; await cursorTo(`#tabBuild .blk[data-blk="${t}"]`, true);
        const br = board.getBoundingClientRect(); demoCur.style.left = (br.left + br.width * x) + 'px'; demoCur.style.top = (br.top + br.height * y) + 'px'; await sleep(520);
        addBlock(b, x, y); await sleep(380);
      }
      const L = S.customLayouts.demo; const cut = L.areas.find(a => a.montage); if (cut) { cut.x = .02; cut.w = .96; cut.h = .28; cut.y = .7; buildSel = cut.id; areaKey = ''; render(); renderBuild(); }
      await sleep(1200); $('#right').classList.remove('open'); document.body.classList.remove('demo-nocards');
    } },
  { d: 9, en: 'VFX Guide: code draws a motion draft of the effect over your frame — and LTX-2 renders it photoreal, with sound.', ru: 'VFX Guide: код рисует черновик движения эффекта поверх кадра — а LTX-2 делает его реалистичным и со звуком.',
    run: async () => {
      applyLayout('3x3');
      cap('Код рисует эффект — LTX делает его настоящим', 'огонь · молнии · портал · аура · ударная волна');
      const v = visibleCards().find(c => c.type === 'widget' && /vfx/i.test(wfById(c.wf)?.id || '')) || wOf();
      if (v) { await sleep(600); flashCard(v.id); await cursorTo(els.get(v.id)); }
    } },
  { d: 6, en: 'Local. Open weights only. Built on ComfyUI and LTX-2.', ru: 'Локально. Только открытые модели. Сделано на ComfyUI и LTX-2.',
    run: async () => { demoCur.hidden = true; cap('Локально · открытые веса · LTX-2 VFX', 'Director’s Table · сделано на ComfyUI'); } },
];
const DEMO_LEN = DEMO_TL.reduce((s, x) => s + x.d, 0);

async function demoRun() {
  if (DEMO) return;
  if (S.cards.some(c => c.status === 'running' || c.status === 'queued')) toast('Идёт генерация — демо её не тронет, просто покажет стол.');
  closeSheet?.();
  DEMO = { snap: demoSnapshot(), timers: [], toast };
  toast = () => { }; // подсказки во время показа не нужны
  document.body.classList.add('demo-on');
  const t0 = performance.now(); let at = 0;
  try {
    for (const sc of DEMO_TL) {
      if (!DEMO) throw 0;
      subtitle(demoEn() ? sc.en : sc.ru);
      try { await sc.run(); } catch (e) { console.warn('demo', e); }
      if (!DEMO) throw 0;
      at += sc.d * 1000;
      const left = at - (performance.now() - t0); if (left > 0) await sleep(left);
    }
    demoStop(true);
  } catch (e) { if (DEMO) demoStop(false); }
}
/* субтитры демо файлом .srt — для монтажа и для озвучки (каждая строка = одна фраза голосом) */
function demoSrt(lang) {
  const ts = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  let t = 0;
  return DEMO_TL.map((sc, i) => { const a = t + .2, b = t + sc.d - .3; t += sc.d; return `${i + 1}\n${ts(a)} --> ${ts(b)}\n${lang === 'ru' ? sc.ru : sc.en}\n`; }).join('\n');
}
function demoSrtDownload() {
  const lang = demoEn() ? 'en' : 'ru';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([demoSrt(lang)], { type: 'text/plain' })); a.download = `directors-table-demo-${lang}.srt`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast(`Субтитры демо сохранены: directors-table-demo-${lang}.srt (${DEMO_LEN} с).`);
}
// кнопки в «Инструментах»
{ const t = $('[data-tool="tour"]'); if (t) t.insertAdjacentHTML('afterend', `<button class="tool" data-tool="demo">🎥 Демо для записи (≈100 с)</button><button class="tool" data-tool="demo-srt">⬇ Субтитры демо (.srt)</button>`); }
document.addEventListener('click', e => {
  if (e.target.closest('[data-tool="demo"]')) { e.stopPropagation(); demoRun(); }
  if (e.target.closest('[data-tool="demo-srt"]')) { e.stopPropagation(); demoSrtDownload(); }
}, true);
