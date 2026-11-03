/* Director's Table — «Студия инфлюенсера» в режиме Продакшн (в духе AI Influencer у Higgsfield, но на открытых моделях).
   ① Внешность: 19 настроек кнопками + «своими словами» на любом языке + 🎲 случайно
   ② Портрет: 4 варианта на вашей модели «текст → картинка» (Z-Image Turbo / FLUX.2 klein — влезают в 12 ГБ)
   ③ Карта персонажа: лист с ракурсами одним кадром или официальный шаблон Qwen Multiple-Angles от выбранного портрета
   ④ Дальше: сохранить в «Персонажи», оживить, говорящее фото, ID-LoRA (лицо и голос без обучения), набор для LoRA. */
'use strict';

const INF_IO = [ // [ключ, ru, en, варианты [ru, en, prompt], multi]
  ['kind', 'Кто', 'Who', [['Человек', 'Human', ''], ['Аниме', 'Anime', 'anime'], ['3D-мульт', '3D cartoon', '3d'], ['Фэнтези-существо', 'Fantasy creature', 'fantasy creature'], ['Гибрид с животным', 'Animal hybrid', 'human-animal hybrid'], ['Инопланетянин', 'Alien', 'alien humanoid'], ['Андроид', 'Android', 'humanoid android']]],
  ['gender', 'Пол', 'Gender', [['Женщина', 'Woman', 'a woman'], ['Мужчина', 'Man', 'a man'], ['Небинарный', 'Non-binary', 'an androgynous person']]],
  ['eth', 'Происхождение', 'Origin', [['Европейское', 'European', 'European'], ['Африканское', 'African', 'African'], ['Восточноазиатское', 'East Asian', 'East Asian'], ['Южноазиатское', 'South Asian', 'South Asian'], ['Ближний Восток', 'Middle Eastern', 'Middle Eastern'], ['Латиноамериканское', 'Latin American', 'Latin American'], ['Смешанное', 'Mixed', 'mixed-heritage']]],
  ['age', 'Возраст', 'Age', [['18–25', '18–25', 'in their early twenties'], ['25–35', '25–35', 'in their late twenties'], ['35–50', '35–50', 'in their forties'], ['50–65', '50–65', 'in their late fifties'], ['65+', '65+', 'elderly']]],
  ['skin', 'Кожа', 'Skin', [['Светлая', 'Fair', 'fair skin'], ['Оливковая', 'Olive', 'olive skin'], ['Смуглая', 'Tan', 'tan skin'], ['Тёмная', 'Dark', 'deep dark skin'], ['Бледная', 'Pale', 'porcelain pale skin'], ['Необычный цвет', 'Unusual color', 'striking pale blue skin, like a fantasy character']]],
  ['height', 'Рост', 'Height', [['Невысокий', 'Short', 'short'], ['Средний', 'Average', ''], ['Высокий', 'Tall', 'tall']]],
  ['build', 'Телосложение', 'Build', [['Худое', 'Thin', 'thin build'], ['Стройное', 'Slim', 'slim build'], ['Спортивное', 'Athletic', 'athletic build'], ['Мускулистое', 'Muscular', 'very muscular build'], ['Полное', 'Curvy / heavy', 'heavy-set build']]],
  ['head', 'Форма лица', 'Face shape', [['Овальное', 'Oval', 'oval face'], ['Круглое', 'Round', 'round face'], ['Квадратное', 'Square jaw', 'strong square jaw'], ['Вытянутое', 'Long', 'long narrow face'], ['Сердечком', 'Heart', 'heart-shaped face']]],
  ['eyeshape', 'Разрез глаз', 'Eye shape', [['Миндалевидные', 'Almond', 'almond-shaped'], ['Круглые', 'Round', 'round'], ['Узкие', 'Narrow', 'narrow'], ['Большие', 'Big', 'big expressive']]],
  ['eyes', 'Цвет глаз', 'Eye color', [['Карие', 'Brown', 'brown'], ['Голубые', 'Blue', 'blue'], ['Зелёные', 'Green', 'green'], ['Серые', 'Grey', 'grey'], ['Янтарные', 'Amber', 'amber'], ['Фиолетовые', 'Violet', 'violet'], ['Гетерохромия', 'Heterochromia', 'heterochromia, one blue and one brown']]],
  ['hairc', 'Цвет волос', 'Hair color', [['Чёрные', 'Black', 'black'], ['Каштановые', 'Brown', 'chestnut brown'], ['Русые', 'Light brown', 'light brown'], ['Блонд', 'Blonde', 'platinum blonde'], ['Рыжие', 'Ginger', 'ginger'], ['Седые', 'Silver', 'silver-grey'], ['Розовые', 'Pink', 'pastel pink'], ['Синие', 'Blue', 'electric blue'], ['Зелёные', 'Green', 'emerald green']]],
  ['hair', 'Причёска', 'Hairstyle', [['Короткая', 'Short', 'short cropped hair'], ['Длинные прямые', 'Long straight', 'long straight hair'], ['Волнистые', 'Wavy', 'wavy shoulder-length hair'], ['Кудрявые', 'Curly', 'big curly hair'], ['Каре', 'Bob', 'sharp bob'], ['Хвост', 'Ponytail', 'high ponytail'], ['Косы', 'Braids', 'long braids'], ['Афро', 'Afro', 'natural afro'], ['Бритая голова', 'Shaved', 'shaved head'], ['Ирокез', 'Mohawk', 'mohawk']]],
  ['facial', 'Борода и усы', 'Facial hair', [['Нет', 'None', ''], ['Щетина', 'Stubble', 'light stubble'], ['Борода', 'Beard', 'a full beard'], ['Усы', 'Mustache', 'a thick mustache'], ['Бородка', 'Goatee', 'a goatee']]],
  ['marks', 'Особые приметы', 'Distinctive features', [['Веснушки', 'Freckles', 'freckles'], ['Родинка', 'Beauty mark', 'a beauty mark'], ['Шрам', 'Scar', 'a small scar on the cheek'], ['Тату на лице', 'Face tattoo', 'a small face tattoo'], ['Пирсинг', 'Piercing', 'nose and ear piercings'], ['Брекеты', 'Braces', 'visible braces'], ['Грилзы', 'Gold grills', 'gold grills'], ['Витилиго', 'Vitiligo', 'vitiligo patches'], ['Альбинизм', 'Albinism', 'albinism'], ['Эльфийские уши', 'Elf ears', 'pointed elf ears'], ['Рожки', 'Small horns', 'small horns'], ['Длинные ресницы', 'Dramatic lashes', 'dramatic long eyelashes']], true],
  ['style', 'Стиль одежды', 'Outfit style', [['Кэжуал', 'Casual', 'casual jeans and a white t-shirt'], ['Стритвир', 'Streetwear', 'oversized streetwear hoodie'], ['Деловой', 'Business', 'a tailored business suit'], ['Премиум', 'Luxury', 'luxury designer outfit'], ['Спорт', 'Sport', 'sportswear'], ['Бохо', 'Boho', 'boho layered outfit'], ['Готика', 'Gothic', 'gothic black outfit'], ['Киберпанк', 'Cyberpunk', 'cyberpunk jacket with neon accents'], ['Рабочая форма', 'Workwear', 'clean branded workwear and a hard hat'], ['Медицинская', 'Medical', 'a medical white coat'], ['Фэнтези', 'Fantasy armor', 'ornate fantasy armor']]],
  ['acc', 'Аксессуары', 'Accessories', [['Серьги', 'Earrings', 'earrings'], ['Цепочка', 'Chain', 'a thin chain necklace'], ['Очки', 'Glasses', 'glasses'], ['Кепка', 'Cap', 'a baseball cap'], ['Шляпа', 'Hat', 'a wide-brim hat'], ['Наушники', 'Headphones', 'headphones around the neck'], ['Часы', 'Watch', 'a wristwatch']], true],
  ['bg', 'Фон', 'Background', [['Студия', 'Studio', 'plain light-grey studio background'], ['Город', 'City', 'a city street background'], ['Кафе', 'Cafe', 'a cozy cafe background'], ['Природа', 'Nature', 'a nature background'], ['Неон ночью', 'Neon night', 'neon-lit night street'], ['Офис', 'Office', 'a modern office'], ['Стройка', 'Construction site', 'a modern construction site']]],
  ['shot', 'Кадр', 'Framing', [['По плечи', 'Head & shoulders', 'head-and-shoulders portrait'], ['По пояс', 'Waist up', 'waist-up portrait'], ['В полный рост', 'Full body', 'full-body shot']]],
];
const INF_LVLS = [['Обычный', 'Average', ''], ['Яркий', 'Bold', 'a bold, distinctive, memorable look'], ['Экстрим', 'Extreme', 'extreme, exaggerated, unusual stylized features, surreal yet photoreal']];
P.inf = { open: false, step: 1, lvl: 0, v: { kind: 0, gender: 0, age: 1, shot: 0, bg: 0, marks: [], acc: [] }, extra: '', name: '', id: null, pick: null, wf: null };
const io = k => INF_IO.find(x => x[0] === k);
const ival = (k, i) => io(k)?.[3][i]?.[2] || '';

function infPrompt(sheet) {
  const v = P.inf.v, g = k => v[k] == null ? '' : ival(k, v[k]);
  const kind = g('kind'), pers = [[g('gender') || 'a person', g('age')].filter(Boolean).join(' '), g('eth') && (g('eth').replace(/-heritage$/, '') + ' heritage')].filter(Boolean).join(', ');
  const look = [g('skin'), g('build'), g('height'), g('head'), (g('eyeshape') || g('eyes')) ? (/heterochromia/.test(g('eyes')) ? `${g('eyeshape')} eyes with heterochromia — one bright blue eye and one dark brown eye`.trim() : `${g('eyeshape')} ${g('eyes')} eyes`.trim()) : '', g('hair') === 'shaved head' ? 'a shaved head' : (g('hairc') || g('hair')) ? `${g('hairc') ? g('hairc') + ' hair' : 'hair'}${g('hair') ? ', styled as ' + g('hair').replace(/ hair$/, '') : ''}` : '', g('facial'), ...(v.marks || []).map(i => ival('marks', i))].filter(Boolean).join(', ');
  const wear = [g('style') && 'wearing ' + g('style'), ...(v.acc || []).map(i => ival('acc', i))].filter(Boolean).join(', ');
  const lvl = INF_LVLS[P.inf.lvl][2], extra = String(P.inf.extra || '').replace(/[<>{}]/g, '').slice(0, 300);
  const media = kind === 'anime' ? 'Anime illustration' : kind === '3d' ? 'Stylized 3D animated character render' : 'Photorealistic photo';
  const who = kind && !['anime', '3d'].includes(kind) ? `${kind}, ${pers}` : pers;
  const desc = [who, look, wear, lvl, extra].filter(Boolean).join(', ');
  if (sheet) return `${media}, character reference sheet of the same single character on a plain white background: front view, three-quarter view, side profile, back view and a close-up of the face, arranged in a clean grid, consistent face, hair and outfit in every view. The character: ${desc}. Even studio light, sharp focus.`;
  return `${media} of ${desc}. ${g('shot') || 'head-and-shoulders portrait'}, ${g('bg') || 'plain studio background'}, natural skin texture, sharp focus on the eyes, 85mm lens, soft key light.`.replace(/\s+/g, ' ');
}
function infRandom() {
  const v = { marks: [], acc: [] };
  for (const [k, , , opts, multi] of INF_IO) {
    if (multi) { const n = Math.random() < .5 ? 0 : 1 + Math.floor(Math.random() * 2); while (v[k].length < n) { const i = Math.floor(Math.random() * opts.length); if (!v[k].includes(i)) v[k].push(i); } }
    else if (k === 'kind') v[k] = Math.random() < .8 ? 0 : Math.floor(Math.random() * opts.length);
    else v[k] = Math.floor(Math.random() * opts.length);
  }
  if (v.gender === 0 && Math.random() < .85) v.facial = 0;
  P.inf.v = v;
}
// подходящий workflow «текст → картинка» (без обязательного входного файла)
const infImgWfs = () => WFS.filter(w => w.kind === 'image' && promptParam(w) && !(w.params || []).some(p => p.type === 'card'));
const infWf = () => { const l = infImgWfs(); return l.find(w => w.id === P.inf.wf) || l[0] || null; };
const infJobs = step => S.cards.filter(c => c.type === 'file' && c.inf === (P.inf.id || 'draft') && (!step || c.infStep === step)).sort((a, b) => (b.created || 0) - (a.created || 0));
const ANG_TPL = 'templates-1_click_multiple_character_angles-v1.0';

function infDraw(main) {
  const I = P.inf, wfs = infImgWfs(), wf = infWf();
  const steps = [[1, 'Внешность', 'Look'], [2, 'Портрет', 'Portrait'], [3, 'Карта персонажа', 'Character sheet'], [4, 'Видео и LoRA', 'Video & LoRA']];
  const chips = ([k, ru, en, opts, multi]) => `<div class="if-g"><span>${esc(px(ru, en))}</span><div>${opts.map((o, i) => `<button type="button" class="${(multi ? (I.v[k] || []).includes(i) : I.v[k] === i) ? 'on' : ''}" data-ik="${k}" data-iv="${i}">${esc(px(o[0], o[1]))}</button>`).join('')}</div></div>`;
  const tile = c => `<button type="button" class="if-res${I.pick === c.id ? ' on' : ''}${c.status !== 'done' ? ' busy' : ''}" data-ipick="${c.id}" title="${esc(c.error || String(c.params ? Object.values(c.params).find(v => typeof v === 'string' && v.length > 40) || '' : '').slice(0, 400))}">${c.status === 'done' && c.file ? mediaHTML(c) : `<i>${c.status === 'error' ? '⚠' : Math.round((c.progress || 0) * 100) + '%'}</i>`}</button>`;
  const galB = (list, kind) => {
    if (!list.length) return `<div class="if-empty">${esc(kind)}</div>`;
    const groups = []; for (const c of list) { const k = c.infBatch || Math.round((c.created || 0) / 15000); let g = groups.find(x => x.k === k); if (!g) groups.push(g = { k, items: [] }); g.items.push(c); }
    return groups.slice(0, 12).map((g, gi) => {
      const open = gi === 0 || I.openB === g.k || g.items.some(c => c.id === I.pick);
      const first = g.items.find(c => c.status === 'done' && c.file) || g.items[0];
      return open ? `<div class="if-batch"><div class="if-bh">${esc(px(gi === 0 ? 'Последний запуск' : 'Запуск', gi === 0 ? 'Latest run' : 'Run'))} · ${g.items.length}${gi ? ` <button type="button" class="pbtn small" data-ibclose>${esc(px('свернуть', 'collapse'))}</button>` : ''}</div><div class="if-gal">${g.items.map(tile).join('')}</div></div>`
        : `<button type="button" class="if-stack" data-ibopen="${g.k}" title="${esc(px('Развернуть', 'Expand'))}">${first && first.file ? mediaHTML(first) : ''}<em>×${g.items.length}</em></button>`;
    }).join('').replace(/(<button type="button" class="if-stack"[\s\S]*?<\/button>)+/g, m => `<div class="if-stacks">${m}</div>`);
  };
  const gal = (list, kind) => list.length ? `<div class="if-gal">${list.slice(0, 12).map(c => `<button type="button" class="if-res${I.pick === c.id ? ' on' : ''}${c.status !== 'done' ? ' busy' : ''}" data-ipick="${c.id}" title="${esc(c.error || '')}">${c.status === 'done' && c.file ? mediaHTML(c) : `<i>${c.status === 'error' ? '⚠' : Math.round((c.progress || 0) * 100) + '%'}</i>`}</button>`).join('')}</div>` : `<div class="if-empty">${esc(kind)}</div>`;
  const pick = byId(I.pick);
  const angWf = S.tplWf?.[ANG_TPL] && wfById(S.tplWf[ANG_TPL]), angT = (TPL || []).find(t => t.name === ANG_TPL);
  let body = '';
  if (I.step === 1) body = `<div class="if-cols"><div class="if-left">
      <div class="if-g"><span>${esc(px('Насколько необычный', 'How unusual'))}</span><div>${INF_LVLS.map((l, i) => `<button type="button" class="${I.lvl === i ? 'on' : ''}" data-ilvl="${i}">${esc(px(l[0], l[1]))}</button>`).join('')}</div></div>
      ${INF_IO.map(chips).join('')}</div>
    <aside class="if-right"><div class="ps-l">${esc(px('ИМЯ', 'NAME'))}</div><input type="text" data-iname maxlength="30" value="${esc(I.name)}" placeholder="${esc(px('например: Мила', 'e.g. Mila'))}">
      <div class="ps-l">${esc(px('СВОИМИ СЛОВАМИ', 'IN YOUR OWN WORDS'))}</div><textarea data-iextra rows="4" placeholder="${esc(px('Любой язык: «шрам над бровью, хитрая улыбка, серебряное кольцо»', 'Any language: “scar above the brow, sly smile, silver ring”'))}">${esc(I.extra)}</textarea>
      <div class="pnote">${esc(px('Z-Image и FLUX.2 klein понимают промпт на русском и других языках (текстовый кодировщик Qwen3).', 'Z-Image and FLUX.2 klein understand prompts in many languages (Qwen3 text encoder).'))}</div>
      <button type="button" class="pbtn" data-irand>🎲 ${esc(px('Случайный персонаж', 'Random character'))}</button>
      <div class="ps-l">${esc(px('ПРОМПТ', 'PROMPT'))}</div><div class="if-prompt">${esc(infPrompt())}</div>
      <button type="button" class="pbtn main" data-igo4>${PICON('play', 'sm')} ${esc(px('Сделать 4 портрета →', 'Make 4 portraits →'))}</button></aside></div>`;
  if (I.step === 2) body = `<div class="if-cols"><div class="if-left">
      <div class="if-row">${wfs.length ? `<label class="if-sel">${esc(px('Модель', 'Model'))} <select data-iwf>${wfs.map(w => `<option value="${esc(w.id)}" ${wf && w.id === wf.id ? 'selected' : ''}>${esc(T(w.title))}</option>`).join('')}</select></label><button type="button" class="pbtn main" data-igen="4">🖼 ${esc(px('4 варианта', '4 variants'))}</button><button type="button" class="pbtn" data-igen="1">${esc(px('ещё один', 'one more'))}</button>` : `<span>${esc(px('Нужен workflow «текст → картинка». Возьмите официальный шаблон Z-Image Turbo — он быстрый и влезает в 12 ГБ.', 'You need a text → image workflow. Take the official Z-Image Turbo template — fast and fits 12 GB.'))}</span><button type="button" class="pbtn main" data-itpl="image_z_image_turbo">◆ Z-Image Turbo</button><button type="button" class="pbtn" data-itpl="image_flux2_klein_text_to_image">◆ FLUX.2 klein</button>`}</div>
      ${infStatus(infJobs('portrait'))}${galB(infJobs('portrait'), px('Здесь появятся варианты. Выберите лучший — от него строится карта персонажа.', 'Variants appear here. Pick the best one — the character sheet is built from it.'))}</div>
    <aside class="if-right"><div class="ps-l">${esc(px('ВЫБРАН', 'PICKED'))}</div><div class="if-big">${pick && pick.file ? mediaHTML(pick) : `<span>${esc(px('кликните вариант', 'click a variant'))}</span>`}</div>
      <button type="button" class="pbtn" data-istep="1">← ${esc(px('Внешность', 'Look'))}</button><button type="button" class="pbtn main" data-istep="3" ${pick ? '' : 'disabled'}>${esc(px('Дальше: карта персонажа →', 'Next: character sheet →'))}</button></aside></div>`;
  if (I.step === 3) body = `<div class="if-cols"><div class="if-left">
      <div class="if-opts"><div class="if-opt"><b>${esc(px('Лист с ракурсами одним кадром', 'One-image turnaround sheet'))}</b><span>${esc(px('Та же модель рисует героя спереди, в три четверти, в профиль, со спины и крупно. Быстро, без новых моделей.', 'The same model draws the hero front, three-quarter, profile, back and close-up. Fast, no new models.'))}</span><button type="button" class="pbtn main" data-isheet ${wf ? '' : 'disabled'}>▦ ${esc(px('Сделать лист', 'Make the sheet'))}</button></div>
      <div class="if-opt"><b>${esc(px('Точные ракурсы от выбранного портрета', 'Exact angles from the picked portrait'))}</b><span>${esc(px('Официальный шаблон Comfy: Qwen-Image-Edit 2511 + Multiple-Angles. Лицо берётся с вашего портрета — сходство выше. Модель тяжёлая (~20 ГБ, на 12 ГБ медленнее).', 'Official Comfy template: Qwen-Image-Edit 2511 + Multiple-Angles. The face comes from your portrait — higher likeness. Heavy model (~20 GB, slower on 12 GB).'))}</span>${angWf ? `<button type="button" class="pbtn main" data-iang>⟲ ${esc(px('Сделать ракурсы', 'Make the angles'))}</button>` : angT ? `<button type="button" class="pbtn" data-itpl="${ANG_TPL}">◆ ${esc(px('1 клик: сделать инструмент из шаблона', '1 click: make the tool from the template'))}</button>` : `<span class="hint">${esc(px('Шаблон не найден — обновите ComfyUI.', 'Template not found — update ComfyUI.'))}</span>`}</div></div>
      ${infStatus([...infJobs('sheet'), ...infJobs('angles')])}${gal([...infJobs('sheet'), ...infJobs('angles')], px('Карта персонажа появится здесь.', 'The character sheet appears here.'))}</div>
    <aside class="if-right"><div class="ps-l">${esc(px('ПОРТРЕТ', 'PORTRAIT'))}</div><div class="if-big">${pick && pick.file ? mediaHTML(pick) : ''}</div>
      <button type="button" class="pbtn" data-istep="2">← ${esc(px('Портрет', 'Portrait'))}</button><button type="button" class="pbtn main" data-istep="4">${esc(px('Дальше →', 'Next →'))}</button></aside></div>`;
  if (I.step === 4) {
    const set = [...infJobs('portrait'), ...infJobs('sheet'), ...infJobs('angles')].filter(c => c.status === 'done' && c.file);
    body = `<div class="if-cols"><div class="if-left"><div class="if-opts">
      <div class="if-opt"><b>${PICON('user', 'sm')} ${esc(px('Сохранить в «Персонажи»', 'Save to Characters'))}</b><span>${esc(px('Описание героя будет добавляться в каждый кадр — Маэстро → «Персонаж».', 'The hero description is added to every shot — Maestro → Character.'))}</span><button type="button" class="pbtn main" data-isave>${esc(px('Сохранить', 'Save'))}</button></div>
      <div class="if-opt"><b>${PICON('imgvid', 'sm')} ${esc(px('Оживить портрет', 'Animate the portrait'))}</b><span>${esc(px('Картинка → видео: портрет станет первым кадром.', 'Image → video: the portrait becomes the first frame.'))}</span><button type="button" class="pbtn" data-igo="i2v" ${pick ? '' : 'disabled'}>${esc(px('Открыть', 'Open'))}</button></div>
      <div class="if-opt"><b>${PICON('talk', 'sm')} ${esc(px('Говорящий инфлюенсер', 'Talking influencer'))}</b><span>${esc(px('Портрет + голос → он говорит. Или «Аватар из текста».', 'Portrait + voice → it speaks. Or “Avatar from text”.'))}</span><button type="button" class="pbtn" data-igo="lips" ${pick ? '' : 'disabled'}>${esc(px('Открыть', 'Open'))}</button></div>
      <div class="if-opt"><b>${PICON('id', 'sm')} ${esc(px('Лицо и голос без обучения', 'Face and voice without training'))}</b><span>${esc(px('LTX 2.3 ID-LoRA держит лицо героя по одному референсу — обучать ничего не нужно.', 'LTX 2.3 ID-LoRA keeps the hero face from one reference — no training needed.'))}</span><button type="button" class="pbtn" data-igo="idlora">${esc(px('Открыть', 'Open'))}</button></div>
      <div class="if-opt"><b>${PICON('gear', 'sm')} ${esc(px('Набор для обучения LoRA', 'LoRA training set'))}</b><span>${esc(px(`Готово кадров: ${set.length}. Для LoRA нужно 20–40 разных кадров одного героя (ракурсы, эмоции, полный рост). Скачаем картинки с подписями в формате ai-toolkit. Обучение на 12 ГБ — обычно 1–3 часа; кнопка «обучить в один клик» — в разработке.`, `Images ready: ${set.length}. A LoRA needs 20–40 varied images of one hero (angles, expressions, full body). Downloads images with captions in ai-toolkit format. Training on 12 GB usually takes 1–3 hours; one-click training is in development.`))}</span><button type="button" class="pbtn" data-iset ${set.length ? '' : 'disabled'}>⬇ ${esc(px('Скачать набор', 'Download the set'))}</button><a class="pbtn" href="https://github.com/ostris/ai-toolkit" target="_blank" rel="noopener noreferrer">↗ ai-toolkit</a></div>
    </div></div><aside class="if-right"><div class="ps-l">${esc(px('ГЕРОЙ', 'HERO'))}</div><div class="if-big">${pick && pick.file ? mediaHTML(pick) : ''}</div><b class="if-name">${esc(I.name || px('Без имени', 'Unnamed'))}</b><button type="button" class="pbtn" data-istep="3">← ${esc(px('Карта персонажа', 'Character sheet'))}</button><button type="button" class="pbtn" data-inew>＋ ${esc(px('Новый персонаж', 'New character'))}</button></aside></div>`;
  }
  main.innerHTML = `<header class="ptask-h"><button type="button" class="pback" data-iback>← ${esc(px('Соцсети', 'Social'))}</button><div><div class="ph-eyebrow">${PICON('dna', 'sm')} ${esc(px('ИНФЛЮЕНСЕР', 'INFLUENCER'))}</div><h2>${esc(px('Студия инфлюенсера', 'Influencer studio'))}</h2><p>${esc(px('Соберите героя кнопками или своими словами, выберите лучший портрет, сделайте карту персонажа — и снимайте его в видео. Всё на открытых моделях у вас на компьютере.', 'Build a hero with buttons or your own words, pick the best portrait, make a character sheet — then film it. All on open models on your computer.'))}</p></div></header>
    <div class="if-steps">${steps.map(([n, ru, en]) => `<button type="button" class="${I.step === n ? 'on' : I.step > n ? 'done' : ''}" data-istep="${n}"><b>${n}</b>${esc(px(ru, en))}</button>`).join('')}</div>${body}`;
}

{ const _d = pDraw; pDraw = function () {
  if (P.on && P.inf.open && !P.task && !P.social.open) { prodEl.innerHTML = ''; _d.apply(this, arguments); const m = $('#pMain', prodEl); if (m) { m.setAttribute('data-noi18n', ''); infDraw(m); } return; }
  return _d.apply(this, arguments);
}; }
{ const _o = pOpenCard; pOpenCard = function (id) { if (id === 'infl') { P.cat = 'social'; P.inf.open = true; P.task = null; P.social.open = false; return pDraw(); } return _o.apply(this, arguments); }; }
PCARDS.splice(PCARDS.findIndex(c => c.id === 'social'), 0, { id: 'infl', cat: 'social', ic: '🧬', a: '#f0ff41', b: '#ff5fa8', ru: 'Студия инфлюенсера', en: 'Influencer studio', dru: '19 настроек внешности, портреты, карта персонажа со всех ракурсов, видео и набор для LoRA.', den: '19 look settings, portraits, a character sheet from every angle, video and a LoRA set.', open: { fn: () => pOpenCard('infl') }, pop: 1 });

function infGen(n, step, card) {
  const wf = step === 'angles' ? wfById(S.tplWf?.[ANG_TPL]) : infWf();
  if (!wf) return toast(px('Нет модели «текст → картинка». Нажмите кнопку шаблона Z-Image Turbo.', 'No text → image model. Click the Z-Image Turbo template button.'));
  const opts = { inf: P.inf.id || 'draft', infStep: step, infBatch: Date.now() }, params = step === 'angles' ? {} : { __prompt: infPrompt(step === 'sheet') };
  const before = S.cards.length;
  try { for (let i = 0; i < n; i++) dispatch(card ? [card] : [null], wf, { params, opts }); }
  catch (e) { return toast('⚠ ' + esc(e.message || String(e))); }
  if (S.cards.length === before) {
    // workflow ждёт ещё какие-то поля — открываем окно параметров, чтобы человек видел, чего не хватает
    if (!$('.sheet-back')) dispatch(card ? [card] : [null], wf, { ask: true, params, opts });
    return toast(px('Модели нужно заполнить поля — открыл окно параметров.', 'The model needs some fields — opened the settings window.'));
  }
  toast(px(`▶ Запущено: ${n} · «${esc(T(wf.title))}». Прогресс — на плитках ниже.`, `▶ Queued: ${n} · “${esc(T(wf.title))}”. Progress is on the tiles below.`)); setTimeout(pDraw, 200);
}
function infStatus(list) {
  const run = list.find(c => c.status === 'running'), q = list.filter(c => c.status === 'queued').length, err = list.filter(c => c.status === 'error').length;
  if (!run && !q && !err) return '';
  return `<div class="if-status">${run ? `<b>${esc(px('Генерация', 'Generating'))} ${Math.round((run.progress || 0) * 100)}%</b><span>${esc(runStatus(run))}</span><i style="width:${Math.round((run.progress || 0) * 100)}%"></i>` : ''}${q ? `<span>${esc(px('в очереди', 'queued'))}: ${q}</span>` : ''}${err ? `<span class="err">⚠ ${esc(px('ошибок', 'errors'))}: ${err} — ${esc(px('наведите на плитку', 'hover a tile'))}</span>` : ''}</div>`;
}
async function infDownloadSet() {
  const set = [...infJobs('portrait'), ...infJobs('sheet'), ...infJobs('angles')].filter(c => c.status === 'done' && c.file && c.kind === 'image');
  const trig = (P.inf.name || 'hero').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'hero', cap = `${trig}, ${infPrompt().replace(/^[^,]+ of /, '')}`;
  let i = 0;
  for (const c of set) {
    i++; const nm = `${trig}_${String(i).padStart(2, '0')}`;
    try { const b = await (await fetch(srcOf(c))).blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nm + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (_) { }
    const t = document.createElement('a'); t.href = URL.createObjectURL(new Blob([cap], { type: 'text/plain' })); t.download = nm + '.txt'; t.click(); setTimeout(() => URL.revokeObjectURL(t.href), 4000);
    await new Promise(r => setTimeout(r, 350));
  }
  toast(px(`Скачано: ${set.length} кадров с подписями. Триггер-слово: <b>${esc(trig)}</b>.`, `Downloaded ${set.length} images with captions. Trigger word: <b>${esc(trig)}</b>.`));
}
prodEl.addEventListener('click', e => {
  if (!P.inf.open || P.task || P.social.open) { if (e.target.closest('[data-pcat]')) P.inf.open = false; return; }
  const t = e.target, I = P.inf;
  if (t.closest('[data-pcat]')) { I.open = false; return pDraw(); }
  if (t.closest('[data-iback]')) { I.open = false; return pDraw(); }
  const st = t.closest('[data-istep]'); if (st && !st.disabled) { I.step = +st.dataset.istep; return pDraw(); }
  const lv = t.closest('[data-ilvl]'); if (lv) { I.lvl = +lv.dataset.ilvl; return pDraw(); }
  const ch = t.closest('[data-ik]'); if (ch) { const k = ch.dataset.ik, i = +ch.dataset.iv, multi = io(k)[4]; if (multi) { const a = I.v[k] || []; I.v[k] = a.includes(i) ? a.filter(x => x !== i) : [...a, i]; } else I.v[k] = I.v[k] === i ? null : i; return pDraw(); }
  if (t.closest('[data-irand]')) { infRandom(); return pDraw(); }
  if (t.closest('[data-igo4]')) { I.step = 2; pDraw(); if (!infImgWfs().length) return toast(px('Нужна модель «текст → картинка» — нажмите ◆ Z-Image Turbo.', 'You need a text → image model — click ◆ Z-Image Turbo.')); return infGen(4, 'portrait'); }
  const g = t.closest('[data-igen]'); if (g) return infGen(+g.dataset.igen, 'portrait');
  if (t.closest('[data-isheet]')) return infGen(1, 'sheet');
  if (t.closest('[data-iang]')) { const c = byId(I.pick); if (!c) return toast(px('Выберите портрет.', 'Pick a portrait.')); return infGen(1, 'angles', c); }
  const tp = t.closest('[data-itpl]'); if (tp) { const tt = (TPL || []).find(x => x.name === tp.dataset.itpl); if (!tt) return toast(px('Шаблон не найден.', 'Template not found.')); P.pendingTpl = { name: tt.name, card: '__inf', before: new Set(WFS.map(w => w.id)) }; return templateDetail(tt); }
  const bo = t.closest('[data-ibopen]'); if (bo) { I.openB = +bo.dataset.ibopen; return pDraw(); }
  if (t.closest('[data-ibclose]')) { I.openB = null; return pDraw(); }
  const pk = t.closest('[data-ipick]'); if (pk) { const c = byId(+pk.dataset.ipick); if (c?.status === 'done') { I.pick = c.id; pDraw(); } return; }
  if (t.closest('[data-isave]')) {
    if (!I.id) I.id = 'char-' + Date.now().toString(36);
    const ch2 = { id: I.id, name: (I.name || 'Hero').slice(0, 30), type: 'человек', marks: [], extra: infPrompt().replace(/^[^,]+ of /, '').slice(0, 200), portrait: I.pick || null };
    S.characters = (S.characters || []).filter(c => c.id !== ch2.id).concat([ch2]); S.cards.forEach(c => { if (c.inf === 'draft') c.inf = I.id; }); save(); try { charsToPresets(); } catch (_) { }
    return toast(px(`👤 «${esc(ch2.name)}» в Персонажах. Маэстро → «Персонаж» → на любой виджет.`, `👤 “${esc(ch2.name)}” saved to Characters. Maestro → Character → onto any widget.`));
  }
  const go = t.closest('[data-igo]'); if (go) {
    const card = pCard(go.dataset.igo), c = byId(I.pick), f = pFound(card) || [];
    if (c && f[0]) { const w = wsWidget(f[0]); if (w) bindToWidget(w, c); save(); }
    I.open = false; return pOpenCard(go.dataset.igo);
  }
  if (t.closest('[data-iset]')) return infDownloadSet();
  if (t.closest('[data-inew]')) { P.inf = { ...P.inf, step: 1, id: null, pick: null, name: '', extra: '', v: { kind: 0, gender: 0, age: 1, shot: 0, bg: 0, marks: [], acc: [] } }; S.cards.forEach(c => { if (c.inf === 'draft') c.inf = 'old-draft'; }); return pDraw(); }
});
prodEl.addEventListener('input', e => {
  if (!P.inf.open || P.task) return; const t = e.target, I = P.inf;
  if (t.matches('[data-iname]')) I.name = t.value;
  if (t.matches('[data-iextra]')) { I.extra = t.value; const pr = $('.if-prompt', prodEl); if (pr) pr.textContent = infPrompt(); }
  if (t.matches('[data-iwf]')) I.wf = t.value;
});
// прогресс вариантов обновляется сам
{ const _jc = jobChanged; let raf = 0; jobChanged = function (job) { const x = _jc.apply(this, arguments); if (P.on && P.inf.open && job?.inf && !raf) raf = requestAnimationFrame(() => { raf = 0; const ae = document.activeElement; if (!ae || !prodEl.contains(ae) || !ae.matches('input,textarea,select')) pDraw(); }); return x; }; }
// шаблон, сделанный из студии инфлюенсера, остаётся в студии
{ const _sw = saveWorkflow; saveWorkflow = async function () { const pt = P.pendingTpl && P.pendingTpl.card === '__inf' ? P.pendingTpl : null; const id = await _sw.apply(this, arguments); if (pt && id) { S.tplWf = { ...(S.tplWf || {}), [pt.name]: id }; P.pendingTpl = null; if (/z_image|flux2/.test(pt.name)) P.inf.wf = id; save(); P.task = null; P.inf.open = true; setTimeout(pDraw, 0); } return id; }; }
document.addEventListener('keydown', e => { if (P.on && P.inf.open && e.key === 'Escape' && !$('.sheet-back')) { P.inf.open = false; pDraw(); } });
