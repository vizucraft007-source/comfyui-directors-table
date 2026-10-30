/* Director's Table · переводы интерфейса.
   Исходный текст интерфейса — русский. Для других языков стол подменяет видимый текст по словарю
   (i18n-<lang>.json): целые фразы, а в составных строках — известные куски. Пользовательский текст
   (названия файлов, промпты, поля ввода) не трогаем. Чего нет в словаре языка — берём из английского. */
(function () {
  const LANGS = [
    ['en', 'English', '🇬🇧'], ['ru', 'Русский', '🇷🇺'], ['uk', 'Українська', '🇺🇦'], ['es', 'Español', '🇪🇸'],
    ['pt-BR', 'Português (Brasil)', '🇧🇷'], ['de', 'Deutsch', '🇩🇪'], ['fr', 'Français', '🇫🇷'], ['zh', '中文', '🇨🇳'],
    ['ja', '日本語', '🇯🇵'], ['ko', '한국어', '🇰🇷'], ['tr', 'Türkçe', '🇹🇷'], ['ar', 'العربية', '🇸🇦'],
  ];
  window.DT_LANGS = LANGS;
  let lang = null, had = false;
  try { const st = JSON.parse(localStorage.getItem('dt-state-v3') || 'null'); had = !!st; lang = (st && st.cfg || {}).lang || null; } catch (_) { }
  if (!lang && had) lang = 'ru'; // стол уже был открыт до появления переводов — оставляем привычный русский
  if (!lang) { const n = (navigator.language || 'en').toLowerCase(); lang = n.startsWith('ru') ? 'ru' : n.startsWith('uk') ? 'uk' : n.startsWith('pt') ? 'pt-BR' : (LANGS.find(l => n.startsWith(l[0])) || ['en'])[0]; }
  window.DT_LANG = lang;
  document.documentElement.lang = lang;
  if (lang === 'ar') document.documentElement.dir = 'rtl';
  if (lang === 'ru') { window.T = s => s; return; }

  const load = name => { try { const x = new XMLHttpRequest(); x.open('GET', '/directors-table/i18n-' + name + '.json', false); x.send(); return x.status === 200 ? JSON.parse(x.responseText) : {}; } catch (_) { return {}; } };
  const en = load('en'), own = lang === 'en' ? {} : load(lang);
  const D = Object.assign({}, en, own);
  // короткие слова («из», «или», «кадр») меняем только когда это вся надпись целиком —
  // иначе в новых, ещё не переведённых фразах получалась бы каша из двух языков
  const keys = Object.keys(D).filter(k => k.length >= 4 || /\s/.test(k)).sort((a, b) => b.length - a.length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const CYR = 'А-Яа-яЁёІіЇїЄєҐґ';
  const RX = keys.length ? new RegExp(`(?<![${CYR}])(${keys.map(esc).join('|')})(?![${CYR}])`, 'g') : null;
  const HAS = new RegExp(`[${CYR}]`);
  const UNITS = { 'ГБ': 'GB', 'МБ': 'MB', 'КБ': 'KB', 'ТБ': 'TB', 'МГц': 'MHz', 'ГГц': 'GHz', 'Вт': 'W', 'шт.': 'pcs' };
  const tr = s => {
    if (!s || !HAS.test(s)) return s;
    const t = s.trim(); if (D[t]) return s.replace(t, D[t]);
    if (t.includes(' · ')) { const parts = t.split(' · '); if (parts.some(x => D[x.trim()])) return s.replace(t, parts.map(x => tr(x)).join(' · ')); }
    let out = RX ? s.replace(RX, m => D[m] || m) : s;
    // единицы после чисел: «7.4 из 12.0 ГБ», «2610 МГц», «26 шт.»
    out = out.replace(new RegExp(`(\\d)\\s+из\\s+(\\d)`, 'g'), '$1 / $2');
    out = out.replace(new RegExp(`(^|[^${CYR}])от (\\d)`, 'g'), '$1' + (D['от'] || 'from') + ' $2');
    out = out.replace(new RegExp(`(\\d)\\s?(ГБ|МБ|КБ|ТБ|МГц|ГГц|Вт|шт\\.)(?![${CYR}])`, 'g'), (m, d, u) => d + ' ' + (D[u] || UNITS[u]));
    return out.replace(new RegExp(`(\\d)\\s?с(?![${CYR}])`, 'g'), '$1 ' + (D['с'] || 's'));
  };
  window.T = tr;
  window.DT_I18N = { walk: r => walk(r) };
  const SKIPSET = new Set(['TEXTAREA', 'SCRIPT', 'STYLE', 'CODE']), SKIP = { includes: t => SKIPSET.has(t) }; // раньше была строка, и <p>, <i>, <a> пропускались
  const userText = el => el && el.closest && el.closest('[data-noi18n], .cap b, .row .t b, .pchip b, .job b, input, textarea, [contenteditable="true"]');
  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1) return;
    fixAttrs(root); // подсказки (placeholder) у полей ввода тоже переводим
    if (SKIP.includes(root.tagName)) return;
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = it.nextNode())) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
  }
  // уже переведённое не переводим повторно (важно для кириллических языков, например украинского)
  const doneT = new WeakMap(), doneA = new WeakMap();
  function fixText(n) {
    const p = n.parentElement; if (!p || SKIP.includes(p.tagName) || userText(p)) return;
    const v = n.nodeValue; if (!HAS.test(v) || doneT.get(n) === v) return;
    const t = tr(v); doneT.set(n, t); if (t !== v) n.nodeValue = t;
  }
  function fixAttrs(el) {
    if (!el.getAttribute) return;
    const mem = doneA.get(el) || {};
    for (const a of ['title', 'placeholder', 'aria-label']) { const v = el.getAttribute(a); if (v && HAS.test(v) && mem[a] !== v) { const t = tr(v); mem[a] = t; if (t !== v) el.setAttribute(a, t); } }
    doneA.set(el, mem);
  }
  const obs = new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  const start = () => { walk(document.body); obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] }); document.title = "Director's Table"; };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
