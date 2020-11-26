import { AmongusClient } from "../../Client"

import { Component } from "./Component"
import { BufferReader } from "../../util/BufferReader"
import { BufferWriter } from "../../util/BufferWriter";
import { write } from "fs";

export interface VoteBanSystem {
    on(event: "update", listener: (votes: Map<number, number[]>) => void);
}

export class VoteBanSystem extends Component {
    name: "GameData";
    classname: "VoteBanSystem";

    /**
     * The number of clients who have been voted.
     */
    num_voted: number;

    /**
     * A map of clients who have been voted, with the value being an array of players who voted.
     */
    votes: Map<number, number[]>

    constructor(client: AmongusClient, netid: number, datalen?: number, data?: Buffer) {
        super(client, netid);

        this.name = "GameData";
        this.classname = "VoteBanSystem";

        this.num_voted = 0;
        this.votes = new Map;

        if (typeof datalen !== "undefined" && typeof data !== "undefined") {
            this.OnSpawn(datalen, data);
        }
    }

    OnSpawn(datalen: number, data: Buffer): void {
        return this.OnDeserialize(datalen, data);
    }

    OnDeserialize(datalen: number, data: Buffer): void {
        const reader = new BufferReader(data);

        this.num_voted = reader.byte();

        for (let i = 0; i < this.num_voted; i++) {
            const voted = reader.int32LE();

            if (voted) {
                if (!this.votes.get(voted)) {
                    this.votes.set(voted, []);
                }

                for (let i = 0; i < 3; i++) {
                    this.votes.get(voted).push(reader.packed());
                }
            } else {
                break;
            }
        }

        this.emit("update", this.votes);
    }

    Serialize() {
        const writer = new BufferWriter;

        writer.packed(this.votes.size);

        for (let [clientid, votes] of this.votes) {
            writer.int32BE(clientid);
            for (let i = 0; i < 3; i++) {
                writer.packed(votes[i]);
            }
        }

        return writer.buffer;
    }
}
