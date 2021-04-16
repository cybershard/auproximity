import { BackendType, BackendModel } from "../types/models/Backends";

import { BackendAdapter} from "./Backend";

export default class NoOpBackend extends BackendAdapter {
    backendModel: BackendModel;

    constructor() {
        super();

        this.backendModel = {
            backendType: BackendType.NoOp,
            gameCode: "NOPNOP"
        };

        this.gameID = this.backendModel.gameCode;
    }

    initialize(): void {
        this.log("info", "Initialized NoOp backend.");
    }

    destroy(): void {
        this.log("info", "Destroying NoOp backend.");
    }
}
