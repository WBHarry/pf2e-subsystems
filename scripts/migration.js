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
    await migrateInfiltration();
};

const migrateInfiltration = async () => {
    const infiltration = game.settings.get(MODULE_ID, 'infiltration');
    for(var event of Object.values(infiltration.events)){
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
    }

    await game.settings.set(MODULE_ID, 'infiltration', infiltration);
};