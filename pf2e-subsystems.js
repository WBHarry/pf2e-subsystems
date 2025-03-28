import { registerGameSettings, registerKeyBindings } from "./scripts/setup";
import * as macros from "./scripts/macros.js";
import { handleSocketEvent } from "./scripts/socket.js";
import { handleMigration } from "./scripts/migration.js";
import { SOCKET_ID } from "./data/constants.js";
import RegisterHandlebarsHelpers from "./scripts/handlebarHelpers.js";

Hooks.once("init", () => {
    registerGameSettings();
    registerKeyBindings();
    RegisterHandlebarsHelpers.registerHelpers();
    game.socket.on(SOCKET_ID, handleSocketEvent);

    loadTemplates([
      "modules/pf2e-subsystems/templates/partials/navigate-back.hbs",
      "modules/pf2e-subsystems/templates/partials/events.hbs",
      "modules/pf2e-subsystems/templates/partials/radio-button.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chase.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chaseDataDialog.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/participantDataDialog.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/research/research.hbs",
    ]);
});

Hooks.once("ready", async () => {
    game.modules.get("pf2e-subsystems").macros = macros;

    handleMigration();
});