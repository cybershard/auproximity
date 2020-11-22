import {RoomGroup} from "./Backend";
import {Pose} from "../Client";
import Room from "../Room";

export interface IClientBase {
    uuid: string;
    name: string;
    pose: Pose
    group: RoomGroup;
    room?: Room
}
