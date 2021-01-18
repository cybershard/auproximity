import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import _ from "lodash";

import { RoomGroup } from "../types/enums/RoomGroup";
import { ImpostorBackendModel } from "../types/models/Backends";

import { Pose } from "../Client";
import { IMPOSTOR_BACKEND_PORT } from "../consts";

import { BackendAdapter, LogMode } from "./Backend";

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

            this.connection.on(ImpostorSocketEvents.MapChange, (id: number) => {
                this.emitMapChange(id);
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
                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                } else {
                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                }
            });

            this.connection.on(ImpostorSocketEvents.GameEnd, () => {
                this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
            });

            console.log(`Initialized Impostor Backend at http://${this.backendModel.ip}:${IMPOSTOR_BACKEND_PORT}/hub`);
            this.connection.start()
                .then(() => this.connection.send(ImpostorSocketEvents.TrackGame, this.backendModel.gameCode))
                .catch(err => console.log(`Error in ImpostorBackend: ${err}`));
        } catch (err) {
            console.log(`Error in ImpostorBackend: ${err}`);
        }
    }

    async destroy(): Promise<void> {
        this.log("info", "Destroyed Impostor Backend.");
        return await this.connection.stop();
    }
}

export enum ImpostorSocketEvents {
    TrackGame = "TrackGame",
    MapChange = "MapChange",
    GameStarted = "GameStarted",
    PlayerMove = "PlayerMove",
    MeetingCalled = "MeetingCalled",
    PlayerExiled = "PlayerExiled",
    CommsSabotage = "CommsSabotage",
    GameEnd = "GameEnd"
}
