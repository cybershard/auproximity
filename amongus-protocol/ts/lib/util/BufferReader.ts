import util from "util"

import {
    byte,
    uint8,
    int8,
    uint16,
    int16,
    uint32,
    int32,
    float,
    double,
    packed
} from "../interfaces/Types"

import { getFloat32} from "./Float16"

/**
 * Represents a buffer reader.
 */
export class BufferReader {
    buffer: Buffer;
    offset: number;

    constructor(buffer: Buffer|string) {
        if (typeof buffer === "string") {
            this.buffer = Buffer.from(buffer.split(" ").map(byte => parseInt(byte, 16)));
        } else {
            this.buffer = buffer;
        }

        /**
         * The offset of the reader.
         */
        this.offset = 0x00;
    }

    [Symbol.toStringTag]() {
        return this.buffer.toString();
    }

    [util.inspect.custom]() {
        return this.buffer;
    }

    slice(start?: number, len?: number): BufferReader {
        return new BufferReader(this.buffer.slice(start, len));
    }

    /**
     * The number of bytes left in the buffer.
     */
    get left() {
        return this.size - this.offset;
    }

    /**
     * The size of the buffer in bytes.
     */
    get size() {
        return this.buffer.byteLength;
    }

    /**
     * Goto a certain position in the buffer.
     */
    goto(offset: number) {
        this.offset = offset;
    }

    /**
     * Jump a certain amount of bytes.
     */
    jump(bytes: number) {
        this.offset += bytes;

        return this.offset;
    }

    /**
     * Read a Big-Endian unsigned 32 bit integer.
     */
    uint32BE(): uint32 {
        const val = this.buffer.readUInt32BE(this.offset);
        this.offset += 0x04;

        return val;
    }

    /**
     * Read a Little-Endian unsigned 32 bit integer.
     */
    uint32LE(): uint32 {
        const val = this.buffer.readUInt32LE(this.offset);
        this.offset += 0x04;

        return val;
    }

    /**
     * Read a Big-Endian 32 bit integer.
     */
    int32BE(): int32 {
        const val = this.buffer.readInt32BE(this.offset);
        this.offset += 0x04;

        return val;
    }

    /**
     * Read a Big-Endian 32 bit integer.
     */
    int32LE(): int32 {
        const val = this.buffer.readInt32LE(this.offset);
        this.offset += 0x04;

        return val;
    }

    /**
     * Read a Big-Endian unsigned 16 bit integer.
     */
    uint16BE(): uint16 {
        const val = this.buffer.readUInt16BE(this.offset);
        this.offset += 0x02;

        return val;
    }

    /**
     * Read a Little-Endian unsigned 16 bit integer.
     */
    uint16LE(): uint16 {
        const val = this.buffer.readUInt16LE(this.offset);
        this.offset += 0x02;

        return val;
    }

    /**
     * Read a Big-Endian 16 bit integer.
     */
    int16BE(): int16 {
        const val = this.buffer.readInt16LE(this.offset);
        this.offset += 0x02;

        return val;
    }

    /**
     * Read a Little-Endian 16 bit integer.
     */
    int16LE(): int16 {
        const val = this.buffer.readInt16LE(this.offset);
        this.offset += 0x02;

        return val;
    }

    /**
     * Read an unsigned 8 bit integer.
     */
    uint8(): uint8 {
        const val = this.buffer.readUInt8(this.offset);
        this.offset += 0x01;

        return val;
    }

    /**
     * Read an 8 bit integer.
     */
    int8(): int8 {
        const val = this.buffer.readInt8(this.offset);
        this.offset += 0x01;

        return val;
    }

    /**
     * Read a single byte.
     */
    byte(): byte {
        return this.uint8();
    }

    /**
     * Read several bytes.
     */
    bytes(num: number): byte[] {
        const bytes: number[] = [];

        for (let i = 0; i < num; i++) {
            bytes.push(this.byte());
        }

        return bytes;
    }

    /**
     * Read a boolean.
     */
    bool(): boolean {
        return this.uint8() === 0x01;
    }

    /**
     * Read a Big-Endian 32 bit float.
     */
    floatBE(): float {
        const val = this.buffer.readFloatBE(this.offset);
        this.offset += 0x04;

        return val;
    }

    /**
     * Read a Little-Endian 32 bit float.
     */
    floatLE(): float {
        const val = this.buffer.readFloatLE(this.offset);
        this.offset += 0x04;

        return val;
    }

    /**
     * Read a Big-Endian 16 bit half-precision float.
     */
    float16BE(): float {
        const val = this.uint16BE();

        return getFloat32(val);
    }

    /**
     * Read a Little-Endian 16 bit half-precision float.
     */
    float16LE(): float {
        const val = this.uint16BE();

        return getFloat32(val);
    }

    /**
     * Read a Big-Endian 64 bit double.
     */
    doubleBE(): double {
        const val = this.buffer.readDoubleBE(this.offset);
        this.offset += 0x08;

        return val;
    }

    /**
     * Read a Little-Endian 64 bit double.
     */
    doubleLE(): double {
        const val = this.buffer.readDoubleLE(this.offset);
        this.offset += 0x08;

        return val;
    }

    /**
     * Read a packed integer.
     */
    packed(): packed {
        let output = 0;

        for (let shift = 0;; shift+=7) {
            const byte = this.uint8();

            const read = (byte >> 7) & 1;
            const val = read ? byte ^ 0b10000000 : byte;

            output |= val << shift;

            if (!read) {
                break;
            }
        }

        return output;
    }

    /**
     * Read a string with a known length.
     */
    string(length?: number): string {
        if (length === 0) {
            return "";
        }

        if (!length) {
            const len = this.packed();

            return this.string(len);
        }

        let str = "";

        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(this.uint8());
        }

        return str;
    }

    /**
     * Create a list of a structure.
     */
    list<T>(fn: (struct: BufferReader) => T, length?: number): T[] {
        const items: T[] = [];

        for (let i = 0; typeof length === "undefined" ? this.offset < this.size : i < length; i++) {
            const reader = this.slice(this.offset);

            const struct: T = fn(reader);

            this.offset += reader.offset;

            items.push(struct);
        }

        return items;
    }
}
