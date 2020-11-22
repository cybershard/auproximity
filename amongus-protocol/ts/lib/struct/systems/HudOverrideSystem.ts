import {
    SystemType
} from "../../constants/Enums"

import { BufferReader } from "../../util/BufferReader";
import { BufferWriter } from "../../util/BufferWriter";

import { SystemStatus } from "./SystemStatus"

export class HudOverrideSystem extends SystemStatus {
    type: SystemType.Communications;

    is_active: boolean;

    constructor() {
        super();

        this.type = SystemType.Communications;

        this.is_active = false;
    }

    OnSpawn(reader: BufferReader) {
        return this.OnDeserialize(reader);
    }

    OnDeserialize(reader: BufferReader) {
        this.is_active = reader.bool();
    }

    Serialize(): Buffer {
        const writer = new BufferWriter;

        writer.bool(this.is_active);

        return writer.buffer;
    }
}
