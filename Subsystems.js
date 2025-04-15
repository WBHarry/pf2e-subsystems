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
    infiltration: {
        settings: 'infiltration-settings',
    },
    influence: {
        settings: 'influence-settings',
    }
};

const tourIDs = {
    chase: "pf2e-subsystems-chase",
    research: "pf2e-subsystems-research",
    infiltration: "pf2e-subsystems-infiltration",
    influence: "pf2e-subsystems-influence",
};

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

const dcAdjustments = {
    incrediblyHard: {
        value: 'incrediblyHard',
        name: 'PF2E.DCAdjustmentIncrediblyHard',
    },
    veryHard: {
        value: 'veryHard',
        name: 'PF2E.DCAdjustmentVeryHard',
    },
    hard: {
        value: 'hard',
        name: 'PF2E.DCAdjustmentHard',
    },
    standard: {
        value: 'standard',
        name: 'PF2E.DCAdjustmentNormal',
    },
    easy: {
        value: 'easy',
        name: 'PF2E.DCAdjustmentEasy',
    },
    veryEasy: {
        value: 'veryEasy',
        name: 'PF2E.DCAdjustmentVeryEasy',
    },
    incrediblyEasy: {
        value: 'incrediblyEasy',
        name: 'PF2E.DCAdjustmentIncrediblyEasy'
    }
};

const degreesOfSuccess = {
    criticalSuccess: {
        value: 'criticalSuccess',
        name: 'PF2E.Check.Result.Degree.Check.criticalSuccess'
    },
    success: {
        value: 'success',
        name: 'PF2E.Check.Result.Degree.Check.success'
    },
    failure: {
        value: 'failure',
        name: 'PF2E.Check.Result.Degree.Check.failure'
    },
    criticalFailure: {
        value: 'criticalFailure',
        name: 'PF2E.Check.Result.Degree.Check.criticalFailure'
    }
};

const defaultInfiltrationAwarenessBreakpoints = {
    '1': {
        id: '1',
        breakpoint: 5,
        dcIncrease: 1,
        description: 'PF2ESubsystems.Infiltration.Awareness.DefaultBreakpoint5',
    },
    '2': {
        id: '2',
        breakpoint: 10,
        description: 'PF2ESubsystems.Infiltration.Awareness.DefaultBreakpoint10',
    },
    '3': {
        id: '3',
        breakpoint: 15,
        dcIncrease: 2,
        description: 'PF2ESubsystems.Infiltration.Awareness.DefaultBreakpoint15',
    },
    '4': {
        id: '4',
        breakpoint: 20,
        description: 'PF2ESubsystems.Infiltration.Awareness.DefaultBreakpoint20',
    }
};

const defaultInfiltrationPreparations = {
    bribeContact: {
        id: 'bribeContact',
        name: 'Bribe Contact',
        tags: ['downtime', 'secret'],
        cost: 'A bribe worth at least one-tenth of the Currency per Additional PC listed on Table 10–9: Party Treasure by Level. Doubling this amount grants a +2 circumstance bonus to the check.',
        requirements: `You've successfully Gained a Contact.`,
        description: 'You offer a bribe to your contact to help the heist in some way.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'The contact accepts the bribe and you gain 1 EP.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                fakeDegreeOfSuccess: 'success',
                description: 'You believe you successfully Bribed your Contact and gained 1 EP, but in fact the contact informs the opposition of the attempted bribery, adding 1 AP to the infiltration. The GM can reveal that this Edge Point grants no benefit at any point during the infiltration, as befits the story.',
                awarenessPoints: 1,
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                fakeDegreeOfSuccess: 'success',
                description: 'As failure, but adding 2 AP to the infiltration.',
                awarenessPoints: 2,
                inUse: true,
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'deception',
                    },
                    '2': {
                        id: '2',
                        skill: 'diplomacy',
                    }
                }
            },
        },
        edgeLabel: "Contact",
        maxAttempts: 1,
    },
    forgeDocuments: {
        id: 'forgeDocuments',
        name: 'Forge Documents',
        tags: ['downtime', 'secret'],
        description: 'You prepare forgeries that might serve as convincing props. Attempt a hard or very hard Society check.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'You create convincing forgeries and gain 1 EP you can use only when presenting some form of paperwork.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                fakeDegreeOfSuccess: 'success',
                description: 'You create unconvincing documents. You gain 1 EP that (unknown to you) grants no benefit when used.',
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                fakeDegreeOfSuccess: 'success',
                description: 'As a failure, but a PC who tries to use the Edge Point gets a critical failure, even if they use the Edge Point after rolling a failure.',
                inUse: true,
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'society',
                    }
                }
            },
        },
        edgeLabel: "Forged Documents",
        maxAttempts: 1,
    },
    gainContact: {
        id: 'gainContact',
        name: 'Gain Contact',
        tags: ['downtime'],
        description: 'You try to make contact with an individual who can aid you in the infiltration. Attempt a normal, hard, or very hard DC Diplomacy or Society check, or a check using a Lore skill appropriate to your prospective contact.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'You make contact and gain 1 EP.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                description: 'You fail to make contact.',
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                description: 'You insult or spook the contact in some way. Future attempts take a –2 circumstance penalty. <strong>Special</strong> Multiple critical failures might cause the contact to work against the PCs in some way, likely increasing the party’s Awareness Points.',
                inUse: true,
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.standard.value, dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'diplomacy',
                    },
                    '2': {
                        id: '2',
                        skill: 'society',
                    }
                }
            },
        },
        edgeLabel: "Contact",
        maxAttempts: 1,
    },
    gossip: {
        id: 'gossip',
        name: 'Gossip',
        tags: ['downtime', 'secret'],
        description: 'You seek out rumors about the infiltration’s target. Attempt a normal, hard, or very hard Diplomacy check.',
        results: {
            criticalSuccess: {
                degreeOfSuccess: 'criticalSuccess',
                description: 'You gain inside information about the location or group you’re trying to infiltrate. This grants you a +2 circumstance bonus to future checks you attempt for preparation activities for this infiltration. If you share this information, those you share it with also gain this bonus.',
                inUse: true,
            },
            success: {
                degreeOfSuccess: 'success',
                description: 'You gain inside information about the place or group you’re attempting to infiltrate that aids your planning.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                description: 'You learn nothing.',
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                description: 'You hear a few mistaken rumors and take a –2 circumstance penalty to your next check for a preparation activity. Word spreads around that you’re asking after that group or individual, increasing your Awareness Points by 1.',
                awarenessPoints: 1,
                inUse: true,   
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.standard.value, dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'diplomacy',
                    }
                }
            },
        },
        edgeLabel: "Gossip",
        maxAttempts: 1,
    },
    scoutLocation: {
        id: 'scoutLocation',
        name: 'Scout Location',
        tags: ['downtime', 'secret'],
        description: 'You spend time observing the place or group you wish to infiltrate. Attempt a normal, hard, or very hard DC Perception, Society or Stealth check.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'You make observations that provide 1 EP.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                description: 'You learn nothing particularly noteworthy.',
                inUse: true,
            },
            criticalFailure: {
                degreeOfSuccess: 'criticalFailure',
                fakeDegreeOfSuccess: 'success',
                description: 'You misjudge some aspect of what you observed, gaining 1 EP that results in a critical failure instead of a success when used, even if a PC uses the Edge Point after rolling a failure.',
                inUse: true,
            }
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.standard.value, dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'diplomacy',
                    },
                }
            },
        },
        edgeLabel: "Scouting Info",
        maxAttempts: 1,
    },
    secureDisguises: {
        id: 'secureDisguises',
        name: 'Secure Disguises',
        tags: ['downtime'],
        description: 'You seek to procure or create disguises. Attempt a normal, hard, or very hard Crafting, Deception, Performance, or Society check.',
        results: {
            success: {
                degreeOfSuccess: 'success',
                description: 'You procure or creates disguises, gaining 1 EP that can be used only to maintain a cover identity.',
                inUse: true,
            },
            failure: {
                degreeOfSuccess: 'failure',
                description: 'Your efforts result in an unusable disguise.',
                inUse: true,
            },
        },
        skillChecks: {
            '1': {
                id: '1',
                dcAdjustments: [dcAdjustments.hard.value, dcAdjustments.veryHard.value],
                skills: {
                    '1': {
                        id: '1',
                        skill: 'crafting',
                    },
                    '2': {
                        id: '2',
                        skill: 'deception',
                    },
                    '3': {
                        id: '3',
                        skill: 'performance',
                    },
                    '4': {
                        id: '4',
                        skill: 'society',
                    }
                }
            },
        },
        edgeLabel: "Disguise",
        maxAttempts: 1,
    }
};

class Infiltrations extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      events: new TypedObjectField(new fields.EmbeddedDataField(Infiltration)),
    }
  }
}

class Infiltration extends foundry.abstract.DataModel {
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
        awarenessPoints: new fields.SchemaField({
          current: new fields.NumberField({ required: true, initial: 0 }),
          hidden: new fields.NumberField({ required: true, initial: 0}),
          breakpoints: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            inUse: new fields.BooleanField({ required: true, inttial: false }),
            dcIncrease: new fields.NumberField(),
            breakpoint: new fields.NumberField({ required: true, initial: 0 }),
            description: new fields.HTMLField(),
          })),
        }),
        edgePoints: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          name: new fields.StringField({ required: true }),
          faked: new fields.BooleanField({ required: true, initial: false }),
          used: new fields.BooleanField({ required: true, initial: false }),
          originActivity: new fields.StringField({ required: true }),
          originResult: new fields.StringField({ required: true }),
          awarenessPoints: new fields.NumberField({ required: true, initial: 0 }),
          description: new fields.HTMLField(),
          hiddenDescription: new fields.HTMLField(),
        })),
        objectives: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          hidden: new fields.BooleanField({ required: true, initial: false }),
          name: new fields.StringField({ required: true }),
          position: new fields.NumberField({ required: true }),
          obstacles: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: false }),
            name: new fields.StringField({ required: true }),
            img: new fields.StringField({}),
            position: new fields.NumberField({ required: true }),
            individual: new fields.BooleanField({ required: true, initial: false }),
            infiltrationPoints: new fields.SchemaField({
              current: new fields.NumberField({ required: true, initial: 0 }),
              max: new fields.NumberField({ required: true, initial: 2 }),
            }),
            infiltrationPointData: new TypedObjectField(new fields.NumberField({ required: true, initial: 0 })),
            skillChecks: new TypedObjectField(new fields.SchemaField({
              id: new fields.StringField({ required: true }),
              hidden: new fields.BooleanField({ required: true, initial: true }),
              description: new fields.HTMLField(),
              dcAdjustments: new fields.ArrayField(new fields.StringField()),
              selectedAdjustment: new fields.StringField(),
              difficulty: new fields.SchemaField({
                leveledDC: new fields.BooleanField({ required: true, initial: true }),
                DC: new fields.NumberField(),
              }),
              skills: new TypedObjectField(new fields.SchemaField({
                id: new fields.StringField({ required: true }),
                skill: new fields.StringField(),
                action: new fields.StringField(),
                variant: new fields.StringField(),
                lore: new fields.BooleanField({ required: true, initial: false }),
              })),
            })),
            description: new fields.HTMLField(),
          })),
        })),
        complications: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          hidden: new fields.BooleanField({ required: true, initial: true }),
          name: new fields.StringField({ required: true }),
          infiltrationPoints: new fields.SchemaField({
            current: new fields.NumberField(),
            max: new fields.NumberField(),
          }),
          trigger: new fields.StringField(),
          skillChecks: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            description: new fields.HTMLField(),
            dcAdjustments: new fields.ArrayField(new fields.StringField()),
            selectedAdjustment: new fields.StringField(),
            difficulty: new fields.SchemaField({
              leveledDC: new fields.BooleanField({ required: true, initial: true }),
              DC: new fields.NumberField(),
            }),
            skills: new TypedObjectField(new fields.SchemaField({
              id: new fields.StringField({ required: true }),
              skill: new fields.StringField(),
              action: new fields.StringField(),
              variant: new fields.StringField(),
              lore: new fields.BooleanField({ required: true, initial: false }),
            })),
          })),
          description: new fields.HTMLField(),
          results: new fields.SchemaField({
            criticalSuccess: degreeOfSuccessFields(degreesOfSuccess.criticalSuccess.value),
            success: degreeOfSuccessFields(degreesOfSuccess.success.value),
            failure: degreeOfSuccessFields(degreesOfSuccess.failure.value),
            criticalFailure: degreeOfSuccessFields(degreesOfSuccess.criticalFailure.value),
          }),
          resultsOutcome: new fields.StringField(),
        })),
        opportunities: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          hidden: new fields.BooleanField({ required: true, initial: true }),
          name: new fields.StringField({ required: true }),
          requirements: new fields.StringField(),
          description: new fields.HTMLField(),
        })),
        preparations: new fields.EmbeddedDataField(Preparations),
      }
    }

    get visibleAwareness() {
      return game.user.isGM ? this.awarenessPoints.current + this.awarenessPoints.hidden : this.awarenessPoints.current; 
    }

    get awarenessDCIncrease() {
      const totalAwareness = this.awarenessPoints.current + this.awarenessPoints.hidden;
      const autoApplyIncrease = game.settings.get(MODULE_ID, settingIDs.infiltration.settings).autoApplyAwareness;
      return Object.values(this.awarenessPoints.breakpoints).reduce((acc, curr) => {
        if((autoApplyIncrease && totalAwareness >= curr.breakpoint) || curr.inUse){
          acc = Math.max((curr.dcIncrease ?? 0), acc);
        }

        return acc;
      }, 0);
    }

    get complicationsData() {
      return Object.values(this.complications).reduce((acc, complication) => {
        acc[complication.id] = {
          ...complication,
          skillChecks: Object.values(complication.skillChecks).reduce((acc, skillCheck) => {
            acc[skillCheck.id] = {
              ...skillCheck,
              columns: Object.values(skillCheck.skills).reduce((acc, skill) => {
                acc.lore.push({ 
                  event: this.id,
                  complication: complication.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  lore: skill.lore,
                });
                acc.skill.push({ 
                  event: this.id,
                  complication: complication.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  skill: skill.skill,
                  lore: skill.lore,
                });
                acc.action.push({ 
                  event: this.id,
                  complication: complication.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  action: skill.action,
                });
                acc.variant.push({ 
                  event: this.id,
                  complication: complication.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  variantOptions: skill.action ? [...game.pf2e.actions.get(skill.action).variants].map(x => ({ value: x.slug, name: x.name })) : [],
                  variant: skill.variant,
                  disabled: skill.action ? game.pf2e.actions.get(skill.action).variants.size === 0 : true,
                });

                return acc;
              }, { lore: [], skill: [], action: [], variant: [] }),
            };

            return acc;
          }, {}),
        };

        return acc;
      }, {});
    }

    get preparationsActivitiesData() {
      return Object.values(this.preparations.activities).reduce((acc, activity) => {
        acc[activity.id] = {
          ...activity,
          skillChecks: Object.values(activity.skillChecks).reduce((acc, skillCheck) => {
            acc[skillCheck.id] = {
              ...skillCheck,
              columns: Object.values(skillCheck.skills).reduce((acc, skill) => {
                acc.lore.push({ 
                  event: this.id,
                  activity: activity.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  lore: skill.lore,
                });
                acc.skill.push({ 
                  event: this.id,
                  activity: activity.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  skill: skill.skill,
                  lore: skill.lore,
                });
                acc.action.push({ 
                  event: this.id,
                  activity: activity.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  action: skill.action,
                });
                acc.variant.push({ 
                  event: this.id,
                  activity: activity.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  variantOptions: skill.action ? [...game.pf2e.actions.get(skill.action).variants].map(x => ({ value: x.slug, name: x.name })) : [],
                  variant: skill.variant,
                  disabled: skill.action ? game.pf2e.actions.get(skill.action).variants.size === 0 : true,
                });
  
                return acc;
              }, { lore: [], skill: [], action: [], variant: [] }),
            };
  
            return acc;
          }, {}),
        };
  
        return acc;
      }, {});
    }
}

class Preparations extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      usesPreparation: new fields.BooleanField({ required: true, initial: false }),
      activities: new TypedObjectField(new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        name: new fields.StringField(),
        tags: new fields.ArrayField(new fields.StringField()),
        cost: new fields.HTMLField(),
        requirements: new fields.HTMLField(),
        description: new fields.HTMLField(),
        skillChecks: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          hidden: new fields.BooleanField({ required: true, initial: true }),
          description: new fields.HTMLField(),
          dcAdjustments: new fields.ArrayField(new fields.StringField()),
          selectedAdjustment: new fields.StringField(),
          difficulty: new fields.SchemaField({
            leveledDC: new fields.BooleanField({ required: true, initial: true }),
            DC: new fields.NumberField(),
          }),
          skills: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            skill: new fields.StringField(),
            action: new fields.StringField(),
            variant: new fields.StringField(),
            lore: new fields.BooleanField({ required: true, initial: false }),
          })),
        })),
        results: new fields.SchemaField({
          criticalSuccess: resultsField(degreesOfSuccess.criticalSuccess.value),
          success: resultsField(degreesOfSuccess.success.value),
          failure: resultsField(degreesOfSuccess.failure.value),
          criticalFailure: resultsField(degreesOfSuccess.criticalFailure.value),
        }),
        edgeLabel: new fields.StringField(),
        maxAttempts: new fields.NumberField({ required: true, initial: 1 }),
      }))
    }
  }
}

const degreeOfSuccessFields = (degreeOfSuccess) => new foundry.data.fields.SchemaField({
  degreeOfSuccess: new foundry.data.fields.StringField({ required: true, initial: degreeOfSuccess}),
  description: new foundry.data.fields.HTMLField(),
  awarenessPoints: new foundry.data.fields.NumberField(),
  inUse: new foundry.data.fields.BooleanField({ required: true, initial: false }),
});

const resultsField = (degreeOfSuccess) => new foundry.data.fields.SchemaField({
  degreeOfSuccess: new foundry.data.fields.StringField({ required: true, initial: degreeOfSuccess}),
  fakeDegreeOfSuccess: new foundry.data.fields.StringField(),
  description: new foundry.data.fields.HTMLField(),
  nrOutcomes: new foundry.data.fields.NumberField({ required: true, initial: 0 }),
  awarenessPoints: new foundry.data.fields.NumberField(),
  inUse: new foundry.data.fields.BooleanField({ required: true, initial: false }),
});

/* !!V13!! Use TypedObjectField */ 
class Influences extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      events: new TypedObjectField(new fields.EmbeddedDataField(Influence)),
    }
  }
}

class Influence extends foundry.abstract.DataModel {
    static defineSchema() {
      const fields = foundry.data.fields;
      return {
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        version: new fields.StringField({ required: true }),
        background: new fields.StringField({ required: true }),
        premise: new fields.HTMLField({ required: true, initial: "" }),
        hidden: new fields.BooleanField({ initial: true }),
        perception: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        will: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        influencePoints: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        timeLimit: new fields.SchemaField({
          current: new fields.NumberField({ required: true, integer: true, initial: 0 }),
          max: new fields.NumberField({ integer: true, nullable: true, initial: null }),
        }),
        discoveries: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: false }),
            skill: new fields.StringField({ required: true, initial: 'acrobatics' }),
            action: new fields.StringField(),
            variant: new fields.StringField(),
            dc: new fields.NumberField({ required: true, integer: true, initial: 10 }),
            lore: new fields.BooleanField({ required: true, initial: false }),
        })),
        influenceSkills: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            label: new fields.StringField(),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            skill: new fields.StringField({ required: true, initial: 'acrobatics' }),
            action: new fields.StringField(),
            variant: new fields.StringField(),
            dc: new fields.NumberField({ required: true, integer: true, initial: 10 }),
            lore: new fields.BooleanField({ required: true, initial: false }),
        })),
        influence: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            points: new fields.NumberField({ required: true, integer: true, initial: 0 }),
            description: new fields.HTMLField({ required: true }),
        })),
        weaknesses: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            description: new fields.HTMLField({ required: true }),
            modifier: new fields.SchemaField({
                used: new fields.BooleanField({ required: true, initial: false }),
                value: new fields.NumberField({ required: true, integer: true, initial: 1 })
            }),
        })),
        resistances: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            description: new fields.HTMLField({ required: true }),
            modifier: new fields.SchemaField({
                used: new fields.BooleanField({ required: true, initial: false }),
                value: new fields.NumberField({ required: true, integer: true, initial: 1 })
            }),
        })),
        penalties: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            description: new fields.HTMLField({ required: true }),
            modifier: new fields.SchemaField({
                used: new fields.BooleanField({ required: true, initial: false }),
                value: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null })
            }),
        })),
      }
    }

    get dcModifier() {
      const weaknessMod = Object.values(this.weaknesses).reduce((acc, weakness) => {
        if(weakness.modifier.used) acc -= weakness.modifier.value;
        return acc;
      }, 0);
      const resistanceMod = Object.values(this.resistances).reduce((acc, resistance) => {
        if(resistance.modifier.used) acc += resistance.modifier.value;
        return acc;
      }, 0);
      const penaltyMod = Object.values(this.penalties).reduce((acc, penalty) => {
        if(penalty.modifier.used) acc += penalty.modifier.value;
        return acc;
      }, 0);

      return weaknessMod + resistanceMod + penaltyMod;
    }

    get discoveryData() {
      return {
        data: this.discoveries,
        columns: Object.values(this.discoveries).reduce((acc, discovery) => {
          acc.lore.push({ 
            event: this.id,
            id: discovery.id,
            lore: discovery.lore,
          });
          acc.skill.push({ 
            event: this.id,
            id: discovery.id,
            skill: discovery.skill,
            lore: discovery.lore,
          });
          acc.action.push({ 
            event: this.id,
            id: discovery.id,
            action: discovery.action,
          });
          acc.variant.push({ 
            event: this.id,
            id: discovery.id,
            variantOptions: discovery.action ? [...game.pf2e.actions.get(discovery.action).variants].map(x => ({ value: x.slug, name: x.name })) : [],
            variant: discovery.variant,
            disabled: discovery.action ? game.pf2e.actions.get(discovery.action).variants.size === 0 : true,
          });
          acc.dc.push({
            event: this.id,
            id: discovery.id,
            dc: discovery.dc,
          });
  
          return acc;
        }, { lore: [], skill: [], action: [], variant: [], dc: [] }),
      }
    }

    get influenceSkillData() {
      return {
        data: this.influenceSkills,
        columns: Object.values(this.influenceSkills).reduce((acc, skill) => {
          acc.lore.push({ 
            event: this.id,
            id: skill.id,
            lore: skill.lore,
          });
          acc.skill.push({ 
            event: this.id,
            id: skill.id,
            skill: skill.skill,
            lore: skill.lore,
          });
          acc.action.push({ 
            event: this.id,
            id: skill.id,
            action: skill.action,
            label: skill.label,
          });
          acc.variant.push({ 
            event: this.id,
            id: skill.id,
            variantOptions: skill.action ? [...game.pf2e.actions.get(skill.action).variants].map(x => ({ value: x.slug, name: x.name })) : [],
            variant: skill.variant,
            disabled: skill.action ? game.pf2e.actions.get(skill.action).variants.size === 0 : true,
          });
          acc.dc.push({
            event: this.id,
            id: skill.id,
            dc: skill.dc,
          });
  
          return acc;
        }, { lore: [], skill: [], action: [], variant: [], dc: [] }),
      }
    }
}

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

    get totalResearchPoints() {
      return Object.values(this.researchChecks).reduce((acc, curr) => {
        acc += (curr.currentResearchPoints ?? 0);

        return acc;
      }, 0);
    }

    get researchChecksData() {
      return Object.values(this.researchChecks).reduce((acc, research) => {
        acc[research.id] = {
          ...research,
          skillChecks: Object.values(research.skillChecks).reduce((acc, skillCheck) => {
            acc[skillCheck.id] = {
              ...skillCheck,
              columns: Object.values(skillCheck.skills).reduce((acc, skill) => {
                acc.lore.push({ 
                  event: this.id,
                  researchCheck: research.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  lore: skill.lore,
                });
                acc.skill.push({ 
                  event: this.id,
                  researchCheck: research.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  skill: skill.skill,
                  lore: skill.lore,
                });
                acc.action.push({ 
                  event: this.id,
                  researchCheck: research.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  action: skill.action,
                });
                acc.variant.push({ 
                  event: this.id,
                  researchCheck: research.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  variantOptions: skill.action ? [...game.pf2e.actions.get(skill.action).variants].map(x => ({ value: x.slug, name: x.name })) : [],
                  variant: skill.variant,
                  disabled: skill.action ? game.pf2e.actions.get(skill.action).variants.size === 0 : true,
                });
                acc.dc.push({ 
                  event: this.id,
                  researchCheck: research.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  dc: skill.dc,
                });
  
                return acc;
              }, { lore: [], skill: [], action: [], variant: [], dc: [] }),
            };
  
            return acc;
          }, {}),
        };
  
        return acc;
      }, {});
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
      currentResearchPoints: new fields.NumberField({ required: true, initial: 0 }),
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
          variant: new fields.StringField(),
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

class InfiltrationSettings extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      hideAwareness: new fields.BooleanField({ required: true, initial: false }),
      autoApplyAwareness: new fields.BooleanField({ required: true, initial: true }),
      autoRevealAwareness: new fields.BooleanField({ required: true, initial: true }),
      defaultAwarenessBreakpoints: new TypedObjectField(new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        breakpoint: new fields.NumberField({ required: true }),
        dcIncrease: new fields.NumberField(),
        description: new fields.HTMLField(),
      }), { initial: defaultInfiltrationAwarenessBreakpoints }),
    }
  }
}

class InfluenceSettings extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      autoRevealInfluence: new fields.BooleanField({ required: true, initial: false }),
      showPerceptionAndWill: new fields.BooleanField({ required: true, initial: false }),
    }
  }
}

const { HandlebarsApplicationMixin: HandlebarsApplicationMixin$2, ApplicationV2: ApplicationV2$2 } = foundry.applications.api;

class SubsystemsMenu extends HandlebarsApplicationMixin$2(
  ApplicationV2$2,
) {
  constructor() {
    super({});

    this.selected = {
      infiltration: {
        awarenessBreakpoint: null,
      }
    };

    this.settings = {
      chase: context.settings = game.settings.get(MODULE_ID, settingIDs.chase.settings).toObject(),
      research: context.settings = game.settings.get(MODULE_ID, settingIDs.research.settings).toObject(),
      infiltration: game.settings.get(MODULE_ID, settingIDs.infiltration.settings).toObject(),
      influence: game.settings.get(MODULE_ID, settingIDs.influence.settings).toObject(),
    };
  }

  get title() {
    return game.i18n.localize("PF2ESubsystems.Menus.Subsystems.Title");
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    id: "pf2e-subsystems-subsystems-menu",
    classes: ["pf2e-subsystems", "pf2e-subsystems-menu"],
    position: { width: "600", height: "auto" },
    actions: {
      addInfiltrationDefaultAwarenessBreakpoint: this.addInfiltrationDefaultAwarenessBreakpoint,
      selectInfiltrationDefaultAwarenessBreakpoint: this.selectInfiltrationDefaultAwarenessBreakpoint,
      removeInfiltrationDefaultAwarenessBreakpoint: this.removeInfiltrationDefaultAwarenessBreakpoint,
      resetInfiltrationDefaultAwarenessBreakpoints: this.resetInfiltrationDefaultAwarenessBreakpoints,
      save: this.save,
    },
    form: { handler: this.updateData, submitOnChange: true },
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
    infiltration: {
      id: "infiltration",
      template: "modules/pf2e-subsystems/templates/menu/subsystem-menu/infiltration-menu.hbs",
    },
    influence: {
      id: "influence",
      template: "modules/pf2e-subsystems/templates/menu/subsystem-menu/influence-menu.hbs",
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
      infiltration: {
        active: false,
        cssClass: 'infiltration-view',
        group: 'main',
        id: 'infiltration',
        icon: null,
        label: game.i18n.localize('PF2ESubsystems.Events.Infiltration.Plural'),
        image: 'icons/skills/trades/academics-merchant-scribe.webp',
      },
      influence: {
        active: false,
        cssClass: 'influence-view',
        group: 'main',
        id: 'influence',
        icon: null,
        label: game.i18n.localize('PF2ESubsystems.Events.Influence.Plural'),
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
          context.settings = this.settings.chase;
          break;
        case 'research':
          context.settings = this.settings.research;
          break;
        case 'infiltration':
          context.settings = this.settings.infiltration;

          const defaultAwarenessBreakpoints = Object.values(context.settings.defaultAwarenessBreakpoints);
          const selectedAwarenessBreakpointId = this.selected.infiltration.awarenessBreakpoint ?? (defaultAwarenessBreakpoints.length > 0 ? defaultAwarenessBreakpoints[0].id : null);
          context.selected = {
            ...this.selected.infiltration,
            awarenessBreakpoint: selectedAwarenessBreakpointId ? context.settings.defaultAwarenessBreakpoints[selectedAwarenessBreakpointId] : null,
          };
          
          if(context.selected.awarenessBreakpoint) {
            context.selected.awarenessBreakpoint.description = game.i18n.localize(context.selected.awarenessBreakpoint.description);
            context.selected.awarenessBreakpoint.enrichedDescription = await TextEditor.enrichHTML(context.selected.awarenessBreakpoint.description);
          }

          break;
        case 'influence':
          context.settings = this.settings.influence;
          break;
    }

    return context;
}

  static async updateData(event, element, formData) {
    const { chase, research, infiltration, influence } = foundry.utils.expandObject(formData.object);

    this.settings.chase = chase;
    this.settings.research = research;
    this.settings.infiltration = infiltration;
    this.settings.influence = influence;
  }

  static async save() {
    await game.settings.set(MODULE_ID, settingIDs.chase.settings, this.settings.chase);
    await game.settings.set(MODULE_ID, settingIDs.research.settings, this.settings.research);
    await game.settings.set(MODULE_ID, settingIDs.infiltration.settings, mergeObject(game.settings.get(MODULE_ID, settingIDs.infiltration.settings).toObject(), this.settings.infiltration));
    await game.settings.set(MODULE_ID, settingIDs.influence.settings, this.settings.influence);

    this.close();
  }

  static async addInfiltrationDefaultAwarenessBreakpoint() {
    const newId = foundry.utils.randomID();

    this.settings.infiltration.defaultAwarenessBreakpoints[newId] = {
      id: newId,
      breakpoint: 5,
      description: game.i18n.localize('PF2ESubsystems.Menus.Subsystems.Infiltration.NewAwarenessBreakpoint'),
    };
     
    this.render();
  }

  static async selectInfiltrationDefaultAwarenessBreakpoint(_, button) {
    this.selected.infiltration.awarenessBreakpoint = button.dataset.breakpoint;
    this.render();
  }

  static async removeInfiltrationDefaultAwarenessBreakpoint(_, button) {
    this.settings.infiltration.defaultAwarenessBreakpoints = Object.keys(this.settings.infiltration.defaultAwarenessBreakpoints).reduce((acc, curr) => {
      if(curr !== button.dataset.breakpoint) {
        acc[curr] = this.settings.infiltration.defaultAwarenessBreakpoints[curr];
      }

      return acc;
    }, {});
    this.render();
  }

  static async resetInfiltrationDefaultAwarenessBreakpoints() {
    this.settings.infiltration.defaultAwarenessBreakpoints = defaultInfiltrationAwarenessBreakpoints;
    this.render();
  }
}

const currentVersion = '0.7.1';

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
    default: {},
  });

  game.settings.register(MODULE_ID, settingIDs.chase.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: ChaseSettings,
    default: {},
  });

  game.settings.register(MODULE_ID, settingIDs.infiltration.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: InfiltrationSettings,
    default: {},
  });

  game.settings.register(MODULE_ID, settingIDs.influence.settings, {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: InfluenceSettings,
    default: {},
  });
};

const generalNonConfigSettings = () => {
  game.settings.register(MODULE_ID, "version", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: String,
    default: "",
  });

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
  game.settings.register(MODULE_ID, "infiltration", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: Infiltrations,
    default: { events: {} },
  });
  game.settings.register(MODULE_ID, "influence", {
    name: "",
    hint: "",
    scope: "world",
    config: false,
    type: Influences,
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

const levelDCTable = {
    "-2": 12,
    "-1": 13,
    0: 14,
    1: 15,
    2: 16,
    3: 18,
    4: 19,
    5: 20,
    6: 22,
    7: 23,
    8: 24,
    9: 26,
    10: 27,
    11: 28,
    12: 30,
    13: 31,
    14: 32,
    15: 34,
    16: 35,
    17: 36,
    18: 38,
    19: 39,
    20: 40,
    21: 42,
    22: 44,
    23: 46,
    24: 48,
    25: 50,
    26: 52,
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

/*
Tagify v4.33.2 - tags input component
By: Yair Even-Or <vsync.design@gmail.com>
https://github.com/yairEO/tagify

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

This Software may not be rebranded and sold as a library under any other name
other than "Tagify" (by owner) or as part of another library.
*/

var t="&#8203;";function e(t,e){(null==e||e>t.length)&&(e=t.length);for(var i=0,n=new Array(e);i<e;i++)n[i]=t[i];return n}function i(t){return function(t){if(Array.isArray(t))return e(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,i){if(!t)return;if("string"==typeof t)return e(t,i);var n=Object.prototype.toString.call(t).slice(8,-1);"Object"===n&&t.constructor&&(n=t.constructor.name);if("Map"===n||"Set"===n)return Array.from(n);if("Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return e(t,i)}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}var n={isEnabled:function(){var t;return null===(t=window.TAGIFY_DEBUG)||void 0===t||t},log:function(){for(var t=arguments.length,e=new Array(t),n=0;n<t;n++)e[n]=arguments[n];var s;this.isEnabled()&&(s=console).log.apply(s,["[Tagify]:"].concat(i(e)));},warn:function(){for(var t=arguments.length,e=new Array(t),n=0;n<t;n++)e[n]=arguments[n];var s;this.isEnabled()&&(s=console).warn.apply(s,["[Tagify]:"].concat(i(e)));}},s=function(t,e,i,n){return t=""+t,e=""+e,n&&(t=t.trim(),e=e.trim()),i?t==e:t.toLowerCase()==e.toLowerCase()},a=function(t,e){return t&&Array.isArray(t)&&t.map((function(t){return o(t,e)}))};function o(t,e){var i,n={};for(i in t)e.indexOf(i)<0&&(n[i]=t[i]);return n}function r(t){return (new DOMParser).parseFromString(t.trim(),"text/html").body.firstElementChild}function l(t,e){for(e=e||"previous";t=t[e+"Sibling"];)if(3==t.nodeType)return t}function d(t){return "string"==typeof t?t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/`|'/g,"&#039;"):t}function c(t){var e=Object.prototype.toString.call(t).split(" ")[1].slice(0,-1);return t===Object(t)&&"Array"!=e&&"Function"!=e&&"RegExp"!=e&&"HTMLUnknownElement"!=e}function u(t,e,i){var n,s;function a(t,e){for(var i in e)if(e.hasOwnProperty(i)){if(c(e[i])){c(t[i])?a(t[i],e[i]):t[i]=Object.assign({},e[i]);continue}if(Array.isArray(e[i])){t[i]=Object.assign([],e[i]);continue}t[i]=e[i];}}return n=t,(null!=(s=Object)&&"undefined"!=typeof Symbol&&s[Symbol.hasInstance]?s[Symbol.hasInstance](n):n instanceof s)||(t={}),a(t,e),i&&a(t,i),t}function g(){var t=[],e={},i=!0,n=!1,s=void 0;try{for(var a,o=arguments[Symbol.iterator]();!(i=(a=o.next()).done);i=!0){var r=a.value,l=!0,d=!1,u=void 0;try{for(var g,h=r[Symbol.iterator]();!(l=(g=h.next()).done);l=!0){var p=g.value;c(p)?e[p.value]||(t.push(p),e[p.value]=1):t.includes(p)||t.push(p);}}catch(t){d=!0,u=t;}finally{try{l||null==h.return||h.return();}finally{if(d)throw u}}}}catch(t){n=!0,s=t;}finally{try{i||null==o.return||o.return();}finally{if(n)throw s}}return t}function h(t){return String.prototype.normalize?"string"==typeof t?t.normalize("NFD").replace(/[\u0300-\u036f]/g,""):void 0:t}var p=function(){return /(?=.*chrome)(?=.*android)/i.test(navigator.userAgent)};function f(){return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,(function(t){return (t^crypto.getRandomValues(new Uint8Array(1))[0]&15>>t/4).toString(16)}))}function m(t){var e;return b.call(this,t)&&(null==t||null===(e=t.classList)||void 0===e?void 0:e.contains(this.settings.classNames.tag))}function v(t){return b.call(this,t)&&(null==t?void 0:t.closest(this.settings.classNames.tagSelector))}function b(t){var e;return (null==t||null===(e=t.closest)||void 0===e?void 0:e.call(t,this.settings.classNames.namespaceSelector))===this.DOM.scope}function w(t,e){var i=window.getSelection();return e=e||i.getRangeAt(0),"string"==typeof t&&(t=document.createTextNode(t)),e&&(e.deleteContents(),e.insertNode(t)),t}function y(t,e,i){return t?(e&&(t.__tagifyTagData=i?e:u({},t.__tagifyTagData||{},e)),t.__tagifyTagData):(n.warn("tag element doesn't exist",{tagElm:t,data:e}),e)}function T(t){if(t&&t.parentNode){var e=t,i=window.getSelection(),n=i.getRangeAt(0);i.rangeCount&&(n.setStartAfter(e),n.collapse(!0),i.removeAllRanges(),i.addRange(n));}}function O(t,e){t.forEach((function(t){if(y(t.previousSibling)||!t.previousSibling){var i=document.createTextNode("​");t.before(i),e&&T(i);}}));}var D={delimiters:",",pattern:null,tagTextProp:"value",maxTags:1/0,callbacks:{},addTagOnBlur:!0,addTagOn:["blur","tab","enter"],onChangeAfterBlur:!0,duplicates:!1,whitelist:[],blacklist:[],enforceWhitelist:!1,userInput:!0,focusable:!0,keepInvalidTags:!1,createInvalidTags:!0,mixTagsAllowedAfter:/,|\.|\:|\s/,mixTagsInterpolator:["[[","]]"],backspace:!0,skipInvalid:!1,pasteAsTags:!0,editTags:{clicks:2,keepInvalid:!0},transformTag:function(){},trim:!0,a11y:{focusableTags:!1},mixMode:{insertAfterTag:" "},autoComplete:{enabled:!0,rightKey:!1,tabKey:!1},classNames:{namespace:"tagify",mixMode:"tagify--mix",selectMode:"tagify--select",input:"tagify__input",focus:"tagify--focus",tagNoAnimation:"tagify--noAnim",tagInvalid:"tagify--invalid",tagNotAllowed:"tagify--notAllowed",scopeLoading:"tagify--loading",hasMaxTags:"tagify--hasMaxTags",hasNoTags:"tagify--noTags",empty:"tagify--empty",inputInvalid:"tagify__input--invalid",dropdown:"tagify__dropdown",dropdownWrapper:"tagify__dropdown__wrapper",dropdownHeader:"tagify__dropdown__header",dropdownFooter:"tagify__dropdown__footer",dropdownItem:"tagify__dropdown__item",dropdownItemActive:"tagify__dropdown__item--active",dropdownItemHidden:"tagify__dropdown__item--hidden",dropdownItemSelected:"tagify__dropdown__item--selected",dropdownInital:"tagify__dropdown--initial",tag:"tagify__tag",tagText:"tagify__tag-text",tagX:"tagify__tag__removeBtn",tagLoading:"tagify__tag--loading",tagEditing:"tagify__tag--editable",tagFlash:"tagify__tag--flash",tagHide:"tagify__tag--hide"},dropdown:{classname:"",enabled:2,maxItems:10,searchKeys:["value","searchBy"],fuzzySearch:!0,caseSensitive:!1,accentedSearch:!0,includeSelectedTags:!1,escapeHTML:!0,highlightFirst:!0,closeOnSelect:!0,clearOnSelect:!0,position:"all",appendTarget:null},hooks:{beforeRemoveTag:function(){return Promise.resolve()},beforePaste:function(){return Promise.resolve()},suggestionClick:function(){return Promise.resolve()},beforeKeyDown:function(){return Promise.resolve()}}};function x(t,e,i){return e in t?Object.defineProperty(t,e,{value:i,enumerable:!0,configurable:!0,writable:!0}):t[e]=i,t}function S(t){for(var e=1;e<arguments.length;e++){var i=null!=arguments[e]?arguments[e]:{},n=Object.keys(i);"function"==typeof Object.getOwnPropertySymbols&&(n=n.concat(Object.getOwnPropertySymbols(i).filter((function(t){return Object.getOwnPropertyDescriptor(i,t).enumerable})))),n.forEach((function(e){x(t,e,i[e]);}));}return t}function I(t,e){return e=null!=e?e:{},Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(e)):function(t,e){var i=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),i.push.apply(i,n);}return i}(Object(e)).forEach((function(i){Object.defineProperty(t,i,Object.getOwnPropertyDescriptor(e,i));})),t}function M(t,e){(null==e||e>t.length)&&(e=t.length);for(var i=0,n=new Array(e);i<e;i++)n[i]=t[i];return n}function E(t,e,i){return e in t?Object.defineProperty(t,e,{value:i,enumerable:!0,configurable:!0,writable:!0}):t[e]=i,t}function N(t){return function(t){if(Array.isArray(t))return M(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(!t)return;if("string"==typeof t)return M(t,e);var i=Object.prototype.toString.call(t).slice(8,-1);"Object"===i&&t.constructor&&(i=t.constructor.name);if("Map"===i||"Set"===i)return Array.from(i);if("Arguments"===i||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i))return M(t,e)}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function _(){for(var t in this.dropdown={},this._dropdown)this.dropdown[t]="function"==typeof this._dropdown[t]?this._dropdown[t].bind(this):this._dropdown[t];this.dropdown.refs(),this.DOM.dropdown.__tagify=this;}var A,C,k=(A=function(t){for(var e=1;e<arguments.length;e++){var i=null!=arguments[e]?arguments[e]:{},n=Object.keys(i);"function"==typeof Object.getOwnPropertySymbols&&(n=n.concat(Object.getOwnPropertySymbols(i).filter((function(t){return Object.getOwnPropertyDescriptor(i,t).enumerable})))),n.forEach((function(e){E(t,e,i[e]);}));}return t}({},{events:{binding:function(){var t=!(arguments.length>0&&void 0!==arguments[0])||arguments[0],e=this.dropdown.events.callbacks,i=this.listeners.dropdown=this.listeners.dropdown||{position:this.dropdown.position.bind(this,null),onKeyDown:e.onKeyDown.bind(this),onMouseOver:e.onMouseOver.bind(this),onMouseLeave:e.onMouseLeave.bind(this),onClick:e.onClick.bind(this),onScroll:e.onScroll.bind(this)},n=t?"addEventListener":"removeEventListener";"manual"!=this.settings.dropdown.position&&(document[n]("scroll",i.position,!0),window[n]("resize",i.position),window[n]("keydown",i.onKeyDown)),this.DOM.dropdown[n]("mouseover",i.onMouseOver),this.DOM.dropdown[n]("mouseleave",i.onMouseLeave),this.DOM.dropdown[n]("mousedown",i.onClick),this.DOM.dropdown.content[n]("scroll",i.onScroll);},callbacks:{onKeyDown:function(t){var e=this;if(this.state.hasFocus&&!this.state.composing){var i=this.settings,s=i.dropdown.includeSelectedTags,a=this.DOM.dropdown.querySelector(i.classNames.dropdownItemActiveSelector),o=this.dropdown.getSuggestionDataByNode(a),r="mix"==i.mode,l="select"==i.mode;i.hooks.beforeKeyDown(t,{tagify:this}).then((function(d){switch(t.key){case"ArrowDown":case"ArrowUp":case"Down":case"Up":t.preventDefault();var c=e.dropdown.getAllSuggestionsRefs(),u="ArrowUp"==t.key||"Up"==t.key;a&&(a=e.dropdown.getNextOrPrevOption(a,!u)),a&&a.matches(i.classNames.dropdownItemSelector)||(a=c[u?c.length-1:0]),e.dropdown.highlightOption(a,!0);break;case"PageUp":case"PageDown":var g;t.preventDefault();var h=e.dropdown.getAllSuggestionsRefs(),p=Math.floor(e.DOM.dropdown.content.clientHeight/(null===(g=h[0])||void 0===g?void 0:g.offsetHeight))||1,f="PageUp"===t.key;if(a){var m=h.indexOf(a),v=f?Math.max(0,m-p):Math.min(h.length-1,m+p);a=h[v];}else a=h[0];e.dropdown.highlightOption(a,!0);break;case"Home":case"End":t.preventDefault();var b=e.dropdown.getAllSuggestionsRefs();a=b["Home"===t.key?0:b.length-1],e.dropdown.highlightOption(a,!0);break;case"Escape":case"Esc":e.dropdown.hide();break;case"ArrowRight":if(e.state.actions.ArrowLeft||i.autoComplete.rightKey)return;case"Tab":var w=!i.autoComplete.rightKey||!i.autoComplete.tabKey;if(!r&&!l&&a&&w&&!e.state.editing&&o){t.preventDefault();var y=e.dropdown.getMappedValue(o);return e.state.autoCompleteData=o,e.input.autocomplete.set.call(e,y),!1}return !0;case"Enter":t.preventDefault(),e.state.actions.selectOption=!0,setTimeout((function(){return e.state.actions.selectOption=!1}),100),i.hooks.suggestionClick(t,{tagify:e,tagData:o,suggestionElm:a}).then((function(){if(a){var i=s?a:e.dropdown.getNextOrPrevOption(a,!u);e.dropdown.selectOption(a,t,(function(){if(i){var t=i.getAttribute("value");i=e.dropdown.getSuggestionNodeByValue(t),e.dropdown.highlightOption(i);}}));}else e.dropdown.hide(),r||e.addTags(e.state.inputText.trim(),!0);})).catch((function(t){return n.warn(t)}));break;case"Backspace":if(r||e.state.editing.scope)return;var T=e.input.raw.call(e);""!=T&&8203!=T.charCodeAt(0)||(!0===i.backspace?e.removeTags():"edit"==i.backspace&&setTimeout(e.editTag.bind(e),0));}}));}},onMouseOver:function(t){var e=t.target.closest(this.settings.classNames.dropdownItemSelector);this.dropdown.highlightOption(e);},onMouseLeave:function(t){this.dropdown.highlightOption();},onClick:function(t){var e=this;if(0==t.button&&t.target!=this.DOM.dropdown&&t.target!=this.DOM.dropdown.content){var i=t.target.closest(this.settings.classNames.dropdownItemSelector),s=this.dropdown.getSuggestionDataByNode(i);this.state.actions.selectOption=!0,setTimeout((function(){return e.state.actions.selectOption=!1}),100),this.settings.hooks.suggestionClick(t,{tagify:this,tagData:s,suggestionElm:i}).then((function(){i?e.dropdown.selectOption(i,t):e.dropdown.hide();})).catch((function(t){return n.warn(t)}));}},onScroll:function(t){var e=t.target,i=e.scrollTop/(e.scrollHeight-e.parentNode.clientHeight)*100;this.trigger("dropdown:scroll",{percentage:Math.round(i)});}}},refilter:function(t){t=t||this.state.dropdown.query||"",this.suggestedListItems=this.dropdown.filterListItems(t),this.dropdown.fill(),this.suggestedListItems.length||this.dropdown.hide(),this.trigger("dropdown:updated",this.DOM.dropdown);},getSuggestionDataByNode:function(t){for(var e,i=t&&t.getAttribute("value"),n=this.suggestedListItems.length;n--;){if(c(e=this.suggestedListItems[n])&&e.value==i)return e;if(e==i)return {value:e}}},getSuggestionNodeByValue:function(t){return this.dropdown.getAllSuggestionsRefs().find((function(e){return e.getAttribute("value")===t}))},getNextOrPrevOption:function(t){var e=!(arguments.length>1&&void 0!==arguments[1])||arguments[1],i=this.dropdown.getAllSuggestionsRefs(),n=i.findIndex((function(e){return e===t}));return e?i[n+1]:i[n-1]},highlightOption:function(t,e){var i,n=this.settings.classNames.dropdownItemActive;if(this.state.ddItemElm&&(this.state.ddItemElm.classList.remove(n),this.state.ddItemElm.removeAttribute("aria-selected")),!t)return this.state.ddItemData=null,this.state.ddItemElm=null,void this.input.autocomplete.suggest.call(this);i=this.dropdown.getSuggestionDataByNode(t),this.state.ddItemData=i,this.state.ddItemElm=t,t.classList.add(n),t.setAttribute("aria-selected",!0),e&&(t.parentNode.scrollTop=t.clientHeight+t.offsetTop-t.parentNode.clientHeight),this.settings.autoComplete&&(this.input.autocomplete.suggest.call(this,i),this.dropdown.position());},selectOption:function(t,e,i){var n=this,s=this.settings,a=s.dropdown.includeSelectedTags,o=s.dropdown,r=o.clearOnSelect,l=o.closeOnSelect;if(!t)return this.addTags(this.state.inputText,!0),void(l&&this.dropdown.hide());e=e||{};var d=t.getAttribute("value"),c="noMatch"==d,g="mix"==s.mode,h=this.suggestedListItems.find((function(t){var e;return (null!==(e=t.value)&&void 0!==e?e:t)==d}));if(this.trigger("dropdown:select",{data:h,elm:t,event:e}),h||c){if(this.state.editing){var p=this.normalizeTags([h])[0];h=s.transformTag.call(this,p)||p,this.onEditTagDone(null,u({__isValid:!0},h));}else this[g?"addMixTags":"addTags"]([h||this.input.raw.call(this)],r);(g||this.DOM.input.parentNode)&&(setTimeout((function(){n.DOM.input.focus(),n.toggleFocusClass(!0);})),l&&setTimeout(this.dropdown.hide.bind(this)),a?i&&i():(t.addEventListener("transitionend",(function(){n.dropdown.fillHeaderFooter(),setTimeout((function(){t.remove(),n.dropdown.refilter(),i&&i();}),100);}),{once:!0}),t.classList.add(this.settings.classNames.dropdownItemHidden)));}else l&&setTimeout(this.dropdown.hide.bind(this));},selectAll:function(t){this.suggestedListItems.length=0,this.dropdown.hide(),this.dropdown.filterListItems("");var e=this.dropdown.filterListItems("");return t||(e=this.state.dropdown.suggestions),this.addTags(e,!0),this},filterListItems:function(t,e){var i,n,s,a,o,r,l=function(){var t,l,d=void 0,u=void 0;t=m[T],n=(null!=(l=Object)&&"undefined"!=typeof Symbol&&l[Symbol.hasInstance]?l[Symbol.hasInstance](t):t instanceof l)?m[T]:{value:m[T]};var v,b=!Object.keys(n).some((function(t){return y.includes(t)}))?["value"]:y;g.fuzzySearch&&!e.exact?(a=b.reduce((function(t,e){return t+" "+(n[e]||"")}),"").toLowerCase().trim(),g.accentedSearch&&(a=h(a),r=h(r)),d=0==a.indexOf(r),u=a===r,v=a,s=r.toLowerCase().split(" ").every((function(t){return v.includes(t.toLowerCase())}))):(d=!0,s=b.some((function(t){var i=""+(n[t]||"");return g.accentedSearch&&(i=h(i),r=h(r)),g.caseSensitive||(i=i.toLowerCase()),u=i===r,e.exact?i===r:0==i.indexOf(r)}))),o=!g.includeSelectedTags&&i.isTagDuplicate(c(n)?n.value:n),s&&!o&&(u&&d?f.push(n):"startsWith"==g.sortby&&d?p.unshift(n):p.push(n));},d=this,u=this.settings,g=u.dropdown,p=(e=e||{},[]),f=[],m=u.whitelist,v=g.maxItems>=0?g.maxItems:1/0,b=g.includeSelectedTags,w="function"==typeof g.sortby,y=g.searchKeys,T=0;if(!(t="select"==u.mode&&this.value.length&&this.value[0][u.tagTextProp]==t?"":t)||!y.length){p=b?m:m.filter((function(t){return !d.isTagDuplicate(c(t)?t.value:t)}));var O=w?g.sortby(p,r):p.slice(0,v);return this.state.dropdown.suggestions=O,O}for(r=g.caseSensitive?""+t:(""+t).toLowerCase();T<m.length;T++)i=this,l();this.state.dropdown.suggestions=f.concat(p);O=w?g.sortby(f.concat(p),r):f.concat(p).slice(0,v);return this.state.dropdown.suggestions=O,O},getMappedValue:function(t){var e=this.settings.dropdown.mapValueTo;return e?"function"==typeof e?e(t):t[e]||t.value:t.value},createListHTML:function(t){var e=this;return u([],t).map((function(t,i){"string"!=typeof t&&"number"!=typeof t||(t={value:t});var n=e.dropdown.getMappedValue(t);return n="string"==typeof n&&e.settings.dropdown.escapeHTML?d(n):n,e.settings.templates.dropdownItem.apply(e,[I(S({},t),{mappedValue:n}),e])})).join("")}}),C=null!=(C={refs:function(){this.DOM.dropdown=this.parseTemplate("dropdown",[this.settings]),this.DOM.dropdown.content=this.DOM.dropdown.querySelector("[data-selector='tagify-suggestions-wrapper']");},getHeaderRef:function(){return this.DOM.dropdown.querySelector("[data-selector='tagify-suggestions-header']")},getFooterRef:function(){return this.DOM.dropdown.querySelector("[data-selector='tagify-suggestions-footer']")},getAllSuggestionsRefs:function(){return N(this.DOM.dropdown.content.querySelectorAll(this.settings.classNames.dropdownItemSelector))},show:function(t){var e,i,n,a=this,o=this.settings,r="mix"==o.mode&&!o.enforceWhitelist,l=!o.whitelist||!o.whitelist.length,d="manual"==o.dropdown.position;if(t=void 0===t?this.state.inputText:t,!(l&&!r&&!o.templates.dropdownItemNoMatch||!1===o.dropdown.enabled||this.state.isLoading||this.settings.readonly)){if(clearTimeout(this.dropdownHide__bindEventsTimeout),this.suggestedListItems=this.dropdown.filterListItems(t),t&&!this.suggestedListItems.length&&(this.trigger("dropdown:noMatch",t),o.templates.dropdownItemNoMatch&&(n=o.templates.dropdownItemNoMatch.call(this,{value:t}))),!n){if(this.suggestedListItems.length)t&&r&&!this.state.editing.scope&&!s(this.suggestedListItems[0].value,t)&&this.suggestedListItems.unshift({value:t});else {if(!t||!r||this.state.editing.scope)return this.input.autocomplete.suggest.call(this),void this.dropdown.hide();this.suggestedListItems=[{value:t}];}i=""+(c(e=this.suggestedListItems[0])?e.value:e),o.autoComplete&&i&&0==i.indexOf(t)&&this.input.autocomplete.suggest.call(this,e);}this.dropdown.fill(n),o.dropdown.highlightFirst&&this.dropdown.highlightOption(this.DOM.dropdown.content.querySelector(o.classNames.dropdownItemSelector)),this.state.dropdown.visible||setTimeout(this.dropdown.events.binding.bind(this)),this.state.dropdown.visible=t||!0,this.state.dropdown.query=t,this.setStateSelection(),d||setTimeout((function(){a.dropdown.position(),a.dropdown.render();})),setTimeout((function(){a.trigger("dropdown:show",a.DOM.dropdown);}));}},hide:function(t){var e=this,i=this.DOM,n=i.scope,s=i.dropdown,a="manual"==this.settings.dropdown.position&&!t;if(s&&document.body.contains(s)&&!a)return window.removeEventListener("resize",this.dropdown.position),this.dropdown.events.binding.call(this,!1),n.setAttribute("aria-expanded",!1),s.parentNode.removeChild(s),setTimeout((function(){e.state.dropdown.visible=!1;}),100),this.state.dropdown.query=this.state.ddItemData=this.state.ddItemElm=this.state.selection=null,this.state.tag&&this.state.tag.value.length&&(this.state.flaggedTags[this.state.tag.baseOffset]=this.state.tag),this.trigger("dropdown:hide",s),this},toggle:function(t){this.dropdown[this.state.dropdown.visible&&!t?"hide":"show"]();},getAppendTarget:function(){var t=this.settings.dropdown;return "function"==typeof t.appendTarget?t.appendTarget():t.appendTarget},render:function(){var t,e,i,n=this,s=(t=this.DOM.dropdown,(i=t.cloneNode(!0)).style.cssText="position:fixed; top:-9999px; opacity:0",document.body.appendChild(i),e=i.clientHeight,i.parentNode.removeChild(i),e),a=this.settings,o=this.dropdown.getAppendTarget();return !1===a.dropdown.enabled||(this.DOM.scope.setAttribute("aria-expanded",!0),document.body.contains(this.DOM.dropdown)||(this.DOM.dropdown.classList.add(a.classNames.dropdownInital),this.dropdown.position(s),o.appendChild(this.DOM.dropdown),setTimeout((function(){return n.DOM.dropdown.classList.remove(a.classNames.dropdownInital)})))),this},fill:function(t){t="string"==typeof t?t:this.dropdown.createListHTML(t||this.suggestedListItems);var e,i=this.settings.templates.dropdownContent.call(this,t);this.DOM.dropdown.content.innerHTML=(e=i)?e.replace(/\>[\r\n ]+\</g,"><").split(/>\s+</).join("><").trim():"";},fillHeaderFooter:function(){var t=this.dropdown.filterListItems(this.state.dropdown.query),e=this.parseTemplate("dropdownHeader",[t]),i=this.parseTemplate("dropdownFooter",[t]),n=this.dropdown.getHeaderRef(),s=this.dropdown.getFooterRef();e&&(null==n||n.parentNode.replaceChild(e,n)),i&&(null==s||s.parentNode.replaceChild(i,s));},position:function(t){var e=this.settings.dropdown,i=this.dropdown.getAppendTarget();if("manual"!=e.position&&i){var n,s,a,o,r,l,d,c,u,g,h=this.DOM.dropdown,p=e.RTL,f=i===document.body,m=i===this.DOM.scope,v=f?window.pageYOffset:i.scrollTop,b=document.fullscreenElement||document.webkitFullscreenElement||document.documentElement,w=b.clientHeight,y=Math.max(b.clientWidth||0,window.innerWidth||0),T=y>480?e.position:"all",O=this.DOM["input"==T?"input":"scope"];if(t=t||h.clientHeight,this.state.dropdown.visible){if("text"==T?(a=(n=function(){var t=document.getSelection();if(t.rangeCount){var e,i,n=t.getRangeAt(0),s=n.startContainer,a=n.startOffset;if(a>0)return (i=document.createRange()).setStart(s,a-1),i.setEnd(s,a),{left:(e=i.getBoundingClientRect()).right,top:e.top,bottom:e.bottom};if(s.getBoundingClientRect)return s.getBoundingClientRect()}return {left:-9999,top:-9999}}()).bottom,s=n.top,o=n.left,r="auto"):(l=function(t){var e=0,i=0;for(t=t.parentNode;t&&t!=b;)e+=t.offsetTop||0,i+=t.offsetLeft||0,t=t.parentNode;return {top:e,left:i}}(i),n=O.getBoundingClientRect(),s=m?-1:n.top-l.top,a=(m?n.height:n.bottom-l.top)-1,o=m?-1:n.left-l.left,r=n.width+"px"),!f){var D=function(){for(var t=0,i=e.appendTarget.parentNode;i;)t+=i.scrollTop||0,i=i.parentNode;return t}();s+=D,a+=D;}var x;s=Math.floor(s),a=Math.ceil(a),c=y-o<120,u=((d=null!==(x=e.placeAbove)&&void 0!==x?x:w-n.bottom<t)?s:a)+v,g=o+(p&&n.width||0)+window.pageXOffset,g="text"==T&&c?"right: 0;":"left: ".concat(g,"px;"),h.style.cssText="".concat(g," top: ").concat(u,"px; min-width: ").concat(r,"; max-width: ").concat(r),h.setAttribute("placement",d?"top":"bottom"),h.setAttribute("position",T);}}}})?C:{},Object.getOwnPropertyDescriptors?Object.defineProperties(A,Object.getOwnPropertyDescriptors(C)):function(t,e){var i=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),i.push.apply(i,n);}return i}(Object(C)).forEach((function(t){Object.defineProperty(A,t,Object.getOwnPropertyDescriptor(C,t));})),A),L="@yaireo/tagify/",P={empty:"empty",exceed:"number of tags exceeded",pattern:"pattern mismatch",duplicate:"already exists",notAllowed:"not allowed"},j={wrapper:function(e,i){return '<tags class="'.concat(i.classNames.namespace," ").concat(i.mode?"".concat(i.classNames[i.mode+"Mode"]):""," ").concat(e.className,'"\n                    ').concat(i.readonly?"readonly":"","\n                    ").concat(i.disabled?"disabled":"","\n                    ").concat(i.required?"required":"","\n                    ").concat("select"===i.mode?"spellcheck='false'":"",'\n                    tabIndex="-1">\n                    ').concat(this.settings.templates.input.call(this),"\n                ").concat(t,"\n        </tags>")},input:function(){var e=this.settings,i=e.placeholder||t;return "<span ".concat(!e.readonly&&e.userInput?"contenteditable":"",' tabIndex="0" data-placeholder="').concat(i,'" aria-placeholder="').concat(e.placeholder||"",'"\n                    class="').concat(e.classNames.input,'"\n                    role="textbox"\n                    autocapitalize="false"\n                    autocorrect="off"\n                    aria-autocomplete="both"\n                    aria-multiline="').concat("mix"==e.mode,'"></span>')},tag:function(t,e){var i=e.settings;return '<tag title="'.concat(t.title||t.value,"\"\n                    contenteditable='false'\n                    tabIndex=\"").concat(i.a11y.focusableTags?0:-1,'"\n                    class="').concat(i.classNames.tag," ").concat(t.class||"",'"\n                    ').concat(this.getAttributes(t),">\n            <x title='' tabIndex=\"").concat(i.a11y.focusableTags?0:-1,'" class="').concat(i.classNames.tagX,"\" role='button' aria-label='remove tag'></x>\n            <div>\n                <span ").concat("select"===i.mode&&i.userInput?"contenteditable='true'":"",' autocapitalize="false" autocorrect="off" spellcheck=\'false\' class="').concat(i.classNames.tagText,'">').concat(t[i.tagTextProp]||t.value,"</span>\n            </div>\n        </tag>")},dropdown:function(t){var e=t.dropdown,i="manual"==e.position;return '<div class="'.concat(i?"":t.classNames.dropdown," ").concat(e.classname,'" role="listbox" aria-labelledby="dropdown" dir="').concat(e.RTL?"rtl":"","\">\n                    <div data-selector='tagify-suggestions-wrapper' class=\"").concat(t.classNames.dropdownWrapper,'"></div>\n                </div>')},dropdownContent:function(t){var e=this.settings.templates,i=this.state.dropdown.suggestions;return "\n            ".concat(e.dropdownHeader.call(this,i),"\n            ").concat(t,"\n            ").concat(e.dropdownFooter.call(this,i),"\n        ")},dropdownItem:function(t){return "<div ".concat(this.getAttributes(t),"\n                    class='").concat(this.settings.classNames.dropdownItem," ").concat(this.isTagDuplicate(t.value)?this.settings.classNames.dropdownItemSelected:""," ").concat(t.class||"",'\'\n                    tabindex="0"\n                    role="option">').concat(t.mappedValue||t.value,"</div>")},dropdownHeader:function(t){return "<header data-selector='tagify-suggestions-header' class=\"".concat(this.settings.classNames.dropdownHeader,'"></header>')},dropdownFooter:function(t){var e=t.length-this.settings.dropdown.maxItems;return e>0?"<footer data-selector='tagify-suggestions-footer' class=\"".concat(this.settings.classNames.dropdownFooter,'">\n                ').concat(e," more items. Refine your search.\n            </footer>"):""},dropdownItemNoMatch:null};function V(t,e){(null==e||e>t.length)&&(e=t.length);for(var i=0,n=new Array(e);i<e;i++)n[i]=t[i];return n}function R(t,e){return null!=e&&"undefined"!=typeof Symbol&&e[Symbol.hasInstance]?!!e[Symbol.hasInstance](t):t instanceof e}function F(t,e){return function(t){if(Array.isArray(t))return t}(t)||function(t,e){var i=null==t?null:"undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(null!=i){var n,s,a=[],o=!0,r=!1;try{for(i=i.call(t);!(o=(n=i.next()).done)&&(a.push(n.value),!e||a.length!==e);o=!0);}catch(t){r=!0,s=t;}finally{try{o||null==i.return||i.return();}finally{if(r)throw s}}return a}}(t,e)||function(t,e){if(!t)return;if("string"==typeof t)return V(t,e);var i=Object.prototype.toString.call(t).slice(8,-1);"Object"===i&&t.constructor&&(i=t.constructor.name);if("Map"===i||"Set"===i)return Array.from(i);if("Arguments"===i||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i))return V(t,e)}(t,e)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function H(t,e){(null==e||e>t.length)&&(e=t.length);for(var i=0,n=new Array(e);i<e;i++)n[i]=t[i];return n}function B(t,e,i){return e in t?Object.defineProperty(t,e,{value:i,enumerable:!0,configurable:!0,writable:!0}):t[e]=i,t}function W(t,e){return null!=e&&"undefined"!=typeof Symbol&&e[Symbol.hasInstance]?!!e[Symbol.hasInstance](t):t instanceof e}function U(t,e){return e=null!=e?e:{},Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(e)):function(t,e){var i=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),i.push.apply(i,n);}return i}(Object(e)).forEach((function(i){Object.defineProperty(t,i,Object.getOwnPropertyDescriptor(e,i));})),t}function q(t){return function(t){if(Array.isArray(t))return H(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(!t)return;if("string"==typeof t)return H(t,e);var i=Object.prototype.toString.call(t).slice(8,-1);"Object"===i&&t.constructor&&(i=t.constructor.name);if("Map"===i||"Set"===i)return Array.from(i);if("Arguments"===i||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i))return H(t,e)}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}var K={customBinding:function(){var t=this;this.customEventsList.forEach((function(e){t.on(e,t.settings.callbacks[e]);}));},binding:function(){var t,e=!(arguments.length>0&&void 0!==arguments[0])||arguments[0],i=this.settings,n=this.events.callbacks,s=e?"addEventListener":"removeEventListener";if(!this.state.mainEvents||!e){for(var a in this.state.mainEvents=e,e&&!this.listeners.main&&(this.events.bindGlobal.call(this),this.settings.isJQueryPlugin&&jQuery(this.DOM.originalInput).on("tagify.removeAllTags",this.removeAllTags.bind(this))),t=this.listeners.main=this.listeners.main||{keydown:["input",n.onKeydown.bind(this)],click:["scope",n.onClickScope.bind(this)],dblclick:"select"!=i.mode&&["scope",n.onDoubleClickScope.bind(this)],paste:["input",n.onPaste.bind(this)],drop:["input",n.onDrop.bind(this)],compositionstart:["input",n.onCompositionStart.bind(this)],compositionend:["input",n.onCompositionEnd.bind(this)]})t[a]&&this.DOM[t[a][0]][s](a,t[a][1]);var o=this.listeners.main.inputMutationObserver||new MutationObserver(n.onInputDOMChange.bind(this));o.disconnect(),"mix"==i.mode&&o.observe(this.DOM.input,{childList:!0}),this.events.bindOriginaInputListener.call(this);}},bindOriginaInputListener:function(t){var e=(t||0)+500;this.listeners.main&&(clearInterval(this.listeners.main.originalInputValueObserverInterval),this.listeners.main.originalInputValueObserverInterval=setInterval(this.events.callbacks.observeOriginalInputValue.bind(this),e));},bindGlobal:function(t){var e,i=this.events.callbacks,n=t?"removeEventListener":"addEventListener";if(this.listeners&&(t||!this.listeners.global)){this.listeners.global=this.listeners.global||[{type:this.isIE?"keydown":"input",target:this.DOM.input,cb:i[this.isIE?"onInputIE":"onInput"].bind(this)},{type:"keydown",target:window,cb:i.onWindowKeyDown.bind(this)},{type:"focusin",target:this.DOM.scope,cb:i.onFocusBlur.bind(this)},{type:"focusout",target:this.DOM.scope,cb:i.onFocusBlur.bind(this)},{type:"click",target:document,cb:i.onClickAnywhere.bind(this),useCapture:!0}];var s=!0,a=!1,o=void 0;try{for(var r,l=this.listeners.global[Symbol.iterator]();!(s=(r=l.next()).done);s=!0)(e=r.value).target[n](e.type,e.cb,!!e.useCapture);}catch(t){a=!0,o=t;}finally{try{s||null==l.return||l.return();}finally{if(a)throw o}}}},unbindGlobal:function(){this.events.bindGlobal.call(this,!0);},callbacks:{onFocusBlur:function(t){var e,i,n=this.settings,s=v.call(this,t.relatedTarget),a=m.call(this,t.relatedTarget),o=t.target.classList.contains(n.classNames.tagX),r="focusin"==t.type,l="focusout"==t.type;o&&"mix"!=n.mode&&this.DOM.input.focus(),s&&r&&!a&&!o&&this.toggleFocusClass(this.state.hasFocus=+new Date);var d=t.target?this.trim(this.DOM.input.textContent):"",c=null===(i=this.value)||void 0===i||null===(e=i[0])||void 0===e?void 0:e[n.tagTextProp],u=n.dropdown.enabled>=0,g={relatedTarget:t.relatedTarget},h=this.state.actions.selectOption&&(u||!n.dropdown.closeOnSelect),p=this.state.actions.addNew&&u;if(l){if(t.relatedTarget===this.DOM.scope)return this.dropdown.hide(),void this.DOM.input.focus();this.postUpdate(),n.onChangeAfterBlur&&this.triggerChangeEvent();}if(!(h||p||o))if(this.state.hasFocus=!(!r&&!s)&&+new Date,this.toggleFocusClass(this.state.hasFocus),"mix"!=n.mode){if(r){if(!n.focusable)return;var f=0===n.dropdown.enabled&&!this.state.dropdown.visible,b=!a||"select"===n.mode,w=this.DOM.scope.querySelector(this.settings.classNames.tagTextSelector);return this.trigger("focus",g),void(f&&b&&(this.dropdown.show(this.value.length?"":void 0),this.setRangeAtStartEnd(!1,w)))}if(l){if(this.trigger("blur",g),this.loading(!1),"select"==n.mode){if(this.value.length){var y=this.getTagElms()[0];d=this.trim(y.textContent);}c===d&&(d="");}d&&!this.state.actions.selectOption&&n.addTagOnBlur&&n.addTagOn.includes("blur")&&this.addTags(d,!0);}s||(this.DOM.input.removeAttribute("style"),this.dropdown.hide());}else r?this.trigger("focus",g):l&&(this.trigger("blur",g),this.loading(!1),this.dropdown.hide(),this.state.dropdown.visible=void 0,this.setStateSelection());},onCompositionStart:function(t){this.state.composing=!0;},onCompositionEnd:function(t){this.state.composing=!1;},onWindowKeyDown:function(t){var e,i=this.settings,n=document.activeElement,s=v.call(this,n)&&this.DOM.scope.contains(n),a=n===this.DOM.input,o=s&&n.hasAttribute("readonly"),r=this.DOM.scope.querySelector(this.settings.classNames.tagTextSelector),l=this.state.dropdown.visible;if(("Tab"===t.key&&l||this.state.hasFocus||s&&!o)&&!a){e=n.nextElementSibling;var d=t.target.classList.contains(i.classNames.tagX);switch(t.key){case"Backspace":i.readonly||this.state.editing||(this.removeTags(n),(e||this.DOM.input).focus());break;case"Enter":if(d)return void this.removeTags(t.target.parentNode);i.a11y.focusableTags&&m.call(this,n)&&setTimeout(this.editTag.bind(this),0,n);break;case"ArrowDown":this.state.dropdown.visible||"mix"==i.mode||this.dropdown.show();break;case"Tab":null==r||r.focus();}}},onKeydown:function(t){var e=this,i=this.settings;if(!this.state.composing&&i.userInput){"select"==i.mode&&i.enforceWhitelist&&this.value.length&&"Tab"!=t.key&&t.preventDefault();var n=this.trim(t.target.textContent);this.trigger("keydown",{event:t}),i.hooks.beforeKeyDown(t,{tagify:this}).then((function(s){if("mix"==i.mode){switch(t.key){case"Left":case"ArrowLeft":e.state.actions.ArrowLeft=!0;break;case"Delete":case"Backspace":if(e.state.editing)return;var a=document.getSelection(),o="Delete"==t.key&&a.anchorOffset==(a.anchorNode.length||0),r=a.anchorNode.previousSibling,d=1==a.anchorNode.nodeType||!a.anchorOffset&&r&&1==r.nodeType&&a.anchorNode.previousSibling;!function(t){var e=document.createElement("div");t.replace(/\&#?[0-9a-z]+;/gi,(function(t){return e.innerHTML=t,e.innerText}));}(e.DOM.input.innerHTML);var c,u,g,h=e.getTagElms(),f=1===a.anchorNode.length&&a.anchorNode.nodeValue==String.fromCharCode(8203);if("edit"==i.backspace&&d)return c=1==a.anchorNode.nodeType?null:a.anchorNode.previousElementSibling,setTimeout(e.editTag.bind(e),0,c),void t.preventDefault();if(p()&&W(d,Element))return g=l(d),d.hasAttribute("readonly")||d.remove(),e.DOM.input.focus(),void setTimeout((function(){T(g),e.DOM.input.click();}));if("BR"==a.anchorNode.nodeName)return;if((o||d)&&1==a.anchorNode.nodeType?u=0==a.anchorOffset?o?h[0]:null:h[Math.min(h.length,a.anchorOffset)-1]:o?u=a.anchorNode.nextElementSibling:W(d,Element)&&(u=d),3==a.anchorNode.nodeType&&!a.anchorNode.nodeValue&&a.anchorNode.previousElementSibling&&t.preventDefault(),(d||o)&&!i.backspace)return void t.preventDefault();if("Range"!=a.type&&!a.anchorOffset&&a.anchorNode==e.DOM.input&&"Delete"!=t.key)return void t.preventDefault();if("Range"!=a.type&&u&&u.hasAttribute("readonly"))return void T(l(u));"Delete"==t.key&&f&&y(a.anchorNode.nextSibling)&&e.removeTags(a.anchorNode.nextSibling);}return !0}var m="manual"==i.dropdown.position;switch(t.key){case"Backspace":"select"==i.mode&&i.enforceWhitelist&&e.value.length?e.removeTags():e.state.dropdown.visible&&"manual"!=i.dropdown.position||""!=t.target.textContent&&8203!=n.charCodeAt(0)||(!0===i.backspace?e.removeTags():"edit"==i.backspace&&setTimeout(e.editTag.bind(e),0));break;case"Esc":case"Escape":if(e.state.dropdown.visible)return;t.target.blur();break;case"Down":case"ArrowDown":e.state.dropdown.visible||e.dropdown.show();break;case"ArrowRight":var v=e.state.inputSuggestion||e.state.ddItemData;if(v&&i.autoComplete.rightKey)return void e.addTags([v],!0);break;case"Tab":return !0;case"Enter":if(e.state.dropdown.visible&&!m)return;t.preventDefault();var b=e.state.autoCompleteData||n;setTimeout((function(){e.state.dropdown.visible&&!m||e.state.actions.selectOption||!i.addTagOn.includes(t.key.toLowerCase())||(e.addTags([b],!0),e.state.autoCompleteData=null);}));}})).catch((function(t){return t}));}},onInput:function(t){this.postUpdate();var e=this.settings;if("mix"==e.mode)return this.events.callbacks.onMixTagsInput.call(this,t);var i=this.input.normalize.call(this,void 0,{trim:!1}),n=i.length>=e.dropdown.enabled,s={value:i,inputElm:this.DOM.input},a=this.validateTag({value:i});"select"==e.mode&&this.toggleScopeValidation(a),s.isValid=a,this.state.inputText!=i&&(this.input.set.call(this,i,!1),-1!=i.search(e.delimiters)?this.addTags(i)&&this.input.set.call(this):e.dropdown.enabled>=0&&this.dropdown[n?"show":"hide"](i),this.trigger("input",s));},onMixTagsInput:function(t){var e,i,n,s,a,o,r,l,d=this,c=this.settings,g=this.value.length,h=this.getTagElms(),f=document.createDocumentFragment(),m=window.getSelection().getRangeAt(0),v=[].map.call(h,(function(t){return y(t).value}));if("deleteContentBackward"==t.inputType&&p()&&this.events.callbacks.onKeydown.call(this,{target:t.target,key:"Backspace"}),O(this.getTagElms()),this.value.slice().forEach((function(t){t.readonly&&!v.includes(t.value)&&f.appendChild(d.createTagElem(t));})),f.childNodes.length&&(m.insertNode(f),this.setRangeAtStartEnd(!1,f.lastChild)),h.length!=g)return this.value=[].map.call(this.getTagElms(),(function(t){return y(t)})),void this.update({withoutChangeEvent:!0});if(this.hasMaxTags())return !0;if(window.getSelection&&(o=window.getSelection()).rangeCount>0&&3==o.anchorNode.nodeType){if((m=o.getRangeAt(0).cloneRange()).collapse(!0),m.setStart(o.focusNode,0),n=(e=m.toString().slice(0,m.endOffset)).split(c.pattern).length-1,(i=e.match(c.pattern))&&(s=e.slice(e.lastIndexOf(i[i.length-1]))),s){if(this.state.actions.ArrowLeft=!1,this.state.tag={prefix:s.match(c.pattern)[0],value:s.replace(c.pattern,"")},this.state.tag.baseOffset=o.baseOffset-this.state.tag.value.length,l=this.state.tag.value.match(c.delimiters))return this.state.tag.value=this.state.tag.value.replace(c.delimiters,""),this.state.tag.delimiters=l[0],this.addTags(this.state.tag.value,c.dropdown.clearOnSelect),void this.dropdown.hide();a=this.state.tag.value.length>=c.dropdown.enabled;try{r=(r=this.state.flaggedTags[this.state.tag.baseOffset]).prefix==this.state.tag.prefix&&r.value[0]==this.state.tag.value[0],this.state.flaggedTags[this.state.tag.baseOffset]&&!this.state.tag.value&&delete this.state.flaggedTags[this.state.tag.baseOffset];}catch(t){}(r||n<this.state.mixMode.matchedPatternCount)&&(a=!1);}else this.state.flaggedTags={};this.state.mixMode.matchedPatternCount=n;}setTimeout((function(){d.update({withoutChangeEvent:!0}),d.trigger("input",u({},d.state.tag,{textContent:d.DOM.input.textContent})),d.state.tag&&d.dropdown[a?"show":"hide"](d.state.tag.value);}),10);},onInputIE:function(t){var e=this;setTimeout((function(){e.events.callbacks.onInput.call(e,t);}));},observeOriginalInputValue:function(){this.DOM.originalInput.parentNode||this.destroy(),this.DOM.originalInput.value!=this.DOM.originalInput.tagifyValue&&this.loadOriginalValues();},onClickAnywhere:function(t){if(t.target!=this.DOM.scope&&!this.DOM.scope.contains(t.target)){this.toggleFocusClass(!1),this.state.hasFocus=!1;var e=t.target.closest(this.settings.classNames.dropdownSelector);(null==e?void 0:e.__tagify)!=this&&this.dropdown.hide();}},onClickScope:function(t){var e=this.settings,i=t.target.closest("."+e.classNames.tag),n=t.target===this.DOM.scope,s=+new Date-this.state.hasFocus;if(n&&"select"!=e.mode)this.DOM.input.focus();else {if(!t.target.classList.contains(e.classNames.tagX))return i&&!this.state.editing?(this.trigger("click",{tag:i,index:this.getNodeIndex(i),data:y(i),event:t}),void(1!==e.editTags&&1!==e.editTags.clicks&&"select"!=e.mode||this.events.callbacks.onDoubleClickScope.call(this,t))):void(t.target==this.DOM.input&&("mix"==e.mode&&this.fixFirefoxLastTagNoCaret(),s>500||!e.focusable)?this.state.dropdown.visible?this.dropdown.hide():0===e.dropdown.enabled&&"mix"!=e.mode&&this.dropdown.show(this.value.length?"":void 0):"select"!=e.mode||0!==e.dropdown.enabled||this.state.dropdown.visible||(this.events.callbacks.onDoubleClickScope.call(this,U(function(t){for(var e=1;e<arguments.length;e++){var i=null!=arguments[e]?arguments[e]:{},n=Object.keys(i);"function"==typeof Object.getOwnPropertySymbols&&(n=n.concat(Object.getOwnPropertySymbols(i).filter((function(t){return Object.getOwnPropertyDescriptor(i,t).enumerable})))),n.forEach((function(e){B(t,e,i[e]);}));}return t}({},t),{target:this.getTagElms()[0]})),!e.userInput&&this.dropdown.show()));this.removeTags(t.target.parentNode);}},onPaste:function(t){var e=this;t.preventDefault();var i,n,s,a=this.settings;if(!a.userInput)return !1;a.readonly||(n=t.clipboardData||window.clipboardData,s=n.getData("Text"),a.hooks.beforePaste(t,{tagify:this,pastedText:s,clipboardData:n}).then((function(a){void 0===a&&(a=s),a&&(e.injectAtCaret(a,window.getSelection().getRangeAt(0)),"mix"==e.settings.mode?e.events.callbacks.onMixTagsInput.call(e,t):e.settings.pasteAsTags?i=e.addTags(e.state.inputText+a,!0):(e.state.inputText=a,e.dropdown.show(a))),e.trigger("paste",{event:t,pastedText:s,clipboardData:n,tagsElems:i});})).catch((function(t){return t})));},onDrop:function(t){t.preventDefault();},onEditTagInput:function(t,e){var i,n=t.closest("."+this.settings.classNames.tag),s=this.getNodeIndex(n),a=y(n),o=this.input.normalize.call(this,t),r=(B(i={},this.settings.tagTextProp,o),B(i,"__tagId",a.__tagId),i),l=this.validateTag(r);this.editTagChangeDetected(u(a,r))||!0!==t.originalIsValid||(l=!0),n.classList.toggle(this.settings.classNames.tagInvalid,!0!==l),a.__isValid=l,n.title=!0===l?a.title||a.value:l,o.length>=this.settings.dropdown.enabled&&(this.state.editing&&(this.state.editing.value=o),this.dropdown.show(o)),this.trigger("edit:input",{tag:n,index:s,data:u({},this.value[s],{newValue:o}),event:e});},onEditTagPaste:function(t,e){var i=(e.clipboardData||window.clipboardData).getData("Text");e.preventDefault();var n=w(i);this.setRangeAtStartEnd(!1,n);},onEditTagClick:function(t,e){this.events.callbacks.onClickScope.call(this,e);},onEditTagFocus:function(t){this.state.editing={scope:t,input:t.querySelector("[contenteditable]")};},onEditTagBlur:function(t,e){var i=m.call(this,e.relatedTarget);if("select"==this.settings.mode&&i&&e.relatedTarget.contains(e.target))this.dropdown.hide();else if(this.state.editing&&(this.state.hasFocus||this.toggleFocusClass(),this.DOM.scope.contains(document.activeElement)||this.trigger("blur",{}),this.DOM.scope.contains(t))){var n,s,a,o=this.settings,r=t.closest("."+o.classNames.tag),l=y(r),d=this.input.normalize.call(this,t),c=(B(n={},o.tagTextProp,d),B(n,"__tagId",l.__tagId),n),g=l.__originalData,h=this.editTagChangeDetected(u(l,c)),p=this.validateTag(c);if(d)if(h){var f;if(s=this.hasMaxTags(),a=u({},g,(B(f={},o.tagTextProp,this.trim(d)),B(f,"__isValid",p),f)),o.transformTag.call(this,a,g),!0!==(p=(!s||!0===g.__isValid)&&this.validateTag(a))){if(this.trigger("invalid",{data:a,tag:r,message:p}),o.editTags.keepInvalid)return;o.keepInvalidTags?a.__isValid=p:a=g;}else o.keepInvalidTags&&(delete a.title,delete a["aria-invalid"],delete a.class);this.onEditTagDone(r,a);}else this.onEditTagDone(r,g);else this.onEditTagDone(r);}},onEditTagkeydown:function(t,e){if(!this.state.composing)switch(this.trigger("edit:keydown",{event:t}),t.key){case"Esc":case"Escape":this.state.editing=!1,!!e.__tagifyTagData.__originalData.value?e.parentNode.replaceChild(e.__tagifyTagData.__originalHTML,e):e.remove();break;case"Enter":case"Tab":t.preventDefault();setTimeout((function(){return t.target.blur()}),0);}},onDoubleClickScope:function(t){var e=t.target.closest("."+this.settings.classNames.tag);if(e){var i,n,s=y(e),a=this.settings;!1!==(null==s?void 0:s.editable)&&(i=e.classList.contains(this.settings.classNames.tagEditing),n=e.hasAttribute("readonly"),a.readonly||i||n||!this.settings.editTags||!a.userInput||(this.events.callbacks.onEditTagFocus.call(this,e),this.editTag(e)),this.toggleFocusClass(!0),"select"!=a.mode&&this.trigger("dblclick",{tag:e,index:this.getNodeIndex(e),data:y(e)}));}},onInputDOMChange:function(t){var e=this;t.forEach((function(t){t.addedNodes.forEach((function(t){if("<div><br></div>"==t.outerHTML)t.replaceWith(document.createElement("br"));else if(1==t.nodeType&&t.querySelector(e.settings.classNames.tagSelector)){var i,n=document.createTextNode("");3==t.childNodes[0].nodeType&&"BR"!=t.previousSibling.nodeName&&(n=document.createTextNode("\n")),(i=t).replaceWith.apply(i,q([n].concat(q(q(t.childNodes).slice(0,-1))))),T(n);}else if(m.call(e,t)){var s;if(3!=(null===(s=t.previousSibling)||void 0===s?void 0:s.nodeType)||t.previousSibling.textContent||t.previousSibling.remove(),t.previousSibling&&"BR"==t.previousSibling.nodeName){t.previousSibling.replaceWith("\n​");for(var a=t.nextSibling,o="";a;)o+=a.textContent,a=a.nextSibling;o.trim()&&T(t.previousSibling);}else t.previousSibling&&!y(t.previousSibling)||t.before("​");}})),t.removedNodes.forEach((function(t){t&&"BR"==t.nodeName&&m.call(e,i)&&(e.removeTags(i),e.fixFirefoxLastTagNoCaret());}));}));var i=this.DOM.input.lastChild;i&&""==i.nodeValue&&i.remove(),i&&"BR"==i.nodeName||this.DOM.input.appendChild(document.createElement("br"));}}};function z(t,e){(null==e||e>t.length)&&(e=t.length);for(var i=0,n=new Array(e);i<e;i++)n[i]=t[i];return n}function X(t,e,i){return e in t?Object.defineProperty(t,e,{value:i,enumerable:!0,configurable:!0,writable:!0}):t[e]=i,t}function J(t,e){return null!=e&&"undefined"!=typeof Symbol&&e[Symbol.hasInstance]?!!e[Symbol.hasInstance](t):t instanceof e}function G(t){for(var e=1;e<arguments.length;e++){var i=null!=arguments[e]?arguments[e]:{},n=Object.keys(i);"function"==typeof Object.getOwnPropertySymbols&&(n=n.concat(Object.getOwnPropertySymbols(i).filter((function(t){return Object.getOwnPropertyDescriptor(i,t).enumerable})))),n.forEach((function(e){X(t,e,i[e]);}));}return t}function $$1(t){return function(t){if(Array.isArray(t))return z(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(!t)return;if("string"==typeof t)return z(t,e);var i=Object.prototype.toString.call(t).slice(8,-1);"Object"===i&&t.constructor&&(i=t.constructor.name);if("Map"===i||"Set"===i)return Array.from(i);if("Arguments"===i||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i))return z(t,e)}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function Q(t,e){if(!t){n.warn("input element not found",t);var i=new Proxy(this,{get:function(){return function(){return i}}});return i}if(t.__tagify)return n.warn("input element is already Tagified - Same instance is returned.",t),t.__tagify;var s;u(this,function(t){var e=document.createTextNode(""),i={};function s(t,i,n){n&&i.split(/\s+/g).forEach((function(i){return e[t+"EventListener"].call(e,i,n)}));}return {removeAllCustomListeners:function(){Object.entries(i).forEach((function(t){var e=F(t,2),i=e[0];e[1].forEach((function(t){return s("remove",i,t)}));})),i={};},off:function(t,e){return t&&(e?s("remove",t,e):t.split(/\s+/g).forEach((function(t){var e;null===(e=i[t])||void 0===e||e.forEach((function(e){return s("remove",t,e)})),delete i[t];}))),this},on:function(t,e){return e&&"function"==typeof e&&(t.split(/\s+/g).forEach((function(t){Array.isArray(i[t])?i[t].push(e):i[t]=[e];})),s("add",t,e)),this},trigger:function(i,s,a){var o;if(a=a||{cloneData:!0},i)if(t.settings.isJQueryPlugin)"remove"==i&&(i="removeTag"),jQuery(t.DOM.originalInput).triggerHandler(i,[s]);else {try{var r="object"==typeof s?s:{value:s};if((r=a.cloneData?u({},r):r).tagify=this,s.event&&(r.event=this.cloneEvent(s.event)),R(s,Object))for(var l in s)R(s[l],HTMLElement)&&(r[l]=s[l]);o=new CustomEvent(i,{detail:r});}catch(t){n.warn(t);}e.dispatchEvent(o);}}}}(this)),this.isFirefox=/firefox|fxios/i.test(navigator.userAgent)&&!/seamonkey/i.test(navigator.userAgent),this.isIE=window.document.documentMode,e=e||{},this.getPersistedData=(s=e.id,function(t){var e;if(s){var i,n="/"+t;if(1===(null===(e=localStorage)||void 0===e?void 0:e.getItem(L+s+"/v")))try{i=JSON.parse(localStorage[L+s+n]);}catch(t){}return i}}),this.setPersistedData=function(t){var e;return t?(null===(e=localStorage)||void 0===e||e.setItem(L+t+"/v",1),function(e,i){var n,s="/"+i,a=JSON.stringify(e);e&&i&&(null===(n=localStorage)||void 0===n||n.setItem(L+t+s,a),dispatchEvent(new Event("storage")));}):function(){}}(e.id),this.clearPersistedData=function(t){return function(e){var i=L+"/"+t+"/";if(e)localStorage.removeItem(i+e);else for(var n in localStorage)n.includes(i)&&localStorage.removeItem(n);}}(e.id),this.applySettings(t,e),this.state={inputText:"",editing:!1,composing:!1,actions:{},mixMode:{},dropdown:{},flaggedTags:{}},this.value=[],this.listeners={},this.DOM={},this.build(t),_.call(this),this.getCSSVars(),this.loadOriginalValues(),this.events.customBinding.call(this),this.events.binding.call(this),t.autofocus&&this.DOM.input.focus(),t.__tagify=this;}Q.prototype={_dropdown:k,placeCaretAfterNode:T,getSetTagData:y,helpers:{sameStr:s,removeCollectionProp:a,omit:o,isObject:c,parseHTML:r,escapeHTML:d,extend:u,concatWithoutDups:g,getUID:f,isNodeTag:m},customEventsList:["change","add","remove","invalid","input","paste","click","keydown","focus","blur","edit:input","edit:beforeUpdate","edit:updated","edit:start","edit:keydown","dropdown:show","dropdown:hide","dropdown:select","dropdown:updated","dropdown:noMatch","dropdown:scroll"],dataProps:["__isValid","__removed","__originalData","__originalHTML","__tagId"],trim:function(t){return this.settings.trim&&t&&"string"==typeof t?t.trim():t},parseHTML:r,templates:j,parseTemplate:function(t,e){return r((t=this.settings.templates[t]||t).apply(this,e))},set whitelist(t){var e=t&&Array.isArray(t);this.settings.whitelist=e?t:[],this.setPersistedData(e?t:[],"whitelist");},get whitelist(){return this.settings.whitelist},set userInput(t){this.settings.userInput=!!t,this.setContentEditable(!!t);},get userInput(){return this.settings.userInput},generateClassSelectors:function(t){var e=function(e){var i=e;Object.defineProperty(t,i+"Selector",{get:function(){return "."+this[i].split(" ")[0]}});};for(var i in t)e(i);},applySettings:function(t,e){var i,n;D.templates=this.templates;var s=u({},D,"mix"==e.mode?{dropdown:{position:"text"}}:{}),a=this.settings=u({},s,e);if(a.disabled=t.hasAttribute("disabled"),a.readonly=a.readonly||t.hasAttribute("readonly"),a.placeholder=d(t.getAttribute("placeholder")||a.placeholder||""),a.required=t.hasAttribute("required"),this.generateClassSelectors(a.classNames),this.isIE&&(a.autoComplete=!1),["whitelist","blacklist"].forEach((function(e){var i=t.getAttribute("data-"+e);i&&J(i=i.split(a.delimiters),Array)&&(a[e]=i);})),"autoComplete"in e&&!c(e.autoComplete)&&(a.autoComplete=D.autoComplete,a.autoComplete.enabled=e.autoComplete),"mix"==a.mode&&(a.pattern=a.pattern||/@/,a.autoComplete.rightKey=!0,a.delimiters=e.delimiters||null,a.tagTextProp&&!a.dropdown.searchKeys.includes(a.tagTextProp)&&a.dropdown.searchKeys.push(a.tagTextProp)),t.pattern)try{a.pattern=new RegExp(t.pattern);}catch(t){}if(a.delimiters){a._delimiters=a.delimiters;try{a.delimiters=new RegExp(this.settings.delimiters,"g");}catch(t){}}a.disabled&&(a.userInput=!1),this.TEXTS=G({},P,a.texts||{}),"select"==a.mode&&(a.dropdown.includeSelectedTags=!0),("select"!=a.mode||(null===(i=e.dropdown)||void 0===i?void 0:i.enabled))&&a.userInput||(a.dropdown.enabled=0),a.dropdown.appendTarget=(null===(n=e.dropdown)||void 0===n?void 0:n.appendTarget)||document.body,void 0===a.dropdown.includeSelectedTags&&(a.dropdown.includeSelectedTags=a.duplicates);var o=this.getPersistedData("whitelist");Array.isArray(o)&&(this.whitelist=Array.isArray(a.whitelist)?g(a.whitelist,o):o);},getAttributes:function(t){var e,i=this.getCustomAttributes(t),n="";for(e in i)n+=" "+e+(void 0!==t[e]?'="'.concat(i[e],'"'):"");return n},getCustomAttributes:function(t){if(!c(t))return "";var e,i={};for(e in t)"__"!=e.slice(0,2)&&"class"!=e&&t.hasOwnProperty(e)&&void 0!==t[e]&&(i[e]=d(t[e]));return i},setStateSelection:function(){var t=window.getSelection(),e={anchorOffset:t.anchorOffset,anchorNode:t.anchorNode,range:t.getRangeAt&&t.rangeCount&&t.getRangeAt(0)};return this.state.selection=e,e},getCSSVars:function(){var t,e,i,n=getComputedStyle(this.DOM.scope,null);this.CSSVars={tagHideTransition:(t=function(t){if(!t)return {};var e=(t=t.trim().split(" ")[0]).split(/\d+/g).filter((function(t){return t})).pop().trim();return {value:+t.split(e).filter((function(t){return t}))[0].trim(),unit:e}}((i="tag-hide-transition",n.getPropertyValue("--"+i))),e=t.value,"s"==t.unit?1e3*e:e)};},build:function(t){var e=this.DOM,i=t.closest("label");this.settings.mixMode.integrated?(e.originalInput=null,e.scope=t,e.input=t):(e.originalInput=t,e.originalInput_tabIndex=t.tabIndex,e.scope=this.parseTemplate("wrapper",[t,this.settings]),e.input=e.scope.querySelector(this.settings.classNames.inputSelector),t.parentNode.insertBefore(e.scope,t),t.tabIndex=-1),i&&i.setAttribute("for","");},destroy:function(){var t;this.events.unbindGlobal.call(this),null===(t=this.DOM.scope.parentNode)||void 0===t||t.removeChild(this.DOM.scope),this.DOM.originalInput.tabIndex=this.DOM.originalInput_tabIndex,delete this.DOM.originalInput.__tagify,this.dropdown.hide(!0),this.removeAllCustomListeners(),clearTimeout(this.dropdownHide__bindEventsTimeout),clearInterval(this.listeners.main.originalInputValueObserverInterval);},loadOriginalValues:function(t){var e,i=this.settings;if(this.state.blockChangeEvent=!0,void 0===t){var n=this.getPersistedData("value");t=n&&!this.DOM.originalInput.value?n:i.mixMode.integrated?this.DOM.input.textContent:this.DOM.originalInput.value;}if(this.removeAllTags(),t)if("mix"==i.mode)this.parseMixTags(t),(e=this.DOM.input.lastChild)&&"BR"==e.tagName||this.DOM.input.insertAdjacentHTML("beforeend","<br>");else {try{J(JSON.parse(t),Array)&&(t=JSON.parse(t));}catch(t){}this.addTags(t,!0).forEach((function(t){return t&&t.classList.add(i.classNames.tagNoAnimation)}));}else this.postUpdate();this.state.lastOriginalValueReported=i.mixMode.integrated?"":this.DOM.originalInput.value;},cloneEvent:function(t){var e={};for(var i in t)"path"!=i&&(e[i]=t[i]);return e},loading:function(t){return this.state.isLoading=t,this.DOM.scope.classList[t?"add":"remove"](this.settings.classNames.scopeLoading),this},tagLoading:function(t,e){return t&&t.classList[e?"add":"remove"](this.settings.classNames.tagLoading),this},toggleClass:function(t,e){"string"==typeof t&&this.DOM.scope.classList.toggle(t,e);},toggleScopeValidation:function(t){var e=!0===t||void 0===t;!this.settings.required&&t&&t===this.TEXTS.empty&&(e=!0),this.toggleClass(this.settings.classNames.tagInvalid,!e),this.DOM.scope.title=e?"":t;},toggleFocusClass:function(t){this.toggleClass(this.settings.classNames.focus,!!t);},setPlaceholder:function(t){var e=this;["data","aria"].forEach((function(i){return e.DOM.input.setAttribute("".concat(i,"-placeholder"),t)}));},triggerChangeEvent:function(){if(!this.settings.mixMode.integrated){var t=this.DOM.originalInput,e=this.state.lastOriginalValueReported!==t.value,i=new CustomEvent("change",{bubbles:!0});e&&(this.state.lastOriginalValueReported=t.value,i.simulated=!0,t._valueTracker&&t._valueTracker.setValue(Math.random()),t.dispatchEvent(i),this.trigger("change",this.state.lastOriginalValueReported),t.value=this.state.lastOriginalValueReported);}},events:K,fixFirefoxLastTagNoCaret:function(){},setRangeAtStartEnd:function(t,e){if(e){t="number"==typeof t?t:!!t,e=e.lastChild||e;var i=document.getSelection();if(J(i.focusNode,Element)&&!this.DOM.input.contains(i.focusNode))return !0;try{i.rangeCount>=1&&["Start","End"].forEach((function(n){return i.getRangeAt(0)["set"+n](e,t||e.length)}));}catch(t){console.warn(t);}}},insertAfterTag:function(t,e){if(e=e||this.settings.mixMode.insertAfterTag,t&&t.parentNode&&e)return e="string"==typeof e?document.createTextNode(e):e,t.parentNode.insertBefore(e,t.nextSibling),e},editTagChangeDetected:function(t){var e=t.__originalData;for(var i in e)if(!this.dataProps.includes(i)&&t[i]!=e[i])return !0;return !1},getTagTextNode:function(t){return t.querySelector(this.settings.classNames.tagTextSelector)},setTagTextNode:function(t,e){this.getTagTextNode(t).innerHTML=d(e);},editTag:function(t,e){var i=this;t=t||this.getLastTag(),e=e||{};var s=this.settings,a=this.getTagTextNode(t),o=this.getNodeIndex(t),r=y(t),l=this.events.callbacks,d=!0,c="select"==s.mode;if(!c&&this.dropdown.hide(),a){if(!J(r,Object)||!("editable"in r)||r.editable)return r=y(t,{__originalData:u({},r),__originalHTML:t.cloneNode(!0)}),y(r.__originalHTML,r.__originalData),a.setAttribute("contenteditable",!0),t.classList.add(s.classNames.tagEditing),this.events.callbacks.onEditTagFocus.call(this,t),a.addEventListener("click",l.onEditTagClick.bind(this,t)),a.addEventListener("blur",l.onEditTagBlur.bind(this,this.getTagTextNode(t))),a.addEventListener("input",l.onEditTagInput.bind(this,a)),a.addEventListener("paste",l.onEditTagPaste.bind(this,a)),a.addEventListener("keydown",(function(e){return l.onEditTagkeydown.call(i,e,t)})),a.addEventListener("compositionstart",l.onCompositionStart.bind(this)),a.addEventListener("compositionend",l.onCompositionEnd.bind(this)),e.skipValidation||(d=this.editTagToggleValidity(t)),a.originalIsValid=d,this.trigger("edit:start",{tag:t,index:o,data:r,isValid:d}),a.focus(),!c&&this.setRangeAtStartEnd(!1,a),0===s.dropdown.enabled&&!c&&this.dropdown.show(),this.state.hasFocus=!0,this}else n.warn("Cannot find element in Tag template: .",s.classNames.tagTextSelector);},editTagToggleValidity:function(t,e){var i;if(e=e||y(t))return (i=!("__isValid"in e)||!0===e.__isValid)||this.removeTagsFromValue(t),this.update(),t.classList.toggle(this.settings.classNames.tagNotAllowed,!i),e.__isValid=i,e.__isValid;n.warn("tag has no data: ",t,e);},onEditTagDone:function(t,e){t=t||this.state.editing.scope,e=e||{};var i,n,s=this.settings,a={tag:t,index:this.getNodeIndex(t),previousData:y(t),data:e};this.trigger("edit:beforeUpdate",a,{cloneData:!1}),this.state.editing=!1,delete e.__originalData,delete e.__originalHTML,t&&t.parentNode&&((void 0!==(n=e[s.tagTextProp])?null===(i=(n+="").trim)||void 0===i?void 0:i.call(n):s.tagTextProp in e?void 0:e.value)?(t=this.replaceTag(t,e),this.editTagToggleValidity(t,e),s.a11y.focusableTags?t.focus():"select"!=s.mode&&T(t)):this.removeTags(t)),this.trigger("edit:updated",a),s.dropdown.closeOnSelect&&this.dropdown.hide(),this.settings.keepInvalidTags&&this.reCheckInvalidTags();},replaceTag:function(t,e){e&&""!==e.value&&void 0!==e.value||(e=t.__tagifyTagData),e.__isValid&&1!=e.__isValid&&u(e,this.getInvalidTagAttrs(e,e.__isValid));var i=this.createTagElem(e);return t.parentNode.replaceChild(i,t),this.updateValueByDOMTags(),i},updateValueByDOMTags:function(){var t=this;this.value.length=0;var e=this.settings.classNames,i=[e.tagNotAllowed.split(" ")[0],e.tagHide];[].forEach.call(this.getTagElms(),(function(e){$$1(e.classList).some((function(t){return i.includes(t)}))||t.value.push(y(e));})),this.update(),this.dropdown.refilter();},injectAtCaret:function(t,e){var i;if(e=e||(null===(i=this.state.selection)||void 0===i?void 0:i.range),"string"==typeof t&&(t=document.createTextNode(t)),!e&&t)return this.appendMixTags(t),this;var n=w(t,e);return this.setRangeAtStartEnd(!1,n),this.updateValueByDOMTags(),this.update(),this},input:{set:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",e=!(arguments.length>1&&void 0!==arguments[1])||arguments[1],i=this.settings,n=i.dropdown.closeOnSelect;this.state.inputText=t,e&&(this.DOM.input.innerHTML=d(""+t),t&&this.toggleClass(i.classNames.empty,!this.DOM.input.innerHTML)),!t&&n&&this.dropdown.hide.bind(this),this.input.autocomplete.suggest.call(this),this.input.validate.call(this);},raw:function(){return this.DOM.input.textContent},validate:function(){var t=!this.state.inputText||!0===this.validateTag({value:this.state.inputText});return this.DOM.input.classList.toggle(this.settings.classNames.inputInvalid,!t),t},normalize:function(t,e){var i=t||this.DOM.input,n=[];i.childNodes.forEach((function(t){return 3==t.nodeType&&n.push(t.nodeValue)})),n=n.join("\n");try{n=n.replace(/(?:\r\n|\r|\n)/g,this.settings.delimiters.source.charAt(0));}catch(t){}return n=n.replace(/\s/g," "),(null==e?void 0:e.trim)?this.trim(n):n},autocomplete:{suggest:function(t){if(this.settings.autoComplete.enabled){"object"!=typeof(t=t||{value:""})&&(t={value:t});var e=this.dropdown.getMappedValue(t);if("number"!=typeof e){var i=this.state.inputText.toLowerCase(),n=e.substr(0,this.state.inputText.length).toLowerCase(),s=e.substring(this.state.inputText.length);e&&this.state.inputText&&n==i?(this.DOM.input.setAttribute("data-suggest",s),this.state.inputSuggestion=t):(this.DOM.input.removeAttribute("data-suggest"),delete this.state.inputSuggestion);}}},set:function(t){var e=this.DOM.input.getAttribute("data-suggest"),i=t||(e?this.state.inputText+e:null);return !!i&&("mix"==this.settings.mode?this.replaceTextWithNode(document.createTextNode(this.state.tag.prefix+i)):(this.input.set.call(this,i),this.setRangeAtStartEnd(!1,this.DOM.input)),this.input.autocomplete.suggest.call(this),this.dropdown.hide(),!0)}}},getTagIdx:function(t){return this.value.findIndex((function(e){return e.__tagId==(t||{}).__tagId}))},getNodeIndex:function(t){var e=0;if(t)for(;t=t.previousElementSibling;)e++;return e},getTagElms:function(){for(var t=arguments.length,e=new Array(t),i=0;i<t;i++)e[i]=arguments[i];var n="."+$$1(this.settings.classNames.tag.split(" ")).concat($$1(e)).join(".");return [].slice.call(this.DOM.scope.querySelectorAll(n))},getLastTag:function(){var t=this.settings.classNames,e=this.DOM.scope.querySelectorAll("".concat(t.tagSelector,":not(.").concat(t.tagHide,"):not([readonly])"));return e[e.length-1]},isTagDuplicate:function(t,e,i){var n=0,a=!0,o=!1,r=void 0;try{for(var l,d=this.value[Symbol.iterator]();!(a=(l=d.next()).done);a=!0){var c=l.value;s(this.trim(""+t),c.value,e)&&i!=c.__tagId&&n++;}}catch(t){o=!0,r=t;}finally{try{a||null==d.return||d.return();}finally{if(o)throw r}}return n},getTagIndexByValue:function(t){var e=this,i=[],n=this.settings.dropdown.caseSensitive;return this.getTagElms().forEach((function(a,o){a.__tagifyTagData&&s(e.trim(a.__tagifyTagData.value),t,n)&&i.push(o);})),i},getTagElmByValue:function(t){var e=this.getTagIndexByValue(t)[0];return this.getTagElms()[e]},flashTag:function(t){var e=this;t&&(t.classList.add(this.settings.classNames.tagFlash),setTimeout((function(){t.classList.remove(e.settings.classNames.tagFlash);}),100));},isTagBlacklisted:function(t){return t=this.trim(t.toLowerCase()),this.settings.blacklist.filter((function(e){return (""+e).toLowerCase()==t})).length},isTagWhitelisted:function(t){return !!this.getWhitelistItem(t)},getWhitelistItem:function(t,e,i){e=e||"value";var n,a=this.settings;return (i=i||a.whitelist).some((function(i){var o="object"==typeof i?i[e]||i.value:i;if(s(o,t,a.dropdown.caseSensitive,a.trim))return n="object"==typeof i?i:{value:i},!0})),n||"value"!=e||"value"==a.tagTextProp||(n=this.getWhitelistItem(t,a.tagTextProp,i)),n},validateTag:function(t){var e=this.settings,i="value"in t?"value":e.tagTextProp,n=this.trim(t[i]+"");return (t[i]+"").trim()?"mix"!=e.mode&&e.pattern&&J(e.pattern,RegExp)&&!e.pattern.test(n)?this.TEXTS.pattern:!e.duplicates&&this.isTagDuplicate(n,e.dropdown.caseSensitive,t.__tagId)?this.TEXTS.duplicate:this.isTagBlacklisted(n)||e.enforceWhitelist&&!this.isTagWhitelisted(n)?this.TEXTS.notAllowed:!e.validate||e.validate(t):this.TEXTS.empty},getInvalidTagAttrs:function(t,e){return {"aria-invalid":!0,class:"".concat(t.class||""," ").concat(this.settings.classNames.tagNotAllowed).trim(),title:e}},hasMaxTags:function(){return this.value.length>=this.settings.maxTags&&this.TEXTS.exceed},setReadonly:function(t,e){var i=this.settings;this.DOM.scope.contains(document.activeElement)&&document.activeElement.blur(),i[e||"readonly"]=t,this.DOM.scope[(t?"set":"remove")+"Attribute"](e||"readonly",!0),this.settings.userInput=!0,this.setContentEditable(!t);},setContentEditable:function(t){this.DOM.input.contentEditable=t,this.DOM.input.tabIndex=t?0:-1;},setDisabled:function(t){this.setReadonly(t,"disabled");},normalizeTags:function(t){var e=this,i=this.settings,n=i.whitelist,s=i.delimiters,a=i.mode,o=i.tagTextProp,r=[],l=!!n&&J(n[0],Object),d=Array.isArray(t),g=d&&t[0].value,h=function(t){return (t+"").split(s).reduce((function(t,i){var n,s=e.trim(i);return s&&t.push((X(n={},o,s),X(n,"value",s),n)),t}),[])};if("number"==typeof t&&(t=t.toString()),"string"==typeof t){if(!t.trim())return [];t=h(t);}else d&&(t=t.reduce((function(t,i){if(c(i)){var n=u({},i);o in n||(o="value"),n[o]=e.trim(n[o]),(n[o]||0===n[o])&&t.push(n);}else if(null!=i&&""!==i&&void 0!==i){var s;(s=t).push.apply(s,$$1(h(i)));}return t}),[]));return l&&!g&&(t.forEach((function(t){var i=r.map((function(t){return t.value})),n=e.dropdown.filterListItems.call(e,t[o],{exact:!0});e.settings.duplicates||(n=n.filter((function(t){return !i.includes(t.value)})));var s=n.length>1?e.getWhitelistItem(t[o],o,n):n[0];s&&J(s,Object)?r.push(s):"mix"!=a&&(null==t.value&&(t.value=t[o]),r.push(t));})),r.length&&(t=r)),t},parseMixTags:function(t){var e=this,i=this.settings,n=i.mixTagsInterpolator,s=i.duplicates,a=i.transformTag,o=i.enforceWhitelist,r=i.maxTags,l=i.tagTextProp,d=[];t=t.split(n[0]).map((function(t,i){var c,u,g,h=t.split(n[1]),p=h[0],f=d.length==r;try{if(p==+p)throw Error;u=JSON.parse(p);}catch(t){u=e.normalizeTags(p)[0]||{value:p};}if(a.call(e,u),f||!(h.length>1)||o&&!e.isTagWhitelisted(u.value)||!s&&e.isTagDuplicate(u.value)){if(t)return i?n[0]+t:t}else u[c=u[l]?l:"value"]=e.trim(u[c]),g=e.createTagElem(u),d.push(u),g.classList.add(e.settings.classNames.tagNoAnimation),h[0]=g.outerHTML,e.value.push(u);return h.join("")})).join(""),this.DOM.input.innerHTML=t,this.DOM.input.appendChild(document.createTextNode("")),this.DOM.input.normalize();var c=this.getTagElms();return c.forEach((function(t,e){return y(t,d[e])})),this.update({withoutChangeEvent:!0}),O(c,this.state.hasFocus),t},replaceTextWithNode:function(t,e){if(this.state.tag||e){e=e||this.state.tag.prefix+this.state.tag.value;var i,n,s=this.state.selection||window.getSelection(),a=s.anchorNode,o=this.state.tag.delimiters?this.state.tag.delimiters.length:0;return a.splitText(s.anchorOffset-o),-1==(i=a.nodeValue.lastIndexOf(e))?!0:(n=a.splitText(i),t&&a.parentNode.replaceChild(t,n),!0)}},prepareNewTagNode:function(t,e){e=e||{};var i=this.settings,n=[],s={},a=Object.assign({},t,{value:t.value+""});if(t=Object.assign({},a),i.transformTag.call(this,t),t.__isValid=this.hasMaxTags()||this.validateTag(t),!0!==t.__isValid){if(e.skipInvalid)return;if(u(s,this.getInvalidTagAttrs(t,t.__isValid),{__preInvalidData:a}),t.__isValid==this.TEXTS.duplicate&&this.flashTag(this.getTagElmByValue(t.value)),!i.createInvalidTags)return void n.push(t.value)}return "readonly"in t&&(t.readonly?s["aria-readonly"]=!0:delete t.readonly),{tagElm:this.createTagElem(t,s),tagData:t,aggregatedInvalidInput:n}},postProcessNewTagNode:function(t,e){var i=this,n=this.settings,s=e.__isValid;s&&!0===s?this.value.push(e):(this.trigger("invalid",{data:e,index:this.value.length,tag:t,message:s}),n.keepInvalidTags||setTimeout((function(){return i.removeTags(t,!0)}),1e3)),this.dropdown.position();},selectTag:function(t,e){var i=this;if(!this.settings.enforceWhitelist||this.isTagWhitelisted(e.value)){this.state.actions.selectOption&&setTimeout((function(){return i.setRangeAtStartEnd(!1,i.DOM.input)}));var n=this.getLastTag();return n?this.replaceTag(n,e):this.appendTag(t),this.value[0]=e,this.update(),this.trigger("add",{tag:t,data:e}),[t]}},addEmptyTag:function(t){var e=u({value:""},t||{}),i=this.createTagElem(e);y(i,e),this.appendTag(i),this.editTag(i,{skipValidation:!0}),this.toggleFocusClass(!0);},addTags:function(t,e,i){var n=this,s=[],a=this.settings,o=[],r=document.createDocumentFragment(),l=[];if(!t||0==t.length)return s;switch(t=this.normalizeTags(t),a.mode){case"mix":return this.addMixTags(t);case"select":e=!1,this.removeAllTags();}return this.DOM.input.removeAttribute("style"),t.forEach((function(t){var e=n.prepareNewTagNode(t,{skipInvalid:i||a.skipInvalid});if(e){var d=e.tagElm;if(t=e.tagData,o=e.aggregatedInvalidInput,s.push(d),"select"==a.mode)return n.selectTag(d,t);r.appendChild(d),n.postProcessNewTagNode(d,t),l.push({tagElm:d,tagData:t});}})),this.appendTag(r),l.forEach((function(t){var e=t.tagElm,i=t.tagData;return n.trigger("add",{tag:e,index:n.getTagIdx(i),data:i})})),this.update(),t.length&&e&&(this.input.set.call(this,a.createInvalidTags?"":o.join(a._delimiters)),this.setRangeAtStartEnd(!1,this.DOM.input)),this.dropdown.refilter(),s},addMixTags:function(t){var e=this;if((t=this.normalizeTags(t))[0].prefix||this.state.tag)return this.prefixedTextToTag(t[0]);var i=document.createDocumentFragment();return t.forEach((function(t){var n=e.prepareNewTagNode(t);i.appendChild(n.tagElm),e.insertAfterTag(n.tagElm),e.postProcessNewTagNode(n.tagElm,n.tagData);})),this.appendMixTags(i),i.children},appendMixTags:function(t){var e=!!this.state.selection;e?this.injectAtCaret(t):(this.DOM.input.focus(),(e=this.setStateSelection()).range.setStart(this.DOM.input,e.range.endOffset),e.range.setEnd(this.DOM.input,e.range.endOffset),this.DOM.input.appendChild(t),this.updateValueByDOMTags(),this.update());},prefixedTextToTag:function(t){var e,i,n,s=this,a=this.settings,o=null===(e=this.state.tag)||void 0===e?void 0:e.delimiters;if(t.prefix=t.prefix||this.state.tag?this.state.tag.prefix:(a.pattern.source||a.pattern)[0],n=this.prepareNewTagNode(t),i=n.tagElm,this.replaceTextWithNode(i)||this.DOM.input.appendChild(i),setTimeout((function(){return i.classList.add(s.settings.classNames.tagNoAnimation)}),300),this.update(),!o){var r=this.insertAfterTag(i)||i;setTimeout(T,0,r);}return this.state.tag=null,this.postProcessNewTagNode(i,n.tagData),i},appendTag:function(t){var e=this.DOM,i=e.input;e.scope.insertBefore(t,i);},createTagElem:function(t,e){t.__tagId=f();var i,n=u({},t,G({value:d(t.value+"")},e));return function(t){for(var e,i=document.createNodeIterator(t,NodeFilter.SHOW_TEXT,null,!1);e=i.nextNode();)e.textContent.trim()||e.parentNode.removeChild(e);}(i=this.parseTemplate("tag",[n,this])),y(i,t),i},reCheckInvalidTags:function(){var t=this,e=this.settings;this.getTagElms(e.classNames.tagNotAllowed).forEach((function(i,n){var s=y(i),a=t.hasMaxTags(),o=t.validateTag(s),r=!0===o&&!a;if("select"==e.mode&&t.toggleScopeValidation(o),r)return s=s.__preInvalidData?s.__preInvalidData:{value:s.value},t.replaceTag(i,s);i.title=a||o;}));},removeTags:function(t,e,i){var n,s=this,a=this.settings;if(t=t&&J(t,HTMLElement)?[t]:J(t,Array)?t:t?[t]:[this.getLastTag()].filter((function(t){return t})),n=t.reduce((function(t,e){e&&"string"==typeof e&&(e=s.getTagElmByValue(e));var i=y(e);return e&&i&&!i.readonly&&t.push({node:e,idx:s.getTagIdx(i),data:y(e,{__removed:!0})}),t}),[]),i="number"==typeof i?i:this.CSSVars.tagHideTransition,"select"==a.mode&&(i=0,this.input.set.call(this)),1==n.length&&"select"!=a.mode&&n[0].node.classList.contains(a.classNames.tagNotAllowed)&&(e=!0),n.length)return a.hooks.beforeRemoveTag(n,{tagify:this}).then((function(){var t=function(t){t.node.parentNode&&(t.node.parentNode.removeChild(t.node),e?a.keepInvalidTags&&this.trigger("remove",{tag:t.node,index:t.idx}):(this.trigger("remove",{tag:t.node,index:t.idx,data:t.data}),this.dropdown.refilter(),this.dropdown.position(),this.DOM.input.normalize(),a.keepInvalidTags&&this.reCheckInvalidTags()));};i&&i>10&&1==n.length?function(e){e.node.style.width=parseFloat(window.getComputedStyle(e.node).width)+"px",document.body.clientTop,e.node.classList.add(a.classNames.tagHide),setTimeout(t.bind(this),i,e);}.call(s,n[0]):n.forEach(t.bind(s)),e||(s.removeTagsFromValue(n.map((function(t){return t.node}))),s.update(),"select"==a.mode&&a.userInput&&s.setContentEditable(!0));})).catch((function(t){}))},removeTagsFromDOM:function(){this.getTagElms().forEach((function(t){return t.remove()}));},removeTagsFromValue:function(t){var e=this;(t=Array.isArray(t)?t:[t]).forEach((function(t){var i=y(t),n=e.getTagIdx(i);n>-1&&e.value.splice(n,1);}));},removeAllTags:function(t){var e=this;t=t||{},this.value=[],"mix"==this.settings.mode?this.DOM.input.innerHTML="":this.removeTagsFromDOM(),this.dropdown.refilter(),this.dropdown.position(),this.state.dropdown.visible&&setTimeout((function(){e.DOM.input.focus();})),"select"==this.settings.mode&&(this.input.set.call(this),this.settings.userInput&&this.setContentEditable(!0)),this.update(t);},postUpdate:function(){this.state.blockChangeEvent=!1;var t,e,i=this.settings,n=i.classNames,s="mix"==i.mode?i.mixMode.integrated?this.DOM.input.textContent:this.DOM.originalInput.value.trim():this.value.length+this.input.raw.call(this).length;(this.toggleClass(n.hasMaxTags,this.value.length>=i.maxTags),this.toggleClass(n.hasNoTags,!this.value.length),this.toggleClass(n.empty,!s),"select"==i.mode)&&this.toggleScopeValidation(null===(e=this.value)||void 0===e||null===(t=e[0])||void 0===t?void 0:t.__isValid);},setOriginalInputValue:function(t){var e=this.DOM.originalInput;this.settings.mixMode.integrated||(e.value=t,e.tagifyValue=e.value,this.setPersistedData(t,"value"));},update:function(t){clearTimeout(this.debouncedUpdateTimeout),this.debouncedUpdateTimeout=setTimeout(function(){var e=this.getInputValue();this.setOriginalInputValue(e),this.settings.onChangeAfterBlur&&(t||{}).withoutChangeEvent||this.state.blockChangeEvent||this.triggerChangeEvent();this.postUpdate();}.bind(this),100),this.events.bindOriginaInputListener.call(this,100);},getInputValue:function(){var t=this.getCleanValue();return "mix"==this.settings.mode?this.getMixedTagsAsString(t):t.length?this.settings.originalInputValueFormat?this.settings.originalInputValueFormat(t):JSON.stringify(t):""},getCleanValue:function(t){return a(t||this.value,this.dataProps)},getMixedTagsAsString:function(){var t="",e=this,i=this.settings,n=i.originalInputValueFormat||JSON.stringify,s=i.mixTagsInterpolator;return function i(a){a.childNodes.forEach((function(a){if(1==a.nodeType){var r=y(a);if("BR"==a.tagName&&(t+="\r\n"),r&&m.call(e,a)){if(r.__removed)return;t+=s[0]+n(o(r,e.dataProps))+s[1];}else a.getAttribute("style")||["B","I","U"].includes(a.tagName)?t+=a.textContent:"DIV"!=a.tagName&&"P"!=a.tagName||(t+="\r\n",i(a));}else t+=a.textContent;}));}(this.DOM.input),t}},Q.prototype.removeTag=Q.prototype.removeTags;

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
        case 'infiltration':
            return game.i18n.localize("PF2ESubsystems.Events.Infiltration.Single");
        case 'influence':
            return game.i18n.localize("PF2ESubsystems.Events.Influence.Single");
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

const getDCAdjustmentNumber = (adjustment) => {
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

const getSelfDC = () => {
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
};

const setupTagify = (html, htmlClass, options, onChange, onRemove) => {
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
        };

    for(var input of $(html).find(htmlClass)) {
        const traitsTagify = new Q(input, {
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
};



const disableRollButton = (disable, html) => {
    if(!disable) return html;
    return html.match(/style="/) ? html.replace(/style="/, 'style="opacity: 0.4; pointer-events: none; ') : html.replace(/<a/, '<a style="opacity: 0.4; pointer-events: none; "').replace(/<span/, '<span style="opacity: 0.4; pointer-events: none; "');
}; 

const getActButton = async(action, variant, skill, dc, disableElement, secret = false) => {
    return disableRollButton(disableElement, await TextEditor.enrichHTML(`[[/act ${action} ${variant ? `variant=${variant} ` : ''}stat=${skill} dc=${dc}${secret ? ' traits=secret' : ''}]]`));
};

const getCheckButton = async(skill, dc, simple, disableElement, secret = false) => {
    return disableRollButton(disableElement, await TextEditor.enrichHTML(`@Check[type:${skill}|dc:${dc}|simple:${simple}${secret ? '|traits:secret' : ''}]`));
};

const { HandlebarsApplicationMixin: HandlebarsApplicationMixin$1, ApplicationV2: ApplicationV2$1 } = foundry.applications.api;

class ValueDialog extends HandlebarsApplicationMixin$1(ApplicationV2$1) {
    constructor(resolve, reject, initialValue, label) {
        super({});

        this.resolve = resolve;
        this.reject = reject;
        this.initialValue = initialValue;
        this.label = label;
    }

    get title() {
        return this.label;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "pf2e-subsystems-value-dialog",
        classes: ["pf2e-subsystems", "pf2e-value-dialog"],
        position: { width: "200", height: "auto" },
        actions: {},
        form: { handler: this.updateData, submitOnChange: false },
    };

    static PARTS = {
        main: {
            id: "main",
            template: "modules/pf2e-subsystems/templates/value-dialog.hbs",
        },
    }

    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);
        context.value = this.initialValue;

        return context;
    }

    static async updateData(event, element, formData) {
        const data = foundry.utils.expandObject(formData.object);
        this.resolve(data.value);
        this.close({ updateClose: true });
    }

    async close(options={}) {
        const { updateClose, ...baseOptions } = options;
        if(!updateClose){
            this.reject();
        }

        await super.close(baseOptions);
    }
}

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
  },
  influence: {},
});

const getDefaultLayout = (event) => ({
  infiltration: {
    preparations: 0,
  }
});

class SystemView extends HandlebarsApplicationMixin(
    ApplicationV2,
  ) {
    constructor(tab, event, isTour, options={}) {
      super(options);

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
        researhCheckPointsUpdate: this.researhCheckPointsUpdate,
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
        /* Influence */
        influenceDiscoveryAdd: this.influenceDiscoveryAdd,
        influenceDiscoveryRemove: this.influenceDiscoveryRemove,
        influenceSkillAdd: this.influenceSkillAdd,
        influenceSkillRemove: this.influenceSkillRemove,
        influenceInfluenceAdd: this.influenceInfluenceAdd,
        influenceInfluenceRemove: this.influenceInfluenceRemove,
        influencePointsUpdate: this.influencePointsUpdate,
        influenceInfluenceToggleHidden: this.influenceInfluenceToggleHidden,
        influenceToggleOpenInfluence: this.influenceToggleOpenInfluence,
        influenceToggleOpenWeakness: this.influenceToggleOpenWeakness,
        influenceToggleOpenResistance: this.influenceToggleOpenResistance,
        influenceToggleOpenPenalty: this.influenceToggleOpenPenalty, 
        influenceWeaknessAdd: this.influenceWeaknessAdd,
        influenceWeaknessRemove: this.influenceWeaknessRemove,
        influenceResistanceAdd: this.influenceResistanceAdd,
        influenceResistanceRemove: this.influenceResistanceRemove,
        influencePenaltyAdd: this.influencePenaltyAdd,
        influencePenaltyRemove: this.influencePenaltyRemove,
        influenceDiscoveryToggleHidden: this.influenceDiscoveryToggleHidden,
        influenceInfluenceSkillToggleHidden: this.influenceInfluenceSkillToggleHidden,
        influenceWeaknessToggleHidden: this.influenceWeaknessToggleHidden,
        influenceResistanceToggleHidden: this.influenceResistanceToggleHidden,
        influencePenaltyToggleHidden: this.influencePenaltyToggleHidden, 
        influenceWeaknessToggleUsed: this.influenceWeaknessToggleUsed,
        influenceResistanceToggleUsed: this.influenceResistanceToggleUsed,
        influencePenaltyToggleUsed: this.influencePenaltyToggleUsed,
        influenceDiscoveryToggleOpen: this.influenceDiscoveryToggleOpen,
        influenceInfluenceSkillToggleOpen: this.influenceInfluenceSkillToggleOpen,
        influenceSkillLabelMenu: this.influenceSkillLabelMenu,
        influenceRoundsUpdate: this.influenceRoundsUpdate,
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
      influence: {
        id: 'influence',
        template: "modules/pf2e-subsystems/templates/system-view/systems/influence/influences.hbs",
        scrollable: [
          ".event-body-container",
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
        influence: {
          active: false,
          cssClass: 'influence-view',
          group: 'main',
          id: 'influence',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Events.Influence.Plural'),
          image: 'icons/skills/social/diplomacy-handshake-yellow.webp',
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
        chase: {
          active: false,
          cssClass: 'chase-view',
          group: 'main',
          id: 'chase',
          icon: null,
          label: game.i18n.localize('PF2ESubsystems.Events.Chase.Plural'),
          image: 'icons/skills/movement/feet-winged-boots-brown.webp',
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

    static filePickerListener(dialog) {
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
        }).browse();
      });
    }

    static async getEventDialogData(subsystem, existing) {
      switch(subsystem){
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
        case 'influence':
          return {  
            content: await renderTemplate("modules/pf2e-subsystems/templates/system-view/systems/chase/chaseDataDialog.hbs", { name: existing?.name, background: existing?.background }),
            title: game.i18n.localize(existing ? 'PF2ESubsystems.Influence.EditInfluence' : 'PF2ESubsystems.Influence.CreateInfluence'),
            callback: (button) => {
              const elements = button.form.elements;
              if (existing){
                return {
                  ...existing,
                  name: elements.name.value,
                  background: elements.background.value,
                }
              }

              return {
                id: foundry.utils.randomID(),
                name: elements.name.value ? elements.name.value : game.i18n.localize('PF2ESubsystems.View.NewEvent'),
                version: currentVersion,
                background: elements.background.value ? elements.background.value : 'icons/magic/perception/eye-ringed-green.webp',
              };
            },
            attachListeners: this.filePickerListener.bind(this),
          };
      }
    }

    static async setEvent(subsystem, resolve, existing){
      const dialogData = await this.getEventDialogData(subsystem, existing);
      const dialogCallback = async (_, button) => {
        const updateData = dialogData.callback(button);
        await updateDataModel(subsystem, { [`events.${updateData.id}`]: updateData });
        if(resolve){
          resolve(updateData.id);
        }
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
      await this.constructor.setEvent(this.tabGroups.main, null);
    }

    static async editEvent(_, button){
      const existingEvent = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event];
      await this.constructor.setEvent(this.tabGroups.main, null, existingEvent);
    }

    static editEventToggle(){
      this.editMode = !this.editMode;

      switch(this.tabGroups.main) {
        case 'influence':
          this.selected.influence.openInfluence = null;
          this.selected.influence.openWeakness = null;
          this.selected.influence.openResistance = null;
          this.selected.influence.openPenalty = null;
          this.selected.influence.openDiscoverySection = false;
          this.selected.influence.openInfluenceSkillSection = false;
          break;
      }

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
      this.editMode = false;
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

    async onKeyDown(event){
      /* Obstacle navigation */
      if(!this.isTour){
        if(!this.editMode){
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
            case 'research':
                if(this.selected.event) {
                  const selectedEvent = Object.values(game.settings.get(MODULE_ID, this.tabGroups.main).events).find(x => x.id === this.selected.event);
                  const sectionOrder = [{ selectedKey: 'openResearchCheck', valueKey: 'researchChecks' }, { selectedKey: 'openResearchBreakpoint', valueKey: 'researchBreakpoints' }, { selectedKey: 'openResearchEvent', valueKey: 'researchEvents' }];
                  switch(event.key) {
                    case 'ArrowUp':
                      const upSelected = this.selected.research.openResearchCheck ? { key: 'researchChecks', value: this.selected.research.openResearchCheck } : 
                        this.selected.research.openResearchBreakpoint ? { key: 'researchBreakpoints', value: this.selected.research.openResearchBreakpoint } : 
                        this.selected.research.openResearchEvent ? { key: 'researchEvents', value: this.selected.research.openResearchEvent } : null;

                      const upSections = [{ key: 'researchChecks', selectKey: 'openResearchCheck', values: Object.values(selectedEvent.researchChecks)}, { key: 'researchBreakpoints', selectKey: 'openResearchBreakpoint', values: Object.values(selectedEvent.researchBreakpoints) }, { key: 'researchEvents', selectKey: 'openResearchEvent', values: Object.values(selectedEvent.researchEvents) }]
                        .flatMap(category => category.values.filter(x => game.user.isGM || !x.hidden).map(x => ({ key: category.key, selectKey: category.selectKey, id: x.id })));
                      if(upSelected === null) {
                        this.selected.research[upSections[0].selectKey] = upSections[0].id;
                      } else {
                        const selectedIndex = upSections.findIndex(x => x.key === upSelected.key && x.id === upSelected.value);
                        if(selectedIndex === 0) return;

                        this.selected.research[upSections[selectedIndex].selectKey] = null;
                        const nextSection = upSections[selectedIndex-1];
                        this.selected.research[nextSection.selectKey] = nextSection.id;
                      }

                      this.render({ parts: [this.tabGroups.main] });

                      break;
                    case 'ArrowDown':
                      const downSelected = this.selected.research.openResearchCheck ? { key: 'researchChecks', value: this.selected.research.openResearchCheck } : 
                        this.selected.research.openResearchBreakpoint ? { key: 'researchBreakpoints', value: this.selected.research.openResearchBreakpoint } : 
                        this.selected.research.openResearchEvent ? { key: 'researchEvents', value: this.selected.research.openResearchEvent } : null;

                      const downSections = [{ key: 'researchChecks', selectKey: 'openResearchCheck', values: Object.values(selectedEvent.researchChecks)}, { key: 'researchBreakpoints', selectKey: 'openResearchBreakpoint', values: Object.values(selectedEvent.researchBreakpoints) }, { key: 'researchEvents', selectKey: 'openResearchEvent', values: Object.values(selectedEvent.researchEvents) }]
                        .flatMap(category => category.values.filter(x => game.user.isGM || !x.hidden).map(x => ({ key: category.key, selectKey: category.selectKey, id: x.id })));
                      if(downSelected === null) {
                        this.selected.research[downSections[0].selectKey] = downSections[0].id;
                      } else {
                        const selectedIndex = downSections.findIndex(x => x.key === downSelected.key && x.id === downSelected.value);
                        if(selectedIndex === downSections.length-1) return;

                        this.selected.research[downSections[selectedIndex].selectKey] = null;
                        const nextSection = downSections[selectedIndex+1];
                        this.selected.research[nextSection.selectKey] = nextSection.id;
                      }

                      this.render({ parts: [this.tabGroups.main] });

                      break;
                    case 'Enter':
                      for(var section of sectionOrder){
                        this.selected.research[section.selectedKey] = null;
                      }

                      this.render({ parts: [this.tabGroups.main] });
                      break;
                    case 'ArrowRight':
                      if(game.user.isGM && this.selected.research.openResearchCheck){
                        const researchCheck = game.settings.get(MODULE_ID, this.tabGroups.main).events[selectedEvent.id].researchChecks[this.selected.research.openResearchCheck];
                        await updateDataModel(this.tabGroups.main, { [`events.${selectedEvent.id}.researchChecks.${this.selected.research.openResearchCheck}.currentResearchPoints`]: Math.min(researchCheck.currentResearchPoints + 1, researchCheck.maximumResearchPoints) });
                      }
                      break;
                    case 'ArrowLeft':
                      if(game.user.isGM && this.selected.research.openResearchCheck){
                        const researchCheck = game.settings.get(MODULE_ID, this.tabGroups.main).events[selectedEvent.id].researchChecks[this.selected.research.openResearchCheck];
                        await updateDataModel(this.tabGroups.main, { [`events.${selectedEvent.id}.researchChecks.${this.selected.research.openResearchCheck}.currentResearchPoints`]: Math.max(researchCheck.currentResearchPoints - 1, 0) });
                      }
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
            case 'influence':
              if(this.selected.event) {
                const currentInfluencePoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[this.selected.event].influencePoints;
                switch(event.key){
                  case 'ArrowUp':
                    if(!game.user.isGM) return;
                    await updateDataModel(this.tabGroups.main, { [`events.${this.selected.event}.influencePoints`]: currentInfluencePoints + 1 });
                    break;
                  case 'ArrowDown':
                    if(!game.user.isGM) return;
                    await updateDataModel(this.tabGroups.main, { [`events.${this.selected.event}.influencePoints`]: Math.max(currentInfluencePoints - 1, 0) });
                    break;
                }
              }
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
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchBreakpoints.${button.dataset.breakpoint}.hidden`]: !currentBreakpoint.hidden });
    }

    static toggleResearchOpenResearchBreakpoint(_, button) {
      this.selected.research.openResearchBreakpoint = this.selected.research.openResearchBreakpoint === button.dataset.breakpoint ? null : button.dataset.breakpoint;
      this.selected.research.openResearchCheck = null;
      this.selected.research.openResearchEvent = null;
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
      this.selected.research.openResearchBreakpoint = null;
      this.selected.research.openResearchEvent = null;
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
      }});
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
      this.selected.research.openResearchBreakpoint = null;
      this.selected.research.openResearchCheck = null;
      this.render({ parts: [this.tabGroups.main] });
    }

    async researchCheckMaxPointsUpdate(event) {
      const button = event.currentTarget;
      const currentResearchPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchChecks[button.dataset.check].currentResearchPoints;
      const newMax = Number.parseInt(button.value);

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}`]: {
        maximumResearchPoints: newMax,
        currentResearchPoints: currentResearchPoints > newMax ? newMax : currentResearchPoints,
      }});
    }

    async researchCheckActionUpdate(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.researchCheck}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        action: button.value,
        variant: null,
      }});
    }

    static async researhCheckPointsUpdate(_, button) {
      const currentPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].researchChecks[button.dataset.check].currentResearchPoints;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.researchChecks.${button.dataset.check}.currentResearchPoints`]: button.dataset.increase ? currentPoints + 1 : currentPoints - 1 });
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
      const currentPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].objectives[button.dataset.objective].obstacles[button.dataset.obstacle].infiltrationPointData[button.dataset.player] ?? 0;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.infiltrationPointData.${button.dataset.player}`]: button.dataset.increase ? currentPoints + 1 : currentPoints - 1 });
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
      this.selected.openInfiltrationComplication = null;
      this.selected.openInfiltrationOpportunity = null;
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
      this.selected.openInfiltrationObstacle = null;
      this.selected.openInfiltrationComplication = null;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async infiltrationToggleComplicationHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].complications[button.dataset.complication].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.hidden`]: !currentHidden });
    }

    static async infiltrationToggleOpenComplication(_, button) {
      this.selected.openInfiltrationComplication = this.selected.openInfiltrationComplication === button.dataset.complication ? null : button.dataset.complication;
      this.selected.openInfiltrationOpportunity = null;
      this.selected.openInfiltrationObstacle = null;
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
      }, 0);

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
      const currentOutcomes = event.preparations.activities[button.dataset.activity].results[button.dataset.result].nrOutcomes;

      if(currentOutcomes === 0) return;

      Object.values(event.edgePoints).find(x => x.originActivity === button.dataset.activity && x.originResult === `${button.dataset.result}_${currentOutcomes}`);

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

    async infiltrationObstacleActionUpdate(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.objectives.${button.dataset.objective}.obstacles.${button.dataset.obstacle}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        action: button.value,
        variant: null,
      }});
    }

    async infiltrationComplicationActionUpdate(event){
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.complications.${button.dataset.complication}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        action: button.value,
        variant: null,
      }});
    }

    async infiltrationPreparationActionUpdate(event){
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.preparations.activities.${button.dataset.activity}.skillChecks.${button.dataset.skillCheck}.skills.${button.dataset.skill}`]: {
        action: button.value,
        variant: null,
      }});
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

    //#region influence
    static async influenceDiscoveryAdd(_, button) {
      const discoveryId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.discoveries.${discoveryId}`]: { id: discoveryId } });
    }

    static async influenceDiscoveryRemove(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.discoveries.-=${button.dataset.discovery}`]:  null });
    }

    static async influenceSkillAdd(_, button) {
      const skillId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influenceSkills.${skillId}`]: { id: skillId } });
    }

    static async influenceSkillRemove(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influenceSkills.-=${button.dataset.skill}`]:  null });
    }

    static async influenceInfluenceAdd(_, button) {
      const influenceId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influence.${influenceId}`]: { id: influenceId, name: 'New Influence' } });
    }

    static async influenceInfluenceRemove(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influence.-=${button.dataset.influence}`]:  null });
    }

    static async influencePointsUpdate(_, button) {
      const currentPoints = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].influencePoints;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influencePoints`]: button.dataset.increase ? currentPoints + 1 : currentPoints - 1 });
    }

    static async influenceInfluenceToggleHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].influence[button.dataset.influence].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influence.${button.dataset.influence}.hidden`]: !currentHidden });
    }

    static async influenceToggleOpenInfluence(_, button) {
      this.selected.influence.openInfluence = this.selected.influence.openInfluence === button.dataset.influence ? null : button.dataset.influence;
      this.selected.influence.openWeakness = null;
      this.selected.influence.openResistance = null;
      this.selected.influence.openPenalty = null;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async influenceToggleOpenWeakness(_, button) {
      this.selected.influence.openWeakness = this.selected.influence.openWeakness === button.dataset.weakness ? null : button.dataset.weakness;
      this.selected.influence.openInfluence = null;
      this.selected.influence.openResistance = null;
      this.selected.influence.openPenalty = null;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async influenceToggleOpenResistance(_, button) {
      this.selected.influence.openResistance = this.selected.influence.openResistance === button.dataset.resistance ? null : button.dataset.resistance;
      this.selected.influence.openInfluence = null;
      this.selected.influence.openWeakness = null;
      this.selected.influence.openPenalty = null;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async influenceToggleOpenPenalty(_, button) {
      this.selected.influence.openPenalty = this.selected.influence.openPenalty === button.dataset.penalty ? null : button.dataset.penalty;
      this.selected.influence.openInfluence = null;
      this.selected.influence.openResistance = null;
      this.selected.influence.openWeakness = null;
      this.render({ parts: [this.tabGroups.main] }); 
    }

    static async influenceWeaknessAdd(_, button) {
      const weaknessId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.weaknesses.${weaknessId}`]: { id: weaknessId, name: 'New Weakness' } });
    }

    static async influenceWeaknessRemove(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.weaknesses.-=${button.dataset.weakness}`]: null });
    }

    static async influenceResistanceAdd(_, button) {
      const resistanceId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.resistances.${resistanceId}`]: { id: resistanceId, name: 'New Resistance' } });
    }

    static async influenceResistanceRemove(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.resistances.-=${button.dataset.resistance}`]: null });
    }

    static async influencePenaltyAdd(_, button) {
      const penaltyId = foundry.utils.randomID();
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.penalties.${penaltyId}`]: { id: penaltyId, name: 'New Penalty' } });
    }

    static async influencePenaltyRemove(_, button) {
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.penalties.-=${button.dataset.penalty}`]: null });
    }

    static async influenceDiscoveryToggleHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].discoveries[button.dataset.discovery].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.discoveries.${button.dataset.discovery}.hidden`]: !currentHidden });
    }

    static async influenceInfluenceSkillToggleHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].influenceSkills[button.dataset.skill].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influenceSkills.${button.dataset.skill}.hidden`]: !currentHidden });
    }

    static async influenceWeaknessToggleHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].weaknesses[button.dataset.weakness].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.weaknesses.${button.dataset.weakness}.hidden`]: !currentHidden });
    }

    static async influenceResistanceToggleHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].resistances[button.dataset.resistance].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.resistances.${button.dataset.resistance}.hidden`]: !currentHidden });
    }

    static async influencePenaltyToggleHidden(_, button) {
      const currentHidden = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].penalties[button.dataset.penalty].hidden;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.penalties.${button.dataset.penalty}.hidden`]: !currentHidden });
    }

    static async influenceWeaknessToggleUsed(_, button) {
      const currentlyUsed = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].weaknesses[button.dataset.weakness].modifier.used;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.weaknesses.${button.dataset.weakness}.modifier.used`]: !currentlyUsed });
    }

    static async influenceResistanceToggleUsed(_, button) {
      const currentlyUsed = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].resistances[button.dataset.resistance].modifier.used;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.resistances.${button.dataset.resistance}.modifier.used`]: !currentlyUsed });
    }

    static async influencePenaltyToggleUsed(_, button) {
      const currentlyUsed = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].penalties[button.dataset.penalty].modifier.used;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.penalties.${button.dataset.penalty}.modifier.used`]: !currentlyUsed });
    }

    static async influenceDiscoveryToggleOpen() {
      this.selected.influence.openInfluenceSection = !this.selected.influence.openInfluenceSection;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async influenceInfluenceSkillToggleOpen() {
      this.selected.influence.openInfluenceSkillSection = !this.selected.influence.openInfluenceSkillSection;
      this.render({ parts: [this.tabGroups.main] });
    }

    static async influenceSkillLabelMenu(_, button) {
      const activeSkill = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].influenceSkills[button.dataset.skill];
      new Promise((resolve, reject) => {
        new ValueDialog(resolve, reject, activeSkill.label, game.i18n.format("PF2ESubsystems.Influence.InfluenceSkillLabelTitle", { skill: activeSkill.skill ? `${game.i18n.localize(CONFIG.PF2E.skills[activeSkill.skill].label)}` : game.i18n.localize("PF2ESubsystems.Basic.Skill") })).render(true);
      }).then(async value => {
        await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influenceSkills.${button.dataset.skill}.label`]: value });
      });
    }

    static async influenceRoundsUpdate(_, button) {
      const currentRound = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].timeLimit.current;
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.timeLimit.current`]: button.dataset.increase ? currentRound + 1 : currentRound - 1 });
    }

    async updateInfluenceDiscoveryLore(event) {
      event.stopPropagation();
      const button = event.currentTarget;
      const newLore = button.checked;
      
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.discoveries.${button.dataset.discovery}`]: {
        lore: newLore,
        skill: newLore ? 'something-lore' : 'acrobatics',
      }});
    }

    async updateInfluenceDiscoverySkill(event) {
      event.stopPropagation();
      const button = event.currentTarget;
      const currentLore = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].discoveries[button.dataset.discovery].lore;
      let newSkill = button.value;

      if(currentLore){
        const loreMatch = newSkill.match('-lore');
        if(!loreMatch || loreMatch.length === 0) {
          newSkill = 'something-lore';
          ui.notifications.warn(game.i18n.localize('PF2ESubsystems.Research.Errors.LoreError'));
        }
      }

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.discoveries.${button.dataset.discovery}.skill`]: newSkill });
    }

    async updateInfluenceSkillLore(event) {
      event.stopPropagation();
      const button = event.currentTarget;
      const newLore = button.checked;
      
      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influenceSkills.${button.dataset.skill}`]: {
        lore: newLore,
        skill: newLore ? 'something-lore' : 'acrobatics',
      }});
    }

    async updateInfluenceInfluenceSkillSkill(event) {
      event.stopPropagation();
      const button = event.currentTarget;
      const currentLore = game.settings.get(MODULE_ID, this.tabGroups.main).events[button.dataset.event].influenceSkills[button.dataset.skill].lore;
      let newSkill = button.value;

      if(currentLore){
        const loreMatch = newSkill.match('-lore');
        if(!loreMatch || loreMatch.length === 0) {
          newSkill = 'something-lore';
          ui.notifications.warn(game.i18n.localize('PF2ESubsystems.Research.Errors.LoreError'));
        }
      }

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influenceSkills.${button.dataset.skill}.skill`]: newSkill });
    }

    async updateInfluenceDiscoveryAction(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.discoveries.${button.dataset.discovery}`]: {
        action: button.value,
        variant: null,
      }});
    }

    async updateInfluenceInfluenceAction(event) {
      event.stopPropagation();
      const button = event.currentTarget;

      await updateDataModel(this.tabGroups.main, { [`events.${button.dataset.event}.influenceSkills.${button.dataset.influenceSkill}`]: {
        action: button.value,
        variant: null,
      }});
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
          $(htmlElement).find('.research-check-maximum-input').on('change', this.researchCheckMaxPointsUpdate.bind(this));
          $(htmlElement).find('.research-check-action-input').on('change', this.researchCheckActionUpdate.bind(this));
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
          $(htmlElement).find('.infiltration-obstacle-action-input').on('change', this.infiltrationObstacleActionUpdate.bind(this));
          $(htmlElement).find('.infiltration-complication-action-input').on('change', this.infiltrationComplicationActionUpdate.bind(this));
          $(htmlElement).find('.infiltration-preparation-action-input').on('change', this.infiltrationPreparationActionUpdate.bind(this));

          const adjustmentOptions = Object.values(dcAdjustments);
          const tagOptions = Object.keys(CONFIG.PF2E.actionTraits).map(x => ({ value: x, name: game.i18n.localize(CONFIG.PF2E.actionTraits[x]) }));

          setupTagify(htmlElement, '.complication-dc-adjustment', adjustmentOptions, this.infiltrationComplicationUpdateDCAdjustment.bind(this), this.infiltrationComplicationRemoveDCAdjustment.bind(this));
          setupTagify(htmlElement, '.obstacle-dc-adjustment', adjustmentOptions, this.infiltrationObstacleUpdateDCAdjustment.bind(this), this.infiltrationObstacleRemoveDCAdjustment.bind(this));
          setupTagify(htmlElement, '.infiltration-preparations-activity-tags', tagOptions, this.infiltrationPreparationsUpdateActivityTags.bind(this), this.infiltrationPreparationsRemoveActivityTags.bind(this));
          setupTagify(htmlElement, '.infiltration-activity-dc-adjustment', adjustmentOptions, this.infiltrationActivityUpdateDCAdjustment.bind(this), this.infiltrationActivityRemoveDCAdjustment.bind(this));
          break;
        case 'influence':
          $(htmlElement).find('.influence-discovery-lore-input').on('change', this.updateInfluenceDiscoveryLore.bind(this));
          $(htmlElement).find('.influence-skill-lore-input').on('change', this.updateInfluenceSkillLore.bind(this));
          $(htmlElement).find('.influence-discovery-skill-input').on('change', this.updateInfluenceDiscoverySkill.bind(this));
          $(htmlElement).find('.influence-influence-skill-skill-input').on('change', this.updateInfluenceInfluenceSkillSkill.bind(this));
          $(htmlElement).find('.influence-discovery-action-input').on('change', this.updateInfluenceDiscoveryAction.bind(this));
          $(htmlElement).find('.influence-influence-action-input').on('change', this.updateInfluenceInfluenceAction.bind(this));
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

          context.researchCheckStyle = this.selected.research.openResearchCheck ? 'focused' : (this.selected.research.openResearchBreakpoint || this.selected.research.openResearchEvent) ? 'unfocused' : '';
          context.researchBreakpointStyle = this.selected.research.openResearchBreakpoint ? 'focused' : (this.selected.research.openResearchCheck || this.selected.research.openResearchEvent) ? 'unfocused' : '';
          context.researchEventStyle = this.selected.research.openResearchEvent ? 'focused' : (this.selected.research.openResearchCheck || this.selected.research.openResearchBreakpoint) ? 'unfocused' : '';

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
                    skillCheck.element = await getActButton(skillCheck.action, skillCheck.variant, skillCheck.skill, skillCheck.dc, false);  
                  }
                  else {
                    skillCheck.element = await getCheckButton(skillCheck.skill, skillCheck.dc, skillCheck.simple, false);
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

          context.infiltrationObstacleStyle = this.selected.openInfiltrationObstacle ? 'focused' : (this.selected.openInfiltrationOpportunity || this.selected.openInfiltrationComplication) ? 'unfocused' : '';
          context.infiltrationOpportunityStyle = this.selected.openInfiltrationOpportunity ? 'focused' : (this.selected.openInfiltrationObstacle || this.selected.openInfiltrationComplication) ? 'unfocused' : '';
          context.infiltrationComplicationStyle = this.selected.openInfiltrationComplication ? 'focused' : (this.selected.openInfiltrationObstacle || this.selected.openInfiltrationOpportunity) ? 'unfocused' : '';
          
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
                      disabled: skill.action ? game.pf2e.actions.get(skill.action).variants.size === 0 : true,
                    });
    
                    return acc;
                  }, { lore: [], skill: [], action: [], variant: [] }),
                };
    
                return acc;
              }, {});
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
                    skill.element = await getActButton(skill.action, skill.variant, skill.skill, dc);
                  }
                  else {
                    skill.element = await getCheckButton(skill.skill, dc, skill.simple, disableElement);
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
                    skill.element = await getActButton(skill.action, skill.variant, skill.skill, dc, disableElement);
                  }
                  else {
                    skill.element = await getCheckButton(skill.skill, dc, skill.simple, disableElement);
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
                    skill.element = await getActButton(skill.action, skill.variant, skill.skill, dc, disableElement);  
                  }
                  else {
                    skill.element = await getCheckButton(skill.skill, dc, skill.simple, disableElement);
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
      
        case 'influence':
          const { events: influenceEvents } = game.settings.get(MODULE_ID, 'influence');
          
          context.settings = game.settings.get(MODULE_ID, settingIDs.influence.settings);
          context.selected = this.selected;
          context.tab = context.systems.influence;
          await this.setupEvents(influenceEvents, context);

          if(context.selectedEvent) {
            context.selectedEvent.enrichedPremise = await TextEditor.enrichHTML(context.selectedEvent.premise);
            context.selectedEvent.extendedDiscoveries = context.selectedEvent.discoveryData;
            context.selectedEvent.extendedInfluenceSkills = context.selectedEvent.influenceSkillData;
            context.dcModifier = context.selectedEvent.dcModifier;
            context.perception = `${context.selectedEvent.perception >= 0 ? '+' : '-'}${context.selectedEvent.perception}`;
            context.will = `${context.selectedEvent.will >= 0 ? '+' : '-'}${context.selectedEvent.will}`;

            for(var key of Object.keys(context.selectedEvent.extendedDiscoveries.data)) {
              const discovery = context.selectedEvent.extendedDiscoveries.data[key];
              const dc = discovery.dc;
              discovery.element = discovery.action ? await getActButton(discovery.action, discovery.variant, discovery.skill, dc, false, true) : await getCheckButton(discovery.skill, dc, false, false, true);
              if (game.user.isGM) {
                discovery.element = discovery.element.replace('><i', ' disabled><i');
                discovery.element = discovery.element.replace(
                  'title="Post prompt to chat"',
                  "",
                );

                if(discovery.element.match('<span')){
                  discovery.element = discovery.element.replace('class="with-repost"', 'class="with-repost disabled"');
                }
              }
            }

            for(var key of Object.keys(context.selectedEvent.extendedInfluenceSkills.data)) {
              const skill = context.selectedEvent.extendedInfluenceSkills.data[key];
              const dc = skill.dc + context.dcModifier;
              skill.element = skill.action ? await getActButton(skill.action, skill.variant, skill.skill, dc, false) : await getCheckButton(skill.skill, dc, false, false);
              if (game.user.isGM) {
                skill.element = skill.element.replace('><i', ' disabled><i');
                skill.element = skill.element.replace(
                  'title="Post prompt to chat"',
                  "",
                );

                if(skill.element.match('<span')){
                  skill.element = skill.element.replace('class="with-repost"', 'class="with-repost disabled"');
                }
              }
            }

            for(var key of Object.keys(context.selectedEvent.influence)) {
              const influence = context.selectedEvent.influence[key];
              const titleElement = `<strong>${influence.points}</strong>:`;
              const descriptionStartsWithParagraph = influence.description.match(/^<p>/);
              influence.enrichedDescription = await TextEditor.enrichHTML(descriptionStartsWithParagraph ? influence.description.replace('<p>', `<p>${titleElement} `) : `${titleElement} ${influence.description}`);
              
              influence.shown = (context.settings.autoRevealInfluence && context.selectedEvent.influencePoints >= influence.points) || game.user.isGM || !influence.hidden;
              influence.hidden = context.settings.autoRevealInfluence ? context.selectedEvent.influencePoints < influence.points : influence.hidden;
              influence.open = this.selected.influence.openInfluence === influence.id;
            }

            for(var key of Object.keys(context.selectedEvent.weaknesses)) {
              const weakness = context.selectedEvent.weaknesses[key];
              weakness.open =  this.selected.influence.openWeakness === weakness.id;
              weakness.enrichedDescription = await TextEditor.enrichHTML(weakness.description);
            }

            for(var key of Object.keys(context.selectedEvent.resistances)) {
              const resistance = context.selectedEvent.resistances[key];
              resistance.open =  this.selected.influence.openResistance === resistance.id;
              resistance.enrichedDescription = await TextEditor.enrichHTML(resistance.description);
            }

            for(var key of Object.keys(context.selectedEvent.penalties)) {
              const penalty = context.selectedEvent.penalties[key];
              penalty.open =  this.selected.influence.openPenalty === penalty.id;
              penalty.enrichedDescription = await TextEditor.enrichHTML(penalty.description);
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
}

const openSubsystemView = async (tab, event, options) => {
  new SystemView(tab, event, false, options).render(true);
};

const addEvent = async (subsystem, resolve) => {
  await SystemView.setEvent(subsystem, resolve);
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
  addEvent: addEvent,
  openSubsystemView: openSubsystemView,
  startEvent: startEvent
});

const handleMigration = async () => {
    if (!game.user.isGM) return;

    var version = game.settings.get(MODULE_ID, "version");
    if (!version) {
        version = currentVersion;
        await game.settings.set(MODULE_ID, "version", version);
    }
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
      let index = stepIndex;
      if(!game.user.isGM) {
        switch(stepIndex){
          case 5:
            index = 7;
            break;
          case 6:
            index = this.stepIndex === 7 ? 4 : 7;
            break;
          case 9:
            index = this.stepIndex === 10 ? 8 : 10;
            break;
        }
      }

      super.progress(index);
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
      let index = stepIndex;
      if(!game.user.isGM) {
        switch(stepIndex){
          case 6:
            index = this.stepIndex === 7 ? 5 : 7;
            break;
          case 10:
            index = this.stepIndex === 11 ? 9 : 11;
            break;
        }
      }

      super.progress(index);
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

class InfiltrationTour extends Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      switch(currentStep.id){
        case 'create-infiltration':
          this.#systemView = await new SystemView('infiltration', null, true).render(true);
          break;
        case 'infiltration-overview-1':
          this.#systemView.selected.event = 'tour-event';
          this.#systemView.selected.infiltration.awarenessBreakpoint = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-11':
          this.#systemView.selected.infiltration.awarenessBreakpoint = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-12':
          this.#systemView.selected.infiltration.awarenessBreakpoint = '5';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-2':
          this.#systemView.selected.infiltration.awarenessBreakpoint = null;
          this.#systemView.selected.infiltration.openEdge = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-21':
            this.#systemView.selected.infiltration.openEdge = '1';
            await this.#systemView.render({ parts: ['infiltration'], force: true });
            break;
        case 'infiltration-overview-22':
            this.#systemView.selected.infiltration.openEdge = '2';
            await this.#systemView.render({ parts: ['infiltration'], force: true });
            break;
        case 'infiltration-overview-23':
            this.#systemView.selected.infiltration.openEdge = '3';
            await this.#systemView.render({ parts: ['infiltration'], force: true });
            break;
        case 'infiltration-overview-3':
            this.#systemView.selected.infiltration.openEdge = null;
            await this.#systemView.render({ parts: ['infiltration'], force: true });
            break;
          // case 'infiltration-overview-61':
          //   this.#systemView.selected.openInfiltrationObstacle = null;
          //   await this.#systemView.render({ parts: ['infiltration'], force: true });
          //   break;
        // case 'infiltration-overview-62':
        //   this.#systemView.selected.openInfiltrationObstacle = '1';
        //   await this.#systemView.render({ parts: ['infiltration'], force: true });
        //   break;
        case 'infiltration-overview-7':
          this.#systemView.selected.openInfiltrationObstacle = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-8':
          this.#systemView.tabGroups.infiltration = 'infiltration';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-9':
          this.#systemView.tabGroups.infiltration = 'preparation';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-92':
          this.#systemView.selected.infiltration.preparations.openActivity = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-93':
          this.#systemView.selected.infiltration.preparations.openActivity = 'bribeContact';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
      }
    }

    async progress(stepIndex) {
      let index = stepIndex;
      if(!game.user.isGM){
        switch(stepIndex) {
          case 11:
            index = this.stepIndex === 12 ? 10 : 12;
            break;
          case 18:
            index = this.stepIndex === 19 ? 17 : 19;
            break;
        }
      }

      super.progress(index);
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

class InfluenceTour extends Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      switch(currentStep.id){
        case 'create-influence':
          this.#systemView = await new SystemView('influence', null, true).render(true);
          break;
        case 'influence-overview-1':
          this.#systemView.selected.event = 'tour-event';
          await this.#systemView.render({ parts: ['influence'], force: true });
          break;
      
      }
    }

    async progress(stepIndex) {
      let index = stepIndex;
      if(!game.user.isGM){
        switch(stepIndex) {
            case 2:
                index = this.stepIndex === 3 ? 1 : 3;
                break;
        }
      }

      super.progress(index);
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
      "modules/pf2e-subsystems/templates/partials/event-toolbar.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chase.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/chaseDataDialog.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/chase/participantDataDialog.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/research/research.hbs",
      "modules/pf2e-subsystems/templates/menu/subsystem-menu/partials/system-tabs.hbs",
      "modules/pf2e-subsystems/templates/menu/subsystem-menu/partials/system-footer.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/infiltration/infiltration.hbs",
      "modules/pf2e-subsystems/templates/system-view/systems/influence/influence.hbs",
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
    game.tours.register(MODULE_ID, tourIDs.infiltration, await InfiltrationTour.fromJSON(`/modules/${MODULE_ID}/tours/infiltration/infiltration-tour.json`));
    game.tours.register(MODULE_ID, tourIDs.influence, await InfluenceTour.fromJSON(`/modules/${MODULE_ID}/tours/influence/influence-tour.json`));
  } catch (error) {
    console.error("PF2e Subsystems Tour Registration failed");
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
