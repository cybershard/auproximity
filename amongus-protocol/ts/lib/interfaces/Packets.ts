import {
    DisconnectID,
    PacketID,
    RPCID,
    ColourID,
    HatID,
    SkinID,
    PetID,
    SystemType,
    TaskID,
    DataID,
    SpawnID,
    MessageID,
    GameEndReason,
    AlterGameTag,
    PayloadID,
    DistanceID,
    TaskBarUpdate,
    MapID,
    LanguageID,
    SpawnFlag
} from "../constants/Enums"

import {
    bit,
    byte,
    bitfield,
    uint8,
    int8,
    uint16,
    int16,
    uint32,
    int32,
    float,
    double,
    packed,
    code,
    float16,
    vector
} from "./Types"

export interface BaseGameOptionsData {
    length: packed;
    /**
     * The version of the options.
     */
    version: byte;
    /**
     * The maximum number of players in the game.
     */
    maxPlayers: uint8;
    /**
     * The language of the game.
     */
    language: LanguageID;
    /**
     * The map ID of the game.
     */
    mapID: MapID;
    /**
     * The speed multiplier for the players.
     */
    playerSpeed: float;
    /**
     * The vision multiplier for the crewmates.
     */
    crewVision: float;
    /**
     * The vision multiplier for the imposters.
     */
    imposterVision: float;
    /**
     * The required amount of time to wait between each kill.
     */
    killCooldown: float;
    /**
     * The number of common tasks.
     */
    commonTasks: uint8;
    /**
     * The number of long tasks.
     */
    longTasks: uint8;
    /**
     * The number of short tasks.
     */
    shortTasks: uint8;
    /**
     * The number of emergencies allowed for each player.
     */
    emergencies: int32;
    /**
     * The number of imposters.
     */
    imposterCount: uint8;
    /**
     * The maximum distance required to kill a player.
     */
    killDistance: DistanceID;
    /**
     * The number of seconds to discuss before voting.
     */
    discussionTime: int32;
    /**
     * The number of seconds allowed to vote.
     */
    votingTime: int32;
    /**
     * Whether or not these settings are default.
     */
    isDefault: boolean;
}

export interface GameOptionsDataV2 extends BaseGameOptionsData {
    version: 2;
    /**
     * The cooldown between each emergency call.
     */
    emergencyCooldown: uint8;
}

export interface GameOptionsDataV3 extends Omit<GameOptionsDataV2, "version"> {
    version: 3;
    /**
     * Whether or not the game tells you if you ejected the imposter.
     */
    confirmEjects: boolean;
    /**
     * Whether or not certain tasks have a visual indicator to show that they are being done.
     */
    visualTasks: boolean;
}

export interface GameOptionsDataV4 extends Omit<GameOptionsDataV3, "version"> {
    version: 4;
    /**
     * Whether or not votes are tallied completely anonymously.
     */
    anonymousVoting: boolean;
    /**
     * When the task bar should update.
     */
    taskBarUpdates: TaskBarUpdate;
}

export type GameOptionsData = GameOptionsDataV2 | GameOptionsDataV3 | GameOptionsDataV4;

export interface BasePacket {
    bound?: "server" | "client";
}

export interface Reliable extends BasePacket {
    reliable?: true;
    nonce?: uint16;
}

export interface Unreliable extends BasePacket {
    reliable?: false;
}

export interface HelloPacket extends Reliable {
    op: PacketID.Hello;
    hazelver?: number;
    clientver?: number;
    username: string;
}

export interface DisconnectReason {
    reason?: DisconnectID;
    message?: string;
}

export interface DisconnectPacketClientBound extends DisconnectReason, Unreliable {
    bound?: "client",
    op: PacketID.Disconnect;
}

export interface DisconnectPacketServerBound extends Unreliable {
    bound?: "server",
    op: PacketID.Disconnect;
}

export type DisconnectPacket = DisconnectPacketClientBound | DisconnectPacketServerBound;

export interface AcknowledegePacket extends Unreliable {
    op: PacketID.Acknowledge;
    nonce: uint16;
}

export interface PingPacket extends Reliable {
    op: PacketID.Ping;
}

export interface HostGamePayloadServerBound extends BasePayload {
    payloadid: PayloadID.HostGame;
    bound?: "server";
    options: Partial<GameOptionsData>;
}

export interface HostGamePayloadClientBound extends BasePayload {
    payloadid: PayloadID.HostGame;
    bound?: "client";
    code: code;
}

export type HostGamePayload = HostGamePayloadServerBound | HostGamePayloadClientBound;

export interface JoinGamePayloadServerBound extends BasePayload {
    bound?: "server";
    payloadid: PayloadID.JoinGame;
    code: code;
    mapOwnership: bitfield;
}


export interface JoinGamePayloadClientBoundError extends DisconnectReason, BasePayload {
    bound?: "client";
    error: true;
    payloadid: PayloadID.JoinGame;
}

export interface JoinGamePayloadClientBoundPlayer extends BasePayload {
    bound?: "client";
    error: false;
    code: int32;
    clientid: uint32;
    hostid: uint32;
    payloadid: PayloadID.JoinGame;
}

export type JoinGamePayloadClientBound = JoinGamePayloadClientBoundError
    | JoinGamePayloadClientBoundPlayer;

export type JoinGamePayload = JoinGamePayloadServerBound | JoinGamePayloadClientBound;

export interface StartGamePayload extends BasePayload {
    payloadid: PayloadID.StartGame;
    code: code;
}

export interface RemoveGamePayload extends BasePayload {
    payloadid: PayloadID.RemoveGame;
}

export interface RemovePlayerPayload extends DisconnectReason, BasePayload {
    payloadid: PayloadID.RemovePlayer;
    code: int32;
    clientid: uint32;
    hostid: uint32;
}

export interface Message {
    type: MessageID;
}

export interface DataMessage extends Message {
    type: MessageID.Data;
    datatype: DataID;
    netid: packed;
    datalen: uint16;
    data: Buffer;
}

export interface RPC extends Message {
    type: MessageID.RPC;
    handlerid: packed;
    rpcid: uint8;
}

export interface RPCPlayAnimation extends RPC {
    rpcid: RPCID.PlayAnimation;
    animation: uint8;
}

export interface RPCCompleteTask extends RPC {
    rpcid: RPCID.CompleteTask;
    taskid: uint8;
}

export interface RPCSyncSettings extends RPC {
    rpcid: RPCID.SyncSettings;
    options: GameOptionsData;
}

export interface RPCSetInfected extends RPC {
    rpcid: RPCID.SetInfected;
    count: packed;
    infected: byte[];
}

export interface RPCExiled extends RPC {
    rpcid: RPCID.Exiled;
}

export interface RPCCheckName extends RPC {
    rpcid: RPCID.CheckName;
    name: string;
}

export interface RPCSetName extends RPC {
    rpcid: RPCID.SetName;
    name: string;
}

export interface RPCCheckColour extends RPC {
    rpcid: RPCID.CheckColour;
    colour: ColourID;
}

export interface RPCSetColour extends RPC {
    rpcid: RPCID.SetColour;
    colour: ColourID;
}

export interface RPCSetHat extends RPC {
    rpcid: RPCID.SetHat;
    hat: HatID;
}

export interface RPCSetSkin extends RPC {
    rpcid: RPCID.SetSkin;
    skin: SkinID;
}

export interface RPCReportDeadBody extends RPC {
    rpcid: RPCID.ReportDeadBody;
    bodyid: uint8 | 0xff;
}

export interface RPCMurderPlayer extends RPC {
    rpcid: RPCID.MurderPlayer;
    targetnetid: packed;
}

export interface RPCSendChat extends RPC {
    rpcid: RPCID.SendChat;
    text: string;
}

export interface RPCStartMeeting extends RPC {
    rpcid: RPCID.StartMeeting;
    targetid: uint8;
}

export interface RPCSetScanner extends RPC {
    rpcid: RPCID.SetScanner;
    scanning: boolean;
    count: uint8;
}

export interface RPCSendChatNote extends RPC {
    rpcid: RPCID.SendChatNote;
    playerid: uint8;
    notetype: uint8;
}

export interface RPCSetPet extends RPC {
    rpcid: RPCID.SetPet;
    pet: PetID;
}

export interface RPCSetStartCounter extends RPC {
    rpcid: RPCID.SetStartCounter;
    sequence: packed;
    time: int8;
}

export interface RPCEnterVent extends RPC {
    rpcid: RPCID.EnterVent;
    sequence: packed;
    ventid: packed;
}

export interface RPCExitVent extends RPC {
    rpcid: RPCID.ExitVent;
    ventid: packed;
}

export interface RPCSnapTo extends RPC {
    rpcid: RPCID.SnapTo;
    x: float;
    y: float;
}

export interface RPCClose extends RPC {
    rpcid: RPCID.Close;
}

export interface RPCVotingComplete extends RPC {
    rpcid: RPCID.VotingComplete;
    num_states: uint32;
    states: byte[];
    exiled: uint8;
    tie: boolean;
}

export interface RPCCastVote extends RPC {
    rpcid: RPCID.CastVote;
    voterid: uint8;
    suspectid: uint8;
}

export interface RPCClearVote extends RPC {
    rpcid: RPCID.ClearVote;
}

export interface RPCAddVote extends RPC {
    rpcid: RPCID.AddVote;
    targetid: uint8;
}

export interface RPCCloseDoorsOfType extends RPC {
    rpcid: RPCID.CloseDoorsOfType;
    systemtype: SystemType;
}

export interface RPCRepairSystem extends RPC {
    rpcid: RPCID.RepairSystem;
    systemtype: SystemType;
    handlerid: packed;
    amount: uint8;
}

export interface RPCSetTasks extends RPC {
    rpcid: RPCID.SetTasks;
    playerid: uint8;
    num_tasks: uint8;
    tasks: uint8[];
}

export interface PlayerTaskState {
    taskid: TaskID;
    completed: boolean;
}

export enum PlayerDataFlags {
    Disconnected = 1 << 0,
    IsImposter = 1 << 1,
    IsDead = 1 << 2
}

export interface ParsedPlayerGameData {
    playerId: uint8;
    name: string;
    colour: ColourID;
    hat: HatID;
    pet: PetID;
    skin: SkinID;
    flags: bitfield;
    disconnected: boolean;
    imposter: boolean;
    dead: boolean;
    num_tasks: uint8;
    tasks: PlayerTaskState[];
}

export interface RPCUpdateGameData extends RPC {
    rpcid: RPCID.UpdateGameData;
    players: ParsedPlayerGameData[];
}

export type RPCMessage = RPCPlayAnimation
    | RPCCompleteTask
    | RPCSyncSettings
    | RPCSetInfected
    | RPCExiled
    | RPCCheckName
    | RPCSetName
    | RPCCheckColour
    | RPCSetColour
    | RPCSetHat
    | RPCSetSkin
    | RPCReportDeadBody
    | RPCMurderPlayer
    | RPCSendChat
    | RPCStartMeeting
    | RPCSetScanner
    | RPCSendChatNote
    | RPCSetPet
    | RPCSetStartCounter
    | RPCEnterVent
    | RPCExitVent
    | RPCSnapTo
    | RPCClose
    | RPCVotingComplete
    | RPCCastVote
    | RPCClearVote
    | RPCAddVote
    | RPCCloseDoorsOfType
    | RPCRepairSystem
    | RPCSetTasks
    | RPCUpdateGameData;

export enum PlayerVoteAreaFlags {
    VotedFor = 0x0f,
    DidReport = 0x20,
    DidVote = 0x40,
    IsDead = 0x80
}

export interface VotePlayerState {
    flags: PlayerVoteAreaFlags;
    playerId: number;
    votedFor: uint8;
    reported: boolean;
    voted: boolean;
    dead: boolean;
}

export interface ComponentData {
    netid: packed;
    datalen: uint16;
    data: Buffer;
    type: uint8;
}

export interface ObjectSpawn extends Message {
    type: MessageID.Spawn;
    spawnid: SpawnID;
    ownerid: packed;
    flags: SpawnFlag;
    num_components: packed;
    components: ComponentData[];
}

export interface ShipStatusSpawn extends ObjectSpawn {
    spawnid: SpawnID.ShipStatus;
}

export interface MeetingHubSpawn extends ObjectSpawn {
    spawnid: SpawnID.MeetingHub;
}

export interface LobbySpawn extends ObjectSpawn {
    spawnid: SpawnID.LobbyBehaviour;
}

export interface GameDataSpawn extends ObjectSpawn {
    spawnid: SpawnID.GameData;
}

export interface PlayerSpawn extends ObjectSpawn {
    spawnid: SpawnID.Player;
}

export interface HeadQuartersSpawn extends ObjectSpawn {
    spawnid: SpawnID.HeadQuarters;
}

export interface PlanetMapSpawn extends ObjectSpawn {
    spawnid: SpawnID.PlanetMap;
}

export interface AprilShipStatusSpawn extends ObjectSpawn {
    spawnid: SpawnID.AprilShipStatus;
}

export type SpawnMessage = ShipStatusSpawn
    | MeetingHubSpawn
    | LobbySpawn
    | GameDataSpawn
    | PlayerSpawn
    | HeadQuartersSpawn
    | PlanetMapSpawn
    | AprilShipStatusSpawn;

export interface DespawnMessage extends Message {
    type: MessageID.Despawn;
    netid: packed;
}

export type SceneChangeLocation = "OnlineGame";

export interface SceneChangeMessage extends Message {
    type: MessageID.SceneChange;
    clientid: packed;
    location: SceneChangeLocation;
}

export interface ReadyMessage extends Message {
    type: MessageID.Ready;
    clientid: packed;
}

export interface ChangeSettingsMessage extends Message {
    type: MessageID.ChangeSettings;
}

export type GameDataMessage = DataMessage
    | RPCMessage
    | SpawnMessage
    | DespawnMessage
    | SceneChangeMessage
    | ReadyMessage
    | ChangeSettingsMessage;

export interface BasePayload {
    bound?: "server"|"client";
    payloadid: PayloadID;
}

export interface GameDataPayload extends BasePayload {
    payloadid: PayloadID.GameData;
    code: code;
    parts: GameDataMessage[];
}

export interface GameDataToPayload extends BasePayload {
    payloadid: PayloadID.GameDataTo;
    code: code;
    recipient: packed;
    parts: GameDataMessage[];
}

export interface JoinedGamePayload extends BasePayload {
    payloadid: PayloadID.JoinedGame;
    code: code;
    clientid: uint32;
    hostid: uint32;
    num_clients: packed;
    clients: packed[];
}

export interface EndGamePayload extends BasePayload {
    payloadid: PayloadID.EndGame;
    code: code;
    reason: GameEndReason;
    show_ad: boolean;
}

export interface AlterGamePayload extends BasePayload {
    payloadid: PayloadID.AlterGame;
    code: code;
    tag: AlterGameTag;
    is_public: boolean;
}

export interface KickPlayerPayloadServerBound extends BasePayload {
    payloadid: PayloadID.KickPlayer;
    bound: "server";
    clientid: packed;
    banned: boolean;
}

export interface KickPlayerPayloadClientBound extends BasePayload {
    payloadid: PayloadID.KickPlayer;
    bound: "client";
    code: code;
    clientid: packed;
    banned: boolean;
}

export type KickPlayerPayload = KickPlayerPayloadServerBound | KickPlayerPayloadClientBound;

export interface RedirectPayload extends BasePayload {
    payloadid: PayloadID.Redirect;
    ip: string;
    port: uint16;
}

export interface MasterServer {
    flag: byte;
    name: string;
    ip: string;
    port: uint16;
    num_players: uint16;
}

export interface MasterServerListPayload extends BasePayload {
    payloadid: PayloadID.MasterServerList;
    num_servers: uint8;
    servers: MasterServer[];
}

export interface GameListGame {
    ip: string;
    port: uint16;
    code: int32;
    name: string;
    num_players: uint8;
    age: packed;
    map: MapID;
    imposters: uint8;
    max_players: uint8;
}

export type GameListCount = {
    [K in MapID]: number;
}

export enum GameListClientBoundTag {
    List = 0x00,
    Count = 0x01
}

export interface GameListPayloadClientBound extends BasePayload {
    bound?: "client";
    tag: GameListClientBoundTag;
    payloadid: PayloadID.GetGameListV2;
}


export interface GameListPayloadClientBoundList extends GameListPayloadClientBound {
    tag: GameListClientBoundTag.List;
    games: GameListGame[];
}

export interface GameListPayloadClientBoundCount extends GameListPayloadClientBound {
    tag: GameListClientBoundTag.Count;
    count: GameListCount;
}

export interface GameListPayloadServerBound extends BasePayload {
    bound?: "server";
    payloadid: PayloadID.GetGameListV2;
    options: Partial<GameOptionsData>;
}

export type GameListPayload = GameListPayloadClientBoundList | GameListPayloadClientBoundCount | GameListPayloadServerBound;

export type Payload = HostGamePayload
    | JoinGamePayload
    | StartGamePayload
    | RemoveGamePayload
    | RemovePlayerPayload
    | GameDataPayload
    | GameDataToPayload
    | JoinedGamePayload
    | EndGamePayload
    | KickPlayerPayload
    | AlterGamePayload
    | RedirectPayload
    | MasterServerListPayload
    | GameListPayload;

export interface ReliablePayloadPacket extends BasePacket {
    op: PacketID.Reliable;
    reliable?: true;
    nonce?: number;
    payloads: Payload[];
}

export interface UnreliablePayloadPacket extends BasePacket {
    op: PacketID.Unreliable;
    reliable?: false;
    payloads: Payload[];
}

export type PayloadPacket = ReliablePayloadPacket | UnreliablePayloadPacket;

export type Packet = PayloadPacket
    | HelloPacket
    | DisconnectPacket
    | AcknowledegePacket
    | PingPacket;
