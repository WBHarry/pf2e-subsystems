import { degreesOfSuccess } from "./constants";
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
        name: new fields.StringField({ required: true }),
        version: new fields.StringField({ required: true }),
        background: new fields.StringField({ required: true }),
        premise: new fields.HTMLField({ required: true, initial: "" }),
        hidden: new fields.BooleanField({ initial: true }),
        started: new fields.BooleanField({ required: true, initial: false }),
        awarenessPoints: new fields.NumberField({ required: true, initial: 0 }),
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
        complications: new TypedObjectField(new fields.SchemaField({
          id: new fields.StringField({ required: true }),
          hidden: new fields.BooleanField({ required: true, initial: false }),
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
          hidden: new fields.BooleanField({ required: true, initial: false }),
          name: new fields.StringField({ required: true }),
          requirements: new fields.StringField(),
          description: new fields.HTMLField(),
        })),
        preparations: new TypedObjectField(new fields.EmbeddedDataField(Preparations)),
      }
    }

    get infiltrationPoints() {
      const partyMembers = game.actors.find(x => x.type === 'party').members;

      return Object.values(this.obstacles).reduce((acc, obstacle) => {
        if(obstacle.individual){
          acc += partyMembers.reduce((acc, member) => {
            const data = obstacle.infiltrationPointData[member.id];
            if(data < acc){
              acc = data;
            }

            return acc;
          }, Math.max(...Object.values(obstacle.infiltrationPointData)));
        }
        else {
          acc += obstacle.infiltrationPoints.current ?? 0;
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
                });

                return acc;
              }, { lore: [], skill: [], action: [], variant: [] }),
            }

            return acc;
          }, {}),
        };

        return acc;
      }, {});
    }
}

const degreeOfSuccessFields = (degreeOfSuccess) => new foundry.data.fields.SchemaField({
  degreeOfSuccess: new foundry.data.fields.StringField({ required: true, initial: degreeOfSuccess}),
  description: new foundry.data.fields.HTMLField(),
  inUse: new foundry.data.fields.BooleanField({ required: true, initial: false }),
});

export class Preparations extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      premise: new fields.HTMLField(),
      activites: new TypedObjectField(new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        name: new fields.StringField(),
        tags: new fields.ArrayField(new fields.StringField()),
        cost: new fields.HTMLField(),
        requirements: new fields.HTMLField(),
        description: new fields.HTMLField(),
        consequences: new TypedObjectField(new fields.SchemaField({
          degreeOfSuccess: new fields.StringField({ required: true, initial: 'success' }),
          description: new fields.HTMLField(),
        })),
        edgePoints: new fields.SchemaField({
          current: new fields.NumberField({ required: true, initial: 0 }),
          max: new fields.NumberField({ required: true, initial: 2 }),
        })
      }))
    }
  }
}