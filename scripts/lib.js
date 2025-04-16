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
  
  if(jsonData.influence) {

  }

  if(jsonData.chase) {
    const existingChase = game.settings.get(MODULE_ID, 'chase');
    await existingChase.updateSource(jsonData.chase.reduce((acc, chase) => {
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
    }, {}));
    await game.settings.set(MODULE_ID, 'chase', existingChase);
  }

  if(jsonData.research) {

  }

  if(jsonData.infiltrate) {

  }
}