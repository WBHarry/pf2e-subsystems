import { MODULE_ID } from "../data/constants";

export async function updateDataModel(setting, data){
    const currentSetting = game.settings.get(MODULE_ID, setting);
    currentSetting.updateSource(data);
    await game.settings.set(MODULE_ID, setting, currentSetting);
}