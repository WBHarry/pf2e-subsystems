export function handleSocketEvent({ action = null, data = {} } = {}) {
    switch (action) {
      case socketEvent.UpdateSystemView:
        Hooks.callAll(socketEvent.UpdateSystemView, {});
        break;
    }
  }
  
  export const socketEvent = {
    UpdateSystemView: "UpdateSystemView",
  };
  