import SystemView from "../../module/systemView";

export class InfiltrationTour extends foundry.nue.Tour {
    #systemView;

    async _preStep() {
      await super._preStep();
      const currentStep = this.currentStep;
      switch(currentStep.id){
        case 'create-infiltration':
          this.#systemView = await new SystemView('infiltration', null, true).render(true);
          break;
        case 'infiltration-overview-0':
          this.#systemView.selected.event = 'tour-event';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-1':
          this.#systemView.selected.infiltration.awarenessBreakpoint = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-11':
          this.#systemView.selected.infiltration.awarenessBreakpoint = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-12':
          this.#systemView.selected.infiltration.awarenessBreakpoint = '5';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-2':
          this.#systemView.selected.infiltration.awarenessBreakpoint = null;
          this.#systemView.selected.infiltration.openEdge = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-21':
            this.#systemView.selected.infiltration.openEdge = '1';
            await this.#systemView.render({ parts: ['infiltration'], force: true });
            break;
        case 'infiltration-overview-22':
            this.#systemView.selected.infiltration.openEdge = '2';
            await this.#systemView.render({ parts: ['infiltration'], force: true });
            break;
        case 'infiltration-overview-23':
            this.#systemView.selected.infiltration.openEdge = '3';
            await this.#systemView.render({ parts: ['infiltration'], force: true });
            break;
        case 'infiltration-overview-3':
            this.#systemView.selected.infiltration.openEdge = null;
            await this.#systemView.render({ parts: ['infiltration'], force: true });
            break;
          // case 'infiltration-overview-61':
          //   this.#systemView.selected.openInfiltrationObstacle = null;
          //   await this.#systemView.render({ parts: ['infiltration'], force: true });
          //   break;
        // case 'infiltration-overview-62':
        //   this.#systemView.selected.openInfiltrationObstacle = '1';
        //   await this.#systemView.render({ parts: ['infiltration'], force: true });
        //   break;
        case 'infiltration-overview-7':
          this.#systemView.selected.openInfiltrationObstacle = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-8':
          this.#systemView.tabGroups.infiltration = 'infiltration';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-9':
          this.#systemView.tabGroups.infiltration = 'preparation';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-92':
          this.#systemView.selected.infiltration.preparations.openActivity = null;
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
        case 'infiltration-overview-93':
          this.#systemView.selected.infiltration.preparations.openActivity = 'bribeContact';
          await this.#systemView.render({ parts: ['infiltration'], force: true });
          break;
      }
    }

    async progress(stepIndex) {
      let index = stepIndex;
      if(!game.user.isGM){
        switch(stepIndex) {
          case 10:
            index = this.stepIndex === 11 ? 9 : 11;
            break;
          case 13:
            index = this.stepIndex === 14 ? 12 : 14;
            break;
          case 20:
            index = this.stepIndex === 21 ? 19 : 21;
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