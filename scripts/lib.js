import { MODULE_ID } from "../data/constants";
import SystemView from "../module/systemView";
import { versionCompare } from "./helpers";

export const openSubsystemView = async (tab, event, options) => {
  new SystemView(tab, event, false, options).render(true);
};

export const addEvent = async (subsystem, resolve) => {
  await SystemView.setEvent(subsystem, resolve);
}

export const startEvent = async (tab, event) => {
  if(!tab) {
    ui.notifications.error(game.i18n.localize('PF2ESubsystems.Macros.StartEvent.Errors.MissingTab'));
    return;
  }

  if(!event) {
    ui.notifications.error(game.i18n.localize('PF2ESubsystems.Macros.StartEvent.Errors.MissingEvent'));
    return;
  }

  const eventEntity = game.settings.get(MODULE_ID, tab).events[event];
  if(!eventEntity) {
    ui.notifications.error(game.i18n.localize('PF2ESubsystems.Macros.StartEvent.Errors.MissingEventEntity'));
    return;
  }

  const systemView = await new SystemView(tab, event).render(true);
  systemView.onStartEvent(event);
}

export const registerSubsystemEvents = async (moduleId, version, jsonData) => {
  const subsystemProviders = game.settings.get(MODULE_ID, 'subsystem-providers');
  if(subsystemProviders[moduleId]?.version && !versionCompare(subsystemProviders[moduleId].version, version)) return;
  
  if(jsonData.influence) {
    const existingInfluence = game.settings.get(MODULE_ID, 'influence');
    await existingInfluence.updateSource({
      events: Object.values(jsonData.influence).reduce((acc, influence) => {
        const { influencePoints, ...rest } = influence;
        acc[influence.id] = {
          ...rest,
          moduleProvider: moduleId,
          timeLimit: {
            max: influence.timeLimit.max,
          }
        };
  
        return acc;
      }, {}),
    });
    await game.settings.set(MODULE_ID, 'influence', existingInfluence);
  }

  if(jsonData.chase) {
    const existingChase = game.settings.get(MODULE_ID, 'chase');
    await existingChase.updateSource({
      events: Object.values(jsonData.chase).reduce((acc, chase) => {
        const { started, ...rest } = chase;
        acc[chase.id] = {
          ...rest,
          moduleProvider: moduleId,
          rounds: {
            max: chase.rounds.max,
          },
          participants: Object.values(chase.participants).reduce((acc, participant) => {
            if(!participant.player) {
              const { hasActed, ...rest } = participant;
              acc[participant.id] = {
                ...rest,
              };
            }

            return acc;
          }, {}),
          obstacles: Object.values(chase.obstacles).reduce((acc, obstacle) => {
            acc[obstacle.id] = {
              ...obstacle,
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
    await game.settings.set(MODULE_ID, 'chase', existingChase);
  }

  if(jsonData.research) {
    const existingResearch = game.settings.get(MODULE_ID, 'research');
    await existingResearch.updateSource({
      events: Object.values(jsonData.research).reduce((acc, research) => {
        const { started, ...rest } = research;
        acc[research.id] = {
          ...rest,
          moduleProvider: moduleId,
          timeLimit: {
            unit: research.timeLimit.unit,
            max: research.timeLimit.max,
          },
          researchChecks: Object.values(research.researchChecks).reduce((acc, check) => {
            const { currentResearchPoints, ...rest } = check;
            acc[check.id]= rest;

            return acc;
          }, {}),
        };
  
        return acc;
      }, {}),
    });
    await game.settings.set(MODULE_ID, 'research', existingResearch);
  }

  if(jsonData.infiltration) {
    const existingInfiltration = game.settings.get(MODULE_ID, 'infiltration');
    const update = Object.values(jsonData.infiltration).reduce((acc, infiltration) => {
      acc[infiltration.id] = {
        ...infiltration,
        moduleProvider: moduleId,
        awarenessPoints: {
          ...infiltration.awarenessPoints,
          breakpoints: Object.values(infiltration.awarenessPoints.breakpoints).reduce((acc, breakpoint) => {
            const { inUse, ...rest } = breakpoint;
            acc[breakpoint.id] = {
              ...rest,
            };

            return acc;
          }, {}),
        },
        objectives: Object.values(infiltration.objectives).reduce((acc, objective) => {
          acc[objective.id] = {
            ...objective,
            obstacles: Object.values(objective.obstacles).reduce((acc, obstacle) => {
              acc[obstacle.id] = {
                ...obstacle,
                infiltrationPoints: {
                  max: obstacle.infiltrationPoints.max,
                },
                skillChecks: Object.values(obstacle.skillChecks).reduce((acc, skillCheck) => {
                  const { selectedAdjustment, ...rest } = skillCheck;
                  acc[skillCheck.id] = {
                    ...rest,
                  };

                  return acc;
                }, {}),
              }

              return acc;
            }, {}),
          };

          return acc;
        }, {}),
        complications: Object.values(infiltration.complications).reduce((acc, complication) => {
          acc[complication.id] = {
            ...complication,
            infiltrationPoints: {
              max: complication.infiltrationPoints.max,
            },
            skillChecks: Object.values(complication.skillChecks).reduce((acc, skillCheck) => {
              const { selectedAdjustment, ...rest } = skillCheck;
              acc[skillCheck.id] = {
                ...rest,
              };

              return acc;
            }, {}),
          };

          return acc;
        }, {}),
        preparations: {
          ...infiltration.preparations,
          activities: Object.values(infiltration.preparations.activities).reduce((acc, activity) => {
            acc[activity.id] = {
              ...activity,
              skillChecks: Object.values(activity.skillChecks).reduce((acc, skillCheck) => {
                const { selectedAdjustment, ...rest } = skillCheck;
                acc[skillCheck.id] = {
                  ...rest,
                };

                return acc;
              }, {}),
            };

            return acc;
          }, {}),
        },
      };

      return acc;
    }, {});
    await existingInfiltration.updateSource({
      events: update,
    });
    await game.settings.set(MODULE_ID, 'infiltration', existingInfiltration);
  }

  game.settings.set(MODULE_ID, 'subsystem-providers', mergeObject(
    game.settings.get(MODULE_ID, 'subsystem-providers'),
    { 
      [moduleId]: { 
        version: version,
      } 
    },
  ));
}