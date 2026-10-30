# Security

Director's Table runs inside your own ComfyUI and talks only to your own machine. This page says what it can touch and how it protects you.

## What the table does on your computer
- **Reads and writes** only inside ComfyUI's own folders: `input/`, `output/`, `temp/`, `user/directors-table/`, `user/default/workflows/` (read-only), and `models/` (downloads). Every file path from the browser is resolved and checked to stay inside these folders.
- **Runs ffmpeg** (the one bundled with ComfyUI) to cut clips. Arguments are passed as a list, never through a shell.
- **Talks to Ollama only on this computer** (`127.0.0.1` / `localhost`). To use Ollama on another machine, set the environment variable `DT_LLM_HOSTS=192.168.1.5`.
- **Downloads models only** over HTTPS from the Hugging Face repositories listed in `orchestrator/models.json` → `trusted_hosts`, only as `.safetensors` or `.gguf` (formats that cannot run code when loaded), only into model folders, with an optional SHA-256 check. Nothing is downloaded without you pressing the button.
- **Writes only its own small files**: layouts from the Studio builder go to `ComfyUI/user/directors-table/layouts/` (JSON only, safe file name, max 64 KB, only known fields kept).
- **Your music never leaves the browser**: radio tracks are stored in the browser's IndexedDB, not uploaded to ComfyUI.
- **Fonts**: the page loads two fonts from Google Fonts. That is the only request to the internet; block it and the table falls back to system fonts.
- **No telemetry, no accounts, no cloud.** The table sends nothing anywhere except your own ComfyUI and your own Ollama.

## Keep ComfyUI private
- Run ComfyUI on `127.0.0.1` (the default, and ComfyUI Desktop's default). Anyone who can open your ComfyUI address can use the table too.
- If you must use `--listen` (LAN, rented GPU), put it behind a firewall, VPN or SSH tunnel. Never expose port 8188/8000 to the internet.

## Files from other people
- A shared **workflow or widget** (`actions/*.json`) is a ComfyUI graph. It can only use the nodes you have installed, so it is as safe as your custom nodes. Install custom nodes only from sources you trust (ComfyUI Manager, known authors).
- A **models catalog** from someone else can only point to the trusted hosts above, and only to safe formats. Read new `trusted_hosts` entries before adding them.

## Reporting a vulnerability
Please open a **private security advisory** on GitHub ("Security" tab → "Report a vulnerability") instead of a public issue. We will reply as soon as we can.
