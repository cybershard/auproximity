import {Socket} from "socket.io";
import ClientSocketEvents from "./types/ClientSocketEvents";
import {
    BackendModel,
    BackendType, BepInExBackendModel,
    ImpostorBackendModel,
    MapIdModel, NodePolusBackendModel,
    PublicLobbyBackendModel,
    RoomGroup
} from "./types/Backend";
import Room from "./Room";
import {state} from "./main";
import {IClientBase} from "./types/IClientBase";

export interface Pose {
    x: number;
    y: number;
}

export default class Client implements IClientBase {
    public socket: Socket
    public room?: Room;

    // Base client info
    public readonly uuid: string;
    public name: string;
    public group: RoomGroup;
    public pose: Pose;

    constructor(socket: Socket, uuid: string) {
        this.socket = socket;
        this.uuid = uuid;
        this.pose = {
            x: 0,
            y: 0
        };
        this.group = RoomGroup.Spectator;
        this.name = "";

        // Initialize socket events
        this.socket.on(ClientSocketEvents.Disconnect, async () => {
            await this.handleDisconnect();
        });
        this.socket.on(ClientSocketEvents.JoinRoom, async (payload: { name: string; backendModel: BackendModel }) => {
            await this.joinRoom(payload.name, payload.backendModel);
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
        await this.room.removeClient(this);
        this.room = undefined;
    }
    async handleDisconnect(): Promise<void> {
        await this.leaveRoom();
        state.allClients = state.allClients.filter(client => client.uuid !== this.uuid);
    }

    // Socket emitting functions
    sendError(err: string): void {
        this.socket.emit(ClientSocketEvents.Error, { err });
    }
    setAllClients(array: {
        uuid: string;
        name: string;
        pose: Pose;
        group: RoomGroup
    }[]): void {
        this.socket.emit(ClientSocketEvents.SetAllClients, array);
    }
    addClient(uuid: string, name: string, pose: Pose, group: RoomGroup): void {
        this.socket.emit(ClientSocketEvents.AddClient, {
            uuid,
            name,
            pose,
            group
        });
    }
    removeClient(uuid: string): void {
        this.socket.emit(ClientSocketEvents.RemoveClient, uuid);
    }
    setMap(map: MapIdModel): void {
        this.socket.emit(ClientSocketEvents.SetMap, { map });
    }
    setPoseOf(uuid: string, pose: Pose): void {
        if (uuid === this.uuid) {
            this.pose = pose;
        }
        this.socket.emit(ClientSocketEvents.SetPose, { uuid, pose });
    }
    setGroupOf(uuid: string, group: RoomGroup): void {
        if (uuid === this.uuid) {
            this.group = group;
        }
        this.socket.emit(ClientSocketEvents.SetGroup, { uuid, group });
    }
}
