const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ValueDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(resolve, reject, initialValue, label) {
        super({});

        this.resolve = resolve;
        this.reject = reject;
        this.initialValue = initialValue;
        this.label = label;
    }

    get title() {
        return this.label;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "pf2e-subsystems-value-dialog",
        classes: ["pf2e-subsystems", "pf2e-value-dialog"],
        position: { width: "200", height: "auto" },
        actions: {},
        form: { handler: this.updateData, submitOnChange: false },
    };

    static PARTS = {
        main: {
            id: "main",
            template: "modules/pf2e-subsystems/templates/value-dialog.hbs",
        },
    }

    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);
        context.value = this.initialValue;

        return context;
    }

    static async updateData(event, element, formData) {
        const data = foundry.utils.expandObject(formData.object);
        this.resolve(data.value);
        this.close({ updateClose: true });
    }

    async close(options={}) {
        const { updateClose, ...baseOptions } = options;
        if(!updateClose){
            this.reject();
        }

        await super.close(baseOptions);
    }
}