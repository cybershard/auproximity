import { EventEmitter } from "events";
import {Pose} from "../Client";

// For duck-typing the model
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
export enum BackendType {
    NoOp,
    PublicLobby,
    Impostor,
    BepInEx,
    NodePolus
}
export enum PublicLobbyRegion {
    NorthAmerica,
    Europe,
    Asia
}

// Room groups
export enum RoomGroup {
    Main,
    Spectator
}

// Actual backend class
export abstract class BackendAdapter extends EventEmitter {
    abstract backendModel: BackendModel;
    protected constructor() {
        super();
    }
    abstract initialize(): void;
    abstract destroy(): void;
    emitPlayerPose(name: string, pose: Pose): void {
        this.emit(BackendEvent.PlayerPose, { name, pose });
    }
    emitPlayerJoinGroup(name: string, group: RoomGroup): void {
        this.emit(BackendEvent.PlayerJoinGroup, { name, group });
    }
    emitAllPlayerPoses(pose: Pose): void {
        this.emit(BackendEvent.AllPlayerPoses, { pose });
    }
    emitAllPlayerJoinGroups(group: RoomGroup): void {
        this.emit(BackendEvent.AllPlayerJoinGroups, { group });
    }
}

export enum BackendEvent {
    PlayerPose = "playerpose",
    PlayerJoinGroup = "playerjoingroup",
    AllPlayerPoses = "allplayerposes",
    AllPlayerJoinGroups = "allplayerjoingroup",
    Error = "error"
}

