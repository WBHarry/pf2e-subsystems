/* !!V13!! Remove this backport when updating to V13 since it has it in Core */
function isDeletionKey(key) {
  if ( !(typeof key === "string") ) return false;
  return (key[1] === "=") && ((key[0] === "=") || (key[0] === "-"));
}

class TypedObjectField extends foundry.data.fields.ObjectField {
  constructor(element, options, context) {
    super(options, context);
    if ( !(element instanceof foundry.data.fields.DataField) ) throw new Error("The element must be a DataField");
    if ( element.parent !== undefined ) throw new Error("The element DataField already has a parent");
    element.parent = this;
    this.element = element;
  }

  /* -------------------------------------------- */

  element;

  /* -------------------------------------------- */

  /** @override */
  static recursive = true;

  /* -------------------------------------------- */

  /** @inheritDoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {validateKey: undefined});
  }

  /* -------------------------------------------- */

  /** @override */
  _cleanType(data, options) {
    options.source = options.source || data;
    for ( const key in data ) {
      const isDeletion = isDeletionKey(key);
      const k = isDeletion ? key.slice(2) : key;
      if ( this.validateKey?.(k) === false ) {
        delete data[key];
        continue;
      }
      if ( isDeletion && (key[0] === "-") ) continue;
      data[key] = this.element.clean(data[key], options);
    }
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  _validateType(data, options={}) {
    if ( foundry.utils.getType(data) !== "Object" ) throw new Error("must be an object");
    options.source = options.source || data;
    const mappingFailure = new foundry.data.validation.DataModelValidationFailure();
    for ( const key in data ) {
      if ( key.startsWith("-=") ) continue;

      // Validate the field's current value
      const value = data[key];
      const failure = this.element.validate(value, options);

      // Failure may be permitted if fallback replacement is allowed
      if ( failure ) {
        mappingFailure.fields[key] = failure;

        // If the field internally applied fallback logic
        if ( !failure.unresolved ) continue;

        // If fallback is allowed at the object level
        if ( options.fallback ) {
          const initial = this.element.getInitialValue(options.source);
          if ( this.element.validate(initial, {source: options.source}) === undefined ) {  // Ensure initial is valid
            data[key] = initial;
            failure.fallback = initial;
            failure.unresolved = false;
          }
          else failure.unresolved = mappingFailure.unresolved = true;
        }

        // Otherwise the field-level failure is unresolved
        else failure.unresolved = mappingFailure.unresolved = true;
      }
    }
    if ( !foundry.utils.isEmpty(mappingFailure.fields) ) return mappingFailure;
  }

  /* -------------------------------------------- */

  /** @override */
  _validateModel(changes, options={}) {
    options.source = options.source || changes;
    if ( !changes ) return;
    for ( const key in changes ) {
      const change = changes[key];  // May be nullish
      if ( change && this.element.constructor.recursive ) this.element._validateModel(change, options);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  initialize(value, model, options={}) {
    const object = {};
    for ( const key in value ) object[key] = this.element.initialize(value[key], model, options);
    return object;
  }

  /* -------------------------------------------- */

  /** @override */
  _updateDiff(source, key, value, difference, options) {

    // * -> undefined, or * -> null
    if ( (value === undefined) || (value === null) || (options.recursive === false) ) {
      super._updateDiff(source, key, value, difference, options);
      return;
    }

    // {} -> {}, undefined -> {}, or null -> {}
    source[key] ||= {};
    value ||= {};
    source = source[key];
    const schemaDiff = difference[key] = {};
    for ( const [k, v] of Object.entries(value) ) {
      let name = k;
      const specialKey = isDeletionKey(k);
      if ( specialKey ) name = k.slice(2);

      // Special operations for deletion or forced replacement
      if ( specialKey ) {
        if ( k[0] === "-" ) {
          if ( v !== null ) throw new Error("Removing a key using the -= deletion syntax requires the value of that"
            + " deletion key to be null, for example {-=key: null}");
          if ( name in source ) {
            schemaDiff[k] = v;
            delete source[name];
          }
        }
        else if ( k[0] === "=" ) schemaDiff[k] = source[name] = applySpecialKeys(v);
        continue;
      }

      // Perform type-specific update
      this.element._updateDiff(source, k, v, schemaDiff, options);
    }

    // No updates applied
    if ( isEmpty(schemaDiff) ) delete difference[key];
  }

  /* -------------------------------------------- */

  /** @override */
  _updateCommit(source, key, value, diff, options) {
    const s = source[key];

    // Special Cases: * -> undefined, * -> null, undefined -> *, null -> *
    if ( !s || !value || Object.isSealed(s) ) {
      source[key] = value;
      return;
    }

    // Remove keys which no longer exist in the new value
    for ( const k of Object.keys(s) ) {
      if ( !(k in value) ) delete s[k];
    }

    // Update fields in source which changed in the diff
    for ( let [k, d] of Object.entries(diff) ) {
      if ( isDeletionKey(k) ) {
        if ( k[0] === "-" ) continue;
        k = k.slice(2);
      }
      this.element._updateCommit(s, k, value[k], d, options);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  toObject(value) {
    if ( (value === undefined) || (value === null) ) return value;
    const object = {};
    for ( const key in value ) object[key] = this.element.toObject(value[key]);
    return object;
  }

  /* -------------------------------------------- */

  /** @override */
  apply(fn, data={}, options={}) {

    // Apply to this TypedObjectField
    const thisFn = typeof fn === "string" ? this[fn] : fn;
    thisFn?.call(this, data, options);

    // Recursively apply to inner fields
    const results = {};
    for ( const key in data ) {
      const r = this.element.apply(fn, data[key], options);
      if ( !options.filter || !isEmpty(r) ) results[key] = r;
    }
    return results;
  }

  /* -------------------------------------------- */

  /** @override */
  _getField(path) {
    if ( path.length === 0 ) return this;
    else if ( path.length === 1 ) return this.element;
    path.shift();
    return this.element._getField(path);
  }

  /* -------------------------------------------- */

  /**
   * Migrate this field's candidate source data.
   * @param {object} sourceData   Candidate source data of the root model
   * @param {any} fieldData       The value of this field within the source data
   */
  migrateSource(sourceData, fieldData) {
    if ( !(this.element.migrateSource instanceof Function) ) return;
    for ( const key in fieldData ) this.element.migrateSource(sourceData, fieldData[key]);
  }
}

/* !!V13!! Use TypedObjectField */ 
class Chases extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      events: new TypedObjectField(new fields.EmbeddedDataField(Chase)),
    }
  }
}

class Chase extends foundry.abstract.DataModel {
    static defineSchema() {
      const fields = foundry.data.fields;
      return {
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        version: new fields.StringField({ required: true }),
        background: new fields.StringField({ required: true }),
        premise: new fields.HTMLField({ required: true, initial: "" }),
        hidden: new fields.BooleanField({ initial: true }),
        rounds: new fields.SchemaField({
          current: new fields.NumberField({ initial: 0 }),
          max: new fields.NumberField({}), 
        }),
        started: new fields.BooleanField({ required: true, initial: false }),
        participants: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          name: new fields.StringField({ required: true }),
          img: new fields.StringField({ required: true }),
          hidden: new fields.BooleanField({ initial: false }),
          position: new fields.NumberField({ required: true, nullable: true, initial: 0 }),
          player: new fields.BooleanField({ required: true, initial: false }),
          obstacle: new fields.NumberField({ required: true, initial: 1 }),
          hasActed: new fields.BooleanField({ required: true, initial: false }),
        })),
        obstacles: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          name: new fields.StringField({ required: true }),
          img: new fields.StringField({}),
          position: new fields.NumberField({ required: true, integer: true }),
          locked: new fields.BooleanField({ required: true, initial: true }),
          chasePoints: new fields.SchemaField({
              goal: new fields.NumberField({ required: true, integer: true, initial: 0 }),
              current: new fields.NumberField({ required: true, integer: true, initial: 0 }),
          }),
          overcome: new fields.HTMLField({}),
        })),
      }
    }

    get maxUnlockedObstacle(){
      return Object.values(this.obstacles).reduce((acc, obstacle) => {
        if(!obstacle.locked && obstacle.position > acc) {
          return obstacle.position;
        }

        return acc;
      }, 1);
    }

    get minLockedObstacle(){
      const obstacles = Object.values(this.obstacles);
      return obstacles.reduce((acc, obstacle) => {
        if(obstacle.locked && obstacle.position < acc) {
          return obstacle.position;
        }

        return acc;
      }, obstacles.length+1);
    }

    get extendedObstacles(){
      return Object.values(this.obstacles)
        .sort((a, b) => a.position - b.position)
        .reduce((acc, obstacle) => {
          acc[obstacle.id] = {
            ...obstacle,
            chasePoints: {
              ...obstacle.chasePoints,
              atStart: obstacle.chasePoints.current === 0,
              finished: obstacle.chasePoints.current === obstacle.chasePoints.goal,
            }
          };

          return acc;
      }, {});
    }
}

const MODULE_ID = 'pf2e-subsystems';
const SOCKET_ID = `module.${MODULE_ID}`;

const timeUnits = {
    year: {
        value: 'year',
        name: 'PF2ESubsystems.TimeUnits.Year.Plural',
    },
    month: {
        value: 'month',
        name: 'PF2ESubsystems.TimeUnits.Month.Plural',
    },
    day: {
        value: 'day',
        name: 'PF2ESubsystems.TimeUnits.Day.Plural',
    },
    hour: {
        value: 'hour',
        name: 'PF2ESubsystems.TimeUnits.Hour.Plural',
    },
};

const settingIDs = {
    menus: {
        subsystems: "subsystems-menu"
    },
    chase: {
        settings: "chase-settings",
    },
    research: {
        settings: "research-settings",
    },
};

const tourIDs = {
    chase: "pf2e-subsystems-chase",
    research: "pf2e-subsystems-research",
};

class Researches extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      events: new TypedObjectField(new fields.EmbeddedDataField(Research)),
    }
  }
}

class Research extends foundry.abstract.DataModel {
    static defineSchema() {
      const fields = foundry.data.fields;
      return {
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        version: new fields.StringField({ required: true }),
        background: new fields.StringField({ required: true }),
        premise: new fields.HTMLField({ required: true, initial: "" }),
        tags: new fields.ArrayField(new fields.StringField(), { required: true, initial: [] }),
        hidden: new fields.BooleanField({ initial: true }),
        timeLimit: new fields.SchemaField({
          unit: new fields.StringField(),
          current: new fields.NumberField({ initial: 0 }),
          max: new fields.NumberField(),
        }),
        started: new fields.BooleanField({ required: true, initial: false }),
        researchPoints: new fields.NumberField({ required: true, initial: 0 }),
        researchChecks: new TypedObjectField(new fields.EmbeddedDataField(ResearchChecks)),
        researchBreakpoints: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          hidden: new fields.BooleanField({ required: true, initial: true }),
          breakpoint: new fields.NumberField({ requird: true, initial: 5 }),
          description: new fields.HTMLField(),
        })),
        researchEvents: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          name: new fields.StringField({ required: true, initial: "New Research Event" }),
          hidden: new fields.BooleanField({ required: true, initial: true }),
          timing: new fields.StringField(),
          description: new fields.HTMLField(),
        })),
      }
    }
}

class ResearchChecks extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({ required: true }),
      name: new fields.StringField({ required: true, initial: "New Check" }),
      hidden: new fields.BooleanField({ required: true, initial: true }),
      description: new fields.HTMLField(),
      maximumResearchPoints: new fields.NumberField({ required: true, initial: 5 }),
      skillChecks: new TypedObjectField(new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        hidden: new fields.BooleanField({ required: true, initial: true }),
        description: new fields.HTMLField(),
        skills: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          skill: new fields.StringField(),
          action: new fields.StringField(),
          lore: new fields.BooleanField({ required: true, initial: false }),
          dc: new fields.NumberField({ required: true, initial: 10 }),
          basic: new fields.BooleanField({ required: true, initial: false }),
        })),
      }))
    }
  }
}

class ResearchSettings extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      hiddenFields: new fields.SchemaField({
          researchCheckMaxRP: new fields.BooleanField({ required: true, initial: false }),
      }),
    }
  }
}


class ChaseSettings extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      playersCanEditPosition: new fields.BooleanField({ required: true, initial: false }),
      hideObstacleLockIcon: new fields.BooleanField({ required: true, initial: false }),
    }
  }
}

const { HandlebarsApplicationMixin: HandlebarsApplicationMixin$1, ApplicationV2: ApplicationV2$1 } = foundry.applications.api;

class SubsystemsMenu extends HandlebarsApplicationMixin$1(
  ApplicationV2$1,
) {
  constructor() {
    super({});
  }

  get title() {
    return game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Title");
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    id: "pf2e-subsystems-subsystems-menu",
    classes: ["pf2e-subsystems", "pf2e-subsystems-menu"],
    position: { width: "500", height: "auto" },
    actions: {
      save: this.save,
    },
    form: { handler: this.updateData },
  };

  static PARTS = {
    chase: {
      id: "chase",
      template: "modules/pf2e-subsystems/templates/menu/subsystem-menu/chase-menu.hbs",
    },
    research: {
      id: "research",
      template: "modules/pf2e-subsystems/templates/menu/subsystem-menu/research-menu.hbs",
    },
  };

  tabGroups = {
    main: 'chase',
  };

  changeTab(tab, group, options) {
    super.changeTab(tab, group, options);
  }

  getTabs() {
    const tabs = {
      chase: {
        active: true,
        cssClass: 'chase-view',
        group: 'main',
        id: 'chase',
        icon: null,
        label: game.i18n.localize('PF2ESubsystems.Events.Chase.Plural'),
        image: 'icons/skills/movement/feet-winged-boots-brown.webp',
      },
      research: {
        active: false,
        cssClass: 'research-view',
        group: 'main',
        id: 'research',
        icon: null,
        label: game.i18n.localize('PF2ESubsystems.Events.Research.Plural'),
        image: 'icons/skills/trades/academics-merchant-scribe.webp',
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

  async _prepareContext(_options) {
    const context = await super._prepareContext(_options);
    context.tabs = this.getTabs();

    return context;
  }

  async _preparePartContext(partId, context) {
    switch(partId){
        case 'chase':
          context.settings = game.settings.get(MODULE_ID, settingIDs.chase.settings);
          break;
        case 'research':
          context.settings = game.settings.get(MODULE_ID, settingIDs.research.settings);
          break;
    }

    return context;
}

  static async updateData(event, element, formData) {
    const { chase, research } = foundry.utils.expandObject(formData.object);

    await game.settings.set(MODULE_ID, settingIDs.chase.settings, chase);
    await game.settings.set(MODULE_ID, settingIDs.research.settings, research);

    this.close();
  }

//   static async resetSection(_, button) {
//     await foundry.utils.setProperty(
//       this.settings,
//       button.dataset.path,
//       getVagueDescriptionLabels()[button.dataset.property],
//     );
//     this.render();
//   }

  static async save(options) {
    // await game.settings.set(
    //   MODULE_ID,
    //   settingIDs.menus.subsystems,
    //   this.settings,
    // );
    this.close();
  }
}

const currentVersion = '0.5.2';

const registerKeyBindings = () => {
  game.keybindings.register(MODULE_ID, "open-system-view", {
    name: game.i18n.localize("PF2ESubsystems.KeyBindings.OpenSystemView.Name"),
    hint: game.i18n.localize("PF2ESubsystems.KeyBindings.OpenSystemView.Hint"),
    uneditable: [],
    editable: [],
    onDown: () =>
      game.modules.get(MODULE_ID).macros.openSubsystemView(),
    onUp: () => {},
    restricted: false,
    reservedModifiers: [],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
};

const registerGameSettings = () => {
  configSettings();
  generalNonConfigSettings();
  registerMenus();
};

const configSettings = () => {
  game.settings.register(MODULE_ID, settingIDs.research.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: ResearchSettings,
  });

  game.settings.register(MODULE_ID, settingIDs.chase.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: ChaseSettings,
  });
};

const generalNonConfigSettings = () => {
  game.settings.register(MODULE_ID, "chase", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: Chases,
    default: { events: {} },
  });
  game.settings.register(MODULE_ID, "research", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: Researches,
    default: { events: {} },
  });
};

const registerMenus = () => {
  game.settings.registerMenu(MODULE_ID, settingIDs.menus.subsystems, {
    name: game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Name"),
    label: game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Label"),
    hint: game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Hint"),
    icon: "fa-solid fa-list",
    type: SubsystemsMenu,
    restricted: true,
  });
};

function handleSocketEvent({ action = null, data = {} } = {}) {
    switch (action) {
      case socketEvent.UpdateSystemView:
        Hooks.callAll(socketEvent.UpdateSystemView, data?.tab);
        break;
      case socketEvent.OpenSystemEvent:
        new SystemView(data.tab, data.event).render(true);
        break;
      case socketEvent.GMUpdate:
        Hooks.callAll(socketEvent.GMUpdate, data);
        break;
    }
  }
  
  const socketEvent = {
    UpdateSystemView: "UpdateSystemView",
    OpenSystemEvent: "OpenSystemEvent",
    GMUpdate: "GMUpdate",
  };

async function updateDataModel(setting, data){
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

function translateSubsystem(tab) {
    switch(tab) {
        case 'chase':
            return game.i18n.localize("PF2ESubsystems.Events.Chase.Single");
        case 'research':
            return game.i18n.localize("PF2ESubsystems.Events.Research.Single");
    }
}

async function copyToClipboard(textToCopy) {
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

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const getDefaultSelected = (event) => ({
  event: event ?? null,
  chaseObstacle: 1,
  research: {},
});

class SystemView extends HandlebarsApplicationMixin(
    ApplicationV2,
  ) {
    constructor(tab, event, isTour) {
      super({});

      this.selected = getDefaultSelected(event);
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
        researchRemoveSkill: this.researchRemoveSkill,
        addResearchEvent: this.addResearchEvent,
        removeResearchEvent: this.removeResearchEvent,
        toggleResearchEventHidden: this.toggleResearchEventHidden,
        researchToggleOpenResearchEvent: this.researchToggleOpenResearchEvent,

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
    };

    _onRender(context, options) {
      this._dragDrop = this._createDragDropHandlers.bind(this)();
    }

    tabGroups = {
      main: 'systemView',
      influenceResearchChecks: 'description',
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
      };
  
      for (const v of Object.values(tabs)) {
        v.active = this.tabGroups[v.group]
          ? this.tabGroups[v.group] === v.id
          : v.active;
        v.cssClass = v.active ? `${v.cssClass} active` : "";
      }
  
      return tabs;
    }

    getSkillCheckTabs() {
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

    changeTab(tab, group, options) {
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
          redirectToRoot: [current] ,
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
                    name: game.i18n.localize('PF2ESubsystems.Chase.NewObstacle'),
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

              foundry.utils.randomID();
              return {
                id: foundry.utils.randomID(),
                name: elements.name.value ? elements.name.value : game.i18n.localize('PF2ESubsystems.View.NewEvent'),
                version: currentVersion,
                background: elements.background.value ? elements.background.value : 'icons/skills/trades/academics-merchant-scribe.webp',
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
      if(!this.editMode && !this.isTour && this.tabGroups.main === 'chase'){
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
      }});
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
          };
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
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchBreakpoints.${button.dataset.breakpoint}.hidden`]: !currentBreakpoint.hidden });
    }

    static toggleResearchOpenResearchBreakpoint(_, button) {
      this.selected.research.openResearchBreakpoint = this.selected.research.openResearchBreakpoint === button.dataset.breakpoint ? null : button.dataset.breakpoint;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async addResearchCheck(_, button) {
      const researchCheckId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${researchCheckId}`]: {
        id: researchCheckId,
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
      }});
    }

    static async researchRemoveSkill(_, button){
      const currentNrSkills = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchChecks[button.dataset.check].skillChecks[button.dataset.skillCheck].skills).length;
      if(currentNrSkills === 1){
        await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.-=${button.dataset.skillCheck}`]: null});
      }
      else {
        await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.skillChecks.${button.dataset.skillCheck}.skills.-=${button.dataset.skill}`]: null});
      }
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
        }});
      }
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
          context.skillCheckTabs = this.getSkillCheckTabs();
          await this.setupEvents(viewEvents, context);
          if(context.selectedEvent) {
            context.selectedEvent.enrichedPremise = await TextEditor.enrichHTML(context.selectedEvent.premise);
            context.showTimeLimit = this.editMode || context.selectedEvent.timeLimit.max;
            context.selectedEvent.timeLimit.unitName = timeUnits[context.selectedEvent.timeLimit.unit]?.name;

            for(var key of Object.keys(context.selectedEvent.researchChecks)){
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
}

const openSubsystemView = async (tab, event) => {
    new SystemView(tab, event).render(true);
  };

const startEvent = async (tab, event) => {
  if(!tab) {
    ui.notifications.error(game.i18n.localize('PF2ESubsystems.Macros.StartEvent.Errors.MissingTab'));
    return;
  }

  if(!event) {
    ui.notifications.error(game.i18n.localize('PF2ESubsystems.Macros.StartEvent.Errors.MissingEvent'));
    return;
  }

  const eventEntity = game.settings.get(MODULE_ID, tab).events[event];
  if(!eventEntity) {
    ui.notifications.error(game.i18n.localize('PF2ESubsystems.Macros.StartEvent.Errors.MissingEventEntity'));
    return;
  }

  const systemView = await new SystemView(tab, event).render(true);
  systemView.onStartEvent(event);
};

var macros = /*#__PURE__*/Object.freeze({
  __proto__: null,
  openSubsystemView: openSubsystemView,
  startEvent: startEvent
});

const handleMigration = async () => {
    
};

class RegisterHandlebarsHelpers {
    static registerHelpers() {
      Handlebars.registerHelper({
        PF2ESubSAdd: this.add,
        PF2ESubSSub: this.sub,
        PF2ESubSLength: this.length,
      });
    }
  
    static add(a, b) {
        return a + b;
    }

    static sub(a, b) {
      return a - b;
    }

    static length(a) {
        return Object.keys(a).length;
    }
}

class ChaseTour extends Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      switch(currentStep.id){
        case 'create-chase':
          this.#systemView = await new SystemView('chase', null, true).render(true);
          break;
        case 'chase-overview-1':
          this.#systemView.selected.event = 'tour-event';
          await this.#systemView.render({ parts: ['chase'], force: true });
          break;
      }
    }

    async progress(stepIndex) {
      super.progress(stepIndex);
    }

    exit(){
      this.#systemView.close();
      this.#systemView = null;
      super.exit();
    }
    
    async complete(){
      this.#systemView.close();
      this.#systemView = null;
      super.complete();
    }
}

class ResearchTour extends Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      switch(currentStep.id){
        case 'create-research':
          this.#systemView = await new SystemView('research', null, true).render(true);
          break;
        case 'research-overview-1':
          this.#systemView.selected.event = 'tour-event';
          await this.#systemView.render({ parts: ['research'], force: true });
          break;
      }
    }

    async progress(stepIndex) {
      super.progress(stepIndex);
    }

    exit(){
      this.#systemView.close();
      this.#systemView = null;
      super.exit();
    }
    
    async complete(){
      this.#systemView.close();
      this.#systemView = null;
      super.complete();
    }
}

Hooks.once("init", () => {
    registerGameSettings();
    registerKeyBindings();
    RegisterHandlebarsHelpers.registerHelpers();
    game.socket.on(SOCKET_ID, handleSocketEvent);

    loadTemplates([
      "modules/pf2e-subsystems/templates/partials/navigate-back.hbs",
      "modules/pf2e-subsystems/templates/partials/events.hbs",
      "modules/pf2e-subsystems/templates/partials/radio-button.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chase.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chaseDataDialog.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/participantDataDialog.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/research/research.hbs",
      "modules/pf2e-subsystems/templates/menu/subsystem-menu/partials/system-tabs.hbs",
      "modules/pf2e-subsystems/templates/menu/subsystem-menu/partials/system-footer.hbs"
    ]);
});

Hooks.once("ready", async () => {
    game.modules.get("pf2e-subsystems").macros = macros;

    handleMigration();
});

Hooks.once("setup", async () => {
  registerTours();
});

Hooks.on(socketEvent.GMUpdate, async ({ setting, data }) => {
  if(game.user.isGM){
    const currentSetting = game.settings.get(MODULE_ID, setting);
    currentSetting.updateSource(data);
    await game.settings.set(MODULE_ID, setting, currentSetting);

    await game.socket.emit(SOCKET_ID, {
      action: socketEvent.UpdateSystemView,
      data: { tab: setting },
    });

    Hooks.callAll(socketEvent.UpdateSystemView, setting);
  }
});

async function registerTours() {
  try {
    game.tours.register(MODULE_ID, tourIDs.chase, await ChaseTour.fromJSON(`/modules/${MODULE_ID}/tours/chase/chase-tour.json`));
    game.tours.register(MODULE_ID, tourIDs.research, await ResearchTour.fromJSON(`/modules/${MODULE_ID}/tours/research/research-tour.json`));
  } catch (error) {
    console.error("MyTour | Error registering tours: ",error);
  }
}

Hooks.on("renderJournalDirectory", async (tab, html) => {
  if (tab.id === "journal") {
    const buttons = $(tab.element).find(".directory-footer.action-buttons");
    buttons.prepend(`
            <button id="pf2e-subsystems">
                <i class="fa-solid fa-list" />
                <span style="font-size: var(--font-size-14); font-family: var(--font-primary); font-weight: 400;">${game.i18n.localize("PF2ESubsystems.Name")}</span>
            </button>`);

    $(buttons).find("#pf2e-subsystems")[0].onclick = () => {
      new SystemView().render(true);
    };
  }
});
//# sourceMappingURL=Subsystems.js.map
