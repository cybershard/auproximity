import {
    SystemType
} from "../../constants/Enums"

import { BufferReader } from "../../util/BufferReader";
import { BufferWriter } from "../../util/BufferWriter";

import { SystemStatus } from "./SystemStatus"

export class SabotageSystem extends SystemStatus {
    type: SystemType.Sabotage;

    timer: number;

    constructor() {
        super();

        this.type = SystemType.Sabotage;

        this.timer = 0;
    }

    OnSpawn(reader: BufferReader) {
        return this.OnDeserialize(reader);
    }

    OnDeserialize(reader: BufferReader) {
        this.timer = reader.floatLE();
    }

    Serialize(): Buffer {
        const writer = new BufferWriter;

        writer.floatLE(this.timer);

        return writer.buffer;
    }
}
