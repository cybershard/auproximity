import dgram from "dgram"
import util from "util"

import { EventEmitter } from "events"

import { parsePacket } from "./Parser"
import { composePacket } from "./Compose"

import { Code2Int } from "./util/Codes"

import {
    GameListGame,
    Packet,
    Payload,
    GameOptionsData,
    GameListClientBoundTag,
    VotePlayerState,
    PlayerVoteAreaFlags
} from "./interfaces/Packets"

import {
    AlterGameTag,
    DisconnectID,
    DistanceID,
    LanguageID,
    MapID,
    MessageID,
    PacketID,
    PayloadID,
    RPCID,
    SpawnID,
    TaskBarUpdate
} from "./constants/Enums"

import { Game } from "./struct/Game"
import { PlayerClient } from "./struct/PlayerClient"

import { bitfield } from "./interfaces/Types"
import { JoinOptions } from "./interfaces/JoinOptions"

import { GameData } from "./struct/objects/GameData"
import { LobbyBehaviour } from "./struct/objects/LobbyBehaviour"
import { MeetingHub } from "./struct/objects/MeetingHub"
import { Player } from "./struct/objects/Player"
import { ShipStatus } from "./struct/objects/ShipStatus"
import { HeadQuarters } from "./struct/objects/HeadQuarters"
import { PlanetMap } from "./struct/objects/PlanetMap"
import { AprilShipStatus } from "./struct/objects/AprilShipStatus"

import { ClientOptions } from "./interfaces/ClientOptions"
import { DebugOptions } from "./constants/DebugOptions"

export declare interface AmongusClient {
    on(event: "packet", listener: (packet: Packet) => void);
    off(event: "packet", listener: (packet: Packet) => void);
    on(event: "disconnect", listener: () => void);
    off(event: "disconnect", listener: () => void);
    on(event: "connected", listener: () => void);
    off(event: "connected", listener: () => void);
}

export class AmongusClient extends EventEmitter {
    options: ClientOptions;
    socket: dgram.Socket;

    id: number;

    /**
     * The IP that the client is connected to.
     */
    ip: string;

    /**
     * The port that the client is connected to.
     */
    port: number;

    /**
     * The incrementing nonce for the client.
     */
    nonce: number;

    /**
     * The username of the client.
     */
    username: string;

    /**
     * The current game of the client.
     */
    game: Game;

    /**
     * The client ID of the client given after joining a game.
     */
    clientid: number;

    constructor (options: ClientOptions = {}) {
        super();

        this.id = null;

        this.options = options;
        this.nonce = 1;

        this.game = null;
    }

    /**
     * Print a debug message if the debug option is enabled.
     */
    debug(debugOpt: DebugOptions, ...fmt) {
        if ((this.options.debug & DebugOptions.Everything) === DebugOptions.Everything || (this.options.debug & debugOpt) === debugOpt) {
            console.log(...fmt);
        }
    }

    _disconnect() {
        this.emit("disconnect");

        this.socket.removeAllListeners();

        this.socket = null;
        this.ip = null;
        this.port = null;

        this.nonce = 1;
    }

    /**
     * Disconnect from the currently connected server.
     */
    async disconnect(reason?: number, message?: string) {
        if (reason) {
            if (reason === DisconnectID.Custom) {
                if (message) {
                    await this.send({
                        op: PacketID.Disconnect,
                        reason: reason,
                        message: message
                    });
                } else {
                    await this.send({
                        op: PacketID.Disconnect,
                        reason: reason
                    });
                }
            } else {
                await this.send({
                    op: PacketID.Disconnect,
                    reason: reason
                });
            }
        } else {
            await this.send({
                op: PacketID.Disconnect
            });
        }

        await this.awaitPacket(packet => packet.op === PacketID.Disconnect);

        this._disconnect();
    }

    _connect(ip: string, port: number) {
        this.socket = dgram.createSocket("udp4");
        this.ip = ip;
        this.port = port;

        this.nonce = 1;

        this.socket.on("message", async buffer => {
            const format_buffer = [...buffer].map(byte => "0".repeat(2 - byte.toString(16).length) + byte.toString(16)).join(" ");
            const packet = parsePacket(buffer);

            if (packet.reliable) {
                await this.ack(packet.nonce);
            }

            if (packet.op === PacketID.Unreliable || packet.op === PacketID.Reliable) {
                this.debug(DebugOptions.PayloadInbound, "Received packet", format_buffer, util.inspect(packet, false, 10, true));
            } else {
                this.debug(DebugOptions.SpecialInbound, "Received packet", format_buffer, util.inspect(packet, false, 10, true));
            }

            if (packet.bound === "client") {
                switch (packet.op) {
                    case PacketID.Unreliable:
                    case PacketID.Reliable:
                        for (let i = 0; i < packet.payloads.length; i++) {
                            const payload = packet.payloads[i];

                            switch (payload.payloadid) {
                                case PayloadID.JoinGame:
                                    if (payload.bound === "client") {
                                        switch (payload.error) {  // Couldn't get typings to work with if statements so I have to deal with switch/case.
                                            case false:
                                                if (payload.code === this.game.code) {
                                                    this.game.playerJoin(payload.clientid);
                                                    this.game.hostid = payload.hostid;
                                                }
                                                break;
                                        }
                                    }
                                    break;
                                case PayloadID.StartGame:
                                    if (payload.code === this.game.code) {
                                        this.game._start();

                                        await this.game.me.ready();
                                    }
                                    break;
                                case PayloadID.EndGame:
                                    if (payload.code === this.game.code) {
                                        this.game._finish();
                                    }
                                    break;
                                case PayloadID.RemovePlayer:
                                    if (payload.code === this.game.code) {
                                        const client = this.game.clients.get(payload.clientid);

                                        if (client) {
                                            client.removed = true;

                                            this.game.clients.delete(payload.clientid);
                                            this.game.emit("playerLeave", client);
                                        }
                                    }
                                    break;
                                case PayloadID.JoinedGame:
                                    if (!this.game) {
                                        this.game = new Game(this, this.ip, this.port, payload.code, payload.hostid, [payload.clientid, ...payload.clients]);
                                        this.clientid = payload.clientid;

                                        if (this.clientid === this.game.hostid) {

                                        }
                                    }
                                    break;
                                case PayloadID.KickPlayer:
                                    if (payload.bound === "client") {
                                        if (payload.code === this.game.code) {
                                            const client = this.game.clients.get(payload.clientid);

                                            if (client) {
                                                client.emit("kicked", payload.banned);
                                            }
                                        }
                                    }
                                    break;
                                case PayloadID.GameData:
                                case PayloadID.GameDataTo:
                                    if (this.game.code === payload.code) {
                                        for (let i = 0; i < payload.parts.length; i++) {
                                            const part = payload.parts[i];

                                            switch (part.type) {
                                                case MessageID.Data:
                                                    const component = this.game.netcomponents.get(part.netid);

                                                    if (component) {
                                                        component.OnDeserialize(part.datalen, part.data);
                                                    }
                                                    break;
                                                case MessageID.RPC:
                                                    switch (part.rpcid) {
                                                        case RPCID.CompleteTask:
                                                            break;
                                                        case RPCID.SyncSettings:
                                                            this.game._syncSettings(part.options);
                                                            break
                                                        case RPCID.SetInfected:
                                                            this.game._setImposters(part.infected);
                                                            break;
                                                        case RPCID.MurderPlayer: {
                                                            const client = this.game.getPlayerByNetID(part.targetnetid);
                                                            const murderer = this.game.getPlayerByNetID(part.handlerid);

                                                            if (client && murderer) {
                                                                client.dead = true;

                                                                this.game.emit("murder", murderer, client);

                                                                client.emit("murdered", murderer);
                                                                murderer.emit("murder", client);
                                                            }
                                                            break;
                                                        }
                                                        case RPCID.StartMeeting:
                                                            if (part.targetid === 0xFF) {
                                                                this.game.emit("meeting", true, null);
                                                            } else {
                                                                const target = this.game.getPlayer(part.targetid);

                                                                this.game.emit("meeting", false, target);
                                                            }
                                                            break;
                                                        case RPCID.SetStartCounter:
                                                            if (this.game.startCounterSeq === null || part.sequence > this.game.startCounterSeq) {
                                                                this.game.startCount = part.time;
                                                                this.game.emit("startCount", this.game.startCount);
                                                            }
                                                            break;
                                                        case RPCID.VotingComplete:
                                                            const states: Map<number, VotePlayerState> = new Map;

                                                            for (let playerId = 0; playerId < part.states.length; playerId++) {
                                                                const flags = part.states[playerId];

                                                                const state = {
                                                                    flags,
                                                                    playerId,
                                                                    votedFor: flags & PlayerVoteAreaFlags.VotedFor,
                                                                    reported: (flags & PlayerVoteAreaFlags.DidReport) !== 0,
                                                                    voted: (flags & PlayerVoteAreaFlags.DidVote) !== 0,
                                                                    dead: (flags & PlayerVoteAreaFlags.IsDead) !== 0
                                                                }

                                                                states.set(playerId, state);
                                                            }

                                                            if (part.tie) {
                                                                this.game.emit("votingComplete", false, true, null);
                                                            } else if (part.exiled === 0xFF) {
                                                                this.game.emit("votingComplete", true, false, null);
                                                            } else {
                                                                this.game.emit("votingComplete", false, false, this.game.getPlayer(part.exiled));
                                                            }
                                                            break;
                                                        case RPCID.SendChatNote:
                                                            break;
                                                        case RPCID.SetTasks:
                                                            const client = this.game.getPlayer(part.playerid);

                                                            if (client) {
                                                                client._setTasks(part.tasks);
                                                            }
                                                            break;
                                                        case RPCID.UpdateGameData:
                                                            await this.game.awaitChild(SpawnID.GameData);

                                                            this.game.GameData.GameData.UpdatePlayers(part.players);
                                                            break;
                                                    }
                                                    break;
                                                case MessageID.Spawn:
                                                    switch (part.spawnid) {
                                                        case SpawnID.ShipStatus:
                                                            new ShipStatus(this, this.game, part.components);
                                                            break;
                                                        case SpawnID.MeetingHub:
                                                            new MeetingHub(this, this.game, part.components);
                                                            break;
                                                        case SpawnID.LobbyBehaviour:
                                                            new LobbyBehaviour(this, this.game, part.components)
                                                            break;
                                                        case SpawnID.GameData:
                                                            new GameData(this, this.game, part.components);
                                                            break;
                                                        case SpawnID.Player:
                                                            const playerclient = this.game.clients.get(part.ownerid);

                                                            new Player(this, playerclient, part.components);
                                                            break;
                                                        case SpawnID.HeadQuarters:
                                                            new HeadQuarters(this, this.game, part.components);
                                                            break;
                                                        case SpawnID.PlanetMap:
                                                            new PlanetMap(this, this.game, part.components);
                                                            break;
                                                        case SpawnID.AprilShipStatus:
                                                            new AprilShipStatus(this, this.game, part.components);
                                                            break;
                                                    }
                                                    break;
                                                case MessageID.Despawn:
                                                    this.game.netcomponents.delete(part.netid);
                                                    break;
                                                case MessageID.Ready:
                                                    const client = this.game.getPlayer(part.clientid);

                                                    if (client) {
                                                        client.is_ready = true;
                                                    }
                                                    break;
                                            }
                                        }
                                    }
                                    break;
                                case PayloadID.AlterGame:
                                    switch (payload.tag) {
                                        case AlterGameTag.ChangePrivacy:
                                            this.game._setVisibility(payload.is_public ? "public" : "private");
                                            break;
                                    }
                                    break;
                            }
                            break;
                        }
                        break;
                    case PacketID.Acknowledge:
                        this.debug(DebugOptions.Acknowledgements, "Recieved acknowledege", packet.nonce);
                        break;
                }
            }

            this.emit("packet", packet);
        });
    }

    /**
     * Connect to a server IP and port.
     * @param username The username to connect with.
     */
    async connect(ip: string, port: number, username: string): Promise<boolean|number> {
        if (this.socket) {
            await this.disconnect();
        }

        this._connect(ip, port);

        if (await this.hello(username)) {
            this.emit("connected");

            return true;
        }

        return false;
    }

    _send(buffer: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket.send(buffer, this.port, this.ip, err => {
                if (err) return reject(err);

                resolve();
            });
        });
    }

    /**
     * Wait for a packet to be received from the server.
     */
    awaitPacket(filter: (packet: Packet) => boolean): Promise<Packet|null> {
        const _this = this;

        return new Promise((resolve, reject) => {
            function onPacket(packet) {
                if (filter(packet)) {
                    _this.off("disconnect", onDisconnect);
                    _this.off("packet", onPacket);

                    resolve(packet);
                }
            }

            function onDisconnect() {
                _this.off("disconnect", onDisconnect);
                _this.off("packet", onPacket);

                resolve(null);
            }

            this.on("packet", onPacket);
            this.on("disconnect", onDisconnect);
        });
    }

    /**
     * Wait for a payload to be received from the server.
     */
    async awaitPayload(filter: (payload: Payload) => boolean): Promise<Payload|null> {
        const packet = await this.awaitPacket(packet => {
            return (packet.op === PacketID.Unreliable || packet.op === PacketID.Reliable)
                && packet.bound === "client"
                && packet.payloads.some(filter);
        });

        if (packet.op === PacketID.Unreliable || packet.op === PacketID.Reliable) {
            if (packet.bound === "client") {
                return packet.payloads.find(payload => filter(payload));
            }
        }

        return null;
    }

    /**
     * Send a packet to the server and wait for an acknowledgment with respect to disconnects.
     */
    async send(packet: Packet): Promise<boolean> {
        const nonce = this.nonce;

        switch (packet.op) {
            case PacketID.Reliable:
            case PacketID.Hello:
            case PacketID.Ping:
                packet.reliable = true;
                packet.nonce = nonce;
                this.nonce++;
                break;
        }

        const composed = composePacket(packet, "server");

        await this._send(composed);

        const format_buffer = [...composed].map(byte => "0".repeat(2 - byte.toString(16).length) + byte.toString(16)).join(" ");

        if (packet.op === PacketID.Reliable || packet.op === PacketID.Unreliable) {
            this.debug(DebugOptions.PayloadOutbound, "Sent packet", format_buffer);
        } else {
            this.debug(DebugOptions.SpecialOutbound, "Sent packet", format_buffer);
        }

        if (packet.reliable) {
            const interval = setInterval(() => {
                this._send(composed);
            }, this.options.ackInterval || 1500);

            this.debug(DebugOptions.Acknowledgements, "Awaiting acknowledege", nonce);

            const ack = await this.awaitPacket(packet => {
                return packet.op === PacketID.Acknowledge
                    && packet.nonce === nonce;
            });

            clearInterval(interval);

            return ack !== null;
        } else {
            return true;
        }
    }

    async ack(nonce: number): Promise<void> {
        await this.send({
            op: PacketID.Acknowledge,
            nonce
        });
    }

    /**
     * Say hello to the server.
     */
    async hello(username: string): Promise<boolean> {
        if (await this.send({
            op: PacketID.Hello,
            username: username
        })) {
            this.username = username;

            return true;
        }

        return false;
    }

    /**
     * Join a game by it's V6 code.
     */
    async join(code: string|number, options: JoinOptions = {}): Promise<Game> {
        if (typeof code === "string") {
            return this.join(Code2Int(code), options);
        }

        if (this.game) {
            throw new Error("Join Error: You are already in a game. Please leave or end your current game before playing another.");
        }

        await this.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.JoinGame,
                    code: code,
                    mapOwnership: 0x07
                }
            ]
        });

        const payload = await Promise.race([
            this.awaitPayload(p => p.payloadid === PayloadID.Redirect),
            this.awaitPayload(p => p.payloadid === PayloadID.JoinedGame),
            this.awaitPayload(p => p.payloadid === PayloadID.JoinGame)
        ]);
        console.log("raced payload:" , payload)

        if (payload.payloadid === PayloadID.Redirect) {
            await this.disconnect();
            console.log("redirecting to: ", payload);
            await this.connect(payload.ip, payload.port, this.username);

            return await this.join(code, options);
        } else if (payload.payloadid === PayloadID.JoinedGame) {
            if (options.doSpawn ?? true) {
                await this.spawn();
            }

            return this.game;
        } else if (payload.payloadid === PayloadID.JoinGame) {
            if (payload.bound === "client" && payload.error) {
                throw new Error("Join error: " + payload.reason + " (" + payload.message + ")");
            }
        }
    }

    /**
     * Spawn the player in the joined game.
     */
    async spawn() {
        await this.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.GameData,
                    code: this.game.code,
                    parts: [
                        {
                            type: MessageID.SceneChange,
                            clientid: this.clientid,
                            location: "OnlineGame"
                        }
                    ]
                }
            ]
        });
    }

    /**
     * Search for game using specified settings.
     */
    async search(maps: bitfield|MapID[] = 0x07, imposters: number = 0, language: LanguageID = LanguageID.Any): Promise<GameListGame[]> {
        if (Array.isArray(maps)) {
            return await this.search(maps.reduce((val, map) => val + (1 << map), 0), imposters, language);
        }

        await this.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.GetGameListV2,
                    bound: "server",
                    options: {
                        mapID: maps,
                        imposterCount: imposters,
                        language
                    }
                }
            ]
        });

        const payload = await Promise.race([
            this.awaitPayload(p => p.payloadid === PayloadID.Redirect),
            this.awaitPayload(p => p.payloadid === PayloadID.GetGameListV2)
        ]);

        if (payload.payloadid === PayloadID.Redirect) {
            await this.disconnect();

            await this.connect(payload.ip, payload.port, this.username);

            return await this.search(maps, imposters, language);
        } else if (payload.bound === "client" && payload.payloadid === PayloadID.GetGameListV2 && payload.tag === GameListClientBoundTag.List) {
            return payload.games;
        }

        return null;
    }

    /**
     * WIP: Host a game and control game data.
     */
    async host(options: Partial<GameOptionsData> = {}) {
        options = {
            version: 3,
            mapID: MapID.TheSkeld,
            language: LanguageID.Other,
            imposterCount: 1,
            confirmEjects: true,
            emergencies: 1,
            emergencyCooldown: 15,
            discussionTime: 15,
            votingTime: 120,
            playerSpeed: 1,
            crewVision: 1,
            imposterVision: 1.5,
            killCooldown: 45,
            killDistance: DistanceID.Medium,
            visualTasks: true,
            commonTasks: 1,
            longTasks: 1,
            shortTasks: 2,
            ...options
        }

        await this.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.HostGame,
                    options
                }
            ]
        });

        const payload = await Promise.race([
            this.awaitPayload(p => p.payloadid === PayloadID.Redirect),
            this.awaitPayload(p => p.payloadid === PayloadID.HostGame),
            this.awaitPayload(p => p.payloadid === PayloadID.JoinGame)
        ]);

        if (payload.bound === "client") {
            if (payload.payloadid === PayloadID.Redirect) {
                await this.disconnect();

                await this.connect(payload.ip, payload.port, this.username);

                return await this.host(options);
            } else if (payload.payloadid === PayloadID.HostGame) {
                const game = new Game(this, this.ip, this.port, payload.code, null, []);

                new LobbyBehaviour(this, game, [
                    {
                        netid: game.netcomponents.size
                    }
                ]);

                new GameData(this, game, [
                    {
                        netid: game.netcomponents.size
                    },
                    {
                        netid: game.netcomponents.size + 1
                    }
                ]);

                return game;
            } else if (payload.payloadid === PayloadID.JoinGame) {
                if (payload.error) {
                    throw new Error("Join error: " + payload.reason + " (" + payload.message + ")");
                }
            }
        }
    }
}
