import SystemView from "../../module/systemView";

export class ResearchTour extends Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      switch(currentStep.id){
        case 'create-research':
          this.#systemView = await new SystemView('research', null, true).render(true);
          break;
        case 'research-overview-1':
          this.#systemView.selected.event = 'tour-event';
          await this.#systemView.render({ parts: ['research'], force: true });
          break;
      }
    }

    async progress(stepIndex) {
      super.progress(stepIndex);
    }

    exit(){
      this.#systemView.close();
      this.#systemView = null;
      super.exit();
    }
    
    async complete(){
      this.#systemView.close();
      this.#systemView = null;
      super.complete();
    }
}