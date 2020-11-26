import {
    DisconnectID,
    DistanceID,
    LanguageID,
    MapID,
    MessageID,
    PacketID,
    PayloadID,
    RPCID,
    TaskBarUpdate
} from "./constants/Enums";

import {
    GameListClientBoundTag,
    GameOptionsData,
    Packet
} from "./interfaces/Packets";

import { BufferWriter } from "./util/BufferWriter";
import { UnlerpValue } from "./util/Lerp";

export function composeGameOptions(options: Partial<GameOptionsData>) {
    options.version = options.version ?? 3;

    const writer = new BufferWriter;

    const bwrite = new BufferWriter;
    bwrite.byte(options.version);
    bwrite.uint8(options.maxPlayers ?? 10);
    bwrite.uint32LE(options.language ?? LanguageID.English);
    bwrite.byte(options.mapID ?? MapID.TheSkeld);
    bwrite.floatLE(options.playerSpeed ?? 1.0);
    bwrite.floatLE(options.crewVision ?? 1.0);
    bwrite.floatLE(options.imposterVision ?? 1.25);
    bwrite.floatLE(options.killCooldown ?? 25);
    bwrite.uint8(options.commonTasks ?? 1);
    bwrite.uint8(options.longTasks ?? 1);
    bwrite.uint8(options.shortTasks ?? 2);
    bwrite.int32LE(options.emergencies ?? 1);
    bwrite.uint8(options.imposterCount ?? 2);
    bwrite.byte(options.killDistance ?? DistanceID.Medium);
    bwrite.int32LE(options.discussionTime ?? 15);
    bwrite.int32LE(options.votingTime ?? 120);
    bwrite.bool(options.isDefault ?? false);

    if (options.version === 2 || options.version === 3 || options.version === 4) {
        bwrite.uint8(options.emergencyCooldown ?? 15);
    }

    if (options.version === 3 || options.version === 4) {
        bwrite.bool(options.confirmEjects ?? true);
        bwrite.bool(options.visualTasks ?? true);
    }

    if (options.version === 4) {
        bwrite.bool(options.anonymousVoting ?? false);
        bwrite.uint8(options.taskBarUpdates ?? TaskBarUpdate.Always);
    }

    writer.packed(bwrite.size);
    writer.write(bwrite);

    return writer;
}

export function composePacket(packet: Packet, bound: "server"|"client" = "server"): Buffer {
    packet.bound = bound;

    const writer = new BufferWriter;

    writer.uint8(packet.op);

    if (packet.op === PacketID.Reliable) {
        packet.reliable = true;
    }

    if (packet.op === PacketID.Unreliable) {
        packet.reliable = false;
    }

    switch (packet.op) {
        case PacketID.Unreliable:
        case PacketID.Reliable:
            if (packet.op === PacketID.Reliable) {
                writer.uint16BE(packet.nonce);
            }

            for (let i = 0; i < packet.payloads.length; i++) {
                const payload = packet.payloads[i];
                payload.bound = packet.bound;

                const lenpos = writer.offset;
                writer.jump(0x02); // Jump the length of the payload (will be written later).

                writer.uint8(payload.payloadid);

                switch (payload.payloadid) {
                    case PayloadID.HostGame:
                        if (payload.bound === "server") {
                            writer.write(composeGameOptions(payload.options));
                        } else if (payload.bound === "client") {
                            writer.int32LE(payload.code);
                        }
                        break;
                    case PayloadID.JoinGame:
                        if (payload.bound === "server") {
                            writer.int32LE(payload.code);
                            writer.byte(payload.mapOwnership);
                        } else if (payload.bound === "client") {
                            switch (payload.error) { // Typings don't work for if statements for some reason??
                                case true:
                                    if (payload.reason) {
                                        writer.uint8(payload.reason);
                                        if (payload.reason === DisconnectID.Custom) {
                                            writer.string(payload.message, true);
                                        }
                                    }
                                    break;
                                case false:
                                    writer.int32LE(payload.code);
                                    writer.int32LE(payload.clientid);
                                    writer.int32LE(payload.hostid);
                                    break;
                            }
                        }
                        break;
                    case PayloadID.StartGame:
                        writer.int32LE(payload.code);
                        break;
                    case PayloadID.RemoveGame:
                        break;
                    case PayloadID.RemovePlayer:
                        writer.int32LE(payload.code);
                        writer.uint32LE(payload.clientid);
                        writer.uint32LE(payload.hostid);
                        if (typeof payload.reason !== "undefined") {
                            writer.uint8(payload.reason);

                            if (payload.reason === DisconnectID.Custom) {
                                writer.string(payload.message, true);
                            }
                        }
                        break;
                    case PayloadID.GameData:
                    case PayloadID.GameDataTo:
                        writer.int32LE(payload.code);

                        if (payload.payloadid === PayloadID.GameDataTo) {
                            writer.packed(payload.recipient);
                        }

                        for (let i = 0; i < payload.parts.length; i++) {
                            const mwrite = new BufferWriter;
                            const part = payload.parts[i];

                            switch (part.type) {
                                case MessageID.Data:
                                    mwrite.packed(part.netid);
                                    mwrite.write(part.data);
                                    break;
                                case MessageID.RPC:
                                    mwrite.packed(part.handlerid);
                                    mwrite.uint8(part.rpcid);

                                    switch (part.rpcid) {
                                        case RPCID.PlayAnimation:
                                            mwrite.uint8(part.animation);
                                            break;
                                        case RPCID.CompleteTask:
                                            mwrite.uint8(part.taskid);
                                            break;
                                        case RPCID.SyncSettings:
                                            writer.write(composeGameOptions(part.options));
                                            break;
                                        case RPCID.SetInfected:
                                            mwrite.packed(part.count);
                                            mwrite.bytes(part.infected);
                                            break;
                                        case RPCID.Exiled:
                                            break;
                                        case RPCID.CheckName:
                                            mwrite.string(part.name, true);
                                            break;
                                        case RPCID.SetName:
                                            mwrite.string(part.name, true);
                                            break;
                                        case RPCID.CheckColour:
                                            mwrite.uint8(part.colour);
                                            break;
                                        case RPCID.SetColour:
                                            mwrite.uint8(part.colour);
                                            break;
                                        case RPCID.SetHat:
                                            mwrite.uint8(part.hat);
                                            break;
                                        case RPCID.SetSkin:
                                            mwrite.uint8(part.skin);
                                            break;
                                        case RPCID.ReportDeadBody:
                                            mwrite.uint8(part.bodyid);
                                            break;
                                        case RPCID.MurderPlayer:
                                            mwrite.packed(part.targetnetid);
                                            break;
                                        case RPCID.SendChat:
                                            mwrite.string(part.text, true);
                                            break;
                                        case RPCID.StartMeeting:
                                            mwrite.uint8(part.targetid);
                                            break;
                                        case RPCID.SetScanner:
                                            mwrite.bool(part.scanning);
                                            mwrite.uint8(part.count);
                                            break;
                                        case RPCID.SendChatNote:
                                            mwrite.uint8(part.playerid);
                                            mwrite.uint8(part.notetype);
                                            break;
                                        case RPCID.SetPet:
                                            mwrite.uint8(part.pet);
                                            break;
                                        case RPCID.SetStartCounter:
                                            mwrite.packed(part.sequence);
                                            mwrite.int8(part.time);
                                            break;
                                        case RPCID.EnterVent:
                                            mwrite.packed(part.ventid);
                                            break;
                                        case RPCID.ExitVent:
                                            mwrite.packed(part.ventid);
                                            break;
                                        case RPCID.SnapTo:
                                            mwrite.uint16LE(UnlerpValue(part.x, -40, 40) * 65535);
                                            mwrite.uint16LE(UnlerpValue(part.y, -40, 40) * 65535);
                                            break;
                                        case RPCID.Close:
                                            break;
                                        case RPCID.VotingComplete:
                                            mwrite.packed(part.num_states);
                                            mwrite.bytes(part.states);
                                            mwrite.uint8(part.exiled);
                                            mwrite.bool(part.tie);
                                            break;
                                        case RPCID.CastVote:
                                            mwrite.uint8(part.voterid);
                                            mwrite.uint8(part.suspectid);
                                            break;
                                        case RPCID.ClearVote:
                                            break;
                                        case RPCID.AddVote:
                                            mwrite.uint8(part.targetid);
                                            break;
                                        case RPCID.CloseDoorsOfType:
                                            mwrite.uint8(part.systemtype);
                                            break;
                                        case RPCID.RepairSystem:
                                            mwrite.uint8(part.systemtype);
                                            mwrite.packed(part.handlerid);
                                            mwrite.uint8(part.amount);
                                            break;
                                        case RPCID.SetTasks:
                                            mwrite.uint8(part.playerid);
                                            mwrite.packed(part.num_tasks);
                                            mwrite.bytes(part.tasks);
                                            break;
                                        case RPCID.UpdateGameData:
                                            for (let i = 0; i < part.players.length; i++) {
                                                const player = part.players[i];

                                                const pwrite = new BufferWriter;
                                                pwrite.uint8(player.playerId);
                                                pwrite.string(player.name, true);
                                                pwrite.uint8(player.colour);
                                                pwrite.packed(player.hat);
                                                pwrite.packed(player.pet);
                                                pwrite.packed(player.skin);
                                                pwrite.byte(player.flags);
                                                pwrite.uint8(player.num_tasks);

                                                for (let i = 0; i < player.num_tasks; i++) {
                                                    const task = player.tasks[i];

                                                    pwrite.packed(task.taskid);
                                                    pwrite.bool(task.completed);
                                                }

                                                mwrite.uint16LE(pwrite.size - 1);
                                                mwrite.write(pwrite);
                                            }
                                            break;
                                    }
                                    break;
                                case MessageID.Spawn: // WIP
                                    mwrite.packed(part.spawnid);
                                    mwrite.packed(part.ownerid);
                                    mwrite.byte(part.flags);
                                    mwrite.packed(part.num_components);

                                    for (let i = 0; i < part.num_components; i++) {
                                        const component = part.components[i];

                                        mwrite.packed(component.netid);
                                        mwrite.uint16LE(component.datalen);
                                        mwrite.uint8(component.type);
                                        mwrite.write(component.data);
                                    }
                                    break;
                                case MessageID.Despawn:
                                    mwrite.packed(part.netid);
                                    break;
                                case MessageID.SceneChange:
                                    mwrite.packed(part.clientid);
                                    mwrite.string(part.location, true);
                                    break;
                                case MessageID.Ready:
                                    mwrite.packed(part.clientid);
                                    break;
                                case MessageID.ChangeSettings:
                                    break;
                            }

                            writer.uint16LE(mwrite.size);
                            writer.uint8(part.type);
                            writer.write(mwrite);
                        }
                        break;
                    case PayloadID.JoinedGame:
                        writer.int32LE(payload.code);
                        writer.uint32LE(payload.clientid);
                        writer.uint32LE(payload.hostid);
                        writer.packed(payload.num_clients);
                        for (let i = 0; i < payload.num_clients; i++) {
                            writer.packed(payload.clients[i]);
                        }
                        break;
                    case PayloadID.EndGame:
                        writer.int32LE(payload.code);
                        writer.uint8(payload.reason);
                        writer.bool(payload.show_ad);
                        break;
                    case PayloadID.AlterGame:
                        writer.int32LE(payload.code);
                        writer.byte(payload.tag);
                        writer.bool(payload.is_public);
                        break;
                    case PayloadID.KickPlayer:
                        if (payload.bound === "client") {
                            writer.int32LE(payload.code);
                            writer.packed(payload.clientid);
                            writer.bool(payload.banned);
                        } else if (payload.bound === "server") {
                            writer.packed(payload.clientid);
                            writer.bool(payload.banned);
                        }
                        break;
                    case PayloadID.Redirect:
                        writer.bytes(payload.ip.split(".").map(val => parseInt(val)));
                        writer.uint16LE(payload.port);
                        break;
                    case PayloadID.MasterServerList:
                        writer.uint8(0x01);
                        writer.uint8(payload.num_servers);

                        for (let i = 0; i < payload.servers.length; i++) {
                            const server = payload.servers[i];
                            const swrite = new BufferWriter;
                            swrite.byte(server.flag);
                            swrite.string(server.name, true);
                            swrite.bytes(server.ip.split(".").map(val => parseInt(val)));
                            swrite.uint16LE(server.port);
                            swrite.uint16LE(server.num_players);

                            writer.uint16LE(swrite.size);
                            writer.write(swrite);
                        }
                        break;
                    case PayloadID.GetGameListV2:
                        if (payload.bound === "client") {
                            switch (payload.tag) {
                                case GameListClientBoundTag.List:
                                    const list_writer = new BufferWriter;

                                    for (let i = 0; i < payload.games.length; i++) {
                                        const game = payload.games[i];

                                        const game_writer = new BufferWriter;
                                        game_writer.bytes(game.ip.split(".").map(val => parseInt(val)));
                                        game_writer.uint16LE(game.port);
                                        game_writer.int32LE(game.code);
                                        game_writer.string(game.name, true);
                                        game_writer.uint8(game.num_players);
                                        game_writer.packed(game.age);
                                        game_writer.uint8(game.map);
                                        game_writer.uint8(game.imposters);
                                        game_writer.uint8(game.max_players);

                                        list_writer.uint16LE(game_writer.size);
                                        list_writer.uint8(0x00);
                                        list_writer.write(game_writer);
                                    }

                                    writer.uint16LE(list_writer.size);
                                    writer.uint8(0x00);
                                    writer.write(list_writer);
                                    break;
                                case GameListClientBoundTag.Count:
                                    writer.uint16LE(0x012);
                                    writer.uint8(0x01);
                                    writer.uint32LE(payload.count[MapID.TheSkeld]);
                                    writer.uint32LE(payload.count[MapID.MiraHQ]);
                                    writer.uint32LE(payload.count[MapID.Polus]);
                                    break;
                            }
                        } else if (payload.bound === "server") {
                            writer.uint8(0x00);
                            writer.write(composeGameOptions(payload.options));
                        }
                        break;
                }

                writer.goto(lenpos);
                writer.uint16LE(writer.buffer.slice(lenpos + 3).byteLength); // Length of the payload (not including the type).
            }
            break;
        case PacketID.Hello:
            writer.uint16BE(packet.nonce);
            writer.byte(packet.hazelver || 0x00);
            writer.int32BE(packet.clientver || 0x4ae20203);
            writer.string(packet.username, true);
            break;
        case PacketID.Disconnect:
            if (packet.bound === "client") {
                const dwrite = new BufferWriter;

                if (typeof packet.reason !== "undefined") {
                    dwrite.uint8(packet.reason);
                    if (packet.reason === DisconnectID.Custom && packet.message) {
                        dwrite.string(packet.message, true);
                    }
                }

                writer.uint8(0x01);
                writer.uint16LE(dwrite.size);
                writer.uint8(0x00);
                writer.write(dwrite);
            }
            break;
        case PacketID.Acknowledge:
            writer.uint16BE(packet.nonce);
            writer.uint8(0xFF);
            break;
        case PacketID.Ping:
            writer.uint16BE(packet.nonce);
            break;
    }

    return writer.buffer;
}
