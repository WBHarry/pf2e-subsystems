A Foundry VTT module for the Pathfinder Second Edition (PF2E) system. It adds handling for the various subsystems.
## For Modules wanting to add Subsystem Events
There's a simple automatic process for modules to register their Subsystem events.
1) Create the Subsystem Events you want to have included with your module.
2) Use the Export functionality and add all the events to get a JSON file.
![image](https://github.com/user-attachments/assets/21dda94f-fae9-4530-b255-aa034ffd085d)

3) Add the JSON directly to your module, or include the data in some other way you prefer. Registration is done using a hook and an exposed library function from the module. I did the registration with this code snippet:
```
import * as subsystemData from './subsystem-events.json' with {type: "json"};

Hooks.on('pf2e-subsystems-ready', () => {
    game.modules.get('pf2e-subsystems').lib.registerSubsystemEvents(<YOUR_MODULE_ID>, subsystemData.default);
});
```
