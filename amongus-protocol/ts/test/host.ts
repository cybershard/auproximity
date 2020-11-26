import {
    AmongusClient,
    MapID,
    MasterServers,
    DebugOptions
} from "../index"

import { Int2Code } from "../lib/util/Codes";

(async () => {
    const client = new AmongusClient({
        debug: DebugOptions.Everything
    });

    const server = MasterServers.NA[0];

    await client.connect(server[0], server[1], "weakeyes");

    const game = await client.host();

    await client.join(game.code, {
        doSpawn: false
    });

    console.log(game);
    console.log(Int2Code(game.code));
})();
