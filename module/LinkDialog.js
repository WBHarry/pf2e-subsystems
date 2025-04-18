const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class LinkDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(resolve, reject, links, label) {
        super({});

        this.resolve = resolve;
        this.reject = reject;
        this.links = links;
        this.label = label;
    }

    get title() {
        return this.label;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "pf2e-subsystems-value-dialog",
        classes: ["pf2e-subsystems", "pf2e-link-dialog"],
        position: { width: "560", height: "auto" },
        actions: {
            openLink: this.openLink,
        },
    };

    static PARTS = {
        main: {
            id: "main",
            template: "modules/pf2e-subsystems/templates/link-dialog.hbs",
        },
    }

    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);
        context.links = this.links;

        return context;
    }

    static async openLink(_, button) {
        this.resolve(button.dataset.link);
        this.close({ updateClose: true });
    }

    // static async updateData(event, element, formData) {
    //     const data = foundry.utils.expandObject(formData.object);
    //     this.resolve(data.value);
    //     this.close({ updateClose: true });
    // }

    async close(options={}) {
        const { updateClose, ...baseOptions } = options;
        if(!updateClose){
            this.reject();
        }

        await super.close(baseOptions);
    }
}