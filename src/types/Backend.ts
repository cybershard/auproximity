import { ColorID } from "@skeldjs/constant";
import { EventEmitter } from "events";
import chalk from "chalk";
import util from "util";

import logger from "../util/logger";

import { Pose } from "../Client";

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
export interface NodePolusBackendModel extends BackendModel {
    backendType: BackendType.NodePolus;
    ip: string;
}
export interface BepInExBackendModel extends BackendModel {
    backendType: BackendType.BepInEx;
    token: string;
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

export enum MapIdModel {
    TheSkeld = 0,
    MiraHQ = 1,
    Polus = 2
}

// Room groups
export enum RoomGroup {
    Main,
    Spectator,
    Muted
}

export interface HostOptions {
    falloff: number;
    falloffVision: boolean;
    colliders: boolean;
    paSystems: boolean;
}

export interface GameSettings {
    crewmateVision: number;
}

export type LogMode = "log"|"info"|"success"|"fatal"|"warn"|"error";

// Actual backend class
export abstract class BackendAdapter extends EventEmitter {
    abstract backendModel: BackendModel;
    protected constructor() {
        super();
    }
    abstract initialize(): void;
    abstract destroy(): void;
    emitMapChange(map: MapIdModel): void {
        this.emit(BackendEvent.MapChange, { map });
    }
    emitPlayerPose(name: string, pose: Pose): void {
        this.emit(BackendEvent.PlayerPose, { name, pose });
    }
    emitPlayerColor(name: string, color: ColorID) {
        this.emit(BackendEvent.PlayerColor, { name, color });
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
    emitPlayerFromJoinGroup(from: RoomGroup, to: RoomGroup): void {
        this.emit(BackendEvent.PlayerFromJoinGroup, { from, to });
    }
    emitError(err: string): void {
        this.emit(BackendEvent.Error, { err });
    }
    emitHostChange(hostname: string) {
        this.emit(BackendEvent.HostChange, { hostname });
    }
    emitSettingsUpdate(settings: GameSettings) {
        this.emit(BackendEvent.SettingsUpdate, { settings });
    }
    log(mode: LogMode, format: string, ...params: any[]) {
        const formatted = util.format(format, ...params);

        logger[mode](chalk.grey("[" + this.backendModel.gameCode + "]"), formatted);
    }
}

export enum BackendEvent {
    MapChange = "mapchange",
    PlayerPose = "playerpose",
    PlayerColor = "playercolor",
    PlayerJoinGroup = "playerjoingroup",
    AllPlayerPoses = "allplayerposes",
    AllPlayerJoinGroups = "allplayerjoingroup",
    PlayerFromJoinGroup = "playerfromjoingroup",
    Error = "error",
    HostChange = "hostchange",
    SettingsUpdate = "settingsupdate"
}

