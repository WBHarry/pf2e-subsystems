import { registerGameSettings, registerKeyBindings } from "./scripts/setup";
import * as lib from "./scripts/lib.js";
import { handleSocketEvent, socketEvent } from "./scripts/socket.js";
import { handleMigration } from "./scripts/migration.js";
import { hooks, MODULE_ID, SOCKET_ID, tourIDs } from "./data/constants.js";
import RegisterHandlebarsHelpers from "./scripts/handlebarHelpers.js";
import { ChaseTour } from "./tours/chase/ChaseTour.js";
import { ResearchTour } from "./tours/research/ResearchTour.js";
import SystemView from "./module/systemView.js";
import { InfiltrationTour } from "./tours/infiltration/InfiltrationTour.js";
import { InfluenceTour } from "./tours/influence/InfluenceTour.js";

Hooks.once("init", () => {
    registerGameSettings();
    registerKeyBindings();
    
    const module = game.modules.get(MODULE_ID);
    module.lib = lib;
    module.hooks = hooks;

    RegisterHandlebarsHelpers.registerHelpers();
    game.socket.on(SOCKET_ID, handleSocketEvent);

    foundry.applications.handlebars.loadTemplates([
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
      "modules/pf2e-subsystems/templates/system-view/systems/influence/influence.hbs",
    ]);
});

Hooks.once("ready", async () => {
    handleMigration();
    Hooks.callAll(hooks.subsystemsReady);
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
    game.tours.register(MODULE_ID, tourIDs.infiltration, await InfiltrationTour.fromJSON(`/modules/${MODULE_ID}/tours/infiltration/infiltration-tour.json`));
    game.tours.register(MODULE_ID, tourIDs.influence, await InfluenceTour.fromJSON(`/modules/${MODULE_ID}/tours/influence/influence-tour.json`));
  } catch (error) {
    console.error("PF2e Subsystems Tour Registration failed");
  }
}

Hooks.on("renderJournalDirectory", async (tab, html, _, options) => {
  if (tab.id === "journal") {
    if (options.parts && !options.parts.includes("footer")) return;
    
    const buttons = tab.element.querySelector(".directory-footer.action-buttons");
    buttons.insertAdjacentHTML('afterbegin', `
            <button id="pf2e-subsystems">
                <i class="fa-solid fa-list" />
                <span style="font-weight: 400; font-family: var(--font-sans);">${game.i18n.localize(game.system.id === 'sf2e' ? "PF2ESubsystems.StarfinderName" : "PF2ESubsystems.Name")}</span>
            </button>`);

    buttons.querySelector("#pf2e-subsystems").onclick = () => {
      new SystemView().render(true);
    };
  }
});