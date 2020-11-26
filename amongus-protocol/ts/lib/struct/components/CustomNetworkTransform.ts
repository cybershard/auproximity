import { AmongusClient } from "../../Client"

import { Component } from "./Component"

import { BufferReader } from "../../util/BufferReader"
import { BufferWriter } from "../../util/BufferWriter";

import {
    Vector2
} from "../../interfaces/Types"

import { LerpValue, UnlerpValue } from "../../util/Lerp";

import {
    DataID,
    MessageID,
    PacketID,
    PayloadID,
    RPCID
} from "../../../index";

export interface CustomNetworkTransform extends Component {
    on(event: "move", listener: (transform: CustomNetworkTransform) => void);
}

export class CustomNetworkTransform extends Component {
    name: "Player";
    classname: "CustomNetworkTransform";

    sequence: number;
    position: Vector2;
    velocity: Vector2;

    constructor(client: AmongusClient, netid: number, datalen?: number, data?: Buffer) {
        super(client, netid);

        this.name = "Player";
        this.classname = "CustomNetworkTransform";

        this.sequence = null;

        if (typeof datalen !== "undefined" && typeof data !== "undefined") {
            this.OnSpawn(datalen, data);
        }
    }

    SidGreater(newSid) {
        if (this.sequence === null) {
            return true;
        }

        const threshold = this.sequence + 0x7FFF;
        const wrapped = threshold > 0xFFFF ? threshold - 0xFFFF : threshold;

        if (wrapped > this.sequence) {
            return newSid > this.sequence && newSid <= wrapped;
        }

        return newSid > this.sequence || newSid <= wrapped;
    }

    OnSpawn(datalen: number, data: Buffer): void {
        return this.OnDeserialize(datalen, data);
    }

    OnDeserialize(datalen: number, data: Buffer): void {
        const reader = new BufferReader(data);

        const sequence = reader.uint16LE();

        if (!this.SidGreater(sequence)) {
            return;
        }

        this.sequence = sequence;

        this.position = {
            x: LerpValue(reader.uint16LE() / 65535, -40, 40),
            y: LerpValue(reader.uint16LE() / 65535, -40, 40)
        }

        this.velocity = {
            x: LerpValue(reader.uint16LE() / 65535, -40, 40),
            y: LerpValue(reader.uint16LE() / 65535, -40, 40)
        }

        this.emit("move", this);
    }

    Serialize() {
        const writer = new BufferWriter;

        writer.uint16LE(this.sequence);
        writer.uint16LE(UnlerpValue(this.position.x, -40, 40) * 65535);
        writer.uint16LE(UnlerpValue(this.position.y, -40, 40) * 65535);
        writer.uint16LE(UnlerpValue(this.velocity.x, -40, 40) * 65535);
        writer.uint16LE(UnlerpValue(this.velocity.y, -40, 40) * 65535);

        return writer.buffer;
    }

    async move(position: Vector2, velocity: Vector2) {
        const data = new BufferWriter;
        this.sequence++;

        if (this.sequence > 0xFFFF) {
            this.sequence -= 0x10000;
        }

        data.uint16LE(this.sequence);
        data.uint16LE(UnlerpValue(position.x, -40, 40) * 65535);
        data.uint16LE(UnlerpValue(position.y, -40, 40) * 65535);
        data.uint16LE(UnlerpValue(velocity.x, -40, 40) * 65535);
        data.uint16LE(UnlerpValue(velocity.x, -40, 40) * 65535);

        await this.client.send({
            op: PacketID.Unreliable,
            payloads: [
                {
                    payloadid: PayloadID.GameData,
                    code: this.client.game.code,
                    parts: [
                        {
                            type: MessageID.Data,
                            datatype: DataID.Movement,
                            netid: this.netid,
                            datalen: data.size,
                            data: data.buffer
                        }
                    ]
                }
            ]
        });
    }

    async snapTo(position: Vector2) {
        await this.client.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.GameData,
                    code: this.client.game.code,
                    parts: [
                        {
                            type: MessageID.RPC,
                            handlerid: this.netid,
                            rpcid: RPCID.SnapTo,
                            x: position.x,
                            y: position.y
                        }
                    ]
                }
            ]
        });
    }
}
