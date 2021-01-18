import { ColorID, MapID } from "@skeldjs/constant";
import { EventEmitter } from "events";
import util from "util";
import chalk from "chalk";

import logger from "../util/logger";

import { Pose } from "../Client";

import { BackendModel, BackendType } from "../types/models/Backends";
import { GameSettings } from "../types/models/ClientOptions";
import { RoomGroup } from "../types/enums/RoomGroup";
import { BackendEvent } from "../types/enums/BackendEvent";
import { PlayerFlags } from "../types/enums/PlayerFlags";

export type LogMode = "log"|"info"|"success"|"fatal"|"warn"|"error";

// Actual backend class
export abstract class BackendAdapter extends EventEmitter {
    abstract backendModel: BackendModel;
    gameID: string;
    
    protected constructor() {
        super();
    }

    abstract initialize(): void;
    abstract destroy(): void;
    
    log(mode: LogMode, format: string, ...params: any[]) {
        const formatted = util.format(format, ...params);

        logger[mode](chalk.grey("[" + BackendType[this.backendModel.backendType] + " " + this.gameID + "]"), formatted);
    }

    emitMapChange(map: MapID): void {
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

    emitHostChange(hostname: string) {
        this.emit(BackendEvent.HostChange, { hostname });
    }

    emitSettingsUpdate(settings: GameSettings) {
        this.emit(BackendEvent.SettingsUpdate, { settings });
    }

    emitPlayerFlags(name: string, flags: PlayerFlags, set: boolean) {
        this.emit(BackendEvent.PlayerFlags, { name, flags, set });
    }

    emitError(err: string): void {
        this.emit(BackendEvent.Error, { err });
    }
}