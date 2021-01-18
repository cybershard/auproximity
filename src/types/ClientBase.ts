import { ColorID } from "@skeldjs/constant";

import { Pose } from "../Client";
import Room from "../Room";

import { PlayerFlags } from "./enums/PlayerFlags";
import { RoomGroup } from "./enums/RoomGroup"

export interface ClientBase {
    uuid: string;
    name: string;
    pose: Pose;
    group: RoomGroup;
    room?: Room;
    color: ColorID;
    flags: PlayerFlags;
}
