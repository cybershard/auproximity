import { MapID } from "@skeldjs/constant";

export interface HostOptions {
    falloff: number;
    falloffVision: boolean;
    colliders: boolean;
    paSystems: boolean;
}

export interface GameSettings {
    crewmateVision: number;
    map: MapID;
}

export interface ClientOptions {
    omniscientGhosts: boolean;
}
