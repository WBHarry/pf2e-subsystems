import { Chases } from "../data/chase";
import { MODULE_ID, settingIDs } from "../data/constants";
import { Infiltrations } from "../data/infiltration";
import { Influences } from "../data/influence";
import { Researches } from "../data/research";
import { ChaseSettings, InfiltrationSettings, InfluenceSettings, ResearchSettings } from "../data/settings";
import SubsystemsMenu from "../module/SubsystemsMenu";

export const currentVersion = '0.7.0';

export const registerKeyBindings = () => {
  game.keybindings.register(MODULE_ID, "open-system-view", {
    name: game.i18n.localize("PF2ESubsystems.KeyBindings.OpenSystemView.Name"),
    hint: game.i18n.localize("PF2ESubsystems.KeyBindings.OpenSystemView.Hint"),
    uneditable: [],
    editable: [],
    onDown: () =>
      game.modules.get(MODULE_ID).macros.openSubsystemView(),
    onUp: () => {},
    restricted: false,
    reservedModifiers: [],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
}

export const registerGameSettings = () => {
  configSettings();
  generalNonConfigSettings();
  registerMenus();
}

const configSettings = () => {
  game.settings.register(MODULE_ID, settingIDs.research.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: ResearchSettings,
    default: {},
  });

  game.settings.register(MODULE_ID, settingIDs.chase.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: ChaseSettings,
    default: {},
  });

  game.settings.register(MODULE_ID, settingIDs.infiltration.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: InfiltrationSettings,
    default: {},
  });

  game.settings.register(MODULE_ID, settingIDs.influence.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: InfluenceSettings,
    default: {},
  });
}

const generalNonConfigSettings = () => {
  game.settings.register(MODULE_ID, "version", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, "chase", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: Chases,
    default: { events: {} },
  });
  game.settings.register(MODULE_ID, "research", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: Researches,
    default: { events: {} },
  });
  game.settings.register(MODULE_ID, "infiltration", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: Infiltrations,
    default: { events: {} },
  });
  game.settings.register(MODULE_ID, "influence", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: Influences,
    default: { events: {} },
  });
};

const registerMenus = () => {
  game.settings.registerMenu(MODULE_ID, settingIDs.menus.subsystems, {
    name: game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Name"),
    label: game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Label"),
    hint: game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Hint"),
    icon: "fa-solid fa-list",
    type: SubsystemsMenu,
    restricted: true,
  });
};