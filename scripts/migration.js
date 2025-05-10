import { MODULE_ID } from "../data/constants";
import { versionCompare } from "./helpers";
import { currentVersion } from "./setup";

export const handleMigration = async () => {
    if (!game.user.isGM) return;

    var version = game.settings.get(MODULE_ID, "version");
    if (!version) {
        version = currentVersion;
        await game.settings.set(MODULE_ID, "version", version);
    }

    await migrateEvents();
};

const migrateEvents = async () => {
    await migrateChase();
    await migrateInfiltration();
    await migrateInfluence();
    await migrateResearch();
};

const migrateChase = async () => {
    const chase = game.settings.get(MODULE_ID, 'chase');
    var events = Object.values(chase.events)
    for(var i = 0; i < events.length; i++){
        const event = events[i];
        if(versionCompare(event.version, '0.8.1')){
            await chase.updateSource({ events: {
                [event.id]: {
                    version: '0.8.1',
                    position: i+1,
                    obstacles: Object.values(event.obstacles).reduce((acc, obstacle, index) => {
                        acc[obstacle.id] = { ...obstacle, position: index+1 };

                        return acc;
                    }, {}),
                }
            }});
        }
    }

    await game.settings.set(MODULE_ID, 'chase', chase);
};

const migrateInfiltration = async () => {
    const infiltration = game.settings.get(MODULE_ID, 'infiltration');
    const events = Object.values(infiltration.events);
    for(var i = 0; i < events.length; i++){
        const event = events[i];
        if(versionCompare(event.version, '0.7.8')){
            await infiltration.updateSource({ events: {
                [event.id]: {
                    version: '0.7.8',
                    objectives: Object.values(event.objectives).reduce((acc, objective) => {
                        acc[objective.id] = {
                            obstacles: Object.values(objective.obstacles).reduce((acc, obstacle) => {
                                acc[obstacle.id] = {
                                    skillChecks: Object.values(obstacle.skillChecks).reduce((acc, skillCheck) => {
                                        acc[skillCheck.id] = {
                                            skills: Object.values(skillCheck.skills).reduce((acc, skill) => {
                                                acc[skill.id] = {
                                                    difficulty: {
                                                        DC: skillCheck.difficulty.DC,
                                                        leveledDC: skillCheck.difficulty.leveledDC,
                                                    }
                                                };
    
                                                return acc;
                                            }, {}),
                                        };
    
                                        return acc;
                                    }, {}),
                                };
    
                                return acc;
                            }, {}),
                        }
        
                        return acc;
                    }, {}),
                    complications: Object.values(event.complications).reduce((acc, complication) => {
                        acc[complication.id] = {
                            skillChecks: Object.values(complication.skillChecks).reduce((acc, skillCheck) => {
                                acc[skillCheck.id] = {
                                    skills: Object.values(skillCheck.skills).reduce((acc, skill) => {
                                        acc[skill.id] = {
                                            difficulty: {
                                                DC: skillCheck.difficulty.DC,
                                                leveledDC: skillCheck.difficulty.leveledDC,
                                            }
                                        };

                                        return acc;
                                    }, {}),
                                };

                                return acc;
                            }, {}),
                        }

                        return acc;
                    }, {}),
                    preparations: {
                        activities: Object.values(event.preparations.activities).reduce((acc, activity) => {
                            acc[activity.id] = {
                                skillChecks: Object.values(activity.skillChecks).reduce((acc, skillCheck) => {
                                    acc[skillCheck.id] = {
                                        skills: Object.values(skillCheck.skills).reduce((acc, skill) => {
                                            acc[skill.id] = {
                                                difficulty: {
                                                    DC: skillCheck.difficulty.DC,
                                                    leveledDC: skillCheck.difficulty.leveledDC,
                                                }
                                            };
    
                                            return acc;
                                        }, {}),
                                    };
    
                                    return acc;
                                }, {}),
                            }
    
                            return acc;
                        }, {}),
                    }
                }
            }});
        }
        if(versionCompare(event.version, '0.8.2')){
            await infiltration.updateSource({ events: {
                [event.id]: {
                    version: '0.8.1',
                    position: i+1,
                    awarenessPoints: {
                        ...event.awarenessPoints,
                        breakpoints: Object.values(event.awarenessPoints.breakpoints).reduce((acc, breakpoint, index) => {
                            acc[breakpoint.id] = { ...breakpoint, position: index+1 };

                            return acc;
                        }, {}),
                    },
                    edgePoints: Object.values(event.edgePoints).reduce((acc, edgePoint, index) => {
                        acc[edgePoint.id] = { ...edgePoint, position: index+1 };

                        return acc;
                    }, {}),
                    objectives: Object.values(event.objectives).reduce((acc, objective, index) => {
                        acc[objective.id] = { 
                            ...objective, 
                            position: index+1,
                            obstacles: Object.values(objective.obstacles).reduce((acc, obstacle, index) => {
                                acc[obstacle.id] = { ...obstacle, position: index+1 };

                                return acc;
                            }, {}),
                        };

                        return acc;
                    }, {}),
                    complications: Object.values(event.complications).reduce((acc, complication, index) => {
                        acc[complication.id] = { ...complication, position: index+1 };

                        return acc;
                    }, {}),
                    opportunities: Object.values(event.opportunities).reduce((acc, opportunity, index) => {
                        acc[opportunity.id] = { ...opportunity, position: index+1 };

                        return acc;
                    }, {}),
                    preparations: {
                        ...event.preparations,
                        activities: Object.values(event.preparations.activities).reduce((acc, activity, index) => {
                            acc[activity.id] = { ...activity, position: index+1 };

                            return acc;
                        }, {}),
                    },
                }
            }});
        }
    }

    await game.settings.set(MODULE_ID, 'infiltration', infiltration);
};

const migrateInfluence = async () => {
    const influence = game.settings.get(MODULE_ID, 'influence');
    var events = Object.values(influence.events)
    for(var i = 0; i < events.length; i++){
        const event = events[i];
        if(versionCompare(event.version, '0.8.1')){
            await influence.updateSource({ events: {
                [event.id]: {
                    version: '0.8.1',
                    position: i+1,
                    discoveries: Object.values(event.discoveries).reduce((acc, discovery, index) => {
                        acc[discovery.id] = { ...discovery, position: index+1 };

                        return acc;
                    }, {}),
                    influenceSkills: Object.values(event.influenceSkills).reduce((acc, skill, index) => {
                        acc[skill.id] = { ...skill, position: index+1 };

                        return acc;
                    }, {}),
                    influence: Object.values(event.influence).reduce((acc, influence, index) => {
                        acc[influence.id] = { ...influence, position: index+1 };

                        return acc;
                    }, {}),
                    weaknesses: Object.values(event.weaknesses).reduce((acc, weakness, index) => {
                        acc[weakness.id] = { ...weakness, position: index+1 };

                        return acc;
                    }, {}),
                    resistances: Object.values(event.resistances).reduce((acc, resistance, index) => {
                        acc[resistance.id] = { ...resistance, position: index+1 };

                        return acc;
                    }, {}),
                    penalties: Object.values(event.penalties).reduce((acc, penalty, index) => {
                        acc[penalty.id] = { ...penalty, position: index+1 };

                        return acc;
                    }, {}),
                }
            }});
        }
    }

    await game.settings.set(MODULE_ID, 'influence', influence);
};

const migrateResearch = async () => {
    const research = game.settings.get(MODULE_ID, 'research');
    var events = Object.values(research.events)
    for(var i = 0; i < events.length; i++){
        const event = events[i];
        if(versionCompare(event.version, '0.8.1')){
            await research.updateSource({ events: {
                [event.id]: {
                    version: '0.8.1',
                    position: i+1,
                    researchChecks: Object.values(event.researchChecks).reduce((acc, check, index) => {
                        acc[check.id] = { ...check, position: index+1 };

                        return acc;
                    }, {}),
                    researchBreakpoints: Object.values(event.researchBreakpoints).reduce((acc, point, index) => {
                        acc[point.id] = { ...point, position: index+1 };

                        return acc;
                    }, {}),
                    researchEvents: Object.values(event.researchEvents).reduce((acc, event, index) => {
                        acc[event.id] = { ...event, position: index+1 };

                        return acc;
                    }, {}),
                }
            }});
        }
    }

    await game.settings.set(MODULE_ID, 'research', research);
};