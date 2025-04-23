import { MODULE_ID } from "../data/constants";
import { readTextFromFile } from "../scripts/helpers";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class SystemImport extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(resolve, reject) {
        super({});

        this.resolve = resolve;
        this.reject = reject;
        this.influence = [];
        this.chase = [];
        this.research = [];
        this.infiltration = [];
    }

    get title() {
        return game.i18n.localize("PF2ESubsystems.Import.Title");
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "pf2e-subsystems-import",
        classes: ["pf2e-subsystems", "pf2e-import-export"],
        actions: {
            toggleEvent: this.toggleEvent,
            subsystemToggleAll: this.subsystemToggleAll,
            importEvents: this.importEvents,
        },
        form: { handler: this.updateData, submitOnChange: true },
    };

    static PARTS = {
        main: {
            id: "main",
            template: "modules/pf2e-subsystems/templates/import-menu.hbs",
        },
    }

    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);

        context.influence = this.influence;
        context.chase = this.chase;
        context.research = this.research;
        context.infiltration = this.infiltration;

        context.exportEnabled = context.influence.filter(x => x.selected).length > 0 || context.chase.filter(x => x.selected).length > 0 || context.research.filter(x => x.selected).length > 0 || context.infiltration.filter(x => x.selected).length > 0;
        context.toggledAll = {
            influence: context.influence.every(x => x.selected),
            chase: context.chase.every(x => x.selected),
            research: context.research.every(x => x.selected),
            infiltration: context.infiltration.every(x => x.selected),
        }

        return context;
    }

    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);

        htmlElement
            .querySelector(".file-path")
            .addEventListener("change", async (event) => {
                if (event.currentTarget.value) {
                    const text = await readTextFromFile(event.currentTarget.files[0]);
                    let jsonObject = null;
                    try {
                        jsonObject = JSON.parse(text);
                    } catch {}

                    this.influence = [...this.influence, ...Object.values(jsonObject.influence).map(x => ({ ...x, selected: false }))];
                    this.chase = [...this.chase, ...Object.values(jsonObject.chase).map(x => ({ ...x, selected: false }))];
                    this.research = [...this.research, ...Object.values(jsonObject.research).map(x => ({ ...x, selected: false }))];
                    this.infiltration = [...this.infiltration, ...Object.values(jsonObject.infiltration).map(x => ({ ...x, selected: false }))];
                    this.render();
                }
            });
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
    }

    static async importEvents() {
        const influenceEvents = this.influence.filter(x => x.selected);
        const chaseEvents = this.chase.filter(x => x.selected);
        const researchEvents = this.research.filter(x => x.selected);
        const infiltrationEvents = this.infiltration.filter(x => x.selected);

        if(influenceEvents.length > 0) {
            const influence = game.settings.get(MODULE_ID, 'influence');
            await influence.updateSource({
                events: influenceEvents.reduce((acc, influence) => {
                    const influenceEventId = foundry.utils.randomID();
                    acc[influenceEventId] = {
                        ...influence,
                        id: influenceEventId,
                        influencePoints: 0,
                        timeLimit: {
                            max: influence.timeLimit.max
                        },
                        discoveries: Object.values(influence.discoveries).reduce((acc, discovery) => {
                            const discoveryId = foundry.utils.randomID();
                            acc[discoveryId] = {
                                ...discovery,
                                id: discoveryId,
                            }

                            return acc;
                        }, {}),
                        influenceSkills: Object.values(influence.influenceSkills).reduce((acc, skill) => {
                            const skillId = foundry.utils.randomID();
                            acc[skillId] = {
                                ...skill,
                                hidden: true,
                                id: skillId,
                            }

                            return acc;
                        }, {}),
                        influence: Object.values(influence.influence).reduce((acc, influence) => {
                            const influenceId = foundry.utils.randomID();
                            acc[influenceId] = {
                                ...influence,
                                id: influenceId,
                                hidden: true,
                            }

                            return acc;
                        }, {}),
                        weaknesses: Object.values(influence.weaknesses).reduce((acc, weakness) => {
                            const weaknessId = foundry.utils.randomID();
                            acc[weaknessId] = {
                                ...weakness,
                                id: weaknessId,
                                hidden: true,
                                modifier: {
                                    value: weakness.modifier.value,
                                },
                            }

                            return acc;
                        }, {}),
                        resistances: Object.values(influence.resistances).reduce((acc, resistance) => {
                            const resistanceId = foundry.utils.randomID();
                            acc[resistanceId] = {
                                ...resistance,
                                id: resistanceId,
                                hidden: true,
                                modifier: {
                                    value: resistance.modifier.value,
                                },
                            }

                            return acc;
                        }, {}),
                        penalties: Object.values(influence.penalties).reduce((acc, penalty) => {
                            const penaltyId = foundry.utils.randomID();
                            acc[penaltyId] = {
                                ...penalty,
                                id: penaltyId,
                                hidden: true,
                                modifier: {
                                    value: penalty.modifier.value,
                                },
                            }

                            return acc;
                        }, {}),
                    }

                    return acc;
                }, {}),
            });
            await game.settings.set(MODULE_ID, 'influence', influence);
        }

        if(chaseEvents.length > 0) {
            const chase = game.settings.get(MODULE_ID, 'chase');
            await chase.updateSource({
                events: chaseEvents.reduce((acc, chase) => {
                    const chaseId = foundry.utils.randomID();
                    acc[chaseId] = {
                        ...chase,
                        id: chaseId,
                        rounds: {
                            max: chase.rounds.max,
                        },
                        started: false,
                        participants: Object.values(chase.participants).reduce((acc, participant, index) => {
                            if(!participant.player) {
                                const participantId = foundry.utils.randomID();
                                acc[participantId] = {
                                    ...participant,
                                    id: participantId,
                                    obstacle: 1,
                                    hasActed: false,
                                    position: index,
                                };
                            }

                            return acc;
                        }, {}),
                        obstacles: Object.values(chase.obstacles).reduce((acc, obstacle, index) => {
                            const obstacleId = foundry.utils.randomID();
                            acc[obstacleId] = {
                                ...obstacle,
                                id: obstacleId,
                                position: index+1,
                                locked: index > 0,
                                chasePoints: {
                                    goal: obstacle.chasePoints.goal,
                                }
                            };

                            return acc;
                        }, {}),
                    };

                    return acc;
                }, {}), 
            });
            await game.settings.set(MODULE_ID, 'chase', chase);
        }

        if(researchEvents.length > 0) {
            const research = game.settings.get(MODULE_ID, 'research');

            await research.updateSource({
                events: researchEvents.reduce((acc, event) => {
                    const eventId = foundry.utils.randomID();
                    acc[eventId] = {
                        ...event,
                        id: eventId,
                        timeLimit: {
                            unit: event.timeLimit.unit,
                            max: event.timeLimit.max,
                        },
                        started: false,
                        researchPoints: 0,
                        researchChecks: Object.values(event.researchChecks).reduce((acc, check) => {
                            const researchCheckId = foundry.utils.randomID();
                            acc[researchCheckId] = {
                                ...check,
                                id: researchCheckId,
                                currentResearchPoints: 0,
                                skillChecks: Object.values(check.skillChecks).reduce((acc, skillCheck) => {
                                    const skillCheckId = foundry.utils.randomID();
                                    acc[skillCheckId] = {
                                        ...skillCheck,
                                        id: skillCheckId,
                                        skills: Object.values(skillCheck.skills).reduce((acc, skill) => {
                                            const skillId = foundry.utils.randomID();
                                            acc[skillId] = {
                                                ...skill,
                                                id: skillId,
                                            };

                                            return acc;
                                        }, {}),
                                    };

                                    return acc;
                                }, {}),
                            }

                            return acc;
                        }, {}),
                        researchBreakpoints: Object.values(event.researchBreakpoints).reduce((acc, breakpoint) => {
                            const breakpointId = foundry.utils.randomID();
                            acc[breakpointId] = {
                                ...breakpoint,
                                id: breakpointId,
                                hidden: true,
                            };

                            return acc;
                        }, {}),
                        researchEvents: Object.values(event.researchEvents).reduce((acc, event) => {
                            const eventId = foundry.utils.randomID();
                            acc[eventId] = {
                                ...event,
                                id: eventId,
                                hidden: true,
                            };

                            return acc;
                        }, {}),
                    };

                    return acc;
                }, {}),
            });

            await game.settings.set(MODULE_ID, 'research', research);
        }

        if(infiltrationEvents.length > 0) {
            const infiltration = game.settings.get(MODULE_ID, 'infiltration');

            await infiltration.updateSource({
                events: infiltrationEvents.reduce((acc, event) => {
                    const eventId = foundry.utils.randomID();
                    acc[eventId] = {
                        ...event,
                        id: eventId,
                        started: false,
                        awarenessPoints: {
                            breakpoints: Object.values(event.awarenessPoints.breakpoints).reduce((acc, breakpoint) => {
                                const breakpointId = foundry.utils.randomID();
                                acc[breakpointId] = {
                                    ...breakpoint,
                                    id: breakpointId,
                                    inUse: false,
                                };

                                return acc;
                            }, {}),
                        },
                        edgePoints: {},
                        objectives: Object.values(event.objectives).reduce((acc, objective) => {
                            const objectiveId = foundry.utils.randomID();
                            acc[objectiveId] = {
                                ...objective,
                                id: objectiveId,
                                obstacles: Object.values(objective.obstacles).reduce((acc, obstacle) => {
                                    const obstacleId = foundry.utils.randomID();
                                    acc[obstacleId] = {
                                        ...obstacle,
                                        id: obstacleId,
                                        infiltrationPoints: {
                                            max: obstacle.infiltrationPoints.max,
                                        },
                                        infiltrationPointData: {},
                                        skillChecks: Object.values(obstacle.skillChecks).reduce((acc, skillCheck) => {
                                            const skillCheckId = foundry.utils.randomID();
                                            acc[skillCheckId] = {
                                                ...skillCheck,
                                                id: skillCheckId,
                                                selectedAdjustment: null,

                                                skills: Object.values(skillCheck.skills).reduce((acc, skill) => {
                                                    const skillId = foundry.utils.randomID();
                                                    acc[skillId] = {
                                                        ...skill,
                                                        id: skillId,
                                                    };
        
                                                    return acc;
                                                }, {}),
                                            };
        
                                            return acc;
                                        }, {}),
                                    };

                                    return acc;
                                }, {}),
                            };

                            return acc;
                        }, {}),
                        complications: Object.values(event.complications).reduce((acc, complication) => {
                            const complicationId = foundry.utils.randomID();
                            acc[complicationId] = {
                                ...complication,
                                id: complicationId,
                                hidden: true,
                                infiltrationPoints: {
                                    max: complication.infiltrationPoints.max,
                                },
                                skillChecks: Object.values(complication.skillChecks).reduce((acc, skillCheck) => {
                                    const skillCheckId = foundry.utils.randomID();
                                    acc[skillCheckId] = {
                                        ...skillCheck,
                                        id: skillCheckId,
                                        selectedAdjustment: null,

                                        skills: Object.values(skillCheck.skills).reduce((acc, skill) => {
                                            const skillId = foundry.utils.randomID();
                                            acc[skillId] = {
                                                ...skill,
                                                id: skillId,
                                            };

                                            return acc;
                                        }, {}),
                                    };

                                    return acc;
                                }, {}),
                                resultsOutcome: null,
                            };

                            return acc;
                        }, {}),
                        opportunities: Object.values(event.opportunities).reduce((acc, opportunity) => {
                            const opportunityId = foundry.utils.randomID();
                            acc[opportunityId] = {
                                ...opportunity,
                                id: opportunityId,
                                hidden: true,
                            };

                            return acc;
                        }, {}),
                        preparations: {
                            ...event.preparations,
                            activities: Object.values(event.preparations.activities).reduce((acc, activity) => {
                                const activityId = foundry.utils.randomID();
                                acc[activityId] = {
                                    ...activity,
                                    id: activityId,
                                    skillChecks: Object.values(activity.skillChecks).reduce((acc, skillCheck) => {
                                        const skillCheckId = foundry.utils.randomID();
                                        acc[skillCheckId] = {
                                            ...skillCheck,
                                            id: skillCheckId,
                                            selectedAdjustment: null,
                                            skills: Object.values(skillCheck.skills).reduce((acc, skill) => {
                                                const skillId = foundry.utils.randomID();
                                                acc[skillId] = {
                                                    ...skill,
                                                    id: skillId,
                                                };
    
                                                return acc;
                                            }, {}),
                                        };
    
                                        return acc;
                                    }, {}),
                                    results: {
                                        criticalSuccess: {
                                            ...activity.results.criticalSuccess,
                                            nrOutcomes: 0,
                                        },
                                        success: {
                                            ...activity.results.success,    
                                            nrOutcomes: 0,                                        
                                        },
                                        failure: {
                                            ...activity.results.failure,
                                            nrOutcomes: 0,
                                        },
                                        criticalFailure: {
                                            ...activity.results.criticalFailure,
                                            nrOutcomes: 0,
                                        },
                                    }
                                };

                                return acc;
                            }, {}),
                        },
                    }

                    return acc;
                }, {}),
            });

            await game.settings.set(MODULE_ID, 'infiltration', infiltration);
        }

        ui.notifications.info(game.i18n.localize('PF2ESubsystems.Import.ImportSuccessful'));
        this.resolve();
        this.close({ updateClose: true });
    }

    async close(options={}) {
        const { updateClose, ...baseOptions } = options;
        if(!updateClose){
            this.reject();
        }

        await super.close(baseOptions);
    }
}