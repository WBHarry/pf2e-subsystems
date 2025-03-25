export default class RegisterHandlebarsHelpers {
    static registerHelpers() {
      Handlebars.registerHelper({
        PF2ESubSAdd: this.add,
        PF2ESubSSub: this.sub,
        PF2ESubSLength: this.length,
      });
    }
  
    static add(a, b) {
        return a + b;
    }

    static sub(a, b) {
      return a - b;
    }

    static length(a) {
        return Object.keys(a).length;
    }
}
  