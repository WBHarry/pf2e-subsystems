import { SOCKET_ID } from "../data/constants";
import { socketEvent } from "./socket";

export async function updateDataModel(setting, data){
    if(game.user.isGM){
        Hooks.callAll(socketEvent.GMUpdate, { setting, data });
    }
    else {
        if(!game.users.some(x => x.isGM)){
            ui.notifications.error(game.i18n.localize('PF2ESubsystems.View.Errors.GMMissing'));
            return;
        }

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

export async function copyToClipboard(textToCopy) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(textToCopy);
    } else {
        return new Promise(async function (resolve, reject){
            // Use the 'out of viewport hidden text area' trick
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
                
            // Move textarea out of the viewport so it's not visible
            textArea.style.position = "absolute";
            textArea.style.left = "-999999px";
                
            document.body.prepend(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (error) {
                reject();
            } finally {
                textArea.remove();
                resolve();
            }
        });

    }
}