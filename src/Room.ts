import {
    BackendAdapter,
    BackendEvent,
    BackendModel,
    BackendType,
    GameSettings,
    HostOptions,
    ImpostorBackendModel,
    MapIdModel,
    PublicLobbyBackendModel,
    RoomGroup
} from "./types/Backend";
import Client, {Pose, PlayerModel} from "./Client";

import {ColorID} from "@skeldjs/constant";
import ImpostorBackend from "./backends/ImpostorBackend";
import NoOpBackend from "./backends/NoOpBackend";
import PublicLobbyBackend from "./backends/PublicLobbyBackend";
import {state} from "./main";

export default class Room {
    public backendModel: BackendModel;
    public backendAdapter: BackendAdapter;
    public members: Client[] = [];

    public clientRoomGroupMap = new Map<string, RoomGroup>();

    map: MapIdModel;
    hostname: string;
    options: HostOptions = {
        falloff: 2.7,
        falloffVision: false,
        colliders: true,
        paSystems: true
    };
    players = new Map<string, PlayerModel>();

    constructor(backendModel: BackendModel) {
        this.backendModel = backendModel;
        this.backendAdapter = Room.buildBackendAdapter(backendModel);
        this.initializeBackend();
    }

    // Factory function
    private static buildBackendAdapter(backendModel: BackendModel): BackendAdapter {
        if (backendModel.backendType === BackendType.PublicLobby) {
            return new PublicLobbyBackend(backendModel as PublicLobbyBackendModel);
        } else if (backendModel.backendType === BackendType.Impostor) {
            return new ImpostorBackend(backendModel as ImpostorBackendModel);
        } else {
            return new NoOpBackend();
        }
    }
    private initializeBackend() {
        this.backendAdapter.on(BackendEvent.MapChange, (payload: { map: MapIdModel }) => {
            this.map = payload.map;

            this.members.forEach(c => {
                c.setMap(payload.map);
            });
        });
        this.backendAdapter.on(BackendEvent.PlayerPose, (payload: { name: string; pose: Pose; }) => {
            const client = this.members.find(c => c.name === payload.name);
            if (client) {
                // if the client connection exists, update all clients about the new position
                this.members.forEach(c => {
                    c.setPoseOf(client.uuid, payload.pose);
                });
            }
        });
        this.backendAdapter.on(BackendEvent.PlayerColor, (payload: { name: string; color: ColorID }) => {
            const client = this.members.find(c => c.name === payload.name);

            if (!this.players.get(payload.name)) {
                this.players.set(payload.name, {
                    color: payload.color
                });
            }

            this.players.get(payload.name).color = payload.color;

            if (client) {
                client.color = payload.color;
                
                this.members.forEach(c => {
                    c.setColorOf(client.uuid, client.color);
                });
            }
        });
        this.backendAdapter.on(BackendEvent.AllPlayerPoses, (payload: { pose: Pose }) => {
            this.members.forEach(client => {
                this.members.forEach(c => c.setPoseOf(client.uuid, payload.pose));
            });
        });
        this.backendAdapter.on(BackendEvent.PlayerJoinGroup, (payload: { name: string; group: RoomGroup }) => {

            // store the state of this client <-> roomGroup in the room
            // this is to restore the room group if the client disconnects and reconnects
            this.clientRoomGroupMap.set(payload.name, payload.group);
            const client = this.members.find(c => c.name === payload.name);
            if (client) {
                // if the client connection exists, update all clients about the new group
                this.members.forEach(c => {
                    c.setGroupOf(client.uuid, payload.group);
                });
            }
        });
        this.backendAdapter.on(BackendEvent.AllPlayerJoinGroups, (payload: { group: RoomGroup }) => {
            this.members.forEach(client => {
                // store the state of this client <-> roomGroup in the room
                // this is to restore the room group if the client disconnects and reconnects
                this.clientRoomGroupMap.set(client.name, payload.group);

                this.members.forEach(c => c.setGroupOf(client.uuid, payload.group));
            });
        });
        this.backendAdapter.on(BackendEvent.PlayerFromJoinGroup, (payload: { from: RoomGroup; to: RoomGroup }) => {
            const fromClients = this.members.filter(c => c.group === payload.from);
            this.members.forEach(c => {
                fromClients.forEach(client => {
                    this.clientRoomGroupMap.set(client.name, payload.to);
                    c.setGroupOf(client.uuid, payload.to);
                });
            });
        });
        this.backendAdapter.on(BackendEvent.Error, async (payload: { err: string }) => {
            this.members.forEach(c => c.sendError(payload.err));

            await this.destroy();
        });
        this.backendAdapter.on(BackendEvent.HostChange, async (payload: { hostname: string }) => {
            this.hostname = payload.hostname;

            this.members.forEach(c => {
                c.setHost(c.name === this.hostname);
            });
        });
        this.backendAdapter.on(BackendEvent.SettingsUpdate, async (payload: { settings: GameSettings }) => {
            this.members.forEach(c => {
                c.sendSettings(payload.settings);
            });
        });
        this.backendAdapter.initialize();
    }

    // Public methods
    addClient(client: Client): void {
        // restore roomgroup for a client if it exists
        if (this.clientRoomGroupMap.has(client.name)) {
            client.setGroupOf(client.uuid, this.clientRoomGroupMap.get(client.name));
        }
        client.setMap(this.map);

        this.members.forEach(c => {
            c.addClient(client.uuid, client.name, client.pose, client.group, client.color);
            if (this.players.get(client.name)) c.setColorOf(client.uuid, this.players.get(client.name).color);
        });

        client.setAllClients(this.members.map(c => ({
            uuid: c.uuid,
            name: c.name,
            pose: c.pose,
            group: c.group,
            color: c.color
        })));
        this.members.push(client);

        client.sendOptions(this.options);
        client.setHost(client.name === this.hostname);
    }
    setOptions(options: HostOptions, host: boolean = false) {
        this.options = options;

        this.members.forEach(c => {
            if (c.name !== this.hostname || host) c.sendOptions(options);
        });
    }
    async removeClient(client: Client): Promise<void> {
        this.members = this.members.filter(c => c.uuid !== client.uuid);
        this.members.forEach(c => c.removeClient(client.uuid));
        if (this.members.length === 0) await this.destroy();
    }

    async destroy(): Promise<void> {
        if (this.members.length > 0) {
            for (const c of this.members) {
                await c.leaveRoom();
            }
            // do not need to call await this.destroy(); because removeClient() (called by c.leaveRoom()) already calls it.
            return;
        }
        await this.backendAdapter.destroy();
        state.allRooms = state.allRooms.filter(room => room !== this);
    }
}
