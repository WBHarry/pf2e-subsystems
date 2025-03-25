import { MappingField } from "./modelHelpers";

export class Event extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      type: new fields.StringField({ required: true }),
      name: new fields.SchemaField({
        revealed: new fields.BooleanField({ initial: true }),
        value: new fields.StringField({ required: true }),
        custom: new fields.StringField({ nullable: true, initial: null }),
      }),
      version: new fields.StringField({ required: true }),
      img: new fields.StringField({ required: true }),
      hidden: new fields.BooleanField({ initial: true }),
      chaseData: new fields.SchemaField(
        {
          started: new fields.BooleanField({ required: true, initial: false }),
          participants: new MappingField(
            new fields.SchemaField({
              name: new fields.StringField({ required: true }),
              position: new fields.NumberField({
                required: true,
                nullable: true,
                initial: 0,
              }),
              player: new fields.BooleanField({
                required: true,
                initial: false,
              }),
              currentObstacle: new fields.NumberField({
                required: true,
                initial: 0,
              }),
              img: new fields.StringField({ required: true }),
              hidden: new fields.BooleanField({ initial: false }),
            }),
          ),
          timeLimit: new fields.SchemaField({
            total: new fields.NumberField({
              nullable: true,
              initial: null,
              integer: true,
            }),
            timeScale: new fields.StringField({
              initial: "PF2EBestiary.Bestiary.Events.Rounds",
            }),
            revealed: new fields.BooleanField({ initial: false }),
          }),
          currentPosition: new fields.NumberField({
            required: true,
            integer: true,
            initial: 1,
          }),
          obstacles: new MappingField(
            new fields.SchemaField({
              name: new fields.StringField({ required: true }),
              img: new fields.StringField({}),
              position: new fields.NumberField({
                required: true,
                integer: true,
              }),
              chasePoints: new fields.SchemaField({
                goal: new fields.NumberField({ required: true, integer: true }),
                current: new fields.NumberField({
                  required: true,
                  integer: true,
                }),
              }),
              overcome: new fields.HTMLField({}),
            }),
          ),
        },
        { nullable: true, initial: null },
      ),
      notes: new fields.SchemaField({
        player: new fields.SchemaField({
          value: new fields.HTMLField({ required: true, initial: "" }),
        }),
        gm: new fields.SchemaField({
          value: new fields.HTMLField({ required: true, initial: "" }),
        }),
      }),
    };
  }

  get displayImage() {
    return this.img;
  }

  get initialType() {
    return this.type;
  }

  get displayedName() {
    return !this.name.revealed
      ? game.i18n.localize("PF2EBestiary.Bestiary.Miscellaneous.UnknownEvent")
      : (this.name.custom ?? this.name.value);
  }

  get playerParticipants() {
    const partyCharacters =
      game.actors
        .find((x) => x.type === "party" && x.active)
        ?.system?.details?.members?.reduce((acc, x) => {
          const actor = game.actors.find((actor) => actor.uuid === x.uuid);
          if (
            actor.type !== "character" ||
            actor.system.traits.value.some(
              (x) => x === "eidolon" || x === "minion" || x === "npc",
            )
          )
            return acc;

          const participant = this.chaseData.participants[actor.id];

          acc.push({
            id: actor.id,
            name: actor.name,
            position: null,
            currentObstacle: participant?.currentObstacle ?? 0,
            player: true,
            img: actor.img,
          });

          return acc;
        }, []) ?? [];

    return partyCharacters.sort((a, b) => {
      if (a.name < b.name) return -1;
      else if (a.name > b.name) return 1;
      else return 0;
    });
  }

  get nonPlayerParticipants() {
    return Object.keys(this.chaseData.participants)
      .reduce((acc, key) => {
        const participant = this.chaseData.participants[key];
        if (!participant.player) acc.push({ ...participant, id: key });
        return acc;
      }, [])
      .sort((a, b) => a.position - b.position);
  }

  get getParticipants() {
    const partyCharacters =
      game.actors
        .find((x) => x.type === "party" && x.active)
        ?.system?.details?.members?.reduce((acc, x) => {
          const actor = game.actors.find((actor) => actor.uuid === x.uuid);
          if (
            actor.type !== "character" ||
            actor.system.traits.value.some(
              (x) => x === "eidolon" || x === "minion" || x === "npc",
            )
          )
            return acc;

          const participant = this.chaseData.participants[actor.id];

          acc.push({
            id: actor.id,
            name: actor.name,
            position: null,
            currentObstacle: participant?.currentObstacle ?? 0,
            player: true,
            img: actor.img,
          });

          return acc;
        }, []) ?? [];

    const nonPartyCharacters = Object.keys(this.chaseData.participants).reduce(
      (acc, key) => {
        const participant = this.chaseData.participants[key];
        if (!participant.player) acc.push({ ...participant, id: key });
        return acc;
      },
      [],
    );
    return [...partyCharacters, ...nonPartyCharacters].sort((a, b) => {
      if (a.player && b.player) {
        if (a.name < b.name) return -1;
        else if (a.name > b.name) return 1;
        else return 0;
      } else if (a.player && !b.player) return -1;
      else if (!a.player && b.player) return 1;
      else return a.position - b.position;
    });

    return partyCharacters.reduce((acc, character) => {
      const disposition = this.npcData.general.disposition[character.id];
      acc.push({
        value: disposition ?? dispositions.indifferent.value,
        label: disposition
          ? dispositions[disposition].name
          : dispositions.indifferent.name,
        id: character.id,
        name: character.name,
      });

      return acc;
    }, []);
  }

  actorBelongs = () => false;

  prepareDerivedData() {}
}
