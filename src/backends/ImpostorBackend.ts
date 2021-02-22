import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import _ from "lodash";

import { RoomGroup } from "../types/enums/RoomGroup";
import { ImpostorBackendModel } from "../types/models/Backends";

import { Pose } from "../Client";
import { IMPOSTOR_BACKEND_PORT } from "../consts";

import { BackendAdapter } from "./Backend";
import { GameSettings } from "../types/models/ClientOptions";

export default class ImpostorBackend extends BackendAdapter {
    backendModel: ImpostorBackendModel;
    connection!: HubConnection;

    constructor(backendModel: ImpostorBackendModel) {
        super();

        this.backendModel = backendModel;
        this.gameID = this.backendModel.ip + ":" + IMPOSTOR_BACKEND_PORT;
    }

    throttledEmitPlayerMove = _.throttle(this.emitPlayerPose, 300);

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
                this.emitAllPlayerJoinGroups(RoomGroup.Main);
            });

            this.connection.on(ImpostorSocketEvents.PlayerMove, (name: string, pose: Pose) => {
                this.throttledEmitPlayerMove(name, pose);
            });

            this.connection.on(ImpostorSocketEvents.MeetingCalled, () => {
                this.emitAllPlayerPoses({ x: 0, y: 0 });
            });

            this.connection.on(ImpostorSocketEvents.PlayerExiled, (name: string) => {
                this.emitPlayerJoinGroup(name, RoomGroup.Spectator);
            });

            this.connection.on(ImpostorSocketEvents.CommsSabotage, (fix: boolean) => {
                if (fix) {
                    this.log("info", "Communications was repaired.");
                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                } else {
                    this.log("info", "Communications was sabotaged.");
                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                }
            });

            this.connection.on(ImpostorSocketEvents.GameEnd, () => {
                this.log("info", "Game ended.");
                this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
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
