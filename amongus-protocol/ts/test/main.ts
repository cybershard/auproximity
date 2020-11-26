import {
    AmongusClient,
    HatID,
    MasterServers,
    Game,
    PlayerClient,
    DebugOptions,
    GameObject
} from "../index"

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

(async () => {
    const client = new AmongusClient({
        debug: DebugOptions.None
    });

    const servers = MasterServers.EU[0];

    await client.connect(servers[0], servers[1], "weakeyes");

    const game = await client.join(process.argv[2]);
    await game.awaitSpawns();

    game.GameData.GameData.on("playerData", player => {
        console.log(player);
    });

    await game.me.setName("strongeyes");
    await game.me.setColour(Math.floor(Math.random() * 13));
    await game.me.setHat(HatID.Plague);
})();
