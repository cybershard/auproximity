import Room from "../Room";

export interface ClientBase {
    uuid: string;
    name: string;
    room?: Room;
}
