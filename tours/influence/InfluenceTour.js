import SystemView from "../../module/systemView";

export class InfluenceTour extends foundry.nue.Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      switch(currentStep.id){
        case 'create-influence':
          this.#systemView = await new SystemView('influence', null, true).render(true);
          break;
        case 'influence-overview-1':
          this.#systemView.selected.event = 'tour-event';
          await this.#systemView.render({ parts: ['influence'], force: true });
          break;
      
      }
    }

    async progress(stepIndex) {
      let index = stepIndex;
      if(!game.user.isGM){
        switch(stepIndex) {
            case 3:
                index = this.stepIndex === 4 ? 2 : 4;
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