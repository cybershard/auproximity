import { AmongusClient } from "../../Client"

import { Component } from "./Component"

export class FollowerCamera extends Component {
    name: "LobbyBehaviour";
    classname: "FollowerCamera";

    constructor(client: AmongusClient, netid: number, datalen?: number, data?: Buffer) {
        super(client, netid);

        this.name = "LobbyBehaviour";
        this.classname = "FollowerCamera";

        if (typeof datalen !== "undefined" && typeof data !== "undefined") {
            this.OnSpawn(datalen, data);
        }
    }

    OnSpawn(datalen: number, data: Buffer): void {

    }

    OnDeserialize(datalen: number, data: Buffer): void {

    }

    Serialize() {
        return Buffer.alloc(0x00);
    }
}
