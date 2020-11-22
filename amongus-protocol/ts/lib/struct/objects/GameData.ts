import { AmongusClient } from "../../Client"

import { GameObject } from "./GameObject"

import { Component } from "../components/Component"

import { GameData as GameDataComponent } from "../components/GameData"
import { VoteBanSystem } from "../components/VoteBanSystem"

import {
    SpawnID
} from "../../constants/Enums"

import { ComponentData } from "../../interfaces/Packets"
import { Game } from "../Game"

export class GameData extends GameObject {
    spawnid: SpawnID.GameData;
    components: [GameDataComponent, VoteBanSystem];

    constructor (client: AmongusClient, parent: Game, components: Partial<ComponentData>[]) {
        super(client, parent);

        this.spawnid = SpawnID.GameData;

        this.id = null;

        this.components = [
            new GameDataComponent(client, components[0].netid, components[0].datalen, components[0].data),
            new VoteBanSystem(client, components[1].netid, components[1].datalen, components[1].data)
        ];

        if (parent instanceof GameObject) {
            parent.addChild(this);
        }
    }

    get GameData() {
        return this.components[0];
    }

    get VoteBanSystem() {
        return this.components[1];
    }
}
