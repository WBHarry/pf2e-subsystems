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

class MappingField extends foundry.data.fields.ObjectField {
    constructor(model, options) {
      if (!(model instanceof foundry.data.fields.DataField)) {
        throw new Error(
          "MappingField must have a DataField as its contained element",
        );
      }
      super(options);
  
      /**
       * The embedded DataField definition which is contained in this field.
       * @type {DataField}
       */
      this.model = model;
    }
  
    /* -------------------------------------------- */
  
    /** @inheritdoc */
    static get _defaults() {
      return foundry.utils.mergeObject(super._defaults, {
        initialKeys: null,
        initialValue: null,
        initialKeysOnly: false,
      });
    }
  
    /* -------------------------------------------- */
  
    /** @inheritdoc */
    _cleanType(value, options) {
      Object.entries(value).forEach(
        ([k, v]) => (value[k] = this.model.clean(v, options)),
      );
      return value;
    }
  
    /* -------------------------------------------- */
  
    /** @inheritdoc */
    getInitialValue(data) {
      let keys = this.initialKeys;
      const initial = super.getInitialValue(data);
      if (!keys || !foundry.utils.isEmpty(initial)) return initial;
      if (!(keys instanceof Array)) keys = Object.keys(keys);
      for (const key of keys) initial[key] = this._getInitialValueForKey(key);
      return initial;
    }
  
    /* -------------------------------------------- */
  
    /**
     * Get the initial value for the provided key.
     * @param {string} key       Key within the object being built.
     * @param {object} [object]  Any existing mapping data.
     * @returns {*}              Initial value based on provided field type.
     */
    _getInitialValueForKey(key, object) {
      const initial = this.model.getInitialValue();
      return this.initialValue?.(key, initial, object) ?? initial;
    }
  
    /* -------------------------------------------- */
  
    /** @override */
    _validateType(value, options = {}) {
      if (foundry.utils.getType(value) !== "Object")
        throw new Error("must be an Object");
      const errors = this._validateValues(value, options);
      if (!foundry.utils.isEmpty(errors))
        throw new foundry.data.fields.ModelValidationError(errors);
    }
  
    /* -------------------------------------------- */
  
    /**
     * Validate each value of the object.
     * @param {object} value     The object to validate.
     * @param {object} options   Validation options.
     * @returns {Object<Error>}  An object of value-specific errors by key.
     */
    _validateValues(value, options) {
      const errors = {};
      for (const [k, v] of Object.entries(value)) {
        const error = this.model.validate(v, options);
        if (error) errors[k] = error;
      }
      return errors;
    }
  
    /* -------------------------------------------- */
  
    /** @override */
    initialize(value, model, options = {}) {
      if (!value) return value;
      const obj = {};
      const initialKeys =
        this.initialKeys instanceof Array
          ? this.initialKeys
          : Object.keys(this.initialKeys ?? {});
      const keys = this.initialKeysOnly ? initialKeys : Object.keys(value);
      for (const key of keys) {
        const data = value[key] ?? this._getInitialValueForKey(key, value);
        obj[key] = this.model.initialize(data, model, options);
      }
      return obj;
    }
  
    /* -------------------------------------------- */
  
    /** @inheritdoc */
    _getField(path) {
      if (path.length === 0) return this;
      else if (path.length === 1) return this.model;
      path.shift();
      return this.model._getField(path);
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
        started: new fields.BooleanField({ required: true, initial: false }),
        participants: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          name: new fields.StringField({ required: true }),
          img: new fields.StringField({ required: true }),
          hidden: new fields.BooleanField({ initial: false }),
          position: new fields.NumberField({ required: true, nullable: true, initial: 0 }),
          player: new fields.BooleanField({ required: true, initial: false }),
          obstacle: new fields.NumberField({ required: true, initial: 1 }),
        })),
        obstacles: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          name: new fields.StringField({ required: true }),
          img: new fields.StringField({}),
          position: new fields.NumberField({ required: true, integer: true }),
          chasePoints: new fields.SchemaField({
              goal: new fields.NumberField({ required: true, integer: true, initial: 0 }),
              current: new fields.NumberField({ required: true, integer: true, initial: 0 }),
          }),
          overcome: new fields.HTMLField({}),
        })),
        notes: new fields.SchemaField({
          player: new fields.SchemaField({
            value: new fields.HTMLField({ required: true, initial: "" }),
          }),
          gm: new fields.SchemaField({
            value: new fields.HTMLField({ required: true, initial: "" }),
          }),
        }),
      }
    }

    get extendedParticipants(){
      const party = game.actors.find(x => x.type === 'party');
      if(!party) return;
      
      const playerParticipants = party.members.map(x => {
        const existingParticipant = this.participants[x.id];
        return {
          id: x.id,
          name: x.name,
          img: x.img,
          hidden: existingParticipant?.hidden ?? false,
          position: existingParticipant?.position ?? 0,
          player: true,
          obstacle: existingParticipant?.obstacle ?? 1,
        };
      });

      return Object.values(this.participants).reduce((acc, x) => {
        if(!x.player){
          acc.push(x);
        }

        return acc;
      }, playerParticipants);
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

const coreLight = {
  "--pf2e-bestiary-tracking-application-image": "../ui/parchment.jpg",
  "--pf2e-bestiary-tracking-application-header": "rgb(68, 68, 68)",
  "--pf2e-bestiary-tracking-application-image-repeat": "repeat",
  "--pf2e-bestiary-tracking-application": "initial",
  "--pf2e-bestiary-tracking-secondary-application": "#b8cccb",
  "--pf2e-bestiary-tracking-primary": "rgb(212 189 172)",
  "--pf2e-bestiary-tracking-primary-faded": "rgb(212 189 172 / 25%)",
  "--pf2e-bestiary-tracking-secondary": "#62b356",
  "--pf2e-bestiary-tracking-tertiary": "#62acce",
  "--pf2e-bestiary-tracking-primary-accent": "#fff1db",
  "--pf2e-bestiary-tracking-tertiary-accent": "#9de0ff",
  "--pf2e-bestiary-tracking-primary-color": "black",
  "--pf2e-bestiary-tracking-icon-filter":
    "invert(100%) sepia(100%) saturate(0%) hue-rotate(288deg) brightness(102%) contrast(102%)",
  "--pf2e-bestiary-tracking-main-hover": "#1c8efe",
  "--pf2e-bestiary-tracking-border": "black",
  "--pf2e-bestiary-tracking-secondary-border": "#82acff",
  "--pf2e-bestiary-tracking-application-border": "initial",
  "--pf2e-bestiary-tracking-icon": "black",
  "--pf2e-bestiary-tracking-accent-icon": "gold",
};

const coreDark = {
  "--pf2e-bestiary-tracking-application-image": "ignore",
  "--pf2e-bestiary-tracking-application": "#12101fe6",
  "--pf2e-bestiary-tracking-secondary-application": "#431b1b",
  "--pf2e-bestiary-tracking-primary": "rgb(94 0 0)",
  "--pf2e-bestiary-tracking-primary-faded": "rgb(94 0 0 / 50%)",
  "--pf2e-bestiary-tracking-secondary": "#4b4b8c",
  "--pf2e-bestiary-tracking-tertiary": "#007149",
  "--pf2e-bestiary-tracking-primary-accent": "#ad0303",
  "--pf2e-bestiary-tracking-tertiary-accent": "#76963f",
  "--pf2e-bestiary-tracking-primary-color": "white",
  "--pf2e-bestiary-tracking-icon-filter": "none",
  "--pf2e-bestiary-tracking-main-hover": "white",
  "--pf2e-bestiary-tracking-border": "#ababab",
  "--pf2e-bestiary-tracking-secondary-border": "gold",
  "--pf2e-bestiary-tracking-application-border": "wheat",
  "--pf2e-bestiary-tracking-icon": "rgb(247, 243, 232)",
  "--pf2e-bestiary-tracking-accent-icon": "gold",
};

const nebula = {
  "--pf2e-bestiary-tracking-application-image":
    "modules/pf2e-bestiary-tracking/assets/Space.webp",
  "--pf2e-bestiary-tracking-application-header": "transparent",
  "--pf2e-bestiary-tracking-application-image-size": "cover",
  "--pf2e-bestiary-tracking-application-image-repeat": "round",
  "--pf2e-bestiary-tracking-application-secondary-image":
    "linear-gradient(#8a549c, #9198e5)",
  "--pf2e-bestiary-tracking-application": "",
  "--pf2e-bestiary-tracking-secondary-application": "",
  "--pf2e-bestiary-tracking-primary-outline": "drop-shadow(0 0 3px grey)",
  "--pf2e-bestiary-tracking-primary": "rgb(115 169 188)",
  "--pf2e-bestiary-tracking-primary-faded": "rgb(115 169 188 / 50%)",
  "--pf2e-bestiary-tracking-secondary": "#cd7e23",
  "--pf2e-bestiary-tracking-tertiary": "#7476a6",
  "--pf2e-bestiary-tracking-primary-accent": "#0888b5",
  "--pf2e-bestiary-tracking-tertiary-accent": "#888bc0",
  "--pf2e-bestiary-tracking-primary-color": "rgb(247, 243, 232)",
  "--pf2e-bestiary-tracking-icon-filter": "none",
  "--pf2e-bestiary-tracking-main-hover": "",
  "--pf2e-bestiary-tracking-border": "#e4e41e",
  "--pf2e-bestiary-tracking-secondary-border": "gold",
  "--pf2e-bestiary-tracking-application-border": "#e4e41e",
  "--pf2e-bestiary-tracking-icon": "",
  "--pf2e-bestiary-tracking-accent-icon": "",
};

const viscera = {
  "--pf2e-bestiary-tracking-application-image":
    "modules/pf2e-bestiary-tracking/assets/Viscera.webp",
  "--pf2e-bestiary-tracking-application-header": "transparent",
  "--pf2e-bestiary-tracking-application-image-size": "cover",
  "--pf2e-bestiary-tracking-application-image-repeat": "initial",
  "--pf2e-bestiary-tracking-application-secondary-image": "",
  "--pf2e-bestiary-tracking-application": "",
  "--pf2e-bestiary-tracking-secondary-application": "",
  "--pf2e-bestiary-tracking-primary-outline": "drop-shadow(0 0 3px grey)",
  "--pf2e-bestiary-tracking-primary": "rgb(129 63 63)",
  "--pf2e-bestiary-tracking-primary-faded": "rgb(129 63 63 / 50%)",
  "--pf2e-bestiary-tracking-secondary": "#483c70",
  "--pf2e-bestiary-tracking-tertiary": "crimson",
  "--pf2e-bestiary-tracking-primary-accent": "#9f2828",
  "--pf2e-bestiary-tracking-tertiary-accent": "#c12c2c",
  "--pf2e-bestiary-tracking-primary-color": "white",
  "--pf2e-bestiary-tracking-icon-filter": "none",
  "--pf2e-bestiary-tracking-main-hover": "red",
  "--pf2e-bestiary-tracking-border": "orange",
  "--pf2e-bestiary-tracking-secondary-border": "gold",
  "--pf2e-bestiary-tracking-application-border": "orange",
  "--pf2e-bestiary-tracking-icon": "",
  "--pf2e-bestiary-tracking-accent-icon": "",
};

const water = {
  "--pf2e-bestiary-tracking-application-image":
    "modules/pf2e-bestiary-tracking/assets/Water.webp",
  "--pf2e-bestiary-tracking-application-header": "transparent",
  "--pf2e-bestiary-tracking-application-image-size": "cover",
  "--pf2e-bestiary-tracking-application-image-repeat": "initial",
  "--pf2e-bestiary-tracking-application-secondary-image": "",
  "--pf2e-bestiary-tracking-application": "",
  "--pf2e-bestiary-tracking-secondary-application": "",
  "--pf2e-bestiary-tracking-primary-outline": "drop-shadow(0 0 3px grey)",
  "--pf2e-bestiary-tracking-primary": "rgb(28 166 113)",
  "--pf2e-bestiary-tracking-primary-faded": "rgb(28 166 113 / 50%)",
  "--pf2e-bestiary-tracking-secondary": "#8b0d8b",
  "--pf2e-bestiary-tracking-tertiary": "#602fa1",
  "--pf2e-bestiary-tracking-primary-accent": "#0f7e2fbf",
  "--pf2e-bestiary-tracking-tertiary-accent": "#681ad1",
  "--pf2e-bestiary-tracking-primary-color": "rgb(247, 243, 232)",
  "--pf2e-bestiary-tracking-icon-filter": "none",
  "--pf2e-bestiary-tracking-main-hover": "white",
  "--pf2e-bestiary-tracking-border": "#c7ffed",
  "--pf2e-bestiary-tracking-secondary-border": "gold",
  "--pf2e-bestiary-tracking-application-border": "#c7ffed",
  "--pf2e-bestiary-tracking-icon": "",
  "--pf2e-bestiary-tracking-accent-icon": "",
};

const subsystemsThemes = {
  coreLight: coreLight,
  coreDark: coreDark,
  nebula: nebula,
  viscera: viscera,
  water: water,
};

const subsystemsThemeChoices = {
  coreLight: "Core Light",
  coreDark: "Core Dark",
  nebula: "Nebula",
  viscera: "Viscera",
  water: "Water",
};

const setupTheme = (theme) => {
    const root = document.querySelector(":root");
    for (var property of Object.keys(theme)) {
      if (
        property === "--pf2e-bestiary-tracking-application-image" &&
        theme[property] !== "ignore"
      ) {
        const baseUri = document.baseURI.split("game")[0];
        root.style.setProperty(property, `url("${baseUri}${theme[property]}")`);
      } else {
        root.style.setProperty(property, theme[property]);
      }
    }
  };
  
  const registerKeyBindings = () => {
    game.keybindings.register("pf2e-subsystems", "open-system-view", {
      name: game.i18n.localize("PF2ESubsystems.KeyBindings.OpenSystemView.Name"),
      hint: game.i18n.localize("PF2ESubsystems.KeyBindings.OpenSystemView.Hint"),
      uneditable: [],
      editable: [],
      onDown: () =>
        game.modules.get("pf2e-subsystems").macros.openSubsystemView(),
      onUp: () => {},
      restricted: false,
      reservedModifiers: [],
      precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    });
  };
  
  const registerGameSettings = () => {
    configSettings();
    generalNonConfigSettings();
    // vagueDescriptions();
    // bestiaryLabels();
    // bestiaryDisplay();
    // bestiaryAppearance();
    // bestiaryIntegration();
  };

  const configSettings = () => {
    game.settings.register(MODULE_ID, "subsystems-theme", {
        name: game.i18n.localize("PF2ESubsystems.Settings.SubsystemsTheme.Name"),
        hint: game.i18n.localize("PF2ESubsystems.Settings.SubsystemsTheme.Hint"),
        scope: "client",
        config: true,
        type: String,
        choices: subsystemsThemeChoices,
        requiresReload: true,
        default: "coreLight",
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

    game.settings.register(MODULE_ID, "subsystems-folders", {
      name: game.i18n.localize("PF2ESubsystems.Settings.SubsystemsTheme.Name"),
      hint: game.i18n.localize("PF2ESubsystems.Settings.SubsystemsTheme.Hint"),
      scope: "world",
      config: false,
      type: Object,
      default: {},
    });

    game.settings.register(MODULE_ID, "subsystems-theme", {
      name: "Theme",
      hint: "",
      scope: "client",
      config: true,
      type: new foundry.data.fields.StringField({
        choices: subsystemsThemeChoices,
        required: true,
      }),
      requiresReload: true,
      onChange: async (value) => {
        if (!value) return;
  
        game.user.setFlag(MODULE_ID, "subsystems-theme", value);
      },
      default: "default",
    });
  };

async function updateDataModel(setting, data){
    const currentSetting = game.settings.get(MODULE_ID, setting);
    currentSetting.updateSource(data);
    await game.settings.set(MODULE_ID, setting, currentSetting);
}

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

class SystemView extends HandlebarsApplicationMixin(
    ApplicationV2,
  ) {
    constructor() {
      super({});

      this.selected = {
        event: null,
        newEventName: null,
        chaseObstacle: 1,
      };

      this.editMode = false;
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
        removeEvent: this.removeEvent,
        navigateToSystem: this.navigateToSystem,
        /* Chases */
        addPlayerParticipants: this.addPlayerParticipants,
        addParticipant: this.addParticipant,
        updateParticipantObstacle: this.updateParticipantObstacle,
        updatePlayerParticipantsObstacle: this.updatePlayerParticipantsObstacle,
        addObstacle: this.addObstacle,
        removeObstacle: this.removeObstacle,
        setCurrentObstacle: this.setCurrentObstacle,
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
          label: 'Chases',
          image: 'icons/skills/movement/feet-winged-boots-brown.webp',
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
            this.render({ parts: [this.tabGroups.main] });
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

    static async addEvent(_, button){
      if(this.selected.newEventName) {
        const newId = foundry.utils.randomID();
        const obstacleId = foundry.utils.randomID();

        const currentSettings = game.settings.get(MODULE_ID, button.dataset.system);
        currentSettings.updateSource({ 
          [`events.${newId}`]: {
            id: newId,
            name: this.selected.newEventName,
            version: '0.8',
            background: 'icons/magic/symbols/star-solid-gold.webp',
            participants: {},
            obstacles: {
              [obstacleId]: {
                id: obstacleId,
                img: "icons/svg/cowled.svg",
                name: 'New Obstacle',
                position: 1,
                chasePoints: {
                  goal: 6,
                  current: 0,
                },
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
          }
        });
        await game.settings.set(MODULE_ID, button.dataset.system, currentSettings);
        
        this.selected.newEventName = null;
        this.render({ parts: [this.tabGroups.main] });
      }
    }

    static async removeEvent(_, button){
      await updateDataModel(this.tabGroups.main, { [`events.-=${button.dataset.id}`]: null });
      this.render({ parts: [this.tabGroups.main] });
    }

    static navigateToSystem(){
      this.selected.event = null;
      this.render({ parts: [this.tabGroups.main] });
    }

    onKeyDown(event){
      if(this.tabGroups.main === 'chase'){
        if(this.selected.event){
          switch(event.key) {
            case 'ArrowLeft':
              this.selected.chaseObstacle = Math.max(this.selected.chaseObstacle-1, 1);
              this.render({ parts: [this.tabGroups.main] });
              break;
            case 'ArrowRight':
              this.selected.chaseObstacle = Math.min(this.selected.chaseObstacle+1, Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[this.selected.event].obstacles).length);
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
      this.render({ parts: [this.tabGroups.main] });
    }

    static async addParticipant(_, button){
      const newId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.participants.${newId}`]: { 
        id: newId, 
        name: 'New Participant',
        img: 'icons/svg/cowled.svg',
        obstacle: 1,
      }});
      this.render({ parts: [this.tabGroups.main] });
    }

    static async updateParticipantObstacle(_, button) {
      const obstacle = !Number.isNaN(button.dataset.obstacle) ? Number.parseInt(button.dataset.obstacle) : null;
      if(obstacle === null) return;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.participants.${button.dataset.id}.obstacle`]: obstacle});
      this.render({ parts: [this.tabGroups.main] });
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
      this.render({ parts: [this.tabGroups.main] });
    }

    static async addObstacle(_, button) {
      const newId = foundry.utils.randomID();
      const currentObstacles = Object.keys(game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].obstacles).length;
      const newPosition = currentObstacles+1;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.obstacles.${newId}`]: {
        id: newId,
        img: "icons/svg/cowled.svg",
        name: 'New Obstacle',
        position: currentObstacles+1,
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

      await chases.updateSource({ [`events.${button.dataset.event}.obstacles.-=${button.dataset.obstacle}`]: null });
      await chases.updateSource({ [`events.${button.dataset.event}.obstacles`]: obstacles }, { diff: false });
      await game.settings.set(MODULE_ID, this.tabGroups.main, chases);

      this.selected.chaseObstacle = Math.min(this.selected.chaseObstacle, Object.keys(obstacles).length);

      this.render({ parts: [this.tabGroups.main] });
    }

    static setCurrentObstacle(_, button) {
      this.selected.chaseObstacle = Number.parseInt(button.dataset.position);
      this.render({ parts: [this.tabGroups.main] });
    }

    static async updateChasePoints(_, button) {
      const currentChasePoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].obstacles[button.dataset.obstacle].chasePoints.current;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.obstacles.${button.dataset.obstacle}.chasePoints.current`]: button.dataset.increase ? currentChasePoints+1 : currentChasePoints-1 });
      this.render({ parts: [this.tabGroups.main] });
    }

    _attachPartListeners(partId, htmlElement, options) {
      super._attachPartListeners(partId, htmlElement, options);

      switch(partId){
        case 'chase':
          $(htmlElement).find('.arrow-key-element').on('keydown', event => event.stopPropagation());
          break;
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

    async _prepareContext(_options) {
      var context = await super._prepareContext(_options);

      context.isGM = game.user.isGM;
      context.systems = this.getTabs();
      context.selected = this.selected;
      context.editMode = this.editMode;

      return context;
    }

    static async updateData(event, element, formData) {
      const { selected, editMode, events }= foundry.utils.expandObject(formData.object);
      this.selected = foundry.utils.mergeObject(this.selected, selected);
      this.editMode = editMode;

      await updateDataModel(this.tabGroups.main, { events });

      this.render({ parts: [this.tabGroups.main] });
    }
}

const openSubsystemView = async () => {
    new SystemView().render(true);
  };

var macros = /*#__PURE__*/Object.freeze({
  __proto__: null,
  openSubsystemView: openSubsystemView
});

function handleSocketEvent({ action = null, data = {} } = {}) {
    switch (action) {
      case socketEvent.UpdateSystemView:
        Hooks.callAll(socketEvent.UpdateSystemView, {});
        break;
    }
  }
  
  const socketEvent = {
    UpdateSystemView: "UpdateSystemView",
  };

const handleMigration = async () => {
    // await setupJournalStructure();
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

Hooks.once("init", () => {
    // dataTypeSetup();
    registerGameSettings();
    registerKeyBindings();
    RegisterHandlebarsHelpers.registerHelpers();
    game.socket.on(`module.pf2e-subsystems`, handleSocketEvent);

    loadTemplates([
      "modules/pf2e-subsystems/templates/partials/navigate-back.hbs",
      "modules/pf2e-subsystems/templates/partials/events.hbs",
      "modules/pf2e-subsystems/templates/partials/radio-button.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chase.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/editChase.hbs",
    ]);
});

Hooks.once("ready", async () => {
    game.modules.get("pf2e-subsystems").macros = macros;

    handleMigration();
});

Hooks.once("setup", async () => {
    const userTheme = game.user.getFlag(
        MODULE_ID,
        "subsystems-theme",
      );
      if (userTheme) {
        await game.settings.set(MODULE_ID, "subsystems-theme", userTheme);
      }
    
      const selectedTheme = game.settings.get(
        MODULE_ID,
        "subsystems-theme",
      );
      const theme =
        selectedTheme === "default"
          ? game.settings.get(MODULE_ID, "subsystems-default-theme")
          : selectedTheme;
    setupTheme(subsystemsThemes[theme]);
});
//# sourceMappingURL=Subsystems.js.map
