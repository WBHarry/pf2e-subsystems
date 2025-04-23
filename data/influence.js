export class Influences extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      events: new fields.TypedObjectField(new fields.EmbeddedDataField(Influence)),
    }
  }
}

export class Influence extends foundry.abstract.DataModel {
    static defineSchema() {
      const fields = foundry.data.fields;
      return {
        id: new fields.StringField({ required: true }),
        moduleProvider: new fields.StringField(),
        name: new fields.StringField({ required: true }),
        version: new fields.StringField({ required: true }),
        pins: new fields.SchemaField({
          sidebar: new fields.StringField({ required: true, initial: 'premise' }),
        }),
        background: new fields.StringField({ required: true }),
        premise: new fields.HTMLField({ required: true, initial: "" }),
        gmNotes: new fields.HTMLField({ required: true, initial: "" }),
        hidden: new fields.BooleanField({ initial: true }),
        perception: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        will: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        influencePoints: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        timeLimit: new fields.SchemaField({
          current: new fields.NumberField({ required: true, integer: true, initial: 0 }),
          max: new fields.NumberField({ integer: true, nullable: true, initial: null }),
        }),
        discoveries: new fields.TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            label: new fields.StringField(),
            hidden: new fields.BooleanField({ required: true, initial: false }),
            skill: new fields.StringField({ required: true, initial: 'acrobatics' }),
            action: new fields.StringField(),
            variant: new fields.StringField(),
            dc: new fields.NumberField({ required: true, integer: true, initial: 10 }),
            lore: new fields.BooleanField({ required: true, initial: false }),
        })),
        influenceSkills: new fields.TypedObjectField(new fields.SchemaField({
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
        influence: new fields.TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            points: new fields.NumberField({ required: true, integer: true, initial: 0 }),
            description: new fields.HTMLField({ required: true }),
        })),
        weaknesses: new fields.TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            description: new fields.HTMLField({ required: true }),
            modifier: new fields.SchemaField({
                used: new fields.BooleanField({ required: true, initial: false }),
                value: new fields.NumberField({ required: true, integer: true, initial: 1 })
            }),
        })),
        resistances: new fields.TypedObjectField(new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            hidden: new fields.BooleanField({ required: true, initial: true }),
            description: new fields.HTMLField({ required: true }),
            modifier: new fields.SchemaField({
                used: new fields.BooleanField({ required: true, initial: false }),
                value: new fields.NumberField({ required: true, integer: true, initial: 1 })
            }),
        })),
        penalties: new fields.TypedObjectField(new fields.SchemaField({
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

    get linkedNPCsData() {
      if(!game.modules.get('pf2e-bestiary-tracking')?.active || !game.journal.get(game.settings.get('pf2e-bestiary-tracking', 'bestiary-tracking'))) return null;

      const npcEntries = game.journal.get(game.settings.get('pf2e-bestiary-tracking', 'bestiary-tracking')).pages.filter(x => x.type === 'pf2e-bestiary-tracking.npc' && (game.user.isGM || !x.system.hidden) && x.system.npcData.influenceEventIds.includes(this.id));
      if(npcEntries.length === 0) return null;

      return npcEntries.map(x => ({
        id: x.system.uuid,
        name: x.system.name.value,
        img: x.system.img,
      }));
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
            label: discovery.label,
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