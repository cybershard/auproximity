import util from "util"

import { parsePacket } from "../lib/Parser"

const serverbound = process.argv[2] === "server";
const bytes = process.argv.slice(serverbound ? 3 : 2).join("");
const to_num = (val: string) => parseInt(val, 16);
const buff = Buffer.from(bytes.match(/[A-Fa-f0-9]{1,2}/g).map(to_num));

const parsed = parsePacket(buff, serverbound ? "server" : "client");

console.log(util.inspect(parsed, false, 10, true));
