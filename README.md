# AUProximity

[![Heroku](https://img.shields.io/badge/HEROKU-ONLINE-green?style=for-the-badge&logo=heroku)](https://aupro.xyz)

AUProximity is an open source proximity voice chat platform, primarily aimed at Among Us.

I have an open instance hosted at https://aupro.xyz.

This software should be used for personal use on public lobbies. Anyone that wants to
have a custom solution, private server, or other commercial use for this software should 
send a direct message to `weakeyes#0001` on Discord.

## Features
- The software can connect to a public game to host proximity voice services
  - A restriction with public lobbies is that it is **limited to 9 players** only.
- Run as a plugin on Impostor, NodePolus or other private servers.
  - A private server plugin will have none of the limitations of the public lobby
    (e.g. It **won't** be limited to 9 players) 
- There is also planned support for a [BepInEx](https://github.com/BepInEx/BepInEx) mod,
which will serve the purpose of sending positional data to the backend server.
  - Currently, the Impostor plugin and BepInEx mod are separate projects.

## Developer Quickstart
> Note: This project uses `yarn`, so install it if you do not have it already.

Follow the steps below to run a server and webui with hot-reload
- Run `yarn install` to install all dependencies
- Run `yarn serve` in the `auproximity` directory
- Run `yarn serve` in the `auproximity-webui` directory
- In development, the server will listen on port `8079` and the webui will listen on port `8080`
- In production, the webui should be served from the same origin as the server. The server 
  should also have an ssl reverse proxy in front of it, like nginx, or on a PaaS like Heroku.

> Note: The `heroku-postbuild` script is for Heroku deployment only.
> Do NOT use it for development or production testing, as it WILL break.

## Selfhosting - Heroku
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Architecture
This repository contains two different modules, the server and the webui.
 - The webui contains a basic implementation of a proximity voice client.
 - The server maintains connections between all proximity voice clients,
 serves as a WebRTC signaling service, and contains all the backends for positional data.

This design makes it very easy to have any provider for positional data
(e.g., server plugin, BepInEx mod). As well, the client can have any implementation,
as basic websockets are used to transfer positional data. In the base implementation,
the client is the webui, and uses Web Audio APIs to connect to other clients.
However, the client manages the voice system completely. As such, the client can
easily be extended to create a desktop application, an application that
interfaces with Discord RPC, and even include features like minimaps!

## Contributing
I welcome PRs for adding additional backends, client features, and even forks for other games. 

This repository follows an issue-based workflow. Issues should be created to identify
features and bugs being worked on, and PRs should close the issues they target
for fixes and/or implementations.

## Credits
The [skeldjs](https://github.com/skeldjs/SkeldJS) library by
[edqx](https://github.com/edqx), used to interface with public lobbies

## License
This software is licensed under the GNU GPLv3 License, and comes with no warranty.
