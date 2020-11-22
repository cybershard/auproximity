import { AmongusClient } from "../../Client"

import { Component } from "./Component"

import {
    SystemType
} from "../../constants/Enums"

import { SwitchSystem } from "../systems/SwitchSystem";
import { MedScanSystem } from "../systems/MedScanSystem";
import { ReactorSystem } from "../systems/ReactorSystem";
import { LifeSuppSystem } from "../systems/LifeSuppSystem";
import { SecuritySystem } from "../systems/SecuritySystem";
import { HQHudOverrideSystem } from "../systems/HQHudOverrideSystem";
import { HudOverrideSystem } from "../systems/HudOverrideSystem";
import { DoorsSystem } from "../systems/DoorsSystem";
import { SabotageSystem } from "../systems/SabotageSystem";
import { BufferReader } from "../../util/BufferReader";
import { DeconSystem } from "../systems/DeconSystem";

export class ShipStatus extends Component {
    name: "ShipStatus";
    classname: "ShipStatus";

    systems: Partial<{
        [SystemType.Reactor]: ReactorSystem;
        [SystemType.Electrical]: SwitchSystem;
        [SystemType.O2]: LifeSuppSystem;
        [SystemType.MedBay]: MedScanSystem;
        [SystemType.Security]: SecuritySystem;
        [SystemType.Communications]: HQHudOverrideSystem|HudOverrideSystem;
        [SystemType.Doors]: DoorsSystem;
        [SystemType.Sabotage]: SabotageSystem;
        [SystemType.Decontamination]: DeconSystem;
        [SystemType.Laboratory]: ReactorSystem;
    }>;

    constructor(client: AmongusClient, netid: number, datalen?: number, data?: Buffer) {
        super(client, netid);

        this.name = "ShipStatus";
        this.classname = "ShipStatus";

        if (typeof datalen !== "undefined" && typeof data !== "undefined") {
            this.OnSpawn(datalen, data);
        }
    }

    OnSpawn(datalen: number, data: Buffer): void {
        const reader = new BufferReader(data);

        for (let i = 0; i < 30; i++) {
            if (this.systems[i]) {
                const system = this.systems[i];

                system.OnSpawn(reader);
            }
        }
    }

    OnDeserialize(datalen: number, data: Buffer): void {
        const reader = new BufferReader(data);

        const updateMask = reader.packed();

        for (let i = 0; i < 30; i++) {
            if ((updateMask & (1 << i)) !== 0) {
                if (this.systems[i]) {
                    const system = this.systems[i];

                    system.OnDeserialize(reader);
                }
            }
        }
    }
}
