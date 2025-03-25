import { Chase, Chases } from "../data/chase";
import { MODULE_ID } from "../data/constants";
import coreLight from "../styles/themes/coreLight";
import subsystemsThemes, { subsystemsThemeChoices } from "../styles/themes/themes";

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
    game.keybindings.register("pf2e-subsystems", "open-system-view", {
      name: game.i18n.localize("PF2ESubsystems.KeyBindings.OpenSystemView.Name"),
      hint: game.i18n.localize("PF2ESubsystems.KeyBindings.OpenSystemView.Hint"),
      uneditable: [],
      editable: [],
      onDown: () =>
        game.modules.get("pf2e-subsystems").macros.openSubsystemView(),
      onUp: () => {},
      restricted: false,
      reservedModifiers: [],
      precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    });
  }
  
  export const registerGameSettings = () => {
    configSettings();
    generalNonConfigSettings();
    // vagueDescriptions();
    // bestiaryLabels();
    // bestiaryDisplay();
    // bestiaryAppearance();
    // bestiaryIntegration();
  }

  const configSettings = () => {
    game.settings.register(MODULE_ID, "subsystems-theme", {
        name: game.i18n.localize("PF2ESubsystems.Settings.SubsystemsTheme.Name"),
        hint: game.i18n.localize("PF2ESubsystems.Settings.SubsystemsTheme.Hint"),
        scope: "client",
        config: true,
        type: String,
        choices: subsystemsThemeChoices,
        requiresReload: true,
        default: "coreLight",
    });
  }

  const generalNonConfigSettings = () => {
    game.settings.register(MODULE_ID, "chase", {
      name: "",
      hint: "",
      scope: "world",
      config: false,
      type: Chases,
      default: { events: {} },
    });

    game.settings.register(MODULE_ID, "subsystems-folders", {
      name: game.i18n.localize("PF2ESubsystems.Settings.SubsystemsTheme.Name"),
      hint: game.i18n.localize("PF2ESubsystems.Settings.SubsystemsTheme.Hint"),
      scope: "world",
      config: false,
      type: Object,
      default: {},
    });

    game.settings.register(MODULE_ID, "subsystems-theme", {
      name: "Theme",
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
  };