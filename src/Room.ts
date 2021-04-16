import { ColorID, MapID } from "@skeldjs/constant";
import { Vector2 } from "@skeldjs/util";

import { BackendEvent } from "./types/enums/BackendEvents";

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

import Client, { PlayerModel } from "./Client";
import { PlayerFlag } from "./types/enums/PlayerFlags";

import { state } from "./main";
import { GameState } from "./types/enums/GameState";
import { GameFlag } from "./types/enums/GameFlags";

export default class Room {
    public backendModel: BackendModel;
    public backendAdapter: BackendAdapter;
    public clients: Client[] = [];
    public bans: Set<string> = new Set;

    map: MapID;
    hostname: string;
    flags = 0;
    state: GameState = GameState.Lobby;
    options: HostOptions = {
        falloff: 4.5,
        falloffVision: false,
        colliders: true,
        paSystems: true
    };
    settings: GameSettings = {
        crewmateVision: 1,
        map: MapID.TheSkeld
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
        this.backendAdapter.on(BackendEvent.PlayerPosition, (payload: { name: string; position: Vector2; }) => {
            const client = this.getClientByName(payload.name);

            if (client) {
                console.log(client.uuid, payload.position);
                this.clients.forEach(c => {
                    c.setPositionOf(client.uuid, payload.position);
                });
            }
        });

        this.backendAdapter.on(BackendEvent.PlayerColor, (payload: { name: string; color: ColorID }) => {
            const client = this.getClientByName(payload.name);
            const player = this.getPlayerByName(payload.name);

            player.color = payload.color;

            if (client) {
                this.clients.forEach(c => {
                    c.setColorOf(client.uuid, payload.color);
                });
            }
        });

        this.backendAdapter.on(BackendEvent.HostChange, async (payload: { name: string }) => {
            this.hostname = payload.name;

            const client = this.getClientByName(payload.name);

            if (client) {
                this.clients.forEach(c => {
                    c.setHost(client.uuid);
                });
            }
        });

        this.backendAdapter.on(BackendEvent.GameState, async (payload: { state: GameState }) => {
            if (payload.state === GameState.Lobby) {
                this.flags = GameFlag.None;
                for (const [ , player ] of this.players) {
                    player.flags = PlayerFlag.None;
                }
            }

            this.clients.forEach(c => {
                c.setGameState(payload.state);
                for (const [ name, player ] of this.players) {
                    const client = this.getClientByName(name);
                    if (client) {
                        c.setFlagsOf(client.uuid, player.flags);
                    }
                }
            });
        });

        this.backendAdapter.on(BackendEvent.SettingsUpdate, async (payload: { settings: GameSettings }) => {
            this.settings = payload.settings;

            this.clients.forEach(c => {
                c.setSettings(payload.settings);
            });
        });
        
        this.backendAdapter.on(BackendEvent.PlayerFlags, async (payload: { name: string; flags: PlayerFlag; set: boolean}) => {
            const client = this.getClientByName(payload.name);
            const player = this.getPlayerByName(payload.name);

            if (payload.set) {
                player.flags |= payload.flags;
            } else {
                player.flags &= ~payload.flags;
            }

            if (client) {
                this.clients.forEach(c => {
                    c.setFlagsOf(client.uuid, player.flags);
                });
            }
        });

        this.backendAdapter.on(BackendEvent.GameFlags, async (payload: { flags: number, set: boolean }) => {
            if (payload.set) {
                this.flags |= payload.flags;
            } else {
                this.flags &= ~payload.flags;
            }

            this.clients.forEach(c => {
                c.setGameFlags(this.flags);
            });
        });

        this.backendAdapter.on(BackendEvent.Error, async (payload: { err: string, fatal: boolean }) => {
            this.clients.forEach(c => {
                c.sendError(payload.err, payload.fatal);
            });

            if (payload.fatal) await this.destroy();
        });

        this.backendAdapter.initialize();
    }

    getPlayerByName(name: string): PlayerModel {
        const found = this.players.get(name.toLowerCase());

        if (found) {
            return found;
        }

        const player: PlayerModel = {
            name,
            position: { x: 0, y: 0 },
            color: -1,
            flags: PlayerFlag.None
        };

        this.players.set(name.toLowerCase(), player);
        return player;
    }

    getClientByName(name: string): Client|undefined {
        return this.clients.find(client => client.name.toLowerCase() === name.toLowerCase());
    }

    addClient(client: Client): void {
        if (this.bans.has(client.socket.handshake.address)) {
            return client.removeClient(client.uuid, true);
        }

        const player = this.getPlayerByName(client.name);

        client.syncAllClients(this.clients.map(c => ({
            uuid: c.uuid,
            name: c.name
        })));

        this.clients.forEach(c => {
            c.addClient(client.uuid, player.name, player.position, player.color);
            c.setPositionOf(client.uuid, player.position);
            c.setColorOf(client.uuid, player.color);

            const p = this.getPlayerByName(c.name);
            client.setColorOf(c.uuid, p.color);
            client.setPositionOf(c.uuid, p.position);
            client.setFlagsOf(c.uuid, p.flags);
        });

        this.clients.push(client);

        client.setPositionOf(client.uuid, player.position);
        client.setColorOf(client.uuid, player.color);
        client.setHost(this.hostname);
        client.setGameState(this.state);
        client.setGameFlags(this.flags);
        client.setSettings(this.settings);

        client.setOptions(this.options);
    }

    async removeClient(client: Client, ban: boolean): Promise<void> {
        this.clients.forEach(c => c.removeClient(client.uuid, ban));
        this.clients = this.clients.filter(c => c.uuid !== client.uuid);
        if (ban) {
            this.bans.add(client.socket.handshake.address);
        }
        if (this.clients.length === 0) await this.destroy();
    }

    setOptions(options: HostOptions, host = false): void {
        this.options = options;

        this.clients.forEach(c => {
            if (c.name !== this.hostname || host) c.setOptions(options);
        });
    }

    async destroy(): Promise<void> {
        if (this.clients.length > 0) {
            for (const c of this.clients) {
                await c.leaveRoom();
            }
            return;
        }
        
        state.allRooms = state.allRooms.filter(room => room !== this);
        
        if (this.backendAdapter.destroyed)
            return;

        await this.backendAdapter.destroy();
    }
}
