import { defaultInfiltrationAwarenessBreakpoints } from "./constants";
import { TypedObjectField } from "./modelHelpers";

export class ResearchSettings extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      hiddenFields: new fields.SchemaField({
          researchCheckMaxRP: new fields.BooleanField({ required: true, initial: false }),
      }),
    }
  }
}


export class ChaseSettings extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      playersCanEditPosition: new fields.BooleanField({ required: true, initial: false }),
      hideObstacleLockIcon: new fields.BooleanField({ required: true, initial: false }),
    }
  }
}

export class InfiltrationSettings extends foundry.abstract.DataModel {
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

export class InfluenceSettings extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      autoRevealInfluence: new fields.BooleanField({ required: true, initial: false }),
    }
  }
}