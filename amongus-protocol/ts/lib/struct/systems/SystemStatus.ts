import { EventEmitter } from "events";

import {
    SystemType
} from "../../constants/Enums"

import { BufferReader } from "../../util/BufferReader";

export class SystemStatus extends EventEmitter {
    type: SystemType;

    constructor() {
        super();
    }

    OnSpawn(reader: BufferReader) {}
    OnDeserialize(reader: BufferReader) {}

    Serialize(...args: any[]): Buffer {
        return Buffer.alloc(0);
    }
}
