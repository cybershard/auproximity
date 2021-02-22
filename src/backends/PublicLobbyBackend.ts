import util from "util";
import chalk from "chalk";

import { SkeldjsClient } from "@skeldjs/client";

import {
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

import { OfficialServers } from "../types/constants/OfficialServers";

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
import { GameSettings } from "../types/models/ClientOptions";

const GAME_VERSION = "2020.11.17.0";

const sleep = ms => new Promise<void>(resolve => setTimeout(resolve, ms));

export enum ConnectionErrorCode {
    None,
    NoClient,
    FailedToConnect,
    TimedOut,
    FailedToJoin
}

export default class PublicLobbyBackend extends BackendAdapter {
    backendModel: PublicLobbyBackendModel;

    client: SkeldjsClient;

    master: [ string, number ][];
    server: number;

    players_cache: Map<number, PlayerData>;
    components_cache: Map<number, Networkable>;
    global_cache: Networkable[];

    didDisconnect: boolean;

    settings: GameSettings;

    constructor(backendModel: PublicLobbyBackendModel) {
        super();
        
        this.backendModel = backendModel;
        this.gameID = this.backendModel.gameCode;
        this.didDisconnect = false;
        this.settings = {
            map: MapID.TheSkeld,
            crewmateVision: 1
        };
    }

    log(mode: LogMode, format: string, ...params: unknown[]): void {
        const formatted = util.format(format, ...params);

        logger[mode](chalk.grey("[" + this.backendModel.gameCode + "]"), formatted);
    }

    async doJoin(max_attempts = 5, attempt = 0): Promise<boolean> {
        if (this.destroyed)
            return false;

        if (attempt >= max_attempts) {
            this.log("error", "Couldn't join game.");
            this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client.", true);
            return false;
        }
        
        if (!this.client) {
            this.client = new SkeldjsClient(GAME_VERSION, { debug: DebugLevel.None, allowHost: false });
        }

        if (!this.players_cache || !this.components_cache || !this.global_cache) {
            const err = await this.initialSpawn(attempt >= max_attempts);
            if (err !== ConnectionErrorCode.None) {
                if (err === ConnectionErrorCode.FailedToJoin) {
                    this.log("error", "Couldn't join game.");
                    this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client.", true);
                    return false;
                }

                this.server++;
                this.server = this.server % this.master.length;
                attempt++;

                this.log("warn", "Failed to initially spawn, Retrying " + (max_attempts - attempt) + " more times, also trying another server.");
                this.emitError("Couldn't connect to the server. Retrying " + (max_attempts - attempt) + " more times.", false);
                return this.doJoin(max_attempts, attempt);
            }
        }
        
        if (this.destroyed)
            return false;

        const ip = this.master[this.server][0];
        const port = this.master[this.server][1];

        this.log("info", "Joining game with this.server %s:%i, not spawning, attempt #%i", ip, port, attempt + 1);
        
        try {
            await this.client.connect(ip, port);
            await this.client.identify("auproxy");
        } catch (e) {
            const err = e as Error;
            this.server++;
            this.server = this.server % this.master.length;
            attempt++;

            this.log("warn", "Failed to connect (" + err.message + "), Retrying " + (max_attempts - attempt) + " more times, also trying another server.");
            this.emitError("Couldn't connect to the server. Retrying " + (max_attempts - attempt) + " more times.", false);
            return await this.doJoin(max_attempts, attempt);
        }

        try {
            await this.client.join(this.backendModel.gameCode, false);
        } catch (e) {
            const err = e as Error;
            attempt++;

            this.log("warn", "Failed to join game (" + err.message + "), Retrying " + (max_attempts - attempt) + " more times.");
            this.emitError(err.message + ". Retrying " + (max_attempts - attempt) + " more times.", false);
            return await this.doJoin(max_attempts, attempt);
        }
        
        this.log("info", "Replacing state with cached state.. (%i objects, %i netobjects, %i room components)", this.players_cache.size, this.components_cache.size, this.global_cache.length);

        for (const [ id, object ] of this.players_cache) {
            object.room = this.client.room;
            this.client.room.objects.set(id, object);
        }
        
        for (const  [ id, component ] of this.components_cache) {
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

    async handlePayload(payload: PayloadMessage): Promise<void> {
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

    async handleGameDataMessage(message: GameDataMessage): Promise<void> {
        switch (message.tag) {
        case MessageTag.Data:
            if (message.netid === this.client.room?.shipstatus?.netid) {
                if (this.settings.map === MapID.TheSkeld || this.settings.map === MapID.Polus) {
                    const security = this.client.room?.shipstatus?.systems?.[SystemType.Security] as SecurityCameraSystem;

                    if (security) {
                        for (const  [ , player ] of this.client.room.players) {
                            if (player && player.data) {
                                this.emitPlayerFlags(player.data.name, PlayerFlags.PA, security.players.has(player));
                            }
                        }
                    }
                } else if (this.settings.map === MapID.MiraHQ) {
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

    async disconnect(): Promise<void> {
        this.players_cache = new Map([...this.client.room.objects.entries()].filter(([ objectid ]) => objectid !== this.client.clientid && objectid > 0 /* not global */)) as Map<number, PlayerData>;
        this.components_cache = new Map([...this.client.room.netobjects.entries()].filter(([ , component ]) => component.ownerid !== this.client.clientid));
        this.global_cache = this.client.room.components;

        await this.client.disconnect();
        this.didDisconnect = true;
    }

    async initialize(): Promise<void> {
        this.destroyed = false;

        try {
            this.log("info", "PublicLobbyBackend initialized in region " + ["NA", "EU", "AS"][this.backendModel.region]);

            
            switch (this.backendModel.region) {
                case PublicLobbyRegion.NorthAmerica:
                    this.master = OfficialServers.NA;
                    break;
                case PublicLobbyRegion.Europe:
                    this.master = OfficialServers.EU;
                    break;
                case PublicLobbyRegion.Asia:
                    this.master = OfficialServers.AS;
                    break;
            }
            this.server = ~~(Math.random() * this.master.length);

            if (!await this.doJoin())
                return;

            this.client.on("disconnect", async (reason, message) => {
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
                this.log("info", "Host started the game.");
            });

            this.client.on("gameEnd", async () => {
                this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
                this.log("info", "Game ended, re-joining..");
                
                if (!await this.doJoin())
                    return;
            });

            this.client.on("setHost", async (room: Room, host: PlayerData) => {
                if(!host)
                    return;

                if (host.id === this.client.clientid) {
                    if (this.client.room.players.size === 1) {
                        this.log("warn", "Everyone left, disconnecting to remove the game.");
                        await this.client.disconnect();
                        await this.destroy();
                        return;
                    }

                    this.log("warn", "I became host, disconnecting and re-joining..");
                    
                    await this.disconnect();

                    if (!await this.doJoin())
                        this.destroy();
                    return;
                }

                if (host && host.data) {
                    this.log("info", host.data.name + " is now the host.");
                    this.emitHostChange(host.data.name);
                } else {
                    this.log("warn", "Host changed, but there was no data.");
                }
            });

            this.client.on("leave", (roow: Room, player: PlayerData) => {
                this.log("log", "Player with ID " + player.id + " left or was removed.");
            });

            this.client.on("systemSabotage", (room: Room, ship: ShipStatus, system: SystemStatus) => {
                if (system.systemType === SystemType.Communications) {
                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                    this.log("log", "An impostor sabotaged communications.");
                }
            });

            this.client.on("systemRepair", (room: Room, ship: ShipStatus, system: SystemStatus) => {
                if (system.systemType === SystemType.Communications) {
                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                    this.log("log", "Someone repaired communications.");
                }
            });

            this.client.on("syncSettings", (room: Room, control: PlayerControl, settings: GameOptions) => {
                if (settings.crewmateVision !== this.settings.crewmateVision) {
                    this.settings.crewmateVision = settings.crewmateVision;

                    this.log("log", "Crewmate vision is now set to " + settings.crewmateVision + ".");
                }
                
                if (settings.map !== this.settings.map) {
                    this.settings.map = settings.map;

                    this.log("log", "Map is now set to " + MapID[settings.map] + ".");
                }
                
                this.emitSettingsUpdate(this.settings);
            });

            this.client.on("setColor", (room: Room, control: PlayerControl, color: ColorID) => {
                if (control && control.owner && control.owner.data) {
                    this.log("info", control.owner.data.name + " set their colour to " + ColorID[color] + ".");
                    this.emitPlayerColor(control.owner.data.name, color);
                } else {
                    this.log("warn", "Color was set, but there was no data.");
                }
            });

            this.client.on("meeting", () => {
                setTimeout(() => {
                    this.emitAllPlayerPoses({ x: 0, y: 0 });
                }, 2500);

                this.log("log", "Someone called a meeting.");
            });

            this.client.on("completeVoting", (room: Room, meetinghud: MeetingHud, tie: boolean, exiled: PlayerData) => {
                if (exiled && exiled.data) {
                    this.emitPlayerJoinGroup(exiled.data.name, RoomGroup.Spectator);
                    this.log("log", exiled.data.name + " (" + exiled.id + ") was voted off");
                }
            });

            this.client.on("murder", (room: Room, player: PlayerControl, victim: PlayerData) => {
                if (victim && victim.data) {
                    this.log("log", victim.data.name + " (" + victim.id + ") was murdered.");
                    this.emitPlayerJoinGroup(victim.data.name, RoomGroup.Spectator);
                } else {
                    this.log("warn", "Someone got murdered, but there was no data.");
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
            this.emitError("An unknown error occurred, join the discord to contact an admin for help.", true);
            await this.destroy();
        }
    }

    awaitSpawns(): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            const playersSpawned = [];
            let gamedataSpawned = false;

            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const _this = this;

            this.client.on("spawn", function onSpawn(room, component) {
                if (component.classname === "GameData") {
                    gamedataSpawned = true;

                    const gamedata = component as GameData;

                    for (const [ , player ] of gamedata.players) {
                        if (player.name) _this.emitPlayerColor(player.name, player.color);
                    }
                } else if (component.classname === "PlayerControl") {
                    playersSpawned.push(component.ownerid);
                }
                
                if (gamedataSpawned) {
                    for (const [ clientid, ] of room.players) {
                        if (!~playersSpawned.indexOf(clientid)) {
                            return;
                        }
                    }

                    _this.client.off("spawn", onSpawn);
                    resolve(true);
                }
            });
        });
    }

    awaitSettings(): Promise<GameOptions> {
        return new Promise<GameOptions>(resolve => {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
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
            });
        });
    }

    async initialSpawn(isFinal = false): Promise<ConnectionErrorCode> {
        const ip = this.master[this.server][0];
        const port = this.master[this.server][1];
        
        this.log("info", "Joining for the first time with server %s:%i", ip, port);
        try {
            await this.client.connect(ip, port);
            if (!this.client)
                return ConnectionErrorCode.NoClient;
            await Promise.race([this.client.identify("auproxy"), sleep(5000)]);
            if (!this.client.identified) {
                if (isFinal) this.emitError("Couldn't connect to the Among Us servers, the servers may be full. Try a different region or try again later.", true);
                return ConnectionErrorCode.TimedOut;
            }
        } catch (e) {
            this.log("fatal", e.toString());
            this.emitError("Couldn't connect to the Among Us servers, the servers may be full. Try a different region or try again later.", true);
            return ConnectionErrorCode.FailedToConnect;
        }
        this.log("success", "Successfully connected.");

        if (!this.client) {
            return ConnectionErrorCode.NoClient;
        }
        
        this.log("info", "Joining room..");
        try {
            await this.client.join(this.backendModel.gameCode);
        } catch (e) {
            this.log("fatal", e.toString());
            if (isFinal) this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client.", true);
            return ConnectionErrorCode.FailedToJoin;
        }

        this.log("success", "Successfully joined room.");
        this.log("info", "Waiting for spawns and settings..");
        const room = this.client?.room;

        if (!room) {
            return ConnectionErrorCode.FailedToJoin;
        }
        
        const spawns = await Promise.race([this.awaitSpawns(), sleep(5000)]);
        if (!spawns) {
            this.log("fatal", "I didn't receive spawns from the host.");
            if (isFinal) this.emitError("Did not recieve players, please restart your Among Us lobby, or wait a few minutes and try again.", true);
            return ConnectionErrorCode.TimedOut;
        }
        
        if (!this.client) {
            return ConnectionErrorCode.NoClient;
        }

        const settings = await Promise.race([this.awaitSettings(), sleep(5000)]);
        if (!settings) {
            this.log("fatal", "I didn't receive settings from the host.");
            if (isFinal) this.emitError("Did not recieve game settings, please restart your Among Us lobby, or wait a few minutes and try again.", true);
            return ConnectionErrorCode.TimedOut;
        }
        
        this.settings.map = settings.map;
        this.settings.crewmateVision = settings.crewmateVision;
        this.emitSettingsUpdate({
            crewmateVision: this.settings.crewmateVision,
            map: settings.map
        });
        
        if (room.host && room.host.data) {
            this.emitHostChange(room.host.data.name);
        }

        this.log("success", "Got spawns and settings.");
        this.log("info", "Cleaning up and preparing for re-join..");

        for (const [ , player ] of room.players) {
            if (player && player.data) {
                this.emitPlayerColor(player.data.name, player.data.color);
            }
        }
        
        await this.disconnect();
        return ConnectionErrorCode.None;
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
