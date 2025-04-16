import { MODULE_ID } from "../data/constants";
import SystemView from "../module/systemView";

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

export const registerSubsystemEvents = async (moduleId, jsonData) => {
  const subsystemProviders = game.settings.get(MODULE_ID, 'subsystem-providers');
  if(subsystemProviders[moduleId]?.registered) return;
  
  if(jsonData.influence?.length > 0) {
    const existingInfluence = game.settings.get(MODULE_ID, 'influence');
    await existingInfluence.updateSource({
      events: jsonData.influence.reduce((acc, influence) => {
        const influenceId = foundry.utils.randomID();
        acc[influenceId] = {
          ...influence,
          id: influenceId,
          discoveries: influence.discoveries.reduce((acc, discovery) => {
            const discoveryId = foundry.utils.randomID();
            acc[discoveryId] = {
              ...discovery,
              id: discoveryId,
            }
  
            return acc;
          }, {}),
          influenceSkills: influence.influenceSkills.reduce((acc, influenceSkill) => {
            const skillId = foundry.utils.randomID();
            acc[skillId] = {
              ...influenceSkill,
              id: skillId,
            }
  
            return acc;
          }, {}),
          influence: influence.influence.reduce((acc, influence) => {
            const influenceId = foundry.utils.randomID();
            acc[influenceId] = {
              ...influence,
              id: influenceId,
            }
  
            return acc;
          }, {}),
          weaknesses: influence.weaknesses.reduce((acc, weakness) => {
            const weaknessId = foundry.utils.randomID();
            acc[weaknessId] = {
              ...weakness,
              id: weaknessId,
            }
  
            return acc;
          }, {}),
          resistances: influence.resistances.reduce((acc, resistance) => {
            const resistanceId = foundry.utils.randomID();
            acc[resistanceId] = {
              ...resistance,
              id: resistanceId,
            }
  
            return acc;
          }, {}),
          penalties: influence.penalties.reduce((acc, penalty) => {
            const penaltyId = foundry.utils.randomID();
            acc[penaltyId] = {
              ...penalty,
              id: penaltyId,
            }
  
            return acc;
          }, {}),
        };
  
        return acc;
      }, {}),
    });
    await game.settings.set(MODULE_ID, 'influence', existingInfluence);
  }

  if(jsonData.chase?.length > 0) {
    const existingChase = game.settings.get(MODULE_ID, 'chase');
    await existingChase.updateSource({
      events: jsonData.chase.reduce((acc, chase) => {
        const chaseId = foundry.utils.randomID();
        acc[chaseId] = {
          ...chase,
          id: chaseId,
          participants: chase.participants.reduce((acc, participant) => {
            const participantId = foundry.utils.randomID();
            acc[participantId] = {
              ...participant,
              id: participantId,
            };
  
            return acc;
          }, {}),
          obstacles: chase.obstacles.reduce((acc, obstacle) => {
            const obstacleId = foundry.utils.randomID();
            acc[obstacleId] = {
              ...obstacle,
              id: obstacleId,
            };
  
            return acc;
          }, {}),
        };
  
        return acc;
      }, {}),
    });
    await game.settings.set(MODULE_ID, 'chase', existingChase);
  }

  if(jsonData.research?.length > 0) {
    const existingResearch = game.settings.get(MODULE_ID, 'research');
    await existingResearch.updateSource({
      events: jsonData.research.reduce((acc, research) => {
        const researchId = foundry.utils.randomID();
        acc[researchId] = {
          ...research,
          id: researchId,
          researchChecks: research.researchChecks.reduce((acc, check) => {
            const researchCheckId = foundry.utils.randomID();
            acc[researchCheckId] = {
              ...check,
              id: researchCheckId,
              skillChecks: check.skillChecks.reduce((acc, skillCheck) => {
                const skillCheckId = foundry.utils.randomID();
                acc[skillCheckId] = {
                  ...skillCheck,
                  id: skillCheckId,
                  skills: skillCheck.skills.reduce((acc, skill) => {
                    const skillId = foundry.utils.randomID();
                    acc[skillId] = {
                      ...skill,
                      id: skillId,
                    }

                    return acc;
                  }, {}),
                }
                
                return acc;
              }, {}),
            }

            return acc;
          }, {}),
          researchBreakpoints: research.researchBreakpoints.reduce((acc, breakpoint) => {
            const breakpointId = foundry.utils.randomID();
            acc[breakpointId] = {
              ...breakpoint,
              id: breakpointId,
            }

            return acc;
          }, {}),
          researchEvents: research.researchEvents.reduce((acc, event) => {
            const eventId = foundry.utils.randomID();
            acc[eventId] = {
              ...event,
              id: eventId,
            }

            return acc;
          }, {}),
        };
  
        return acc;
      }, {}),
    });
    await game.settings.set(MODULE_ID, 'research', existingResearch);
  }

  if(jsonData.infiltration?.length > 0) {
    const existingInfiltration = game.settings.get(MODULE_ID, 'infiltration');
    const update = jsonData.infiltration.reduce((acc, infiltration) => {
      const infiltrationId = foundry.utils.randomID();
      acc[infiltrationId] = {
        ...infiltration,
        id: infiltrationId,
        awarenessPoints: {
          ...infiltration.awarenessPoints,
          breakpoints: infiltration.awarenessPoints.breakpoints.reduce((acc, breakpoint) => {
            const breakpointId = foundry.utils.randomID();
            acc[breakpointId] = {
              ...breakpoint,
              id: breakpointId,
            };

            return acc;
          }, {}),
        },
        edgePoints: infiltration.edgePoints.reduce((acc, point) => {
          const pointId = foundry.utils.randomID();
          acc[pointId] = {
            ...point,
            id: pointId,
          };

          return acc;
        }, {}),
        objectives: infiltration.objectives.reduce((acc, objective) => {
          const objectiveId = foundry.utils.randomID();
          acc[objectiveId] = {
            ...objective,
            id: objectiveId,
            obstacles: objective.obstacles.reduce((acc, obstacle) => {
              const obstacleId = foundry.utils.randomID();
              acc[obstacleId] = {
                ...obstacle,
                id: obstacleId,
                infiltrationPointData: obstacle.infiltrationPointData.reduce((acc, data) => {
                  const dataId = foundry.utils.randomID();
                  acc[dataId] = {
                    ...data,
                    id: dataId,
                  };

                  return acc;
                }, {}),
                skillChecks: obstacle.skillChecks.reduce((acc, skillCheck) => {
                  const skillCheckId = foundry.utils.randomID();
                  acc[skillCheckId] = {
                    ...skillCheck,
                    id: skillCheckId,
                    skills: skillCheck.skills.reduce((acc, skill) => {
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
          };

          return acc;
        }, {}),
        complications: infiltration.complications.reduce((acc, complication) => {
          const complicationId = foundry.utils.randomID();
          acc[complicationId] = {
            ...complication,
            id: complicationId,
            skillChecks: complication.skillChecks.reduce((acc, skillCheck) => {
              const skillCheckId = foundry.utils.randomID();
              acc[skillCheckId] = {
                ...skillCheck,
                id: skillCheckId,
                skills: skillCheck.skills.reduce((acc, skill) => {
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
        opportunities: infiltration.opportunities.reduce((acc, opportunity) => {
          const opportunityId = foundry.utils.randomID();
          acc[opportunityId] = {
            ...opportunity,
            id: opportunityId,
          }

          return acc;
        }, {}),
        preparations: {
          ...infiltration.preparations,
          activities: infiltration.preparations.activities.reduce((acc, activity) => {
            const activityId = foundry.utils.randomID();
            acc[activityId] = {
              ...activity,
              id: activityId,
              skillChecks: activity.skillChecks.reduce((acc, skillCheck) => {
                const skillCheckId = foundry.utils.randomID();
                acc[skillCheckId] = {
                  ...skillCheck,
                  id: skillCheckId,
                  skills: skillCheck.skills.reduce((acc, skill) => {
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
    { [moduleId]: { registered: true } },
  ));
}