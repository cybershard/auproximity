import {
    SystemType
} from "../../constants/Enums"

import { BufferReader } from "../../util/BufferReader";
import { BufferWriter } from "../../util/BufferWriter";

import { SystemStatus } from "./SystemStatus"

export class MedScanSystem extends SystemStatus {
    type: SystemType.MedBay;

    num_users: number;
    users: number[];

    constructor() {
        super();

        this.type = SystemType.MedBay;

        this.num_users = 0;
        this.users = [];
    }

    OnSpawn(reader: BufferReader) {
        return this.OnDeserialize(reader);
    }

    OnDeserialize(reader: BufferReader) {
        this.num_users = reader.packed();
        this.users = reader.bytes(this.num_users);
    }

    Serialize(): Buffer {
        const writer = new BufferWriter;

        writer.packed(this.num_users);
        writer.bytes(this.users);

        return writer.buffer;
    }
}
