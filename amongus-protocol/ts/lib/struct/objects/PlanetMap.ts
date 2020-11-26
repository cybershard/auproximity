import { AmongusClient } from "../../Client"

import { GameObject } from "./GameObject"

import { ShipStatus  } from "../components/ShipStatus"

import {
    SpawnID,
    SystemType
} from "../../constants/Enums"

import { ComponentData } from "../../interfaces/Packets"
import { Game } from "../Game"

import { SwitchSystem } from "../systems/SwitchSystem";
import { MedScanSystem } from "../systems/MedScanSystem";
import { ReactorSystem } from "../systems/ReactorSystem";
import { SecuritySystem } from "../systems/SecuritySystem";
import { HudOverrideSystem } from "../systems/HudOverrideSystem";
import { DoorsSystem } from "../systems/DoorsSystem";
import { SabotageSystem } from "../systems/SabotageSystem";

export class PlanetMap extends GameObject {
    spawnid: SpawnID.PlanetMap;
    components: [ShipStatus];

    constructor (client: AmongusClient, parent: Game, components: Partial<ComponentData>[]) {
        super(client, parent);

        this.spawnid = SpawnID.PlanetMap;

        this.id = null;

        this.components = [
            new ShipStatus(client, components[0].netid)
        ];

        this.ShipStatus.systems = {
            [SystemType.Electrical]: new SwitchSystem,
            [SystemType.MedBay]: new MedScanSystem,
            [SystemType.Security]: new SecuritySystem,
            [SystemType.Communications]: new HudOverrideSystem,
            [SystemType.Doors]: new DoorsSystem,
            [SystemType.Sabotage]: new SabotageSystem,
            [SystemType.Laboratory]: new ReactorSystem
        }

        this.ShipStatus.systems[SystemType.Doors].SetDoors(12);
        this.ShipStatus.OnSpawn(components[0].datalen, components[0].data);

        if (parent instanceof GameObject) {
            parent.addChild(this);
        }
    }

    get ShipStatus() {
        return this.components[0];
    }
}
