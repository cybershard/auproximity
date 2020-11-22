import { AmongusClient } from "../Client"

import { Player } from "./objects/Player"

import {
    ColourID,
    HatID,
    MessageID,
    PacketID,
    PayloadID,
    PetID,
    RPCID,
    SkinID,
    SystemType,
    TaskID
} from "../constants/Enums"

import {
    Vector2
} from "../interfaces/Types"

import { PlayerTaskState, SceneChangeLocation } from "../interfaces/Packets"
import { GameObject } from "./objects/GameObject"
import { MeetingHub } from "./objects/MeetingHub"

export interface PlayerClient {
    on(event: "spawn", listener: (player: Player) => void);
    on(event: "taskComplete", listener: (task: PlayerTaskState) => void);
    on(event: "setTasks", listener: (tasks: TaskID[]) => void);
    on(event: "vote", listener: (suspect: PlayerClient) => void);
    on(event: "kicked", listener: (banned: boolean) => void);
    on(event: "murder", listener: (target: PlayerClient) => void);
    on(event: "murdered", listener: (murderer: PlayerClient) => void);
    on(event: "sceneChange", listener: (location: SceneChangeLocation) => void);
}

export class PlayerClient extends GameObject {
    children: Player[];

    removed: boolean;
    dead: boolean;
    is_ready: boolean;

    tasks: TaskID[];

    constructor (protected client: AmongusClient, public clientid: number) {
        super(client, client);

        this.removed = false;
        this.dead = false;
        this.is_ready = false;

        this.tasks = [];

        this.id = clientid;
    }

    awaitSpawn() {
        return new Promise<Player>(resolve => {
            if (this.Player) {
                return resolve(this.Player);
            }

            this.once("spawn", player => {
                resolve(player);
            });
        });
    }

    addChild(object: GameObject) {
        super.addChild(object);

        this.client.game.registerComponents(object);

        if (object instanceof Player) this.emit("spawn", object);
    }

    get imposter() {
        return !!this.client.game.imposters.find(imposter => imposter.Player.PlayerControl.playerId === this.Player.PlayerControl.playerId);
    }

    get Player() {
        return this.children[0];
    }

    get PlayerData() {
        return this.client.game.GameData.GameData.players.get(this.Player.PlayerControl.playerId);
    }

    get name() {
        return this.PlayerData?.name;
    }

    async kick(ban: boolean = false) {
        if (!this.removed) {
            await this.client.send({
                op: PacketID.Reliable,
                payloads: [
                    {
                        bound: "server",
                        payloadid: PayloadID.KickPlayer,
                        clientid: this.clientid,
                        banned: ban
                    }
                ]
            });
        }
    }

    async ban() {
        return this.kick(true);
    }

    async murder(target: PlayerClient) {
        if (this.Player && !this.removed) {
            this.Player.PlayerControl.murderPlayer(target.Player.PlayerControl.netid);
        }
    }

    _setTasks(tasks: TaskID[]) {
        this.tasks = tasks;

        this.emit("setTasks", this.tasks);
    }

    async setTasks(tasks: TaskID[]) {
        this._setTasks(tasks);

        await this.client.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.GameData,
                    code: this.client.game.code,
                    parts: [
                        {
                            type: MessageID.RPC,
                            handlerid: this.client.game.GameData.GameData.netid,
                            rpcid: RPCID.SetTasks,
                            playerid: this.Player.PlayerControl.playerId,
                            num_tasks: tasks.length,
                            tasks
                        }
                    ]
                }
            ]
        });
    }

    /**
     * @param task The index of the task as in PlayerClient.tasks.
     */
    async completeTask(task: number) {
        await this.client.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.GameData,
                    code: this.client.game.code,
                    parts: [
                        {
                            type: MessageID.RPC,
                            rpcid: RPCID.CompleteTask,
                            handlerid: this.Player.PlayerControl.netid,
                            taskid: task
                        }
                    ]
                }
            ]
        });
    }

    async vote(player: PlayerClient|"skip") {
        if (this.Player && !this.removed) {
            const meetinghub = this.client.game.findChild(object => object instanceof MeetingHub) as MeetingHub;

            if (meetinghub) {
                await this.client.send({
                    op: PacketID.Reliable,
                    payloads: [
                        {
                            payloadid: PayloadID.GameDataTo,
                            recipient: this.client.game.hostid,
                            code: this.client.game.code,
                            parts: [
                                {
                                    type: MessageID.RPC,
                                    rpcid: RPCID.CastVote,
                                    handlerid: meetinghub.MeetingHud.netid,
                                    voterid: this.Player.PlayerControl.playerId,
                                    suspectid: player === "skip" ? 0xFF : player.Player.PlayerControl.playerId
                                }
                            ]
                        }
                    ]
                });
            }
        }
    }

    async voteKick(player: PlayerClient) {
        if (this.Player && !this.removed) {
            const gamedata = this.client.game.GameData;

            if (gamedata) {
                await this.client.send({
                    op: PacketID.Reliable,
                    payloads: [
                        {
                            payloadid: PayloadID.GameData,
                            code: this.client.game.code,
                            parts: [
                                {
                                    type: MessageID.RPC,
                                    rpcid: RPCID.AddVote,
                                    handlerid: gamedata.VoteBanSystem.netid,
                                    targetid: player.Player.PlayerControl.playerId
                                }
                            ]
                        }
                    ]
                })
            }
        }
    }

    async ready() {
        await this.client.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.GameData,
                    code: this.client.game.code,
                    parts: [
                        {
                            type: MessageID.Ready,
                            clientid: this.clientid
                        }
                    ]
                }
            ]
        });
    }

    async startMeeting(bodyid: number|"emergency") {
        await this.client.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.GameData,
                    code: this.client.game.code,
                    parts: [
                        {
                            type: MessageID.RPC,
                            rpcid: RPCID.ReportDeadBody,
                            handlerid: this.Player.PlayerControl.netid,
                            bodyid: bodyid === "emergency" ? 0xFF : bodyid
                        }
                    ]
                }
            ]
        })
    }

    async sabotageSystem(system: SystemType) {
        await this.client.send({
            op: PacketID.Reliable,
            payloads: [
                {
                    payloadid: PayloadID.GameDataTo,
                    code: this.client.game.code,
                    recipient: this.client.game.hostid,
                    parts: [
                        {
                            type: MessageID.RPC,
                            rpcid: RPCID.RepairSystem,
                            handlerid: this.Player.PlayerControl.netid,
                            systemtype: SystemType.Sabotage,
                            amount: system
                        }
                    ]
                }
            ]
        });
    }

    async setName(name: string) {
        if (this.Player && !this.removed) {
            await this.Player.PlayerControl.setName(name);
        }
    }

    async setColour(colour: ColourID) {
        if (this.Player && !this.removed) {
            await this.Player.PlayerControl.setColour(colour);
        }
    }

    async setHat(hat: HatID) {
        if (this.Player && !this.removed) {
            await this.Player.PlayerControl.setHat(hat);
        }
    }

    async setSkin(skin: SkinID) {
        if (this.Player && !this.removed) {
            await this.Player.PlayerControl.setSkin(skin);
        }
    }

    async setPet(pet: PetID) {
        if (this.Player && !this.removed) {
            await this.Player.PlayerControl.setPet(pet);
        }
    }

    async chat(text: string) {
        if (this.Player && !this.removed) {
            await this.Player.PlayerControl.chat(text);
        }
    }

    async move(position: Vector2, velocity: Vector2) {
        if (this.Player && !this.removed) {
            await this.Player.CustomNetworkTransform.move(position, velocity);
        }
    }

    async snapTo(position: Vector2) {
        if (this.Player && !this.removed) {
            await this.Player.CustomNetworkTransform.snapTo(position);
        }
    }
}
