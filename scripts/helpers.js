import { SOCKET_ID } from "../data/constants";
import { socketEvent } from "./socket";

export async function updateDataModel(setting, data){
    if(game.user.isGM){
        Hooks.callAll(socketEvent.GMUpdate, { setting, data });
    }
    else {
        game.socket.emit(SOCKET_ID, {
            action: socketEvent.GMUpdate,
            data: { setting, data },
        });
    }
}

export function translateSubsystem(tab) {
    switch(tab) {
        case 'chase':
            return game.i18n.localize("PF2ESubsystems.Events.Chase.Single");
        case 'research':
            return game.i18n.localize("PF2ESubsystems.Events.Research.Single");
    }
}