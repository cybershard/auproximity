import { AmongusClient } from "../../Client"

import { Component } from "./Component"

export class PlayerPhysics extends Component {
    name: "Player";
    classname: "PlayerPhysics";

    constructor(client: AmongusClient, netid: number, datalen?: number, data?: Buffer) {
        super(client, netid);

        this.name = "Player";
        this.classname = "PlayerPhysics";

        if (typeof datalen !== "undefined" && typeof data !== "undefined") {
            this.OnSpawn(datalen, data);
        }
    }

    OnSpawn(datalen: number, data: Buffer): void {

    }

    OnDeserialize(datalen: number, data: Buffer): void {

    }
}
