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
    SystemType,
    PlayerGameData,
    ColorID
} from "@skeldjs/constant";

import {
    GameOptions,
    PayloadMessage,
    GameDataMessage,
    GameDataPayload,
    SyncSettingsRpc
} from "@skeldjs/protocol";

import {
    Networkable,
    HqHudSystem,
    Room,
    PlayerData,
    CustomNetworkTransform,
    GameData,
    SecurityCameraSystem,
    PlayerControl,
    MeetingHud,
    ShipStatus,
    SystemStatus
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
import { DebugLevel } from "@skeldjs/client/js/lib/interface/ClientConfig";

const GAME_VERSION = "2020.11.17.0";

export default class PublicLobbyBackend extends BackendAdapter {
    destroyed: boolean;
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

    async doJoin(max_attempts = 5, attempt = 0): Promise<boolean> {
        if (!this.players_cache || !this.components_cache || !this.global_cache) {
            if (!await this.initialSpawn()) {
                return false;
            }
        }

        if (!this.client) {
            this.client = new SkeldjsClient(GAME_VERSION, { debug: DebugLevel.None, allowHost: false });
        }

        if (attempt > max_attempts) {
            this.log("error", "Could not join game.");
        }

        this.log("info", "Joining game with this.server %s:%i, not spawning, attempt #%i", this.server[0], this.server[1], attempt + 1);

        await this.client.connect(this.server[0], this.server[1]);
        await this.client.identify("auproxy");

        try {
            await this.client.join(this.backendModel.gameCode, false);
        } catch (e) {
            const err = e as Error;
            attempt++;

            this.log("warn", "Failed to join game (" + err.message + "), Retrying " + (max_attempts - attempt) + " more times.")
            this.emitError(err.message + ". Retrying " + (max_attempts - attempt) + " more times.");
            return await this.doJoin(max_attempts, attempt);
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

        if (this.client.room.host && this.client.room.host.data) {
            this.log("success", "Found host: " + this.client.room.host.data.name);
            this.emitHostChange(this.client.room.host.data.name);
        }
        return true;
    }

    async handlePayload(payload: PayloadMessage) {
        switch (payload.tag) {
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
        }
    }

    async disconnect() {
        this.players_cache = new Map([...this.client.room.objects.entries()].filter(([ objectid ]) => objectid !== this.client.clientid && objectid > 0 /* not global */)) as Map<number, PlayerData>;
        this.components_cache = new Map([...this.client.room.netobjects.entries()].filter(([ , component ]) => component.ownerid !== this.client.clientid));
        this.global_cache = this.client.room.components;

        await this.client.disconnect();
    }

    async initialize(): Promise<void> {
        this.destroyed = false;

        try {
            this.log("info", "PublicLobbyBackend initialized in region " + ["NA", "EU", "AS"][this.backendModel.region]);

            if (this.backendModel.region === PublicLobbyRegion.NorthAmerica) {
                this.server = MasterServers.NA[1] as [ string, number ];
            } else if (this.backendModel.region === PublicLobbyRegion.Europe) {
                this.server = MasterServers.EU[1] as [ string, number ];
            } else if (this.backendModel.region === PublicLobbyRegion.Asia) {
                this.server = MasterServers.AS[1] as [ string, number ];
            }

            if (!await this.doJoin())
                return;

            this.client.on("disconnect", (reason, message) => {
                this.log("info", "Client disconnected: " + (reason === undefined ? "No reason." : (reason + " (" + message + ")")));
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
                } else {
                    this.log("warn", "Got snapto, but there was no data.");
                }
            });

            this.client.on("gameStart", async () => {
                this.emitAllPlayerJoinGroups(RoomGroup.Main);
                this.log("info", "Game started.");
            });

            this.client.on("gameEnd", async () => {
                this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
                this.log("info", "Game ended, re-joining..");
                
                await this.doJoin();
            });

            this.client.on("setHost", async (room: Room, host: PlayerData) => {
                if(!host)
                    return;

                if (host.id === this.client.clientid) {
                    if (this.client.room.players.size === 1) {
                        this.log("warn", "Every player left, disconnecting.");
                        await this.client.disconnect();
                        return;
                    }

                    this.log("warn", "Became host, disconnecting and re-joining..");
                    
                    await this.disconnect();
                    await this.doJoin();
                    return;
                }

                if (host && host.data) {
                    this.log("info", "Host changed to " + host.data.name);
                    this.emitHostChange(host.data.name);
                } else {
                    this.log("warn", "Host changed, but there was no data.");
                }
            });

            this.client.on("leave", (room: Room, player: PlayerData) => {
                this.log("log", "Player " + player.id + " left or was removed.");
            });

            this.client.on("systemSabotage", (room: Room, ship: ShipStatus, system: SystemStatus) => {
                if (system.systemType === SystemType.Communications) {
                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                    this.log("log", "Communications was sabotaged.");
                }
            });

            this.client.on("systemRepair", (room: Room, ship: ShipStatus, system: SystemStatus) => {
                if (system.systemType === SystemType.Communications) {
                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                    this.log("log", "Communications was repaired.");
                }
            });

            this.client.on("syncSettings", (room: Room, control: PlayerControl, settings: GameOptions) => {
                this.emitSettingsUpdate(settings);

                this.log("log", "Settings updated, crewmate vision: " + settings.crewmateVision + ".");
            });

            this.client.on("setColor", (room: Room, control: PlayerControl, color: ColorID) => {
                if (control && control.owner && control.owner.data) {
                    this.emitPlayerColor(control.owner.data.name, color);
                } else {
                    this.log("warn", "Color was set, but there was no data.");
                }
            });

            this.client.on("meeting", () => {
                setTimeout(() => {
                    this.emitAllPlayerPoses({ x: 0, y: 0 });
                }, 2500);

                this.log("log", "Meeting started.");
            });

            this.client.on("completeVoting", (room: Room, meetinghud: MeetingHud, tie: boolean, exiled: PlayerData) => {
                if (exiled && exiled.data) {
                    this.emitPlayerJoinGroup(exiled.data.name, RoomGroup.Spectator);
                    this.log("log", "Player " + exiled.data.name + " (" + exiled.id + ") was voted off");
                }
            });

            this.client.on("murder", (room: Room, player: PlayerControl, victim: PlayerData) => {
                if (victim && victim.data) {
                    this.log("log", "Player " + victim.data.name + " (" + victim.id + ") was murdered.");
                    this.emitPlayerJoinGroup(victim.data.name, RoomGroup.Spectator);
                } else {
                    this.log("warn", "Player was murdered, but there was no data.");
                }
            });

            this.client.on("removePlayerData", (room: Room, playerData: PlayerGameData) => {
                const client = room.getPlayerByPlayerId(playerData.playerId);

                if (playerData) {
                    this.log("info", "Removed player " + playerData.name + (client ? " (" + client.id + ")" : ""));
                    this.emitPlayerColor(playerData.name, -1);
                }
            });

            this.client.on("error", () => {
                
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

    awaitSettings() {
        return new Promise<GameOptions>(resolve => {
            const _this = this;
            this.client.on("packet", function onPacket(packet) {
                if (packet.bound === "client" && packet.op === Opcode.Reliable) {
                    const gamedata = packet.payloads.find(
                        payload => payload.tag === PayloadTag.GameData &&
                        payload.messages.some(message =>
                            message.tag === MessageTag.RPC &&
                            message.rpcid === RpcTag.SyncSettings)) as GameDataPayload;

                    if (gamedata) {
                        const syncsettings = gamedata.messages.find(message => message.tag === MessageTag.RPC && message.rpcid === RpcTag.SyncSettings) as SyncSettingsRpc;

                        if (syncsettings) {
                            _this.client.off("packet", onPacket);

                            resolve(syncsettings.settings);
                        }
                    }
                }
            })
        });
    }

    async initialSpawn(): Promise<boolean> {
        this.client = new SkeldjsClient(GAME_VERSION, { debug: DebugLevel.None, allowHost: false });
        
        this.log("info", "Joining for the first time with server %s:%i", this.server[0], this.server[1]);
        try {
            await this.client.connect(this.server[0], this.server[1]);
            await this.client.identify("auproxy");
        } catch (e) {
            this.log("fatal", e.toString());
            this.emitError("Couldn't connect to the Among Us this.servers, the this.server may be full, try again later!");
            return false;
        }
        this.log("success", "Successfully connected.");

        if (!this.client) {
            await this.destroy();
            return false;
        }
        
        this.log("info", "Joining room..");

        try {
            await this.client.join(this.backendModel.gameCode);
        } catch (e) {
            this.log("fatal", e.toString());
            this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client!");
            return false;
        }
        this.log("success", "Successfully joined room.");

        this.log("info", "Waiting for spawns and settings..");
        const room = this.client?.room;

        if (!room) {
            await this.destroy();
            return false;
        }
        
        await this.awaitSpawns(room);
        
        if (!this.client) {
            await this.destroy();
            return false;
        }

        const settings = await this.awaitSettings();
        
        this.currentMap = settings.map;
        this.emitMapChange(settings.map);
        this.emitSettingsUpdate(settings);
        
        if (room.host && room.host.data) {
            this.emitHostChange(room.host.data.name);
        }
        this.log("success", "Got spawns and settings.");

        this.log("info", "Cleaning up and preparing for re-join..");

        for (const [ clientid, player ] of room.players) {
            if (player && player.data) {
                this.emitPlayerColor(player.data.name, player.data.color);
            }
        }
        
        await this.disconnect();
        return true;
    }

    async destroy(): Promise<void> {
        if (this.destroyed)
            return;

        if (this.client && this.client.socket) {
            await this.client.disconnect();
            this.client = undefined;
        }
        this.log("info", "Destroyed PublicLobbyBackend.");
        this.destroyed = true;
    }
}

