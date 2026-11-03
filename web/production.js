/* Director's Table — режим «Продакшн»: витрина задач в духе Higgsfield, но на своих открытых моделях.
   Вверху переключатель 🎬 Режиссёр | ✦ Продакшн. В Продакшне — вкладки-категории и большие карточки задач;
   клик по карточке открывает готовое рабочее место (та же «Студия виджета», что и на столе) — без нод и без зон.
   Карточки со статусом «(в разработке)» честно говорят, чего у нас пока нет, и ведут на открытые проекты других авторов. */
'use strict';

const PRU = (window.DT_LANG || 'ru') === 'ru';
const px = (ru, en) => PRU ? ru : en;
const P = { on: false, cat: 'home', task: null, q: '', social: { src: null, nets: ['instagram', 'reels', 'youtube', 'telegram', 'linkedin', 'x'], caps: {}, about: '', brand: '', ai: true } };

const PCATS = [
  ['home', '✦', 'Главная', 'Home'], ['video', '🎬', 'Видео', 'Video'], ['cinema', '🎥', 'Кино-студия', 'Cinema studio'],
  ['vfx', '⚡', 'Эффекты VFX', 'VFX'], ['avatar', '🗣', 'Липсинг и голос', 'Lipsync & voice'], ['music', '🎵', 'Музыка', 'Music'],
  ['image', '🖼', 'Картинки', 'Images'], ['social', '📱', 'Инфлюенсер и соцсети', 'Influencer & social'], ['edit', '✂', 'Монтаж и правка', 'Edit & montage'],
  ['lab', '🧪', 'В разработке', 'In development'],
];
const BUILTIN_WF = ['ltx2-vfx', 'ltx2-transition', 'ltx2-voice', 'omnivoice-tts'];
const acc = (wf, k) => (wf.accepts || []).includes(k) || (wf.params || []).some(p => p.type === k);
const L = (name, url) => ({ name, url });
// карточки: open = { wf } | { wfs } | { match } | { tool } | { fn } | { social } ; st — статус, если workflow не найден
const PCARDS = [
  // ВИДЕО
  { id: 't2v', cat: 'video', ic: '✎', a: '#3fd2ff', b: '#6f8cff', ru: 'Текст → видео', en: 'Text → video', dru: 'Опишите сцену — LTX снимет её со звуком.', den: 'Describe a scene and LTX films it with sound.', open: { match: w => w.kind === 'video' && !acc(w, 'image') && !BUILTIN_WF.includes(w.id) }, tpl: ['video_ltx2_3_t2v', 'video_ltx2_t2v_distilled'], pop: 1 },
  { id: 'i2v', cat: 'video', ic: '🖼', a: '#3fd2ff', b: '#22e6b8', ru: 'Картинка → видео', en: 'Image → video', dru: 'Оживите фото или кадр: движение, камера, звук.', den: 'Bring a photo to life: motion, camera, sound.', open: { match: w => w.kind === 'video' && acc(w, 'image') && !BUILTIN_WF.includes(w.id) }, tpl: ['video_ltx2_3_i2v', 'video_ltx2_i2v_distilled'], pop: 1 },
  { id: 'trans', cat: 'video', ic: '⇄', a: '#22e6b8', b: '#3fd2ff', ru: 'Переход кадр → кадр', en: 'Frame → frame transition', dru: 'Первый и последний кадр — плавное превращение между ними.', den: 'First and last frame, a smooth transformation between them.', open: { wf: 'ltx2-transition' }, tpl: ['video_ltx2_3_flf2v'] },
  { id: 'style', cat: 'video', ic: '🎨', a: '#ff5fa8', b: '#22e6b8', ru: 'Стиль-переход', en: 'Style transition', dru: 'Одна сцена перетекает из одного стиля в другой (LTX 2.3).', den: 'A scene morphs from one look into another (LTX 2.3).', tpl: ['template_ltx2_3_style_transition'] },
  { id: 'keys6', cat: 'video', ic: '⋯', a: '#6f8cff', b: '#ffb547', ru: '6 ключевых кадров', en: '6 key frames', dru: 'Мини-история из шести картинок одним роликом (Wan 2.2).', den: 'A mini story from six images in one clip (Wan 2.2).', tpl: ['templates-6-key-frames'] },
  { id: 'path', cat: 'video', ic: '➰', a: '#3fd2ff', b: '#ffb547', ru: 'Движение по траектории', en: 'Motion along a path', dru: 'Нарисуйте путь — объект пойдёт по нему (Wan ATI / WanMove).', den: 'Draw a path and the subject follows it (Wan ATI / WanMove).', tpl: ['video_wan_ati', 'video_wanmove_480p'] },
  // КИНО
  { id: 'film', cat: 'cinema', ic: '🎬', a: '#8f74f2', b: '#ff5fa8', ru: 'Фильм по сценарию', en: 'Film from a script', dru: 'Идея → кадры → съёмка с последнего кадра → один mp4.', den: 'Idea → shots → each starts from the last frame → one mp4.', open: { tool: 'film' }, pop: 1 },
  { id: 'cam', cat: 'cinema', ic: '◎', a: '#8f74f2', b: '#3fd2ff', ru: 'Камера-сфера', en: 'Camera sphere', dru: 'Тащите точки вокруг героя — промпт движения камеры пишется сам.', den: 'Drag points around the hero; the camera prompt writes itself.', open: { fn: () => camSphere() } },
  { id: 'moves', cat: 'cinema', ic: '↻', a: '#6f8cff', b: '#8f74f2', ru: 'Движения камеры', en: 'Camera moves', dru: 'Облёт 360°, наезд, кран, FPV — пресеты Маэстро.', den: '360° orbit, push-in, crane, FPV — Maestro presets.', open: { fn: () => maestroOpen('camera') } },
  { id: 'looks', cat: 'cinema', ic: '◐', a: '#ffb547', b: '#ff6b5e', ru: 'Кино-стили', en: 'Cinema looks', dru: 'Синий час, неон-нуар, плёнка 35 мм, анаморф.', den: 'Blue hour, neon noir, 35 mm film, anamorphic.', open: { fn: () => maestroOpen('cinema') } },
  { id: 'depth', cat: 'cinema', ic: '≋', a: '#6f8cff', b: '#22e6b8', ru: 'Повторить движение по глубине', en: 'Re-shoot from depth', dru: 'Берём глубину чужого видео — снимаем новую сцену с тем же движением.', den: 'Take depth from a video and film a new scene with the same motion.', tpl: ['video_ltx2_depth_to_video'] },
  { id: 'chars', cat: 'cinema', ic: '👤', a: '#f0ff41', b: '#22e6b8', ru: 'Персонажи', en: 'Characters', dru: 'Постоянный герой: описание добавляется в каждый кадр.', den: 'A recurring hero added to every shot.', open: { tool: 'chars' } },
  // VFX
  { id: 'vfx', cat: 'vfx', ic: '⚡', a: '#ff5fa8', b: '#ffb547', ru: 'VFX-эффект', en: 'VFX effect', dru: 'Огонь, портал, молния, аура — код рисует черновик, LTX делает реализм.', den: 'Fire, portal, lightning, aura: code draws a draft, LTX makes it real.', open: { wf: 'ltx2-vfx' }, pop: 1 },
  { id: 'fxp', cat: 'vfx', ic: '✦', a: '#ff5fa8', b: '#8f74f2', ru: 'Библиотека эффектов', en: 'Effect library', dru: '39 пресетов: кино, атмосфера, реклама, переходы, фэнтези.', den: '39 presets: cinema, atmosphere, ads, transitions, fantasy.', open: { fn: () => maestroOpen('fx') } },
  { id: 'icl', cat: 'vfx', ic: '🔥', a: '#ff6b5e', b: '#ffb547', ru: 'Управляемое видео (IC-LoRA)', en: 'Controlled video (IC-LoRA)', dru: 'Глубина, поза и контуры исходника управляют новой сценой: фон живой, движение точное.', den: 'Depth, pose and edges of a source drive the new scene: live background, exact motion.', tpl: ['video_ltx2_3_ic_lora'], links: [L('FXjutsu', 'https://github.com/audriu/fxjutsu'), L('Lightbrush Open Sauce', 'https://github.com/lightbrushproject/opensauce')] },
  { id: 'swap', cat: 'vfx', ic: '🎭', a: '#c084fc', b: '#ff5fa8', ru: 'Замена персонажа в видео', en: 'Character swap in video', dru: 'Ваш герой вместо человека в видео — движения сохраняются (Wan SCAIL).', den: 'Your hero replaces the person in a video, motion kept (Wan SCAIL).', tpl: ['video_wan21_scail2_character_replacement'], pop: 1 },
  { id: 'erase', cat: 'vfx', ic: '⌫', a: '#3fd2ff', b: '#c084fc', ru: 'Убрать объект из видео', en: 'Remove an object from video', dru: 'Выделили — объект исчез, фон дорисован (Wan VACE / VOID).', den: 'Select it and it is gone, background filled (Wan VACE / VOID).', tpl: ['video_wan_vace_inpainting', 'utility_void_video_inpainting'] },
  { id: 'outpaint', cat: 'vfx', ic: '⤡', a: '#22e6b8', b: '#6f8cff', ru: 'Расширить кадр видео', en: 'Extend the video frame', dru: 'Из вертикали в горизонталь: модель дорисует края.', den: 'Vertical to horizontal: the model paints the edges.', tpl: ['video_wan_vace_outpainting'] },
  // ГОЛОС
  { id: 'lips', cat: 'avatar', ic: '🗣', a: '#22e6b8', b: '#f0ff41', ru: 'Говорящее фото (липсинг)', en: 'Talking photo (lipsync)', dru: 'Фото + голос → человек говорит или поёт.', den: 'Photo + voice → the person speaks or sings.', open: { wf: 'ltx2-voice' }, tpl: ['video_ltx2_3_ia2v'], pop: 1 },
  { id: 'italk', cat: 'avatar', ic: '👥', a: '#22e6b8', b: '#6f8cff', ru: 'Липсинг для нескольких людей', en: 'Multi-person lipsync', dru: 'InfiniteTalk (Wan 14B) — лучшая открытая модель для губ: несколько лиц в кадре, у каждого своя дорожка голоса. Метки «кто говорит» прямо на кадре — в разработке.', den: 'InfiniteTalk (Wan 14B) — the best open lipsync model: several faces in one shot, each with its own voice track. On-frame “who speaks” markers — in development.', tpl: ['video_wan2_1_infinitetalk'] },
  { id: 'humo', cat: 'avatar', ic: '🎤', a: '#ff8a3d', b: '#22e6b8', ru: 'Персонаж по фото, тексту и звуку', en: 'Character from photo, text and audio', dru: 'HuMo: герой с вашего фото играет сцену под ваш звук.', den: 'HuMo: the hero from your photo acts out a scene to your audio.', tpl: ['video_humo'] },
  { id: 'tts', cat: 'avatar', ic: '🎙', a: '#ff8a3d', b: '#ffb547', ru: 'Озвучка из текста', en: 'Text → voice', dru: 'Голос по описанию: пол, возраст, тембр, акцент.', den: 'A voice you describe: gender, age, pitch, accent.', open: { wf: 'omnivoice-tts' } },
  { id: 'avatar', cat: 'avatar', ic: '🧑‍💼', a: '#22e6b8', b: '#ff8a3d', ru: 'Аватар из текста', en: 'Avatar from text', dru: 'Шаг 1 — голос из текста, шаг 2 — фото говорит этим голосом.', den: 'Step 1 — voice from text, step 2 — the photo speaks it.', open: { wfs: ['omnivoice-tts', 'ltx2-voice'] }, pop: 1 },
  { id: 'dub', cat: 'avatar', ic: '🌐', a: '#6f8cff', b: '#22e6b8', st: 'dev', ru: 'Перевод видео с липсингом', en: 'Video translation + lipsync', dru: 'Перевод речи и подгонка губ под новый язык.', den: 'Translate speech and re-sync the lips.', links: [] },
  // МУЗЫКА
  { id: 'music', cat: 'music', ic: '🎵', a: '#ff8a3d', b: '#ff5fa8', ru: 'Песня или фон', en: 'Song or score', dru: 'Песня с вокалом или инструментал по описанию — ACE-Step 1.5.', den: 'A song with vocals or an instrumental — ACE-Step 1.5.', open: { match: w => w.kind === 'audio' && /ace|music|song|музык|песн/i.test(w.title + ' ' + w.id) }, tpl: ['audio_ace_step_1_5_checkpoint', 'audio_ace_step_1_5_split_4b'], pop: 1 },
  { id: 'mv', cat: 'music', ic: '♫', a: '#ff5fa8', b: '#8f74f2', st: 'dev', ru: 'Клип под бит', en: 'Beat-synced music video', dru: 'Склейки и эффекты на сильных долях трека.', den: 'Cuts and effects land on the beats.', links: [] },
  // КАРТИНКИ
  { id: 't2i', cat: 'image', ic: '🖼', a: '#f0ff41', b: '#ffb547', ru: 'Текст → картинка', en: 'Text → image', dru: 'Z-Image Turbo или FLUX.2 klein — быстро и на 12 ГБ.', den: 'Z-Image Turbo or FLUX.2 klein — fast, fits 12 GB.', open: { match: w => w.kind === 'image' && !acc(w, 'image') }, tpl: ['image_z_image_turbo', 'image_flux2_klein_text_to_image'], pop: 1 },
  { id: 'edit', cat: 'image', ic: '✎', a: '#c084fc', b: '#f0ff41', ru: 'Правка фото словами', en: 'Edit a photo with words', dru: '«Сделай вечер», «смени фон», «добавь шляпу» — Qwen-Image-Edit / FLUX.2 klein.', den: '“Make it evening”, “swap the background” — Qwen-Image-Edit / FLUX.2 klein.', tpl: ['image_qwen_image_edit_2511', 'image_flux2_klein_image_edit_4b_distilled'] },
  { id: 'angles', cat: 'image', ic: '⟲', a: '#f0ff41', b: '#3fd2ff', ru: 'Ракурсы персонажа', en: 'Character angles', dru: 'Один кадр → герой с разных сторон (Qwen Multiple-Angles).', den: 'One frame → the hero from many sides (Qwen Multiple-Angles).', tpl: ['templates-1_click_multiple_character_angles-v1.0'], pop: 1, links: [L('open-higgsfield', 'https://github.com/pyoonpyoon/open-higgsfield'), L('ReAngle', 'https://github.com/Tekholms-LW/ReAngle')] },
  { id: 'sangles', cat: 'image', ic: '⌖', a: '#3fd2ff', b: '#f0ff41', ru: 'Ракурсы сцены', en: 'Scene angles', dru: 'Та же сцена с других точек камеры.', den: 'The same scene from other camera positions.', tpl: ['templates-1_click_multiple_scene_angles-v1.0'] },
  { id: 'outfit', cat: 'image', ic: '👗', a: '#c084fc', b: '#f0ff41', ru: 'Примерка одежды', en: 'Outfit swap', dru: 'Фото человека + фото вещи → примерка (Qwen-Image-Edit 2511, несколько картинок).', den: 'Person + garment photo → try-on (Qwen-Image-Edit 2511, multi-image).', tpl: ['image_qwen_image_edit_2511'] },
  { id: 'relight', cat: 'image', ic: '☀', a: '#ffb547', b: '#c084fc', ru: 'Свет и релайт', en: 'Relight', dru: 'Перенести свет с референса или задать новый.', den: 'Move lighting from a reference or set a new one.', tpl: ['templates-portrait_light_migration', 'image_qwen_image_edit_2509_relight'] },
  { id: 'real', cat: 'image', ic: '◑', a: '#f0ff41', b: '#ff8a3d', ru: 'Рисунок → фото', en: 'Drawing → photo', dru: 'Аниме, 3D или скетч превращается в реалистичное фото.', den: 'Anime, 3D or a sketch becomes a realistic photo.', tpl: ['templates-image_to_real'] },
  { id: 'bg', cat: 'image', ic: '✂', a: '#c084fc', b: '#3fd2ff', ru: 'Удалить фон', en: 'Remove background', dru: 'BiRefNet: чистый вырез для композитинга.', den: 'BiRefNet: a clean cut-out for compositing.', tpl: ['utility_birefnet_remove_background'] },
  { id: 'layers', cat: 'image', ic: '☰', a: '#6f8cff', b: '#c084fc', ru: 'Разложить на слои', en: 'Split into layers', dru: 'Картинка → отдельные слои, как в Photoshop (Qwen-Image-Layered).', den: 'An image → separate layers, like Photoshop (Qwen-Image-Layered).', tpl: ['image_qwen_image_layered'] },
  { id: 'mesh', cat: 'image', ic: '⬢', a: '#22e6b8', b: '#8f74f2', ru: 'Фото → 3D-модель', en: 'Photo → 3D model', dru: 'Hunyuan3D: объект или персонаж в 3D для Blender.', den: 'Hunyuan3D: an object or character in 3D for Blender.', tpl: ['3d_hunyuan3d_image_to_model'] },
  { id: 'product', cat: 'image', ic: '🛍', a: '#ffb547', b: '#f0ff41', ru: 'Товар в сцене', en: 'Product in a scene', dru: 'Фото товара + описание → товар в новой сцене: на столе, в руках, на витрине (Qwen-Image-Edit 2511).', den: 'Product photo + description → the product in a new scene: on a table, in hands, in a shop window (Qwen-Image-Edit 2511).', tpl: ['image_qwen_image_edit_2511'], pop: 1 },
  { id: 'productvid', cat: 'video', ic: '📦', a: '#ffb547', b: '#3fd2ff', ru: 'Рекламный ролик товара', en: 'Product ad clip', dru: 'Картинка товара → видео с пресетами «Реклама и продукт»: всплеск, блик, пар, частицы.', den: 'A product image → video with Ads & product presets: splash, light sweep, steam, particles.', open: { match: w => w.kind === 'video' && acc(w, 'image') && !BUILTIN_WF.includes(w.id) }, tpl: ['video_ltx2_3_i2v'] },
  { id: 'bgswap', cat: 'image', ic: '🏞', a: '#22e6b8', b: '#c084fc', ru: 'Новый фон', en: 'New background', dru: 'Вырезать фон (BiRefNet) и поставить свой — или сменить его словами в «Правке фото».', den: 'Cut the background (BiRefNet) and drop in your own — or change it with words in Photo edit.', tpl: ['utility_birefnet_remove_background', 'image_qwen_image_edit_2511'] },
  { id: 'sfx', cat: 'music', ic: '🔊', a: '#ff8a3d', b: '#3fd2ff', ru: 'Звук к видео', en: 'Sound for video', dru: 'LTX-2 генерирует звук вместе с картинкой: шаги, ветер, взрыв — опишите его в промпте.', den: 'LTX-2 generates sound together with the picture: steps, wind, explosion — describe it in the prompt.', open: { match: w => w.kind === 'video' && !BUILTIN_WF.includes(w.id) }, tpl: ['video_ltx2_3_t2v'] },
  // СОЦСЕТИ
  { id: 'social', cat: 'social', ic: '📱', a: '#8f74f2', b: '#22e6b8', ru: 'Превью для соцсетей', en: 'Social preview', dru: 'Как пост будет выглядеть в Instagram, Reels, YouTube, Telegram, LinkedIn, X — и подписи под каждую.', den: 'See your post in Instagram, Reels, YouTube, Telegram, LinkedIn, X — with captions for each.', open: { social: true }, pop: 1 },
  { id: 'share', cat: 'social', ic: '↗', a: '#22e6b8', b: '#f0ff41', ru: 'Ролик «до → после» 9:16', en: '“Before → after” 9:16 clip', dru: 'Вертикальный ролик с подписями для Shorts, TikTok, Reels.', den: 'A vertical clip with captions for Shorts, TikTok, Reels.', open: { fn: () => { const c = pLatest(['video']); c ? shareSheet(c) : toast(px('Сначала сгенерируйте видео.', 'Generate a video first.')); } } },
  { id: 'idlora', cat: 'social', ic: '◈', a: '#f0ff41', b: '#8f74f2', ru: 'Свой инфлюенсер: лицо и голос', en: 'Your influencer: face and voice', dru: 'LTX 2.3 ID-LoRA держит одно лицо и голос героя от ролика к ролику.', den: 'LTX 2.3 ID-LoRA keeps one face and voice across clips.', tpl: ['video_ltx2_3_id_lora'] },
  { id: 'lora', cat: 'social', ic: '⚙', a: '#8f74f2', b: '#f0ff41', st: 'dev', ru: 'Обучить LoRA героя', en: 'Train a hero LoRA', dru: 'Одно лицо → набор кадров → обучение LoRA.', den: 'One face → a dataset → train a LoRA.', links: [L('ai-toolkit', 'https://github.com/ostris/ai-toolkit')] },
  { id: 'post', cat: 'social', ic: '⇪', a: '#6f8cff', b: '#22e6b8', st: 'dev', ru: 'Автопубликация', en: 'Auto-posting', dru: 'Telegram, YouTube, X, Instagram… Ключи хранятся только у вас на компьютере.', den: 'Telegram, YouTube, X, Instagram… Keys stay on your computer only.', links: [] },
  // МОНТАЖ
  { id: 'cut', cat: 'edit', ic: '🎞', a: '#ff6b5e', b: '#ffb547', ru: 'Монтаж', en: 'Montage', dru: 'Клипы по порядку + музыка → один mp4.', den: 'Clips in order + music → one mp4.', open: { fn: () => { pSetMode('dir'); toast(px('Монтаж — на столе: тащите результаты из ленты «Вывод».', 'Montage is on the desk: drag results from the Output strip.')); } } },
  { id: 'up', cat: 'edit', ic: '⤢', a: '#3fd2ff', b: '#22e6b8', ru: 'Апскейл фото', en: 'Upscale photo', dru: 'RealESRGAN ×4 или Z-Image 2K — чётче и больше.', den: 'RealESRGAN ×4 or Z-Image 2K — sharper and bigger.', tpl: ['utility-gan_upscaler', 'utility_z_image_turbo_2k_upscaler.app'] },
  { id: 'fps', cat: 'edit', ic: '≫', a: '#22e6b8', b: '#3fd2ff', ru: 'Плавность видео', en: 'Smoother video', dru: 'Дорисовка промежуточных кадров (FILM) — 24 → 48/60 к/с.', den: 'Frame interpolation (FILM) — 24 → 48/60 fps.', tpl: ['utility_video_frame_interpolation'] },
  { id: 'inpaint', cat: 'edit', ic: '🖌', a: '#c084fc', b: '#ff5fa8', ru: 'Правка по маске', en: 'Mask edit', dru: 'Закрасьте область — FLUX Fill перерисует только её.', den: 'Paint an area and FLUX Fill redraws only it.', tpl: ['flux_fill_inpaint_example'] },
  { id: 'seg', cat: 'edit', ic: '◍', a: '#6f8cff', b: '#22e6b8', ru: 'Выделить объект', en: 'Select an object', dru: 'SAM 3: маска по слову или клику — для правок и VFX.', den: 'SAM 3: a mask from a word or a click — for edits and VFX.', tpl: ['utility_image_segment_sam3'] },
  { id: 'tpl', cat: 'edit', ic: '📚', a: '#3fd2ff', b: '#8f74f2', ru: 'Все шаблоны Comfy', en: 'All Comfy templates', dru: 'Любой официальный шаблон ComfyUI → инструмент в один клик.', den: 'Any official ComfyUI template → a tool in one click.', open: { tool: 'templates' } },
];
const pCard = id => PCARDS.find(c => c.id === id);
const pName = c => px(c.ru, c.en), pDesc = c => px(c.dru, c.den);
// workflow, сделанные из официальных шаблонов Comfy прямо из карточки: имя шаблона → id виджета
const tplWfs = c => (c.tpl || []).map(n => S.tplWf?.[n]).map(id => id && wfById(id)).filter(Boolean);
const tplHave = c => (c.tpl || []).map(n => (TPL || []).find(t => t.name === n)).filter(Boolean);
function pFound(c) {
  const o = c.open || {}, own = o.wf ? [wfById(o.wf)].filter(Boolean) : o.wfs ? o.wfs.map(wfById).filter(Boolean) : o.match ? WFS.filter(o.match) : null;
  if (o.wfs) return own.length === o.wfs.length ? own : [];
  const t = tplWfs(c);
  if (own == null && !c.tpl) return null;
  return [...new Set([...(own || []), ...t])];
}
function pStatus(c) {
  const f = pFound(c);
  if (f && f.length) return 'ready';
  if (f == null && c.open) return 'ready';
  if (tplHave(c).length) return 'tpl';
  if (f && c.open && !c.tpl) return c.st || 'soon';
  return c.st || (c.tpl ? 'soon' : 'dev');
}
const ST_TXT = { ready: ['готово', 'ready'], tpl: ['1 клик · шаблон Comfy', '1 click · Comfy template'], soon: ['нужен workflow', 'needs a workflow'], dev: ['в разработке', 'in development'] };
const ST_DOT = { ready: '●', tpl: '◆', soon: '◐', dev: '○' };
function pLatest(kinds, wfIds) { return S.cards.filter(c => c.type === 'file' && c.status === 'done' && c.file && kinds.includes(c.kind) && (!wfIds || wfIds.includes(c.actionId))).sort((a, b) => (b.done || b.created || 0) - (a.done || a.created || 0))[0] || null; }

/* ---------- каркас ---------- */
const prodEl = document.createElement('section');
prodEl.id = 'prod'; prodEl.hidden = true;
$('#stage').appendChild(prodEl);
const sw = document.createElement('div');
sw.className = 'modesw'; sw.setAttribute('data-noi18n', '');
sw.innerHTML = `<button type="button" data-mode="dir" title="${esc(px('Стол с зонами, нитями и Маэстро · Alt+Q', 'The desk with zones, threads and Maestro · Alt+Q'))}">🎬 ${esc(px('Режиссёр', 'Director'))}</button><button type="button" data-mode="prod" title="${esc(px('Витрина задач: выбрал — делаешь · Alt+Q', 'Task showcase: pick and create · Alt+Q'))}">✦ ${esc(px('Продакшн', 'Production'))}</button>`;
$('#top .brand').after(sw);
sw.onclick = e => { const b = e.target.closest('[data-mode]'); if (b) pSetMode(b.dataset.mode); };
// Alt+Q — быстро переключить Режиссёр ⇄ Продакшн (работает везде, даже в полях)
window.addEventListener('keydown', e => { if (e.altKey && !e.ctrlKey && (e.code === 'KeyQ')) { e.preventDefault(); e.stopPropagation(); pSetMode(P.on ? 'dir' : 'prod'); } }, true);
sw.insertAdjacentHTML('beforeend', '<kbd class="msw-k">Alt+Q</kbd>');
function pSetMode(m) {
  P.on = m === 'prod'; S.cfg.mode = m; save();
  document.body.classList.toggle('prod-on', P.on); prodEl.hidden = !P.on;
  $$('[data-mode]', sw).forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  if (P.on) { pDraw(); if (!TPL) loadTemplates().then(() => P.on && !P.task && pDraw()).catch(() => { }); } else render();
}

function pDraw() {
  if (!P.on) return;
  const cats = PCATS.map(([id, ic, ru, en]) => { const n = id === 'home' ? '' : id === 'lab' ? PCARDS.filter(c => pStatus(c) === 'dev').length : PCARDS.filter(c => c.cat === id).length; return `<button type="button" class="pn-cat${P.cat === id && !P.task ? ' on' : ''}" data-pcat="${id}"><i>${PICON(PI_CAT[id] || 'sparkle')}</i><span>${esc(px(ru, en))}</span>${n ? `<em>${n}</em>` : ''}</button>`; }).join('');
  prodEl.innerHTML = `<nav class="pn" data-noi18n><div class="pn-h">${esc(px('СОЗДАТЬ', 'CREATE'))}</div>${cats}<div class="pn-foot"><span class="pill lime">● ${esc(px('локально · открытые модели', 'local · open weights'))}</span></div></nav><div class="pmain" id="pMain"></div>`;
  const main = $('#pMain', prodEl);
  if (P.task) return pTask(main);
  if (P.cat === 'social' && P.social.open) return pSocial(main);
  main.setAttribute('data-noi18n', '');
  const list = P.cat === 'home' ? PCARDS.filter(c => c.pop) : P.cat === 'lab' ? PCARDS.filter(c => pStatus(c) === 'dev') : PCARDS.filter(c => c.cat === P.cat);
  const q = P.q.trim().toLowerCase(), shown = q ? PCARDS.filter(c => (pName(c) + ' ' + pDesc(c) + ' ' + c.ru + ' ' + c.en).toLowerCase().includes(q)) : list;
  const cat = PCATS.find(x => x[0] === P.cat);
  const done = S.cards.filter(c => c.type === 'file' && c.status === 'done').length, ready = PCARDS.filter(c => pStatus(c) === 'ready').length;
  const hero = P.cat === 'home' ? `<div class="ph-eyebrow">DIRECTOR'S TABLE · PRODUCTION</div><h1>${esc(px('Что создаём сегодня?', 'What are we making today?'))}</h1>
    <div class="pstats"><div class="pst"><span>${esc(px('ГОТОВЫХ ИНСТРУМЕНТОВ', 'READY TOOLS'))}</span><b>${ready}</b><em class="pill">↗ ${esc(px('из ' + PCARDS.length, 'of ' + PCARDS.length))}</em></div><div class="pst"><span>${esc(px('WORKFLOW НА СТОЛЕ', 'WORKFLOWS ON THE DESK'))}</span><b>${WFS.length}</b><em class="pill">${esc(px('любой ComfyUI', 'any ComfyUI'))}</em></div><div class="pst"><span>${esc(px('ГЕНЕРАЦИЙ', 'GENERATIONS'))}</span><b>${done}</b><em class="pill lime">${esc(px('всё у вас на диске', 'all on your disk'))}</em></div><div class="pst"><span>${esc(px('ОБЛАКО И ПОДПИСКИ', 'CLOUD & SUBSCRIPTIONS'))}</span><b>0</b><em class="pill lime">open weights</em></div></div>`
    : `<div class="ph-eyebrow">${PICON(PI_CAT[cat[0]] || 'sparkle', 'sm')} ${esc(px(cat[2], cat[3]).toUpperCase())}</div><h1>${esc(px(cat[2], cat[3]))}</h1>`;
  main.innerHTML = `<header class="phead">${hero}<input class="psearch" type="search" placeholder="${esc(px('Найти инструмент: липсинг, музыка, ракурс…', 'Find a tool: lipsync, music, angle…'))}" value="${esc(P.q)}"></header>
    ${q ? `<div class="psec">${esc(px('Найдено', 'Found'))}: ${shown.length}</div>` : P.cat === 'home' ? `<div class="psec">${esc(px('ПОПУЛЯРНОЕ', 'POPULAR'))}</div>` : ''}
    <div class="pgrid">${shown.map(pCardHTML).join('') || `<div class="hint">${esc(px('Ничего не нашлось.', 'Nothing found.'))}</div>`}</div>
    ${P.cat === 'home' && !q ? pRecentHTML() : ''}
    ${P.cat === 'lab' ? `<p class="pnote">${esc(px('Здесь то, чего в студии пока нет. Мы не берём чужой код — карточка показывает план и открытые проекты других авторов, которыми можно воспользоваться уже сейчас.', 'Things the studio does not do yet. We do not copy other people\'s code — each card shows the plan and open projects by other authors you can use today.'))}</p>` : ''}`;
}
function pCardHTML(c) {
  const st = pStatus(c), f = pFound(c), last = f && f.length ? pLatest(['image', 'video'], f.map(w => w.id)) : null;
  return `<button type="button" class="pcard st-${st}" data-pcard="${c.id}" style="--a:${c.a};--b:${c.b}"><div class="pc-art">${last ? mediaHTML(last) : (() => { const t = tplHave(c)[0]; return t ? `<img class="pc-tplimg" src="${esc(API.url('/templates/' + t.name + '-1.' + (t.mediaSubtype || 'webp')))}" alt="" loading="lazy">` : ''; })()}<i class="pc-ic">${PICON(PI_CARD[c.id] || 'sparkle')}</i></div><div class="pc-tx"><b>${esc(pName(c))}</b><span>${esc(pDesc(c))}</span></div><em class="pill st">${ST_DOT[st]} ${esc(px(...ST_TXT[st]))}</em></button>`;
}
function pRecentHTML() {
  const r = S.cards.filter(c => c.type === 'file' && c.status === 'done' && c.file && ['image', 'video'].includes(c.kind)).sort((a, b) => (b.done || 0) - (a.done || 0)).slice(0, 12);
  return r.length ? `<div class="psec">${esc(px('НЕДАВНИЕ РЕЗУЛЬТАТЫ', 'RECENT RESULTS'))}</div><div class="precent">${r.map(c => `<button type="button" class="prc" data-pres="${c.id}" title="${esc(c.title)}">${mediaHTML(c)}</button>`).join('')}</div>` : '';
}

/* ---------- рабочее место задачи ---------- */
const P_SUBS = ['screen', 'prompt', 'inputs', 'params', 'history', 'info'];
function pTask(main) {
  const c = pCard(P.task), st = pStatus(c), f = pFound(c) || [];
  main.removeAttribute('data-noi18n');
  const head = `<header class="ptask-h" data-noi18n><button type="button" class="pback" data-pback>← ${esc(px('Все инструменты', 'All tools'))}</button><div><div class="ph-eyebrow">${PICON(PI_CARD[c.id] || 'sparkle', 'sm')} ${esc(px(...PCATS.find(x => x[0] === c.cat).slice(2)).toUpperCase())}</div><h2>${esc(pName(c))}</h2><p>${esc(pDesc(c))}</p></div><em class="pill st st-${st}">${esc(px(...ST_TXT[st]))}</em></header>`;
  if (st === 'tpl') {
    const ts = tplHave(c);
    main.innerHTML = head + `<div class="pdev ptpl" data-noi18n><p>${esc(px('Это делается официальным шаблоном ComfyUI на открытых моделях — он уже установлен вместе с ComfyUI. Один клик: стол проверит, какие модели у вас есть, даст ссылки на недостающие и сделает из шаблона инструмент. Потом здесь откроется готовое рабочее место.', 'This runs on an official ComfyUI template with open models — it ships with ComfyUI. One click: the desk checks which models you have, links the missing ones and turns the template into a tool. Then a ready workspace opens here.'))}</p>
      <div class="ptpls">${ts.map(t => `<button type="button" class="ptplc" data-pmake="${esc(t.name)}"><img src="${esc(API.url('/templates/' + t.name + '-1.' + (t.mediaSubtype || 'webp')))}" alt="" loading="lazy" class="pc-tplimg"><b>${esc(t.title || t.name)}</b><span>${esc((t.description || '').slice(0, 140))}</span>${(t.models || []).length ? `<em>${esc(t.models.join(' · '))}</em>` : ''}<i class="pbtn main">◆ ${esc(px('Проверить модели и сделать инструмент', 'Check models and make the tool'))}</i></button>`).join('')}</div>
      ${(c.links || []).length ? `<p class="pnote">${esc(px('Похожие открытые проекты других авторов:', 'Similar open projects by other authors:'))}</p><div class="plinks">${c.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">↗ ${esc(l.name)}<span>${esc(l.url.replace(/^https:\/\//, ''))}</span></a>`).join('')}</div>` : ''}
      <p class="pnote">${esc(px('Тяжёлые модели (14–22B) на 12 ГБ работают медленнее; в шаблоне можно взять облегчённые версии (fp8, GGUF). Лицензии моделей проверяйте перед коммерческим использованием.', 'Big models (14–22B) run slower on 12 GB; lighter versions (fp8, GGUF) can be swapped in. Check model licenses before commercial use.'))}</p></div>`;
    return;
  }
  if (st !== 'ready') {
    const o = c.open || {};
    main.innerHTML = head + `<div class="pdev" data-noi18n><p>${st === 'soon' ? esc(px('Для этого нужен workflow, которого пока нет на вашем столе. Его можно взять из официальных шаблонов ComfyUI или добавить свой.', 'This needs a workflow that is not on your desk yet. Take one from the official ComfyUI templates or add your own.')) : esc(px('Этого в студии пока нет — в планах. А пока можно воспользоваться открытыми проектами других авторов:', 'The studio does not do this yet — it is on the roadmap. Meanwhile, open projects by other authors:'))}</p>
      ${(c.links || []).length ? `<div class="plinks">${c.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">↗ ${esc(l.name)}<span>${esc(l.url.replace(/^https:\/\//, ''))}</span></a>`).join('')}</div>` : ''}
      <div class="pacts">${o.tpl ? `<button type="button" class="pbtn main" data-ptpl>📚 ${esc(px('Найти в шаблонах Comfy', 'Find in Comfy templates'))}</button>` : ''}<button type="button" class="pbtn" data-ptool="import-wf">＋ ${esc(px('Добавить свой workflow', 'Add your own workflow'))}</button><button type="button" class="pbtn" data-ptool="comfy-wf">🗂 ${esc(px('Мои workflow из ComfyUI', 'My ComfyUI workflows'))}</button></div>
      <p class="pnote">${esc(px('Ссылки ведут на сторонние открытые проекты; мы не включаем их код в студию. Проверяйте лицензии моделей перед коммерческим использованием.', 'Links lead to third-party open projects; their code is not part of the studio. Check model licenses before commercial use.'))}</p></div>`;
    return;
  }
  const o = c.open || {};
  if (f.length > 1 && !o.wfs && !P.pick) {
    main.innerHTML = head + `<div class="ppick" data-noi18n><b>${esc(px('Какой workflow взять?', 'Which workflow?'))}</b><div class="ws-wfs">${f.map(w => `<button type="button" data-ppick="${esc(w.id)}" style="--c:${KIND_C[w.kind] || '#8f74f2'}"><i></i><span>${esc(T(w.title))}</span></button>`).join('')}</div></div>`;
    return;
  }
  const wfs = o.wfs ? f : [wfById(P.pick) && f.some(w => w.id === P.pick) ? wfById(P.pick) : f[0]];
  // есть готовый виджет, но для этой задачи есть и официальный шаблон Comfy — предложим как вариант получше
  const altT = !o.wfs ? tplHave(c).filter(t => !S.tplWf?.[t.name] || !wfById(S.tplWf[t.name])) : [];
  const alt = altT.length ? `<div class="palt" data-noi18n>${PICON('sparkle', 'sm')} <span>${esc(px('Есть и другой вариант — официальный шаблон Comfy:', 'There is another option — an official Comfy template:'))}</span>${altT.map(t => `<button type="button" class="pbtn small" data-pmake="${esc(t.name)}">◆ ${esc(t.title || t.name)}</button>`).join('')}</div>` : '';
  main.innerHTML = head + alt + (wfs.length === 1 ? `<div class="pguide" data-gwf="${esc(wfs[0].id)}"></div>` : '') + `<div class="pws n${wfs.length}">${wfs.map((w, i) => `<div class="pws-col">${wfs.length > 1 ? `<div class="pstep" data-noi18n><b>${i + 1}</b>${esc(i ? px('Фото говорит этим голосом', 'The photo speaks it') : px('Голос из текста', 'Voice from text'))}${i ? `<button type="button" class="pbtn small" data-phand="${esc(wfs[0].id)}>${esc(w.id)}">↓ ${esc(px('взять голос из шага 1', 'use the voice from step 1'))}</button>` : ''}</div>` : ''}<div class="zone-panel pwsp" data-panel="wstudio" data-parea="p_${esc(w.id)}" data-pwf="${esc(w.id)}" style="--c:${wfColor(w) || '#3fd2ff'}"></div></div>`).join('')}</div>`;
  pRefresh();
}
const pAreaOf = el => ({ id: el.dataset.parea, wf: el.dataset.pwf, subs: P_SUBS });
function pRefresh() { if (!P.on || !P.task) return; $$('.pguide', prodEl).forEach(g => { try { pGuide(g); } catch (e) { console.warn('guide', e); } }); $$('.pwsp', prodEl).forEach(el => { try { wsFill(el, pAreaOf(el)); pPromptTools(el); } catch (e) { console.warn('prod', e); } }); }
// у поля промпта — 🎙 надиктовать (Whisper, локально) и ✨ улучшить (Ollama, локально)
// короткие подсказки под каждым параметром рабочего места
const P_HINT = {
  effect: ['какой эффект нарисует код: огонь, портал, молния, искры…', 'which effect the code draws: fire, portal, lightning, sparks…'],
  size: ['размер эффекта в кадре: 0,2 — маленький, 0,6 — на полкадра', 'effect size: 0.2 small, 0.6 half the frame'],
  intensity: ['яркость черновика: 1 — обычно, выше — эффект заметнее', 'draft brightness: 1 is normal, higher is stronger'],
  guide: ['0,3–0,4 — живое движение; 0,6+ — кадр почти «замерзает»', '0.3–0.4 lively motion; 0.6+ the frame nearly freezes'],
  seconds: ['длина ролика; меньше — быстрее генерация', 'clip length; shorter renders faster'],
  format: ['размер кадра: как у картинки, 16:9 или 9:16', 'frame size: like the image, 16:9 or 9:16'],
  strength: ['0,7 — держится за фото; 0,4–0,5 — больше движения губ и лица', '0.7 sticks to the photo; 0.4–0.5 more lip and face motion'],
  speed: ['1 — обычная скорость речи', '1 is normal speech speed'],
  voice: ['опишите голос по-английски: female, young, warm, low pitch…', 'describe the voice: female, young, warm, low pitch…'],
  seed: ['пусто — каждый раз новый вариант; число — повторить тот же', 'empty — a new variant each time; a number repeats it'],
  steps: ['больше шагов — качественнее, но дольше', 'more steps — better but slower'],
  cfg: ['насколько строго следовать промпту', 'how strictly to follow the prompt'],
  denoise: ['насколько сильно менять исходник', 'how much to change the source'],
};
function pParamHints(el) {
  el.querySelectorAll('.ws-params label').forEach(l => {
    if (l.querySelector('.ws-hint')) return;
    const inp = l.querySelector('[data-wspar]'); const id = String(inp?.dataset.wspar || '').toLowerCase();
    const k = Object.keys(P_HINT).find(k => id === k || id.includes(k)); if (!k) return;
    l.insertAdjacentHTML('beforeend', `<small class="ws-hint" data-noi18n>${esc(px(...P_HINT[k]))}</small>`);
  });
}
function pPromptTools(el) {
  pParamHints(el);
  const ta = el.querySelector('[data-wsprompt]'); if (!ta) return;
  if (!ta.id) ta.id = 'pp_' + String(el.dataset.pwf).replace(/[^\w-]/g, '_');
  const row = el.querySelector('.ws-prompt .ws-row'); if (!row || row.querySelector('.pp-tools')) return;
  row.insertAdjacentHTML('afterbegin', `<span class="pp-tools" data-noi18n><button type="button" class="pbtn small" data-dict="${ta.id}" title="${esc(px('Надиктовать голосом — клик: старт/стоп, или удерживайте', 'Dictate — click to start/stop, or hold'))}">${PICON('mic')} ${esc(px('Голосом', 'Dictate'))}</button><button type="button" class="pbtn small" data-penh title="${esc(px('Локальная модель превратит пожелание в правильный промпт', 'A local model turns your wish into a proper prompt'))}">${PICON('sparkle')} ${esc(px('Улучшить', 'Enhance'))}</button></span>`);
}
prodEl.addEventListener('click', async e => {
  const b = e.target.closest('[data-penh]'); if (!b) return;
  const el = b.closest('.pwsp'), wf = el && wfById(el.dataset.pwf), ta = el?.querySelector('[data-wsprompt]'); if (!wf || !ta) return;
  if (!ta.value.trim()) return toast(px('Сначала напишите или надиктуйте пожелание.', 'Write or dictate a wish first.'));
  b.disabled = true; const old = b.innerHTML; b.innerHTML = '…';
  try { const j = await enhancePrompt(wf, ta.value, ''); if (j.text) { ta.value = j.text; ta.dispatchEvent(new Event('input', { bubbles: true })); } }
  catch (err) { toast('✨ ' + esc(err.message)); }
  b.disabled = false; b.innerHTML = old;
});
{ const _r = render; render = function () { const x = _r.apply(this, arguments); if (P.on) P.task ? pRefresh() : null; return x; }; }
{ const _jc = jobChanged; let raf = 0; jobChanged = function () { const x = _jc.apply(this, arguments); if (P.on && P.task && !raf) raf = requestAnimationFrame(() => { raf = 0; pRefresh(); }); return x; }; }
setInterval(() => { if (P.on && P.task && S.cards.some(c => c.status === 'running')) pRefresh(); }, 1000);

// шаблон, превращённый в виджет из карточки, привязываем к карточке — и сразу открываем рабочее место
{ const _sw = saveWorkflow; saveWorkflow = async function () {
  const id = await _sw.apply(this, arguments);
  const pt = P.pendingTpl;
  if (pt && id) { S.tplWf = { ...(S.tplWf || {}), [pt.name]: id }; P.pendingTpl = null; save(); if (P.on) { P.task = pt.card; P.pick = id; setTimeout(pDraw, 0); } }
  return id;
}; }
prodEl.addEventListener('error', e => { if (e.target.matches?.('.pc-tplimg')) e.target.remove(); }, true);


/* ---------- шаги «что сделать» над рабочим местом: файлы → описание → запуск ---------- */
let pgAudio = null;
const PG_KIND = { image: ['Фото или картинка', 'Photo or image', 'image', 'Перетащите сюда картинку или нажмите', 'Drop an image here or click'], audio: ['Голос или звук', 'Voice or sound', 'mic', 'mp3 / wav — перетащите или нажмите. Нет голоса? Сделайте его в «Озвучке из текста».', 'mp3 / wav — drop or click. No voice yet? Make one in “Text → voice”.'], video: ['Видео', 'Video', 'video', 'Перетащите сюда видео или нажмите', 'Drop a video here or click'] };
function pGuide(g) {
  const wf = wfById(g.dataset.gwf); if (!wf) return;
  const w = wsWidget(wf), ins = [...new Set([...Object.values(w?.bound || {}), w?.lastInput].filter(Boolean))].map(byId).filter(c => c && c.type === 'file');
  const kinds = [...new Set([...(wf.accepts || []), ...(wf.params || []).filter(p => ['image', 'video', 'audio'].includes(p.type)).map(p => p.type)])].filter(k => PG_KIND[k]);
  const pp = promptParam(wf), jobs = w ? jobsOf(w) : [], run = jobs.find(c => c.status === 'running'), running = !!run || jobs.some(c => c.status === 'queued');
  let n = 0, allIn = true;
  const steps = kinds.map(k => { const c = ins.find(x => x.kind === k), K = PG_KIND[k]; if (!c) allIn = false; n++;
    return `<button type="button" class="pg-step pg-in${c ? ' ok' : ''}" data-pgadd="${k}"><span class="pg-n">${c ? PICON('check') : n}</span><span class="pg-th">${c ? (k === 'audio' ? `<i class="pg-play${pgAudio && pgAudio.dataset.id == c.id && !pgAudio.paused ? ' on' : ''}" data-pgplay="${c.id}" title="${esc(px('Прослушать', 'Listen'))}">${PICON(pgAudio && pgAudio.dataset.id == c.id && !pgAudio.paused ? 'sound' : 'play')}</i>` : mediaHTML(c)) : PICON(K[2])}</span><span class="pg-tx"><b>${esc(px(K[0], K[1]))}</b><small>${c ? esc(c.title) + ' · ' + esc(px('нажмите, чтобы заменить', 'click to replace')) : esc(px(K[3], K[4]))}</small></span>${!c && k === 'audio' && pCard('tts') ? `<i class="pg-link" data-pgtts>${esc(px('→ Озвучка', '→ Text to voice'))}</i>` : ''}</button>`; });
  const ptP = (wf.params || []).find(p => p.type === 'point'), src = ptP && ins.find(x => x.kind === 'image');
  if (ptP && src) { n++; const pt = (S.lastParams[wf.id] || {})[ptP.id] || ptP.default || [.5, .5];
    steps.push(`<div class="pg-step pg-point ok"><span class="pg-n">${n}</span><span class="pg-pt" data-pgpoint="${esc(ptP.id)}" title="${esc(px('Кликните, где будет эффект', 'Click where the effect goes'))}">${mediaHTML(src)}<i style="left:${pt[0] * 100}%;top:${pt[1] * 100}%"></i></span><span class="pg-tx"><b>${esc(px('Где эффект', 'Where the effect goes'))}</b><small>${esc(px('кликните по кадру слева', 'click on the frame'))}</small></span></div>`); }
  if (pp) { n++; steps.push(`<div class="pg-step pg-txt ok"><span class="pg-n">${n}</span><span class="pg-tx"><b>${esc(px('Опишите, что происходит', 'Describe what happens'))}</b><small>${esc(px('поле справа — можно по-русски, ✨ улучшит промпт', 'the field on the right — any language; ✨ improves the prompt'))}</small></span></div>`); }
  n++;
  steps.push(`<button type="button" class="pg-step pg-run${allIn ? ' ready' : ''}" data-pgrun ${running ? 'disabled' : ''}><span class="pg-n">${PICON('play')}</span><span class="pg-tx"><b>${run ? esc(px('Генерация', 'Generating')) + ' ' + Math.round((run.progress || 0) * 100) + '%' : running ? esc(px('В очереди…', 'Queued…')) : esc(px('Запустить', 'Run'))}</b><small>${run ? esc(runStatus(run)) : allIn ? esc(px('всё готово · Ctrl+Enter', 'all set · Ctrl+Enter')) : esc(px('сначала добавьте файлы выше', 'add the files first'))}</small>${run ? `<i class="pg-bar" style="width:${Math.round((run.progress || 0) * 100)}%"></i>` : ''}</span></button>`);
  const sig = steps.join('');
  if (g.dataset.sig !== sig) { g.dataset.sig = sig; g.innerHTML = `<div class="pg-h">${esc(px('ЧТО СДЕЛАТЬ', 'WHAT TO DO'))}</div><div class="pg-row">${sig}</div>`; }
}
prodEl.addEventListener('click', e => {
  const t = e.target, g = t.closest('.pguide'); if (!g) return;
  const wf = wfById(g.dataset.gwf); if (!wf) return;
  if (t.closest('[data-pgtts]')) { e.stopPropagation(); return pOpenCard('tts'); }
  const pl = t.closest('[data-pgplay]'); if (pl) {
    e.stopPropagation(); const c = byId(+pl.dataset.pgplay); if (!c) return;
    if (pgAudio && pgAudio.dataset.id == c.id && !pgAudio.paused) { pgAudio.pause(); }
    else { try { pgAudio?.pause(); } catch (_) { } pgAudio = new Audio(srcOf(c)); pgAudio.dataset.id = c.id; pgAudio.onended = pgAudio.onpause = () => pRefresh(); pgAudio.play().catch(() => toast(px('Не удалось воспроизвести.', 'Could not play.'))); }
    return setTimeout(pRefresh, 50);
  }
  const pt = t.closest('[data-pgpoint]'); if (pt) { const r = pt.getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)); S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [pt.dataset.pgpoint]: [+x.toFixed(3), +y.toFixed(3)] }; save(); g.dataset.sig = ''; return pGuide(g); }
  const a = t.closest('[data-pgadd]'); if (a) return pickFileFor(wsWidget(wf), a.dataset.pgadd);
  const r = t.closest('[data-pgrun]'); if (r && !r.disabled) {
    if (!r.classList.contains('ready')) return toast(px('Сначала добавьте файлы: нажмите на пустой шаг.', 'Add the files first: click an empty step.'));
    $(`.pwsp[data-pwf="${CSS.escape(wf.id)}"] [data-wsrun]`, prodEl)?.click();
  }
});

/* ---------- действия ---------- */
function pOpenCard(id) {
  const c = pCard(id), o = c.open || {}, st = pStatus(c);
  if (st === 'ready' && o.tool) return $(`#corner [data-tool="${o.tool}"]`)?.click();
  if (st === 'ready' && o.fn) return o.fn();
  if (o.social) { P.cat = 'social'; P.social.open = true; P.task = null; return pDraw(); }
  P.task = id; P.pick = null; pDraw();
}
prodEl.addEventListener('click', e => {
  const t = e.target;
  const cat = t.closest('[data-pcat]'); if (cat) { P.cat = cat.dataset.pcat; P.task = null; P.q = ''; P.social.open = false; return pDraw(); }
  const pc = t.closest('[data-pcard]'); if (pc) return pOpenCard(pc.dataset.pcard);
  if (t.closest('[data-pback]')) { P.task = null; return pDraw(); }
  const pr = t.closest('[data-pres]'); if (pr) return openDetails(byId(+pr.dataset.pres));
  const mk = t.closest('[data-pmake]'); if (mk) { const tt = (TPL || []).find(x => x.name === mk.dataset.pmake); if (tt) { P.pendingTpl = { name: tt.name, card: P.task, before: new Set(WFS.map(w => w.id)) }; templateDetail(tt); } return; }
  const pk = t.closest('[data-ppick]'); if (pk) { P.pick = pk.dataset.ppick; return pDraw(); }
  const tl = t.closest('[data-ptool]'); if (tl) return $(`#corner [data-tool="${tl.dataset.ptool}"]`)?.click();
  if (t.closest('[data-ptpl]')) { const o = pCard(P.task).open; tplF.kind = o.tpl[0]; tplF.q = o.tpl[1]; tplF.src = 'local'; return templatesSheet(); }
  const hd = t.closest('[data-phand]'); if (hd) {
    const [from, to] = hd.dataset.phand.split('>'), a = pLatest(['audio'], [from]), w = wsWidget(wfById(to));
    if (!a) return toast(px('Сначала сделайте голос в шаге 1.', 'Make the voice in step 1 first.'));
    if (w && bindToWidget(w, a)) { save(); pRefresh(); toast(px('Голос подключён к шагу 2.', 'Voice connected to step 2.')); }
    return;
  }
  if (P.social.open) return pSocialClick(e);
  // рабочее место (та же логика, что у «Студии виджета» на столе)
  const el = t.closest('.pwsp'); if (!el) return;
  const a = pAreaOf(el), wf = wfById(a.wf); if (!wf) return;
  const w = wsWidget(wf);
  if (t.closest('[data-wsrun]')) {
    const pp = promptParam(wf), ta = el.querySelector('[data-wsprompt]');
    if (pp && ta) { S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [pp.id]: ta.value }; save(); }
    runWidgetWith(w, pp && ta && ta.value.trim() ? { __prompt: ta.value } : {}); return;
  }
  const add = t.closest('[data-wsadd]'); if (add) return pickFileFor(w, add.dataset.wsadd);
  const h = t.closest('[data-wshist]'); if (h) { wsSel[a.id] = +h.dataset.wshist; wsUpdate(el, a, wf); }
});
prodEl.addEventListener('dblclick', e => { const h = e.target.closest('[data-wshist]'); if (h) openDetails(byId(+h.dataset.wshist)); });
prodEl.addEventListener('input', e => {
  if (e.target.matches('.psearch')) { P.q = e.target.value; const pos = e.target.selectionStart; pDraw(); const i = $('.psearch', prodEl); if (i) { i.focus(); i.setSelectionRange(pos, pos); } return; }
  if (P.social.open) return pSocialInput(e);
  const el = e.target.closest('.pwsp'); if (!el) return;
  const wf = wfById(el.dataset.pwf); if (!wf) return;
  if (e.target.matches('[data-wsprompt]')) { const pp = promptParam(wf); if (pp) { S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [pp.id]: e.target.value }; save(); } }
  if (e.target.matches('[data-wspar]')) { const p = (wf.params || []).find(x => x.id === e.target.dataset.wspar); if (p) { const v = p.type === 'select' ? +e.target.value : e.target.value === '' ? '' : +e.target.value; S.lastParams[wf.id] = { ...(S.lastParams[wf.id] || {}), [p.id]: v }; save(); } }
});
prodEl.addEventListener('keydown', e => {
  e.stopPropagation(); // в Продакшне цифры и буквы — это текст, а не клавиши пианино
  if (e.target.matches?.('[data-wsprompt]') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.target.closest('.pwsp')?.querySelector('[data-wsrun]')?.click(); }
});
prodEl.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
prodEl.addEventListener('drop', async e => {
  if (!e.dataTransfer?.files?.length) return; e.preventDefault(); e.stopPropagation();
  const files = [...e.dataTransfer.files].filter(f => !/\.json$/i.test(f.name) && kindOfFile(f));
  const el = e.target.closest('.pwsp') || $('.pwsp', prodEl);
  for (const f of files) {
    const kind = kindOfFile(f);
    try {
      const file = await API.upload(f); const c = { id: S.nextId++, type: 'file', sheet: S.sheet, kind, title: f.name.replace(/\.[^.]+$/, ''), file, status: 'ready', created: Date.now(), parked: false };
      S.cards.push(c); placeCard(c, areaForKind(kind, c.title));
      if (el) { const wf = wfById(el.dataset.pwf), w = wf && wsWidget(wf); if (w && !bindToWidget(w, c)) toast(px(`«${esc(T(wf.title))}» не принимает этот файл.`, `“${esc(T(wf.title))}” does not take this file.`)); }
      else if (P.social.open && ['image', 'video'].includes(kind)) P.social.src = c.id;
    } catch (err) { toast('⚠ ' + esc(err.message)); }
  }
  save(); P.on && (P.task ? pRefresh() : pDraw());
});
document.addEventListener('keydown', e => { if (P.on && e.key === 'Escape' && !$('.sheet-back') && (P.task || P.social.open)) { P.task = null; P.social.open = false; pDraw(); } });

/* ---------- инфлюенсер и соцсети: превью поста в рамках соцсетей ---------- */
const NETS = {
  instagram: { n: 'Instagram', ar: 4 / 5, sz: [1080, 1350], fr: 'post' },
  reels: { n: 'Reels · TikTok', ar: 9 / 16, sz: [1080, 1920], fr: 'vert' },
  youtube: { n: 'YouTube', ar: 16 / 9, sz: [1920, 1080], fr: 'yt' },
  shorts: { n: 'Shorts', ar: 9 / 16, sz: [1080, 1920], fr: 'vert' },
  telegram: { n: 'Telegram', ar: null, sz: null, fr: 'tg' },
  linkedin: { n: 'LinkedIn', ar: 1, sz: [1200, 1200], fr: 'post' },
  x: { n: 'X', ar: 16 / 9, sz: [1600, 900], fr: 'post' },
  facebook: { n: 'Facebook', ar: 4 / 5, sz: [1080, 1350], fr: 'post' },
};
function pSocial(main) {
  const s = P.social, src = byId(s.src) || pLatest(['image', 'video']); if (src) s.src = src.id;
  const sar = src?.w && src?.h ? src.w / src.h : null;
  const media = src ? mediaHTML(src, { autoplay: src.kind === 'video' }) : `<div class="ps-empty">${esc(px('Перетащите сюда фото или видео', 'Drop a photo or video here'))}</div>`;
  const brand = s.brand || 'your.brand', cap = n => s.caps[n] || '', tag = s.ai ? '\n\n#AIgenerated' : '';
  const frame = k => {
    const N = NETS[k], ar = N.ar || sar || 1, crop = sar && N.ar ? (Math.abs(sar - N.ar) / N.ar > .12 ? (sar > N.ar ? px('обрежется по бокам', 'sides will be cropped') : px('обрежется сверху и снизу', 'top & bottom will be cropped')) : '') : '';
    const top = N.fr === 'post' || N.fr === 'tg' ? `<div class="sf-top"><i class="sf-av"></i><b>${esc(brand)}</b><span>${N.fr === 'tg' ? px('канал', 'channel') : '···'}</span></div>` : '';
    const ui = N.fr === 'vert' ? `<div class="sf-side">♥<br>💬<br>↗</div><div class="sf-cap"><b>@${esc(brand)}</b><span>${esc((cap(k) || '').slice(0, 90))}</span></div><div class="sf-safe" title="${esc(px('Безопасная зона: сюда не ставьте текст', 'Safe zone: keep text out'))}"></div>` : N.fr === 'yt' ? `<div class="sf-play">▶</div>` : '';
    return `<div class="sframe fr-${N.fr}" data-net="${k}"><div class="sf-h"><b>${esc(N.n)}</b><span>${N.ar ? (N.sz[0] + '×' + N.sz[1]) : px('как есть', 'as is')}</span>${crop ? `<em class="pill warn">✂ ${esc(crop)}</em>` : ''}</div>
      <div class="sf-dev">${top}<div class="sf-media" style="aspect-ratio:${ar}">${media}${ui}</div>${N.fr === 'yt' ? `<div class="sf-ytt"><i class="sf-av"></i><b>${esc((cap(k) || pName(pCard('social'))).split('\n')[0].slice(0, 70))}</b></div>` : ''}${N.fr === 'post' || N.fr === 'tg' ? `<div class="sf-acts">${N.fr === 'tg' ? '👁 1.2K' : '♡ 💬 ↗'}</div>` : ''}</div>
      <textarea data-scap="${k}" rows="4" placeholder="${esc(px('Подпись для ', 'Caption for ') + N.n)}">${esc(cap(k) + (cap(k) ? tag : ''))}</textarea><div class="sf-row"><button type="button" class="pbtn small" data-scopy="${k}">⧉ ${esc(px('Копировать', 'Copy'))}</button>${src?.kind === 'image' && N.sz ? `<button type="button" class="pbtn small" data-sdl="${k}">⬇ ${N.sz[0]}×${N.sz[1]}</button>` : ''}</div></div>`;
  };
  main.removeAttribute('data-noi18n');
  main.innerHTML = `<header class="ptask-h" data-noi18n><button type="button" class="pback" data-sback>← ${esc(px('Соцсети', 'Social'))}</button><div><div class="ph-eyebrow">${PICON('phone', 'sm')} ${esc(px('ИНФЛЮЕНСЕР И СОЦСЕТИ', 'INFLUENCER & SOCIAL'))}</div><h2>${esc(px('Как пост будет выглядеть везде', 'See your post everywhere'))}</h2><p>${esc(px('Выберите результат, напишите, о чём пост, — локальная нейросеть напишет подписи под каждую соцсеть. Ничего не публикуется.', 'Pick a result, say what the post is about — a local model writes a caption for each network. Nothing is posted.'))}</p></div></header>
    <div class="psoc" data-noi18n><aside class="ps-side"><div class="ps-l">${esc(px('ЧТО ПУБЛИКУЕМ', 'WHAT TO POST'))}</div><div class="ps-pick">${S.cards.filter(c => c.type === 'file' && c.file && ['image', 'video'].includes(c.kind) && (c.status === 'done' || c.status === 'ready')).sort((a, b) => (b.done || b.created || 0) - (a.done || a.created || 0)).slice(0, 24).map(c => `<button type="button" class="${src && c.id === src.id ? 'on' : ''}" data-ssrc="${c.id}">${mediaHTML(c)}</button>`).join('') || `<span class="hint">${esc(px('Пока нет картинок и видео — перетащите файл.', 'No images or videos yet — drop a file.'))}</span>`}</div>
      <div class="ps-l">${esc(px('АККАУНТ', 'ACCOUNT'))}</div><input type="text" data-sbrand maxlength="40" value="${esc(s.brand)}" placeholder="your.brand">
      <div class="ps-l">${esc(px('О ЧЁМ ПОСТ', 'WHAT IT IS ABOUT'))}</div><textarea data-sabout rows="4" placeholder="${esc(px('Например: новая коллекция курток, премиум, зима', 'E.g. new winter jacket collection, premium'))}">${esc(s.about)}</textarea>
      <div class="ps-l">${esc(px('СОЦСЕТИ', 'NETWORKS'))}</div><div class="ps-nets">${Object.entries(NETS).map(([k, N]) => `<label><input type="checkbox" data-snet="${k}" ${s.nets.includes(k) ? 'checked' : ''}> ${esc(N.n)}</label>`).join('')}</div>
      <label class="ps-ai"><input type="checkbox" data-sai ${s.ai ? 'checked' : ''}> ${esc(px('Пометка «AI-generated» в подписи', '“AI-generated” tag in captions'))}</label>
      <button type="button" class="pbtn main" data-sgen>✨ ${esc(px('Подписи для всех соцсетей', 'Captions for every network'))}</button>
      <p class="pnote">${esc(px('Соцсети требуют помечать ИИ-контент. Не выдавайте сгенерированного человека за реального.', 'Networks require labeling AI content. Do not pass a generated person off as real.'))}</p>
      <div class="ps-l">${esc(px('АВТОПУБЛИКАЦИЯ', 'AUTO-POSTING'))} <em class="pill">${esc(px('в разработке', 'in development'))}</em></div></aside>
      <div class="ps-grid">${s.nets.map(frame).join('')}</div></div>`;
}
function pSocialClick(e) {
  const t = e.target, s = P.social;
  if (t.closest('[data-sback]')) { s.open = false; return pDraw(); }
  const sr = t.closest('[data-ssrc]'); if (sr) { s.src = +sr.dataset.ssrc; return pDraw(); }
  const cp = t.closest('[data-scopy]'); if (cp) { const ta = $(`[data-scap="${cp.dataset.scopy}"]`, prodEl); navigator.clipboard?.writeText(ta?.value || '').then(() => toast(px('Скопировано', 'Copied'))).catch(() => { ta?.select(); }); return; }
  const dl = t.closest('[data-sdl]'); if (dl) return pCropDownload(dl.dataset.sdl);
  if (t.closest('[data-sgen]')) return pCaptions();
}
function pSocialInput(e) {
  const t = e.target, s = P.social;
  if (t.matches('[data-sbrand]')) { s.brand = t.value.trim(); $$('.sf-top b', prodEl).forEach(b => b.textContent = s.brand || 'your.brand'); }
  if (t.matches('[data-sabout]')) s.about = t.value;
  if (t.matches('[data-scap]')) s.caps[t.dataset.scap] = t.value.replace(/\n\n#AIgenerated$/, '');
  if (t.matches('[data-snet]')) { s.nets = Object.keys(NETS).filter(k => k === t.dataset.snet ? t.checked : s.nets.includes(k)); pDraw(); }
  if (t.matches('[data-sai]')) { s.ai = t.checked; pDraw(); }
}
async function pCaptions() {
  const s = P.social; if (!s.about.trim()) return toast(px('Напишите, о чём пост.', 'Say what the post is about.'));
  const btn = $('[data-sgen]', prodEl); if (btn) { btn.disabled = true; btn.textContent = '✨ …'; }
  try {
    const r = await fetch(API.url('/directors-table/api/llm/captions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ about: s.about, brand: s.brand, nets: s.nets.map(n => n === 'shorts' ? 'shorts' : n), lang: window.DT_LANG || 'en', url: S.cfg.llmUrl, model: S.cfg.llmModel, cpu: S.cards.some(c => c.status === 'running') }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error === 'no-models' ? px('в Ollama нет моделей: ollama pull gemma3:4b', 'no models in Ollama: ollama pull gemma3:4b') : px('локальный помощник не найден — установите Ollama (ollama.com)', 'local helper not found — install Ollama (ollama.com)'));
    Object.assign(s.caps, j.captions || {}); pDraw();
  } catch (err) { toast('✨ ' + esc(err.message)); if (btn) { btn.disabled = false; btn.textContent = '✨ ' + px('Подписи для всех соцсетей', 'Captions for every network'); } }
}
function pCropDownload(k) {
  const c = byId(P.social.src), N = NETS[k]; if (!c || c.kind !== 'image' || !N.sz) return;
  const img = new Image(); img.onload = () => {
    const [W, H] = N.sz, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * sc, h = img.naturalHeight * sc;
    cv.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${(c.title || 'post').replace(/[^\w.-]+/g, '_').slice(0, 40)}-${k}-${W}x${H}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
  };
  img.onerror = () => toast(px('Не удалось открыть картинку.', 'Could not open the image.'));
  img.src = srcOf(c);
}

// при запуске — тот режим, в котором закрыли
setTimeout(() => pSetMode(S.cfg.mode === 'prod' ? 'prod' : 'dir'), 0);
