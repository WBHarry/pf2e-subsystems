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
        actions: {
            toggleEvent: this.toggleEvent,
            subsystemToggleAll: this.subsystemToggleAll,
            export: this.export,
        },
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

        context.canExport = [...context.influences, ...context.chases, ...context.researches, ...context.infiltrations].some(x => x.selected);
        context.toggledAll = {
            influence: context.influences.every(x => x.selected),
            chase: context.chases.every(x => x.selected),
            research: context.researches.every(x => x.selected),
            infiltration: context.infiltrations.every(x => x.selected),
        }

        return context;
    }

    static toggleEvent(_, button) {
        this[button.dataset.subsystem][button.dataset.event].selected = !this[button.dataset.subsystem][button.dataset.event].selected;
        this.render();
    }

    static subsystemToggleAll(_, button) {
        this[button.dataset.subsystem] = this[button.dataset.subsystem].map(x => ({ ...x, selected: button.dataset.selected === 'true' }));
        this.render();
    }

    static async updateData(event, element, formData) {
        const { influences, chases, researches, infiltrations } = foundry.utils.expandObject(formData.object);
    
        this.influences = influences;
        this.researches = chases;
        this.researches = researches;
        this.infiltrations = infiltrations;
    }

   static export() {
        const jsonData = {
            influence: Object.values(game.settings.get(MODULE_ID, 'influence').events).reduce((acc, curr) => {
                const influence = curr.toObject();
                if(this.influences.some(x => x.selected && x.id === influence.id)){
                    acc.push({
                        ...influence,
                        discoveries: Object.values(influence.discoveries),
                        influenceSkills: Object.values(influence.influenceSkills),
                        influence: Object.values(influence.influence),
                        weaknesses: Object.values(influence.weaknesses),
                        resistances: Object.values(influence.resistances),
                        penalties: Object.values(influence.penalties),
                    });
                }

                return acc;
            }, []),
            chase: Object.values(game.settings.get(MODULE_ID, 'chase').events).reduce((acc, curr) => {
                const chase = curr.toObject();
                if(this.chases.some(x => x.selected && x.id === chase.id)){
                    acc.push({
                        ...chase,
                        participants: Object.values(chase.participants),
                        obstacles: Object.values(chase.obstacles),
                    });
                }

                return acc;
            }, []),
            research: Object.values(game.settings.get(MODULE_ID, 'research').events).reduce((acc, curr) => {
                const research = curr.toObject();
                if(this.researches.some(x => x.selected && x.id === research.id)){
                    acc.push({
                        ...research,
                        researchChecks: Object.values(research.researchChecks).map(check => ({
                            ...check,
                            skillChecks: Object.values(check.skillChecks).map(skillCheck => ({
                                ...skillCheck,
                                skills: Object.values(skillCheck.skills),
                            }))
                        })),
                        researchBreakpoints: Object.values(research.researchBreakpoints),
                        researchEvents: Object.values(research.researchEvents),
                    });
                }

                return acc;
            }, []),
            infiltration: Object.values(game.settings.get(MODULE_ID, 'infiltration').events).reduce((acc, curr) => {
                const infiltration = curr.toObject();
                if(this.infiltrations.some(x => x.selected && x.id === infiltration.id)){
                    acc.push({
                        ...infiltration,
                        awarenessPoints: {
                            ...infiltration.awarenessPoints,
                            breakpoints: Object.values(infiltration.awarenessPoints),
                        },
                        edgePoints: Object.values(infiltration.edgePoints),
                        objectives: Object.values(infiltration.objectives).map(objective => ({
                            ...objective,
                            obstacles: Object.values(objective.obstacles).map(obstacle => ({
                                ...obstacle,
                                infiltrationPointData: Object.values(obstacle.infiltrationPointData),
                                skillChecks: Object.values(obstacle.skillChecks).map(skillCheck => ({
                                    ...skillCheck,
                                    skills: Object.values(skillCheck.skills),
                                })),
                            }))
                        })),
                        complications: Object.values(infiltration.complications).map(complication => ({
                            ...complication,
                            skillChecks: Object.values(complication.skillChecks).map(skillCheck => ({
                                ...skillCheck,
                                skills: Object.values(skillCheck.skills),
                            })),
                        })),
                        opportunities: Object.values(infiltration.opportunities),
                        preparations: {
                            ...infiltration.preparations,
                            activities: Object.values(infiltration.preparations.activities).map(activity => ({
                                ...activity,
                                skillChecks: Object.values(activity.skillChecks).map(skillCheck => ({
                                    ...skillCheck,
                                    skills: Object.values(skillCheck.skills),
                                })),
                            })),
                        },
                    });
                }

                return acc;
            }, []),
        };
        saveDataToFile(
            JSON.stringify(jsonData, null, 2),
            "text/json",
            `pf2e-subsystems-export.json`,
        );

        ui.notifications.info(game.i18n.localize("PF2ESubsystems.ImportExport.SuccessfullyExported"));
    }

    async close(options={}) {
        await super.close(options);
    }
}