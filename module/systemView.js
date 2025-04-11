import { dcAdjustments, defaultInfiltrationPreparations, degreesOfSuccess, MODULE_ID, settingIDs, SOCKET_ID, timeUnits } from "../data/constants";
import { copyToClipboard, getDCAdjustmentNumber, getSelfDC, setupTagify, translateSubsystem, updateDataModel } from "../scripts/helpers";
import { currentVersion } from "../scripts/setup";
import { socketEvent } from "../scripts/socket";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const getDefaultSelected = (event) => ({
  event: event ?? null,
  chaseObstacle: 1,
  research: {},
  infiltration: { 
    currentObjective: 1,
    preparations: {
      openActivity: 1,
    } 
  } ,
});

const getDefaultLayout = (event) => ({
  infiltration: {
    preparations: 0,
  }
});

export default class SystemView extends HandlebarsApplicationMixin(
    ApplicationV2,
  ) {
    constructor(tab, event, isTour) {
      super({});

      this.selected = getDefaultSelected(event);
      this.layout = getDefaultLayout();
      this.eventSearchValue = "";

      if(tab) {
        this.tabGroups.main = tab;
      }

      this.editMode = false;
      this.clipboardFallback = false;
      this.isTour = isTour;

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
        editEventToggle: this.editEventToggle,
        toggleHideEvent: this.toggleHideEvent,
        startEvent: this.startEvent,
        removeEvent: this.removeEvent,
        navigateToSystem: this.navigateToSystem,
        copyStartEventLink: this.copyStartEventLink,
        closeClipboardFallback: this.closeClipboardFallback,
        startEventTour: this.startEventTour,
        /* Chases */
        researchUpdateRoundsCurrent: this.researchUpdateRoundsCurrent,
        addPlayerParticipants: this.addPlayerParticipants,
        addParticipant: this.addParticipant,
        editParticipant: this.editParticipant,
        removeParticipant: this.removeParticipant,
        toggleParticipantHasActed: this.toggleParticipantHasActed,
        updateParticipantObstacle: this.updateParticipantObstacle,
        updatePlayerParticipantsObstacle: this.updatePlayerParticipantsObstacle,
        addObstacle: this.addObstacle,
        removeObstacle: this.removeObstacle,
        setCurrentObstacle: this.setCurrentObstacle,
        onToggleObstacleLock: this.onToggleObstacleLock,
        updateChasePoints: this.updateChasePoints,
        /* Research */
        researchUpdateTimeLimitCurrent: this.researchUpdateTimeLimitCurrent,
        addResearchBreakpoint: this.addResearchBreakpoint,
        researchUpdateResearchPoints: this.researchUpdateResearchPoints,
        removeResearchBreakpoint: this.removeResearchBreakpoint,
        toggleResearchBreakpointHidden: this.toggleResearchBreakpointHidden,
        toggleResearchOpenResearchBreakpoint: this.toggleResearchOpenResearchBreakpoint,
        addResearchCheck: this.addResearchCheck,
        removeResearchCheck: this.removeResearchCheck,
        toggleResearchCheckHidden: this.toggleResearchCheckHidden,
        researchToggleOpenResearchCheck: this.researchToggleOpenResearchCheck,
        researchAddResearchCheckSkillCheck: this.researchAddResearchCheckSkillCheck,
        researchRemoveResearchCheckSkillCheck: this.researchRemoveResearchCheckSkillCheck,
        researchToggleResearchCheckSkillCheckHidden: this.researchToggleResearchCheckSkillCheckHidden,
        researchAddSkill: this.researchAddSkill,
        researchRemoveSkillCheck: this.researchRemoveSkillCheck,
        researchRemoveSkill: this.researchRemoveSkill,
        addResearchEvent: this.addResearchEvent,
        removeResearchEvent: this.removeResearchEvent,
        toggleResearchEventHidden: this.toggleResearchEventHidden,
        researchToggleOpenResearchEvent: this.researchToggleOpenResearchEvent,
        /* Infiltration */
        setCurrentInfiltrationObjective: this.setCurrentInfiltrationObjective,
        addInfiltrationObjective: this.addInfiltrationObjective,
        removeInfiltrationObjective: this.removeInfiltrationObjective,
        addInfiltrationObstacle: this.addInfiltrationObstacle,
        removeInfiltrationObstacle: this.removeInfiltrationObstacle,
        infiltrationObstaclePointsUpdate: this.infiltrationObstaclePointsUpdate,
        infiltrationObstacleIndividualPointsUpdate: this.infiltrationObstacleIndividualPointsUpdate,
        infiltrationAddObstacleSkill: this.infiltrationAddObstacleSkill,
        infiltrationRemoveObstacleSkill: this.infiltrationRemoveObstacleSkill,
        infiltrationObstacleToggleAdjustment: this.infiltrationObstacleToggleAdjustment,
        infiltrationToggleOpenObstacle: this.infiltrationToggleOpenObstacle,
        infiltrationToggleObjectiveHidden: this.infiltrationToggleObjectiveHidden,
        infiltrationToggleObstacleHidden: this.infiltrationToggleObstacleHidden,
        addInfiltrationAwarenessBreakpoint: this.addInfiltrationAwarenessBreakpoint,
        infiltrationToggleOpenAwarenessBreakpoint: this.infiltrationToggleOpenAwarenessBreakpoint,
        infiltrationToggleHideAwarenessBreakpoint: this.infiltrationToggleHideAwarenessBreakpoint,
        infiltrationRemoveAwarenessBreakpoint: this.infiltrationRemoveAwarenessBreakpoint,
        infiltrationToggleAwarenessBreakpointInUse: this.infiltrationToggleAwarenessBreakpointInUse,
        addInfiltrationOpportunity: this.addInfiltrationOpportunity,
        addInfiltrationComplication: this.addInfiltrationComplication,
        infiltrationToggleOpportunityHidden: this.infiltrationToggleOpportunityHidden,
        infiltrationToggleOpenOpportunity: this.infiltrationToggleOpenOpportunity,
        infiltrationToggleComplicationHidden: this.infiltrationToggleComplicationHidden,
        infiltrationToggleOpenComplication: this.infiltrationToggleOpenComplication,
        removeInfiltrationOpportunity: this.removeInfiltrationOpportunity,
        removeInfiltrationComplication: this.removeInfiltrationComplication,
        infiltrationUpdateAwarenessPoints: this.infiltrationUpdateAwarenessPoints,
        infiltrationUpdateHiddenAwarenessPoints: this.infiltrationUpdateHiddenAwarenessPoints,
        infiltrationAddComplicationSkill: this.infiltrationAddComplicationSkill,
        infiltrationRemoveComplicationSkill: this.infiltrationRemoveComplicationSkill,
        infiltrationComplicationResultSelect: this.infiltrationComplicationResultSelect,
        infiltrationComplicationResultToggle: this.infiltrationComplicationResultToggle,
        infiltrationComplicationToggleResultsOutcome: this.infiltrationComplicationToggleResultsOutcome,
        infiltrationComplicationToggleAdjustment: this.infiltrationComplicationToggleAdjustment,
        complicationInfiltrationPointsUpdate: this.complicationInfiltrationPointsUpdate,
        infiltrationPreparationsActivityAdd: this.infiltrationPreparationsActivityAdd,
        infiltrationPreparationsActivityRemove: this.infiltrationPreparationsActivityRemove,
        infiltrationPreparationsActivitiesReset: this.infiltrationPreparationsActivitiesReset,
        setInfiltrationPreparationLayout: this.setInfiltrationPreparationLayout,
        infiltrationPreparationsToggleIsUsed: this.infiltrationPreparationsToggleIsUsed,
        infiltrationPreparationsToggleOpenActivity: this.infiltrationPreparationsToggleOpenActivity,
        infiltrationAddActivitySkill: this.infiltrationAddActivitySkill,
        infiltrationRemoveActivitySkill: this.infiltrationRemoveActivitySkill,
        infiltrationActivityToggleAdjustment: this.infiltrationActivityToggleAdjustment,
        infiltrationActivityResultToggle: this.infiltrationActivityResultToggle,
        infiltrationActivityResultSelect: this.infiltrationActivityResultSelect,
        infiltrationActivityIncreaseResultsOutcome: this.infiltrationActivityIncreaseResultsOutcome,
        infiltrationToggleOpenEdge: this.infiltrationToggleOpenEdge,
        infiltrationToggleEdgeFaked: this.infiltrationToggleEdgeFaked,
        infiltrationToggleEdgeUsed: this.infiltrationToggleEdgeUsed,
        infiltrationEdgeRemove: this.infiltrationEdgeRemove,
      },
      form: { handler: this.updateData, submitOnChange: true },
      window: {
        resizable: true,
      },
      dragDrop: [
        { dragSelector: null, dropSelector: ".participants-outer-container" },
      ],
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
      research: {
        id: 'research',
        template: "modules/pf2e-subsystems/templates/system-view/systems/research/researches.hbs",
      },
      infiltration: {
        id: 'infiltration',
        template: "modules/pf2e-subsystems/templates/system-view/systems/infiltration/infiltrations.hbs",
        scrollable: [
          ".event-main-container",
        ],
      },
    };

    _onRender(context, options) {
      this._dragDrop = this._createDragDropHandlers.bind(this)();
    }

    tabGroups = {
      main: 'systemView',
      influenceResearchChecks: 'description',
      infiltration: 'infiltration',
      infiltrationObstacleSkills: 'description',
      infiltrationComplication: 'description',
      infiltrationActivity: 'description',
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
        // influence: {
        //   active: false,
        //   cssClass: 'influence-view',
        //   group: 'main',
        //   id: 'influence',
        //   icon: null,
        //   label: game.i18n.localize('PF2ESubsystems.Events.Influence.Plural'),
        //   image: 'icons/skills/social/diplomacy-handshake-yellow.webp',
        //   disabled: true,
        // },
        research: {
          active: false,
          cssClass: 'research-view',
          group: 'main',
          id: 'research',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Events.Research.Plural'),
          image: 'icons/skills/trades/academics-merchant-scribe.webp',
        },
        infiltration: {
          active: false,
          cssClass: 'infiltration-view',
          group: 'main',
          id: 'infiltration',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Events.Infiltration.Plural'),
          image: 'icons/magic/unholy/silhouette-robe-evil-power.webp',
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

    getResearchSkillCheckTabs() {
      const tabs = {
        description: {
          active: true,
          cssClass: '',
          group: 'influenceResearchChecks',
          id: 'description',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Research.ResearchCheckTab.Description'),
        },
        skillChecks: {
          active: true,
          cssClass: '',
          group: 'influenceResearchChecks',
          id: 'skillChecks',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Research.ResearchCheckTab.SkillChecks'),
        }
      };
  
      for (const v of Object.values(tabs)) {
        v.active = this.tabGroups[v.group]
          ? this.tabGroups[v.group] === v.id
          : v.active;
        v.cssClass = v.active ? `${v.cssClass} active` : "";
      }
  
      return tabs;
    }

    getInfiltrationTabs() {
      const tabs = {
        infiltration: {
          active: true,
          cssClass: '',
          group: 'infiltration',
          id: 'infiltration',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationTab.Infiltration'),
        },
        preparation: {
          active: false,
          cssClass: '',
          group: 'infiltration',
          id: 'preparation',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationTab.Preparations'),
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

    getInfiltrationComplicationTabs() {
      const tabs = {
        description: {
          active: true,
          cssClass: '',
          group: 'infiltrationComplication',
          id: 'description',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationComplicationTab.Description'),
        },
        skillChecks: {
          active: false,
          cssClass: '',
          group: 'infiltrationComplication',
          id: 'skillChecks',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationComplicationTab.SkillChecks'),
        },
        results: {
          active: false,
          cssClass: '',
          group: 'infiltrationComplication',
          id: 'results',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationComplicationTab.Results'),
        }
      };
  
      for (const v of Object.values(tabs)) {
        v.active = this.tabGroups[v.group]
          ? this.tabGroups[v.group] === v.id
          : v.active;
        v.cssClass = v.active ? `${v.cssClass} active` : "";
      }
  
      return tabs;
    }

    getInfiltrationObstacleTabs() {
      const tabs = {
        description: {
          active: true,
          cssClass: '',
          group: 'infiltrationObstacleSkills',
          id: 'description',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationObstacleSkillsTab.Description'),
        },
        skillChecks: {
          active: false,
          cssClass: '',
          group: 'infiltrationObstacleSkills',
          id: 'skillChecks',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationObstacleSkillsTab.SkillChecks'),
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

    getInfiltrationActivityTabs() {
      const tabs = {
        description: {
          active: true,
          cssClass: '',
          group: 'infiltrationActivity',
          id: 'description',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationActivityTab.Description'),
        },
        skillChecks: {
          active: false,
          cssClass: '',
          group: 'infiltrationActivity',
          id: 'skillChecks',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationActivityTab.SkillChecks'),
        },
        results: {
          active: false,
          cssClass: '',
          group: 'infiltrationActivity',
          id: 'results',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Infiltration.InfiltrationActivityTab.Results'),
        }
      };
  
      for (const v of Object.values(tabs)) {
        v.active = this.tabGroups[v.group]
          ? this.tabGroups[v.group] === v.id
          : v.active;
        v.cssClass = v.active ? `${v.cssClass} active` : "";
      }
  
      return tabs;
    }
    

    changeTab(tab, group, options) {
      switch(group){
        case 'main':
          this.selected = getDefaultSelected();
          break;
        case 'influenceResearchChecks':
          break;
        case 'infiltration':
          break;
        case 'infiltrationObstacleSkills':
          break;
        case 'infiltrationComplication':
          break;
        case  'infiltrationActivity':
          break;
      }

      super.changeTab(tab, group, options);
    }

    static editImage(_, button) {
      const current = foundry.utils.getProperty(game.settings.get(MODULE_ID, this.tabGroups.main), button.dataset.path);
      const fp = new FilePicker({
          current,
          type: "image",
          redirectToRoot: current ? [current] : [],
          callback: async path => {
            await updateDataModel(this.tabGroups.main, { [button.dataset.path]: path });
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

    filePickerListener(dialog) {
      return $(dialog.element).find('[data-action="browseBackground"]').on('click', event => {
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
                    name: game.i18n.localize('PF2ESubsystems.View.NewObstacle'),
                    position: 1,
                    locked: false,
                  }
                },
              };
            },
            attachListeners: this.filePickerListener.bind(this),
          };
        case 'research':
          return {  
            content: await renderTemplate("modules/pf2e-subsystems/templates/system-view/systems/chase/chaseDataDialog.hbs", { name: existing?.name, background: existing?.background }),
            title: game.i18n.localize(existing ? 'PF2ESubsystems.Research.EditResearch' : 'PF2ESubsystems.Research.CreateResearch'),
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
                background: elements.background.value ? elements.background.value : 'icons/skills/trades/academics-merchant-scribe.webp',
              };
            },
            attachListeners: this.filePickerListener.bind(this),
          };
        case 'infiltration':
          return {  
            content: await renderTemplate("modules/pf2e-subsystems/templates/system-view/systems/chase/chaseDataDialog.hbs", { name: existing?.name, background: existing?.background }),
            title: game.i18n.localize(existing ? 'PF2ESubsystems.Infiltration.EditInfiltration' : 'PF2ESubsystems.Infiltration.CreateInfiltration'),
            callback: (button) => {
              const elements = button.form.elements;
              if (existing){
                return {
                  ...existing,
                  name: elements.name.value,
                  background: elements.background.value,
                }
              }

              const objectiveId = foundry.utils.randomID();

              return {
                id: foundry.utils.randomID(),
                name: elements.name.value ? elements.name.value : game.i18n.localize('PF2ESubsystems.View.NewEvent'),
                version: currentVersion,
                background: elements.background.value ? elements.background.value : 'icons/magic/unholy/silhouette-robe-evil-power.webp',
                awarenessPoints: {
                  current: 0,
                  breakpoints: game.settings.get(MODULE_ID, settingIDs.infiltration.settings).defaultAwarenessBreakpoints,
                },
                objectives: {
                  [objectiveId]: {
                    id: objectiveId,
                    name: game.i18n.localize('PF2ESubsystems.Infiltration.NewObjective'),
                    position: 1,
                  }
                },
                preparations: { activities: defaultInfiltrationPreparations },
              };
            },
            attachListeners: this.filePickerListener.bind(this),
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

    static editEventToggle(){
      this.editMode = !this.editMode;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async toggleHideEvent(_, button){
      const hidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.hidden`]: !hidden });
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
      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("PF2ESubsystems.View.ConfirmDeleteEventTitle"),
        content: game.i18n.format("PF2ESubsystems.View.ConfirmDeleteEventText", { type: translateSubsystem(this.tabGroups.main) }),
      });

      if(!confirmed) return;

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
      copyToClipboard(startMacro).then(() => {
        ui.notifications.info(
          game.i18n.format("PF2ESubsystems.View.StartEventLinkCopied", { name: event.name }),
        );
      }).catch(() => {
        this.clipboardFallback = startMacro;
        this.render({ parts: [this.tabGroups.main] });
      });
    }

    static closeClipboardFallback(){
      this.clipboardFallback = null;
      this.render({ parts: [this.tabGroups.main] });
    }

    static startEventTour(){
      game.tours.get(`${MODULE_ID}.pf2e-subsystems-${this.tabGroups.main}`).start();
    }

    onKeyDown(event){
      /* Obstacle navigation */
      if(!this.editMode && !this.isTour){
        switch(this.tabGroups.main){
          case 'chase':
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
            break;
          case 'infiltration':
            if(this.selected.event){
              switch(event.key) {
                case 'ArrowLeft':
                  this.selected.infiltration.currentObjective = Math.max(this.selected.infiltration.currentObjective-1, 1);
                  this.render({ parts: [this.tabGroups.main] });
                  break;
                case 'ArrowRight':
                  const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[this.selected.event];
                  const maxObjective = game.user.isGM ? Object.keys(event.objectives).length : event.maxUnlockedObjective;
                  this.selected.infiltration.currentObjective = Math.min(this.selected.infiltration.currentObjective+1, maxObjective);
                  this.render({ parts: [this.tabGroups.main] });
                  break;
              }
            }
            break;
        }
      }
    }

    static async researchUpdateRoundsCurrent(_, button) {
      const currentEvent = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      const currentValue = currentEvent.rounds.current;
      const updatedParticipants = Object.keys(currentEvent.participants).reduce((acc, key) => {
        acc[key] = { hasActed: false };
        return acc;
      }, {});  
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}`]: {
        ['rounds.current']: button.dataset.increase ? currentValue + 1 : currentValue -1,
        participants: updatedParticipants,
      }})
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
    }

    static async toggleParticipantHasActed(_, button){
      const currentHasActed = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].participants[button.dataset.participant].hasActed;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.participants.${button.dataset.participant}.hasActed`]: !currentHasActed });
    }

    static async updateParticipantObstacle(_, button) {
      const obstacle = !Number.isNaN(button.dataset.obstacle) ? Number.parseInt(button.dataset.obstacle) : null;
      if(obstacle === null) return;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.participants.${button.dataset.id}.obstacle`]: obstacle});
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
    }

    static async addObstacle(_, button) {
      const newId = foundry.utils.randomID();
      const currentObstacles = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].obstacles).length;
      const newPosition = currentObstacles+1;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.obstacles.${newId}`]: {
        id: newId,
        img: "icons/svg/cowled.svg",
        name: game.i18n.localize('PF2ESubsystems.View.NewObstacle'),
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

      await game.socket.emit(SOCKET_ID, {
        action: socketEvent.UpdateSystemView,
        data: { tab: this.tabGroups.main },
      });
  
      this.render({ parts: [this.tabGroups.main] });
    }

    static setCurrentObstacle(_, button) {
      this.selected.chaseObstacle = Number.parseInt(button.dataset.position);
      this.render({ parts: [this.tabGroups.main] });
    }

    static async onToggleObstacleLock(event) {
      await this.toggleObstacleLock(undefined, event.srcElement);
    }

    async toggleObstacleLock(e, baseButton) {
      if(!game.user.isGM) return;

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
    }

    static async updateChasePoints(_, button) {
      const currentChasePoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].obstacles[button.dataset.obstacle].chasePoints.current;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.obstacles.${button.dataset.obstacle}.chasePoints.current`]: button.dataset.increase ? currentChasePoints+1 : currentChasePoints-1 });
    }

    static async researchUpdateTimeLimitCurrent(_, button) {
      const currentValue = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].timeLimit.current;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.timeLimit.current`]: button.dataset.increase ? currentValue + 1 : currentValue -1 });
    }

    static async addResearchBreakpoint(_, button) {
      const breakpointId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchBreakpoints.${breakpointId}`]: {
        id: breakpointId,
      }});
    }

    static async researchUpdateResearchPoints(_, button) {
      const currentResearchPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchPoints;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchPoints`]: button.dataset.increase ? currentResearchPoints + 1 : currentResearchPoints - 1});
    }

    static async removeResearchBreakpoint(_, button){
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchBreakpoints.-=${button.dataset.breakpoint}`]: null});
    }

    static async toggleResearchBreakpointHidden(_, button) {
      const currentBreakpoint = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchBreakpoints[button.dataset.breakpoint];
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchBreakpoints.${button.dataset.breakpoint}.hidden`]: !currentBreakpoint.hidden })
    }

    static toggleResearchOpenResearchBreakpoint(_, button) {
      this.selected.research.openResearchBreakpoint = this.selected.research.openResearchBreakpoint === button.dataset.breakpoint ? null : button.dataset.breakpoint;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async addResearchCheck(_, button) {
      const researchCheckId = foundry.utils.randomID();
      const skillCheckId = foundry.utils.randomID();
      const skillId = foundry.utils.randomID();

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${researchCheckId}`]: {
        id: researchCheckId,
        [`skillChecks.${skillCheckId}`]: {
          id: skillCheckId,
          [`skills.${skillId}`]: {
            id: skillId,
          }
        },
      }});
    }

    static async removeResearchCheck(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.-=${button.dataset.check}`]: null });
    }

    static async toggleResearchCheckHidden(_, button) {
      const currentResearchCheckHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchChecks[button.dataset.check].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.hidden`]: !currentResearchCheckHidden });
    }

    static async researchToggleOpenResearchCheck(_, button) {
      this.selected.research.openResearchCheck = this.selected.research.openResearchCheck === button.dataset.check ? null : button.dataset.check;
      this.tabGroups.influenceResearchChecks = 'description';
      this.render({ parts: [this.tabGroups.main] });
    }

    static async researchAddResearchCheckSkillCheck(_, button) {
      const checkId = foundry.utils.randomID();
      const skillId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, {[`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.${checkId}`]: {
        id: checkId,
        skills: {
          [skillId]: {
            id: skillId,
          }
        }
      }});
    }

    static async researchRemoveResearchCheckSkillCheck(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.-=${button.dataset.skillCheck}`]: null});
    }

    static async researchToggleResearchCheckSkillCheckHidden(_, button) {
      const checkhidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchChecks[button.dataset.check].skillChecks[button.dataset.skillCheck].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.${button.dataset.skillCheck}.hidden`]: !checkhidden });
    }

    static async researchAddSkill(_, button){
      const skillId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.${button.dataset.skillCheck}.skills.${skillId}`]: {
        id: skillId,
      }})
    }

    static async researchRemoveSkillCheck(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.-=${button.dataset.skillCheck}`]: null});
    }

    static async researchRemoveSkill(_, button){
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.${button.dataset.skillCheck}.skills.-=${button.dataset.skill}`]: null});
    }

    static async addResearchEvent(_, button){
      const researchEventId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchEvents.${researchEventId}`]: {
        id: researchEventId,
      }});
    }

    static async removeResearchEvent(_, button){
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchEvents.-=${button.dataset.researchEvent}`]: null });
    }

    static async toggleResearchEventHidden(_, button){
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchEvents[button.dataset.researchEvent].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchEvents.${button.dataset.researchEvent}.hidden`]: !currentHidden });
    }

    static async researchToggleOpenResearchEvent(_, button) {
      this.selected.research.openResearchEvent = this.selected.research.openResearchEvent === button.dataset.event ? null : button.dataset.event;
      this.render({ parts: [this.tabGroups.main] });
    }

    //#region Infiltration
    static async setCurrentInfiltrationObjective(_, button) {
      this.selected.infiltration.currentObjective = Number.parseInt(button.dataset.position);
      this.render({ parts: [this.tabGroups.main] });
    }

    static async addInfiltrationObjective(_, button) {
      const newId = foundry.utils.randomID();
      const objectiveId = foundry.utils.randomID();

      const currentObjectives = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].objectives).length;
      const newPosition = currentObjectives+1;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${newId}`]: {
        id: newId,
        img: "icons/svg/cowled.svg",
        name: game.i18n.localize('PF2ESubsystems.Infiltration.NewObjective'),
        position: currentObjectives+1,
        hidden: true,
        objectives: {
          [objectiveId]: {
            id: objectiveId,
            name: game.i18n.localize('PF2ESubsystems.Infiltration.NewObjective'),
            position: newPosition,
          }
        }
      }});

      this.selected.infiltration.currentObjective = newPosition;
    }


    static async removeInfiltrationObjective(_, button) {
      const infiltrations = game.settings.get(MODULE_ID, this.tabGroups.main);
      const removedPosition = infiltrations.events[button.dataset.event].objectives[button.dataset.objective].position;
      const objectives = Object.keys(infiltrations.events[button.dataset.event].objectives).reduce((acc, x) => {
        const objective = infiltrations.events[button.dataset.event].objectives[x];
        if(objective.id !== button.dataset.objective) {
          acc[x] = {
            ...objective,
            position: objective.position > removedPosition ? objective.position -1 : objective.position,
          };
        }

        return acc;
      }, {});

      await infiltrations.updateSource({ [`events.${button.dataset.event}.objectives.-=${button.dataset.objective}`]: null });
      await infiltrations.updateSource({ [`events.${button.dataset.event}`]: {
        objectives: objectives,
      } }, { diff: false });

      await game.settings.set(MODULE_ID, this.tabGroups.main, infiltrations);

      this.selected.infiltration.currentObjective = Math.min(this.selected.infiltration.currentObjective, Object.keys(objectives).length);

      await game.socket.emit(SOCKET_ID, {
        action: socketEvent.UpdateSystemView,
        data: { tab: this.tabGroups.main },
      });
  
      this.render({ parts: [this.tabGroups.main] });
    }

    static async addInfiltrationObstacle(_, button) {
      const newId = foundry.utils.randomID();
      const skillCheckId = foundry.utils.randomID();
      const skillId = foundry.utils.randomID();

      const currentObstacles = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].objectives[button.dataset.objective].obstacles).length;
      const newPosition = currentObstacles+1;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${newId}`]: {
        id: newId,
        img: "icons/svg/cowled.svg",
        name: game.i18n.localize('PF2ESubsystems.View.NewObstacle'),
        position: currentObstacles+1,
        locked: true,
        [`skillChecks.${skillCheckId}`]: {
          id: skillCheckId,
          [`skills.${skillId}`]: {
            id: skillId,
          }
        },
      }});

      this.selected.chaseObstacle = newPosition;
      this.render({ parts: [this.tabGroups.main] });
    }
    
    static async removeInfiltrationObstacle(_, button) {
      const infiltrations = game.settings.get(MODULE_ID, this.tabGroups.main);
      const removedPosition = infiltrations.events[button.dataset.event].objectives[button.dataset.objective].obstacles[button.dataset.obstacle].position;
      const obstacles = Object.keys(infiltrations.events[button.dataset.event].objectives[button.dataset.objective].obstacles).reduce((acc, x) => {
        const obstacle = infiltrations.events[button.dataset.event].objectives[button.dataset.objective].obstacles[x];
        if(obstacle.id !== button.dataset.obstacle) {
          acc[x] = {
            ...obstacle,
            position: obstacle.position > removedPosition ? obstacle.position -1 : obstacle.position,
          };
        }

        return acc;
      }, {});

      await infiltrations.updateSource({ [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.-=${button.dataset.obstacle}`]: null });
      await infiltrations.updateSource({ [`events.${button.dataset.event}.obejctives.${button.dataset.objective}`]: {
        obstacles: obstacles,
      } }, { diff: false });

      await game.settings.set(MODULE_ID, this.tabGroups.main, infiltrations);

      await game.socket.emit(SOCKET_ID, {
        action: socketEvent.UpdateSystemView,
        data: { tab: this.tabGroups.main },
      });
  
      this.render({ parts: [this.tabGroups.main] });
    }

    static async infiltrationObstaclePointsUpdate(_, button) {
      const currentPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].objectives[button.dataset.objective].obstacles[button.dataset.obstacle].infiltrationPoints.current;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.infiltrationPoints.current`]: button.dataset.increase ? currentPoints + 1 : currentPoints - 1 });
    }

    static async infiltrationObstacleIndividualPointsUpdate(_, button) {
      const currentPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].obstacles[button.dataset.obstacle].infiltrationPointData[button.dataset.player] ?? 0;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.obstacles.${button.dataset.obstacle}.infiltrationPointData.${button.dataset.player}`]: button.dataset.increase ? currentPoints + 1 : currentPoints - 1 });
    }

    static async infiltrationAddObstacleSkill(_, button) {
      const skillId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.skillChecks.${button.dataset.skillCheck}.skills.${skillId}`]: {
          id: skillId,
      }});
    }

    static async infiltrationRemoveObstacleSkill(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.skillChecks.${button.dataset.skillCheck}.skills.-=${button.dataset.skill}`]: null });
    }

    static async infiltrationObstacleToggleAdjustment(_, button) {
      const currentAdjustment = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].objectives[button.dataset.objective].obstacles[button.dataset.obstacle].skillChecks[button.dataset.skillCheck].selectedAdjustment;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.skillChecks.${button.dataset.skillCheck}.selectedAdjustment`]: currentAdjustment === button.dataset.adjustment ? null : button.dataset.adjustment });
    }

    static async infiltrationToggleOpenObstacle(_, button) {
      this.selected.openInfiltrationObstacle = this.selected.openInfiltrationObstacle === button.dataset.obstacle ? null : button.dataset.obstacle;
      this.tabGroups.infiltrationObstacleSkills = 'description';
      this.render({ parts: [this.tabGroups.main] }); 
    }

    async toggleObjectiveHidden(e, baseButton) {
      if (!game.user.isGM) return;

      const button = baseButton ?? e.currentTarget;
      const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      const currentObjective = Object.values(event.objectives).find(x => x.position === Number.parseInt(button.dataset.position));

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${currentObjective.id}.hidden`]: !currentObjective.hidden });
    }

    static async infiltrationToggleObjectiveHidden(_, button) {
      this.toggleObjectiveHidden();
    }

    static async infiltrationToggleObstacleHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].objectives[button.dataset.objective].obstacles[button.dataset.obstacle].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.hidden`]: !currentHidden });
    }

    static async addInfiltrationAwarenessBreakpoint(_, button) {
      const breakpointId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.awarenessPoints.breakpoints.${breakpointId}`]: {
        id: breakpointId,
      }});
    }

    static async infiltrationToggleOpenAwarenessBreakpoint(_, button) {
      this.selected.infiltration.awarenessBreakpoint = this.selected.infiltration.awarenessBreakpoint === button.dataset.breakpoint ? null : button.dataset.breakpoint;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async infiltrationToggleHideAwarenessBreakpoint(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].awarenessPoints.breakpoints[button.dataset.breakpoint].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.awarenessPoints.breakpoints.${button.dataset.breakpoint}.hidden`]: !currentHidden });
    }

    static async infiltrationRemoveAwarenessBreakpoint(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.awarenessPoints.breakpoints.-=${button.dataset.breakpoint}`]: null });
    }

    static async infiltrationToggleAwarenessBreakpointInUse(_, button) {
      const currentInUse = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].awarenessPoints.breakpoints[button.dataset.breakpoint].inUse;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.awarenessPoints.breakpoints.${button.dataset.breakpoint}.inUse`]: !currentInUse });
    }

    static async addInfiltrationOpportunity(_, button) {
      const opportunityId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.opportunities.${opportunityId}`]: {
        id: opportunityId,
        name: game.i18n.localize("PF2ESubsystems.Infiltration.NewOpportunity"),
      }});
    }

    static async addInfiltrationComplication(_, button) {
      const complicationId = foundry.utils.randomID();
      const skillCheckId = foundry.utils.randomID();
      const skillId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${complicationId}`]: {
        id: complicationId,
        name: game.i18n.localize("PF2ESubsystems.Infiltration.NewComplication"),
        [`skillChecks.${skillCheckId}`]: {
          id: skillCheckId,
          [`skills.${skillId}`]: {
            id: skillId,
          }
        },
      }});
    }

    static async infiltrationToggleOpportunityHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].opportunities[button.dataset.opportunity].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.opportunities.${button.dataset.opportunity}.hidden`]: !currentHidden });
    }

    static async infiltrationToggleOpenOpportunity(_, button) {
      this.selected.openInfiltrationOpportunity = this.selected.openInfiltrationOpportunity === button.dataset.opportunity ? null : button.dataset.opportunity;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async infiltrationToggleComplicationHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].complications[button.dataset.complication].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.hidden`]: !currentHidden });
    }

    static async infiltrationToggleOpenComplication(_, button) {
      this.selected.openInfiltrationComplication = this.selected.openInfiltrationComplication === button.dataset.complication ? null : button.dataset.complication;
      this.tabGroups.infiltrationComplication = 'description';
      this.selected.infiltration.complicationResultSelect = null;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async removeInfiltrationOpportunity(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.opportunities.-=${button.dataset.opportunity}`]: null });
    }

    static async removeInfiltrationComplication(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.-=${button.dataset.complication}`]: null });
    }

    static async infiltrationUpdateAwarenessPoints(_, button) {
      const currentPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].awarenessPoints.current;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.awarenessPoints.current`]: button.dataset.increase ? currentPoints + 1 : currentPoints - 1 });
    }

    static async infiltrationUpdateHiddenAwarenessPoints(_, button) {
      const currentHiddenPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].awarenessPoints.hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.awarenessPoints.hidden`]: button.dataset.increase ? currentHiddenPoints + 1 : currentHiddenPoints - 1 });
    }

    static async infiltrationAddComplicationSkill(_, button) {
      const skillId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.${button.dataset.skillCheck}.skills.${skillId}`]: {
          id: skillId,
      }});
    }

    static async infiltrationRemoveComplicationSkill(_, button) {
      const skillCheck = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].complications[button.dataset.complication].skillChecks[button.dataset.skillCheck];
      if(Object.keys(skillCheck.skills) === 1){
        await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.-=${button.dataset.skillCheck}`]: null });
      }
      else {
        await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.${button.dataset.skillCheck}.skills.-=${button.dataset.skill}`]: null });
      }
    }

    static async infiltrationComplicationResultSelect(_, button) {
      this.selected.infiltration.complicationResultSelect = this.selected.infiltration.complicationResultSelect === button.dataset.result ? null : button.dataset.result;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async infiltrationComplicationResultToggle(event, button) {
      event.stopPropagation();
      const currentInUse = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].complications[button.dataset.complication].results[button.dataset.result].inUse;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.results.${button.dataset.result}.inUse`]: !currentInUse });
    }

    static async infiltrationComplicationToggleResultsOutcome(_, button) {
      const currentResultsOutcome = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].complications[button.dataset.complication].resultsOutcome;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.resultsOutcome`]: currentResultsOutcome === button.dataset.result ? null : button.dataset.result });
    }
    
    static async infiltrationComplicationToggleAdjustment(_, button) {
      const currentAdjustment = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].complications[button.dataset.complication].skillChecks[button.dataset.skillCheck].selectedAdjustment;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.${button.dataset.skillCheck}.selectedAdjustment`]: currentAdjustment === button.dataset.adjustment ? null : button.dataset.adjustment });
    }

    static async complicationInfiltrationPointsUpdate(_, button) {
      const currentPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].complications[button.dataset.complication].infiltrationPoints.current;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.infiltrationPoints.current`]: button.dataset.increase ? currentPoints + 1 : currentPoints - 1 });
    }

    static async infiltrationPreparationsActivityAdd(_, button) {
      const activityId = foundry.utils.randomID();
      const skillCheckId = foundry.utils.randomID();
      const skillId = foundry.utils.randomID();

      const name = game.i18n.localize('PF2ESubsystems.Infiltration.Preparations.NewPreparationActivity');
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${activityId}`]: {
        id: activityId,
        name: name,
        edgeLabel: name,
        skillChecks: {
          [skillCheckId]: {
            id: skillCheckId,
            skills: {
              [skillId]: {
                id: skillId,
            },
            }
          }
        }
      }});
    }

    static async infiltrationPreparationsActivityRemove(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.-=${button.dataset.activity}`]: null });
    }

    static async infiltrationPreparationsActivitiesReset(_, button) {
      const infiltrations = game.settings.get(MODULE_ID, this.tabGroups.main).toObject();
      infiltrations.events[button.dataset.event].preparations.activities = defaultInfiltrationPreparations;
      await game.settings.set(MODULE_ID, this.tabGroups.main, infiltrations);
      this.render({ parts: [this.tabGroups.main] });
    }

    static async setInfiltrationPreparationLayout(_, button) {
      this.layout.infiltration.preparations = Number.parseInt(button.dataset.option);
      this.render({ parts: [this.tabGroups.main] });
    }

    static async infiltrationPreparationsToggleIsUsed(_, button) {
      const currentUses = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].preparations.usesPreparation;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.usesPreparation`]: !currentUses });
    }

    static async infiltrationPreparationsToggleOpenActivity(_, button) {
      this.selected.infiltration.preparations.openActivity = this.selected.infiltration.preparations.openActivity === button.dataset.activity ? null : button.dataset.activity;
      this.tabGroups.infiltrationActivity = 'description';
      this.selected.infiltration.preparations.resultSelect = null;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async infiltrationAddActivitySkill(_, button) {
      const skillId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.${button.dataset.skillCheck}.skills.${skillId}`]: {
          id: skillId,
      }});
    }

    static async infiltrationRemoveActivitySkill(_, button) {
      const skillCheck = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].preparations.activities[button.dataset.activity].skillChecks[button.dataset.skillCheck];
      if(Object.keys(skillCheck.skills) === 1){
        await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.-=${button.dataset.skillCheck}`]: null });
      }
      else {
        await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.${button.dataset.skillCheck}.skills.-=${button.dataset.skill}`]: null });
      }
    }

    static async infiltrationActivityToggleAdjustment(_, button) {
      const currentAdjustment = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].preparations.activities[button.dataset.activity].skillChecks[button.dataset.skillCheck].selectedAdjustment;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.${button.dataset.skillCheck}.selectedAdjustment`]: currentAdjustment === button.dataset.adjustment ? null : button.dataset.adjustment });
    }

    static async infiltrationActivityResultToggle(event, button) {
      event.stopPropagation();
      const activity = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].preparations.activities[button.dataset.activity].results[button.dataset.result];

      if(activity.inUse && activity.degreeOfSuccess === this.selected.infiltration.preparations.resultSelect) {
        this.selected.infiltration.preparations.resultSelect = null;
      }

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.results.${button.dataset.result}.inUse`]: !activity.inUse });
    }

    static async infiltrationActivityResultSelect(_, button) {
      this.selected.infiltration.preparations.resultSelect = this.selected.infiltration.preparations.resultSelect === button.dataset.result ? null : button.dataset.result;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async infiltrationActivityIncreaseResultsOutcome(_, button) {
      const activity = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].preparations.activities[button.dataset.activity];
      const totalAttempts = Object.values(activity.results).reduce((acc, curr) => {
        acc += curr.nrOutcomes;
        return acc;
      }, 0)

      if(totalAttempts === activity.maxAttempts) return;

      const edgeId = foundry.utils.randomID();
      const result = activity.results[button.dataset.result];
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}`]: {
        [`preparations.activities.${button.dataset.activity}.results.${button.dataset.result}.nrOutcomes`]: result.nrOutcomes + 1,
        edgePoints: {
          [edgeId]: {
            id: edgeId,
            faked: Boolean(result.fakeDegreeOfSuccess),
            name: activity.edgeLabel,
            originActivity: button.dataset.activity,
            originResult: `${button.dataset.result}_${result.nrOutcomes + 1}`,
            awarenessPoints: result.awarenessPoints,
            description: result.fakeDegreeOfSuccess ? activity.results[result.fakeDegreeOfSuccess].description : result.description,
            hiddenDescription: result.fakeDegreeOfSuccess ? result.description : undefined,
          }
        }
      }});
    }

    async infiltrationActivityDecreaseResultsOutcome(baseEvent) {
      const button = baseEvent.currentTarget;
      const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      const currentOutcomes = event.preparations.activities[button.dataset.activity].results[button.dataset.result].nrOutcomes

      if(currentOutcomes === 0) return;

      const edgeToRemove = Object.values(event.edgePoints).find(x => x.originActivity === button.dataset.activity && x.originResult === `${button.dataset.result}_${currentOutcomes}`);

      // new foundry.applications.api.DialogV2({
      //   buttons: [
      //     {
      //       action: "ok",
      //       label: "Remove Edge",
      //       callback: async () => {
      //         await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.edgePoints.-=${edgeToRemove.id}`]: null });
      //         await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.results.${button.dataset.result}.nrOutcomes`]: currentOutcomes - 1 });
      //       }
      //     },
      //     {
      //       action: "keep",
      //       label: "Keep Edge",
      //       callback: async () => {
      //         await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.results.${button.dataset.result}.nrOutcomes`]: currentOutcomes - 1 });
      //       }
      //     },
      //     {
      //       action: "cancel",
      //       label: "Cancel",
      //       icon: "fa-solid fa-x",
      //       default: true,
      //     },
      //   ],
      //   content: game.i18n.format("PF2ESubsystems.Infiltration.ConfirmRemoveEdgeText", { edge: edgeToRemove.name }),
      //   rejectClose: false,
      //   modal: false,
      //   position: {},
      //   window: {
      //     title: game.i18n.localize(
      //       "PF2ESubsystems.Infiltration.ConfirmRemoveEdgeTitle",
      //     ),
      //   },
      // }).render(true);

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.results.${button.dataset.result}.nrOutcomes`]: currentOutcomes - 1 });
    }

    static async infiltrationToggleOpenEdge(_, button) {
      this.selected.infiltration.openEdge = this.selected.infiltration.openEdge === button.dataset.edge ? null : button.dataset.edge;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async infiltrationToggleEdgeFaked(_, button) {
      const currentFaked = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].edgePoints[button.dataset.edge].faked;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.edgePoints.${button.dataset.edge}.faked`]: !currentFaked });
    }

    static async infiltrationToggleEdgeUsed(_, button) {
      const currentUsed = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].edgePoints[button.dataset.edge].used;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.edgePoints.${button.dataset.edge}.used`]: !currentUsed });
    }

    static async infiltrationEdgeRemove(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.edgePoints.-=${button.dataset.edge}`]: null });
    }
    //#endregion 

    async updateResearchLore(event) {
      event.stopPropagation();
      const button = event.currentTarget;
      const newLore = button.checked;
      
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        lore: newLore,
        skill: newLore ? 'something-lore' : 'acrobatics',
      }});
    }

    async updateResearchSkillCheck(event) {
      event.stopPropagation();
      const button = event.currentTarget;
      const currentLore = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchChecks[button.dataset.check].skillChecks[button.dataset.skillCheck].skills[button.dataset.skill].lore;
      let newSkill = button.value;

      if(currentLore){
        const loreMatch = newSkill.match('-lore');
        if(!loreMatch || loreMatch.length === 0) {
          newSkill = 'something-lore';
          ui.notifications.warn(game.i18n.localize('PF2ESubsystems.Research.Errors.LoreError'));
        }
      }

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        skill: newSkill,
      }});
    }

    async updateComplicationInfiltrationPoints(event) {
      event.stopPropagation();
      const button = event.currentTarget;
      const newMax = Number.parseInt(button.value);
      const complication = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].complications[button.dataset.complication];
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}`]: {
        infiltrationPoints: {
          current: Math.min(complication.infiltrationPoints.current, newMax),
          max: newMax,
        }
      }});
    }

    async updateObstacleLeveldDC(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.skillChecks.${button.dataset.skillCheck}`]: {
        difficulty: {
          leveledDC: button.checked,
          DC: button.checked ? null : 10,
        }
      }});
    }

    async updateObstacleLore(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        lore: button.checked,
        skill: button.checked ? 'something-lore' : 'acrobatics',
      }});
    }

    async updateComplicationLeveldDC(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.${button.dataset.skillCheck}`]: {
        difficulty: {
          leveledDC: button.checked,
          DC: button.checked ? null : 10,
        }
      }});
    }

    async updateInfiltrationActivityLeveldDC(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.${button.dataset.skillCheck}`]: {
        difficulty: {
          leveledDC: button.checked,
          DC: button.checked ? null : 10,
        }
      }});
    }

    async updateInfiltrationActivityLore(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        lore: button.checked,
        skill: button.checked ? 'something-lore' : 'acrobatics',
      }});
    }

    async updateComplicationLore(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        lore: button.checked,
        skill: button.checked ? 'something-lore' : 'acrobatics',
      }});
    }

    async infiltrationObstacleUpdateDCAdjustment(event) {
      const button = event.detail.tagify.DOM.originalInput;
      const value = event.detail?.value
      ? JSON.parse(event.detail.value)
      : [];
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.skillChecks.${button.dataset.skillCheck}.dcAdjustments`]: value.map(x => x.value) });
    }

    async infiltrationObstacleRemoveDCAdjustment(event) {
      const button = $(event[0].node).parent().parent().find('input.obstacle-dc-adjustment')[0];
      const settingId = this.tabGroups.main;
      return new Promise(async function (resolve) {
        const skillCheck = game.settings.get(MODULE_ID, settingId).events[button.dataset.event].objectives[button.dataset.objective].obstacles[button.dataset.obstacle].skillChecks[button.dataset.skillCheck];
        const newValue = skillCheck.dcAdjustments.filter(x => x !== event[0].data.value);
        await updateDataModel(settingId, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.skillChecks.${button.dataset.skillCheck}`]: {
          dcAdjustments: newValue,
          selectedAdjustment: skillCheck.selectedAdjustment === event[0].data.value ? null : skillCheck.selectedAdjustment,
        }});
        resolve();
      });
    }

    async infiltrationPreparationsUpdateActivityTags(event) {
      const button = event.detail.tagify.DOM.originalInput;
      const value = event.detail?.value
      ? JSON.parse(event.detail.value)
      : [];
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.tags`]: value.map(x => x.value) });
    }

    async infiltrationPreparationsRemoveActivityTags(event) {
      const button = $(event[0].node).parent().parent().find('input.infiltration-preparations-activity-tags')[0];
      const settingId = this.tabGroups.main;
      return new Promise(async function (resolve) {
        const tags = game.settings.get(MODULE_ID, settingId).events[button.dataset.event].preparations.activities[button.dataset.activity].tags;
        const newValue = tags.filter(x => x !== event[0].data.value);
        await updateDataModel(settingId, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.tags`]: newValue });
        resolve();
      });
    }
 
    async infiltrationComplicationUpdateDCAdjustment(event) {
      const button = event.detail.tagify.DOM.originalInput;
      const value = event.detail?.value
      ? JSON.parse(event.detail.value)
      : [];
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.${button.dataset.skillCheck}.dcAdjustments`]: value.map(x => x.value) });
    }

    async infiltrationComplicationRemoveDCAdjustment(event) {
      const button = $(event[0].node).parent().parent().find('input.complication-dc-adjustment')[0];
      const settingId = this.tabGroups.main;
      return new Promise(async function (resolve) {
        const skillCheck = game.settings.get(MODULE_ID, settingId).events[button.dataset.event].complications[button.dataset.complication].skillChecks[button.dataset.skillCheck];
        const newValue = skillCheck.dcAdjustments.filter(x => x !== event[0].data.value);
        await updateDataModel(settingId, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.${button.dataset.skillCheck}`]: {
          dcAdjustments: newValue,
          selectedAdjustment: skillCheck.selectedAdjustment === event[0].data.value ? null : skillCheck.selectedAdjustment,
        }});
        resolve();
      });
    }

    async infiltrationActivityUpdateDCAdjustment(event) {
      const button = event.detail.tagify.DOM.originalInput;
      const value = event.detail?.value
      ? JSON.parse(event.detail.value)
      : [];
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.${button.dataset.skillCheck}.dcAdjustments`]: value.map(x => x.value) });
    }

    async infiltrationActivityRemoveDCAdjustment(event) {
      const button = $(event[0].node).parent().parent().find('input.infiltration-activities-dc-adjustment')[0];
      const settingId = this.tabGroups.main;
      return new Promise(async function (resolve) {
        const skillCheck = game.settings.get(MODULE_ID, settingId).events[button.dataset.event].preparations.activities[button.dataset.activity].skillChecks[button.dataset.skillCheck];
        const newValue = skillCheck.dcAdjustments.filter(x => x !== event[0].data.value);
        await updateDataModel(settingId, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.${button.dataset.skillCheck}`]: {
          dcAdjustments: newValue,
          selectedAdjustment: skillCheck.selectedAdjustment === event[0].data.value ? null : skillCheck.selectedAdjustment,
        }});
        resolve();
      });
    }

    _attachPartListeners(partId, htmlElement, options) {
      super._attachPartListeners(partId, htmlElement, options);

      $(htmlElement).find('.clipboard-fallback-input').on('change', event => event.preventDefault());
      switch(partId){
        case 'chase':
          $(htmlElement).find('.radio-button').on('contextmenu', this.toggleObstacleLock.bind(this));
          $(htmlElement).find('.chase-event-chase-points-container input').on('change', this.updateObstacleChasePoints.bind(this));
          break;
        case 'research':
          $(htmlElement).find('.research-lore-input').on('change', this.updateResearchLore.bind(this));
          $(htmlElement).find('.research-skill-check-input').on('change', this.updateResearchSkillCheck.bind(this));
          break;
        case 'infiltration':
          $(htmlElement).find('.radio-button').on('contextmenu', this.toggleObjectiveHidden.bind(this));
          $(htmlElement).find('.complication-max-infiltration-pointers').on('change', this.updateComplicationInfiltrationPoints.bind(this));
          $(htmlElement).find('.obstacle-complication-leveled-DC').on('change', this.updateObstacleLeveldDC.bind(this));
          $(htmlElement).find('.infiltration-obstacle-lore').on('change', this.updateObstacleLore.bind(this));
          $(htmlElement).find('.infiltration-complication-leveled-DC').on('change', this.updateComplicationLeveldDC.bind(this));
          $(htmlElement).find('.infiltration-complication-lore').on('change', this.updateComplicationLore.bind(this));
          $(htmlElement).find('.infiltration-activity-leveled-DC').on('change', this.updateInfiltrationActivityLeveldDC.bind(this));
          $(htmlElement).find('.infiltration-activity-lore').on('change', this.updateInfiltrationActivityLore.bind(this));
          $(htmlElement).find('.infiltration-activity-result-button').on('contextmenu', this.infiltrationActivityDecreaseResultsOutcome.bind(this));

          const adjustmentOptions = Object.values(dcAdjustments);
          const tagOptions = Object.keys(CONFIG.PF2E.actionTraits).map(x => ({ value: x, name: game.i18n.localize(CONFIG.PF2E.actionTraits[x]) }));

          setupTagify(htmlElement, '.complication-dc-adjustment', adjustmentOptions, this.infiltrationComplicationUpdateDCAdjustment.bind(this), this.infiltrationComplicationRemoveDCAdjustment.bind(this));
          setupTagify(htmlElement, '.obstacle-dc-adjustment', adjustmentOptions, this.infiltrationObstacleUpdateDCAdjustment.bind(this), this.infiltrationObstacleRemoveDCAdjustment.bind(this));
          setupTagify(htmlElement, '.infiltration-preparations-activity-tags', tagOptions, this.infiltrationPreparationsUpdateActivityTags.bind(this), this.infiltrationPreparationsRemoveActivityTags.bind(this));
          setupTagify(htmlElement, '.infiltration-activity-dc-adjustment', adjustmentOptions, this.infiltrationActivityUpdateDCAdjustment.bind(this), this.infiltrationActivityRemoveDCAdjustment.bind(this));

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
    }

    _onFirstRender(context, options) {
      if ( !this.#onKeyDown ) {
        this.#onKeyDown = this.onKeyDown.bind(this);
        document.addEventListener('keydown', this.#onKeyDown);
      }
  
    }

    async close(options={}) {
      Hooks.off(socketEvent.UpdateSystemView, this.onUpdateView);
      
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
          const { events: chaseEvents } = game.settings.get(MODULE_ID, 'chase');
          
          context.settings = game.settings.get(MODULE_ID, settingIDs.chase.settings);
          context.tab = context.systems.chase;
          await this.setupEvents(chaseEvents, context);
          if(context.selectedEvent) {
            context.selectedEvent.enrichedPremise = await TextEditor.enrichHTML(context.selectedEvent.premise);
            context.showRounds = this.editMode || context.selectedEvent.rounds.max;
          }
          
          context.currentObstacleNr = this.selected.chaseObstacle ?? 1;
          context.currentObstacle = context.selectedEvent?.obstacles ? Object.values(context.selectedEvent.extendedObstacles).find(x => x.position === context.currentObstacleNr) : null;
          if(context.currentObstacle) {
            context.currentObstacle.enrichedOvercome = await TextEditor.enrichHTML(context.currentObstacle.overcome);
          }

          break;
        case 'research': 
          const { events: viewEvents } = game.settings.get(MODULE_ID, 'research');
            
          context.settings = game.settings.get(MODULE_ID, settingIDs.research.settings);
          context.tab = context.systems.research;
          context.skillCheckTabs = this.getResearchSkillCheckTabs();
          await this.setupEvents(viewEvents, context);
          if(context.selectedEvent) {
            context.selectedEvent.enrichedPremise = await TextEditor.enrichHTML(context.selectedEvent.premise);
            context.showTimeLimit = this.editMode || context.selectedEvent.timeLimit.max;
            context.selectedEvent.timeLimit.unitName = timeUnits[context.selectedEvent.timeLimit.unit]?.name;

            for(var key of Object.keys(context.selectedEvent.researchChecksData)){
              const researchCheck = context.selectedEvent.researchChecks[key];
              researchCheck.open = researchCheck.id === this.selected.research?.openResearchCheck;
              researchCheck.enrichedDescription = await TextEditor.enrichHTML(researchCheck.description);
              
              for(var checkKey of Object.keys(researchCheck.skillChecks)) {
                const checkSkill = researchCheck.skillChecks[checkKey];
                checkSkill.enrichedDescription = await TextEditor.enrichHTML(checkSkill.description);

                const skills = Object.keys(checkSkill.skills);
                for(var skillKey of skills){
                  const skillCheck = checkSkill.skills[skillKey];
                  if(skillCheck.action) {
                    skillCheck.element = await TextEditor.enrichHTML(`[[/act ${skillCheck.action} stat=${skillCheck.skill} dc=${skillCheck.dc}]]`);  
                  }
                  else {
                    skillCheck.element = await TextEditor.enrichHTML(`@Check[type:${skillCheck.skill}|dc:${skillCheck.dc}|simple:${skillCheck.simple}]`);
                  }
                  skillCheck.isFirst = skills[0] === skillCheck.id;
                }
              }
            }

            for(var key of Object.keys(context.selectedEvent.researchBreakpoints)) {
              const researchBreakpoint = context.selectedEvent.researchBreakpoints[key];
              researchBreakpoint.open = researchBreakpoint.id === this.selected.research?.openResearchBreakpoint;
              researchBreakpoint.enrichedDescription = await TextEditor.enrichHTML(researchBreakpoint.description);
            }

            for(var key of Object.keys(context.selectedEvent.researchEvents)) {
              const researchEvent = context.selectedEvent.researchEvents[key];
              researchEvent.open = researchEvent.id === this.selected.research?.openResearchEvent;
              researchEvent.enrichedDescription = await TextEditor.enrichHTML(researchEvent.description);
            }
          }

          context.revealedResearchChecks = context.selectedEvent ? Object.values(context.selectedEvent.researchChecks).filter(x => !x.hidden).length : 0;
          context.revealedResearchBreakpoints = context.selectedEvent ? Object.values(context.selectedEvent.researchBreakpoints).filter(x => !x.hidden).length : 0;

          const researchEvents = context.selectedEvent ? Object.values(context.selectedEvent.researchEvents) : [];
          const revealedResearchEvents = researchEvents.filter(x => !x.hidden);
          context.researchEventsShown = this.editMode || revealedResearchEvents.length > 0 || (game.user.isGM && researchEvents.length > 0);
          
          context.selected = this.selected.research;
          context.timeUnits = timeUnits;
          context.skillOptions = [
            ...Object.keys(CONFIG.PF2E.skills).map((skill) => ({
              value: skill,
              name: CONFIG.PF2E.skills[skill].label,
            })),
            { value: "perception", name: "PF2E.PerceptionLabel" },
          ];
          context.actionOptions = []; 
          for(var action of game.pf2e.actions) {
            context.actionOptions.push({ value: action.slug, name: game.i18n.localize(action.name) });
          }

          break;
        case 'infiltration':
          const { events: infiltrationEvents } = game.settings.get(MODULE_ID, 'infiltration');
          
          context.settings = game.settings.get(MODULE_ID, settingIDs.infiltration.settings);
          context.tab = context.systems.infiltration;
          context.infiltrationTabs = this.getInfiltrationTabs();
          context.obstacleTabs  = this.getInfiltrationObstacleTabs();
          context.complicationTabs = this.getInfiltrationComplicationTabs();
          context.activityTabs = this.getInfiltrationActivityTabs();
          context.layout = this.layout.infiltration;

          const disableRollButton = (disable, html) => {
            if(!disable) return html;
            return html.match(/style="/) ? html.replace(/style="/, 'style="opacity: 0.4; pointer-events: none; ') : html.replace(/<a/, '<a style="opacity: 0.4; pointer-events: none; "').replace(/<span/, '<span style="opacity: 0.4; pointer-events: none; "');
          } 
          
          await this.setupEvents(infiltrationEvents, context);
          if(context.selectedEvent) {
            context.selectedEvent.enrichedPremise = await TextEditor.enrichHTML(context.selectedEvent.premise);
            context.selectedEvent.extendedComplications = context.selectedEvent.complicationsData;
            context.selectedEvent.extendedPreparations = {
              ...context.selectedEvent.preparations,
              activities: context.selectedEvent.preparationsActivitiesData
            };
            context.currentObjectiveNr = (this.selected.infiltration.currentObjective ?? 1);
            const awarenessDCIncrease = context.selectedEvent.awarenessDCIncrease;

            context.currentObjective = Object.values(context.selectedEvent.objectives).find(x => x.position === context.currentObjectiveNr);
            for(var key of Object.keys(context.currentObjective.obstacles)) {
              var obstacle = context.currentObjective.obstacles[key];
              obstacle.enrichedDescription = await TextEditor.enrichHTML(obstacle.description);
              obstacle.individualInfiltrationPoints = !obstacle.individual ? [] : game.actors.find(x => x.type === 'party').members.reduce((acc, curr) => {
                acc[curr.id] = {
                  id: curr.id,
                  name: curr.name,
                  value: obstacle.infiltrationPointData[curr.id] ?? 0,
                };

                return acc;
              }, {});
              obstacle.skillChecks = Object.values(obstacle.skillChecks).reduce((acc, skillCheck) => {
                acc[skillCheck.id] = {
                  ...skillCheck,
                  columns: Object.values(skillCheck.skills).reduce((acc, skill) => {
                    acc.lore.push({ 
                      event: context.selectedEvent.id,
                      objective: context.currentObjective.id,
                      obstacle: obstacle.id,
                      skillCheck: skillCheck.id,
                      id: skill.id,
                      lore: skill.lore,
                    });
                    acc.skill.push({ 
                      event: context.selectedEvent.id,
                      objective: context.currentObjective.id,
                      obstacle: obstacle.id,
                      skillCheck: skillCheck.id,
                      id: skill.id,
                      skill: skill.skill,
                      lore: skill.lore,
                    });
                    acc.action.push({ 
                      event: context.selectedEvent.id,
                      objective: context.currentObjective.id,
                      obstacle: obstacle.id,
                      skillCheck: skillCheck.id,
                      id: skill.id,
                      action: skill.action,
                    });
                    acc.variant.push({ 
                      event: context.selectedEvent.id,
                      objective: context.currentObjective.id,
                      obstacle: obstacle.id,
                      skillCheck: skillCheck.id,
                      id: skill.id,
                      variantOptions: skill.action ? [...game.pf2e.actions.get(skill.action).variants].map(x => ({ value: x.slug, name: x.name })) : [],
                      variant: skill.variant,
                    });
    
                    return acc;
                  }, { lore: [], skill: [], action: [], variant: [] }),
                }
    
                return acc;
              }, {})
            }

            for(var key of Object.keys(context.currentObjective.obstacles)){
              var obstacle = context.currentObjective.obstacles[key];
              obstacle.open = obstacle.id === this.selected.openInfiltrationObstacle;

              for(var key of Object.keys(obstacle.skillChecks)){
                const skillCheck = obstacle.skillChecks[key];
                skillCheck.dcAdjustmentValues = skillCheck.dcAdjustments.map(x => ({
                  name: game.i18n.localize(dcAdjustments[x].name),
                  value: x,
                }));
  
                  let dc = skillCheck.difficulty.leveledDC ? getSelfDC() : skillCheck.difficulty.DC;
                dc = skillCheck.selectedAdjustment ? dc+getDCAdjustmentNumber(skillCheck.selectedAdjustment) : dc;
                dc += awarenessDCIncrease;
                const disableElement = skillCheck.dcAdjustments.length > 0 && !skillCheck.selectedAdjustment;
                for(var key of Object.keys(skillCheck.skills)){
                  const skill = skillCheck.skills[key];
                  if(skill.action) {
                    skill.element = disableRollButton(disableElement, await TextEditor.enrichHTML(`[[/act ${skill.action} ${skill.variant ? `variant=${skill.variant} ` : ''}stat=${skill.skill} dc=${dc}]]`));  
                  }
                  else {
                    skill.element = disableRollButton(disableElement, await TextEditor.enrichHTML(`@Check[type:${skill.skill}|dc:${dc}|simple:${skill.simple}]`));
                  }
                }
              }
            }

            for(var key of Object.keys(context.selectedEvent.edgePoints)){
              const edgePoint = context.selectedEvent.edgePoints[key];
              edgePoint.open = this.selected.infiltration.openEdge === edgePoint.id;

              edgePoint.enrichedDescription = await TextEditor.enrichHTML(edgePoint.description);
              edgePoint.enrichedHiddenDescription = edgePoint.hiddenDescription ? await TextEditor.enrichHTML(edgePoint.hiddenDescription) : null;
              edgePoint.playerDescription = !edgePoint.faked && edgePoint.enrichedHiddenDescription ? edgePoint.enrichedHiddenDescription : edgePoint.enrichedDescription;
            }

            for(var key of Object.keys(context.selectedEvent.awarenessPoints.breakpoints)){
              const breakpoint = context.selectedEvent.awarenessPoints.breakpoints[key];
              breakpoint.description = game.i18n.localize(breakpoint.description);
              breakpoint.enrichedDescription = await TextEditor.enrichHTML(breakpoint.description);
              breakpoint.open = this.selected.infiltration.awarenessBreakpoint === breakpoint.id;
              breakpoint.active = context.settings.autoApplyAwareness ? (context.selectedEvent.visibleAwareness) >= breakpoint.breakpoint : breakpoint.inUse;
              breakpoint.showActivate = (game.user.isGM && !context.settings.autoApplyAwareness) || breakpoint.inUse;
              breakpoint.playerHidden = context.settings.autoRevealAwareness ? context.selectedEvent.awarenessPoints.current < breakpoint.breakpoint : breakpoint.hidden;
              breakpoint.hideable = game.user.isGM && !context.settings.autoRevealAwareness && !context.editMode;
            }

            for(var key of Object.keys(context.selectedEvent.opportunities)){
              var opportunity = context.selectedEvent.opportunities[key];
              opportunity.open = this.selected.openInfiltrationOpportunity === opportunity.id;
              opportunity.enrichedDescription = await TextEditor.enrichHTML(opportunity.description);
            }

            for(var key of Object.keys(context.selectedEvent.extendedComplications)){
              const complication = context.selectedEvent.extendedComplications[key];
              complication.open = this.selected.openInfiltrationComplication === complication.id;
              complication.enrichedDescription = await TextEditor.enrichHTML(complication.description);

              for(var key of Object.keys(complication.skillChecks)){
                const skillCheck = complication.skillChecks[key];
                skillCheck.dcAdjustmentValues = skillCheck.dcAdjustments.map(x => ({
                  name: game.i18n.localize(dcAdjustments[x].name),
                  value: x,
                }));

                let dc = skillCheck.difficulty.leveledDC ? getSelfDC() : skillCheck.difficulty.DC;
                dc = skillCheck.selectedAdjustment ? dc+getDCAdjustmentNumber(skillCheck.selectedAdjustment) : dc;
                dc += awarenessDCIncrease;
                const disableElement = skillCheck.dcAdjustments.length > 0 && !skillCheck.selectedAdjustment;
                for(var key of Object.keys(skillCheck.skills)){
                  const skill = skillCheck.skills[key];
                  if(skill.action) {
                    skill.element = disableRollButton(disableElement, await TextEditor.enrichHTML(`[[/act ${skill.action} ${skill.variant ? `variant=${skill.variant} ` : ''}stat=${skill.skill} dc=${dc}]]`));  
                  }
                  else {
                    skill.element = disableRollButton(disableElement, await TextEditor.enrichHTML(`@Check[type:${skill.skill}|dc:${dc}|simple:${skill.simple}]`));
                  }
                }
              }

              for(var key of Object.keys(complication.results)) {
                var result = complication.results[key];
                result.name = game.i18n.localize(degreesOfSuccess[result.degreeOfSuccess].name);
                result.selected = this.selected.infiltration.complicationResultSelect === result.degreeOfSuccess;

                const titleElement = `<p><strong class="infiltration-result-container ${complication.resultsOutcome !== result.degreeOfSuccess ? 'inactive' : ''} ${context.isGM ? 'clickable-icon' : ''} tertiary-container primary-text-container infiltration-activity-result-button" ${context.isGM ? 'data-action="infiltrationComplicationToggleResultsOutcome"' : ''} data-event="${context.selectedEvent.id}" data-complication="${complication.id}" data-result="${result.degreeOfSuccess}">${result.name}</strong>`;
                const descriptionStartsWithParagraph = result.description.match(/^<p>/);
                result.enrichedDescription = await TextEditor.enrichHTML(descriptionStartsWithParagraph ? result.description.replace('<p>', `${titleElement} `) : `${titleElement} ${result.description}`);
              }

              complication.selectedResult = Object.values(complication.results).find(x => x.degreeOfSuccess === this.selected.infiltration.complicationResultSelect);
            }

            for(var key of Object.keys(context.selectedEvent.extendedPreparations.activities)) {
              var activity = context.selectedEvent.extendedPreparations.activities[key];
              activity.open = this.selected.infiltration.preparations.openActivity === activity.id;
              activity.enrichedDescription = await TextEditor.enrichHTML(activity.description);
              activity.displayTags = activity.tags.map(tag => game.i18n.localize(CONFIG.PF2E.actionTraits[tag]));

              for(var key of Object.keys(activity.skillChecks)){
                var skillCheck = activity.skillChecks[key];
                skillCheck.dcAdjustmentValues = skillCheck.dcAdjustments.map(x => ({
                  name: game.i18n.localize(dcAdjustments[x].name),
                  value: x,
                }));

                let dc = skillCheck.difficulty.leveledDC ? getSelfDC() : skillCheck.difficulty.DC;
                dc = skillCheck.selectedAdjustment ? dc+getDCAdjustmentNumber(skillCheck.selectedAdjustment) : dc;
                const disableElement = skillCheck.dcAdjustments.length > 0 && !skillCheck.selectedAdjustment;
                for(var key of Object.keys(skillCheck.skills)){
                  const skill = skillCheck.skills[key];
                  if(skill.action) {
                    skill.element = disableRollButton(disableElement, await TextEditor.enrichHTML(`[[/act ${skill.action} ${skill.variant ? `variant=${skill.variant} ` : ''}stat=${skill.skill} dc=${dc}]]`));  
                  }
                  else {
                    skill.element = disableRollButton(disableElement, await TextEditor.enrichHTML(`@Check[type:${skill.skill}|dc:${dc}|simple:${skill.simple}]`));
                  }
                }
              }

              for(var key of Object.keys(activity.results)) {
                var result = activity.results[key];
                result.name = game.i18n.localize(degreesOfSuccess[result.degreeOfSuccess].name);
                result.selected = this.selected.infiltration.complicationResultSelect === result.degreeOfSuccess;
                result.fakeDegrees = Object.keys(degreesOfSuccess).reduce((acc, key) => {
                  if(key !== result.degreeOfSuccess) acc[key] = degreesOfSuccess[key];
                  return acc;
                }, {});
                
                const titleElement = `<p><strong class="infiltration-result-container ${result.nrOutcomes === 0 ? 'inactive' : ''} ${context.isGM ? 'clickable-icon' : ''} tertiary-container primary-text-container infiltration-activity-result-button" ${context.isGM ? 'data-action="infiltrationActivityIncreaseResultsOutcome"' : ''} data-event="${context.selectedEvent.id}" data-activity="${activity.id}" data-result="${result.degreeOfSuccess}">${result.name} ${result.nrOutcomes}x</strong>`;
                const descriptionStartsWithParagraph = result.description.match(/^<p>/);
                result.enrichedDescription = await TextEditor.enrichHTML(descriptionStartsWithParagraph ? result.description.replace('<p>', `${titleElement} `) : `${titleElement} ${result.description}`);
              }

              activity.selectedResult = Object.values(activity.results).find(x => x.degreeOfSuccess === this.selected.infiltration.preparations.resultSelect);
            }
          }

          context.skillOptions = [
            ...Object.keys(CONFIG.PF2E.skills).map((skill) => ({
              value: skill,
              name: CONFIG.PF2E.skills[skill].label,
            })),
            { value: "perception", name: "PF2E.PerceptionLabel" },
          ];
          context.actionOptions = []; 
          for(var action of game.pf2e.actions) {
            context.actionOptions.push({ value: action.slug, name: game.i18n.localize(action.name) });
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

    async _prepareContext(_options) {
      var context = await super._prepareContext(_options);

      context.isGM = game.user.isGM;
      context.systems = this.getTabs();
      context.selected = this.selected;
      context.editMode = this.editMode;
      context.eventSearchValue = this.eventSearchValue;
      context.playerId = game.user.character?.id;
      context.clipboardFallback = this.clipboardFallback;

      return context;
    }

    filterEvents(events){
      return this.eventSearchValue?.length === 0 ? events : Object.keys(events).reduce((acc, key) => {
        const event = events[key];
        const matches = event.name.match(this.eventSearchValue);
        if(matches && matches.length > 0) acc[key] = events[key];

        return acc;
      }, {});
    }

    onUpdateSystemView(tab){
      if(this.tabGroups.main === tab){
        switch(this.tabGroups.main){
          case 'chase':
            if(this.selected.event) {
              const nrObstacles = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[this.selected.event].obstacles).length;
              this.selected.chaseObstacle = this.selected.chaseObstacle > nrObstacles ? this.selected.chaseObstacle-1 : this.selected.chaseObstacle; 
            }
            break;
          case 'infiltration':
            if(this.selected.event) {
              const nrObjectives = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[this.selected.event].objectives).length;
              this.selected.infiltration.currentObjective = this.selected.infiltration.currentObjective > nrObjectives ? this.selected.infiltration.currentObjective-1 : this.selected.infiltration.currentObjective; 
            }
            break;
        }

        this.render({ parts: [this.tabGroups.main] });
      }
    }

    static async updateData(event, element, formData) {
      const { selected, editMode, events, eventSearchValue }= foundry.utils.expandObject(formData.object);
      this.selected = foundry.utils.mergeObject(this.selected, selected);
      this.eventSearchValue = eventSearchValue;

      await updateDataModel(this.tabGroups.main, { events });
    }

    async setupEvents(chaseEvents, context){
      if(!this.isTour){
        await Promise.resolve(new Promise((resolve) => {
          context.events = this.filterEvents(chaseEvents);
          context.selectedEvent = context.selected.event ? Object.values(context.events).find(x => x.id === context.selected.event) : undefined;
          resolve();
        }));
      }
      else {
        await Promise.resolve(
        fetch(`../modules/${MODULE_ID}/tours/${this.tabGroups.main}/${this.tabGroups.main}-tour.json`)
          .then(res => res.json())
          .then(json => {
            context.events = json.events;
            context.selectedEvent = context.selected.event ? Object.values(context.events).find(x => x.id === context.selected.event) : undefined;
          }));
      }
    }

    _createDragDropHandlers() {
      return this.options.dragDrop.map((d) => {
        d.callbacks = {
          drop: this._onDrop.bind(this),
        };
  
        const newHandler = new DragDrop(d);
        newHandler.bind(this.element);
  
        return newHandler;
      });
    }

    async _onDrop(event) {
      if (!game.user.isGM) return;
    
      const data = JSON.parse(event.dataTransfer.getData('text/plain'));
      if(event.currentTarget.classList.contains('participants-outer-container')){
        if(data?.type !== 'Actor') {
          return;
        }

        const actor = await fromUuid(data.uuid);
        const event = game.settings.get(MODULE_ID, this.tabGroups.main).events[this.selected.event];
        if(Object.keys(event.participants).includes(actor.id)){
          ui.notifications.warn(game.i18n.localize('PF2ESubsystems.Chase.Errors.ParticipantAlreadyExists'));
          return;
        }

        await updateDataModel(this.tabGroups.main, { [`events.${event.id}.participants.${actor.id}`]: {
          id: actor.id,
          name: actor.name,
          img: actor.img,
          player: actor.system.details.alliance === 'party',
          position: Object.keys(event.participants).length + 1,
        }});
      }
    }
};