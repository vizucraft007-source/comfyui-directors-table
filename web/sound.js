/* Director's Table — своя музыка только в браузере + тихие звуки интерфейса.
   Треки из «Радио» теперь не копируются в папки ComfyUI: файл лежит в хранилище этого браузера (IndexedDB)
   и проигрывается оттуда. Звуки интерфейса синтезируются на лету (без файлов), по умолчанию выключены. */
'use strict';

/* ---------- музыка в хранилище браузера ---------- */
const MUSIC_DB = (() => { let p = null; return () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('dt-music', 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); })();
const idbPut = async (k, v) => { const db = await MUSIC_DB(); return new Promise((res, rej) => { const tx = db.transaction('t', 'readwrite'); tx.objectStore('t').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); };
const idbGet = async k => { const db = await MUSIC_DB(); return new Promise((res, rej) => { const q = db.transaction('t').objectStore('t').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
const idbDel = async k => { const db = await MUSIC_DB(); return new Promise(res => { const tx = db.transaction('t', 'readwrite'); tx.objectStore('t').delete(k); tx.oncomplete = res; tx.onerror = res; }); };
rUpload = async function (files) {
  const list = [...files].filter(f => (f.type || '').startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac|opus)$/i.test(f.name));
  if (!list.length) return toast('В папке нет аудиофайлов.');
  let n = 0;
  for (const f of list) {
    if (f.size > 300 * 2 ** 20) { toast('Слишком большой файл: ' + esc(f.name)); continue; }
    const k = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    try { await idbPut(k, f); R.tracks.push({ id: Date.now() + Math.random(), title: f.name.replace(/\.[^.]+$/, '').slice(0, 120), idb: k }); n++; } catch (_) { toast('Не сохранился ' + esc(f.name)); }
  }
  save(); drawRadio(); toast(`🎵 Добавлено: <b>${n}</b>. Музыка хранится только в этом браузере — в папки ComfyUI и в проект не попадает.`);
};
let musicUrl = null;
{ const _pi = rPlayIdx; rPlayIdx = async function (i) {
  if (!R.tracks.length) return _pi.apply(this, arguments);
  const idx = (i + R.tracks.length) % R.tracks.length, t = R.tracks[idx];
  if (!t.idb) return _pi.apply(this, arguments);
  const blob = await idbGet(t.idb).catch(() => null);
  if (!blob) { toast(`«${esc(t.title)}» нет в этом браузере — добавьте файл заново.`); return; }
  R.idx = idx; if (musicUrl) URL.revokeObjectURL(musicUrl); musicUrl = URL.createObjectURL(blob);
  rAudio.src = musicUrl; rAudio.play().catch(() => { }); save(); drawRadio();
}; }
// удалили трек из плейлиста — убираем и файл из хранилища
rPanel.addEventListener('click', () => setTimeout(async () => { const keep = new Set(R.tracks.map(t => t.idb).filter(Boolean)); try { const db = await MUSIC_DB(); const q = db.transaction('t').objectStore('t').getAllKeys(); q.onsuccess = () => q.result.forEach(k => { if (!keep.has(k)) idbDel(k); }); } catch (_) { } }, 200));
{ const _dr = drawRadio; drawRadio = function () { _dr.apply(this, arguments); if (!rPanel.hidden && !rPanel.querySelector('.r-priv')) rPanel.insertAdjacentHTML('afterbegin', '<div class="r-priv">🔒 Своя музыка хранится только в этом браузере — никуда не копируется и в проект не попадает.</div>'); }; }

/* ---------- тихие звуки интерфейса (по желанию) ---------- */
let AC = null;
function uiSound(kind) {
  if (!S.cfg.uiSounds || (typeof DEMO !== 'undefined' && DEMO && !S.cfg.uiSoundsDemo && false)) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime, g = AC.createGain(), vol = .05 * (S.cfg.uiSoundVol ?? 1);
    g.connect(AC.destination);
    const tone = (f1, f2, dur, type = 'sine', at = 0, v = vol) => { const o = AC.createOscillator(), gg = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f1, t + at); o.frequency.exponentialRampToValueAtTime(f2, t + at + dur); gg.gain.setValueAtTime(0, t + at); gg.gain.linearRampToValueAtTime(v, t + at + .01); gg.gain.exponentialRampToValueAtTime(.0001, t + at + dur); o.connect(gg); gg.connect(g); o.start(t + at); o.stop(t + at + dur + .02); };
    const whoosh = (dur, from, to) => { const n = AC.createBufferSource(), b = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1); n.buffer = b; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur); const gg = AC.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(vol * .9, t + dur * .3); gg.gain.exponentialRampToValueAtTime(.0001, t + dur); n.connect(f); f.connect(gg); gg.connect(g); n.start(t); n.stop(t + dur); };
    if (kind === 'key') tone(660, 520, .09, 'triangle');
    if (kind === 'panel') whoosh(.28, 500, 2400);
    if (kind === 'holo') { whoosh(.5, 300, 3000); tone(440, 880, .4, 'sine', .05, vol * .5); }
    if (kind === 'drop') { tone(784, 784, .12, 'sine'); tone(1175, 1175, .18, 'sine', .07); }
    if (kind === 'done') { tone(523, 523, .16, 'sine'); tone(659, 659, .16, 'sine', .1); tone(784, 784, .3, 'sine', .2); }
    if (kind === 'error') tone(300, 180, .25, 'triangle');
  } catch (_) { }
}
{ const _pk = pressKeyVisual; pressKeyVisual = function () { uiSound('key'); return _pk.apply(this, arguments); }; }
piano.addEventListener('pointerdown', e => { if (e.target.closest('.key, .bk, .ck')) uiSound('key'); });
{ const _oe = openEdge; openEdge = function (name, on) { const el = edges[name]; if (on && el && !el.classList.contains('open') && !el.classList.contains('pinned')) uiSound('panel'); return _oe.apply(this, arguments); }; }
{ const _mo2 = maestroOpen; maestroOpen = function () { if (holo.hidden) uiSound('holo'); return _mo2.apply(this, arguments); }; }
{ const _ap2 = attachPreset; attachPreset = function () { uiSound('drop'); return _ap2.apply(this, arguments); }; }
{ const _jc = jobChanged; jobChanged = function (c) { if (c && !c.__snd && (c.status === 'done' || (c.status === 'error' && !c.stopped))) { c.__snd = 1; uiSound(c.status === 'done' ? 'done' : 'error'); } return _jc.apply(this, arguments); }; }
