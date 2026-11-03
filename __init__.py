"""Director's Table — режиссёрский стол поверх ComfyUI.

Пакет не добавляет новых нод. Он отдаёт интерфейс по адресу /directors-table и API:
  /directors-table/api/actions     — библиотека workflow (actions/*.json и actions/user/*.json)
  /directors-table/api/workflows   — сохранить / удалить импортированный workflow
  /directors-table/api/stats       — подробная загрузка GPU / CPU / RAM, температура
  /directors-table/api/transcribe  — распознавание речи локальным Whisper
  /directors-table/api/project     — автосохранение проекта
  /directors-table/api/commands    — словарь ассистента (с историей версий для отката)
"""
import asyncio
import json
import os
import re
import subprocess
import time

from aiohttp import web
from server import PromptServer

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
ACTIONS = os.path.join(ROOT, "actions")
LEGACY_USER_ACTIONS = os.path.join(ACTIONS, "user")  # старое место (внутри пакета — стиралось бы при переустановке)
routes = PromptServer.instance.routes

try:
    import folder_paths
    DATA = os.path.join(folder_paths.get_user_directory(), "directors-table")
except Exception:
    DATA = os.path.join(ROOT, "data")
os.makedirs(DATA, exist_ok=True)
USER_ACTIONS = os.path.join(DATA, "actions")  # свои workflow пользователя живут в ComfyUI/user/directors-table/actions
os.makedirs(USER_ACTIONS, exist_ok=True)


def log(msg):
    print(f"[Director's Table] {msg}")


# ---------------- страница ----------------
def _file(path):
    return web.FileResponse(path, headers={"Cache-Control": "no-cache"})


def _index():
    # к файлам стола дописываем «?v=время изменения» — после обновления браузер точно возьмёт свежие
    import re
    with open(os.path.join(WEB, "index.html"), encoding="utf-8") as f:
        html = f.read()
    def ver(m):
        name = m.group(2)
        try:
            v = int(os.path.getmtime(os.path.join(WEB, name)))
        except OSError:
            v = 0
        return f'{m.group(1)}/directors-table/{name}?v={v}"'
    html = re.sub(r'((?:src|href)=")/directors-table/([\w.-]+\.(?:js|css))"', ver, html)
    # CSP: скрипты только свои файлы — даже если где-то просочится чужой HTML, код в нём не выполнится
    csp = "script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
    return web.Response(text=html, content_type="text/html", headers={"Cache-Control": "no-store", "Content-Security-Policy": csp, "X-Content-Type-Options": "nosniff"})


@routes.get("/directors-table")
async def dt_index(_r):
    return _index()


@routes.get("/directors-table/")
async def dt_index_slash(_r):
    return _index()


# ---------------- библиотека workflow ----------------
def _read_actions():
    out = []
    for folder, origin in ((ACTIONS, "builtin"), (LEGACY_USER_ACTIONS, "user"), (USER_ACTIONS, "user")):
        if not os.path.isdir(folder):
            continue
        for fn in sorted(os.listdir(folder)):
            if not fn.endswith(".json"):
                continue
            try:
                with open(os.path.join(folder, fn), encoding="utf-8") as f:
                    data = json.load(f)
                data.setdefault("id", fn[:-5])
                data["origin"] = origin
                out.append(data)
            except Exception as e:
                log(f"не удалось прочитать {fn}: {e}")
    return out


# ---------------- пресеты Маэстро ----------------
PRESETS = os.path.join(ROOT, "presets")
USER_PRESETS = os.path.join(DATA, "presets")
os.makedirs(USER_PRESETS, exist_ok=True)


@routes.get("/directors-table/api/presets")
async def dt_presets(_r):
    """Встроенные пресеты + свои (ComfyUI/user/directors-table/presets/*.json — такой же формат)."""
    out = {"categories": [], "presets": []}
    for folder, origin in ((PRESETS, "builtin"), (USER_PRESETS, "user")):
        for fn in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            if not fn.endswith(".json"):
                continue
            try:
                with open(os.path.join(folder, fn), encoding="utf-8") as f:
                    d = json.load(f)
                for c in d.get("categories", []):
                    if not any(x.get("id") == c.get("id") for x in out["categories"]):
                        out["categories"].append(c)
                for p in d.get("presets", []):
                    p["origin"] = origin
                    out["presets"] = [x for x in out["presets"] if x.get("id") != p.get("id")] + [p]
            except Exception as e:
                log(f"пресеты: не прочитал {fn}: {e}")
    return web.json_response(out)


USER_LAYOUTS = os.path.join(DATA, "layouts")
os.makedirs(USER_LAYOUTS, exist_ok=True)


@routes.get("/directors-table/api/layouts")
async def dt_layouts(_r):
    """Свои раскладки зон: ComfyUI/user/directors-table/layouts/*.json (можно попросить ИИ сделать такой файл)."""
    out = []
    for fn in sorted(os.listdir(USER_LAYOUTS)):
        if fn.endswith(".json"):
            try:
                with open(os.path.join(USER_LAYOUTS, fn), encoding="utf-8") as f:
                    d = json.load(f)
                d.setdefault("id", _safe_id(fn[:-5]))
                out.append(d)
            except Exception as e:
                log(f"раскладка {fn}: {e}")
    return web.json_response(out)


@routes.get("/directors-table/api/layouts/where")
async def dt_layouts_where(_r):
    """Где лежат файлы раскладок — чтобы человек мог отдать файл ИИ и положить вариант рядом (имя-2.json)."""
    return web.json_response({"folder": USER_LAYOUTS})


@routes.post("/directors-table/api/layouts/save")
async def dt_layouts_save(request):
    """Сохранить раскладку из конструктора в файл. Только JSON, только своё имя файла, не больше 64 КБ."""
    raw = await request.read()
    if len(raw) > 65536:
        return web.json_response({"error": "слишком большой файл"}, status=400)
    try:
        d = json.loads(raw.decode("utf-8"))
        lid = str(d.get("id", ""))
        if not re.fullmatch(r"[A-Za-z0-9_.-]{1,48}", lid) or lid.startswith(".") or not isinstance(d.get("areas"), list) or len(d["areas"]) > 40:
            raise ValueError("неверная раскладка")
        clean = {"id": lid, "label": str(d.get("label") or lid)[:60], "areas": []}
        for a in d["areas"]:
            if not isinstance(a, dict):
                continue
            keep = {k: a[k] for k in ("id", "label", "note", "c", "x", "y", "w", "h", "corner", "kinds", "panel", "montage", "fs", "lines", "wf", "subs") if k in a}
            if not re.fullmatch(r"[\w:.-]{1,64}", str(keep.get("id", ""))):
                continue
            if "wf" in keep and not re.fullmatch(r"[\w:.-]{1,64}", str(keep["wf"])):
                keep.pop("wf")
            if "subs" in keep:
                keep["subs"] = [x for x in keep["subs"] if x in ("screen", "prompt", "inputs", "params", "history", "info")] if isinstance(keep["subs"], list) else []
            for k in ("x", "y", "w", "h", "fs"):
                if k in keep:
                    keep[k] = max(0.0, min(2.0, float(keep[k])))
            for k in ("label", "note"):
                if k in keep:
                    keep[k] = str(keep[k])[:80]
            clean["areas"].append(keep)
        path = os.path.join(USER_LAYOUTS, lid + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(clean, f, ensure_ascii=False, indent=1)
        return web.json_response({"ok": True, "file": path})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)


@routes.get("/directors-table/api/actions")
async def dt_actions(_r):
    return web.json_response(_read_actions())


def _safe_id(s):
    s = re.sub(r"[^a-zA-Z0-9_-]+", "-", str(s or "")).strip("-").lower()
    return s[:60] or f"wf-{int(time.time())}"


@routes.post("/directors-table/api/workflows")
async def dt_save_workflow(request):
    data = await request.json()
    if not isinstance(data, dict) or not isinstance(data.get("workflow"), dict):
        return web.json_response({"error": "Нет workflow в формате API"}, status=400)
    wid = _safe_id(data.get("id") or data.get("title"))
    data["id"] = wid
    data.pop("origin", None)
    with open(os.path.join(USER_ACTIONS, wid + ".json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return web.json_response({"id": wid})


@routes.delete("/directors-table/api/workflows/{wid}")
async def dt_delete_workflow(request):
    wid = _safe_id(request.match_info["wid"]) + ".json"
    done = False
    for folder in (USER_ACTIONS, LEGACY_USER_ACTIONS):
        path = os.path.join(folder, wid)
        if os.path.isfile(path):
            os.remove(path)
            done = True
    if done:
        return web.json_response({"ok": True})
    return web.json_response({"error": "Можно удалять только свои импортированные workflow"}, status=404)


# ---------------- статистика ----------------
_nvml = None


def _gpu_stats():
    global _nvml
    try:
        import pynvml
        if _nvml is None:
            pynvml.nvmlInit()
            _nvml = pynvml
        h = pynvml.nvmlDeviceGetHandleByIndex(0)
        name = pynvml.nvmlDeviceGetName(h)
        name = name.decode() if isinstance(name, bytes) else name
        mem = pynvml.nvmlDeviceGetMemoryInfo(h)
        util = pynvml.nvmlDeviceGetUtilizationRates(h)
        g = {"name": name, "util": util.gpu, "vram_used": mem.used, "vram_total": mem.total,
             "temp": pynvml.nvmlDeviceGetTemperature(h, pynvml.NVML_TEMPERATURE_GPU)}
        for key, fn in (("power", lambda: pynvml.nvmlDeviceGetPowerUsage(h) / 1000),
                        ("power_limit", lambda: pynvml.nvmlDeviceGetEnforcedPowerLimit(h) / 1000),
                        ("fan", lambda: pynvml.nvmlDeviceGetFanSpeed(h)),
                        ("clock", lambda: pynvml.nvmlDeviceGetClockInfo(h, pynvml.NVML_CLOCK_GRAPHICS))):
            try:
                g[key] = fn()
            except Exception:
                pass
        return g
    except Exception as e:
        return {"error": str(e)}


@routes.get("/directors-table/api/stats")
async def dt_stats(_r):
    out = {"gpu": await asyncio.get_running_loop().run_in_executor(None, _gpu_stats)}
    try:
        import psutil
        vm = psutil.virtual_memory()
        out["cpu"] = psutil.cpu_percent(interval=None)
        out["ram_used"], out["ram_total"] = vm.total - vm.available, vm.total
    except Exception:
        pass
    return web.json_response(out)


# ---------------- Whisper ----------------
_whisper = {"model": None, "name": None, "device": None}


def _ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _transcribe(raw, model_name, device, lang, task="transcribe"):
    import numpy as np
    import whisper
    proc = subprocess.run([_ffmpeg(), "-nostdin", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"],
                          input=raw, capture_output=True, check=False)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError("ffmpeg не смог прочитать запись: " + proc.stderr.decode(errors="ignore")[-300:])
    audio = np.frombuffer(proc.stdout, np.int16).astype(np.float32) / 32768.0
    if _whisper["model"] is None or _whisper["name"] != model_name or _whisper["device"] != device:
        log(f"загружаю Whisper «{model_name}» на {device} (первый раз скачивается из интернета)…")
        _whisper["model"] = whisper.load_model(model_name, device=device)
        _whisper["name"], _whisper["device"] = model_name, device
    # task="translate" — Whisper сам переводит речь на английский (офлайн, без отдельного переводчика)
    res = _whisper["model"].transcribe(audio, language=lang or None, task=task if task in ("transcribe", "translate") else "transcribe", fp16=(device == "cuda"))
    return res.get("text", "").strip(), res.get("language")


WHISPER_OK = ("tiny", "base", "small", "medium", "turbo", "large-v3-turbo")


def _whisper_name(m):
    # только имена официальных моделей — путь к файлу сюда не пройдёт (torch.load чужого файла = запуск чужого кода)
    return m if m in WHISPER_OK else "small"


@routes.post("/directors-table/api/transcribe")
async def dt_transcribe(request):
    q = request.query
    raw = await request.read()
    if not raw:
        return web.json_response({"error": "Пустая запись"}, status=400)
    try:
        t0 = time.time()
        text, lang = await asyncio.get_running_loop().run_in_executor(
            None, _transcribe, raw, _whisper_name(q.get("model")), "cuda" if q.get("device") == "cuda" else "cpu", re.sub(r"[^a-z]", "", q.get("lang", "ru"))[:3] or None, q.get("task", "transcribe"))
        return web.json_response({"text": text, "lang": lang, "sec": round(time.time() - t0, 2)})
    except ImportError:
        return web.json_response({"error": "Whisper не установлен. В папке ComfyUI: pip install openai-whisper"}, status=500)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# ---------------- проект ----------------
PROJECT = os.path.join(DATA, "project.json")


@routes.get("/directors-table/api/project")
async def dt_project_get(_r):
    if not os.path.isfile(PROJECT):
        return web.json_response({})
    with open(PROJECT, encoding="utf-8") as f:
        return web.json_response(json.load(f))


@routes.post("/directors-table/api/project")
async def dt_project_save(request):
    data = await request.json()
    tmp = PROJECT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, PROJECT)
    return web.json_response({"ok": True})



# ---------------- словарь ассистента (свои команды и сценарии) ----------------
COMMANDS = os.path.join(DATA, "commands.json")
COMMANDS_HIST = os.path.join(DATA, "commands-history")
os.makedirs(COMMANDS_HIST, exist_ok=True)


@routes.get("/directors-table/api/commands")
async def dt_commands_get(_r):
    if not os.path.isfile(COMMANDS):
        return web.json_response({"words": {}, "macros": []})
    with open(COMMANDS, encoding="utf-8") as f:
        return web.json_response(json.load(f))


@routes.post("/directors-table/api/commands")
async def dt_commands_save(request):
    data = await request.json()
    if os.path.isfile(COMMANDS):  # прошлую версию — в историю, храним 30 последних
        os.replace(COMMANDS, os.path.join(COMMANDS_HIST, time.strftime("%Y%m%d-%H%M%S") + f"-{int(time.time() * 1000) % 1000:03d}.json"))
        for old in sorted(os.listdir(COMMANDS_HIST))[:-30]:
            os.remove(os.path.join(COMMANDS_HIST, old))
    with open(COMMANDS, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return web.json_response({"ok": True})


# ---------------- модели: каталог, железо, скачивание с проверенных источников ----------------
ORCH = os.path.join(os.path.dirname(__file__), "orchestrator")
_DL = {}  # id задачи → прогресс


def _catalog():
    with open(os.path.join(ORCH, "models.json"), encoding="utf-8") as f:
        return json.load(f)


def _model_dirs(folder):
    dirs = []
    try:
        import folder_paths
        try:
            dirs += list(folder_paths.get_folder_paths(folder))
        except Exception:
            pass
        alias = {"unet": "diffusion_models", "diffusion_models": "unet", "clip": "text_encoders", "text_encoders": "clip"}.get(folder)
        if alias:
            try:
                dirs += list(folder_paths.get_folder_paths(alias))
            except Exception:
                pass
        dirs.append(os.path.join(folder_paths.models_dir, folder))
    except Exception:
        dirs.append(os.path.join(os.path.dirname(__file__), "..", "mock", "models", folder))
    out = []
    for d in dirs:
        if d not in out:
            out.append(d)
    return out


def _installed(folder, filename):
    return any(os.path.exists(os.path.join(d, filename)) for d in _model_dirs(folder))


def _hw():
    info = {"gpu": None, "vram_gb": None, "ram_gb": None, "disk_free_gb": None}
    try:
        import pynvml
        pynvml.nvmlInit()
        h = pynvml.nvmlDeviceGetHandleByIndex(0)
        n = pynvml.nvmlDeviceGetName(h)
        info["gpu"] = n.decode() if isinstance(n, bytes) else n
        info["vram_gb"] = round(pynvml.nvmlDeviceGetMemoryInfo(h).total / 2**30, 1)
    except Exception:
        try:
            import torch
            if torch.cuda.is_available():
                info["gpu"] = torch.cuda.get_device_name(0)
                info["vram_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 2**30, 1)
        except Exception:
            pass
    try:
        import psutil
        info["ram_gb"] = round(psutil.virtual_memory().total / 2**30, 1)
    except Exception:
        pass
    try:
        import shutil
        info["disk_free_gb"] = round(shutil.disk_usage(_model_dirs("checkpoints")[0] if os.path.isdir(_model_dirs("checkpoints")[0]) else os.path.dirname(__file__)).free / 2**30, 1)
    except Exception:
        pass
    return info


@routes.get("/directors-table/api/models")
async def dt_models(_r):
    cat = _catalog()
    hw = _hw()
    v = hw.get("vram_gb") or 0
    for b in cat["bundles"]:
        for fl in b["files"]:
            fl["installed"] = _installed(fl["folder"], fl["filename"])
        b["installed"] = bool(b["files"]) and all(fl["installed"] for fl in b["files"])
        b["fit"] = "best" if v >= b.get("vram_best", 99) else "ok" if v >= b.get("vram_min", 99) else "no" if v else "unknown"
    return web.json_response({"hw": hw, "catalog": cat, "downloads": _DL})


ALLOWED_MODEL_EXT = (".safetensors", ".gguf")  # только форматы, которые не могут выполнить код при загрузке (не .pt/.ckpt/.bin)
ALLOWED_MODEL_FOLDERS = {"checkpoints", "unet", "diffusion_models", "text_encoders", "clip", "vae", "vae_approx", "loras", "latent_upscale_models", "upscale_models"}


def _trusted(url, cat):
    """Адрес только из списка проверенных: https, точный хост, путь без «..» и прочих фокусов."""
    from urllib.parse import urlsplit, unquote
    import posixpath
    try:
        u = urlsplit(url)
    except Exception:
        return False
    if u.scheme != "https" or u.username or u.password or u.port not in (None, 443):
        return False
    raw = unquote(u.path)
    if ".." in raw.split("/") or "\\" in raw:
        return False
    path = posixpath.normpath(raw)
    for h in cat.get("trusted_hosts", []):
        host, _, prefix = h.partition("/")
        if u.hostname == host.lower() and (path + "/").startswith("/" + prefix.rstrip("/") + "/"):
            return True
    return False


def _safe_model_file(fl):
    name = str(fl.get("filename", ""))
    return (name == os.path.basename(name) and name not in ("", ".", "..") and name.lower().endswith(ALLOWED_MODEL_EXT)
            and fl.get("folder") in ALLOWED_MODEL_FOLDERS)


async def _download(task_id, url, dest, sha256=None):
    import aiohttp
    import hashlib
    hasher = hashlib.sha256() if sha256 else None
    st = _DL[task_id]
    part = dest + ".part"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=None, sock_read=120)) as s:
            async with s.get(url, allow_redirects=True) as r:
                if r.status != 200:
                    raise RuntimeError(f"HTTP {r.status}")
                st["total"] = int(r.headers.get("Content-Length") or 0)
                with open(part, "wb") as f:
                    async for chunk in r.content.iter_chunked(1 << 20):
                        if st.get("cancel"):
                            raise RuntimeError("отменено")
                        f.write(chunk)
                        if hasher:
                            hasher.update(chunk)
                        st["done"] += len(chunk)
        if st["total"] and st["done"] != st["total"]:
            raise RuntimeError("файл скачался не полностью")
        if hasher and hasher.hexdigest().lower() != str(sha256).lower():
            raise RuntimeError("контрольная сумма не совпала — файл подменён или повреждён, удалён")
        os.replace(part, dest)
        st["status"] = "ok"
        log(f"скачано: {dest}")
    except Exception as e:
        st["status"] = "error"
        st["error"] = str(e)
        try:
            os.remove(part)
        except OSError:
            pass


@routes.post("/directors-table/api/models/download")
async def dt_models_download(request):
    b = await request.json()
    cat = _catalog()
    bundle = next((x for x in cat["bundles"] if x["id"] == b.get("bundle")), None)
    if not bundle:
        return web.json_response({"error": "нет такого набора"}, status=400)
    started = []
    for fl in bundle["files"]:
        if b.get("file") and fl["filename"] != b["file"]:
            continue
        if _installed(fl["folder"], fl["filename"]):
            continue
        if not _trusted(fl["url"], cat) or not _safe_model_file(fl):  # только проверенные адреса и безопасные форматы
            log(f"пропускаю небезопасный файл каталога: {fl.get('filename')} ({fl.get('url')})")
            continue
        tid = f'{bundle["id"]}:{fl["filename"]}'
        if tid in _DL and _DL[tid].get("status") == "run":
            continue
        dest = os.path.join(_model_dirs(fl["folder"])[0], fl["filename"])
        _DL[tid] = {"bundle": bundle["id"], "file": fl["filename"], "folder": fl["folder"], "done": 0, "total": 0, "status": "run"}
        asyncio.get_running_loop().create_task(_download(tid, fl["url"], dest, fl.get("sha256")))
        started.append(tid)
    return web.json_response({"started": started})


@routes.post("/directors-table/api/models/cancel")
async def dt_models_cancel(request):
    b = await request.json()
    for tid, st in _DL.items():
        if st.get("bundle") == b.get("bundle") and st.get("status") == "run":
            st["cancel"] = True
    return web.json_response({"ok": True})


# ---------------- сохранённые workflow самого ComfyUI (user/default/workflows) ----------------
def _comfy_wf_dir():
    try:
        import folder_paths
        return os.path.join(folder_paths.get_user_directory(), "default", "workflows")
    except Exception:
        return os.path.join(os.path.dirname(__file__), "..", "mock", "workflows")


@routes.get("/directors-table/api/comfy-workflows")
async def dt_comfy_workflows(_r):
    d = _comfy_wf_dir()
    out = []
    if os.path.isdir(d):
        for root, _dirs, files in os.walk(d):
            for fn in files:
                if fn.lower().endswith(".json"):
                    full = os.path.join(root, fn)
                    out.append({"name": os.path.relpath(full, d).replace(os.sep, "/"), "size": os.path.getsize(full), "mtime": os.path.getmtime(full)})
    out.sort(key=lambda x: -x["mtime"])
    return web.json_response(out)


@routes.get("/directors-table/api/comfy-workflows/file")
async def dt_comfy_workflow_file(request):
    d = os.path.realpath(_comfy_wf_dir())
    path = os.path.realpath(os.path.join(d, request.query.get("name", "")))
    if os.path.commonpath([d, path]) != d or not path.lower().endswith(".json") or not os.path.isfile(path):
        return web.Response(status=404)
    return web.FileResponse(path)


# ---------------- помощник промптов: локальная LLM через Ollama + файл режиссёра ----------------
def _llm_url(u):
    """Сервер ходит только к Ollama на этом компьютере — чтобы через стол нельзя было стучаться в чужие адреса.
    Другой компьютер в сети можно разрешить переменной окружения DT_LLM_HOSTS=192.168.1.5,myserver"""
    from urllib.parse import urlsplit
    u = (u or "http://127.0.0.1:11434").strip().rstrip("/")
    try:
        p = urlsplit(u)
    except Exception:
        return "http://127.0.0.1:11434"
    allowed = {"127.0.0.1", "localhost", "::1"} | {h.strip().lower() for h in os.environ.get("DT_LLM_HOSTS", "").split(",") if h.strip()}
    if p.scheme not in ("http", "https") or (p.hostname or "").lower() not in allowed or p.username or p.password:
        return "http://127.0.0.1:11434"
    return f"{p.scheme}://{p.netloc}"


DIRECTOR = os.path.join(os.path.dirname(__file__), "director")


def _guide_for(wf):
    g = (wf or {}).get("guide")
    if not g:
        types = [n.get("class_type", "") for n in ((wf or {}).get("workflow") or {}).values()]
        if any(t.startswith("LTXV") or t == "EmptyLTXVLatentVideo" for t in types):
            g = "ltx2"
    if g and not re.fullmatch(r"[a-z0-9_-]{1,40}", str(g)):
        g = None  # только имя файла из папки director/, никаких путей
    path = os.path.join(DIRECTOR, f"{g}.md") if g else None
    return (g, open(path, encoding="utf-8").read()) if path and os.path.exists(path) else (g, "")


@routes.get("/directors-table/api/llm/models")
async def dt_llm_models(request):
    url = _llm_url(request.query.get("url"))
    try:
        import aiohttp
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=4)) as s:
            async with s.get(url + "/api/tags") as r:
                j = await r.json()
        return web.json_response({"ok": True, "models": [m.get("name") for m in j.get("models", [])]})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e), "models": []})


@routes.post("/directors-table/api/llm/enhance")
async def dt_llm_enhance(request):
    b = await request.json()
    url = _llm_url(b.get("url"))
    model = b.get("model") or ""
    wf = None
    for a in reversed(_read_actions()):  # свой workflow пользователя важнее встроенного
        if a.get("id") == b.get("wf"):
            wf = a
            break
    gname, guide = _guide_for(wf)
    director = open(os.path.join(DIRECTOR, "director.md"), encoding="utf-8").read() if os.path.exists(os.path.join(DIRECTOR, "director.md")) else ""
    system = director + ("\n\n# Model guide\n" + guide if guide else "")
    user = "idea: " + (b.get("idea") or "").strip() + "\ninputs: " + (b.get("inputs") or "none") + ("\nextra: " + b["extra"] if b.get("extra") else "")
    try:
        import aiohttp
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=180)) as s:
            if not model:
                async with s.get(url + "/api/tags") as r:
                    ms = [m.get("name") for m in (await r.json()).get("models", [])]
                if not ms:
                    return web.json_response({"error": "no-models"}, status=400)
                model = ms[0]
            opts = {"temperature": 0.6}
            if b.get("cpu"):
                opts["num_gpu"] = 0  # идёт генерация — помощник считает на процессоре и не отнимает видеопамять
            payload = {"model": model, "stream": False, "keep_alive": 0,  # сразу выгрузить — видеопамять нужна генерации
                       "options": opts,
                       "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
            async with s.post(url + "/api/chat", json=payload) as r:
                j = await r.json()
        text = (j.get("message") or {}).get("content", "").strip()
        text = re.sub(r"(?s)<think>.*?</think>", "", text).strip().strip('"').strip()
        return web.json_response({"text": text, "model": model, "guide": gname})
    except Exception as e:
        return web.json_response({"error": "no-ollama", "detail": str(e)}, status=400)


@routes.post("/directors-table/api/llm/plan")
async def dt_llm_plan(request):
    """Оркестратор: задача пользователя → какой набор моделей и какой виджет взять (JSON)."""
    b = await request.json()
    url = _llm_url(b.get("url"))
    model = b.get("model") or ""
    try:
        agent = open(os.path.join(ORCH, "AGENT.md"), encoding="utf-8").read()
    except Exception:
        agent = ""
    cat = _catalog()
    hw = _hw()
    bundles = [{"id": x["id"], "task": x["task"], "title": x["title"], "vram_min": x.get("vram_min"), "installed": bool(x["files"]) and all(_installed(f["folder"], f["filename"]) for f in x["files"])} for x in cat["bundles"]]
    actions = [{"id": a.get("id"), "title": a.get("title"), "about": a.get("about", "")[:160]} for a in _read_actions()]
    context = json.dumps({"hardware": hw, "bundles": bundles, "widgets": actions}, ensure_ascii=False)
    user = "Context: " + context + "\n\nUser request: " + (b.get("request") or "") + "\nAnswer with JSON only, in the user's language for 'reply'."
    try:
        import aiohttp
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=180)) as s:
            if not model:
                async with s.get(url + "/api/tags") as r:
                    ms = [m.get("name") for m in (await r.json()).get("models", [])]
                if not ms:
                    return web.json_response({"error": "no-models"}, status=400)
                model = ms[0]
            payload = {"model": model, "stream": False, "keep_alive": 0, "format": "json", "options": {"temperature": 0.3},
                       "messages": [{"role": "system", "content": agent}, {"role": "user", "content": user}]}
            async with s.post(url + "/api/chat", json=payload) as r:
                j = await r.json()
        text = re.sub(r"(?s)<think>.*?</think>", "", (j.get("message") or {}).get("content", "")).strip()
        m = re.search(r"(?s)\{.*\}", text)
        plan = json.loads(m.group(0)) if m else {"reply": text}
        ids_b = {x["id"] for x in bundles}
        ids_a = {a["id"] for a in actions}
        if plan.get("bundle") not in ids_b:
            plan["bundle"] = None
        if plan.get("action") not in ids_a:
            plan["action"] = None
        plan["model"] = model
        return web.json_response(plan)
    except Exception as e:
        return web.json_response({"error": "no-ollama", "detail": str(e)}, status=400)


# ---------------- предпросмотр VFX-черновика (быстро, на процессоре) ----------------
MEDIA_EXT = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".mp4", ".webm", ".mov", ".mkv", ".m4v", ".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".opus")


def _num(v, lo, hi, default):
    import math
    try:
        v = float(v)
    except (TypeError, ValueError):
        return default
    return min(hi, max(lo, v)) if math.isfinite(v) else default


def _input_path(f):
    name, sub, typ = f.get("filename", ""), f.get("subfolder", ""), f.get("type", "input")
    try:
        import folder_paths
        base = folder_paths.get_output_directory() if typ == "output" else folder_paths.get_temp_directory() if typ == "temp" else folder_paths.get_input_directory()
    except Exception:
        base = os.environ.get("DT_INPUT_DIR", os.path.join(os.path.dirname(__file__), "..", "mock", "input"))
    if typ not in ("input", "output", "temp"):
        raise ValueError("bad type")
    if not str(name).lower().endswith(MEDIA_EXT):
        raise ValueError("bad file type")
    base = os.path.realpath(base)
    path = os.path.realpath(os.path.join(base, sub, name))
    # строго внутри папки ComfyUI (commonpath, а не startswith: «input2» не должна пройти как «input»)
    if os.path.commonpath([base, path]) != base or not os.path.isfile(path):
        raise ValueError("bad path")
    return path


@routes.post("/directors-table/api/vfx-preview")
async def dt_vfx_preview(request):
    body = await request.json()
    def work():
        import io
        import numpy as np
        from PIL import Image
        try:
            from . import vfx as V
        except Exception:
            import importlib.util
            spec = importlib.util.spec_from_file_location("dt_vfx", os.path.join(os.path.dirname(__file__), "vfx.py"))
            V = importlib.util.module_from_spec(spec); spec.loader.exec_module(V)
        im = Image.open(_input_path(body.get("file") or {})).convert("RGB")
        w = 360; h = max(64, int(im.height * w / im.width))
        base = np.asarray(im.resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
        frames = V.render(base, str(body.get("effect", "portal")), 33, _num(body.get("cx"), 0, 1, .5), _num(body.get("cy"), 0, 1, .5), _num(body.get("size"), .05, 1, .35), _num(body.get("intensity"), 0, 3, 1), int(_num(body.get("seed"), 0, 2**31, 7)), str(body.get("color", ""))[:9])
        pics = [Image.fromarray((np.clip(f, 0, 1) * 255).astype("uint8")) for f in frames]
        buf = io.BytesIO()
        pics[0].save(buf, format="GIF", save_all=True, append_images=pics[1:], duration=int(1000 * _num(body.get("seconds"), 1, 20, 3) / len(pics)), loop=0)
        return buf.getvalue()
    try:
        data = await asyncio.get_running_loop().run_in_executor(None, work)
        return web.Response(body=data, content_type="image/gif")
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)


# ---------------- освободить всё (видеопамять и оперативную память) ----------------
def _free_all():
    out = {}
    try:
        import comfy.model_management as mm
        mm.unload_all_models()
        mm.soft_empty_cache(True)
        out["models"] = "unloaded"
    except Exception as e:
        out["models"] = f"skip: {e}"
    try:
        # сбросить кэш результатов нод (держит тензоры в RAM)
        q = getattr(PromptServer.instance, "prompt_queue", None)
        if q is not None and hasattr(q, "set_flag"):
            q.set_flag("unload_models", True)
            q.set_flag("free_memory", True)
            out["cache"] = "flagged"
    except Exception as e:
        out["cache"] = f"skip: {e}"
    try:
        import gc
        gc.collect()
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass
    try:
        # Windows: вернуть системе неиспользуемые страницы памяти процесса
        if os.name == "nt":
            import ctypes
            h = ctypes.windll.kernel32.GetCurrentProcess()
            ctypes.windll.psapi.EmptyWorkingSet(h)
            out["trim"] = "ok"
    except Exception as e:
        out["trim"] = f"skip: {e}"
    return out


@routes.post("/directors-table/api/free-all")
async def dt_free_all(_r):
    res = await asyncio.get_running_loop().run_in_executor(None, _free_all)
    log(f"free-all: {res}")
    return web.json_response(res)


@routes.post("/directors-table/api/commands/undo")
async def dt_commands_undo(_r):
    hist = sorted(os.listdir(COMMANDS_HIST))
    if not hist:
        return web.json_response({"error": "истории ещё нет"}, status=404)
    last = os.path.join(COMMANDS_HIST, hist[-1])
    os.replace(last, COMMANDS)
    with open(COMMANDS, encoding="utf-8") as f:
        return web.json_response(json.load(f))


# ---------------- живое превью ----------------
@routes.post("/directors-table/api/preview-method")
async def dt_preview_method(request):
    """Если ComfyUI запущен без превью, включаем его на лету (новые версии понимают и extra_data.preview_method)."""
    b = await request.json()
    want = (b.get("method") or "auto").lower()
    try:
        from comfy.cli_args import args, LatentPreviewMethod
        cur = args.preview_method
        if want == "off":
            return web.json_response({"method": str(cur)})
        if cur == LatentPreviewMethod.NoPreviews:
            args.preview_method = LatentPreviewMethod.Auto
            log("живое превью включено (auto)")
        approx = []
        try:
            import folder_paths
            approx = folder_paths.get_filename_list("vae_approx")
        except Exception:
            pass
        return web.json_response({"method": str(args.preview_method), "vae_approx": approx})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=200)


# ---------------- видео: последний кадр, склейка монтажа, ролик «поделиться» ----------------
def _out_dir():
    try:
        import folder_paths
        d = os.path.join(folder_paths.get_output_directory(), "directors-table")
    except Exception:
        d = os.path.join(os.environ.get("DT_OUTPUT_DIR", os.path.join(ROOT, "..", "mock", "output")), "directors-table")
    os.makedirs(d, exist_ok=True)
    return d


def _in_dir():
    try:
        import folder_paths
        d = os.path.join(folder_paths.get_input_directory(), "directors-table")
    except Exception:
        d = os.path.join(os.environ.get("DT_INPUT_DIR", os.path.join(ROOT, "..", "mock", "input")), "directors-table")
    os.makedirs(d, exist_ok=True)
    return d


def _run_ff(args, timeout=900):
    # перед каждым файловым входом — только локальные файлы: плейлист не заставит ffmpeg ходить в сеть
    safe, i = [], 0
    while i < len(args):
        if args[i] == "-i" and not (i >= 2 and args[i - 2] == "-f" and args[i - 1] == "lavfi"):
            safe += ["-protocol_whitelist", "file", "-i", args[i + 1]]
            i += 2
            continue
        safe.append(args[i])
        i += 1
    p = subprocess.run([_ffmpeg(), "-hide_banner", "-loglevel", "error", "-y"] + safe, capture_output=True, timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError("ffmpeg: " + p.stderr.decode(errors="ignore")[-400:])


def _has_audio(path):
    p = subprocess.run([_ffmpeg(), "-hide_banner", "-protocol_whitelist", "file", "-i", path], capture_output=True, timeout=30)
    return b"Audio:" in p.stderr


def _stamp(prefix, ext):
    return f"{prefix}_{time.strftime('%Y%m%d_%H%M%S')}_{int(time.time() * 1000) % 1000:03d}.{ext}"


@routes.post("/directors-table/api/last-frame")
async def dt_last_frame(request):
    """Последний кадр видео → картинка во входящих ComfyUI (для связки шотов: конец одного = начало следующего)."""
    b = await request.json()
    def work():
        src = _input_path(b.get("file") or {})
        name = _stamp("lastframe", "png")
        dst = os.path.join(_in_dir(), name)
        try:
            _run_ff(["-sseof", "-0.25", "-i", src, "-update", "1", "-frames:v", "1", dst], 120)
        except Exception:
            _run_ff(["-i", src, "-vf", "reverse", "-frames:v", "1", dst], 300)
        return {"filename": name, "subfolder": "directors-table", "type": "input"}
    try:
        return web.json_response(await asyncio.get_running_loop().run_in_executor(None, work))
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)


def _norm_clip(src, kind, dur, w, h, fps, tmp):
    """Любой клип → одинаковый формат (размер, fps, звук) для честной склейки без рассинхрона."""
    out = os.path.join(tmp, f"n{len(os.listdir(tmp)):03d}.mp4")
    vf = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,fps={fps},format=yuv420p,setsar=1"
    if kind == "image":
        _run_ff(["-loop", "1", "-t", str(dur), "-i", src, "-f", "lavfi", "-t", str(dur), "-i", "anullsrc=r=48000:cl=stereo",
                 "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-c:a", "aac", "-shortest", out])
    elif _has_audio(src):
        _run_ff(["-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-c:a", "aac", "-ar", "48000", "-ac", "2", out])
    else:
        _run_ff(["-i", src, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-vf", vf, "-c:v", "libx264", "-preset", "veryfast",
                 "-crf", "19", "-c:a", "aac", "-shortest", out])
    return out


def _probe_size(path):
    try:
        import cv2
        cap = cv2.VideoCapture(path)
        w, h = int(cap.get(3)), int(cap.get(4))
        cap.release()
        if w and h:
            return w, h
    except Exception:
        pass
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return 1280, 704


@routes.post("/directors-table/api/montage-export")
async def dt_montage_export(request):
    """Монтаж → один mp4: клипы по порядку + музыка/озвучка под весь ролик."""
    b = await request.json()
    def work():
        import shutil
        import tempfile
        clips = (b.get("clips") or [])[:200]
        if not clips:
            raise ValueError("пустой монтаж")
        tmp = tempfile.mkdtemp(prefix="dt_cut_")
        try:
            first = next((c for c in clips if c.get("kind") == "video"), clips[0])
            w, h = _probe_size(_input_path(first["file"]))
            w, h = int(_num(w, 64, 4096, 1280)), int(_num(h, 64, 4096, 704))
            w, h = w - w % 2, h - h % 2
            fps = int(_num(b.get("fps"), 8, 60, 24))
            parts = [_norm_clip(_input_path(c["file"]), "image" if c.get("kind") == "image" else "video", _num(c.get("dur"), 0.5, 60, 2.5), w, h, fps, tmp) for c in clips]
            lst = os.path.join(tmp, "list.txt")
            with open(lst, "w", encoding="utf-8") as f:
                for p in parts:
                    f.write("file '" + p.replace("\\", "/").replace("'", "'\\''") + "'\n")
            joined = os.path.join(tmp, "joined.mp4")
            _run_ff(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined])
            name = _stamp("montage", "mp4")
            dst = os.path.join(_out_dir(), name)
            music = b.get("music")
            if music:
                mv = _num(b.get("music_volume"), 0, 2, 0.6)
                _run_ff(["-i", joined, "-stream_loop", "-1", "-i", _input_path(music), "-filter_complex",
                         f"[1:a]volume={mv}[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]",
                         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", dst])
            else:
                _run_ff(["-i", joined, "-c", "copy", "-movflags", "+faststart", dst])
            return {"filename": name, "subfolder": "directors-table", "type": "output"}
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    try:
        return web.json_response(await asyncio.get_running_loop().run_in_executor(None, work))
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)


def _font(size):
    from PIL import ImageFont
    for f in ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def _label_png(path, top, sub, W=1080, H=1920):
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f1, f2, f3 = _font(78), _font(38), _font(34)
    tw = d.textlength(top, font=f1)
    # подпись повыше (в верхней десятой части кадра), пометка снизу — над кнопками плеера соцсетей
    d.rounded_rectangle([(W - tw) / 2 - 40, 70, (W + tw) / 2 + 40, 190], 30, fill=(14, 11, 20, 215), outline=(240, 255, 65, 200), width=3)
    d.text(((W - tw) / 2, 86), top, font=f1, fill=(240, 255, 65, 255))
    if sub:
        sw = d.textlength(sub, font=f2)
        d.text(((W - sw) / 2, 214), sub, font=f2, fill=(255, 255, 255, 235), stroke_width=2, stroke_fill=(0, 0, 0, 160))
    mark = "Director's Table  ·  ComfyUI  ·  open weights"
    mw = d.textlength(mark, font=f3)
    d.text(((W - mw) / 2, H - 290), mark, font=f3, fill=(255, 255, 255, 200), stroke_width=2, stroke_fill=(0, 0, 0, 140))
    im.save(path)


@routes.post("/directors-table/api/share")
async def dt_share(request):
    """Вертикальный ролик для соцсетей: было → черновик кода → стало (LTX)."""
    b = await request.json()
    def work():
        import shutil
        import tempfile
        tmp = tempfile.mkdtemp(prefix="dt_share_")
        try:
            vf = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0e0b14,fps=30,format=yuv420p,setsar=1"
            segs = []
            def seg(src, is_image, dur, top, sub):
                lab = os.path.join(tmp, f"l{len(segs)}.png")
                _label_png(lab, top, sub)
                out = os.path.join(tmp, f"s{len(segs)}.mp4")
                vin = (["-loop", "1", "-t", str(dur)] if is_image else []) + ["-i", src]
                has_a = (not is_image) and _has_audio(src)
                ain = [] if has_a else ["-f", "lavfi", "-t", str(dur) if is_image else "600", "-i", "anullsrc=r=48000:cl=stereo"]
                fc = f"[0:v]{vf}[b];[b][1:v]overlay=0:0[v]"
                args = vin + ["-i", lab] + ain + ["-filter_complex", fc, "-map", "[v]", "-map", "0:a" if has_a else "2:a",
                                                  "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest"]
                if is_image:
                    args += ["-t", str(dur)]
                _run_ff(args + [out])
                segs.append(out)
            before = b.get("before")
            if before:
                seg(_input_path(before), before.get("kind", "image") == "image", 1.6, "BEFORE", b.get("before_sub") or "one frame")
            fx = b.get("vfx")
            if fx and before:
                import numpy as np
                from PIL import Image
                try:
                    from . import vfx as V
                except Exception:
                    import importlib.util
                    spec = importlib.util.spec_from_file_location("dt_vfx", os.path.join(ROOT, "vfx.py"))
                    V = importlib.util.module_from_spec(spec); spec.loader.exec_module(V)
                im = Image.open(_input_path(before)).convert("RGB")
                w = 540; h = max(64, int(im.height * w / im.width)) // 2 * 2
                base = np.asarray(im.resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
                frames = V.render(base, str(fx.get("effect", "portal")), 49, _num(fx.get("cx"), 0, 1, .5), _num(fx.get("cy"), 0, 1, .5), _num(fx.get("size"), .05, 1, .35), _num(fx.get("intensity"), 0, 3, 1), int(_num(fx.get("seed"), 0, 2**31, 7)), str(fx.get("color", ""))[:9])
                fd = os.path.join(tmp, "fx"); os.makedirs(fd)
                for i, fr in enumerate(frames):
                    Image.fromarray((np.clip(fr, 0, 1) * 255).astype("uint8")).save(os.path.join(fd, f"{i:03d}.png"))
                draft = os.path.join(tmp, "draft.mp4")
                _run_ff(["-framerate", "24", "-i", os.path.join(fd, "%03d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", draft])
                seg(draft, False, 2, "CODE DRAFT", "python draws where the effect moves")
            after = b.get("after")
            if not after:
                raise ValueError("нет результата")
            seg(_input_path(after), after.get("kind", "video") == "image", 3, str(b.get("after_title") or "LTX-2 RESULT")[:40], str(b.get("after_sub") or "realistic video + sound, locally")[:80])
            lst = os.path.join(tmp, "list.txt")
            with open(lst, "w", encoding="utf-8") as f:
                for p in segs:
                    f.write("file '" + p.replace("\\", "/") + "'\n")
            name = _stamp("share", "mp4")
            _run_ff(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", os.path.join(_out_dir(), name)])
            return {"filename": name, "subfolder": "directors-table", "type": "output"}
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    try:
        return web.json_response(await asyncio.get_running_loop().run_in_executor(None, work))
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)


# ---------------- сценарий: свободный текст → список кадров (подсказки для слабой локальной модели) ----------------
def _split_shots(text):
    """Без нейросети: строки или предложения → кадры. Запасной путь, если модели нет или она ответила криво."""
    lines = [l.strip() for l in re.split(r"\n+", text or "") if l.strip()]
    if len(lines) == 1:
        lines = [x.strip() for x in re.split(r"(?<=[.!?…])\s+", lines[0]) if x.strip()]
    out = []
    for l in lines:
        l = re.sub(r"^\s*(?:кадр|шот|shot|scene|сцена|plan|план|escena|plano|szene|cena)?\s*\d+\s*[:.)\-–—]\s*", "", l, flags=re.I)
        sec = None
        m = re.search(r"[\(\[]?\s*(\d{1,2})\s*(?:с|сек|s|sec|seconds?|секунд\w*)\s*[\)\]]?", l, flags=re.I)
        if m:
            sec = int(m.group(1)); l = (l[:m.start()] + l[m.end():]).strip(" ,.;")
        if l:
            out.append({"text": l, "seconds": sec})
    return out[:24]


@routes.post("/directors-table/api/llm/script")
async def dt_llm_script(request):
    b = await request.json()
    text = (b.get("text") or "").strip()
    fallback = _split_shots(text)
    url = _llm_url(b.get("url"))
    model = b.get("model") or ""
    try:
        system = open(os.path.join(DIRECTOR, "script.md"), encoding="utf-8").read()
    except Exception:
        system = "Split the story into shots. Answer JSON: {\"shots\":[{\"text\":\"...\",\"seconds\":4}]}"
    try:
        import aiohttp
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=180)) as s:
            if not model:
                async with s.get(url + "/api/tags") as r:
                    ms = [m.get("name") for m in (await r.json()).get("models", [])]
                if not ms:
                    return web.json_response({"shots": fallback, "source": "rules"})
                model = ms[0]
            payload = {"model": model, "stream": False, "keep_alive": 0, "format": "json", "options": {"temperature": 0.2, **({"num_gpu": 0} if b.get("cpu") else {})},
                       "messages": [{"role": "system", "content": system}, {"role": "user", "content": text}]}
            async with s.post(url + "/api/chat", json=payload) as r:
                j = await r.json()
        raw = re.sub(r"(?s)<think>.*?</think>", "", (j.get("message") or {}).get("content", "")).strip()
        m = re.search(r"(?s)\{.*\}", raw)
        shots = (json.loads(m.group(0)) if m else {}).get("shots") or []
        clean = []
        for x in shots[:24]:
            t = (x.get("text") if isinstance(x, dict) else str(x) or "").strip()
            if t:
                sec = x.get("seconds") if isinstance(x, dict) else None
                clean.append({"text": t, "seconds": int(sec) if isinstance(sec, (int, float)) and 1 <= sec <= 20 else None})
        if not clean:
            return web.json_response({"shots": fallback, "source": "rules", "model": model})
        return web.json_response({"shots": clean, "source": "llm", "model": model})
    except Exception as e:
        return web.json_response({"shots": fallback, "source": "rules", "detail": str(e)})


SOCIAL_NETS = {"instagram", "reels", "tiktok", "youtube", "shorts", "telegram", "linkedin", "x", "facebook"}


@routes.post("/directors-table/api/llm/captions")
async def dt_llm_captions(request):
    """Продакшн → соцсети: одна идея поста → подпись под каждую соцсеть (локальная Ollama, ничего не публикуется)."""
    b = await request.json()
    url = _llm_url(b.get("url"))
    model = b.get("model") or ""
    nets = [n for n in (b.get("nets") or []) if n in SOCIAL_NETS][:9] or ["instagram", "telegram", "x"]
    about = str(b.get("about") or "").strip()[:1500]
    brand = str(b.get("brand") or "").strip()[:80]
    rules = str(b.get("rules") or "").strip()[:800]
    lang = str(b.get("lang") or "en")[:10]
    if not about:
        return web.json_response({"error": "empty"}, status=400)
    system = ("You write social media captions. Answer JSON only: {\"captions\": {\"<network>\": \"<text>\"}} with one key per requested network. "
              "Match each network's style: instagram — warm, 3-6 hashtags at the end; reels/tiktok/shorts — one punchy hook line plus 2-4 hashtags; "
              "youtube — a clear title line, then 2 short sentences; telegram — friendly, short paragraph, no hashtags; "
              "linkedin — professional, 2-3 short sentences, a takeaway; x — under 260 characters; facebook — conversational, 1-3 sentences. "
              "Never invent facts, prices, people or results that are not in the brief. Write in language: " + lang + ".")
    user = "Networks: " + ", ".join(nets) + "\nBrand / account: " + (brand or "-") + "\nWhat the post is about: " + about + ("\nAuthor's rules: " + rules if rules else "")
    try:
        import aiohttp
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=180)) as s:
            if not model:
                async with s.get(url + "/api/tags") as r:
                    ms = [m.get("name") for m in (await r.json()).get("models", [])]
                if not ms:
                    return web.json_response({"error": "no-models"}, status=400)
                model = ms[0]
            payload = {"model": model, "stream": False, "keep_alive": 0, "format": "json", "options": {"temperature": 0.7, **({"num_gpu": 0} if b.get("cpu") else {})},
                       "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
            async with s.post(url + "/api/chat", json=payload) as r:
                j = await r.json()
        raw = re.sub(r"(?s)<think>.*?</think>", "", (j.get("message") or {}).get("content", "")).strip()
        m = re.search(r"(?s)\{.*\}", raw)
        caps = (json.loads(m.group(0)) if m else {}).get("captions") or {}
        out = {n: str(caps.get(n) or "").strip()[:2200] for n in nets if isinstance(caps, dict) and caps.get(n)}
        return web.json_response({"captions": out, "model": model})
    except Exception as e:
        return web.json_response({"error": "no-ollama", "detail": str(e)}, status=400)


# ---------------- статика (последним, чтобы не перекрыть api) ----------------
@routes.get("/directors-table/{name}")
async def dt_static(request):
    name = request.match_info["name"]
    path = os.path.normpath(os.path.join(WEB, name))
    if not path.startswith(WEB + os.sep) or not os.path.isfile(path):
        return web.Response(status=404)
    return _file(path)


# ---------------- защита API от чужих сайтов ----------------
# Все запросы стола к своему API несут заголовок X-DT: 1. Чужой сайт не может его добавить без разрешения
# браузера (CORS preflight), поэтому даже если ComfyUI открыт в сети (--listen), сторонняя страница не сможет
# управлять столом от вашего имени.
def _guard(handler):
    async def wrapped(request):
        if request.headers.get("X-DT") != "1":
            return web.json_response({"error": "forbidden: missing X-DT header"}, status=403)
        return await handler(request)
    return wrapped


try:
    _items = routes._items
    for _i, _r in enumerate(_items):
        if isinstance(_r, web.RouteDef) and _r.path.startswith("/directors-table/api/"):
            _items[_i] = web.RouteDef(_r.method, _r.path, _guard(_r.handler), _r.kwargs)
except Exception as _e:
    log(f"не удалось включить защиту API: {_e}")

log("интерфейс: <адрес ComfyUI>/directors-table (ComfyUI Desktop обычно http://127.0.0.1:8000/directors-table)")

try:
    from .vfx import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS  # ноды VFX-черновиков для LTX
except Exception as e:  # стол работает и без них
    log(f"VFX nodes not loaded: {e}")
    NODE_CLASS_MAPPINGS = {}
    NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
