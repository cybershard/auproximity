import {
    DisconnectID,
    MapID,
    MessageID,
    PacketID,
    PayloadID,
    RPCID
} from "./constants/Enums"

import { DisconnectMessages } from "./constants/DisconnectMessages"

import {
    Packet,
    GameOptionsData,
    DisconnectReason,
    GameDataMessage,
    ParsedPlayerGameData,
    MasterServer,
    GameListGame,
    ComponentData,
    PlayerDataFlags,
    Payload,
    GameListCount,
    GameListClientBoundTag,
    SceneChangeLocation
} from "./interfaces/Packets"

import { BufferReader } from "./util/BufferReader"
import { LerpValue } from "./util/Lerp";

export function parseGameOptions(reader: BufferReader): GameOptionsData {
    let options: Partial<GameOptionsData> = {}

    options.length = reader.packed();
    options.version = reader.byte() as 2|3|4;
    options.maxPlayers = reader.uint8();
    options.language = reader.uint32LE();
    options.mapID = reader.byte();
    options.playerSpeed = reader.floatLE();
    options.crewVision = reader.floatLE();
    options.imposterVision = reader.floatLE();
    options.killCooldown = reader.floatLE();
    options.commonTasks = reader.uint8();
    options.longTasks = reader.uint8();
    options.shortTasks = reader.uint8();
    options.emergencies = reader.int32LE();
    options.imposterCount = reader.uint8();
    options.killDistance = reader.byte();
    options.discussionTime = reader.int32LE();
    options.votingTime = reader.int32LE();
    options.isDefault = reader.bool();

    if ((options.version === 2 || options.version === 3 || options.version === 4) && reader.left >= 1) {
        options.emergencyCooldown = reader.uint8();
    }

    if ((options.version === 3 || options.version === 4 ) && reader.left >= 2) {
        options.confirmEjects = reader.bool();
        options.visualTasks = reader.bool();
    }

    if (options.version === 4 && reader.left >= 2) {
        options.anonymousVoting = reader.bool();
        options.taskBarUpdates = reader.uint8();
    }

    return options as GameOptionsData;
}

export function parseDisconnect(reader: BufferReader): DisconnectReason {
    let data: Partial<DisconnectReason> = {}

    if (reader.offset < reader.size) {
        data.reason = reader.uint8();

        if (data.reason === DisconnectID.Custom) {
            data.message = reader.string();
        } else {
            data.message = DisconnectMessages[data.reason];
        }
    }

    return data as DisconnectReason;
}

export function parsePlayerData(reader: BufferReader): ParsedPlayerGameData {
    let player: Partial<ParsedPlayerGameData> = {}
    player.playerId = reader.uint8();
    player.name = reader.string();
    player.colour = reader.uint8();
    player.hat = reader.packed();
    player.pet = reader.packed();
    player.skin = reader.packed();
    player.flags = reader.byte();
    player.disconnected = (player.flags & PlayerDataFlags.Disconnected) !== 0;
    player.imposter = (player.flags & PlayerDataFlags.IsImposter) !== 0;
    player.dead = (player.flags & PlayerDataFlags.IsDead) !== 0;
    player.num_tasks = reader.uint8();

    player.tasks = reader.list(reader => {
        const taskid = reader.packed();
        const completed = reader.bool();

        return {
            taskid,
            completed
        }
    }, player.num_tasks);

    return player as ParsedPlayerGameData;
}

export function parsePacket(buffer, bound: "server" | "client" = "client"): Packet {
    const reader = new BufferReader(buffer);

    let packet: Partial<Packet> = {}

    packet.op = reader.byte();
    packet.bound = bound;

    if (reader.size > 1) {
        switch (packet.op) {
            case PacketID.Unreliable:
            case PacketID.Reliable:
                packet.reliable = packet.op === PacketID.Reliable;

                if (packet.reliable) {
                    packet.nonce = reader.uint16BE();
                }

                packet.payloads = [];

                while (reader.offset < reader.size) {
                    const payload: Partial<Payload> = {}

                    const payload_len = reader.uint16LE();
                    payload.payloadid = reader.uint8();
                    const payload_start = reader.offset;
                    const payload_end = payload_start + payload_len;

                    payload.bound = packet.bound;

                    switch (payload.payloadid) {
                        case PayloadID.HostGame:
                            if (payload.bound === "client") {
                                payload.code = reader.int32LE();
                            } else if (payload.bound === "server") {
                                payload.options = parseGameOptions(reader);
                            }
                            break;
                        case PayloadID.JoinGame:
                            if (payload.bound === "client") {
                                payload.error = payload_len !== 12 && payload_len !== 18; // For players joining the game.

                                switch (payload.error) { // Couldn't get typings to work with if statements so I have to deal with switch/case..
                                    case true:
                                        const dc = parseDisconnect(reader);

                                        payload.reason = dc.reason;
                                        payload.message = dc.message;
                                        break;
                                    case false:
                                        payload.code = reader.int32LE();
                                        payload.clientid = reader.uint32LE();
                                        payload.hostid = reader.uint32LE();
                                        break;
                                }

                                if (payload.error) {
                                    const dc = parseDisconnect(reader);

                                    payload.reason = dc.reason;
                                    payload.message = dc.message;
                                }
                            } else if (payload.bound === "server") {
                                payload.code = reader.int32LE();
                                payload.mapOwnership = reader.byte();
                            }
                            break;
                        case PayloadID.StartGame:
                            payload.code = reader.int32LE();
                            break;
                        case PayloadID.RemoveGame:
                            break;
                        case PayloadID.RemovePlayer:
                            payload.code = reader.int32LE();
                            payload.clientid = reader.uint32LE();
                            payload.hostid = reader.uint32LE();
                            const dcreason = parseDisconnect(reader);
                            payload.reason = dcreason.reason;
                            payload.message = dcreason.message;
                            break;
                        case PayloadID.GameData:
                        case PayloadID.GameDataTo:
                            payload.code = reader.int32LE();

                            if (payload.payloadid === PayloadID.GameDataTo) {
                                payload.recipient = reader.packed();
                            }

                            payload.parts = [];

                            while (reader.offset < payload_end) {
                                let part: Partial<GameDataMessage> = {}
                                const part_len = reader.uint16LE();
                                part.type = reader.uint8();
                                const part_start = reader.offset;
                                const part_end = part_start + part_len;

                                switch (part.type) {
                                    case MessageID.Data:
                                        part.netid = reader.packed();
                                        part.datalen = part_end - reader.offset;
                                        part.data = reader.buffer.slice(reader.offset, part_end);
                                        break;
                                    case MessageID.RPC:
                                        part.handlerid = reader.packed();
                                        part.rpcid = reader.uint8();

                                        switch (part.rpcid) {
                                            case RPCID.PlayAnimation:
                                                part.animation = reader.byte();
                                                break;
                                            case RPCID.CompleteTask:
                                                part.taskid = reader.uint8();
                                                break;
                                            case RPCID.SyncSettings:
                                                part.options = parseGameOptions(reader);
                                                break;
                                            case RPCID.SetInfected:
                                                part.count = reader.packed();
                                                part.infected = reader.bytes(part.count);
                                                break;
                                            case RPCID.Exiled:
                                                break;
                                            case RPCID.CheckName:
                                                part.name = reader.string();
                                                break;
                                            case RPCID.SetName:
                                                part.name = reader.string();
                                                break;
                                            case RPCID.CheckColour:
                                                part.colour = reader.uint8();
                                                break;
                                            case RPCID.SetColour:
                                                part.colour = reader.uint8();
                                                break;
                                            case RPCID.SetHat:
                                                part.hat = reader.uint8();
                                                break;
                                            case RPCID.SetSkin:
                                                part.skin = reader.uint8();
                                                break;
                                            case RPCID.ReportDeadBody:
                                                part.bodyid = reader.uint8();
                                                break;
                                            case RPCID.MurderPlayer:
                                                part.targetnetid = reader.packed();
                                                break;
                                            case RPCID.SendChat:
                                                part.text = reader.string();
                                                break;
                                            case RPCID.StartMeeting:
                                                part.targetid = reader.uint8();
                                                break;
                                            case RPCID.SetScanner:
                                                part.scanning = reader.bool();
                                                part.count = reader.uint8();
                                                break;
                                            case RPCID.SendChatNote:
                                                part.playerid = reader.uint8();
                                                part.notetype = reader.uint8();
                                                break;
                                            case RPCID.SetPet:
                                                part.pet = reader.uint8();
                                                break;
                                            case RPCID.SetStartCounter:
                                                part.sequence = reader.packed();
                                                part.time = reader.int8();
                                                break;
                                            case RPCID.EnterVent:
                                                part.ventid = reader.packed();
                                                break;
                                            case RPCID.ExitVent:
                                                part.ventid = reader.packed();
                                                break;
                                            case RPCID.SnapTo:
                                                part.x = LerpValue(reader.uint16LE() / 65535, -40, 40);
                                                part.y = LerpValue(reader.uint16LE() / 65535, -40, 40);
                                                break;
                                            case RPCID.Close:
                                                break;
                                            case RPCID.VotingComplete:
                                                part.num_states = reader.packed();
                                                part.states = reader.bytes(part.num_states);
                                                part.exiled = reader.uint8();
                                                part.tie = reader.bool();
                                                break;
                                            case RPCID.CastVote:
                                                part.voterid = reader.uint8();
                                                part.suspectid = reader.uint8();
                                                break;
                                            case RPCID.ClearVote:
                                                break;
                                            case RPCID.AddVote:
                                                part.targetid = reader.uint8();
                                                break;
                                            case RPCID.CloseDoorsOfType:
                                                part.systemtype = reader.uint8();
                                                break;
                                            case RPCID.RepairSystem:
                                                part.systemtype = reader.uint8();
                                                part.handlerid = reader.packed();
                                                part.amount = reader.uint8();
                                                break;
                                            case RPCID.SetTasks:
                                                part.playerid = reader.uint8();
                                                part.num_tasks = reader.packed();
                                                part.tasks = reader.bytes(part.num_tasks);
                                                break;
                                            case RPCID.UpdateGameData:
                                                part.players = [];

                                                while (reader.offset < part_end) {
                                                    reader.jump(0x02); // Skip player data length.
                                                    part.players.push(parsePlayerData(reader));
                                                }
                                                break;
                                        }
                                        break;
                                    case MessageID.Spawn:
                                        part.spawnid = reader.packed();
                                        part.ownerid = reader.packed();
                                        part.flags = reader.byte();
                                        part.num_components = reader.packed();
                                        part.components = [];

                                        for (let i = 0; i < part.num_components; i++) {
                                            const component: Partial<ComponentData> = {}
                                            component.netid = reader.packed();
                                            component.datalen = reader.uint16LE();
                                            component.type = reader.uint8();

                                            component.data = reader.buffer.slice(reader.offset, reader.offset + component.datalen);

                                            reader.jump(component.datalen);

                                            part.components.push(component as ComponentData);
                                        }
                                        break;
                                    case MessageID.Despawn:
                                        part.netid = reader.packed();
                                        break;
                                    case MessageID.SceneChange:
                                        part.clientid = reader.packed();
                                        part.location = reader.string() as SceneChangeLocation;
                                        break;
                                    case MessageID.Ready:
                                        part.clientid = reader.packed();
                                        break;
                                    case MessageID.ChangeSettings:
                                        break;
                                }

                                reader.goto(part_end);
                                payload.parts.push(part as GameDataMessage);
                            }
                            break;
                        case PayloadID.JoinedGame:
                            payload.code = reader.int32LE();
                            payload.clientid = reader.uint32LE();
                            payload.hostid = reader.uint32LE();
                            payload.num_clients = reader.packed();
                            payload.clients = [];
                            for (let i = 0; i < payload.num_clients; i++) {
                                payload.clients.push(reader.packed());
                            }
                            break;
                        case PayloadID.EndGame:
                            payload.code = reader.int32LE();
                            payload.reason = reader.uint8();
                            payload.show_ad = reader.bool();
                            break;
                        case PayloadID.AlterGame:
                            payload.code = reader.int32LE();
                            payload.tag = reader.byte();
                            payload.is_public = reader.bool();
                            break;
                        case PayloadID.KickPlayer:
                            if (payload.bound === "client") {
                                payload.code = reader.int32LE();
                                payload.clientid = reader.packed();
                                payload.banned = reader.bool();
                            } else if (payload.bound === "server") {
                                payload.clientid = reader.packed();
                                payload.banned = reader.bool();
                            }
                            break;
                        case PayloadID.Redirect:
                            payload.ip = reader.bytes(0x04).join(".");
                            payload.port = reader.uint16LE();
                            break;
                        case PayloadID.MasterServerList:
                            reader.byte();
                            payload.num_servers = reader.uint8();
                            payload.servers = [];
                            for (let i = 0; i < payload.num_servers; i++) {
                                let server: Partial<MasterServer> = {}
                                reader.jump(0x02);
                                server.flag = reader.byte();
                                server.name = reader.string();
                                server.ip = reader.bytes(0x04).join(".");
                                server.port = reader.uint16LE();
                                server.num_players = reader.packed();

                                payload.servers.push(server as MasterServer);
                            }
                            break;
                        case PayloadID.GetGameListV2:
                            if (payload.bound === "client") {
                                const gamelist_len = reader.uint16LE();
                                payload.tag = reader.byte();
                                const gamelist_start = reader.offset;
                                const gamelist_end = gamelist_start + gamelist_len;

                                switch (payload.tag) {
                                    case GameListClientBoundTag.List:
                                        payload.games = [];

                                        while (reader.offset < gamelist_end) {
                                            let game: Partial<GameListGame> = {}
                                            reader.jump(0x02); // Skip length
                                            const tag = reader.uint8();

                                            game.ip = reader.bytes(4).join(".");
                                            game.port = reader.uint16LE();
                                            game.code = reader.int32LE();
                                            game.name = reader.string();
                                            game.num_players = reader.uint8();
                                            game.age = reader.packed();
                                            game.map = reader.uint8();
                                            game.imposters = reader.uint8();
                                            game.max_players = reader.uint8();

                                            payload.games.push(game as GameListGame);
                                            break;
                                        }
                                        break;
                                    case GameListClientBoundTag.Count:
                                        const count: Partial<GameListCount> = {}

                                        count[MapID.TheSkeld] = reader.uint32LE();
                                        count[MapID.MiraHQ] = reader.uint32LE();
                                        count[MapID.Polus] = reader.uint32LE();

                                        payload.count = count as GameListCount;
                                        break;
                                }
                            } else if (payload.bound === "server") {
                                reader.byte();
                                payload.options = parseGameOptions(reader);
                            }
                            break;
                    }

                    packet.payloads.push(payload as Payload);
                    break;
                }
                break;
            case PacketID.Hello:
                packet.reliable = true;
                packet.nonce = reader.uint16BE();
                packet.hazelver = reader.byte();
                packet.clientver = reader.int32LE();
                packet.username = reader.string();
                break;
            case PacketID.Disconnect:
                if (packet.bound === "client") {
                    reader.jump(0x04); // Skip unnecessary bytes.
                    const dc = parseDisconnect(reader);

                    packet.reason = dc.reason;
                    packet.message = dc.message;
                }
                break;
            case PacketID.Acknowledge:
                packet.nonce = reader.uint16BE();
                break;
            case PacketID.Ping:
                packet.reliable = true;
                packet.nonce = reader.uint16BE();
                break;
        }
    }

    return packet as Packet;
}
