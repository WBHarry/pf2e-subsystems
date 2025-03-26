import { MODULE_ID, SOCKET_ID } from "../data/constants";
import { updateDataModel } from "../scripts/helpers";
import { currentVersion } from "../scripts/setup";
import { socketEvent } from "../scripts/socket";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const getDefaultSelected = (event) => ({
  event: event ?? null,
  chaseObstacle: 1,
});

export default class SystemView extends HandlebarsApplicationMixin(
    ApplicationV2,
  ) {
    constructor(tab, event) {
      super({});

      this.selected = getDefaultSelected(event);

      if(tab) {
        this.tabGroups.main = tab;
      }

      this.editMode = false;

      this.onUpdateView = Hooks.on(
        socketEvent.UpdateSystemView,
        this.onUpdateSystemView.bind(this),
      );
    }

    #onKeyDown;

    get title() {
      return game.i18n.localize("PF2ESubsystems.View.Title");
    }
    
    static DEFAULT_OPTIONS = {
      tag: "form",
      id: "pf2e-subsystems-view",
      classes: [
        "pf2e-subsystems",
        "systems-view"
      ],
      position: { width: 800, height: 800 },
      actions: {
        editImage: this.editImage,
        selectEvent: this.selectEvent,
        addEvent: this.addEvent,
        editEvent: this.editEvent,
        toggleHideEvent: this.toggleHideEvent,
        startEvent: this.startEvent,
        removeEvent: this.removeEvent,
        navigateToSystem: this.navigateToSystem,
        copyStartEventLink: this.copyStartEventLink,
        /* Chases */
        addPlayerParticipants: this.addPlayerParticipants,
        addParticipant: this.addParticipant,
        editParticipant: this.editParticipant,
        removeParticipant: this.removeParticipant,
        updateParticipantObstacle: this.updateParticipantObstacle,
        updatePlayerParticipantsObstacle: this.updatePlayerParticipantsObstacle,
        addObstacle: this.addObstacle,
        removeObstacle: this.removeObstacle,
        setCurrentObstacle: this.setCurrentObstacle,
        onToggleObstacleLock: this.onToggleObstacleLock,
        updateChasePoints: this.updateChasePoints,
        /*  */
      },
      form: { handler: this.updateData, submitOnChange: true },
      window: {
        resizable: true,
      },
    };

    static PARTS = {
      systemView: {
        id: 'systemView',
        template: "modules/pf2e-subsystems/templates/system-view/systemView.hbs"
      },
      chase: {
        id: 'chase',
        template: "modules/pf2e-subsystems/templates/system-view/systems/chase/chases.hbs",
      },
    };

    tabGroups = {
      main: 'systemView',
    };

    getTabs() {
      const tabs = {
        systemView: {
          active: true,
          cssClass: '',
          group: 'main',
          id: 'systemView',
          icon: null,
          label: '',
          image: '',
          unselectable: true,
        },
        chase: {
          active: false,
          cssClass: 'chase-view',
          group: 'main',
          id: 'chase',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Events.Chase.Plural'),
          image: 'icons/skills/movement/feet-winged-boots-brown.webp',
        },
        influence: {
          active: false,
          cssClass: 'influence-view',
          group: 'main',
          id: 'influence',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Events.Influence.Plural'),
          image: 'icons/skills/social/diplomacy-handshake-yellow.webp',
          disabled: true,
        },
        research: {
          active: false,
          cssClass: 'research-view',
          group: 'main',
          id: 'research',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Events.Research.Plural'),
          image: 'icons/skills/trades/academics-merchant-scribe.webp',
          disabled: true,
        },
      };
  
      for (const v of Object.values(tabs)) {
        v.active = this.tabGroups[v.group]
          ? this.tabGroups[v.group] === v.id
          : v.active;
        v.cssClass = v.active ? `${v.cssClass} active` : "";
      }
  
      return tabs;
    }

    static editImage(_, button) {
      const current = foundry.utils.getProperty(game.settings.get(MODULE_ID, this.tabGroups.main), button.dataset.path);
      const fp = new FilePicker({
          current,
          type: "image",
          redirectToRoot: current ? [current] : [],
          callback: async path => {
            await updateDataModel(this.tabGroups.main, { [button.dataset.path]: path });
            this.updateView();
          },
          top: this.position.top + 40,
          left: this.position.left + 10
      });
      return fp.browse();
    }

    static selectEvent(_, button){
      this.selected.event = button.dataset.event;
      this.render({ parts: [this.tabGroups.main] });
    }

    async getEventDialogData(existing) {
      switch(this.tabGroups.main){
        case 'chase':
          return {  
            content: await renderTemplate("modules/pf2e-subsystems/templates/system-view/systems/chase/chaseDataDialog.hbs", { name: existing?.name, background: existing?.background }),
            title: game.i18n.localize(existing ? 'PF2ESubsystems.Chase.EditChase' : 'PF2ESubsystems.Chase.CreateChase'),
            callback: (button) => {
              const elements = button.form.elements;
              if (existing){
                return {
                  ...existing,
                  name: elements.name.value,
                  background: elements.background.value,
                }
              }

              const obstacleId = foundry.utils.randomID();
              return {
                id: foundry.utils.randomID(),
                name: elements.name.value ? elements.name.value : game.i18n.localize('PF2ESubsystems.View.NewEvent'),
                version: currentVersion,
                background: elements.background.value ? elements.background.value : 'icons/skills/movement/feet-winged-boots-glowing-yellow.webp',
                participants: {},
                obstacles: {
                  [obstacleId]: {
                    id: obstacleId,
                    img: "icons/svg/cowled.svg",
                    name: game.i18n.localize('PF2ESubsystems.Chase.NewObstacle'),
                    position: 1,
                    locked: false,
                  }
                },
                notes: {
                  player: {
                    value: '',
                  },
                  gm: {
                    value: '',
                  }
                }
              };
            },
            attachListeners: (dialog) => {
              $(dialog.element).find('[data-action="browseBackground"]').on('click', event => {
                event.preventDefault();
                const current = 'icons/svg/cowled.svg';
                new FilePicker({
                  current,
                  type: "image",
                  redirectToRoot: current ? [current] : [],
                  callback: async path => {
                    $(dialog.element).find('[name="background"]')[0].value = path;
                  },
                  top: this.position.top + 40,
                  left: this.position.left + 10
                }).browse();
              });
            },
          };
      }
    }

    async setEvent(existing){
      const dialogData = await this.getEventDialogData(existing);
      const dialogCallback = async (_, button) => {
        const updateData = dialogData.callback(button);
        await updateDataModel(this.tabGroups.main, { [`events.${updateData.id}`]: updateData });
        this.render({ parts: [this.tabGroups.main] });
      };

      const dialog = await new foundry.applications.api.DialogV2({
        buttons: [
          {
            action: "ok",
            label: game.i18n.localize('PF2ESubsystems.Basic.Confirm'),
            icon: "fas fa-check",
            callback: dialogCallback
          },
          {
            action: "cancel",
            label: game.i18n.localize('PF2ESubsystems.Basic.Cancel'),
            icon: "fa-solid fa-x",
          },
        ],
        content: dialogData.content,
        window: {
          title: dialogData.title,
        },
        position: { width: 400 },
      }).render(true);

      dialogData?.attachListeners(dialog);
    }

    static async addEvent(){
      await this.setEvent();
    }

    static async editEvent(_, button){
      const existingEvent = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      await this.setEvent(existingEvent);
    }

    static async toggleHideEvent(_, button){
      const hidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.hidden`]: !hidden });
      this.updateView();
    }

    async onStartEvent(event) {
      await updateDataModel(this.tabGroups.main, { [`events.${event}.hidden`]: false });
      await game.socket.emit(SOCKET_ID, {
        action: socketEvent.OpenSystemEvent,
        data: { tab: this.tabGroups.main, event: event },
      });
    }

    static async startEvent(_, button){
      this.onStartEvent(button.dataset.event);
    }

    static async removeEvent(_, button){
      await updateDataModel(this.tabGroups.main, { [`events.-=${button.dataset.id}`]: null });
      this.render({ parts: [this.tabGroups.main] });
    }

    static navigateToSystem(){
      this.selected = getDefaultSelected();
      this.render({ parts: [this.tabGroups.main] });
    }

    static copyStartEventLink(_, button){
      const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      const startMacro = `game.modules.get('${MODULE_ID}').macros.startEvent('${this.tabGroups.main}', '${button.dataset.event}');`;
      navigator.clipboard.writeText(startMacro).then(() => {
        ui.notifications.info(
          game.i18n.format("PF2ESubsystems.View.StartEventLinkCopied", { name: event.name }),
        );
      });
    }

    onKeyDown(event){
      if(!this.editMode && this.tabGroups.main === 'chase'){
        if(this.selected.event){
          switch(event.key) {
            case 'ArrowLeft':
              this.selected.chaseObstacle = Math.max(this.selected.chaseObstacle-1, 1);
              this.render({ parts: [this.tabGroups.main] });
              break;
            case 'ArrowRight':
              const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[this.selected.event];
              const maxObstacle = game.user.isGM ? Object.keys(event.obstacles).length : event.maxUnlockedObstacle;
              this.selected.chaseObstacle = Math.min(this.selected.chaseObstacle+1, maxObstacle);
              this.render({ parts: [this.tabGroups.main] });
              break;
          }
        }
      }
    }

    static async addPlayerParticipants(_, button){
      const currentParticipants = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].participants);
      const players = game.actors.find(x => x.type === 'party').members.filter(x => !currentParticipants.some(key => x.id === key)).reduce((acc, x, index) => {
        acc[x.id] = {
          id: x.id,
          name: x.name,
          img: x.img,
          hidden: false,
          position: currentParticipants.length + index + 1,
          player: true,
          obstacle: 1,
        };
        
        return acc;

      }, {});
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.participants`]: players });
      this.updateView();
    }

    async setParticipant(event, existing) {
      const callback = async (_, data) => {
        const elements = data.form.elements;
        if (existing){
          await updateDataModel(this.tabGroups.main, { [`events.${event.id}.participants.${existing.id}`]: {
            ...existing,
            name: elements.name.value ? elements.name.value : existing.name,
            img: elements.image.value ? elements.image.value : existing.img,
          }});
        }
        else {
          const participantId = foundry.utils.randomID();
          await updateDataModel(this.tabGroups.main, { [`events.${event.id}.participants.${participantId}`]: {
            id: participantId,
            name: elements.name.value ? elements.name.value : game.i18n.localize('PF2ESubsystems.Chase.NewParticipant'),
            img: elements.image.value ? elements.image.value : 'icons/svg/cowled.svg',
            position: Object.keys(event.participants).length + 1,
          }});
        }

        this.updateView();
      };

      const dialog = await new foundry.applications.api.DialogV2({
        buttons: [
          {
            action: "ok",
            label: game.i18n.localize('PF2ESubsystems.Basic.Confirm'),
            icon: "fas fa-check",
            callback: callback,
          },
          {
            action: "cancel",
            label: game.i18n.localize('PF2ESubsystems.Basic.Cancel'),
            icon: "fa-solid fa-x",
          },
        ],
        content: await renderTemplate("modules/pf2e-subsystems/templates/system-view/systems/chase/participantDataDialog.hbs", { name: existing?.name, image: existing?.img }),
        window: {
          title: existing ? game.i18n.localize('PF2ESubsystems.Chase.EditParticipant') : game.i18n.localize('PF2ESubsystems.Chase.CreateParticipant'),
        },
        position: { width: 400 },
      }).render(true);

      $(dialog.element).find('[data-action="browseParticipantImage"]').on('click', event => {
        event.preventDefault();
        const current = existing?.img ?? 'icons/svg/cowled.svg';
        new FilePicker({
          current,
          type: "image",
          redirectToRoot: current ? [current] : [],
          callback: async path => {
            $(dialog.element).find('[name="image"]')[0].value = path;
          },
          top: this.position.top + 40,
          left: this.position.left + 10
        }).browse();
      });
    } 

    editParticipant(event) {
      this.setParticipant();
    }

    static async addParticipant(_, button){
      this.setParticipant(game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event]);
    }

    static async editParticipant(_, button){
      const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      const existing = event.participants[button.dataset.participant];

      this.setParticipant(event, existing);
    }

    static async removeParticipant(_, button){
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.participants.-=${button.dataset.participant}`]: null });
      this.updateView();
    }

    static async updateParticipantObstacle(_, button) {
      const obstacle = !Number.isNaN(button.dataset.obstacle) ? Number.parseInt(button.dataset.obstacle) : null;
      if(obstacle === null) return;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.participants.${button.dataset.id}.obstacle`]: obstacle});
      this.updateView();
    }

    static async updatePlayerParticipantsObstacle(_, button) {
      const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      const participantsUpdate = Object.values(event.participants).reduce((acc, x) => {
        if(button.dataset.player ? x.player : !x.player) {
          acc[x.id] = {
            ...x,
            obstacle: button.dataset.increase ? Math.min(x.obstacle + 1, Object.keys(event.obstacles).length) : Math.max(x.obstacle - 1, 1),
          };
        }

        return acc;
      }, {});
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.participants`]: participantsUpdate});
      this.updateView();
    }

    static async addObstacle(_, button) {
      const newId = foundry.utils.randomID();
      const currentObstacles = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].obstacles).length;
      const newPosition = currentObstacles+1;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.obstacles.${newId}`]: {
        id: newId,
        img: "icons/svg/cowled.svg",
        name: game.i18n.localize('PF2ESubsystems.Chase.NewObstacle'),
        position: currentObstacles+1,
        locked: true,
      }});

      this.selected.chaseObstacle = newPosition;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async removeObstacle(_, button) {
      const chases = game.settings.get(MODULE_ID, this.tabGroups.main);
      const removedPosition = chases.events[button.dataset.event].obstacles[button.dataset.obstacle].position;
      const obstacles = Object.keys(chases.events[button.dataset.event].obstacles).reduce((acc, x) => {
        const obstacle = chases.events[button.dataset.event].obstacles[x];
        if(obstacle.id !== button.dataset.obstacle) {
          acc[x] = {
            ...obstacle,
            position: obstacle.position > removedPosition ? obstacle.position -1 : obstacle.position,
          };
        }

        return acc;
      }, {});

      const participants = Object.values(chases.events[button.dataset.event].participants).reduce((acc, x) => {
        if(x.obstacle >= removedPosition) {
          acc[x.id] = {
            ...x,
            obstacle: x.obstacle === removedPosition ? removedPosition - 1 : x.obstacle - 1,
          }
        }

        return acc;
      }, {});

      await chases.updateSource({ [`events.${button.dataset.event}.obstacles.-=${button.dataset.obstacle}`]: null });
      await chases.updateSource({ [`events.${button.dataset.event}`]: {
        obstacles: obstacles,
        participants: participants,
      } }, { diff: false });

      await game.settings.set(MODULE_ID, this.tabGroups.main, chases);

      this.selected.chaseObstacle = Math.min(this.selected.chaseObstacle, Object.keys(obstacles).length);
      this.updateView();
    }

    static setCurrentObstacle(_, button) {
      this.selected.chaseObstacle = Number.parseInt(button.dataset.position);
      this.render({ parts: [this.tabGroups.main] });
    }

    static async onToggleObstacleLock(event) {
      await this.toggleObstacleLock(undefined, event.srcElement);
    }

    async toggleObstacleLock(e, baseButton) {
      const button = baseButton ?? e.currentTarget;
      const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      const currentObstacle = Object.values(event.obstacles).find(x => x.position === Number.parseInt(button.dataset.position));

      if(currentObstacle.position === 1) {
        ui.notifications.error(game.i18n.localize('PF2ESubsystems.Chase.Errors.LockFirstObstacle'));
        return;
      }

      if(currentObstacle.locked){
        if(currentObstacle.position > event.maxUnlockedObstacle+1) {
          ui.notifications.error(game.i18n.localize('PF2ESubsystems.Chase.Errors.UnlockObstacle'));
          return;
        }
      }
      else {
        if(currentObstacle.position < event.minLockedObstacle-1) {
          ui.notifications.error(game.i18n.localize('PF2ESubsystems.Chase.Errors.LockObstacle'));
          return;
        }
      }

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.obstacles.${currentObstacle.id}.locked`]: !currentObstacle.locked });
      this.updateView();
    }

    static async updateChasePoints(_, button) {
      const currentChasePoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].obstacles[button.dataset.obstacle].chasePoints.current;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.obstacles.${button.dataset.obstacle}.chasePoints.current`]: button.dataset.increase ? currentChasePoints+1 : currentChasePoints-1 });
      this.updateView();
    }

    _attachPartListeners(partId, htmlElement, options) {
      super._attachPartListeners(partId, htmlElement, options);

      switch(partId){
        case 'chase':
          $(htmlElement).find('.radio-button').on('contextmenu', this.toggleObstacleLock.bind(this));
          $(htmlElement).find('.chase-event-chase-points-container input').on('change', this.updateObstacleChasePoints.bind(this));
          break;
      }
    }

    async updateObstacleChasePoints(event) {
      event.stopPropagation();
      const button = event.currentTarget;
      const newChasePoints = Number.parseInt(button.value);
      if(!Number.isNaN(newChasePoints)){
        const currentChasePoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].obstacles[button.dataset.obstacle].chasePoints;
        await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}`]: {
          [`obstacles.${button.dataset.obstacle}.chasePoints`]: {
            goal: newChasePoints,
            current: Math.min(currentChasePoints.current, newChasePoints),
          },
        }})
      }

      this.updateView();
    }

    _onFirstRender(context, options) {
      if ( !this.#onKeyDown ) {
        this.#onKeyDown = this.onKeyDown.bind(this);
        document.addEventListener('keydown', this.#onKeyDown);
      }
  
    }

    async close(options={}) {
      if ( this.#onKeyDown ) {
        document.removeEventListener("keydown", this.#onKeyDown);
        this.#onKeyDown = undefined;
      }

      await super.close(options);
    }

    async _preparePartContext(partId, context) {
      switch(partId){
        case 'systemView': 
          break;
        case 'chase': 
          const { events } = game.settings.get(MODULE_ID, 'chase');
          
          context.events = events;
          context.tab = context.systems.chase;
          context.selectedEvent = context.selected.event ? Object.values(events).find(x => x.id === context.selected.event) : undefined;
          if(context.selectedEvent) {
            context.selectedEvent.enrichedPremise = await TextEditor.enrichHTML(context.selectedEvent.premise);
          }
          
          context.currentObstacleNr = this.selected.chaseObstacle ?? 1;
          context.currentObstacle = context.selectedEvent?.obstacles ? Object.values(context.selectedEvent.extendedObstacles).find(x => x.position === context.currentObstacleNr) : null;
          if(context.currentObstacle) {
            context.currentObstacle.enrichedOvercome = await TextEditor.enrichHTML(context.currentObstacle.overcome);
          }

          break;
      }

      return context;
    }

    // !!V13!!
    //   configureRenderParts(){
    //     const parts = super._configureRenderParts();
    //     return parts;
    // }

    // _configureRenderOptions(options) {
    //   super._configureRenderOptions(options);

    //   switch(this.selected.system){
    //     case 'chase':
    //       options.parts = ['chase'];
    //       break;
    //     default:
    //       options.parts = ['systemView'];
    //       break;
    //   }
    // }

    // Could do something here to avoid loading all the different game.settings initially.
    async _preFirstRender(context, options) {
      await super._preFirstRender(context, options);
    }

    async updateView(){
      await game.socket.emit(SOCKET_ID, {
        action: socketEvent.UpdateSystemView,
        data: { tab: this.tabGroups.main },
      });

      Hooks.callAll(socketEvent.UpdateSystemView, this.tabGroups.main);
    }

    async _prepareContext(_options) {
      var context = await super._prepareContext(_options);

      context.isGM = game.user.isGM;
      context.systems = this.getTabs();
      context.selected = this.selected;
      context.editMode = this.editMode;

      return context;
    }

    onUpdateSystemView(tab){
      if(this.tabGroups.main === tab){
        if(this.selected.event) {
          const nrObstacles = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[this.selected.event].obstacles).length;
          this.selected.chaseObstacle = this.selected.chaseObstacle > nrObstacles ? this.selected.chaseObstacle-1 : this.selected.chaseObstacle; 
        }
        
        this.render({ parts: [this.tabGroups.main] });
      }
    }

    static async updateData(event, element, formData) {
      const { selected, editMode, events }= foundry.utils.expandObject(formData.object);
      this.selected = foundry.utils.mergeObject(this.selected, selected);
      this.editMode = editMode;

      await updateDataModel(this.tabGroups.main, { events });
      this.updateView();
    }
};