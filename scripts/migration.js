import { MODULE_ID, subsystems } from "../data/constants";

export const subsystemFolder = "PF2e Subsystems";

export const handleMigration = async () => {
    // await setupJournalStructure();
};

const setupJournalStructure = async () => {
    var subsystemFolders = game.settings.get(MODULE_ID, "subsystems-folders");
    if (!subsystemFolders.base || !game.folders.get(subsystemFolders.base)) {
        subsystemFolders.base = (await Folder.create({
        name: subsystemFolder,
        type: "JournalEntry",
      })).id;
    }

    for(var system of Object.values(subsystems)){
        if(subsystemFolders[system.id] && game.folders.get(subsystemFolders[system.id])) continue;

        var subFolder = await Folder.create({
            name: game.i18n.localize(system.label),
            type: "JournalEntry",
            folder: subsystemFolders.base
        });

        subsystemFolders[system.id] = subFolder.id;
    }
    
    await game.settings.set(
        MODULE_ID,
        "subsystems-folders",
        subsystemFolders,
        { diff: false },
    );
};
  