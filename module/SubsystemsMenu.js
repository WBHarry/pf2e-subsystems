import { MODULE_ID, settingIDs } from "../data/constants";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class SubsystemsMenu extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor() {
    super({});
  }

  get title() {
    return game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Title");
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    id: "pf2e-subsystems-subsystems-menu",
    classes: ["pf2e-subsystems", "pf2e-subsystems-menu"],
    position: { width: "500", height: "auto" },
    actions: {
      save: this.save,
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
    }

    return context;
}

  static async updateData(event, element, formData) {
    const { chase, research } = foundry.utils.expandObject(formData.object);

    await game.settings.set(MODULE_ID, settingIDs.chase.settings, chase);
    await game.settings.set(MODULE_ID, settingIDs.research.settings, research);

    this.close();
  }

//   static async resetSection(_, button) {
//     await foundry.utils.setProperty(
//       this.settings,
//       button.dataset.path,
//       getVagueDescriptionLabels()[button.dataset.property],
//     );
//     this.render();
//   }

  static async save(options) {
    // await game.settings.set(
    //   MODULE_ID,
    //   settingIDs.menus.subsystems,
    //   this.settings,
    // );
    this.close();
  }
}
