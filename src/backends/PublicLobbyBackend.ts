import {
    BackendAdapter,
    MapIdModel,
    PublicLobbyBackendModel,
    PublicLobbyRegion,
    RoomGroup
} from "../types/Backend";

import {
    SkeldjsClient,
    MapID,
    MasterServers,
    MessageID,
    Opcode,
    PayloadTag,
    RpcID,
    SpawnID
} from "../../SkeldJS/ts";

import {
    RpcMessage
} from "../../SkeldJS/ts/src/game/protocol/packets/RpcMessages";

import {
    GameDataMessage,
    SpawnMessage
} from "../../SkeldJS/ts/src/game/protocol/packets/GameData";

import {
    PayloadMessage,
} from "../../SkeldJS/ts/src/game/protocol/packets/Payloads"
import { Lerp } from "../../SkeldJS/ts/src/util/Vector";
import { Room } from "../../SkeldJS/ts/src/game/Room";
import { composeOptions } from "../../SkeldJS/ts/src/game/protocol/composePacket";

const GAME_VERSION = "2020.12.5.0";

export default class PublicLobbyBackend extends BackendAdapter {
    backendModel: PublicLobbyBackendModel
    constructor(backendModel: PublicLobbyBackendModel) {
        super();
        this.backendModel = backendModel;
    }

    playerData: {
        name: string;
        clientId: number;
        playerId: number;
        controlNetId: number;
        transformNetId: number;
    }[] = [];
    client: SkeldjsClient;
    currentMap: MapID;
    shipStatusNetId = -1;

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

            // restart new client
            this.client = new SkeldjsClient(GAME_VERSION);
            this.client.on("packet", packet => {
                // console.log(util.inspect(packet, false, 10, true));
                if (packet.op === Opcode.Reliable || packet.op === Opcode.Unreliable) {
                    packet.payloads.forEach(async payload => await handlePayload(payload));
                }
            });

            const handlePayload = async (payload: PayloadMessage) => {
                if (payload.tag === PayloadTag.JoinGame && payload.bound === "client" && payload.error === false) {
                    const hostData = this.playerData.find(p => p.clientId === payload.hostid);

                    if (hostData) {
                        this.emitHostChange(hostData.name);
                    }
                } else if (payload.tag === PayloadTag.StartGame) {
                    this.emitAllPlayerJoinGroups(RoomGroup.Main);
                    console.log("started game");
                } else if (payload.tag === PayloadTag.EndGame) {
                    this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
                    this.playerData = [];
                    await this.client.join(this.backendModel.gameCode, false);
                    console.log("ended game");
                } else if (payload.tag === PayloadTag.RemovePlayer && payload.bound == "client") {
                    this.playerData = this.playerData.filter(p => p.clientId !== payload.clientid);
                    // Handler for if the game sets us to host. Might be a hacky way.
                    if (payload.clientid === this.client.clientid) {
                        await this.client.disconnect();
                        await this.client.connect(server[0], server[1]);
                        await this.client.identify("auproxy");
                        await this.client.join(this.backendModel.gameCode, false);
                    }

                    const hostData = this.playerData.find(p => p.clientId === payload.hostid);

                    if (hostData) {
                        this.emitHostChange(hostData.name);
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
                    const player = this.playerData.find(p => p.transformNetId === message.netid);
                    if (player) {
                        const reader = message.data;
                        reader.uint16LE();
                        const pose = {
                            x: Lerp(reader.uint16LE() / 65535, -40, 40),
                            y: Lerp(reader.uint16LE() / 65535, -40, 40)
                        };
                        this.emitPlayerPose(player.name, pose);
                    }
                    if (message.netid === this.shipStatusNetId) {
                        const reader = message.data;
                        const systemsMask = reader.packed();
                        // if the systemsMask contains communication
                        if ((systemsMask & (1 << 14)) != 0) {
                            if (this.currentMap === MapID.TheSkeld ||
                                this.currentMap === MapID.Polus) {
                                // if it is sabotaged
                                if (reader.bool()) {
                                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                                } else {
                                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                                }
                            } else if (this.currentMap === MapID.MiraHQ) {
                                let consoleCount = reader.packed();
                                for (let i = 0; i < consoleCount; i++) {
                                    reader.byte();
                                    reader.byte();
                                }
                                consoleCount = reader.packed();
                                if (consoleCount === 0) {
                                    this.emitPlayerFromJoinGroup(RoomGroup.Main, RoomGroup.Muted);
                                }
                                if (consoleCount === 2 && reader.bool() === true && reader.bool() === true) {
                                    this.emitPlayerFromJoinGroup(RoomGroup.Muted, RoomGroup.Main);
                                }
                            }
                        }
                    }
                } else if (message.tag == MessageID.RPC) {
                    handleRPC(message);
                } else if (message.tag == MessageID.Spawn) {
                    handleSpawnMessage(message);
                }
            };

            const handleRPC = (rpcPart: RpcMessage) => {
                if (rpcPart.rpcid === RpcID.SyncSettings) {
                    this.emitSettingsUpdate({
                        crewmateVision: rpcPart.settings.crewmateVision
                    });
                } else if (rpcPart.rpcid === RpcID.StartMeeting) {
                    setTimeout(() => {
                        this.emitAllPlayerPoses({ x: 0, y: 0 });
                    }, 2500);
                    console.log("meeting started");
                } else if (rpcPart.rpcid === RpcID.VotingComplete) {
                    console.log("meeting ended with rpc packet: ", rpcPart);
                    console.log("current playerData: ", this.playerData);
                    if (rpcPart.exiled !== 0xff) {
                        setTimeout(() => {
                            const player = this.playerData.find(p => p.playerId === rpcPart.exiled);
                            if (player) {
                                this.emitPlayerJoinGroup(player.name, RoomGroup.Spectator);
                                console.log("voted off: " + player.name);
                            }
                        }, 2500);
                    }
                } else if (rpcPart.rpcid === RpcID.MurderPlayer) {
                    const player = this.playerData.find(p => p.controlNetId === rpcPart.victimid);
                    if (player) this.emitPlayerJoinGroup(player.name, RoomGroup.Spectator);
                    console.log("murdered " + player.name);
                } else if (rpcPart.rpcid === RpcID.SetName) {
                    const player = this.playerData.find(p => p.controlNetId === rpcPart.netid);
                    if (player) {
                        player.name = rpcPart.name;
                    } else {
                        this.playerData.push({
                            name: rpcPart.name,
                            controlNetId: rpcPart.netid,
                            playerId: -1,
                            clientId: -1,
                            transformNetId: -1
                        });
                    }
                    console.log("set someone name to: " + rpcPart.name);
                } else if (rpcPart.rpcid === RpcID.SnapTo) {
                    const player = this.playerData.find(p => p.transformNetId === rpcPart.netid);
                    if (player) {
                        const pose = {
                            x: Lerp(rpcPart.position.x / 65535, -40, 40),
                            y: Lerp(rpcPart.position.y / 65535, -40, 40)
                        };
                        this.emitPlayerPose(player.name, pose);
                    }
                }
            };

            const handleSpawnMessage = (spawnPart: SpawnMessage) => {
                if (spawnPart.type === SpawnID.Player) {
                    const controlReader = spawnPart.components[0].data;
                    controlReader.bool();

                    const player = this.playerData.find(p => p.controlNetId === spawnPart.components[0].netid);
                    if (player) {
                        player.clientId = spawnPart.ownerid;
                        player.playerId = controlReader.uint8();
                        player.transformNetId = spawnPart.components[2].netid;
                    } else {
                        this.playerData.push({
                            name: "",
                            clientId: spawnPart.ownerid,
                            playerId: controlReader.uint8(),
                            controlNetId: spawnPart.components[0].netid,
                            transformNetId: spawnPart.components[2].netid,
                        });
                    }
                    console.log("player spawned in");
                } else if (spawnPart.type === SpawnID.ShipStatus ||
                            spawnPart.type === SpawnID.HeadQuarters ||
                            spawnPart.type === SpawnID.PlanetMap ||
                            spawnPart.type === SpawnID.AprilShipStatus) {
                    this.shipStatusNetId = spawnPart.components[0].netid;
                }
            };

            await this.client.connect(server[0], server[1]);
            await this.client.identify("auproxy");
            await this.client.join(this.backendModel.gameCode, false);

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

            room.on("spawn", function onSpawn(component) {
                if (component.classname === "GameData") {
                    gamedataSpawned = true;
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

    async initialSpawn(server: [string, number]): Promise<void> {
        this.playerData = [];
        this.shipStatusNetId = -1;

        const client = new SkeldjsClient(GAME_VERSION);
        try {
            await client.connect(server[0], server[1]);
            await client.identify("auproxy");
        } catch (e) {
            console.error("An error occurred", e);
            this.emitError("Couldn't connect to the Among Us servers, the server may be full, try again later!");
            return;
        }
        let room: Room;
        try {
            room = await client.join(this.backendModel.gameCode);
        } catch (e) {
            console.error("Couldn't join game", e);
            this.emitError("Couldn't join the game, make sure that the game hasn't started and there is a spot for the client!");
            return;
        }
        await this.awaitSpawns(room);
        this.currentMap = room.settings.map;
        this.emitMapChange(MapIdModel[MapID[room.settings.map]]);
        room.players.forEach(client => {
            if (client.data && client.data.name !== "") {
                this.playerData.push({
                    name: client.data.name,
                    clientId: client.id,
                    playerId: client.playerId,
                    controlNetId: client.control.netid,
                    transformNetId: client.transform.netid
                });
            }
        });
        if (room.host && room.host.data) {
            this.emitHostChange(room.host.data.name);
        }
        await client.disconnect();
    }

    async destroy(): Promise<void> {
        if (this.client && this.client.socket) {
            await this.client.disconnect();
            this.client = undefined;
        }
        console.log(`Destroyed PublicLobbyBackend for game: ${this.backendModel.gameCode}`);
    }
}

