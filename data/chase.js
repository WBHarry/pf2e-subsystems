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