import {
    SystemType
} from "../../constants/Enums"

import { BufferReader } from "../../util/BufferReader";
import { BufferWriter } from "../../util/BufferWriter";

import { SystemStatus } from "./SystemStatus"

export class SwitchSystem extends SystemStatus {
    type: SystemType.Electrical;

    expectedSwitches: number;
    actualSwitches: number;
    value: number;

    constructor() {
        super();

        this.type = SystemType.Electrical;

        this.expectedSwitches = 0;
        this.actualSwitches = 0;
        this.value = 0;
    }

    OnSpawn(reader: BufferReader) {
        return this.OnDeserialize(reader);
    }

    OnDeserialize(reader: BufferReader) {
        this.expectedSwitches = reader.byte();
        this.actualSwitches = reader.byte();
        this.value = reader.byte();
    }

    Serialize(): Buffer {
        const writer = new BufferWriter;
        writer.byte(this.expectedSwitches);
        writer.byte(this.actualSwitches);
        writer.byte(this.value);

        return writer.buffer;
    }
}
