# 🎬 Director's Table

**A director's desk on top of ComfyUI.** You don't have to work in a web of nodes. You get a canvas with zones (video, images, effects, montage, sound…), one-click workflow widgets, a radial menu, piano-style hotkeys, a task plan, voice commands, and code-driven VFX for LTX. Everything runs **locally on open-weights models**.

> Built for the Comfy **Open Source Higgsfield** challenge. Categories: Best Overall · Most Innovative · Most Viral · Open Weights Only · VFX Workflow Built with LTX.

### Two modes in one studio

| 🎬 **Director** | ✦ **Production** |
|---|---|
| The desk: zones, threads, Maestro, piano keys, camera sphere, script → film. Full control for people who like to direct every shot. | A Higgsfield-style showcase for everyone else: categories on the left (Video · Cinema studio · VFX · Lipsync & voice · Music · Images · Influencer & social · Edit), big task cards in the middle. Click *Talking photo* and a ready workspace opens — prompt, inputs, ▶ Run, result, history. No nodes, no zones. |

Switch at the top of the screen. **52 task cards, 34 of them backed by 38 official open-weights ComfyUI templates** that already ship with ComfyUI — character swap in video (Wan SCAIL), multi-person lipsync (InfiniteTalk), HuMo, LTX 2.3 IC-LoRA control, ID-LoRA for a consistent influencer face and voice, character & scene angles (Qwen Multiple-Angles), photo edit and outfit swap (Qwen-Image-Edit 2511), relight, background removal (BiRefNet), layers, photo → 3D (Hunyuan3D), music (ACE-Step 1.5), upscale, frame interpolation, object removal and outpainting in video (Wan VACE)… No partner nodes, no API templates.

Every card says honestly what it is: **ready** (works now), **1 click · Comfy template** (the desk checks which models you have, links the missing files and turns the template into a ready workspace), or **in development** (on our roadmap; the card links to open projects by other authors — we link, we don't copy their code).

**🧬 Influencer studio** — Higgsfield-style character builder on open models: 19 look settings as buttons (who, gender, origin, age, skin, build, face and eye shape, hair, facial hair, distinctive features like freckles, vitiligo, braces, elf ears, outfit, accessories, background, framing), three levels from *Average* to *Extreme*, *in your own words* in any language, 🎲 random. Generates 4 portraits on your text-to-image model (Z-Image Turbo / FLUX.2 klein fit 12 GB), builds a character sheet (one-image turnaround, or exact angles from the picked portrait via the official Qwen Multiple-Angles template), then saves the hero to *Characters*, animates it, makes it talk, keeps face and voice with LTX 2.3 ID-LoRA (no training), and exports a captioned LoRA training set (ai-toolkit format).

**Influencer & social** — see one result inside Instagram, Reels/TikTok, YouTube, Shorts, Telegram, LinkedIn, X and Facebook frames at once, with crop warnings and safe zones; a local model (Ollama) writes a caption for each network from one sentence; images export in every size (1080×1350, 1080×1920, 1920×1080…). Nothing is posted anywhere, and an *AI-generated* tag is on by default.

### For the judges — 30-second tour

Open **✦ Production** at the top, then try *Talking photo* or *Social preview*. For the desk, open **Tools → 🎥 Demo for recording**: the table shows itself in ~75 seconds (nothing is generated, everything is restored afterwards).

| Category | What to look at |
|---|---|
| **Most Innovative** | Play ComfyUI like an instrument: **piano keys** hold scenes, studios, presets and workflows (MIDI works too). **◉ Maestro** — a hologram of Higgsfield-style presets you drag onto any workflow. **🎥 Camera sphere** — drag start/end points around the hero, the camera prompt writes itself (Re-shoot style). **🧩 Studio builder** — users build their *own* workspace from blocks, no code. **Script → film** with last-frame chaining. **Code-drawn VFX drafts** guiding LTX. |
| **Most Viral** | One-click **Share**: vertical 9:16 "before → code draft → LTX result" with captions and buttons for X / YouTube Shorts / TikTok / Instagram / Facebook / Telegram. Voice commands, curtains with a live status, quiet UI sounds, a playful onboarding tour. |
| **Open Weights Only** | No partner nodes, no paid APIs. LTX-2 (video + audio), Whisper (voice) and Ollama (prompt helper) all run locally. Models download only from a short allowlist of Hugging Face repos (`orchestrator/models.json`). |
| **VFX Workflow Built with LTX** | `🎬 VFX Guide` node draws an animated effect draft (fire, portal, lightning, aura, shockwave…) over your frame; LTX-2 turns it into realistic video **with sound** (`actions/ltx2-vfx.json`). 30+ VFX presets in Maestro drive both the draft and the prompt. Standalone file for ComfyUI: `workflows/ltx2_vfx_guide_API.json`. |

[Русская версия](README.ru.md)

---

## Why

ComfyUI is the most powerful open generation engine, but for a filmmaker it feels like wiring a modular synth. Director's Table keeps ComfyUI as the engine and gives you a **director's workflow** on top of it:

- **Think in shots, not nodes.** Drop an image on a widget, click where the effect should be, press Ctrl+Enter.
- **Play it like an instrument.** White keys 1–0 hold scenes *or* workflows, black keys hold favorite actions, extra rows A–L / Z–M hold more workflows. Every key works even when the piano is hidden.
- **Plan and walk away.** Queue a chain of tasks (video → music → voiceover…), reorder them by drag, switch *Auto* on, close the curtains, go make tea.
- **Code-driven VFX for LTX** (new): Python nodes draw an animated *effect draft* over your frame, such as a portal, sparks, rain, lightning or a shockwave. LTX-2 turns the draft into realistic video **with sound**. The code decides *where and how* the effect moves, and LTX makes it look real.

## Install

1. Copy the folder `comfyui-directors-table` into `ComfyUI/custom_nodes` (ComfyUI Desktop: the `custom_nodes` folder in the data folder you chose on install).
2. Restart ComfyUI.
3. Open the table while ComfyUI is running:
   - ComfyUI Desktop: http://127.0.0.1:8000/directors-table
   - regular ComfyUI: http://127.0.0.1:8188/directors-table
   - or inside ComfyUI: **Extensions → Open Director's Table** (Alt+D).

No extra Python packages are needed for the table and the VFX nodes, only numpy and Pillow, which ComfyUI already has. Optional extras:
- **Voice:** `openai-whisper` in ComfyUI's Python. The model downloads on first use.
- **✨ Prompt helper:** [Ollama](https://ollama.com) plus a small model: `ollama pull gemma3:4b`.
- **Built-in LTX actions:** LTX-2 19B distilled (fp8), the LTX2 video VAE, Gemma 3 12B text encoder (the standard LTX-2 ComfyUI setup), plus `ComfyUI-LTXVideo`, `ComfyUI-KJNodes`, `ComfyUI-VideoHelperSuite` and `ComfyUI-GGUF`.

## Minimal setup for the built-in LTX widgets

The ready-made widgets (`actions/ltx2-vfx.json`, `ltx2-transition.json`, `ltx2-voice.json`) use the standard LTX-2 ComfyUI files. Put them here:

| File | Folder (`ComfyUI/models/…`) |
|---|---|
| `ltx-2-19b-distilled-fp8.safetensors` | `checkpoints` |
| `ltx-2-19b-distilled-lora-384.safetensors` | `loras` |
| `gemma_3_12B_it_fp8_e4m3fn.safetensors` | `text_encoders` |
| `ltx-2-19b-embeddings_connector_dev_bf16.safetensors` | `text_encoders` |
| `LTX2_video_vae_bf16.safetensors` | `vae` |
| `taeltx2_3.safetensors` *(optional, sharp live preview)* | `vae` |

Custom node packs: **ComfyUI-LTXVideo**, **ComfyUI-KJNodes**, **ComfyUI-VideoHelperSuite**, **ComfyUI-GGUF**, **ComfyUI-Custom-Scripts** (pysssss, for `ltx2-voice`), and the **OmniVoice** nodes for `omnivoice-tts`. Install them with ComfyUI Manager. ~12 GB VRAM is enough (tested on an RTX 5070 12 GB + 64 GB RAM).

**No workflow of your own?** *Tools → 📚 Comfy templates* turns any official template that ships with ComfyUI (LTX-2 text-to-video, FLUX/SDXL images, audio…) into a widget in one click, and shows which models you're missing. If a model is missing at run time, the widget tells you exactly which file and which folder.

## Quick start (60 seconds)

1. Drop an image from your file manager onto the canvas. It lands in **Images**.
2. Drag it onto the **VFX effect** widget (zone *Effects*). Pick *Magic portal*, **click on the frame** where the portal should open, then press **👁 Draft** to preview the effect draft in about two seconds.
3. Press **Run** (Ctrl+Enter). The widget shows the stage, the step, the time elapsed and the time left. Click the badge to see *what ComfyUI is doing right now*.
4. The finished video collects inside the widget (`N ▸`). Hover to preview it, and click 🔇 to hear the sound. Drag it into **Montage**.

Not sure what a zone does? Hover its title, click the ⚙ gear, then **▶ How it works**. A ghost cursor shows you around.

## Features

| | |
|---|---|
| **✦ Production mode** | A task showcase in the spirit of Higgsfield, on your own open models: 8 categories, 52 task cards (34 on official open ComfyUI templates, one click each) with live previews from your own generations, search, a ready workspace per task, a two-step *Avatar from text* (voice → talking photo), *Social preview* with captions for 8 networks, and an honest *In development* shelf. |
| **Canvas with zones** | Video · Images · Effects · Montage (center) · Text · Design · Sound · Music · Voiceover · Script · Assistant. Cards snap softly into zones; overlapping cards spread out by themselves. **Ctrl+Space** sorts everything. Each zone has its own ⚙ settings: name, color, lines. There are 4 line styles (**Shift+G**). |
| **Workflow widgets** | Drop any ComfyUI workflow file, either *Export (API)* or a regular one, onto the table. Inputs are detected automatically: image, audio, video, prompt, negative, seed, size, duration, steps and named primitives. **Double-click** a widget to open the real ComfyUI graph inside a tab, edit it, then **Save to widget**. The tab shows the last real run (your image and prompt). |
| **Radial menu** | Right-click or hold a card. Up to 4 levels, and outer rings get thinner. Move the cursor far away to cancel. Widget items: Run (same as last time / edit prompt / all settings), ■ Stop, Inside, To a key, Results. |
| **Piano keys** | White keys = scenes or workflows. Drag across keys to form a colored group. Hide a scene (files kept) or delete it with confirmation. Drag a widget or a workflow tab onto a key to bind it. |
| **Plan** | Chips in a row, drag to reorder, double-click to rename. **Auto**: tasks run one after another. Otherwise it asks before each next one. |
| **Code-driven VFX (LTX)** | Node **🎬 VFX Guide** (`DTVFXGuide`) has 12 effects: portal, fire, sparks, rain, snow, lightning, smoke, power aura, shockwave, magic particles, dissolve into dust, digital glitch. Its frames go into `LTXVAddGuide`, and LTX-2 renders realistic video plus audio. The ready-made action is `actions/ltx2-vfx.json`. |
| **✨ Prompt helper** | Write your wish in any language and press *Enhance*. A **local** LLM (Ollama) rewrites it for the target model using the **director's file** (`director/*.md`, e.g. the official LTX-2 prompting rules). The model unloads right after answering, so VRAM stays free for generation. |
| **Live progress & diagnostics** | Stage, step, elapsed and remaining time on every widget. A per-node timing log. A **stuck-step detector** explains the likely cause (usually VRAM spilling into RAM) and what to do. **Show in graph** jumps to the running node. |
| **Voice** | Hold **Ё / `**. Whisper runs locally. Dictation into prompt fields can be translated to English on the fly. Code words such as «video: a girl walks on the beach» open a workflow with that prompt. Macros can be recorded with rollback. |
| **🧹 Free memory** | One button unloads models, clears the node cache and gives VRAM and RAM back to the system, so you can use other apps without restarting ComfyUI. |
| **👁 Curtains** | Shift+P. Curtains with flowing lines close over the table, and a status lamp shows the state: blue = idle, amber = generating, green = done, red = error. |
| **◉ Maestro presets** | A grey orb between Script and Montage. Click it (or press **Tab**) and a hologram opens with preset cards: **Camera** (360° orbit, push-in, pull-out, tracking, crane, handheld, FPV), **Effects** in working groups — *Cinema & action* (explosion, ground lightning strike, shockwave, debris, sparks, fire), *Atmosphere* (thunderstorm, rain, fog & god rays), *Ads & product* (splash, light sweep, steam, particle reveal, flares), *Transitions* (flash, whip pan, glitch, ink), *Fantasy & cartoon* (lightning from hands, portal, aura) and a separate *For social media* shelf, **Cinema** (blue hour, golden hour, neon noir, 35 mm film, anamorphic…), **Time** (slow motion, timelapse, bullet time) and **Angle**. Drag a preset onto a widget (one per category can stack) or onto a piano key. On run it's merged with your prompt; effect presets also drive the code-drawn VFX draft. Voice: *"Maestro, fire, LTX 2.3: a dragon takes off"*. Presets are plain JSON in `presets/`, so anyone can add their own. |
| **🎬 Film from a script** | Write or dictate an idea in any language. **✨** splits it into shots with a small local model (rules in `director/script.md`, written so even a 4B model copes; without a model it splits by sentences). **🎬 Shoot** queues every shot, writes a proper prompt for each, starts each shot from the **last frame of the previous one** (the hero stays the same), lays the shots into Montage and **cuts one mp4** with music. |
| **Output → Montage** | Finished generations land in a slim **Output** strip at the top of Montage (hover for a big preview that plays). Drag a thumbnail down — clips **snap** into chains and rows (hold Shift to place freely). Or choose in Settings: results pour onto the table next to their widget. |
| **🎨 Looks** | *Settings → Look*: **Colorful** (every zone its own color) or **Minimal** (grey zones, lime only where it matters). |
| **🎥 Self-running demo** | *Tools → Demo for recording*: a 100-second tour on an exact timeline with subtitles; *Demo subtitles (.srt)* exports them for editing and voice-over. The desk restores itself afterwards. |
| **🎛 Widget studio** | A builder block that turns a zone into the workspace of *one* workflow — like a node UI built for people: 🖥 live preview screen, ✎ prompt + ▶ run (Ctrl+Enter), 🖼 inputs (drop files from disk), ⚙ parameters, 🕘 generation history, ⏱ time and models used. Each sub-block can be switched on or off with ⚙. Ready studio: *Workspace (one workflow)*. |
| **🧩 Studio builder** | Right panel → *Builder*. Drag blocks onto the table (Video, Images, Sound, Text, Design, Effects, Montage, Script, Assistant, Radio, Maestro), move and resize zones, recolor, rename, place the label in any corner. Ready studios: *Director's*, *Studio (MiniMax-style)*, *Montage at the bottom*, *Beginner*. Any key can switch a studio. Layouts are small JSON files in `ComfyUI/user/directors-table/layouts/` — give one to any AI and ask for changes; a variant `name-2.json` is picked up automatically. |
| **◉ Maestro anywhere** | Drag the orb: onto the table, into the top bar (a scanner beam), next to the piano (a diagonal beam) or to the left edge (a glowing list). ⚙ sets its size, orb and hologram color, glow. |
| **🎥 Camera sphere** | Maestro → Camera → *Custom camera path* (or widget menu → Inputs → Camera). A wireframe sphere around your frame: drag ● start and ◆ end, set close/far, preview the flight. The table writes the camera-move prompt and saves it as your own preset. |
| **👤 Characters** | Build a recurring hero (type, age, skin, eyes, hair, build, features, outfit) — the description is added to every shot; make a portrait and shoot from it. LoRA training is on the roadmap. |
| **📚 Comfy templates** | Tools → *Comfy templates*: the official templates already installed with ComfyUI, with ✓/✗ for the models you have, one click → widget. *I want a workflow like…* searches your widgets and templates by plain words, offline. |
| **Scenes** | Short name on the key, full name on hover. 🔒 *Close project* makes a scene view-only (can't be grouped, overwritten, cleared or deleted) and offers a backup file. Move scenes between keys, add your own white and black keys, choose classic / colored / mono key style and row length. **Ctrl+Z** for keys, scenes, groups, plan and table cleanup. |
| **Views** | Right-click the table → *View*: large, medium, small or minimal cards (like icons in a file explorer). Link lines: curves, straight or angled. Pinned panels push the table or overlay it. |
| **🎵 Private radio** | Your own music plays while you work — files stay in the browser only and are never copied into ComfyUI folders or the project. |
| **🎥 Demo mode** | Tools → *Demo for recording*: a ~75-second self-guided show with captions and a cursor, perfect for screen recording. Esc to exit; the table is restored. |
| **Live preview** | See the video appear while it generates. For LTX-2 the table plugs in KJNodes' *LTX2 Sampling Preview Override* on the fly, with the tiny `taeltx` decoder from `models/vae` for sharp, colored frames. |
| **⬇ Build clip** | Montage → one mp4 (clips in order + music), done by ComfyUI's own ffmpeg. |
| **Share** | Right-click a result → *More → Share*: a vertical 9:16 clip "before → code draft → LTX result" with captions, ready for X / TikTok / Reels. |
| **🎹 MIDI keyboard** | Plug in any MIDI keyboard: white notes from C play keys 1…0, sharps play Q…U, higher notes play the A–L / Z–M rows. Conduct your AI orchestra on a real piano. |
| **Game-style onboarding** | On first launch a ghost cursor walks you through the zones in about a minute. Replay it anytime from Tools. |
| **Low-VRAM mode** | Auto-detects your GPU. Up to 8 GB: the first run of a widget uses a light format and a short clip. Up to 12 GB: memory is freed between tasks of different models in a plan. |
| **Frame-to-frame transition** | `actions/ltx2-transition.json`: give the first and the last frame, and LTX-2 makes a smooth transformation between them, with sound. |
| **Text → voice** | `actions/omnivoice-tts.json`: OmniVoice speaks your text in a voice you describe (gender, age, pitch, accent). The model downloads itself. |
| **Import your ComfyUI workflows** | *Tools → My workflows from ComfyUI* lists what you saved in ComfyUI. One click converts it (subgraphs included) and makes a widget. |
| **Models & hardware** | *Tools → Models & hardware* reads your GPU, RAM and disk, shows which model bundles fit, and downloads missing files **only from the Hugging Face repos listed in** `orchestrator/models.json` → `trusted_hosts` (official Lightricks/Comfy-Org repos plus well-known community quantizations such as Kijai and QuantStack). |
| **Orchestrator for any AI** | `orchestrator/` is a knowledge pack (`AGENT.md`, `action-schema.md`, `models.json`). Give it to Claude, ChatGPT or a local Ollama model and ask for a widget for a new model. The Assistant zone uses it to answer "pick a model for…". |
| **Zone editor** | *Tools → Zone editor*: clear the canvas, add zones, drag and resize them, pick colors and what each zone holds. |
| **12 languages** | EN · RU · UK · ES · PT-BR · DE · FR · ZH · JA · KO · TR · AR (right-to-left). Switch in Settings. |

## What's next

- **Fill the *In development* shelf:** new angle from one frame (Qwen-Image-Edit + Multiple-Angles), outfit swap, background removal, upscale, mask edit, next-gen VFX on LTX IC-LoRAs (effect over the original plate), video translation with lip-sync, beat-synced music videos.
- **Multi-person lipsync with face markers:** click faces 1, 2, 3 on the frame, assign who says which line, and InfiniteTalk (Wan 14B, official Comfy template already wired as a card) animates every mouth.
- **Auto-posting** to Telegram, YouTube, X, Instagram and others — keys stay only on your computer.
- **Open code models inside the desk.** As open-weight coding models (Qwen, Kimi and others) get stronger, a local *code widget* will write new VFX drafts, presets and studio layouts on request — the assistant already edits layouts and presets as plain JSON.
- **Motion-design for ads.** Code-built animated banners and title sequences (the frame splits into panels, captions fly in) combined with LTX shots — premium commercial look without After Effects.
- **More from the "In development" shelf:** layout from a text description (Ollama), video translation with lip-sync, influencer LoRA training, voice swap, explainer videos.
- **Themes:** a retro CRT look next to *Colorful* and *Minimal*.

## Open weights only

Out of the box the table uses **no partner nodes and no paid APIs**. All built-in actions run on LTX-2 (open weights). Speech recognition (Whisper) and the prompt helper (Ollama) are local too.

## Files

```
comfyui-directors-table/
  __init__.py        routes for the table, Whisper, Ollama bridge, memory, VFX preview, models, workflow import
  vfx.py             🎬 VFX Guide node (numpy + Pillow)
  actions/           built-in widgets: ltx2-vfx, ltx2-transition, ltx2-voice, omnivoice-tts; your own in actions/user/
  orchestrator/      knowledge pack for any AI + models catalog with trusted download URLs
  demo/              record.js (records the demo video from the live table) and build.sh (ffmpeg assembly)
  director/          "director's file": rules for the prompt helper (director.md, ltx2.md, _template.md)
  web/               the table: index.html, style.css, i18n-*.json and scripts loaded in order —
                     core.js ui.js extras.js features.js maestro.js polish.js fixes.js v23.js
                     studio.js (builder, views, Maestro modes) camsphere.js wstudio.js sound.js demo.js
  workflows/         ltx2_vfx_guide_API.json — the LTX VFX workflow, drag it straight into ComfyUI
  presets/           Maestro presets (JSON) — add your own in ComfyUI/user/directors-table/presets/
  js/open-table.js   "Open Director's Table" command inside ComfyUI
```

Your project (scenes, cards, plan, keys) is saved in `ComfyUI/user/directors-table/project.json` and in the browser, so it survives a restart. The media itself stays in ComfyUI's `input/` and `output/` folders.

## Hotkeys

`1–0` scenes / workflows · `Q–U` favorites · `A–L`, `Z–M` workflow rows · `Ctrl+Space` sort · `Ctrl+Enter` run · `Ctrl+Z` undo delete · `Shift+H` zones mode · `Shift+G` line style · `Shift+L` lock · `Shift+M` montage · `Shift+K` collapse keys · `Shift+J` hide rows · `Shift+P` curtains · `Tab` Maestro · `Shift+Z` next layout · `Ё` / `` ` `` voice (short tap in a text field types the letter, hold to dictate) · `Esc` back to the table

## License

**GPL-3.0**, the same license as ComfyUI. Anyone may use, change and even sell this project, but if you distribute a modified version you must open its source under GPL-3.0 too. See [LICENSE](LICENSE).
