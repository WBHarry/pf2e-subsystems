import { TypedObjectField } from "./modelHelpers";

/* !!V13!! Use TypedObjectField */ 
export class Chases extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      events: new TypedObjectField(new fields.EmbeddedDataField(Chase)),
    }
  }
}

export class Chase extends foundry.abstract.DataModel {
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