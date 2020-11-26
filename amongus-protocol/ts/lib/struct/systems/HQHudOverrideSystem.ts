import {
    SystemType
} from "../../constants/Enums"

import { BufferReader } from "../../util/BufferReader";
import { BufferWriter } from "../../util/BufferWriter";

import { SystemStatus } from "./SystemStatus"

export class HQHudOverrideSystem extends SystemStatus {
    type: SystemType.Communications;

    count: number;
    num_consoles: number;
    consoles: [number, number][];
    num_fixed: number;
    fixed_consoles: number[];

    constructor() {
        super();

        this.type = SystemType.Communications;

        this.num_consoles = 0;
        this.consoles = [];
        this.num_fixed = 0;
        this.fixed_consoles = [];
    }

    OnSpawn(reader: BufferReader) {
        return this.OnDeserialize(reader);
    }

    OnDeserialize(reader: BufferReader) {
        this.num_consoles = reader.packed();
        this.consoles = [];

        for (let i = 0; i < this.num_consoles; i++) {
            let playerId = reader.uint8();
            let console = reader.uint8();

            this.consoles.push([playerId, console]);
        }

        this.num_fixed = reader.packed();
        this.fixed_consoles = [];

        for (let i = 0; i < this.num_fixed; i++) {
            let fixed = reader.uint8();

            this.fixed_consoles.push(fixed);
        }
    }

    Serialize(): Buffer {
        const writer = new BufferWriter;

        writer.packed(this.num_consoles);
        for (let i = 0; i < this.num_consoles; i++) {
            writer.uint8(this.consoles[i][0])
            writer.uint8(this.consoles[i][1]);
        }

        writer.packed(this.num_fixed);
        for (let i = 0; i < this.num_fixed; i++) {
            writer.uint8(this.fixed_consoles[i]);
        }

        return writer.buffer;
    }
}
