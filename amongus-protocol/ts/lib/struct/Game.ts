import {
    AmongusClient
} from "../Client";

import {
    AlterGameTag,
    MessageID,
    PacketID,
    PayloadID,
    RPCID,
    SpawnID
} from "../constants/Enums";

import {
    GameOptionsData,
    SceneChangeLocation,
    VotePlayerState
} from "../interfaces/Packets";

import { Component } from "./components/Component";

import { GameData } from "./objects/GameData";
import { GameObject } from "./objects/GameObject";
import { LobbyBehaviour } from "./objects/LobbyBehaviour";
import { MeetingHub } from "./objects/MeetingHub";

import { PlayerClient } from "./PlayerClient";

export interface Game {
    on(event: "spawn", listener: (object: GameObject) => void);
    on(event: "playerJoin", listener: (client: PlayerClient) => void);
    on(event: "playerLeave", listener: (client: PlayerClient) => void);
    on(event: "startCount", listener: (count: number) => void);
    on(event: "start", listener: () => void);
    on(event: "finish", listener: () => void);
    on(event: "setImposters", listener: (imposters: PlayerClient[]) => void);
    on(event: "vote", listener: (voter: PlayerClient, suspect: PlayerClient) => void);
    on(event: "votingComplete", listener: (skipped: boolean, tie: boolean, exiled: PlayerClient, states: Map<number, VotePlayerState>) => void);
    on(event: "murder", listener: (murderer: PlayerClient, target: PlayerClient) => void);
    on(event: "meeting", listener: (emergency: boolean, target: PlayerClient) => void);
    on(event: "sync", listener: (settings: GameOptionsData) => void);
    on(event: "visibility", listener: (visibility: "private"|"public") => void);
    on(event: "sceneChange", listener: (client: PlayerClient, location: SceneChangeLocation) => void);
}

export class Game extends GameObject {
    ip: string;
    port: number;

    code: number;
    hostid: number;

    /**
     * The clients connected to the game, not necessarily spawned.
     */
    clients: Map<number, PlayerClient>;

    /**
     * A shortcut for all components in the game, all with unique net IDs.
     */
    netcomponents: Map<number, Component>;

    /**
     * When the game was instantiated.
     */
    instantiated: number;

    startCount: number;
    startCounterSeq: number;
    started: boolean;

    /**
     * The imposters in the game.
     */
    imposters: PlayerClient[];

    /**
     * The options fo the game, not necessarily synced, use the `sync` event.
     */
    options: GameOptionsData;

    /**
     * The visibility of the game.
     */
    visibility: "private"|"public";

    constructor(protected client: AmongusClient, ip: string, port: number, code: number, hostid: number, clients: number[]) {
        super(client, client);

        this.id = -2;

        this.ip = ip;
        this.port = port;

        this.code = code;
        this.hostid = hostid;

        this.clients = new Map;
        this.netcomponents = new Map;

        this.instantiated = Date.now();

        this.startCount = -1;
        this.startCounterSeq = null;
        this.started = false;
        this.imposters = [];

        this.options = null;
        this.visibility = "private";

        clients.forEach(clientid => {
            this.clients.set(clientid, new PlayerClient(client, clientid));
        });
    }

    get age() {
        return Math.floor((Date.now() - this.instantiated) / 1000);
    }

    addChild(object: GameObject) {
        super.addChild(object);

        this.registerComponents(object);
        this.emit("spawn", object);
    }

    async awaitSpawns() {
        await this.awaitChild(SpawnID.GameData);

        return await Promise.all([...this.clients.values()].map(client => client.awaitSpawn()));
    }

    get GameData(): GameData {
        return this.children.find(child => child instanceof GameData) as GameData;
    }

    get MeetingHub(): MeetingHub {
        return this.children.find(child => child instanceof MeetingHub) as MeetingHub;
    }

    _syncSettings(options: GameOptionsData) {
        this.options = options;
        this.emit("sync", this.options);
    }

    async syncSettings(options: GameOptionsData) {
        if (this.client.clientid === this.hostid) {
            await this.client.send({
                op: PacketID.Reliable,
                payloads: [
                    {
                        payloadid: PayloadID.GameData,
                        code: this.code,
                        parts: [
                            {
                                type: MessageID.RPC,
                                handlerid: this.host.Player.PlayerControl.netid,
                                rpcid: RPCID.SyncSettings,
                                options: options
                            }
                        ]
                    }
                ]
            });

            this._syncSettings(options);
        }
    }

    _setImposters(imposters: number[]) {
        this.imposters = imposters.map(imposter => this.getPlayer(imposter));
        this.emit("setImposters", this.imposters);
    }

    async setImposters(imposters: number[]) {
        if (this.client.clientid === this.hostid) {
            await this.client.send({
                op: PacketID.Reliable,
                payloads: [
                    {
                        payloadid: PayloadID.GameData,
                        code: this.code,
                        parts: [
                            {
                                type: MessageID.RPC,
                                handlerid: this.host.Player.PlayerControl.netid,
                                rpcid: RPCID.SetInfected,
                                count: imposters.length,
                                infected: imposters
                            }
                        ]
                    }
                ]
            });

            this._setImposters(imposters);
        }
    }

    _setVisibility(visibility: "private"|"public") {
        this.visibility = visibility;
        this.emit("visibility", visibility);
    }

    async setVisibility(visibility: "private"|"public") {
        if (this.client.clientid === this.hostid) {
            await this.client.send({
                op: PacketID.Reliable,
                payloads: [
                    {
                        payloadid: PayloadID.AlterGame,
                        code: this.code,
                        tag: AlterGameTag.ChangePrivacy,
                        is_public: visibility === "public"
                    }
                ]
            });

            this._setVisibility(visibility);
        }
    }

    _setStartCounter(sequence: number, counter: number = -1) {
        if (sequence > this.startCounterSeq) {
            this.startCounterSeq = sequence;
            this.startCount = counter;


            this.emit("startCount", counter);
        }
    }

    async setStartCounter(counter) {
        const sequence = this.startCounterSeq + 1;

        if (this.client.clientid === this.hostid) {
            await this.client.send({
                op: PacketID.Reliable,
                payloads:[
                    {
                        payloadid: PayloadID.GameData,
                        code: this.code,
                        parts: [
                            {
                                type: MessageID.RPC,
                                handlerid: this.host.Player.PlayerControl.netid,
                                rpcid: RPCID.SetStartCounter,
                                sequence: sequence,
                                time: counter
                            }
                        ]
                    }
                ]
            });

            this._setStartCounter(sequence, counter);
        }
    }

    _playerJoin(clientid: number) {
        const client = new PlayerClient(this.client, clientid);

        this.clients.set(client.clientid, client);
        this.emit("playerJoin", client);
    }

    async playerJoin(clientid: number) {
        if (this.client.clientid === this.hostid) {
            this.setStartCounter(-1);
        }

        this._playerJoin(clientid);
    }

    _sceneChange(clientid: number, location: SceneChangeLocation) {
        const client = this.clients.get(clientid);

        if (client) {
            this.emit("sceneChange", client, location);
            client.emit("sceneChange", location);
        }
    }

    async sceneChange(clientid: number, location: SceneChangeLocation) {
        if (this.client.clientid === this.hostid) {
            const gamedata = await this.awaitChild(SpawnID.GameData) as GameData;
            const lobbybehaviour = await this.awaitChild(SpawnID.LobbyBehaviour) as LobbyBehaviour;

            // Perhaps the worst code I have ever written.
            // V-V-V-V-V-V-V-V-V-V-V-V-V-V-V-V-V-V-V-V-V-V
            /*const player_objects = (await Promise.allSettled([...this.clients.values()].map(client => {
                if (client.clientid === clientid) return Promise.resolve();

                return client.awaitChild(SpawnID.Player);
            }))).map(settled => (settled.status === "fulfilled" ? settled.value : null) as GameObject) // Get all player objects connected, and if they aren't spawned yet, wait for them.

            await this.client.send({
                op: PacketID.Reliable,
                payloads: [
                    {
                        payloadid: PayloadID.GameDataTo,
                        code: this.code,
                        recipient: clientid,
                        parts: [
                            gamedata,
                            lobbybehaviour,
                            ...player_objects
                        ].map(object => {
                            return {
                                type: MessageID.Spawn,
                                spawnid: object.spawnid,
                                ownerid: object.parentid,
                                flags: 0,
                                num_components: object.components.length,
                                components: (object.components as Component[]).map(component => {
                                    const serialised = component.Serialize();

                                    return {
                                        netid: component.netid,
                                        type: 0,
                                        datalen: serialised.byteLength,
                                        data: serialised
                                    }
                                })
                            }
                        })
                    }
                ]
            });*/

            this._sceneChange(clientid, location);
        }
    }

    _start() {
        this.started = true;

        this.emit("start");
    }

    async start() {
        // TODO: Handle starting games as hosts.

        this._start();
    }

    _finish() {
        this.started = false;

        this.emit("finish");
    }

    async finish() {
        // TODO: Handle finishing games as hosts.

        this._finish();
    }

    registerComponents(object: GameObject) {
        for (let i = 0; i < object.components.length; i++) {
            const component = object.components[i];

            this.netcomponents.set(component.netid, component);
        }
    }

    /**
     * Find a player by their name.
     */
    findPlayer(username: string) {
        for (let [clientid, client] of this.clients) {
            if (!client.Player || client.removed) continue;

            const playerData = this.GameData.GameData.players.get(client.Player.PlayerControl.playerId);

            if (playerData && playerData.name === username) {
                return client;
            }
        }

        return null;
    }

    /**
     * Get a player by their player ID.
     */
    getPlayer(playerid: number) {
        for (let [clientid, client] of this.clients) {
            if (!client.Player || client.removed) continue;

            if (client.Player.PlayerControl.playerId === playerid) {
                return client;
            }
        }

        return null;
    }

    /**
     * Get a player by their PlayerControl component's network ID.
     */
    getPlayerByNetID(netid: number) {
        for (let [clientid, client] of this.clients) {
            if (!client.Player || client.removed) continue;

            if (client.Player.PlayerControl.netid === netid) {
                return client;
            }
        }

        return null;
    }

    get host() {
        return this.clients.get(this.hostid);
    }

    get me() {
        return this.clients.get(this.client.clientid);
    }
}
