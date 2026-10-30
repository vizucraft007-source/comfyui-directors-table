# Demo video: script (≈2:30)

Theme: **"Be the maestro."** The piano keys, the conductor and an orchestra of AI models run through the whole video.

| # | Time | Shot | Caption / voice-over |
|---|---|---|---|
| 1 | 0:00–0:08 | Your generated clip: a conductor in a beautiful hall raises the baton | *Every film needs a director.* |
| 2 | 0:08–0:15 | The ComfyUI node graph (screenshot of the LTX workflow) slowly zooms out | *ComfyUI is the most powerful open engine… but it looks like this.* |
| 3 | 0:15–0:25 | The curtains open, revealing the table | **Director's Table** — conduct your AI orchestra on top of ComfyUI |
| 4 | 0:25–0:45 | Zones, piano keys, the ⚙ gear → "How it works" ghost cursor | Zones instead of node spaghetti. Keys like a piano. |
| 5 | 0:45–1:15 | A frame dropped onto *VFX effect* → click the spot → 👁 Draft → Run → progress → **the real LTX result** | Code draws where the effect moves, and LTX makes it real, with sound. *(Most Innovative + LTX VFX bonus)* |
| 6 | 1:15–1:30 | Radial menu, Run → Edit prompt, ✨ Enhance (local Ollama) | Speak or type in any language, and the local model writes the prompt. |
| 7 | 1:30–1:45 | Plan: 3 chips, drag to reorder, Auto on, the 👁 curtains close, the lamp turns amber → green | Plan it and walk away. |
| 8 | 1:45–2:00 | Zone editor: clear the canvas, add zones, recolor | Build your own desk. |
| 9 | 2:00–2:15 | Models & hardware, assistant: "pick a model for voiceover" | It knows your GPU and downloads only from trusted sources. |
| 10 | 2:15–2:30 | Language switch flicks through 3–4 languages, then the conductor lowers the baton | Open weights only · GPL-3.0 · 12 languages. **Be the maestro.** |

## How it's made
- **Table scenes (3–9)** are recorded by `demo/record.js`. It plays the table in a browser with a visible cursor and captions. Nothing is filmed by hand.
- **Your clips (1, 10)** are conductor shots you generate, plus the real results of VFX, voice and transitions. Put the results on the canvas before recording.
- **Assembly:** `demo/build.sh` glues the intro, the recording and the outro with ffmpeg and adds music.

## Commands
```bash
# 1. record the table (ComfyUI running, real results already on the canvas)
npm i playwright            # once
node demo/record.js http://127.0.0.1:8000/directors-table demo/out en
# 2. glue: intro clip + recording + outro clip + music ("-" skips a part)
bash demo/build.sh demo/out/<recording>.webm clips/conductor_up.mp4 clips/conductor_down.mp4 music.mp3 final.mp4
```
On Windows run `build.sh` from Git Bash (ffmpeg must be on PATH).
