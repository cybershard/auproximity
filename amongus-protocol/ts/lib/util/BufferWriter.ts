import util from "util"

import { BufferWriterOptions } from "../interfaces/BufferWriterOptions"

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

import { getFloat16 } from "./Float16";

/**
 * Represents a buffer writer.
 */
export class BufferWriter {
    buffer: Buffer;
    offset: number;
    options: BufferWriterOptions;

    constructor(options: BufferWriterOptions = {}) {
        this.buffer = Buffer.alloc(options.initial ?? 0x00);
        this.offset = 0x00;
        this.options = {
            dynamic: true,
            initial: 0,
            maxSize: 5242880,
            ...options
        }
    }

    [Symbol.toStringTag]() {
        return this.buffer.toString();
    }

    [util.inspect.custom]() {
        return this.buffer;
    }

    [Symbol.iterator](item: number) {
        return this.buffer.readUInt8(item);
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
     * Expand the buffer to make room for the required amount of space.
     */
    expand(required: number = 0) {
        if (this.offset + required > this.buffer.byteLength && this.offset + required < this.options.maxSize) {
            const new_buffer = Buffer.alloc(this.offset + required);

            this.buffer.copy(new_buffer);

            this.buffer = new_buffer;
        }

        return this;
    }

    /**
     * Pad empty bytes for unknown for unneeded data.
     */
    pad(bytes: number) {
        if (this.options.dynamic) this.expand(bytes);

        this.offset += bytes;

        return this;
    }

    /**
     * Write a Big-Endian unsigned 32 bit integer.
     */
    uint32BE(val: uint32) {
        if (this.options.dynamic) this.expand(0x04);
        this.buffer.writeUInt32BE(val, this.offset);

        this.offset += 0x04;

        return this;
    }

    /**
     * Write a Little-Endian unsigned 32 bit integer.
     */
    uint32LE(val: uint32) {
        if (this.options.dynamic) this.expand(0x04);
        this.buffer.writeUInt32LE(val, this.offset);

        this.offset += 0x04;

        return this;
    }

    /**
     * Write a Big-Endian 32 bit integer.
     */
    int32BE(val: int32) {
        if (this.options.dynamic) this.expand(0x04);
        this.buffer.writeInt32BE(val, this.offset);

        this.offset += 0x04;

        return this;
    }

    /**
     * Write a Little-Endian 32 bit integer.
     */
    int32LE(val: int32) {
        if (this.options.dynamic) this.expand(0x04);
        this.buffer.writeInt32LE(val, this.offset);

        this.offset += 0x04;

        return this;
    }

    /**
     * Write a Big-Endian unsigned 16 bit integer.
     */
    uint16BE(val: uint16) {
        if (this.options.dynamic) this.expand(0x02);
        this.buffer.writeUInt16BE(val, this.offset);

        this.offset += 0x02;

        return this;
    }

    /**
     * Write a Little-Endian unsigned 16 bit integer.
     */
    uint16LE(val: uint16) {
        if (this.options.dynamic) this.expand(0x02);
        this.buffer.writeUInt16LE(val, this.offset);

        this.offset += 0x02;

        return this;
    }

    /**
     * Write a Big-Endian 16 bit integer.
     */
    int16BE(val: int16) {
        if (this.options.dynamic) this.expand(0x02);
        this.buffer.writeInt16BE(val, this.offset);

        this.offset += 0x02;

        return this;
    }

    /**
     * Write a Little-Endian 16 bit integer.
     */
    int16LE(val: int16) {
        if (this.options.dynamic) this.expand(0x02);
        this.buffer.writeInt16LE(val, this.offset);

        this.offset += 0x02;

        return this;
    }

    /**
     * Write an unsigned 8 bit integer.
     */
    uint8(val: uint8) {
        if (this.options.dynamic) this.expand(0x01);
        this.buffer.writeUInt8(val, this.offset);

        this.offset += 0x01;

        return this;
    }

    /**
     * Write a signed 8 bit integer.
     */
    int8(val: int8) {
        if (this.options.dynamic) this.expand(0x01);
        this.buffer.writeInt8(val, this.offset);

        this.offset += 0x01;

        return this;
    }

    /**
     * Write a singular byte. (Unsigned 8 bit integer)
     */
    byte(val: byte) {
        return this.uint8(val);
    }

    /**
     * Read a boolean.
     */
    bool(val: boolean) {
        return this.uint8(val ? 0x01 : 0x00);
    }

    /**
     * Write several bytes.
     */
    bytes(bytes: byte[]) {
        if (bytes.length < 1) return this;

        return this.write(Buffer.from(bytes));
    }

    /**
     * Write a buffer or buffer writer.
     */
    write(bytes: Buffer|BufferWriter) {
        if (bytes instanceof BufferWriter) {
            return this.write(bytes.buffer);
        }

        this.buffer = Buffer.concat([this.buffer, bytes]);
        this.offset += bytes.byteLength;
        return;
    }

    /**
     * Write a Big-Endian 32 bit float.
     */
    floatBE(val: float) {
        if (this.options.dynamic) this.expand(0x04);
        this.buffer.writeFloatBE(val, this.offset);

        this.offset += 0x04;

        return this;
    }

    /**
     * Write a Little-Endian 32 bit float.
     */
    floatLE(val: float) {
        if (this.options.dynamic) this.expand(0x04);
        this.buffer.writeFloatLE(val, this.offset);

        this.offset += 0x04;

        return this;
    }

    /**
     * Write a Big-Endian 16 bit half-precision float.
     */
    float16BE(val: float): BufferWriter {
        return this.uint16BE(getFloat16(val));
    }

    /**
     * Write a Little-Endian 16 bit half-precision float.
     */
    float16LE(val: float): BufferWriter {
        return this.uint16LE(getFloat16(val));
    }

    /**
     * Write a Big-Endian 64 bit double.
     */
    doubleBE(val: double) {
        if (this.options.dynamic) this.expand(0x08);
        this.buffer.writeDoubleBE(val, this.offset);

        this.offset += 0x08;

        return this;
    }

    /**
     * Write a Little-Endian 64 bit double.
     */
    doubleLE(val: double) {
        if (this.options.dynamic) this.expand(0x08);
        this.buffer.writeDoubleLE(val, this.offset);

        this.offset += 0x08;

        return this;
    }

    /**
     * Write a packed integer.
     */
    packed(val: packed) {
        do {
            let b = val & 0b11111111;

            if (val >= 0b10000000) {
                b |= 0b10000000;
            }

            this.uint8(b);

            val >>= 7;
        } while (val > 0);

        return this;
    }

    /**
     * Write a string with an unknown length
     */
    string(string: string, preflen: boolean = false) {
        if (preflen) {
            this.packed(string.length);
        }

        if (this.options.dynamic) this.expand(string.length);

        this.buffer.write(string, this.offset, "utf8");

        this.offset += string.length;

        return this;
    }
}
