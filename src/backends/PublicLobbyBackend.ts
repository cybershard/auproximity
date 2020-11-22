import {BackendAdapter, BackendEvent, PublicLobbyBackendModel, PublicLobbyRegion, RoomGroup} from "../types/Backend";
import {
    AmongusClient, BufferReader,
    DebugOptions, LerpValue,
    MasterServers,
    MessageID,
    PacketID,
    PayloadID,
    RPCID,
    SpawnID
} from "../../amongus-protocol/ts";
import * as _ from "lodash";
import {
    GameDataMessage,
    GameDataPayload,
    GameDataToPayload,
    Payload, PlayerSpawn,
    RPCMessage,
    SpawnMessage
} from "../../amongus-protocol/ts/lib/interfaces/Packets";

import util from "util"

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
    client: AmongusClient;

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

            this.client = new AmongusClient({
                debug: DebugOptions.None
            });

            let servers;
            if (this.backendModel.region === PublicLobbyRegion.NorthAmerica) {
                servers = MasterServers.NA[0];
            } else if (this.backendModel.region === PublicLobbyRegion.Europe) {
                servers = MasterServers.EU[0];
            } else if (this.backendModel.region === PublicLobbyRegion.Asia) {
                servers = MasterServers.AS[0];
            }

            console.log(servers[0], servers[1], this.backendModel.gameCode);
            await this.client.connect(servers[0], servers[1], "auprox");
            const game = await this.client.join(this.backendModel.gameCode, {
                doSpawn: true
            });
            console.log("awaiting spawn before");
            await game.awaitSpawns();
            console.log("awaited spawn");
            game.clients.forEach(client => this.playerData.push({
                name: client.name,
                clientId: client.id,
                playerId: client.Player.PlayerControl.playerId,
                controlNetId: client.Player.PlayerControl.netid,
                transformNetId: client.Player.CustomNetworkTransform.netid
            }));
            await this.client.disconnect();
            console.log("disconnected with data: ", this.playerData);

            // restart new client
            this.client = new AmongusClient({
                debug: DebugOptions.Everything
            });
            this.client.on("packet", packet => {
                // console.log(util.inspect(packet, false, 10, true));
                if (packet.op === PacketID.Reliable || packet.op === PacketID.Unreliable) {
                    packet.payloads.forEach(async payload => await handlePayload(payload));
                }
            });

            const handlePayload = async (payload: Payload) => {
                if (payload.payloadid === PayloadID.StartGame) {
                    this.emitAllPlayerJoinGroups(RoomGroup.Main);
                    console.log("started game");
                } else if (payload.payloadid === PayloadID.EndGame) {
                    this.emitAllPlayerJoinGroups(RoomGroup.Spectator);
                    await this.client.join(this.backendModel.gameCode, {
                        doSpawn: false
                    });
                    console.log("ended game");
                } else if (payload.payloadid === PayloadID.RemovePlayer) {
                    this.playerData = this.playerData.filter(p => p.clientId !== payload.clientid);
                    // Handler for if the game sets us to host. Might be a hacky way.
                    if (payload.clientid === this.client.clientid) {
                        await this.client.disconnect();
                        await this.client.connect(servers[0], servers[1], "auproximity");
                        await this.client.join(this.backendModel.gameCode, {
                            doSpawn: false
                        });
                    }
                    console.log("removed player");
                } else if (payload.payloadid === PayloadID.GameData || payload.payloadid === PayloadID.GameDataTo) {
                    (payload as (GameDataPayload | GameDataToPayload)).parts.forEach(part => {
                        handleGameDataPart(part);
                    });
                }
            };

            const handleGameDataPart = (part: GameDataMessage) => {
                if (part.type == MessageID.Data) {
                    const player = this.playerData.find(p => p.transformNetId === part.netid);
                    if (player) {
                        const reader = new BufferReader(part.data);
                        reader.uint16LE();
                        const pose = {
                            x: LerpValue(reader.uint16LE() / 65535, -40, 40),
                            y: LerpValue(reader.uint16LE() / 65535, -40, 40)
                        };
                        this.emitPlayerPose(player.name, pose);
                        console.log("someone moved to pos: ", pose);
                    }
                } else if (part.type == MessageID.RPC) {
                    console.log("handling rpc", part);
                    handleRPC(part as RPCMessage);
                } else if (part.type == MessageID.Spawn) {
                    console.log("handling spawn", part);
                    handleSpawnMessage(part as SpawnMessage);
                }
            };

            const handleRPC = (rpcPart: RPCMessage) => {
                if (rpcPart.rpcid === RPCID.StartMeeting) {
                    this.emitAllPlayerPoses({ x: 0, y: 0 });
                    console.log("meeting started");
                } else if (rpcPart.rpcid === RPCID.VotingComplete) {
                    if (rpcPart.exiled !== 0xff) {
                        const player = this.playerData.find(p => p.playerId === rpcPart.exiled);
                        if (player) this.emitPlayerJoinGroup(player.name, RoomGroup.Spectator);
                        console.log("voted off: " + player.name);
                    }
                } else if (rpcPart.rpcid === RPCID.MurderPlayer) {
                    const player = this.playerData.find(p => p.controlNetId === rpcPart.targetnetid);
                    if (player) this.emitPlayerJoinGroup(player.name, RoomGroup.Spectator);
                    console.log("murdered " + player.name);
                } else if (rpcPart.rpcid === RPCID.SetName) {
                    const player = this.playerData.find(p => p.controlNetId === rpcPart.handlerid);
                    if (player) {
                        player.name = rpcPart.name;
                    } else {
                        this.playerData.push({
                            name: rpcPart.name,
                            controlNetId: rpcPart.handlerid,
                            playerId: -1,
                            clientId: -1,
                            transformNetId: -1
                        });
                    }
                    console.log("set someone name to: " + rpcPart.name);
                }
            };

            const handleSpawnMessage = (spawnPart: SpawnMessage) => {
                if (spawnPart.spawnid === SpawnID.Player) {
                    const playerSpawn: PlayerSpawn = spawnPart as PlayerSpawn;
                    const controlReader = new BufferReader(playerSpawn.components[0].data);
                    controlReader.bool();

                    const player = this.playerData.find(p => p.controlNetId === playerSpawn.components[0].netid);
                    if (player) {
                        player.clientId = playerSpawn.ownerid;
                        player.playerId = controlReader.uint8();
                        player.transformNetId = playerSpawn.components[2].netid;
                    } else {
                        this.playerData.push({
                            name: "",
                            clientId: playerSpawn.ownerid,
                            playerId: controlReader.uint8(),
                            controlNetId: playerSpawn.components[0].netid,
                            transformNetId: playerSpawn.components[2].netid,
                        });
                    }
                    console.log("player spawned in");
                }
            };

            await this.client.connect(servers[0], servers[1], "auprox");
            await this.client.join(this.backendModel.gameCode, {
                doSpawn: false
            });

            console.log(`Initialized PublicLobby Backend for game: ${this.backendModel.gameCode}`);
        } catch (err) {
            console.warn("Error in PublicLobbyBackend, disposing room: " + err);
            this.emit(BackendEvent.Error);
        }
    }
    async destroy(): Promise<void> {
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
        }
        console.log(`Destroyed PublicLobbyBackend for game: ${this.backendModel.gameCode}`);
    }
}

