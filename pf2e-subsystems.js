import { registerGameSettings, registerKeyBindings } from "./scripts/setup";
import * as macros from "./scripts/macros.js";
import { handleSocketEvent, socketEvent } from "./scripts/socket.js";
import { handleMigration } from "./scripts/migration.js";
import { MODULE_ID, SOCKET_ID, tourIDs } from "./data/constants.js";
import RegisterHandlebarsHelpers from "./scripts/handlebarHelpers.js";
import { ChaseTour } from "./module/tours/chaseTour.js";

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
      "modules/pf2e-subsystems/templates/menu/subsystem-menu/partials/system-tabs.hbs",
      "modules/pf2e-subsystems/templates/menu/subsystem-menu/partials/system-footer.hbs"
    ]);
});

Hooks.once("ready", async () => {
    game.modules.get("pf2e-subsystems").macros = macros;

    handleMigration();
});

// Hooks.once("setup", async () => {
//   registerMyTours();
// });

Hooks.on(socketEvent.GMUpdate, async ({ setting, data }) => {
  if(game.user.isGM){
    const currentSetting = game.settings.get(MODULE_ID, setting);
    currentSetting.updateSource(data);
    await game.settings.set(MODULE_ID, setting, currentSetting);

    await game.socket.emit(SOCKET_ID, {
      action: socketEvent.UpdateSystemView,
      data: { tab: setting },
    });

    Hooks.callAll(socketEvent.UpdateSystemView, setting);
  }
});

async function registerMyTours() {
  try {
    game.tours.register(MODULE_ID, tourIDs.chase, await ChaseTour.fromJSON(`/modules/${MODULE_ID}/tours/chase-tour.json`));
    if(game.user.isGM) {
      // game.tours.register(MODULE_ID, 'settings', await MyTour.fromJSON(`/modules/${MODULE_ID}/tours/settings.json`));
    }
  } catch (error) {
    console.error("MyTour | Error registering tours: ",error);
  }
}