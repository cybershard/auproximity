import {
    AmongusClient,
    MasterServers,
    ColourID,
    DebugOptions
} from "../index"

import { GameData } from "../lib/struct/objects/GameData";

(async () => {
    const client = new AmongusClient({
        debug: DebugOptions.Everything
    });

    const server = MasterServers.NA[0];

    await client.connect("208.110.239.187", 22023, "weakeyes");

    const game = await client.join(process.argv[2], {
        doSpawn: true
    });

    game.on("playerJoin", async client => {
        console.log("Joined", client.clientid);
    });

    game.on("playerLeave", async client => {
        console.log("Left", client.clientid);
    });

    game.on("startCount", async counter => {
        console.log("Game starting..", counter);
    });

    game.on("start", async () => {
        console.log("Game started!");
    });

    game.on("setImposters", imposters => {
        console.log("The imposters are: ", imposters.map(client => client.PlayerData.name));
    });

    game.me.on("spawn", async player => {
        game.me.setColour(ColourID.Red);
        game.me.setName("strong eyes");
    });

    game.on("spawn", object => {
        if (object instanceof GameData) {
            object.GameData.on("playerData", playerData => {
                console.log("playerData: " + playerData.name);
            });
        }
    });
});
