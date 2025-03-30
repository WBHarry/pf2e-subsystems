
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