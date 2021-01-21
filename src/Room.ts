import { ColorID, MapID } from "@skeldjs/constant";

import { BackendEvent } from "./types/enums/BackendEvent";
import { RoomGroup } from "./types/enums/RoomGroup";

import { GameSettings, HostOptions } from "./types/models/ClientOptions";

import {
    BackendType,
    BackendModel,
    ImpostorBackendModel,
    PublicLobbyBackendModel
} from "./types/models/Backends";

import { BackendAdapter } from "./backends/Backend";

import ImpostorBackend from "./backends/ImpostorBackend";
import NoOpBackend from "./backends/NoOpBackend";
import PublicLobbyBackend from "./backends/PublicLobbyBackend";

import Client, { Pose, PlayerModel } from "./Client";
import { PlayerFlags } from "./types/enums/PlayerFlags";

import { state } from "./main";
import { CLIENT_RENEG_LIMIT } from "tls";

export default class Room {
    public backendModel: BackendModel;
    public backendAdapter: BackendAdapter;
    public members: Client[] = [];

    public clientRoomGroupMap = new Map<string, RoomGroup>();

    map: MapID;
    hostname: string;
    options: HostOptions = {
        falloff: 4.5,
        falloffVision: false,
        colliders: true,
        paSystems: true
    };
    settings: GameSettings = {
        crewmateVision: 1
    };
    players = new Map<string, PlayerModel>();

    constructor(backendModel: BackendModel) {
        this.backendModel = backendModel;
        this.backendAdapter = Room.buildBackendAdapter(backendModel);
        this.initializeBackend();
    }

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
        this.backendAdapter.on(BackendEvent.MapChange, (payload: { map: MapID }) => {
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

        this.backendAdapter.on(BackendEvent.HostChange, async (payload: { hostname: string }) => {
            this.hostname = payload.hostname;

            this.members.forEach(c => {
                c.setHost(this.hostname);
            });
        });

        this.backendAdapter.on(BackendEvent.SettingsUpdate, async (payload: { settings: GameSettings }) => {
            this.members.forEach(c => {
                c.sendSettings(payload.settings);
            });
        });
        
        this.backendAdapter.on(BackendEvent.PlayerFlags, async (payload: { name: string; flags: PlayerFlags; set: boolean}) => {
            const client = this.members.find(c => c.name === payload.name);

            if (client) {
                if (payload.set) {
                    client.flags |= payload.flags;
                } else {
                    client.flags &= ~payload.flags;
                }

                this.members.forEach(c => {
                    if (payload.set) {
                        c.setFlagsOf(client.uuid, payload.flags);
                    } else {
                        c.unsetFlagsOf(client.uuid, payload.flags);
                    }
                });
            }
        });

        this.backendAdapter.on(BackendEvent.Error, async (payload: { err: string }) => {
            this.members.forEach(c => c.sendError(payload.err));

            await this.destroy();
        });
        
        this.backendAdapter.initialize();
    }

    addClient(client: Client): void {
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
            color: c.color,
            flags: c.flags
        })));

        this.members.push(client);

        client.sendOptions(this.options);
        client.sendSettings(this.settings)
        client.setHost(this.hostname);
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
