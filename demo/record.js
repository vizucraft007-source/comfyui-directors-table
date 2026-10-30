// Director's Table — демо-ролик кодом.
// Скрипт сам «играет» стол в браузере и пишет видео. Запуск:
//   node demo/record.js http://127.0.0.1:8000/directors-table out_dir [lang]
// Нужен Playwright (npm i playwright) и запущенный ComfyUI с установленным столом.
// Для честного ролика положите на стол настоящие результаты генерации — скрипт берёт то, что есть на сцене.
const path = require('path');
const PW = process.env.PW_MODULE || 'playwright';
const { chromium } = require(PW);

const URL = process.argv[2] || 'http://127.0.0.1:8000/directors-table';
const OUT = process.argv[3] || path.join(__dirname, 'out');
const LANG = process.argv[4] || 'en';
const SIZE = { width: 1920, height: 1080 };

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: SIZE } });
  const p = await ctx.newPage();
  await p.goto(URL);
  await p.evaluate(l => { try { const st = JSON.parse(localStorage.getItem('dt-state-v3') || '{}'); st.cfg = st.cfg || {}; st.cfg.lang = l; localStorage.setItem('dt-state-v3', JSON.stringify(st)); } catch (_) { } }, LANG);
  await p.reload(); await sleep(2500);

  // видимый курсор и титры (Playwright не рисует системный курсор)
  await p.addStyleTag({ content: `
    #demoCur{position:fixed;z-index:9999;width:26px;height:26px;pointer-events:none;left:-50px;top:-50px;transition:left .55s cubic-bezier(.3,.8,.3,1),top .55s cubic-bezier(.3,.8,.3,1);filter:drop-shadow(0 3px 8px rgba(0,0,0,.6))}
    #demoCur.click::after{content:'';position:absolute;left:-12px;top:-12px;width:26px;height:26px;border-radius:50%;border:2px solid #f0ff41;animation:dc .45s ease-out}
    @keyframes dc{from{transform:scale(.3);opacity:1}to{transform:scale(1.7);opacity:0}}
    #demoCap{position:fixed;z-index:9998;left:50%;bottom:150px;transform:translateX(-50%);padding:14px 26px;border-radius:14px;background:rgba(14,11,20,.92);border:1px solid rgba(240,255,65,.35);color:#fff;font:600 26px/1.35 'Golos Text',system-ui,sans-serif;text-align:center;max-width:1300px;opacity:0;transition:opacity .35s}
    #demoCap.on{opacity:1} #demoCap b{color:#f0ff41}` });
  await p.evaluate(() => { const c = document.createElement('div'); c.id = 'demoCur'; c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#18131f" stroke-width="1.5" stroke-linejoin="round"/></svg>'; document.body.appendChild(c); const t = document.createElement('div'); t.id = 'demoCap'; document.body.appendChild(t); });

  const cap = async (html, ms = 2600) => { await p.evaluate(h => { const t = document.getElementById('demoCap'); t.innerHTML = h; t.classList.add('on'); }, html); await sleep(ms); };
  const capOff = async () => { await p.evaluate(() => document.getElementById('demoCap').classList.remove('on')); await sleep(400); };
  const moveTo = async (x, y) => { await p.evaluate(([x, y]) => { const c = document.getElementById('demoCur'); c.style.left = x + 'px'; c.style.top = y + 'px'; }, [x, y]); await p.mouse.move(x, y, { steps: 12 }); await sleep(600); };
  const click = async (x, y) => { await moveTo(x, y); await p.evaluate(() => { const c = document.getElementById('demoCur'); c.classList.remove('click'); void c.offsetWidth; c.classList.add('click'); }); await p.mouse.click(x, y); await sleep(500); };
  const box = async sel => { const el = await p.$(sel); return el ? el.boundingBox() : null; };
  const center = b => [b.x + b.width / 2, b.y + b.height / 2];

  // 1. стол
  await cap('<b>Director’s Table</b> — conduct your AI orchestra on top of ComfyUI', 3200);
  await cap('Zones instead of node spaghetti: video, images, effects, montage, sound…', 3000);
  await capOff();

  // 2. живой показ зоны «Эффекты»
  await p.evaluate(() => startTour('fx')); await sleep(9000);
  await p.evaluate(() => stopTour());

  // 3. VFX: кадр → виджет → точка → черновик
  const img = await p.evaluate(() => { const c = S.cards.find(c => c.type === 'file' && c.kind === 'image' && c.sheet === S.sheet && !c.parked); return c && c.id; });
  if (img) {
    await cap('Drop a frame on the <b>VFX effect</b> widget, pick an effect and click where it happens', 2600);
    await p.evaluate(id => dispatch([byId(id)], wfById('ltx2-vfx'), { ask: true }), img); await sleep(1200);
    const pt = await box('.ptpick'); if (pt) await click(pt.x + pt.width * 0.72, pt.y + pt.height * 0.4);
    const pv = await box('[data-vfxprev]'); if (pv) { await click(...center(pv)); await sleep(5000); }
    await cap('Code draws the effect draft — <b>LTX turns it into real video with sound</b>', 3500);
    await p.evaluate(() => closeSheet()); await capOff();
  }

  // 4. круговое меню
  const w = await box('.card.widget');
  if (w) {
    await cap('Right-click any card — a radial menu, up to four levels deep', 2200);
    await moveTo(...center(w)); await p.mouse.down({ button: 'right' }); await sleep(500);
    const n = await p.evaluate(() => M && M.items.length) || 6, a = (-90 + 360 / n) * Math.PI / 180, [cx, cy] = center(w);
    await p.mouse.move(cx + 95 * Math.cos(a), cy + 95 * Math.sin(a), { steps: 10 }); await sleep(700);
    await p.mouse.move(cx + 170 * Math.cos(a), cy + 170 * Math.sin(a), { steps: 10 }); await sleep(1400);
    await p.mouse.move(cx + 600, cy + 400, { steps: 12 }); await sleep(600); await p.mouse.up({ button: 'right' }); await capOff();
  }

  // 5. план и шторки
  await cap('Plan a chain of tasks, switch <b>Auto</b> on — and go make tea', 2600);
  await p.evaluate(() => showRight('tasks')); await sleep(2200);
  await p.evaluate(() => $('#right').classList.remove('open')); await capOff();
  await p.evaluate(() => openRest()); await sleep(5000); await p.keyboard.press('Space'); await sleep(1200);

  // 6. редактор зон
  await cap('Build your own desk: clear the canvas, add zones, choose colors', 2400);
  await p.evaluate(() => openZoneEditor()); await sleep(800);
  const add = await box('[data-ze="add"]'); if (add) { await click(...center(add)); await sleep(800); await click(...center(add)); }
  await sleep(1500); await p.evaluate(() => closeZoneEditor(false)); await capOff();

  // 7. модели и оркестратор
  await cap('It knows your GPU — and downloads only from trusted sources', 2400);
  await p.evaluate(() => modelsSheet()); await sleep(3500); await p.evaluate(() => closeSheet()); await capOff();

  // 8. финал
  await cap('Open weights only · GPL-3.0 · 12 languages<br><b>Be the maestro.</b>', 4000);

  await ctx.close(); await browser.close();
  console.log('video saved to', OUT);
})();
