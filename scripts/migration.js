import { MODULE_ID } from "../data/constants";
import { currentVersion } from "./setup";

export const handleMigration = async () => {
    if (!game.user.isGM) return;

    var version = game.settings.get(MODULE_ID, "version");
    if (!version) {
        version = currentVersion;
        await game.settings.set(MODULE_ID, "version", version);
    }
};