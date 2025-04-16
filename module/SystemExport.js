import { MODULE_ID } from "../data/constants";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class SystemExport extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor() {
        super({});

        this.influences = Object.values(game.settings.get(MODULE_ID, 'influence').events).map(influence => {
            return { id: influence.id, name: influence.name, img: influence.background, selected: false };
        });
        this.chases = Object.values(game.settings.get(MODULE_ID, 'chase').events).map(chase => {
            return { id: chase.id, name: chase.name, img: chase.background, selected: false };
        });
        this.researches = Object.values(game.settings.get(MODULE_ID, 'research').events).map(research => {
            return { id: research.id, name: research.name, img: research.background, selected: false };
        });
        this.infiltrations = Object.values(game.settings.get(MODULE_ID, 'infiltration').events).map(infiltration => {
            return { id: infiltration.id, name: infiltration.name, img: infiltration.background, selected: false };
        });
    }

    get title() {
        return game.i18n.localize("PF2ESubsystems.ImportExport.Title");
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "pf2e-subsystems-export",
        classes: ["pf2e-subsystems", "pf2e-export"],
        position: { width: "200", height: "auto" },
        actions: {},
        form: { handler: this.updateData, submitOnChange: true },
    };

    static PARTS = {
        main: {
            id: "main",
            template: "modules/pf2e-subsystems/templates/export-menu.hbs",
        },
    }

    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);

        context.influences = this.influences;
        context.chases = this.chases;
        context.researches = this.researches;
        context.infiltrations = this.infiltrations;

        return context;
    }

    static async updateData(event, element, formData) {
        const { influences, chases, researches, infiltrations } = foundry.utils.expandObject(formData.object);
    
        this.influences = influences;
        this.chases = chases;
        this.researches = researches;
        this.infiltrations = infiltrations;
    }

    async close(options={}) {
        await super.close(options);
    }
}