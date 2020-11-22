import {
    BackendAdapter, BackendEvent,
    BackendModel,
    BackendType,
    ImpostorBackendModel,
    MapIdModel,
    PublicLobbyBackendModel, RoomGroup
} from "./types/Backend";
import Client, {Pose} from "./Client";
import ImpostorBackend from "./backends/ImpostorBackend";
import PublicLobbyBackend from "./backends/PublicLobbyBackend";
import NoOpBackend from "./backends/NoOpBackend";
import {state} from "./main";

export default class Room {
    public backendModel: BackendModel;
    public backendAdapter: BackendAdapter;
    public members: Client[] = [];

    public clientRoomGroupMap = new Map<string, RoomGroup>();

    map: MapIdModel;

    constructor(backendModel: BackendModel) {
        this.backendModel = backendModel;
        this.backendAdapter = Room.buildBackendAdapter(backendModel);
        this.initializeBackend();
    }

    // Factory function
    private static buildBackendAdapter(backendModel: BackendModel): BackendAdapter {
        if (backendModel.backendType === BackendType.PublicLobby) {
            return new PublicLobbyBackend(backendModel as PublicLobbyBackendModel);
        } else if (backendModel.backendType === BackendType.Impostor) {
            return new ImpostorBackend(backendModel as ImpostorBackendModel);
        } else {
            return new NoOpBackend();
        }
    }
    private initializeBackend() {
        this.backendAdapter.on(BackendEvent.MapChange, (payload: { map: MapIdModel }) => {
            this.map = payload.map;

            this.members.forEach(c => {
                c.setMap(payload.map);
            })
        });
        this.backendAdapter.on(BackendEvent.PlayerPose, (payload: { name: string; pose: Pose; }) => {
            const client = this.members.find(c => c.name === payload.name);
            if (client) {
                // if the client connection exists, update all clients about the new position
                this.members.forEach(c => {
                    c.setPoseOf(client.uuid, payload.pose);
                });
            }
        });
        this.backendAdapter.on(BackendEvent.AllPlayerPoses, (payload: { pose: Pose }) => {
            this.members.forEach(client => {
                this.members.forEach(c => c.setPoseOf(client.uuid, payload.pose));
            });
        });
        this.backendAdapter.on(BackendEvent.PlayerJoinGroup, (payload: { name: string; group: RoomGroup }) => {

            // store the state of this client <-> roomGroup in the room
            // this is to restore the room group if the client disconnects and reconnects
            this.clientRoomGroupMap.set(payload.name, payload.group);

            const client = this.members.find(c => c.name === payload.name);
            if (client) {
                // if the client connection exists, update all clients about the new group
                this.members.forEach(c => {
                    c.setGroupOf(client.uuid, payload.group);
                });
            }
        });
        this.backendAdapter.on(BackendEvent.AllPlayerJoinGroups, (payload: { group: RoomGroup }) => {

            // store the state of this client <-> roomGroup in the room
            // this is to restore the room group if the client disconnects and reconnects
            this.clientRoomGroupMap.forEach((value, key) => {
                this.clientRoomGroupMap.set(key, payload.group);
            });

            this.members.forEach(client => {
                this.members.forEach(c => c.setGroupOf(client.uuid, payload.group));
            });
        });
        this.backendAdapter.on(BackendEvent.Error, async () => {
            await this.destroy();
        });
        this.backendAdapter.initialize();
    }

    // Public methods
    addClient(client: Client): void {
        // restore roomgroup for a client if it exists
        if (this.clientRoomGroupMap.has(client.name)) {
            client.setGroupOf(client.uuid, this.clientRoomGroupMap.get(client.name));
        }

        client.setMap(this.map);

        this.members.forEach(c => c.addClient(client.uuid, client.name, client.pose, client.group));
        client.setAllClients(this.members.map(c => ({
            uuid: c.uuid,
            name: c.name,
            pose: c.pose,
            group: c.group
        })));
        this.members.push(client);
    }
    async removeClient(client: Client): Promise<void> {
        this.members = this.members.filter(c => c.uuid !== client.uuid);
        this.members.forEach(c => c.removeClient(client.uuid));
        if (this.members.length === 0) await this.destroy();
    }

    async destroy(): Promise<void> {
        if (this.members.length > 0) {
            for (const c of this.members) {
                await c.leaveRoom();
            }
            // do not need to call await this.destroy(); because removeClient() (called by c.leaveRoom()) already calls it.
            return;
        }
        await this.backendAdapter.destroy();
        state.allRooms = state.allRooms.filter(room => room !== this);
    }
}
