import { composePacket } from "../lib/Compose"

const json = process.argv.slice(2).join(" ");
const to_hex = (val: number) => val.toString(16);

const parsed = composePacket(JSON.parse(json), "client");

console.log([...parsed].map(to_hex).join(" "));
