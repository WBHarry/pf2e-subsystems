import { Chase, Chases } from "../data/chase";
import { MODULE_ID } from "../data/constants";
import { subsystemsThemeChoices } from "../styles/themes/themes";

export const currentVersion = '0.5.0';

export const dataTypeSetup = () => {
    CONFIG.JournalEntryPage.dataModels = {
      ...CONFIG.JournalEntryPage.dataModels,
      "pf2e-subsystems.chase": Chase,
    };
  };

export const setupTheme = (theme) => {
    const root = document.querySelector(":root");
    for (var property of Object.keys(theme)) {
      if (
        property === "--pf2e-bestiary-tracking-application-image" &&
        theme[property] !== "ignore"
      ) {
        const baseUri = document.baseURI.split("game")[0];
        root.style.setProperty(property, `url("${baseUri}${theme[property]}")`);
      } else {
        root.style.setProperty(property, theme[property]);
      }
    }
  };
  
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
  }

  const configSettings = () => {
    game.settings.register(MODULE_ID, "subsystems-theme", {
      name: "Subsystems Theme",
      hint: "",
      scope: "client",
      config: true,
      type: new foundry.data.fields.StringField({
        choices: subsystemsThemeChoices,
        required: true,
      }),
      requiresReload: true,
      onChange: async (value) => {
        if (!value) return;
  
        game.user.setFlag(MODULE_ID, "subsystems-theme", value);
      },
      default: "default",
    });
  }

  const generalNonConfigSettings = () => {
    game.settings.register(MODULE_ID, "subsystems-default-theme", {
      name: 'Subsystems Default Theme',
      hint: '',
      scope: "world",
      config: true,
      type: new foundry.data.fields.StringField({
        choices: subsystemsThemeChoices,
        required: true,
      }),
      requiresReload: true,
      default: "coreLight",
    });

    game.settings.register(MODULE_ID, "chase", {
      name: "",
      hint: "",
      scope: "world",
      config: false,
      type: Chases,
      default: { events: {} },
    });
  };