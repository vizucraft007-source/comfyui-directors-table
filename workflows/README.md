# Workflows you can open directly in ComfyUI

**`ltx2_vfx_guide_API.json`** — the VFX workflow from the *VFX Workflow Built with LTX* entry.
Drag the file onto the ComfyUI canvas (API format; ComfyUI arranges the nodes).

How it works: `LoadImage` → **🎬 VFX Guide** (`DTVFXGuide`, this package) draws an animated *effect draft*
over your frame (portal, fire, sparks, rain, snow, lightning, smoke, aura, shockwave, magic, dissolve, glitch)
→ `LTXVAddGuide` feeds the draft to **LTX-2** as a guide video → LTX-2 renders the effect photoreal, **with sound**.

Set in the `DTVFXGuide` node: `effect`, `center_x` / `center_y` (where the effect happens), `size`, `intensity`.
Put your own image into `LoadImage`.

Models (see the main README → *Minimal setup*): `ltx-2-19b-distilled-fp8` (checkpoints), `ltx-2-19b-distilled-lora-384` (loras),
`gemma_3_12B_it_fp8_e4m3fn` + `ltx-2-19b-embeddings_connector_dev_bf16` (text_encoders), `LTX2_video_vae_bf16` (vae).
Node packs: ComfyUI-GGUF (`DualCLIPLoaderGGUF`), ComfyUI-KJNodes, ComfyUI-VideoHelperSuite.

In Director's Table the same workflow is the **VFX effect** widget: click on the frame where the effect should be,
press **👁 Draft** to preview the draft, then run.
