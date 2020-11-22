import { AmongusClient } from "../../Client"

import { Component } from "./Component"
import { BufferReader } from "../../util/BufferReader"

import {
    uint8
} from "../../interfaces/Types"

import {
    ColourID,
    HatID,
    MessageID,
    PacketID,
    PayloadID,
    PetID,
    RPCID,
    SkinID
} from "../../../index";
import { BufferWriter } from "../../util/BufferWriter";
import { write } from "fs";

interface PlayerControlOnSpawn {
    isNew: boolean;
}

export class PlayerControl extends Component {
    name: "Player";
    classname: "PlayerControl";

    playerId: uint8;

    constructor(client: AmongusClient, netid: number, datalen?: number, data?: Buffer) {
        super(client, netid);

        this.name = "Player";
        this.classname = "PlayerControl";

        if (typeof datalen !== "undefined" && typeof data !== "undefined") {
            this.OnSpawn(datalen, data);
        }
    }

    OnSpawn(datalen: number, data: Buffer): PlayerControlOnSpawn {
        const reader = new BufferReader(data);

        const isNew = reader.bool();
        this.playerId = reader.uint8();

        return {
            isNew
        }
    }

    OnDeserialize(datalen: number, data: Buffer): void {
        const reader = new BufferReader(data);

        this.playerId = reader.uint8();
    }

    Serialize(isNew: boolean = false) {
        const writer = new BufferWriter;

        writer.bool(isNew);
        writer.uint8(this.playerId);

        return writer.buffer;
    }

    async murderPlayer(netid: number) {
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
                            rpcid: RPCID.MurderPlayer,
                            targetnetid: netid
                        }
                    ]
                }
            ]
        });
    }

    async setColour(colour: ColourID) {
        if (this.client.clientid === this.client.game.hostid) {
            await this.client.send({
                op: PacketID.Reliable,
                payloads:[
                    {
                        payloadid: PayloadID.GameData,
                        code: this.client.game.code,
                        parts: [
                            {
                                type: MessageID.RPC,
                                handlerid: this.netid,
                                rpcid: RPCID.SetColour,
                                colour
                            }
                        ]
                    }
                ]
            });
        } else {
            await this.client.send({
                op: PacketID.Reliable,
                payloads:[
                    {
                        payloadid: PayloadID.GameDataTo,
                        recipient: this.client.game.hostid,
                        code: this.client.game.code,
                        parts: [
                            {
                                type: MessageID.RPC,
                                handlerid: this.netid,
                                rpcid: RPCID.CheckColour,
                                colour
                            }
                        ]
                    }
                ]
            });

            await this.client.awaitPayload(payload =>
                payload.payloadid === PayloadID.GameData
                    && payload.parts.some(part => part.type === MessageID.RPC && part.rpcid === RPCID.SetColour));
        }
    }

    async setName(name: string) {
        if (this.client.clientid === this.client.game.hostid) {
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
                                rpcid: RPCID.SetName,
                                name
                            }
                        ]
                    }
                ]
            });
        } else {
            await this.client.send({
                op: PacketID.Reliable,
                payloads: [
                    {
                        payloadid: PayloadID.GameDataTo,
                        recipient: this.client.game.hostid,
                        code: this.client.game.code,
                        parts: [
                            {
                                type: MessageID.RPC,
                                handlerid: this.netid,
                                rpcid: RPCID.CheckName,
                                name
                            }
                        ]
                    }
                ]
            });

            await this.client.awaitPayload(payload =>
                payload.payloadid === PayloadID.GameData
                && payload.parts.some(part => part.type === MessageID.RPC && part.handlerid === this.netid && part.rpcid === RPCID.SetName));
        }
    }

    async setHat(hat: HatID) {
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
                            rpcid: RPCID.SetHat,
                            hat
                        }
                    ]
                }
            ]
        });
    }

    async setSkin(skin: SkinID) {
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
                            rpcid: RPCID.SetSkin,
                            skin: skin
                        }
                    ]
                }
            ]
        });
    }

    async setPet(pet: PetID) {
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
                            rpcid: RPCID.SetPet,
                            pet: pet
                        }
                    ]
                }
            ]
        });
    }

    async chat(text: string) {
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
                            rpcid: RPCID.SendChat,
                            text
                        }
                    ]
                }
            ]
        });
    }
}
