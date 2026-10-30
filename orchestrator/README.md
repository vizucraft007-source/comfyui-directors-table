# orchestrator/ — knowledge pack for any AI

This folder lets **any** language model operate Director's Table and extend it. That covers the built-in local helper (Ollama), Claude, ChatGPT, Gemini, or whatever you use.

| File | What it is |
|---|---|
| `AGENT.md` | System instructions: what the table is, how widgets work, how to build a ComfyUI workflow for it, the safety rules. |
| `action-schema.md` | Exact format of a widget file (`actions/*.json`), with a complete example. |
| `models.json` | Catalog of open models: trusted download URLs (official Hugging Face repos), target folders, VRAM requirements, required custom nodes. |
| `../director/*.md` | "Director's file": prompt rules per model (e.g. `ltx2.md`). `script.md` teaches a small local model to split a story into shots (JSON, with examples). |

## Use it with a cloud model (Claude, GPT…)

1. Attach `AGENT.md`, `action-schema.md` and `models.json` to your chat. For prompt work, also attach the model guide from `../director/`.
2. Say what you need: *"I have MiniMax H3 weights and an RTX 4090. Make a widget for image + text → video with sound."*
3. The model answers with a ready widget file (`actions/user/<id>.json`) plus a list of files to download from trusted sources. Drop the file into `actions/user/` and reload the table.

## Use it locally

- **Tools → Models & hardware** shows what fits your GPU, what is already installed, and downloads what's missing from the catalog. The URLs are checked against `trusted_hosts`.
- **Assistant zone:** type or say *"pick a model for …"*. The local LLM reads `AGENT.md` and the catalog, then suggests a bundle or widget. You confirm before anything is downloaded.

## Add a model to the catalog

Add an entry to `bundles` in `models.json`. Use **direct `resolve/` URLs from the official repository** and the ComfyUI folder each file belongs to, and set `vram_min` / `vram_best`. If the files come from a new organization, add its prefix to `trusted_hosts` only after you've checked it is the official publisher.
