import Client from "../../Client";
import Room from "../../Room";

export interface AUProximityState {
    allClients: Client[];
    allRooms: Room[];
}