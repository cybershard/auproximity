import { Socket } from "socket.io";

import { ColorID } from "@skeldjs/constant";
import { Vector2 } from "@skeldjs/util";

import {
    BackendModel,
    BackendType,
    BepInExBackendModel,
    ImpostorBackendModel,
    NodePolusBackendModel,
    PublicLobbyBackendModel
} from "./types/models/Backends";

import {
    GameSettings,
    HostOptions
} from "./types/models/ClientOptions";

import { ClientSocketEvents } from "./types/enums/ClientSocketEvents";

import { ClientBase } from "./types/ClientBase";
import Room from "./Room";
import { state } from "./main";
import { PlayerFlag } from "./types/enums/PlayerFlags";
import { GameFlag } from "./types/enums/GameFlags";
import { GameState } from "./types/enums/GameState";

export interface PlayerModel {
    name: string;
    position: Vector2;
    color: ColorID;
    flags: number;
}

export default class Client implements ClientBase {
    public socket: Socket
    public room?: Room;

    public readonly uuid: string;

    public name: string;

    constructor(socket: Socket, uuid: string) {
        this.socket = socket;
        this.uuid = uuid;
        this.name = "";

        // Initialize socket events
        this.socket.on(ClientSocketEvents.RemoveClient, async (payload: { uuid: string, ban: boolean }) => {
            if (this.room && this.room.clients && this.name === this.room.hostname) {
                const client = this.room.clients.find(member => member.uuid === payload.uuid);
                if (client) {
                    await this.room.removeClient(client, payload.ban);
                }
            }
        });

        this.socket.on(ClientSocketEvents.Disconnect, async () => {
            await this.handleDisconnect();
        });

        this.socket.on(ClientSocketEvents.JoinRoom, async (payload: { name: string; backendModel: BackendModel }) => {
            await this.joinRoom(payload.name, payload.backendModel);
        });

        this.socket.on(ClientSocketEvents.SetOptions, async (payload: { options: HostOptions }) => {
            if (this.room && this.name === this.room.hostname) {
                await this.room.setOptions(payload.options);
            }
        });

        this.socket.emit(ClientSocketEvents.SetUuid, this.uuid);
    }

    async joinRoom(name: string, backendModel: BackendModel): Promise<void> {
        if (this.room) {
            await this.leaveRoom();
        }

        this.name = name;

        // TODO: make this just a deepEqual on backendModel
        let room = state.allRooms.find(room => {
            if (room.backendModel.gameCode !== backendModel.gameCode) return false;

            if (room.backendModel.backendType === BackendType.Impostor && backendModel.backendType === BackendType.Impostor) {
                return (room.backendModel as ImpostorBackendModel).ip === (backendModel as ImpostorBackendModel).ip;
            } else if (room.backendModel.backendType === BackendType.PublicLobby && backendModel.backendType === BackendType.PublicLobby) {
                return (room.backendModel as PublicLobbyBackendModel).region === (backendModel as PublicLobbyBackendModel).region;
            } else if (room.backendModel.backendType === BackendType.NodePolus && backendModel.backendType === BackendType.NodePolus) {
                return (room.backendModel as NodePolusBackendModel).ip === (backendModel as NodePolusBackendModel).ip;
            } else if (room.backendModel.backendType === BackendType.BepInEx && backendModel.backendType === BackendType.BepInEx) {
                return (room.backendModel as BepInExBackendModel).token === (backendModel as BepInExBackendModel).token;
            }
            return false;
        });

        if (!room) {
            room = new Room(backendModel);
            state.allRooms.push(room);
        }

        room.addClient(this);
        this.room = room;
    }
    
    async leaveRoom(): Promise<void> {
        this.name = "";
        if (!this.room) return;

        await this.room.removeClient(this, false);
        this.room = undefined;
    }

    async handleDisconnect(): Promise<void> {
        await this.leaveRoom();
        state.allClients = state.allClients.filter(client => client.uuid !== this.uuid);
    }

    sendError(err: string, fatal: boolean): void {
        this.socket.emit(ClientSocketEvents.Error, { err, fatal });
    }

    syncAllClients(array: ClientBase[]): void {
        this.socket.emit(ClientSocketEvents.SyncAllClients, array);
    }

    addClient(uuid: string, name: string, position: Vector2, color: ColorID): void {
        this.socket.emit(ClientSocketEvents.AddClient, {
            uuid,
            name,
            position,
            color
        });
    }

    removeClient(uuid: string, ban: boolean): void {
        this.socket.emit(ClientSocketEvents.RemoveClient, { uuid, ban });
    }

    setPositionOf(uuid: string, position: Vector2): void {
        this.socket.emit(ClientSocketEvents.SetPositionOf, { uuid, position });
    }

    setColorOf(uuid: string, color: ColorID): void {
        this.socket.emit(ClientSocketEvents.SetColorOf, { uuid, color });
    }

    setHost(uuid: string): void {
        this.socket.emit(ClientSocketEvents.SetHost, { uuid });
    }

    setOptions(options: HostOptions): void {
        this.socket.emit(ClientSocketEvents.SetOptions, { options });
    }

    setSettings(settings: GameSettings): void {
        this.socket.emit(ClientSocketEvents.SetSettings, { settings });
    }

    setGameState(state: GameState): void {
        this.socket.emit(ClientSocketEvents.SetGameState, { state });
    }

    setGameFlags(flags: GameFlag): void{ 
        this.socket.emit(ClientSocketEvents.SetGameFlags, { flags });
    }

    setFlagsOf(uuid: string, flags: PlayerFlag): void {
        this.socket.emit(ClientSocketEvents.SetFlagsOf, { uuid, flags });
    }
}
