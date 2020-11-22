import {
    SystemType
} from "../../constants/Enums"

import { BufferReader } from "../../util/BufferReader";
import { BufferWriter } from "../../util/BufferWriter";

import { SystemStatus } from "./SystemStatus"

export class LifeSuppSystem extends SystemStatus {
    type: SystemType.O2;

    countdown: number;
    num_consoles: number;
    consoles: number[];

    constructor() {
        super();

        this.type = SystemType.O2;

        this.countdown = 10000;
        this.num_consoles = 0;
        this.consoles = [];
    }

    OnSpawn(reader: BufferReader) {
        return this.OnDeserialize(reader);
    }

    OnDeserialize(reader: BufferReader) {
        this.countdown = reader.floatLE();

        if (reader.offset < reader.size) {
            this.num_consoles = reader.packed();

            for (let i = 0; i < this.num_consoles; i++) {
                this.consoles = reader.list(reader => reader.packed(), this.num_consoles);
            }
        }
    }

    Serialize(): Buffer {
        const writer = new BufferWriter;

        writer.floatLE(this.countdown);
        writer.packed(this.consoles.length);
        for (let i = 0; i < this.consoles.length; i++) {
            writer.packed(this.consoles[i]);
        }

        return writer.buffer;
    }
}
