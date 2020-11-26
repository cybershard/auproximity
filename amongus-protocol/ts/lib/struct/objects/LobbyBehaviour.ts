import { AmongusClient } from "../../Client"

import { GameObject } from "./GameObject"

import { FollowerCamera } from "../components/FollowerCamera"

import {
    SpawnID
} from "../../constants/Enums"

import { ComponentData } from "../../interfaces/Packets"
import { Game } from "../Game"

export class LobbyBehaviour extends GameObject {
    spawnid: SpawnID.LobbyBehaviour;
    components: [FollowerCamera];

    constructor (client: AmongusClient, parent: Game, components: Partial<ComponentData>[]) {
        super(client, parent);

        this.spawnid = SpawnID.LobbyBehaviour;

        this.id = null;

        this.components = [
            new FollowerCamera(client, components[0].netid, components[0].datalen, components[0].data)
        ];

        if (parent instanceof GameObject) {
            parent.addChild(this);
        }
    }

    get FollowerCamera() {
        return this.components[0];
    }
}
