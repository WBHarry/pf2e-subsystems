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
        case 'infiltration':
            return game.i18n.localize("PF2ESubsystems.Events.Infiltration.Single");
        case 'influence':
            return game.i18n.localize("PF2ESubsystems.Events.Influence.Single");
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

export const setupTagify = (html, htmlClass, options, onChange) => {
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

    for(var input of html.querySelectorAll(htmlClass))
    {
        new Tagify(input, {
            tagTextProp: "name",
            enforceWhitelist: true,
            whitelist: options.map((option) => {
                return { value: option.value, name: game.i18n.localize(option.name) };
            }),
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

        input.addEventListener('change', onChange)
    }  
}



const disableRollButton = (disable, html) => {
    if(!disable) return html;
    return html.match(/style="/) ? html.replace(/style="/, 'style="opacity: 0.4; pointer-events: none; ') : html.replace(/<a/, '<a style="opacity: 0.4; pointer-events: none; "').replace(/<span/, '<span style="opacity: 0.4; pointer-events: none; "');
} 

const correctBackground = (html) => {
    return html.replace('data-visibility="gm"', 'data-visibility="gm" style="background-color: inherit;"');
};

export const getActButton = async(action, variant, skill, dc, disableElement, secret = false, title, simpleTitle) => {
    return correctBackground(disableRollButton(disableElement, await foundry.applications.ux.TextEditor.implementation.enrichHTML(`[[/act ${action} ${variant ? `variant=${variant} ` : ''}stat=${skill} dc=${dc}${title ? ` title=${hyphenateText(title)}` : ''}${simpleTitle ? ' simpleTitle' : ''}${secret ? ' traits=secret' : ''}]]`)));
}

export const getCheckButton = async(skill, dc, simple, disableElement, secret = false, title) => {
    return correctBackground(disableRollButton(disableElement, await foundry.applications.ux.TextEditor.implementation.enrichHTML(`@Check[type:${skill}|dc:${dc}|simple:${simple}${title ? `|title:${title}` : ''}${secret ? '|traits:secret' : ''}]`)));
}

export const versionCompare = (current, target) => {
    const currentSplit = current.split(".").map((x) => Number.parseInt(x));
    const targetSplit = target.split(".").map((x) => Number.parseInt(x));
    for (var i = 0; i < currentSplit.length; i++) {
      if (currentSplit[i] < targetSplit[i]) return true;
      if (currentSplit[i] > targetSplit[i]) return false;
    }
  
    return false;
};

export const hyphenateText = (text) => {
    return text.replaceAll(' ', '-');
};

export const readTextFromFile = (file) => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = (ev) => {
            resolve(reader.result);
        };
        reader.onerror = (ev) => {
            reader.abort();
        reject();
        };
        
        reader.readAsText(file);
    });
};

export const getNewPositionOnDrop = (startPosition, dropPosition, currentPosition) => {
    if(startPosition === currentPosition) return dropPosition;

    if(startPosition > dropPosition) {
        return currentPosition >= dropPosition && currentPosition < startPosition ? currentPosition+1 : currentPosition;
    }

    return currentPosition <= dropPosition && currentPosition > startPosition ? currentPosition-1 : currentPosition;
};

export const positionSort = (objectValue) => {
    return Object.values(objectValue).sort((a, b) => a.position-b.position);
}