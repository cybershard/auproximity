import {
    BackendAdapter,
    MapIdModel,
    PublicLobbyBackendModel,
    PublicLobbyRegion,
    RoomGroup
} from "../types/Backend";
import { GameData, PlayerGameData } from "../../SkeldJS/ts/src/game/components/GameData";
import {
    GameDataMessage,
    SpawnMessage
} from "../../SkeldJS/ts/src/game/protocol/packets/GameData";
import {
    GameDataPayload,
    PayloadMessage,
} from "../../SkeldJS/ts/src/game/protocol/packets/Payloads"
import {
    MapID,
    MasterServers,
    MessageID,
    Opcode,
    PayloadTag,
    RpcID,
    SkeldjsClient,
    SpawnID,
    SystemType
} from "../../SkeldJS/ts";
import {
    RpcMessage,
    SyncSettingsRpc
} from "../../SkeldJS/ts/src/game/protocol/packets/RpcMessages";

import { CustomNetworkTransform } from "../../SkeldJS/ts/src/game/components/CustomNetworkTransform";
import { GameOptions } from "../../SkeldJS/ts/src/game/protocol/misc/GameOptions";
import { Global } from "../../SkeldJS/ts/src/game/Global";
import { Heritable } from "../../SkeldJS/ts/src/game/Heritable";
import { HqHudSystem } from "../../SkeldJS/ts/src/game/systems/HqHudSystem";
import { HudOverrideSystem } from "../../SkeldJS/ts/src/game/systems/HudOverrideSystem";
import { Networkable } from "../../SkeldJS/ts/src/game/Networkable";
import { PlayerData } from "../../SkeldJS/ts/src/game/PlayerData";
import { Room } from "../../SkeldJS/ts/src/game/Room";

const GAME_VERSION = "2020.11.17.0";

export default class PublicLobbyBackend extends BackendAdapter {
    backendModel: PublicLobbyBackendModel
    constructor(backendModel: PublicLobbyBackendModel) {
        super();
        this.backendModel = backendModel;
    }

    client: SkeldjsClient;
    currentMap: MapID;

    objects_cache: Map<number, Heritable>;
    components_cache: Map<number, Networkable>;

    async doJoin(server: [ string, number ]) {
        await this.client.connect(server[0], server[1]);
        await this.client.identify("auproxy");
        await this.client.join(this.backendModel.gameCode, false);
        
        for (let [ id, object ] of this.objects_cache) {
            object.room = this.client.room;
            this.client.room.objects.set(id, object);
        }
        
        for (let [ id, component ] of this.components_cache) {
            component.room = this.client.room;
            this.client.room.components.set(id, component);
        }
    }

    async initialize(): Promise<void> {
        try {
            // connect
            // keep trying to join game
            // on game start => event
            // on player move => event
            // on meeting called => event
            // on player murdered and exiled => event
            // on game finish => event
            // rejoin game
            let server;
            if (this.backendModel.region === PublicLobbyRegion.NorthAmerica) {
                server = MasterServers.NA[0];
            } else if (this.backendModel.region === PublicLobbyRegion.Europe) {
                server = MasterServers.EU[0];
            } else if (this.backendModel.region === PublicLobbyRegion.Asia) {
                server = MasterServers.AS[0];
            }

            await this.initialSpawn(server);

            const handlePayload = async (payload: PayloadMessage) => {
                if (payload.tag === PayloadTag.JoinGame && payload.bound === "client" && payload.error === false) {
                    if (this.client.room.host && this.client.room.host.data) {
                        this.emitHostChange(this.client.room.host.data.name);
                    }
                } else if (payload.tag === PayloadTag.StartGame) {
                    this.emitAllPlayerJoinGroups(RoomGroup.Main);
                    console.log("started game");
                } else if (payload.tag === PayloadTag.EndGame) {
                    this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
                    await this.client.join(this.backendModel.gameCode, false);
                    console.log("ended game");
                } else if (payload.tag === PayloadTag.RemovePlayer && payload.bound == "client") {
                    if (this.client.room.amhost) {
                        await this.client.disconnect();
                        await this.doJoin(server);
                    }
                    
                    if (this.client.room.host && this.client.room.host.data) {
                        this.emitHostChange(this.client.room.host.data.name);
                    }
                    console.log("removed player");
                } else if (payload.tag === PayloadTag.GameData || payload.tag === PayloadTag.GameDataTo) {
                    payload.messages.forEach(part => {
                        handleGameDataPart(part);
                    });
                }
            };

            const handleGameDataPart = (message: GameDataMessage) => {
                if (message.tag == MessageID.Data) {
                    if (message.netid === this.client.room.global.shipstatus?.netid) {
                        if (this.currentMap === MapID.TheSkeld || this.currentMap === MapID.Polus) {
                            const comms = this.client.room.global.shipstatus?.systems?.[SystemType.Communications] as HudOverrideSystem;
                            
                            if (comms) {
                                if (comms.sabotaged) {
                                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                                } else {
                                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                                }
                            }
                        } else if (this.currentMap === MapID.MiraHQ) {
                            const comms = this.client.room.global.shipstatus?.systems?.[SystemType.Communications] as HqHudSystem;
                            
                            if (comms) {
                                if (comms.completed.length === 0) {
                                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                                } else if (comms.completed.length === 2 && comms.completed.every(console => console > 0)) {
                                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                                }
                            }
                        }
                    }
                } else if (message.tag == MessageID.RPC) {
                    handleRPC(message);
                }
            };

            const handleRPC = (rpcPart: RpcMessage) => {
                if (rpcPart.rpcid === RpcID.SyncSettings) {
                    this.emitSettingsUpdate({
                        crewmateVision: rpcPart.settings.crewmateVision
                    });
                } else if (rpcPart.rpcid === RpcID.SetColor) {
                    const player = [...this.client.room.players.values()].find(player => player.control?.netid === rpcPart.netid);

                    if (player && player.data) {
                        this.emitPlayerColor(player.data.name, rpcPart.color)
                    }
                } else if (rpcPart.rpcid === RpcID.StartMeeting) {
                    setTimeout(() => {
                        this.emitAllPlayerPoses({ x: 0, y: 0 });
                    }, 2500);
                    console.log("meeting started");
                } else if (rpcPart.rpcid === RpcID.VotingComplete) {
                    console.log("meeting ended with rpc packet: ", rpcPart);
                    if (rpcPart.exiled !== 0xff) {
                        setTimeout(() => {
                            const player = this.client.room.getPlayerByPlayerId(rpcPart.exiled);
                            
                            if (player && player.data) {
                                this.emitPlayerJoinGroup(player.data.name, RoomGroup.Spectator);
                                console.log("voted off: " + player.data.name);
                            }
                        }, 2500);
                    }
                } else if (rpcPart.rpcid === RpcID.MurderPlayer) {
                    const player = [...this.client.room.players.values()].find(player => player.control?.netid === rpcPart.victimid);
                    
                    if (player && player.data) {
                        this.emitPlayerJoinGroup(player.data.name, RoomGroup.Spectator);
                        
                        console.log("murdered " + player.data.name);
                    }
                }
            };

            await this.doJoin(server);

            this.client.on("disconnect", (reason, message) => {
                console.log("Client disconnected: " + reason + " (" + message + ")");
            });
            
            this.client.on("packet", packet => {
                if (packet.op === Opcode.Reliable || packet.op === Opcode.Unreliable) {
                    packet.payloads.forEach(async payload => await handlePayload(payload));
                }
            });

            this.client.on("move", (room: Room, player: PlayerData, transform: CustomNetworkTransform) => {
                if (transform.owner && transform.owner.data) {
                    this.emitPlayerPose(transform.owner.data.name, transform.position);
                }
            });

            this.client.on("snapTo", (room: Room, player: PlayerData, transform: CustomNetworkTransform) => {
                if (transform.owner && transform.owner.data) {
                    this.emitPlayerPose(transform.owner.data.name, transform.position);
                }
            });

            this.client.on("removePlayerData", (room: Room, global: Global, gamedata: GameData, playerData: PlayerGameData) => {
                if (playerData) {
                    this.emitPlayerColor(playerData.name, -1);
                }
            });

            console.log(`Initialized PublicLobby Backend for game: ${this.backendModel.gameCode}`);
        } catch (err) {
            console.warn("Error in PublicLobbyBackend, disposing room: " + err);
            this.emitError(err);
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
                            message.tag === MessageID.RPC &&
                            message.rpcid === RpcID.SyncSettings)) as GameDataPayload;

                    if (gamedata) {
                        const syncsettings = gamedata.messages.find(message => message.tag === MessageID.RPC && message.rpcid === RpcID.SyncSettings) as SyncSettingsRpc;

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
        try {
            await this.client.connect(server[0], server[1]);
            await this.client.identify("auproxy");
        } catch (e) {
            console.error("An error occurred", e);
            this.emitError("Couldn't connect to the Among Us servers, the server may be full, try again later!");
            return;
        }
        let room: Room;
        try {
            room = await this.client.join(this.backendModel.gameCode);
        } catch (e) {
            console.error("Couldn't join game", e);
            this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client!");
            return;
        }
        await this.awaitSpawns(room);
        const settings = await this.awaitSettings(this.client);
        this.currentMap = settings.map;
        this.emitMapChange(MapIdModel[MapID[settings.map]]);
        if (room.host && room.host.data) {
            this.emitHostChange(room.host.data.name);
        }
        this.objects_cache = new Map([...room.objects.entries()].filter(([ objectid ]) => objectid !== this.client.clientid));
        this.components_cache = new Map([...room.components.entries()].filter(([ , component ]) => component.ownerid !== this.client.clientid));
        await this.client.disconnect();
    }

    async destroy(): Promise<void> {
        if (this.client && this.client.socket) {
            await this.client.disconnect();
            this.client = undefined;
        }
        console.log(`Destroyed PublicLobbyBackend for game: ${this.backendModel.gameCode}`);
    }
}

