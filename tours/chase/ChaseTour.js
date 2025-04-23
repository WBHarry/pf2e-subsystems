import SystemView from "../../module/systemView";

export class ChaseTour extends foundry.nue.Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      switch(currentStep.id){
        case 'create-chase':
          this.#systemView = await new SystemView('chase', null, true).render(true);
          break;
        case 'chase-overview-1':
          this.#systemView.selected.event = 'tour-event';
          await this.#systemView.render({ parts: ['chase'], force: true });
          break;
      }
    }

    async progress(stepIndex) {
      let index = stepIndex;
      if(!game.user.isGM) {
        switch(stepIndex){
          case 5:
            index = 7;
            break;
          case 6:
            index = this.stepIndex === 7 ? 4 : 7;
            break;
          case 9:
            index = this.stepIndex === 10 ? 8 : 10;
            break;
        }
      }

      super.progress(index);
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