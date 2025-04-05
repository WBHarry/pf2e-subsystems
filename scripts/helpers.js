import { SOCKET_ID } from "../data/constants";
import { levelDCTable } from "../data/statisticsData";
import { socketEvent } from "./socket";
import Tagify from "@yaireo/tagify";

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

export const getDCAdjustmentNumber = (adjustment) => {
    switch(adjustment){
        case 'incrediblyEasy':
            return -10;
        case 'veryEasy':
            return -5;
        case 'easy':
            return -2;
        case 'standard':
            return 0;
        case 'hard':
            return 2;
        case 'veryHard':
            return 5;
        case 'incrediblyHard':
            return 10;
    }
};

export const getSelfDC = () => {
    if(game.user.isGM || !game.user.character) {
        const highestPartyLevel = game.actors.find(x => x.type === 'party').members.reduce((acc, curr) => {
            if(curr.system.details.level.value > acc) return curr.system.details.level.value;
            return acc;
        }, 1);

        return levelDCTable[highestPartyLevel];
    }
    else {
        return levelDCTable[game.user.character.system.details.level.value];
    }
}

export const setupTagify = (html, htmlClass, options, onChange, onRemove) => {
    const tagFunc = (tagData) => {
        return `
            <tag
                contenteditable='false'
                spellcheck='false'
                tabIndex="-1"
                class="tagify__tag tagify--noAnim tagify-hover-parent"
            >
                <x title='' class='tagify__tag__removeBtn' role='button' aria-label='remove tag'></x>
                <div>
                    <span class="tagify__tag-text">${tagData.name}</span>
                </div>
            </tag>
        `;
        }

    for(var input of $(html).find(htmlClass)) {
        const traitsTagify = new Tagify(input, {
            tagTextProp: "name",
            enforceWhitelist: true,
            whitelist: options.map((option) => {
                return { value: option.value, name: game.i18n.localize(option.name) };
            }),
            hooks: { 
                beforeRemoveTag: e => onRemove(e),
            },
            dropdown: {
                mapValueTo: "value",
                searchKeys: ["value"],
                enabled: 0,
                maxItems: 20,
                closeOnSelect: true,
                highlightFirst: false,
            },
            templates: {
            tag: tagFunc,
            },
        });

        traitsTagify.on("change", onChange);
    }
}