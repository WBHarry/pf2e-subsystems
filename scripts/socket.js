import SystemView from "../module/systemView";

export function handleSocketEvent({ action = null, data = {} } = {}) {
    switch (action) {
      case socketEvent.UpdateSystemView:
        Hooks.callAll(socketEvent.UpdateSystemView, data?.tab);
        break;
      case socketEvent.OpenSystemEvent:
        new SystemView(data.tab, data.event).render(true);
        break;
    }
  }
  
  export const socketEvent = {
    UpdateSystemView: "UpdateSystemView",
    OpenSystemEvent: "OpenSystemEvent",
  };
  