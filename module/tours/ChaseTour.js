import SystemView from "../systemView";

export class ChaseTour extends Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      if(currentStep.id == "create-chase") {
        this.#systemView = await new SystemView('chase').render(true);
      } else {
        console.log("MyTours | Tours _preStep: ",currentStep.id);
      }
    }
}