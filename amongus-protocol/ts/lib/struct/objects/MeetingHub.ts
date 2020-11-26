import { AmongusClient } from "../../Client"

import { GameObject } from "./GameObject"

import { MeetingHud } from "../components/MeetingHud"

import {
    SpawnID
} from "../../constants/Enums"

import { ComponentData } from "../../interfaces/Packets"
import { Game } from "../Game"

export class MeetingHub extends GameObject {
    spawnid: SpawnID.MeetingHub;
    components: [MeetingHud];

    constructor (client: AmongusClient, parent: Game, components: Partial<ComponentData>[]) {
        super(client, parent);

        this.spawnid = SpawnID.MeetingHub;

        this.id = null;

        this.components = [
            new MeetingHud(client, components[0].netid, components[0].datalen, components[0].data)
        ];

        if (parent instanceof GameObject) {
            parent.addChild(this);
        }
    }

    get MeetingHud() {
        return this.components[0];
    }
}
