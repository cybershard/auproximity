import {
    DeconState,
    SystemType
} from "../../constants/Enums"

import { BufferReader } from "../../util/BufferReader";
import { BufferWriter } from "../../util/BufferWriter";

import { SystemStatus } from "./SystemStatus"

export class DeconSystem extends SystemStatus {
    type: SystemType.Decontamination;

    timer: number;
    state: DeconState;

    constructor() {
        super();

        this.type = SystemType.Decontamination;

        this.timer = 0;
        this.state = DeconState.Idle;
    }

    OnSpawn(reader: BufferReader) {
        return this.OnDeserialize(reader);
    }

    OnDeserialize(reader: BufferReader) {
        this.timer = reader.byte();
        this.state = reader.byte();
    }

    Serialize(): Buffer {
        const writer = new BufferWriter;

        writer.byte(this.timer);
        writer.byte(this.state);

        return writer.buffer;
    }
}
