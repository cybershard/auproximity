import {
    byte,
    int32,
    uint16,
    uint32
} from "./Types";

export interface ServerInfo {
    name: string;
    ip: byte[];
    port: uint16;
    unknown: 0;
}

export interface RegionInfo {
    unknown: uint32;
    name: string;
    pingip: string;
    num_severs: uint32;
    servers: ServerInfo[];
}