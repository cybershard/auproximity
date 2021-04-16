import { MapID } from '@skeldjs/constant'

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

export enum GameState {
  Lobby,
  Game,
  Meeting
}

export enum GameFlag {
  None = 0,
  CommsSabotaged = 1
}
