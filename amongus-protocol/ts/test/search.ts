import {
    AmongusClient,
    MapID,
    DebugOptions
} from "../index"

(async () => {
    const client = new AmongusClient({
        debug: DebugOptions.Everything
    });

    await client.connect("127.0.0.1", 22023, "weakeyes");

    const games = await client.search([MapID.TheSkeld]);

    console.log(games);
});
