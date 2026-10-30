# Widget file format (`actions/*.json`)

A widget is one ComfyUI workflow in **API format** plus a description of the inputs the user can change.

## Fields

| field | required | meaning |
|---|---|---|
| `id` | yes | unique id, also the file name (`actions/user/<id>.json`) |
| `title` | yes | name shown on the widget |
| `about` | no | one line under the title in the parameters window |
| `menu` | no | `["Group", "Item"]` path in the radial menu |
| `kind` | no | `video` / `image` / `audio` — colour and default zone |
| `zone` | no | zone id to place the widget: `video`, `image`, `fx`, `text`, `sound`, `voice` |
| `accepts` | yes | kinds of files that can be dropped on the widget: `["image"]`, `["video"]`, `["audio"]` or `[]` |
| `output` | yes | `{"node": "<id of the save node>", "kind": "video"}` |
| `estimate` | no | human hint about time, e.g. `"≈1 min per second of video on 12 GB"` |
| `guide` | no | director's file to use for prompts (`"ltx2"` → `director/ltx2.md`) |
| `params` | yes | list of inputs (below) |
| `workflow` | yes | ComfyUI API prompt: `{ "<node id>": { "class_type", "inputs", "_meta": {"title"} } }` |
| `ui` | no | the same workflow in regular (UI) format — used to show it with layout inside the table |

## Params

| type | UI | value written to the node |
|---|---|---|
| `card` | the file dropped on the widget | file path (`transform: "file"`) |
| `image` / `audio` / `video` | pick another file from the scene | file path (`transform: "file"`) |
| `text` | multi-line field with 🎙 dictation and ✨ Enhance (for the main prompt) | string |
| `number` | slider (`min`, `max`, `step`, `default`) | number; with `transform: "frames"` (+`fps`) seconds become 8n+1 frames |
| `select` | dropdown of `options: [{label, value}]` | `value`; `"auto"` = size from the input image; `transform: "index"` + `index` picks one element of an array |
| `seed` | hidden, random every run (`max` optional) | integer |
| `point` | click on the input frame | `[x, y]` in 0..1, use two targets with `transform: "index"` |

Each param has `targets: [{"node": "<id>", "field": "<input name>", "transform"?: ...}]`. One param can write into several nodes.

## Full example — text to speech (OmniVoice)

```json
{
 "id": "omnivoice-tts",
 "title": "Озвучка из текста",
 "menu": [
  "Звук",
  "Озвучка"
 ],
 "kind": "audio",
 "zone": "voice",
 "about": "OmniVoice: текст → голос. Голос задаётся описанием: пол, возраст, высота, акцент. Модель скачается сама при первом запуске.",
 "accepts": [],
 "output": {
  "node": "20",
  "kind": "audio"
 },
 "estimate": "≈10–30 с",
 "params": [
  {
   "id": "text",
   "type": "text",
   "label": "Текст для озвучки",
   "default": "Hello! Welcome to my island. Let me tell you a story.",
   "targets": [
    {
     "node": "10",
     "field": "text"
    }
   ]
  },
  {
   "id": "voice",
   "type": "text",
   "label": "Какой голос (по-английски: male / female, young / elderly, low / high pitch, accent…)",
   "default": "male, middle-aged, low pitch, warm",
   "targets": [
    {
     "node": "10",
     "field": "voice_instruct"
    }
   ]
  },
  {
   "id": "speed",
   "type": "number",
   "label": "Скорость речи",
   "min": 0.6,
   "max": 1.6,
   "step": 0.05,
   "default": 1.0,
   "targets": [
    {
     "node": "10",
     "field": "speed"
    }
   ]
  },
  {
   "id": "seed",
   "type": "seed",
   "max": 2147483647,
   "targets": [
    {
     "node": "10",
     "field": "seed"
    }
   ]
  }
 ],
 "workflow": {
  "10": {
   "class_type": "OmniVoiceVoiceDesignTTS",
   "inputs": {
    "model": "OmniVoice (auto download)",
    "text": "Hello!",
    "voice_instruct": "male, middle-aged, low pitch, warm",
    "steps": 32,
    "guidance_scale": 2.0,
    "t_shift": 0.1,
    "speed": 1.0,
    "duration": 0.0,
    "device": "auto",
    "dtype": "auto",
    "attention": "auto",
    "seed": 0,
    "position_temperature": 5.0,
    "class_temperature": 0.0,
    "layer_penalty_factor": 5.0,
    "denoise": true,
    "postprocess_output": true,
    "keep_model_loaded": false
   },
   "_meta": {
    "title": "Голос по описанию"
   }
  },
  "20": {
   "class_type": "SaveAudioMP3",
   "inputs": {
    "audio": [
     "10",
     0
    ],
    "filename_prefix": "DT-voice/voice",
    "quality": "V0"
   },
   "_meta": {
    "title": "Сохранить звук"
   }
  }
 }
}
```
