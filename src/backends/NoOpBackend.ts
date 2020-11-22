import {BackendAdapter, BackendModel, BackendType} from "../types/Backend";

export default class NoOpBackend extends BackendAdapter {
    backendModel: BackendModel;
    constructor() {
        super();
        this.backendModel = {
            backendType: BackendType.NoOp,
            gameCode: "NOPNOP"
        };
    }

    initialize(): void {
        console.log("Initialized NoOp Backend");
    }
    destroy(): void {
        console.log("Destroying NoOp Backend");
    }
}
