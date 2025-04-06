import { defaultInfiltrationAwarenessBreakpoints, MODULE_ID, settingIDs } from "../data/constants";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class SubsystemsMenu extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor() {
    super({});

    this.selected = {
      infiltration: {
        awarenessBreakpoint: null,
      }
    }
  }

  get title() {
    return game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Title");
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    id: "pf2e-subsystems-subsystems-menu",
    classes: ["pf2e-subsystems", "pf2e-subsystems-menu"],
    position: { width: "600", height: "auto" },
    actions: {
      addInfiltrationDefaultAwarenessBreakpoint: this.addInfiltrationDefaultAwarenessBreakpoint,
      selectInfiltrationDefaultAwarenessBreakpoint: this.selectInfiltrationDefaultAwarenessBreakpoint,
      removeInfiltrationDefaultAwarenessBreakpoint: this.removeInfiltrationDefaultAwarenessBreakpoint,
      resetInfiltrationDefaultAwarenessBreakpoints: this.resetInfiltrationDefaultAwarenessBreakpoints,
    },
    form: { handler: this.updateData },
  };

  static PARTS = {
    chase: {
      id: "chase",
      template: "modules/pf2e-subsystems/templates/menu/subsystem-menu/chase-menu.hbs",
    },
    research: {
      id: "research",
      template: "modules/pf2e-subsystems/templates/menu/subsystem-menu/research-menu.hbs",
    },
    infiltration: {
      id: "infiltration",
      template: "modules/pf2e-subsystems/templates/menu/subsystem-menu/infiltration-menu.hbs",
    },
  };

  tabGroups = {
    main: 'chase',
  };

  changeTab(tab, group, options) {
    super.changeTab(tab, group, options);
  }

  getTabs() {
    const tabs = {
      chase: {
        active: true,
        cssClass: 'chase-view',
        group: 'main',
        id: 'chase',
        icon: null,
        label: game.i18n.localize('PF2ESubsystems.Events.Chase.Plural'),
        image: 'icons/skills/movement/feet-winged-boots-brown.webp',
      },
      research: {
        active: false,
        cssClass: 'research-view',
        group: 'main',
        id: 'research',
        icon: null,
        label: game.i18n.localize('PF2ESubsystems.Events.Research.Plural'),
        image: 'icons/skills/trades/academics-merchant-scribe.webp',
      },
      infiltration: {
        active: false,
        cssClass: 'infiltration-view',
        group: 'main',
        id: 'infiltration',
        icon: null,
        label: game.i18n.localize('PF2ESubsystems.Events.Infiltration.Plural'),
        image: 'icons/skills/trades/academics-merchant-scribe.webp',
      },
    };

    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group]
        ? this.tabGroups[v.group] === v.id
        : v.active;
      v.cssClass = v.active ? `${v.cssClass} active` : "";
    }

    return tabs;
  }

  async _prepareContext(_options) {
    const context = await super._prepareContext(_options);
    context.tabs = this.getTabs();

    return context;
  }

  async _preparePartContext(partId, context) {
    switch(partId){
        case 'chase':
          context.settings = game.settings.get(MODULE_ID, settingIDs.chase.settings);
          break;
        case 'research':
          context.settings = game.settings.get(MODULE_ID, settingIDs.research.settings);
          break;
        case 'infiltration':
          context.settings = game.settings.get(MODULE_ID, settingIDs.infiltration.settings);

          const defaultAwarenessBreakpoints = Object.values(context.settings.defaultAwarenessBreakpoints);
          const selectedAwarenessBreakpointId = this.selected.infiltration.awarenessBreakpoint ?? (defaultAwarenessBreakpoints.length > 0 ? defaultAwarenessBreakpoints[0].id : null);
          context.selected = {
            ...this.selected.infiltration,
            awarenessBreakpoint: selectedAwarenessBreakpointId ? context.settings.defaultAwarenessBreakpoints[selectedAwarenessBreakpointId] : null,
          };
          
          if(context.selected.awarenessBreakpoint) {
            context.selected.awarenessBreakpoint.description = game.i18n.localize(context.selected.awarenessBreakpoint.description);
            context.selected.awarenessBreakpoint.enrichedDescription = await TextEditor.enrichHTML(context.selected.awarenessBreakpoint.description);
          }

          break;
    }

    return context;
}

  static async updateData(event, element, formData) {
    const { chase, research, infiltration } = foundry.utils.expandObject(formData.object);

    await game.settings.set(MODULE_ID, settingIDs.chase.settings, chase);
    await game.settings.set(MODULE_ID, settingIDs.research.settings, research);
    await game.settings.set(MODULE_ID, settingIDs.infiltration.settings, foundry.utils.mergeObject(
      game.settings.get(MODULE_ID, settingIDs.infiltration.settings),
      infiltration
    ));

    this.close();
  }

  static async addInfiltrationDefaultAwarenessBreakpoint() {
    const newId = foundry.utils.randomID();

    const currentSetting = game.settings.get(MODULE_ID, settingIDs.infiltration.settings);
    currentSetting.updateSource({
      defaultAwarenessBreakpoints: {
        [newId]: {
          id: newId,
          breakpoint: 5,
          description: game.i18n.localize('PF2ESubsystems.Menus.Subsystems.Infiltration.NewAwarenessBreakpoint'),
        } 
      }
    });
    await game.settings.set(MODULE_ID, settingIDs.infiltration.settings, currentSetting);
    this.render();
  }

  static async selectInfiltrationDefaultAwarenessBreakpoint(_, button) {
    this.selected.infiltration.awarenessBreakpoint = button.dataset.breakpoint;
    this.render();
  }

  static async removeInfiltrationDefaultAwarenessBreakpoint(_, button) {
    await game.settings.set(MODULE_ID, settingIDs.infiltration.settings, { [`defaultAwarenessBreakpoints.-=${button.dataset.breakpoint}`]: null });
    this.render();
  }

  static async resetInfiltrationDefaultAwarenessBreakpoints() {
    await game.settings.set(MODULE_ID, settingIDs.infiltration.settings, { defaultAwarenessBreakpoints: defaultInfiltrationAwarenessBreakpoints });
    this.render();
  }
}
