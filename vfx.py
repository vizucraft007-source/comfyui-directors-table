"""
Director's Table · VFX-черновики для LTX.

Идея: код рисует «черновик эффекта» прямо поверх вашего кадра — кольцо портала,
искры, дождь, молнии, огонь — кадр за кадром. Этот черновик идёт в LTX как
направляющее видео (LTXVAddGuide): код задаёт ГДЕ и КАК движется эффект,
а LTX дорисовывает свет, отражения и реализм.

Зависимости: только numpy и Pillow (есть в любом ComfyUI).
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

EFFECTS = {
    # id: (название, подсказка для промпта на английском)
    "portal": ("Магический портал", "a glowing magical portal swirls open, bright rim light spills onto the surroundings, sparks drift from its edge"),
    "fire": ("Огонь", "flames burst up and flicker, warm orange light dances across the scene, embers rise into the air"),
    "sparks": ("Искры", "a fountain of bright sparks sprays out and falls with gravity, glinting as they bounce"),
    "rain": ("Дождь", "heavy rain begins to pour, streaks of water fall through the frame, wet surfaces glisten"),
    "snow": ("Снег", "soft snowflakes drift down gently, the air turns cold and hazy"),
    "lightning": ("Молния", "a lightning bolt strikes with a blinding flash, the whole scene lights up for an instant"),
    "smoke": ("Дым", "thick smoke billows and rises, slowly swirling and thinning out"),
    "aura": ("Аура силы", "a pulsing aura of energy surrounds the character, glowing light wraps around the body"),
    "shockwave": ("Ударная волна", "a powerful shockwave bursts outward, a ring of distortion ripples through the air"),
    "magic": ("Магические частицы", "glowing magical particles spiral upward, leaving soft trails of light"),
    "dissolve": ("Рассыпается в пыль", "the subject slowly disintegrates into glowing dust particles that drift away in the wind"),
    "glitch": ("Цифровой сбой", "digital glitch effect, the image flickers with RGB splits and scanlines like a corrupted hologram"),
}

DEFAULT_COLORS = {
    "portal": "#6fd6ff", "fire": "#ff8a2a", "sparks": "#ffd36b", "rain": "#cfe3ff", "snow": "#ffffff",
    "lightning": "#cfe0ff", "smoke": "#9a9aa6", "aura": "#a774ff", "shockwave": "#ffffff", "magic": "#f0ff41",
    "dissolve": "#ffcf8a", "glitch": "#ff3df0",
}


def _hex(c, fallback="#ffffff"):
    c = (c or fallback).strip().lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    try:
        return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0
    except ValueError:
        return _hex(fallback)


def _smooth(a, b, x):
    t = np.clip((x - a) / max(1e-6, b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _blur(layer, radius):
    """Размытие одного канала float [H,W] через Pillow."""
    if radius <= 0:
        return layer
    im = Image.fromarray(np.clip(layer * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def frames_8n1(n):
    """LTX работает с длиной 8n+1 кадров."""
    n = max(9, int(n))
    return ((n - 1) // 8) * 8 + 1


class VFXRenderer:
    def __init__(self, base, effect, frames, cx, cy, size, intensity, seed, color):
        self.base = base.astype(np.float32)  # [H,W,3] 0..1
        self.H, self.W = base.shape[:2]
        self.effect = effect
        self.n = frames
        self.cx, self.cy = cx * self.W, cy * self.H
        self.S = max(8.0, size * min(self.W, self.H))
        self.k = float(intensity)
        self.rng = np.random.default_rng(int(seed) & 0xFFFFFFFF)
        self.col = _hex(color, DEFAULT_COLORS.get(effect, "#ffffff"))
        yy, xx = np.mgrid[0:self.H, 0:self.W].astype(np.float32)
        self.X, self.Y = xx, yy
        self.dx, self.dy = xx - self.cx, yy - self.cy
        self.D = np.sqrt(self.dx ** 2 + self.dy ** 2)
        self.A = np.arctan2(self.dy, self.dx)
        self._setup()

    # ---------- подготовка частиц (один раз на весь ролик) ----------
    def _setup(self):
        r, e = self.rng, self.effect
        if e == "sparks":
            m = 260
            ang = r.uniform(-math.pi * 0.95, -math.pi * 0.05, m)
            spd = r.uniform(0.8, 2.0, m) * self.S * 2.6
            self.p = dict(birth=r.uniform(0.05, 0.85, m), vx=np.cos(ang) * spd, vy=np.sin(ang) * spd, life=r.uniform(0.25, 0.5, m))
        elif e == "rain":
            m = 900
            self.p = dict(x=r.uniform(-0.2, 1.2, m) * self.W, y=r.uniform(0, 1, m) * self.H, sp=r.uniform(0.8, 1.3, m), ln=r.uniform(0.03, 0.07, m) * self.H)
        elif e == "snow":
            m = 420
            self.p = dict(x=r.uniform(0, 1, m) * self.W, y=r.uniform(0, 1, m) * self.H, sp=r.uniform(0.15, 0.35, m), sz=r.uniform(1.0, 3.2, m), ph=r.uniform(0, 6.28, m))
        elif e == "lightning":
            hits = sorted(r.uniform(0.2, 0.85, 2 if self.n > 40 else 1))
            self.p = dict(hits=hits, bolts=[self._bolt() for _ in hits])
        elif e == "smoke":
            m = 70
            self.p = dict(birth=r.uniform(0.0, 0.8, m), ox=r.normal(0, 0.25, m) * self.S, vx=r.normal(0, 0.15, m) * self.S, vy=-r.uniform(0.5, 1.0, m) * self.S * 1.6, sz=r.uniform(0.25, 0.5, m) * self.S)
        elif e in ("magic", "portal"):
            m = 160
            self.p = dict(r0=r.uniform(0.2, 1.1, m) * self.S * (0.6 if e == "portal" else 1), a0=r.uniform(0, 6.28, m), w=r.uniform(1.5, 3.5, m) * r.choice([-1, 1], m), up=r.uniform(0.2, 1.0, m) * self.S, ph=r.uniform(0, 1, m))
        elif e == "dissolve":
            noise = self.rng.random((max(2, self.H // 8), max(2, self.W // 8))).astype(np.float32)
            nimg = Image.fromarray((noise * 255).astype(np.uint8), "L").resize((self.W, self.H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
            n = np.asarray(nimg, dtype=np.float32) / 255.0
            # распад идёт от точки наружу + шум
            # за пределами радиуса (field > 1) ничего не распадается
            self.p = dict(field=np.clip(self.D / (self.S * 1.2), 0, 1.5) * 0.75 + n * 0.25)
        elif e == "glitch":
            self.p = dict(keys=self.rng.random(self.n))
        elif e in ("fire", "aura"):
            # два слоя мягкого шума: мелкие язычки и крупные клубы; при кадрах они «поднимаются»
            m = 90
            self.p = dict(n1=self._noise(max(3, int(self.S / 7))), n2=self._noise(max(5, int(self.S / 2.6))),
                          eb=r.uniform(0.0, 0.95, m), ex=r.normal(0, 0.35, m) * self.S, evx=r.normal(0, 0.25, m) * self.S, ev=r.uniform(1.2, 2.4, m) * self.S, el=r.uniform(0.25, 0.6, m))
        else:
            self.p = {}

    def _noise(self, cell):
        # шум выше кадра с запасом: «подъём» — это сдвиг окна вверх по нему, без шва при прокрутке
        HH = self.H + int(self.S * 5.2) + 4
        h, w = max(2, HH // cell + 2), max(2, self.W // cell + 2)
        a = (self.rng.random((h, w)) * 255).astype(np.uint8)
        img = Image.fromarray(a, "L").resize((self.W, HH), Image.BICUBIC)
        return np.asarray(img, dtype=np.float32) / 255.0

    def _scroll(self, n, shift):
        top = max(0, n.shape[0] - self.H - min(int(shift), n.shape[0] - self.H))
        return n[top:top + self.H]

    def _heat_color(self, heat):
        # тёмно-красный → оранжевый → жёлтый → почти белое ядро
        r = np.clip(heat * 2.0, 0, 1)
        g = np.clip((heat - 0.28) * 1.7, 0, 1) * 0.86
        b = np.clip((heat - 0.72) * 2.6, 0, 1) * 0.75
        return np.stack([r, g, b], axis=-1)

    def _embers(self, t, light, rise_from):
        p = self.p
        lay = Image.new("L", (self.W, self.H), 0)
        d = ImageDraw.Draw(lay)
        for k in range(len(p["eb"])):
            age = t - p["eb"][k]
            if age < 0 or age > p["el"][k]:
                continue
            q = age / p["el"][k]
            x = self.cx + p["ex"][k] + p["evx"][k] * age + math.sin(age * 20 + k) * self.S * 0.05
            y = rise_from - p["ev"][k] * age
            s = 1.2 + 1.3 * (1 - q)
            d.ellipse((x - s, y - s, x + s, y + s), fill=int(255 * (1 - q) ** 0.7))
        a = np.asarray(lay, dtype=np.float32) / 255.0
        light += _blur(a, 0.8) * 1.2 + _blur(a, 4) * 0.6

    def _bolt(self):
        r = self.rng
        x, y = self.cx + r.normal(0, 0.25) * self.W, 0.0
        pts = [(x, y)]
        steps = 14
        for i in range(1, steps + 1):
            t = i / steps
            tx = x + (self.cx - x) * t + r.normal(0, 0.035) * self.W
            ty = self.cy * t
            pts.append((tx, ty))
        return pts

    # ---------- кадр ----------
    def frame(self, i):
        t = i / max(1, self.n - 1)
        img = self.base.copy()
        light = np.zeros((self.H, self.W), np.float32)   # аддитивный свет (цвет эффекта)
        fn = getattr(self, "_" + self.effect, None)
        if fn is None:
            return img
        res = fn(t, i, img, light)
        if res is not None:
            img, light = res
        out = img + light[..., None] * self.col[None, None, :] * self.k
        return np.clip(out, 0, 1)

    def _ramp(self, t, a=0.0, b=0.3):
        return float(_smooth(a, b, t))

    def _portal(self, t, i, img, light):
        g = self._ramp(t, 0.05, 0.45)
        R = self.S * (0.15 + 0.85 * g)
        ring = np.exp(-((self.D - R) / (0.09 * self.S + 1)) ** 2)
        swirl = 0.55 + 0.45 * np.sin(5 * self.A + 9 * self.D / self.S - t * 18)
        inner = np.clip(1 - self.D / (R + 1), 0, 1) ** 1.5
        # внутри портала — темнее и холоднее
        img = img * (1 - 0.55 * inner[..., None] * g) + inner[..., None] * self.col * 0.25 * g
        light += (ring * (0.7 + 0.5 * swirl) * 1.2 + inner * 0.25 * swirl) * g
        light += _blur(ring * g, self.S * 0.08) * 0.8
        self._orbit(t, light, scale=g)
        return img, light

    def _orbit(self, t, light, scale=1.0, rise=False):
        p = self.p
        lay = Image.new("L", (self.W, self.H), 0)
        d = ImageDraw.Draw(lay)
        for k in range(len(p["r0"])):
            a = p["a0"][k] + p["w"][k] * t * 3
            rr = p["r0"][k] * (0.6 + 0.4 * scale)
            y_off = -((t + p["ph"][k]) % 1.0) * p["up"][k] if rise else 0
            x, y = self.cx + math.cos(a) * rr, self.cy + math.sin(a) * rr * (0.55 if rise else 1) + y_off
            s = 1.5 + 2.5 * ((k * 7919) % 10) / 10
            d.ellipse((x - s, y - s, x + s, y + s), fill=int(255 * scale))
        a = np.asarray(lay, dtype=np.float32) / 255.0
        light += _blur(a, 1.2) * 1.4 + _blur(a, 6) * 0.9

    def _magic(self, t, i, img, light):
        self._orbit(t, light, scale=self._ramp(t, 0, 0.25), rise=True)
        light += np.exp(-(self.D / (self.S * 0.6)) ** 2) * 0.25 * self._ramp(t)

    def _aura(self, t, i, img, light):
        g = self._ramp(t, 0, 0.3)
        p, S = self.p, self.S
        n = 0.6 * self._scroll(p["n1"], t * S * 4) + 0.4 * self._scroll(p["n2"], t * S * 2)
        R = S * (0.55 + 0.05 * math.sin(t * math.pi * 6))
        shell = np.exp(-((self.D - R) / (S * 0.22)) ** 2)        # светящаяся оболочка вокруг героя
        up = np.clip((self.cy - self.Y) / S + 0.6, 0, 1.4)       # языки тянутся вверх
        a = np.clip(shell * (0.55 + up * 0.5) + (n - 0.5) * 0.9 * shell, 0, 1) * g
        light += a * (0.9 + 0.2 * math.sin(t * math.pi * 8))
        light += _blur(a, S * 0.15) * 0.7
        self._embers(t, light, self.cy + R * 0.5)

    def _fire(self, t, i, img, light):
        g = self._ramp(t, 0, 0.2)
        p, S = self.p, self.S
        sh1, sh2 = int(t * S * 5.0), int(t * S * 2.2)
        n = 0.62 * self._scroll(p["n1"], sh1) + 0.38 * self._scroll(p["n2"], sh2)
        h = (self.cy - self.Y) / (S * 1.8)                       # 0 у основания, 1 — верх пламени
        hc = np.clip(h, 0, 1.3)
        env = np.exp(-(self.dx / (S * 0.48 * (1.05 - 0.55 * np.clip(h, 0, 1)) + 1)) ** 2)
        heat = env * (1.2 - 1.3 * hc + (n - 0.5) * 1.3 * (0.4 + 0.6 * np.clip(h + 0.2, 0, 1)))
        heat[h < -0.15] = 0
        heat = np.clip(heat - 0.12, 0, 1) * g * min(1.4, self.k)
        heat = _blur(heat, 1.2)
        col = self._heat_color(heat)
        img = 1 - (1 - img) * (1 - col)                          # «экран»: огонь светится поверх кадра
        light += _blur(heat, S * 0.2) * 0.45
        self._embers(t, light, self.cy - S * 0.2)
        img = img + np.exp(-(self.D / (S * 2.4)) ** 2)[..., None] * np.array([0.14, 0.06, 0.0], np.float32) * g * self.k
        return img, light

    def _sparks(self, t, i, img, light):
        p = self.p
        lay = Image.new("L", (self.W, self.H), 0)
        d = ImageDraw.Draw(lay)
        grav = self.S * 4.0
        for k in range(len(p["birth"])):
            age = t - p["birth"][k]
            if age < 0 or age > p["life"][k]:
                continue
            a2 = max(0.0, age - 0.025)
            x1, y1 = self.cx + p["vx"][k] * age, self.cy + p["vy"][k] * age + 0.5 * grav * age * age
            x0, y0 = self.cx + p["vx"][k] * a2, self.cy + p["vy"][k] * a2 + 0.5 * grav * a2 * a2
            fade = 1 - age / p["life"][k]
            d.line((x0, y0, x1, y1), fill=int(255 * fade), width=3)
        a = np.asarray(lay, dtype=np.float32) / 255.0
        light += a * 2.2 + _blur(a, 3) * 1.8 + _blur(a, 10) * 0.8
        light += np.exp(-(self.D / (self.S * 0.35)) ** 2) * 0.6 * self._ramp(t, 0.03, 0.1)

    def _rain(self, t, i, img, light):
        p = self.p
        g = self._ramp(t, 0, 0.35)
        lay = Image.new("L", (self.W, self.H), 0)
        d = ImageDraw.Draw(lay)
        fall = t * self.H * 3.5
        cnt = int(len(p["x"]) * g)
        for k in range(cnt):
            y = (p["y"][k] + fall * p["sp"][k]) % (self.H * 1.1) - self.H * 0.05
            x = p["x"][k] - y * 0.12
            d.line((x, y, x - p["ln"][k] * 0.12, y + p["ln"][k]), fill=150, width=1)
        a = np.asarray(lay, dtype=np.float32) / 255.0
        img = img * (1 - 0.18 * g)  # пасмурнее
        light += _blur(a, 0.6) * 0.9
        return img, light

    def _snow(self, t, i, img, light):
        p = self.p
        g = self._ramp(t, 0, 0.3)
        lay = Image.new("L", (self.W, self.H), 0)
        d = ImageDraw.Draw(lay)
        for k in range(int(len(p["x"]) * g)):
            y = (p["y"][k] + t * self.H * p["sp"][k] * 2) % self.H
            x = p["x"][k] + math.sin(t * 6 + p["ph"][k]) * 12
            s = p["sz"][k]
            d.ellipse((x - s, y - s, x + s, y + s), fill=230)
        a = np.asarray(lay, dtype=np.float32) / 255.0
        img = img * (1 - 0.08 * g) + 0.06 * g
        light += _blur(a, 1.0)
        return img, light

    def _lightning(self, t, i, img, light):
        p = self.p
        dt = 1.0 / max(1, self.n - 1)
        for h, pts in zip(p["hits"], p["bolts"]):
            age = (t - h) / dt  # в кадрах
            if age < 0 or age > 5:
                continue
            fade = 1 - age / 5
            lay = Image.new("L", (self.W, self.H), 0)
            ImageDraw.Draw(lay).line(pts, fill=255, width=3)
            a = np.asarray(lay, dtype=np.float32) / 255.0
            light += (a * 2 + _blur(a, 6) * 1.5 + _blur(a, 25) * 0.6) * fade
            img = img + (0.45 * fade if age < 2 else 0.1 * fade)  # вспышка на всю сцену
        return img, light

    def _smoke(self, t, i, img, light):
        p = self.p
        lay = Image.new("L", (self.W, self.H), 0)
        d = ImageDraw.Draw(lay)
        for k in range(len(p["birth"])):
            age = t - p["birth"][k]
            if age < 0:
                continue
            x = self.cx + p["ox"][k] + p["vx"][k] * age
            y = self.cy + p["vy"][k] * age
            s = p["sz"][k] * (1 + age * 2.5)
            a = int(190 * max(0, 1 - age * 1.0))
            d.ellipse((x - s, y - s, x + s, y + s), fill=a)
        a = _blur(np.asarray(lay, dtype=np.float32) / 255.0, self.S * 0.12) * self.k
        img = img * (1 - a[..., None]) + a[..., None] * self.col
        return img, light

    def _shockwave(self, t, i, img, light):
        g = self._ramp(t, 0.05, 0.12)
        R = max(0.0, (t - 0.08) / 0.7) * self.S * 3.5
        if t > 0.08:
            w = self.S * 0.18
            ring = np.exp(-((self.D - R) / w) ** 2)
            # смещаем пиксели наружу на кольце — «волна искажения»
            push = ring * self.S * 0.08 * max(0, 1 - (t - 0.08) / 0.8)
            safe = np.maximum(self.D, 1)
            sx = np.clip(self.X - self.dx / safe * push, 0, self.W - 1).astype(np.int32)
            sy = np.clip(self.Y - self.dy / safe * push, 0, self.H - 1).astype(np.int32)
            img = img[sy, sx]
            fade = max(0, 1 - (t - 0.08) / 0.8)
            light += np.exp(-((self.D - R) / (w * 0.25)) ** 2) * 0.9 * fade
        light += np.exp(-(self.D / (self.S * 0.4)) ** 2) * 1.2 * g * max(0, 1 - t * 4)
        return img, light

    def _dissolve(self, t, i, img, light):
        f = self.p["field"]
        thr = self._ramp(t, 0.1, 0.95) * 0.95
        gone = f < thr
        edge = np.exp(-((f - thr) / 0.03) ** 2)
        bg = np.stack([_blur(self.base[..., c], 25) for c in range(3)], -1) * 0.7  # «фон» за распавшимся
        img = np.where(gone[..., None], bg, img)
        light += edge * 1.4
        # пылинки, сдуваемые вправо-вверх
        lay = Image.new("L", (self.W, self.H), 0)
        d = ImageDraw.Draw(lay)
        r = np.random.default_rng(i * 7 + 3)
        ys, xs = np.nonzero(edge > 0.5)
        if len(xs):
            sel = r.choice(len(xs), min(350, len(xs)), replace=False)
            for k in sel:
                drift = r.uniform(5, 40)
                x, y = xs[k] + drift, ys[k] - drift * 0.6
                d.ellipse((x - 1.2, y - 1.2, x + 1.2, y + 1.2), fill=220)
        light += _blur(np.asarray(lay, dtype=np.float32) / 255.0, 0.8) * 1.2
        return img, light

    def _glitch(self, t, i, img, light):
        key = self.p["keys"][i]
        g = self._ramp(t, 0, 0.2)
        s = int((3 + 14 * (key > 0.7)) * g * self.k)
        out = img.copy()
        if s:
            out[..., 0] = np.roll(img[..., 0], s, axis=1)
            out[..., 2] = np.roll(img[..., 2], -s, axis=1)
        if key > 0.75:  # горизонтальные сдвиги блоков
            r = np.random.default_rng(i)
            for _ in range(6):
                y0 = int(r.uniform(0, self.H - 20)); h = int(r.uniform(4, 30)); sh = int(r.uniform(-40, 40))
                out[y0:y0 + h] = np.roll(out[y0:y0 + h], sh, axis=1)
        scan = (np.sin(self.Y * 1.2) * 0.5 + 0.5) * 0.12 * g
        out = out * (1 - scan[..., None])
        light += (scan * 0.3)
        return out, light


def render(base_rgb, effect, frames, cx, cy, size, intensity, seed, color=""):
    """base_rgb: numpy [H,W,3] 0..1 → numpy [F,H,W,3]"""
    if effect not in EFFECTS:
        effect = "portal"  # только известные эффекты — имя не может вызвать внутренний метод
    n = frames_8n1(frames)
    r = VFXRenderer(base_rgb, effect, n, cx, cy, size, intensity, seed, color)
    return np.stack([r.frame(i) for i in range(n)], axis=0)


# ---------------- ноды ComfyUI ----------------
class DTVFXGuide:
    """Рисует черновик эффекта поверх кадра — направляющее видео для LTX."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "effect": (list(EFFECTS.keys()), {"default": "portal"}),
                "frames": ("INT", {"default": 97, "min": 9, "max": 481, "step": 8}),
                "center_x": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01}),
                "center_y": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01}),
                "size": ("FLOAT", {"default": 0.35, "min": 0.05, "max": 1.5, "step": 0.01}),
                "intensity": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 3.0, "step": 0.05}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFFFFFF}),
            },
            "optional": {
                "color": ("STRING", {"default": ""}),
                "prompt": ("STRING", {"default": "", "multiline": True}),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("guide_frames", "prompt")
    FUNCTION = "run"
    CATEGORY = "Director's Table/VFX"
    DESCRIPTION = "Код рисует, где и как движется эффект; LTX дорисовывает реализм."

    def run(self, image, effect, frames, center_x, center_y, size, intensity, seed, color="", prompt=""):
        import torch
        base = image[0].cpu().numpy()[..., :3]
        vid = render(base, effect, frames, center_x, center_y, size, intensity, seed, color)
        hint = EFFECTS.get(effect, ("", ""))[1]
        full = (prompt.strip() + (" " if prompt.strip() else "") + hint[0].upper() + hint[1:] + ".").strip() if hint else prompt
        return (torch.from_numpy(vid.astype(np.float32)), full)


NODE_CLASS_MAPPINGS = {"DTVFXGuide": DTVFXGuide}
NODE_DISPLAY_NAME_MAPPINGS = {"DTVFXGuide": "🎬 VFX Guide (Director's Table)"}
