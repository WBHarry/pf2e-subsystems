import { registerGameSettings, registerKeyBindings, setupTheme } from "./scripts/setup";
import * as macros from "./scripts/macros.js";
import { handleSocketEvent } from "./scripts/socket.js";
import { handleMigration } from "./scripts/migration.js";
import { MODULE_ID } from "./data/constants.js";
import subsystemsThemes from "./styles/themes/themes.js";
import RegisterHandlebarsHelpers from "./scripts/handlebarHelpers.js";

Hooks.once("init", () => {
    // dataTypeSetup();
    registerGameSettings();
    registerKeyBindings();
    RegisterHandlebarsHelpers.registerHelpers();
    game.socket.on(`module.pf2e-subsystems`, handleSocketEvent);

    loadTemplates([
      "modules/pf2e-subsystems/templates/partials/navigate-back.hbs",
      "modules/pf2e-subsystems/templates/partials/events.hbs",
      "modules/pf2e-subsystems/templates/partials/radio-button.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chase.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/editChase.hbs",
    ]);
});

Hooks.once("ready", async () => {
    game.modules.get("pf2e-subsystems").macros = macros;

    handleMigration();
});

Hooks.once("setup", async () => {
    const userTheme = game.user.getFlag(
        MODULE_ID,
        "subsystems-theme",
      );
      if (userTheme) {
        await game.settings.set(MODULE_ID, "subsystems-theme", userTheme);
      }
    
      const selectedTheme = game.settings.get(
        MODULE_ID,
        "subsystems-theme",
      );
      const theme =
        selectedTheme === "default"
          ? game.settings.get(MODULE_ID, "subsystems-default-theme")
          : selectedTheme;
    setupTheme(subsystemsThemes[theme]);
});