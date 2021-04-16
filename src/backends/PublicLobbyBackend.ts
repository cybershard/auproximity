import util from "util";
import dns from "dns";
import chalk from "chalk";

import { SkeldjsClient } from "@skeldjs/client";
import * as text from "@skeldjs/text";

const tb = text.tb;

import {
    MapID,
    SystemType,
    ColorID,
    TheSkeldVent,
    MiraHQVent,
    PolusVent
} from "@skeldjs/constant";

import {
    GameOptions
} from "@skeldjs/protocol";

import {
    Networkable,
    PlayerData,
    GameData,
    MapVentData
} from "@skeldjs/core";

import logger from "../util/logger";

import { PublicLobbyBackendModel } from "../types/models/Backends";

import {
    BackendAdapter,
    LogMode
} from "./Backend";

import { PlayerFlag } from "../types/enums/PlayerFlags";
import { DebugLevel } from "@skeldjs/client/js/lib/interface/ClientConfig";
import { GameSettings } from "../types/models/ClientOptions";
import { MatchmakerServers } from "../types/constants/MatchmakerServers";
import { GameState } from "../types/enums/GameState";
import { GameFlag } from "../types/enums/GameFlags";

const GAME_VERSION = "2021.3.5.0";
// Using integer for now, version parsing isn't working on SkeldJS with 2020.3.5.0 for some reason.
// I'm keeping this comment here because it shows how stupid I am that it is in fact 2021 and not 2020.

/*
const colours = {
    red: chalk.redBright,
    blue: chalk.blue,
    green: chalk.green,
    pink: chalk.magentaBright,
    orange: chalk.yellow,
    yellow: chalk.yellowBright,
    grey: chalk.grey,
    white: chalk.white,
    purple: chalk.magenta,
    brown: chalk.red,
    cyan: chalk.cyan,
    lime: chalk.greenBright
};


const fmtName = (player: PlayerData) => {
    if (!player)
        return chalk.grey("No Data");

    const has_data = !!player.data;
    const colour = has_data ? player.data.color : "grey";
    const name = has_data ? player.data.name || "No Name" : "No Data";
    const id = player.id || "No ID";

    const consoleClr: chalk.Chalk = colours[colour] || colours.grey;

    return consoleClr(name) + " (" + chalk.grey(player.id) + ")";
};
*/

const sleep = ms => new Promise<void>(resolve => setTimeout(resolve, ms));
const lookupDns = util.promisify(dns.lookup);

export enum ConnectionErrorCode {
    None,
    NoClient,
    FailedToConnect,
    TimedOut,
    FailedToJoin
}

export type RegionServers = [ string, number ][];

export default class PublicLobbyBackend extends BackendAdapter {
    static OfficialServers: Record<string, RegionServers> = {};

    backendModel: PublicLobbyBackendModel;

    client: SkeldjsClient;

    master: RegionServers;
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

    getVentName(ventid: number): string|null {
        const map = this.client.settings.map;
        const data = MapVentData[map][ventid];

        switch (map) {
            case MapID.TheSkeld:
                return TheSkeldVent[data.id];
            case MapID.MiraHQ:
                return MiraHQVent[data.id];
            case MapID.Polus:
                return PolusVent[data.id];
        }

        return null;
    }

    async doJoin(max_attempts = 5, attempt = 0): Promise<boolean> {
        if (this.destroyed)
            return false;

        if (attempt >= max_attempts) {
            this.log("fatal", "Couldn't join game.");
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
                    this.log("fatal", "Couldn't join game.");
                    this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client.", true);
                    return false;
                }

                await this.client.disconnect();

                this.server++;
                this.server = this.server % this.master.length;
                attempt++;

                const remaining = max_attempts - attempt;
                this.log("warn", "Failed to initially spawn, Retrying " + remaining + " more time" + (remaining === 1 ? "" : "s") + ", also trying another server.");
                this.emitError("Couldn't connect to the server. Retrying " + remaining + " more time" + (remaining === 1 ? "" : "s") + ".", false);
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
            await this.client.joinGame(this.backendModel.gameCode, false);
        } catch (e) {
            const err = e as Error;
            attempt++;

            this.log("warn", "Failed to join game (" + err.message + "), Retrying " + (max_attempts - attempt) + " more times.");
            this.emitError(err.message + ". Retrying " + (max_attempts - attempt) + " more times.", false);
            return await this.doJoin(max_attempts, attempt);
        }
        
        this.log("info", "Replacing state with cached state.. (%i objects, %i netobjects, %i room components)", this.players_cache.size, this.components_cache.size, this.global_cache.length);

        for (const [ id, object ] of this.players_cache) {
            object.room = this.client;
            this.client.objects.set(id, object);
        }
        
        for (const  [ id, component ] of this.components_cache) {
            component.room = this.client;
            this.client.netobjects.set(id, component);
        }

        for (let i = 0; i < this.global_cache.length; i++) {
            const component = this.global_cache[i];

            component.room = this.client;
            this.client.components[i] = component;
        }

        this.log("success", "Joined & successfully replaced state!");

        if (this.client.host && this.client.host.data) {
            this.log("success", "Found host: " + this.client.host.data.name);

            this.emitHostChange(this.client.host.data.name);
        }
        return true;
    }

    async disconnect(): Promise<void> {
        this.players_cache = new Map([...this.client.objects.entries()].filter(([ objectid ]) => objectid !== this.client.clientid && objectid > 0 /* not global */)) as Map<number, PlayerData>;
        this.components_cache = new Map([...this.client.netobjects.entries()].filter(([ , component ]) => component.ownerid !== this.client.clientid));
        this.global_cache = this.client.components;

        await this.client.disconnect();
        this.didDisconnect = true;
    }

    async resolveMMDNS(region: string, names: string[]): Promise<RegionServers> {
        const regions = PublicLobbyBackend.OfficialServers;
        const servers: [string, number][] = [];

        for (let i = 0; i < names.length; i++) {
            const name = names[i];

            const ips = await lookupDns(name, { all: true, family: 4 });
            const v4 = ips.filter(ip => ip.family === 4).map(ip => [ ip.address, 22023 ] as [string, number]);

            servers.push(...v4);
        }

        if (!regions[region]) regions[region] = [];
        regions[region].push(...servers);
        return regions[region];
    }

    async initialize(): Promise<void> {
        this.destroyed = false;

        try {
            this.log("info", "PublicLobbyBackend initialized in region " + this.backendModel.region);

            const dns = MatchmakerServers[this.backendModel.region];
            this.master = await this.resolveMMDNS(this.backendModel.region, dns);

            this.server = ~~(Math.random() * this.master.length);

            if (!await this.doJoin())
                return;

            this.client.on("client.disconnect", async (ev, { reason, message }) => {
                this.log("info", "Client disconnected: " + (reason === undefined ? "No reason." : (reason + " (" + message + ")")));
            });

            this.client.on("player.move", (ev, { player, position }) => {
                if (player.data) {
                    this.emitPlayerPosition(player.data.name, position);
                }
            });

            this.client.on("player.snapto", (ev, { player, position }) => {
                if (player.data) {
                    this.log("log", "Got SnapTo for " + player.data.name + " (" + player.id + ") to x: " + position.x + " y: " + position.y);
                    this.emitPlayerPosition(player.data.name, position);
                } else {
                    this.log("warn", "Got snapto, but there was no data.");
                }
            });

            this.client.on("player.setstartcounter", (ev, { counter }) => {
                if (counter <= 5 && counter > 0) {
                    this.log("info", "Game is starting in " + counter + " second" + (counter === 1 ? "" : "s"));
                }
            });

            this.client.on("game.start", async () => {
                this.emitGameState(GameState.Game);
                this.log("info", "Game started.");
            });

            this.client.on("game.end", async () => {
                this.emitGameState(GameState.Lobby);
                this.log("info", "Game ended, re-joining..");
                
                if (!await this.doJoin())
                    return;
            });

            this.client.on("player.sethost", async (ev, { player: host }) => {
                if(!host)
                    return;

                if (host.id === this.client.clientid) {
                    if (this.client.players.size === 1) {
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

            this.client.on("player.join", (ev, { player }) => {
                this.log("info", "Player with ID " + player.id + " joined the game.");
            });

            this.client.on("player.leave", (ev, { player }) => {
                this.log("log", "Player with ID " + player.id + " left or was removed.");
            });

            this.client.on("system.sabotage", (ev, { system }) => {
                if (system.systemType === SystemType.Communications) {
                    this.emitGameFlags(GameFlag.CommsSabotaged, true);
                    this.log("info", "Someone sabotaged communications.");
                }
            });

            this.client.on("system.repair", (ev, { system }) => {
                if (system.systemType === SystemType.Communications) {
                    this.emitGameFlags(GameFlag.CommsSabotaged, false);
                    this.log("info", "Someone repaired communications.");
                }
            });

            this.client.on("player.syncsettings", (ev, { settings }) => {
                if (settings.crewmateVision !== this.settings.crewmateVision) {
                    this.settings.crewmateVision = settings.crewmateVision;

                    this.log("info", "Crewmate vision is now set to " + settings.crewmateVision + ".");
                }
                
                if (settings.map !== this.settings.map) {
                    this.settings.map = settings.map;

                    this.log("info", "Map is now set to " + MapID[settings.map] + ".");
                }
                
                this.emitSettingsUpdate(this.settings);
            });

            this.client.on("player.setname", (ev, { player, name }) => {
                if (player.data) {
                    this.log("info", player.id + " set their name to " + name + ".");
                } else {
                    if (player) {
                        this.log("warn", "Name was set for " + player.id + ", but there was no data.");
                    } else {
                        this.log("warn", "Name was set for a player, but there was no data.");
                    }
                }
            });

            this.client.on("player.setcolor", (ev, { player, color }) => {
                if (player?.data) {
                    this.log("info", player.data.name + " set their colour to " + ColorID[color] + ".");
                    this.emitPlayerColor(player.data.name, color);
                } else {
                    if (player) {
                        this.log("warn", "Color was set for " + player.id + ", but there was no data.");
                    } else {
                        this.log("warn", "Color was set for a player, but there was no data.");
                    }
                }
            });

            this.client.on("player.meeting", async () => {
                const [ , { component } ] = await this.client.wait("component.spawn");
                if (component.classname === "MeetingHud") {
                    this.emitGameState(GameState.Meeting);

                    const all_states = [...component.players.values()];
                    const state = all_states.find(state => state.reported);
                    
                    if (state) {
                        const player = this.client.getPlayerByPlayerId(state.playerId);
                        
                        if (player) {
                            if (player.data) {
                                this.log("log", player.data.name + " (" + player.id + ") called a meeting.");
                            } else {
                                this.log("warn", "A player with ID " + player.id + " called a meeting, but there was no data.");
                            }
                        } else {
                            this.log("warn", "Someone called a meeting, but there was no data for the reporter.");
                        }
                    } else {
                        this.log("warn", "Someone called a meeting, but there was no data for the reporter.");
                    }
                }
            });

            this.client.on("meetinghud.votingcomplete", (ev, { ejected }) => {
                if (ejected && ejected.data) {
                    this.emitGameState(GameState.Game);
                    this.emitPlayerFlags(ejected.data.name, PlayerFlag.IsDead, true);
                    this.log("log", ejected.data.name + " (" + ejected.id + ") was voted off");
                }
            });

            this.client.on("player.murder", (ev, { victim }) => {
                if (victim && victim.data) {
                    this.log("info", victim.data.name + " (" + victim.id + ") was murdered.");
                    this.emitPlayerFlags(victim.data.name, PlayerFlag.IsDead, true);
                } else {
                    this.log("warn", "Someone got murdered, but there was no data.");
                }
            });

            this.client.on("player.entervent", (ev, { player, ventid }) => {
                if (player && player.data) {
                    this.log("log", player.data.name + " (" + player.id + ") entered vent '" + this.getVentName(ventid) + "'.");
                    this.emitPlayerFlags(player.data.name, PlayerFlag.InVent, true);
                } else {
                    this.log("warn", "Someone entered a vent, but there was no data.");
                }
            });

            this.client.on("player.exitvent", (ev, { player, ventid }) => {
                if (player && player.data) {
                    this.log("log", player.data.name + " (" + player.id + ") exited vent '" + this.getVentName(ventid) + "'.");
                    this.emitPlayerFlags(player.data.name, PlayerFlag.InVent, true);
                } else {
                    this.log("warn", "Someone exited a vent, but there was no data.");
                }
            });

            this.client.on("player.setimpostors", (ev, { impostors }) => {
                for (let i = 0; i < impostors.length; i++) {
                    const player = impostors[i];
                    if (player?.data) {
                        this.log("info", player.data.name + " was made impostor.");
                        this.emitPlayerFlags(player.data.name, PlayerFlag.IsImpostor, true);
                    } else {
                        this.log("warn", "Someone was made impostor, but there was no data.");
                    }
                }
            });

            this.client.on("gamedata.removeplayer", (ev, { playerData }) => {
                const client = this.client.getPlayerByPlayerId(playerData.playerId);

                if (playerData) {
                    this.log("info", "Removed " + playerData.name + (client ? " (" + client.id + ")" : ""));
                    this.emitPlayerColor(playerData.name, -1);
                }
            });

            this.client.on("security.cameras.join", (ev, { player }) => {
                if (player?.data) {
                    this.log("info", player.data.name + " (" + player.id + ") went onto cameras.");
                    this.emitPlayerFlags(player.data.name, PlayerFlag.OnCams, true);
                } else {
                    this.log("warn", "Someone went onto cameras, but there was no data.");
                }
            });

            this.client.on("security.cameras.leave", (ev, { player }) => {
                if (player?.data) {
                    this.log("info", player.data.name + " (" + player.id + ") went off cameras.");
                    this.emitPlayerFlags(player.data.name, PlayerFlag.OnCams, false);
                } else {
                    this.log("warn", "Someone went off cameras, but there was no data.");
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
            const playersSpawned: number[] = [];
            let gamedataSpawned = false;

            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const _this = this;

            this.client.on("component.spawn", function onSpawn(ev, { component }) {
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
                    for (const [ clientid, ] of _this.client.players) {
                        if (!playersSpawned.includes(clientid)) {
                            return;
                        }
                    }

                    _this.client.off("component.spawn", onSpawn);
                    resolve(true);
                }
            });
        });
    }

    async awaitSettings(): Promise<GameOptions> {
        if (this.client.settings) {
            return this.client.settings;
        }

        const [ , { settings } ] = await this.client.wait("player.syncsettings");

        return settings;
    }

    async initialSpawn(isFinal = false): Promise<ConnectionErrorCode> {
        const ip = this.master[this.server][0];
        const port = this.master[this.server][1];
        
        this.log("info", "Joining for the first time with server %s:%i", ip, port);
        try {
            await this.client.connect(ip, port);
            if (!this.client)
                return ConnectionErrorCode.NoClient;
            await Promise.race([this.client.identify("auproxy"), sleep(2000)]);
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
            const code = await Promise.race([await this.client.joinGame(this.backendModel.gameCode), sleep(5000)]);
            if (!code) {
                if (isFinal) this.emitError("Timed out while connecting to servers.", true);
                return ConnectionErrorCode.TimedOut;
            }
        } catch (e) {
            this.log("fatal", e.toString());
            if (isFinal) this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client.", true);
            return ConnectionErrorCode.FailedToJoin;
        }

        this.log("success", "Successfully joined room.");
        this.log("info", "Waiting for spawns and settings..");
        const code = this.client.code;
        if (!code) {
            return ConnectionErrorCode.FailedToJoin;
        }
        
        const result = await Promise.race([Promise.all([this.awaitSpawns(), this.awaitSettings()]), sleep(2000)]);
        if (!result) {
            this.log("fatal", "I didn't receive one of spawns or settings from the host.");
            if (isFinal) this.emitError("Did not recieve players and settings, please restart your Among Us lobby, or wait a few minutes and try again.", true);
            return ConnectionErrorCode.TimedOut;
        }

        if (!this.client) {
            return ConnectionErrorCode.NoClient;
        }

        const [ , settings ] = result;
        
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
        this.log("info", "Crewmate vision is at " + settings.crewmateVision);
        this.log("info", "Map is on " + MapID[settings.map]);
        
        console.log(this.client.host.data);
        if (this.client.host && this.client.host.data) {
            this.emitHostChange(this.client.host.data.name);
        }

        this.log("success", "Got spawns and settings.");
        this.log("info", "Cleaning up and preparing for re-join..");

        for (const [ , player ] of this.client.players) {
            if (player && player.data) {
                this.emitPlayerColor(player.data.name, player.data.color);
            }
        }

        const formatted = tb(text.bold(), text.color("blue"), text.align(text.Align.Center))
            .text("AUProximity is ready.");

        await this.client.me.control.checkName("ㆍ");
        await this.client.me.control.checkColor(ColorID.Blue);
        await this.client.me.wait("player.setname");
        await this.client.me.control.chat(formatted.toString());

        await sleep(100);
        
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
