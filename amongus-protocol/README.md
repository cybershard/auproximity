# AmongUs-Protocol

![Alt text](asset/logo.png "Amongus Protocol")

See the [wiki](https://github.com/edqx/amongus-protocol/wiki) for more information on the protocol.

Documentation is available for preview at http://thechimp.store/amongus-protocol/

An implementation of the Among Us protocol made in Typescript
* Lightweight, 0 external dependencies.
* Comprehensive coverage of the Among Us protocol.
* Features full object and component system.
* Easy to install & use.

Data gathered from
* https://wiki.weewoo.net/wiki/
* https://github.com/alexis-evelyn/Among-Us-Protocol/wiki
* [Wireshark](https://www.wireshark.org/)
* [IDA](https://www.hex-rays.com/products/ida/)
* [Il2CppDumper](https://github.com/Perfare/Il2CppDumper)
* Impostor Discord server
* Helpful members

## Install
With NPM:
`npm install --save amongus-protocol`

Or clone with Git:
`git clone https://github.com/edqx/amongus-protocol`

## Example
```ts
import {
    AmongusClient,
    MasterServers,
    ColourID,
    HatID,
} from "amongus-protocol"

const server = MasterServers.EU[0];

const client = new AmongusClient({
    debug: false
});

await client.connect(server[0], server[1], "weakeyes");

const game = await client.join(process.argv[2]);

game.me.on("spawn", () => {
    game.me.setName("weakeyes");
    game.me.setColour(ColourID.Black);
    game.me.setHat(HatID.Plague);
});
```

## Notes
Recommended node: v14+
Recommended TS: 4.0+

This repository is licensed under the MIT license, I am not responsible for anything you do using this library.