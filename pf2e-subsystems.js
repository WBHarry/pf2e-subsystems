import { registerGameSettings, registerKeyBindings } from "./scripts/setup";
import * as macros from "./scripts/macros.js";
import { handleSocketEvent, socketEvent } from "./scripts/socket.js";
import { handleMigration } from "./scripts/migration.js";
import { MODULE_ID, SOCKET_ID, tourIDs } from "./data/constants.js";
import RegisterHandlebarsHelpers from "./scripts/handlebarHelpers.js";
import { ChaseTour } from "./tours/chase/ChaseTour.js";
import { ResearchTour } from "./tours/research/ResearchTour.js";
import SystemView from "./module/systemView.js";

Hooks.once("init", () => {
    registerGameSettings();
    registerKeyBindings();
    RegisterHandlebarsHelpers.registerHelpers();
    game.socket.on(SOCKET_ID, handleSocketEvent);

    loadTemplates([
      "modules/pf2e-subsystems/templates/partials/navigate-back.hbs",
      "modules/pf2e-subsystems/templates/partials/events.hbs",
      "modules/pf2e-subsystems/templates/partials/radio-button.hbs",
      "modules/pf2e-subsystems/templates/partials/event-toolbar.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chase.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chaseDataDialog.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/participantDataDialog.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/research/research.hbs",
      "modules/pf2e-subsystems/templates/menu/subsystem-menu/partials/system-tabs.hbs",
      "modules/pf2e-subsystems/templates/menu/subsystem-menu/partials/system-footer.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/infiltration/infiltration.hbs",
    ]);
});

Hooks.once("ready", async () => {
    game.modules.get("pf2e-subsystems").macros = macros;

    handleMigration();
});

Hooks.once("setup", async () => {
  registerTours();
});

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

async function registerTours() {
  try {
    game.tours.register(MODULE_ID, tourIDs.chase, await ChaseTour.fromJSON(`/modules/${MODULE_ID}/tours/chase/chase-tour.json`));
    game.tours.register(MODULE_ID, tourIDs.research, await ResearchTour.fromJSON(`/modules/${MODULE_ID}/tours/research/research-tour.json`));
  } catch (error) {
    console.error("MyTour | Error registering tours: ",error);
  }
}

Hooks.on("renderJournalDirectory", async (tab, html) => {
  if (tab.id === "journal") {
    const buttons = $(tab.element).find(".directory-footer.action-buttons");
    buttons.prepend(`
            <button id="pf2e-subsystems">
                <i class="fa-solid fa-list" />
                <span style="font-size: var(--font-size-14); font-family: var(--font-primary); font-weight: 400;">${game.i18n.localize("PF2ESubsystems.Name")}</span>
            </button>`);

    $(buttons).find("#pf2e-subsystems")[0].onclick = () => {
      new SystemView().render(true);
    };
  }
});