import { AmongusClient } from "../../Client"

import { GameObject } from "./GameObject"

import { CustomNetworkTransform } from "../components/CustomNetworkTransform"
import { PlayerControl } from "../components/PlayerControl"
import { PlayerPhysics } from "../components/PlayerPhysics"

import {
    SpawnID
} from "../../constants/Enums"

import { ComponentData } from "../../interfaces/Packets"

import { PlayerClient } from "../PlayerClient"

export class Player extends GameObject {
    spawnid: SpawnID.Player;
    components: [PlayerControl, PlayerPhysics, CustomNetworkTransform];

    constructor (client: AmongusClient, parent: PlayerClient, components: Partial<ComponentData>[]) {
        super(client, parent);

        this.spawnid = SpawnID.Player;

        this.id = null;

        this.components = [
            new PlayerControl(client, components[0].netid, components[0].datalen, components[0].data),
            new PlayerPhysics(client, components[1].netid, components[1].datalen, components[1].data),
            new CustomNetworkTransform(client, components[2].netid, components[2].datalen, components[2].data)
        ];

        if (parent instanceof GameObject) {
            parent.addChild(this);
        }
    }

    get PlayerControl() {
        return this.components[0];
    }

    get PlayerPhysics() {
        return this.components[1];
    }

    get CustomNetworkTransform() {
        return this.components[2];
    }
}
