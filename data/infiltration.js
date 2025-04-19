import { degreesOfSuccess, MODULE_ID, settingIDs } from "./constants";
import { TypedObjectField } from "./modelHelpers";

export class Infiltrations extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      events: new TypedObjectField(new fields.EmbeddedDataField(Infiltration)),
    }
  }
}

export class Infiltration extends foundry.abstract.DataModel {
    static defineSchema() {
      const fields = foundry.data.fields;
      return {
        id: new fields.StringField({ required: true }),
        moduleProvider: new fields.StringField(),
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
                label: new fields.StringField(),
                difficulty: new fields.SchemaField({
                  leveledDC: new fields.BooleanField({ required: true, initial: true }),
                  DC: new fields.NumberField(),
                }),
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
              label: new fields.StringField(),
              difficulty: new fields.SchemaField({
                leveledDC: new fields.BooleanField({ required: true, initial: true }),
                DC: new fields.NumberField(),
              }),
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

    get totalInfiltrationPoints() {
      return Object.values(this.objectives).reduce((acc, curr) => {
        acc += Object.values(curr.obstacles).reduce((acc, curr) => {
          acc += curr.infiltrationPoints.current ?? 0;

          return acc;
        }, 0);

        return acc;
      }, 0);
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
                  label: skill.label,
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
                acc.dc.push({ 
                  event: this.id,
                  complication: complication.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  dc: skill.difficulty.DC,
                  leveledDC: skill.difficulty.leveledDC,
                });

                return acc;
              }, { lore: [], skill: [], action: [], variant: [], dc: [] }),
            }

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
                  label: skill.label,
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
                acc.dc.push({
                  event: this.id,
                  activity: activity.id,
                  skillCheck: skillCheck.id,
                  id: skill.id,
                  dc: skill.difficulty.DC,
                  leveledDC: skill.difficulty.leveledDC,
                });
  
                return acc;
              }, { lore: [], skill: [], action: [], variant: [], dc: [] }),
            }
  
            return acc;
          }, {}),
        };
  
        return acc;
      }, {});
    }
}

export class Preparations extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      usesPreparation: new fields.BooleanField({ required: true, initial: false }),
      activities: new TypedObjectField(new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        hidden: new fields.BooleanField({ required: true, initial: false }),
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
            label: new fields.StringField(),
            difficulty: new fields.SchemaField({
              leveledDC: new fields.BooleanField({ required: true, initial: true }),
              DC: new fields.NumberField(),
            }),
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