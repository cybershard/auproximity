import socketio, {Socket} from "socket.io";

import Client from "./Client";
import {ExpressPeerServer} from "peer";
import Room from "./Room";
import express from "express";
import http from "http";
import path from "path";
import sslRedirect from "heroku-ssl-redirect";
import {v4} from "uuid";

const app = express();
app.use(sslRedirect());
app.use(express.static(path.join(__dirname, "dist")));

const server = http.createServer(app);
const io = new socketio.Server(server, process.env.NODE_ENV === "production" ? {} : {
    cors: { origin: "http://localhost:8080" }
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


const port = process.env.PORT || 8079;
server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
