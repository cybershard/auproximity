import util from "util";
import chalk from "chalk";

import { SkeldjsClient } from "@skeldjs/client"

import {
    MasterServers,
    MapID,
    Opcode,
    PayloadTag,
    MessageTag,
    RpcTag,
    SystemType
} from "@skeldjs/constant";

import {
    GameOptions,
    PayloadMessage,
    GameDataMessage,
    RpcMessage,
    GameDataPayload,
    SyncSettingsRpc
} from "@skeldjs/protocol";

import {
    PlayerGameData
} from "@skeldjs/types";

import {
    Networkable,
    HudOverrideSystem,
    HqHudSystem,
    Room,
    PlayerData,
    CustomNetworkTransform,
    GameData,
    SecurityCameraSystem
} from "@skeldjs/common";

import logger from "../util/logger";

import { PublicLobbyBackendModel } from "../types/models/Backends";
import { PublicLobbyRegion } from "../types/models/PublicLobbyRegion";

import { RoomGroup } from "../types/enums/RoomGroup";

import {
    BackendAdapter,
    LogMode
} from "./Backend";
import { PlayerFlags } from "../types/enums/PlayerFlags";

const GAME_VERSION = "2020.11.17.0";

export default class PublicLobbyBackend extends BackendAdapter {
    backendModel: PublicLobbyBackendModel;

    client: SkeldjsClient;
    currentMap: MapID;

    server: [ string, number ];

    players_cache: Map<number, PlayerData>;
    components_cache: Map<number, Networkable>;
    global_cache: Networkable[];

    constructor(backendModel: PublicLobbyBackendModel) {
        super();
        
        this.backendModel = backendModel;
        this.gameID = this.backendModel.gameCode;
    }

    log(mode: LogMode, format: string, ...params: any[]) {
        const formatted = util.format(format, ...params);

        logger[mode](chalk.grey("[" + this.backendModel.gameCode + "]"), formatted);
    }

    async doJoin(doSpawn = false, max_attempts = 5, attempt = 0) {
        if (attempt > max_attempts) {
            this.log("error", "Could not join game.");
        }

        this.log("info", "Joining game with this.server %s:%i, " + (doSpawn ? "" : "not ") + "spawning, attempt #%i", this.server[0], this.server[1], attempt + 1);

        await this.client.connect(this.server[0], this.server[1]);
        await this.client.identify("auproxy");

        try {
            await this.client.join(this.backendModel.gameCode, false);
        } catch (e) {
            const err = e as Error;
            attempt++;

            this.log("warn", "Failed to join game (" + err.message + "), Retrying " + (max_attempts - attempt) + " more times.")
            this.emitError(err.message + ". Retrying " + (max_attempts - attempt) + " more times.");
            return await this.doJoin(doSpawn, max_attempts, attempt);
        }
        
        this.log("info", "Replacing state with cached state.. (%i objects, %i netobjects, %i room components)", this.players_cache.size, this.components_cache.size, this.global_cache.length);

        for (let [ id, object ] of this.players_cache) {
            object.room = this.client.room;
            this.client.room.objects.set(id, object);
        }
        
        for (let [ id, component ] of this.components_cache) {
            component.room = this.client.room;
            this.client.room.netobjects.set(id, component);
        }

        for (let i = 0; i < this.global_cache.length; i++) {
            const component = this.global_cache[i];

            component.room = this.client.room;
            this.client.room.components[i] = component;
        }

        this.log("success", "Joined & successfully replaced state!");
    }

    async handlePayload(payload: PayloadMessage) {
        switch (payload.tag) {
        case PayloadTag.JoinGame:
            if (payload.bound == "client" && !payload.error) {
                if (this.client.room && this.client.room.host && this.client.room.host.data) {
                    this.emitHostChange(this.client.room.host.data.name);
                }
            }
            break;
        case PayloadTag.StartGame:
            this.emitAllPlayerJoinGroups(RoomGroup.Main);

            this.log("info", "Game started.");
            break;
        case PayloadTag.EndGame:
            this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
            this.log("info", "Game ended, re-joining..");

            await this.doJoin();
            break;
        case PayloadTag.RemovePlayer:
            this.log("log", "Player " + payload.clientid + " was removed.");

            if (this.client.room.amhost) {
                if (this.client.room.players.size === 1) {
                    this.log("warn", "Every player left, disconnecting.");
                    await this.client.disconnect();
                    return;
                } else {
                    this.log("warn", "Became host, disconnecting and re-joining..")
                    await this.client.disconnect();
                    await this.doJoin();
                }
            }
            
            if (this.client.room && this.client.room.host && this.client.room.host.data) {
                this.log("info", "Host changed to " + this.client.room.host.data.name);
                this.emitHostChange(this.client.room.host.data.name);
            }
            break;
        case PayloadTag.GameData:
        case PayloadTag.GameDataTo:
            payload.messages.forEach(message => {
                this.handleGameDataMessage(message);
            });
            break;
        case PayloadTag.WaitForHost:
            this.log("info", "Waiting for host to re-connect..");
            break;
        }
    }

    async handleGameDataMessage(message: GameDataMessage) {
        switch (message.tag) {
        case MessageTag.Data:
            if (message.netid === this.client.room?.shipstatus?.netid) {
                if (this.currentMap === MapID.TheSkeld || this.currentMap === MapID.Polus) {
                    const comms = this.client.room?.shipstatus?.systems?.[SystemType.Communications] as HudOverrideSystem;
                    
                    if (comms) {
                        if (comms.sabotaged) {
                            this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                        } else {
                            this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                        }
                    }

                    const security = this.client.room?.shipstatus?.systems?.[SystemType.Security] as SecurityCameraSystem;

                    if (security) {
                        for (let [ clientId, player ] of this.client.room.players) {
                            if (player && player.data) {
                                this.emitPlayerFlags(player.data.name, PlayerFlags.PA, security.players.has(player));
                            }
                        }
                    }
                } else if (this.currentMap === MapID.MiraHQ) {
                    const comms = this.client.room?.shipstatus?.systems?.[SystemType.Communications] as unknown as HqHudSystem;
                    
                    if (comms) {
                        if (comms.completed.length === 0) {
                            this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                        } else if (comms.completed.length === 2 && comms.completed.every(console => console > 0)) {
                            this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                        }
                    }
                }
            }
            break;
        case MessageTag.RPC:
            this.handleRPCMessage(message);
            break;
        }
    }

    handleRPCMessage(message: RpcMessage) {
        switch (message.rpcid) {
        case RpcTag.SyncSettings:
            this.emitSettingsUpdate({
                crewmateVision: message.settings.crewmateVision
            });
            break;
        case RpcTag.SetColor: {
            const player = [...this.client.room.players.values()].find(player => {
                return player.control?.netid === message.netid
            });

            if (player && player.data) {
                this.emitPlayerColor(player.data.name, message.color)
            }
            break;
        }
        case RpcTag.StartMeeting:
            setTimeout(() => {
                this.emitAllPlayerPoses({ x: 0, y: 0 });
            }, 2500);
            this.log("log", "Meeting started.");
            break;
        case RpcTag.VotingComplete:
            this.log("log", "Meeting ended.");
            if (message.exiled !== 0xff) {
                setTimeout(() => {
                    const player = this.client.room.getPlayerByPlayerId(message.exiled);
                    
                    if (player && player.data) {
                        this.emitPlayerJoinGroup(player.data.name, RoomGroup.Spectator);
                        this.log("log", "Player " + player.data.name + " (" + player.id + ")  was voted off");
                    }
                }, 2500);
            }
            break;
        case RpcTag.MurderPlayer: {
            const player = [...this.client.room.players.values()].find(player => player.control?.netid === message.victimid);
            
            if (player && player.data) {
                this.log("log", "Player " + player.data.name + " (" + player.id + ") was murdered.");
                this.emitPlayerJoinGroup(player.data.name, RoomGroup.Spectator);
            }
            break;
        }
        }
    }

    async initialize(): Promise<void> {
        try {
            this.log("info", "PublicLobbyBackend initialized in region " + ["NA", "EU", "AS"][this.backendModel.region]);

            if (this.backendModel.region === PublicLobbyRegion.NorthAmerica) {
                this.server = MasterServers.NA[1] as [ string, number ];
            } else if (this.backendModel.region === PublicLobbyRegion.Europe) {
                this.server = MasterServers.EU[1] as [ string, number ];
            } else if (this.backendModel.region === PublicLobbyRegion.Asia) {
                this.server = MasterServers.AS[1] as [ string, number ];
            }

            await this.initialSpawn(this.server);

            await this.doJoin(false);

            this.client.on("disconnect", (reason, message) => {
                this.log("warn", "Client disconnected: " + (reason === undefined ? "No reason." : (reason + " (" + message + ")")));
            });
            
            this.client.on("packet", packet => {
                if (packet.op === Opcode.Reliable || packet.op === Opcode.Unreliable) {
                    packet.payloads.forEach(async payload => await this.handlePayload(payload));
                }
            });

            this.client.on("move", (room: Room, transform: CustomNetworkTransform) => {
                if (transform.owner && transform.owner.data) {
                    this.emitPlayerPose(transform.owner.data.name, transform.position);
                }
            });

            this.client.on("snapTo", (room: Room, transform: CustomNetworkTransform) => {
                if (transform.owner && transform.owner.data) {
                    this.log("log", "Got SnapTo for " + transform.owner.data.name + " (" + transform.owner.id + ") to x: " + transform.position.x + " y: " + transform.position.y);
                    this.emitPlayerPose(transform.owner.data.name, transform.position);
                }
            });

            this.client.on("removePlayerData", (room: Room, playerData: PlayerGameData) => {
                const client = room.getPlayerByPlayerId(playerData.playerId);

                if (playerData) {
                    this.log("info", "Removed player " + playerData.name + (client ? " (" + client.id + ")" : ""));
                    this.emitPlayerColor(playerData.name, -1);
                }
            });

            this.log("success", "Initialized PublicLobbyBackend!");
        } catch (err) {
            this.log("error", "An error occurred.");
            this.log("error", err);
            this.emitError("An unknown error occurred, join the discord to contact an admin for help.");
        }
    }

    awaitSpawns(room: Room) {
        return new Promise<void>(resolve => {
            let gamedataSpawned = false;
            let playersSpawned = [];

            const _this = this;

            room.on("spawn", function onSpawn(component) {
                if (component.classname === "GameData") {
                    gamedataSpawned = true;

                    const gamedata = component as GameData;

                    for (let [ , player ] of gamedata.players) {
                        if (player.name) _this.emitPlayerColor(player.name, player.color)
                    }
                } else if (component.classname === "PlayerControl") {
                    playersSpawned.push(component.ownerid);
                }
                
                if (gamedataSpawned) {
                    for (let [ clientid, player ] of room.players) {
                        if (!~playersSpawned.indexOf(clientid)) {
                            return;
                        }
                    }

                    room.off("spawn", onSpawn);
                    resolve();
                }
            });
        });
    }

    awaitSettings(client: SkeldjsClient) {
        return new Promise<GameOptions>(resolve => {
            client.on("packet", function onPacket(packet) {
                if (packet.bound === "client" && packet.op === Opcode.Reliable) {
                    const gamedata = packet.payloads.find(
                        payload => payload.tag === PayloadTag.GameData &&
                        payload.messages.some(message =>
                            message.tag === MessageTag.RPC &&
                            message.rpcid === RpcTag.SyncSettings)) as GameDataPayload;

                    if (gamedata) {
                        const syncsettings = gamedata.messages.find(message => message.tag === MessageTag.RPC && message.rpcid === RpcTag.SyncSettings) as SyncSettingsRpc;

                        if (syncsettings) {
                            client.off("packet", onPacket);

                            resolve(syncsettings.settings);
                        }
                    }
                }
            })
        });
    }

    async initialSpawn(server: [string, number]): Promise<void> {
        this.client = new SkeldjsClient(GAME_VERSION);
        this.log("info", "Joining for the first time with server %s:%i", this.server[0], this.server[1]);
        try {
            await this.client.connect(this.server[0], this.server[1]);
            await this.client.identify("auproxy");
        } catch (e) {
            this.log("fatal", "Failed to connect to this.server %s:%i", this.server[0], this.server[1]);
            this.log("fatal", e);
            this.emitError("Couldn't connect to the Among Us this.servers, the this.server may be full, try again later!");
            return;
        }
        this.log("success", "Successfully connected.");

        this.log("info", "Joining room..");
        let room: Room;
        try {
            room = await this.client.join(this.backendModel.gameCode);
        } catch (e) {
            this.log("fatal", "Couldn't join room");
            this.log("fatal", e);
            this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client!");
            return;
        }
        this.log("success", "Successfully joined room.");

        this.log("info", "Waiting for spawns and settings..");
        await this.awaitSpawns(room);

        const settings = await this.awaitSettings(this.client);
        this.currentMap = settings.map;
        this.emitMapChange(settings.map);
        
        if (room.host && room.host.data) {
            this.emitHostChange(room.host.data.name);
        }
        this.log("success", "Got spawns and settings.");

        this.log("info", "Cleaning up and preparing for re-join..");

        this.players_cache = new Map([...room.objects.entries()].filter(([ objectid ]) => objectid !== this.client.clientid && objectid > 0 /* not global */)) as Map<number, PlayerData>;
        this.components_cache = new Map([...room.netobjects.entries()].filter(([ , component ]) => component.ownerid !== this.client.clientid));
        this.global_cache = room.components;

        if (room.host && room.host.data) {
            this.log("success", "Found host: " + room.host.data.name);
            this.emitHostChange(room.host.data.name);
        }
        
        await this.client.disconnect();
    }

    async destroy(): Promise<void> {
        if (this.client && this.client.socket) {
            await this.client.disconnect();
            this.client = undefined;
        }
        this.log("info", "Destroyed PublicLobbyBackend.");
    }
}

