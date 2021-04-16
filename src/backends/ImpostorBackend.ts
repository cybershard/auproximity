import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import _ from "lodash";

import { ImpostorBackendModel } from "../types/models/Backends";

import { IMPOSTOR_BACKEND_PORT } from "../consts";

import { BackendAdapter } from "./Backend";
import { GameSettings } from "../types/models/ClientOptions";
import { GameState } from "../types/enums/GameState";
import { PlayerFlag } from "../types/enums/PlayerFlags";
import { GameFlag } from "../types/enums/GameFlags";
import { Vector2 } from "@skeldjs/util";

export default class ImpostorBackend extends BackendAdapter {
    backendModel: ImpostorBackendModel;
    connection!: HubConnection;

    constructor(backendModel: ImpostorBackendModel) {
        super();

        this.backendModel = backendModel;
        this.gameID = this.backendModel.ip + ":" + IMPOSTOR_BACKEND_PORT;
    }

    throttledEmitPlayerMove = _.throttle(this.emitPlayerPosition, 300);

    initialize(): void {
        try {
            this.connection = new HubConnectionBuilder()
                .withUrl(`http://${this.backendModel.ip}:${IMPOSTOR_BACKEND_PORT}/hub`).build();

            this.connection.on(ImpostorSocketEvents.HostChange, (name: string) => {
                this.log("info", "Host changed to " + name + ".");
                this.emitHostChange(name);
            });

            this.connection.on(ImpostorSocketEvents.SettingsUpdate, (settings: GameSettings) => {
                this.emitSettingsUpdate(settings);
            });

            this.connection.on(ImpostorSocketEvents.GameStarted, () => {
                this.emitGameState(GameState.Game);
            });

            this.connection.on(ImpostorSocketEvents.PlayerMove, (name: string, pose: Vector2) => {
                this.throttledEmitPlayerMove(name, pose);
            });

            this.connection.on(ImpostorSocketEvents.MeetingCalled, () => {
                this.emitGameState(GameState.Meeting);
            });

            this.connection.on(ImpostorSocketEvents.PlayerExiled, (name: string) => {
                this.emitPlayerFlags(name, PlayerFlag.IsDead, true);
            });

            this.connection.on(ImpostorSocketEvents.CommsSabotage, (fix: boolean) => {
                if (fix) {
                    this.log("info", "Communications was repaired.");
                    this.emitGameFlags(GameFlag.CommsSabotaged, false);
                } else {
                    this.log("info", "Communications was sabotaged.");
                    this.emitGameFlags(GameFlag.CommsSabotaged, true);
                }
            });

            this.connection.on(ImpostorSocketEvents.GameEnd, () => {
                this.log("info", "Game ended.");
                this.emitGameState(GameState.Lobby);
            });

            this.log("info", `Impostor Backend initialized at http://${this.backendModel.ip}:${IMPOSTOR_BACKEND_PORT}/hub`);
            this.connection.start()
                .then(() => this.connection.send(ImpostorSocketEvents.TrackGame, this.backendModel.gameCode))
                .catch(err => this.log("error", `Error in ImpostorBackend: ${err}`));
        } catch (err) {
            this.log("error", `Error in ImpostorBackend: ${err}`);
        }
    }

    async destroy(): Promise<void> {
        this.log("info", "Destroyed Impostor Backend.");
        return await this.connection.stop();
    }
}

export enum ImpostorSocketEvents {
    TrackGame = "TrackGame",
    HostChange = "HostChange",
    SettingsUpdate = "SettingsUpdate",
    GameStarted = "GameStarted",
    PlayerMove = "PlayerMove",
    MeetingCalled = "MeetingCalled",
    PlayerExiled = "PlayerExiled",
    CommsSabotage = "CommsSabotage",
    GameEnd = "GameEnd"
}
