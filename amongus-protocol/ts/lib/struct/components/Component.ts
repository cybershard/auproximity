import { EventEmitter } from "events";

import { AmongusClient } from "../../Client"

export class Component extends EventEmitter {
    name: string;
    classname: string;

    constructor(public client: AmongusClient, public netid: number) {
        super();
    }

    OnSpawn(datalen: number, data: Buffer) {}
    OnDeserialize(datalen: number, data: Buffer) {}

    Serialize(...args: any[]): Buffer {
        return Buffer.alloc(0);
    }
}
