/* Director's Table — «🎥 Камера-сфера»: траектория камеры вокруг героя, как Re-shoot у Higgsfield.
   Две точки на сфере — откуда камера начинает (●) и где заканчивает (◆), плюс насколько близко.
   Стол сам пишет английский промпт движения камеры и сохраняет траекторию как свой пресет «Камера». */
'use strict';

const camDeg = r => r * 180 / Math.PI, camRad = d => d * Math.PI / 180;
const camNorm = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };
function camSide(a) {
  const s = a >= 0 ? 'right' : 'left', x = Math.abs(a);
  if (x < 25) return 'in front of the subject';
  if (x < 65) return `from the front-${s} three-quarter angle`;
  if (x < 115) return `at the subject's ${s} side`;
  if (x < 155) return `from behind on the ${s}`;
  return 'behind the subject';
}
const camHeight = e => e < -25 ? 'from a low angle looking up' : e < 20 ? 'at eye level' : e < 55 ? 'from a high angle looking down' : 'from directly overhead';
const camDist = d => d < .3 ? 'in a close-up' : d < .65 ? 'in a medium shot' : 'in a wide shot';
function camPrompt(c) {
  let dA = c.full ? 360 * (c.dir || 1) : camNorm(c.a1 - c.a0);
  const dE = c.e1 - c.e0, dD = c.d1 - c.d0, main = [], ing = [];
  if (c.full) main.push(`circles a full 360° around the subject to the ${dA > 0 ? 'right' : 'left'}`);
  else if (Math.abs(dA) >= 10) main.push(`orbits ${Math.round(Math.abs(dA))}° to the ${dA > 0 ? 'right' : 'left'} around the subject`);
  if (dE > 15) (main.length ? ing : main).push(main.length ? 'rising higher' : 'cranes up');
  else if (dE < -15) (main.length ? ing : main).push(main.length ? 'lowering down' : 'cranes down');
  if (dD < -.2) (main.length ? ing : main).push(main.length ? 'pushing in closer' : 'pushes in closer');
  else if (dD > .2) (main.length ? ing : main).push(main.length ? 'pulling back' : 'pulls back');
  const move = main.length ? main[0] + (ing.length ? ' while ' + ing.join(' and ') : '') : 'holds its position with only a subtle drift';
  return `Camera move: the shot starts ${camDist(c.d0)} ${camHeight(c.e0)}, ${camSide(c.a0)}. The camera smoothly ${move}, ending ${camDist(c.d1)} ${camHeight(c.e1)}, ${camSide(c.full ? c.a0 : c.a1)}. One continuous cinematic camera motion, steady speed, the subject stays centered and in focus.`;
}

/* ---------- траектории как пресеты «Камера» ---------- */
function camPathsToPresets() {
  S.camPaths = (Array.isArray(S.camPaths) ? S.camPaths : []).filter(c => c && SAFE_ID.test(String(c.id))).slice(0, 40);
  PRE.presets = PRE.presets.filter(p => !(p.cat === 'camera' && (p.id === 'cam-new' || String(p.id).startsWith('campath-'))))
    .concat([{ id: 'cam-new', cat: 'camera', title: '＋ Своя траектория', icon: '🎥', anim: 'orbit', about: 'камера-сфера: откуда и куда летит камера', prompt: '{prompt}' }],
      S.camPaths.map(c => ({ id: c.id, cat: 'camera', title: String(c.name || 'Моя камера').slice(0, 30), icon: '🎥', anim: 'orbit', about: 'своя траектория', prompt: '{prompt}. ' + camPrompt(c), origin: 'user' })));
}
{ const _lp = loadPresets; loadPresets = async function () { await _lp.apply(this, arguments); camPathsToPresets(); }; }
camPathsToPresets(); setTimeout(camPathsToPresets, 2600);
{ const _up = usePreset; usePreset = function (pid) { if (pid === 'cam-new') { try { maestroClose(); } catch (_) { } return camSphere(); } return _up.apply(this, arguments); }; }
{ const _at = attachPreset; attachPreset = function (w, pid) { if (pid === 'cam-new') return camSphere(w); return _at.apply(this, arguments); }; }
// в круговом меню виджета: «Входы» → «🎥 Камера-сфера…»
{ const _wm = widgetMenu; widgetMenu = function (w) {
  const items = _wm(w), inp = items.find(i => i.label === 'Входы');
  const wf = wfById(w.wf);
  if (inp && wf?.kind === 'video') inp.children.push({ label: '🎥 Камера…', enabled: true, act: () => camSphere(w) });
  return items;
}; }

/* ---------- окно со сферой ---------- */
function camSphere(w) {
  const tw = w || [...sel].map(byId).find(c => c?.type === 'widget') || null;
  const src = tw ? (byId(tw.lastInput) || Object.values(tw.bound || {}).map(byId).find(c => c?.kind === 'image')) : null;
  const c = { a0: 0, e0: 5, d0: .55, a1: 120, e1: 35, d1: .3, full: false, dir: 1, name: '' };
  let vy = -25, vp = 18, drag = null, anim = null;
  sheetOpen(`<h3>🎥 Камера-сфера</h3><div class="sub">Тащите точки по сфере: <b>●</b> — где камера начинает, <b>◆</b> — где заканчивает. Пустое место — повернуть сферу. Стол сам напишет промпт движения камеры.</div>
    <div class="cam-wrap"><canvas id="camCv" width="380" height="380"></canvas>
      <div class="cam-side">
        <div class="seg cam-q"><button type="button" data-cq="orbit">⟳ Облёт 360°</button><button type="button" data-cq="half">◐ Полукруг</button><button type="button" data-cq="rise">⤴ Подъём над героем</button><button type="button" data-cq="push">⇥ Наезд</button><button type="button" data-cq="low">⤵ Снизу вверх</button></div>
        <label class="cam-l">● Старт: близко ↔ далеко<input type="range" id="camD0" min="0" max="1" step="0.05" value="${c.d0}"></label>
        <label class="cam-l">◆ Финиш: близко ↔ далеко<input type="range" id="camD1" min="0" max="1" step="0.05" value="${c.d1}"></label>
        <label class="chk"><input type="checkbox" id="camFull"> Полный облёт 360°</label>
        <div class="cam-prompt" id="camTxt" data-noi18n></div>
        <div class="field"><label for="camName">Название</label><input id="camName" maxlength="30" placeholder="например: Облёт с подъёмом"></div>
      </div></div>
    <div class="acts"><button type="button" class="btn ghost" data-close>Закрыть</button><button type="button" class="btn ghost" data-cplay>▶ Показать полёт</button><button type="button" class="btn primary" data-csave>${tw ? 'Сохранить и повесить на виджет' : 'Сохранить пресет'}</button></div>`, null, {
    wide: true,
    init: box => {
      const cv = box.querySelector('#camCv'), g = cv.getContext('2d'), CX = 190, CY = 190, R = 150;
      let img = null; if (src && src.kind === 'image' && srcOf(src)) { img = new Image(); img.src = srcOf(src); img.onload = () => draw(); }
      const proj = (a, e, r = 1) => {
        let x = Math.sin(camRad(a)) * Math.cos(camRad(e)), y = Math.sin(camRad(e)), z = Math.cos(camRad(a)) * Math.cos(camRad(e));
        const cy_ = Math.cos(camRad(vy)), sy_ = Math.sin(camRad(vy)); [x, z] = [x * cy_ + z * sy_, -x * sy_ + z * cy_];
        const cp = Math.cos(camRad(vp)), sp = Math.sin(camRad(vp)); [y, z] = [y * cp - z * sp, y * sp + z * cp];
        return [CX + x * R * r, CY - y * R * r, z];
      };
      const unproj = (sx, sy) => {
        let x = (sx - CX) / R, y = -(sy - CY) / R; const q = x * x + y * y; if (q > 1) { x /= Math.sqrt(q); y /= Math.sqrt(q); }
        let z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
        const cp = Math.cos(camRad(vp)), sp = Math.sin(camRad(vp)); [y, z] = [y * cp + z * sp, -y * sp + z * cp];
        const cy_ = Math.cos(camRad(vy)), sy_ = Math.sin(camRad(vy)); [x, z] = [x * cy_ - z * sy_, x * sy_ + z * cy_];
        return [camDeg(Math.atan2(x, z)), Math.max(-60, Math.min(85, camDeg(Math.asin(Math.max(-1, Math.min(1, y))))))];
      };
      const path = () => { const out = [], dA = c.full ? 360 * c.dir : camNorm(c.a1 - c.a0); for (let i = 0; i <= 48; i++) { const t = i / 48; out.push([c.a0 + dA * t, c.e0 + (c.e1 - c.e0) * t, 1 - .12 * ((c.d0 + (c.d1 - c.d0) * t) - .5)]); } return out; };
      function draw(at) {
        if (!cv.isConnected) return;
        g.clearRect(0, 0, 380, 380);
        g.fillStyle = 'rgba(120,200,255,.04)'; g.beginPath(); g.arc(CX, CY, R, 0, Math.PI * 2); g.fill();
        g.lineWidth = 1;
        const line = (pts, col) => { g.strokeStyle = col; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
        for (let e = -60; e <= 60; e += 30) { const pts = []; for (let a = -180; a <= 180; a += 6) pts.push(proj(a, e)); line(pts, e === 0 ? 'rgba(240,255,65,.55)' : 'rgba(200,220,255,.13)'); }
        for (let a = -180; a < 180; a += 30) { const pts = []; for (let e = -90; e <= 90; e += 6) pts.push(proj(a, e)); line(pts, 'rgba(200,220,255,.1)'); }
        g.strokeStyle = 'rgba(200,220,255,.3)'; g.beginPath(); g.arc(CX, CY, R, 0, Math.PI * 2); g.stroke();
        // герой в центре
        if (img) { const w = 86, h = 86 * img.height / img.width; g.save(); g.globalAlpha = .95; g.drawImage(img, CX - w / 2, CY - h / 2, w, h); g.restore(); }
        else { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(CX - 16, CY - 30, 32, 60); g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText('герой', CX, CY + 46); }
        // траектория
        const P = path().map(([a, e, r]) => proj(a, e, r));
        g.setLineDash([4, 5]); g.lineWidth = 2; g.strokeStyle = '#f0ff41'; g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
        const [sx, sy, sz] = proj(c.a0, c.e0, 1 - .12 * (c.d0 - .5)), [ex, ey, ez] = proj(c.full ? c.a0 + 359 * c.dir : c.a1, c.e1, 1 - .12 * (c.d1 - .5));
        g.globalAlpha = sz < 0 ? .45 : 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 8, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        g.globalAlpha = ez < 0 ? .45 : 1; g.fillStyle = '#f0ff41'; g.beginPath(); g.moveTo(ex, ey - 9); g.lineTo(ex + 9, ey); g.lineTo(ex, ey + 9); g.lineTo(ex - 9, ey); g.closePath(); g.fill(); g.globalAlpha = 1;
        if (at != null) { const k = Math.min(P.length - 1, Math.round(at * (P.length - 1))), [x, y] = P[k]; g.fillStyle = '#0e0b14'; g.strokeStyle = '#f0ff41'; g.lineWidth = 2; g.beginPath(); g.roundRect ? g.roundRect(x - 13, y - 9, 26, 18, 4) : g.rect(x - 13, y - 9, 26, 18); g.fill(); g.stroke(); g.fillStyle = '#f0ff41'; g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + 11, y - 5); g.lineTo(x + 11, y + 5); g.fill(); g.beginPath(); g.arc(x - 3, y, 4, 0, Math.PI * 2); g.fill(); }
        box.querySelector('#camTxt').textContent = camPrompt(c);
      }
      const hit = (mx, my) => { const [sx, sy] = proj(c.a0, c.e0, 1 - .12 * (c.d0 - .5)), [ex, ey] = proj(c.full ? c.a0 + 359 * c.dir : c.a1, c.e1, 1 - .12 * (c.d1 - .5)); if (Math.hypot(mx - ex, my - ey) < 15) return 'end'; if (Math.hypot(mx - sx, my - sy) < 15) return 'start'; return 'view'; };
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 380 / r.width, (e.clientY - r.top) * 380 / r.height]; };
      cv.addEventListener('pointerdown', e => { const [mx, my] = pos(e); drag = { what: hit(mx, my), x: mx, vy0: vy }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => {
        const [mx, my] = pos(e); if (!drag) { cv.style.cursor = hit(mx, my) === 'view' ? 'grab' : 'pointer'; return; }
        if (drag.what === 'view') vy = drag.vy0 - (mx - drag.x) * .6;
        else { const [a, el] = unproj(mx, my); if (drag.what === 'start') { c.a0 = a; c.e0 = el; } else { c.a1 = a; c.e1 = el; c.full = false; box.querySelector('#camFull').checked = false; } }
        draw();
      });
      cv.addEventListener('pointerup', () => { drag = null; });
      box.addEventListener('input', e => { if (e.target.id === 'camD0') c.d0 = +e.target.value; if (e.target.id === 'camD1') c.d1 = +e.target.value; if (e.target.id === 'camFull') c.full = e.target.checked; if (e.target.id === 'camName') c.name = e.target.value; draw(); });
      box._cam = { c, draw, play: () => { cancelAnimationFrame(anim); const t0 = performance.now(); const step = now => { const t = Math.min(1, (now - t0) / 2600); draw(t); if (t < 1 && !sheetBack.hidden) anim = requestAnimationFrame(step); else draw(); }; anim = requestAnimationFrame(step); } };
      draw();
    },
    onClick: e => {
      const k = sheet._cam; if (!k) return;
      const q = e.target.closest('[data-cq]')?.dataset.cq;
      const Q = { orbit: { a0: 0, e0: 5, a1: 0, e1: 5, d0: .55, d1: .55, full: true, dir: 1 }, half: { a0: -90, e0: 5, a1: 90, e1: 5, d0: .5, d1: .5, full: false }, rise: { a0: 0, e0: 0, a1: 30, e1: 70, d0: .45, d1: .75, full: false }, push: { a0: 0, e0: 5, a1: 0, e1: 5, d0: .85, d1: .15, full: false }, low: { a0: -20, e0: -45, a1: 20, e1: 10, d0: .3, d1: .5, full: false } };
      if (q) { Object.assign(k.c, Q[q]); sheet.querySelector('#camD0').value = k.c.d0; sheet.querySelector('#camD1').value = k.c.d1; sheet.querySelector('#camFull').checked = k.c.full; k.draw(); k.play(); }
      if (e.target.closest('[data-cplay]')) k.play();
      if (e.target.closest('[data-csave]')) {
        const it = { ...k.c, id: 'campath-' + Date.now().toString(36), name: (k.c.name || '').trim().slice(0, 30) || 'Моя камера' };
        histPush('своя траектория');
        S.camPaths = [...(S.camPaths || []), it]; save(); camPathsToPresets(); closeSheet();
        if (tw) { attachPreset(tw, it.id, true); updCard(tw); flashCard(tw.id); toast(`🎥 «${esc(it.name)}» висит на «${esc(wfById(tw.wf)?.title || '')}» — добавится к промпту при запуске.`); }
        else toast(`🎥 «${esc(it.name)}» сохранена: Маэстро → Камера. Перетащите её на виджет или клавишу.`);
      }
    }
  });
}
