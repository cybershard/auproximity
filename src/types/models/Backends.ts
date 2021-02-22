import { PublicLobbyRegion } from "./PublicLobbyRegion";

export enum BackendType {
    NoOp,
    PublicLobby,
    Impostor,
    BepInEx,
    NodePolus
}

export interface BackendModel {
    gameCode: string;
    backendType: BackendType;
}

export interface PublicLobbyBackendModel extends BackendModel {
    backendType: BackendType.PublicLobby;
    region: PublicLobbyRegion;
}

export interface ImpostorBackendModel extends BackendModel {
    backendType: BackendType.Impostor;
    ip: string;
}

export interface NodePolusBackendModel extends BackendModel {
    backendType: BackendType.NodePolus;
    ip: string;
}

export interface BepInExBackendModel extends BackendModel {
    backendType: BackendType.BepInEx;
    token: string;
}