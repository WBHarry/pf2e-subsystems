import { TypedObjectField } from "./modelHelpers";

/* !!V13!! Use TypedObjectField */ 
export class Influences extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      events: new TypedObjectField(new fields.EmbeddedDataField(Influence)),
    }
  }
}

export class Influence extends foundry.abstract.DataModel {
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
        discovery: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            skill: new fields.StringField(),
            action: new fields.StringField(),
            variant: new fields.StringField(),
            lore: new fields.BooleanField({ required: true, initial: false }),
        })),
        influenceSkills: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            skill: new fields.StringField(),
            action: new fields.StringField(),
            variant: new fields.StringField(),
            lore: new fields.BooleanField({ required: true, initial: false }),
        })),
        influence: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            points: new fields.NumberField({ required: true, integer: true, initial: 0 }),
            description: new fields.HTMLField({ required: true }),
        })),
        weaknesses: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            description: new fields.HTMLField({ required: true }),
            modifier: new fields.SchemaField({
                used: new fields.BooleanField({ required: true, initial: false }),
                value: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null })
            }),
        })),
        resistances: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            description: new fields.HTMLField({ required: true }),
            modifier: new fields.SchemaField({
                used: new fields.BooleanField({ required: true, initial: false }),
                value: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null })
            }),
        })),
        penalties: new TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            description: new fields.HTMLField({ required: true }),
            modifier: new fields.SchemaField({
                used: new fields.BooleanField({ required: true, initial: false }),
                value: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null })
            }),
        })),
      }
    }
}