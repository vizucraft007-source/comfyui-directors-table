// Добавляет в ComfyUI команду «Открыть Director's Table» (меню Extensions и Alt+D).
import { app } from "../../scripts/app.js";

const open = () => window.open("/directors-table", "_blank");

app.registerExtension({
  name: "directors.table.open",
  commands: [{ id: "directors-table.open", label: "Open Director's Table", icon: "pi pi-th-large", function: open }],
  menuCommands: [{ path: ["Extensions"], commands: ["directors-table.open"] }],
  keybindings: [{ combo: { key: "d", alt: true }, commandId: "directors-table.open" }],
});
