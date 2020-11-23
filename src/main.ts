import http from "http";
import express from "express";
import socketio, {Socket} from "socket.io";
import {v4} from "uuid";
import Client from "./Client";
import Room from "./Room";
import {SERVER_PORT, DEV_WEBUI_HOSTNAME, DEV_WEBUI_PORT} from "./consts";
import {ExpressPeerServer} from "peer";
import path from "path";

const app = express();
app.use(express.static(path.join(__dirname, "dist")));
const server = http.createServer(app);
const io = new socketio.Server(server, process.env.NODE_ENV === "production" ? {} : {
    cors: { origin: `http://${DEV_WEBUI_HOSTNAME}:${DEV_WEBUI_PORT}` }
});
app.use("/peerjs", ExpressPeerServer({
    // eslint-disable-next-line
    // @ts-ignore
    on(event, peerServerHandler) {
        server.on(event, (req, a, b) => {
            if (event === "upgrade" && !req.url.includes("socket.io")) {
                peerServerHandler(req, a, b);
            }
        });
    }
}));

export const state: {
    allClients: Client[];
    allRooms: Room[];
} = {
    allClients: [],
    allRooms: []
};
io.on("connection", (socket: Socket) => {
    const client = new Client(socket, v4());
    state.allClients.push(client);
    console.log("user connected", client.uuid);
});


app.all("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});
server.listen(process.env.PORT || SERVER_PORT, () => {
    console.log(`Listening on port ${SERVER_PORT}`);
});
