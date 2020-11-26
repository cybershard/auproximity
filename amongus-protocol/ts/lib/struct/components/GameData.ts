import { AmongusClient } from "../../Client"

import { Component } from "./Component"
import { BufferReader } from "../../util/BufferReader"

import { parsePlayerData } from "../../Parser";

import {
    ParsedPlayerGameData
} from "../../interfaces/Packets";
import { BufferWriter } from "../../util/BufferWriter";

export interface GameData {
    on(event: "playerData", listener: (data: ParsedPlayerGameData) => void);
}

export class GameData extends Component {
    name: "GameData";
    classname: "GameData";

    num_players: number;
    players: Map<number, ParsedPlayerGameData>;

    dirty_bits: number;

    constructor(client: AmongusClient, netid: number, datalen?: number, data?: Buffer) {
        super(client, netid);

        this.name = "GameData";
        this.classname = "GameData";

        this.num_players = null;
        this.players = new Map;

        if (typeof datalen !== "undefined" && typeof data !== "undefined") {
            this.OnSpawn(datalen, data);
        }
    }

    OnSpawn(datalen: number, data: Buffer): void {
        return this.OnDeserialize(datalen, data);
    }

    OnDeserialize(datalen: number, data: Buffer): void {
        const reader = new BufferReader(data);

        this.num_players = reader.packed();

        for (let i = 0; i < this.num_players; i++) {
            const player = parsePlayerData(reader);

            this.emit("playerData", player);

            this.players.set(player.playerId, player);
        }
    }

    Serialize() {
        const writer = new BufferWriter;

        writer.packed(this.players.size);
        for (let [playerid, player] of this.players) {
            if (((1 << playerid) & this.dirty_bits) !== 0x00) {
                const player_writer = new BufferWriter;

                player_writer.uint8(player.playerId);
                player_writer.string(player.name, true);
                player_writer.uint8(player.colour);
                player_writer.packed(player.hat);
                player_writer.packed(player.pet);
                player_writer.packed(player.skin);
                player_writer.byte(player.flags);
                player_writer.uint8(player.num_tasks);

                for (let i = 0; i < player.tasks.length; i++) {
                    const task = player.tasks[i];

                    player_writer.packed(task.taskid);
                    player_writer.bool(task.completed);
                }

                writer.uint16LE(player_writer.size - 1);
                writer.write(player_writer);
            }
        }

        this.dirty_bits = 0;

        return writer.buffer;
    }

    UpdatePlayers(players: ParsedPlayerGameData[]) {
        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            this.emit("playerData", player);

            this.players.set(player.playerId, player);
        }
    }
}
