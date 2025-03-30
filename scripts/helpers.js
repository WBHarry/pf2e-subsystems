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