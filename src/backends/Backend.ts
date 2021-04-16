import { ColorID } from "@skeldjs/constant";
import { EventEmitter } from "events";
import util from "util";
import chalk from "chalk";

import logger from "../util/logger";

import { BackendModel, BackendType } from "../types/models/Backends";
import { GameSettings } from "../types/models/ClientOptions";
import { BackendEvent } from "../types/enums/BackendEvents";
import { PlayerFlag } from "../types/enums/PlayerFlags";
import { GameState } from "../types/enums/GameState";
import { GameFlag } from "../types/enums/GameFlags";
import { Vector2 } from "@skeldjs/util";

export type LogMode = "log"|"info"|"success"|"fatal"|"warn"|"error";

// Actual backend class
export abstract class BackendAdapter extends EventEmitter {
    abstract backendModel: BackendModel;
    destroyed: boolean;
    gameID: string;
    
    protected constructor() {
        super();
    }

    abstract initialize(): void;
    abstract destroy(): void;
    
    log(mode: LogMode, format: string, ...params: unknown[]): void {
        const formatted = util.format(format, ...params);

        logger[mode](chalk.grey("[" + BackendType[this.backendModel.backendType] + " " + this.gameID + "]"), formatted);
    }

    emitPlayerPosition(name: string, position: Vector2): void {
        this.emit(BackendEvent.PlayerPosition, { name, position });
    }

    emitPlayerColor(name: string, color: ColorID): void {
        this.emit(BackendEvent.PlayerColor, { name, color });
    }

    emitHostChange(name: string): void {
        this.emit(BackendEvent.HostChange, { name });
    }

    emitGameState(state: GameState): void {
        this.emit(BackendEvent.GameState, { state });
    }

    emitSettingsUpdate(settings: GameSettings): void {
        this.emit(BackendEvent.SettingsUpdate, { settings });
    }

    emitPlayerFlags(name: string, flags: PlayerFlag, set: boolean): void {
        this.emit(BackendEvent.PlayerFlags, { name, flags, set });
    }

    emitGameFlags(flags: GameFlag, set: boolean): void {
        this.emit(BackendEvent.GameFlags, { flags, set });
    }

    emitError(err: string, fatal: boolean): void {
        this.emit(BackendEvent.Error, { err, fatal });
    }
}