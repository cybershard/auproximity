// https://github.com/SkeldJS/SkeldJS/blob/master/packages/data/ts/lib/MasterServers.ts
// Writing here to update easily
export const OfficialServers = {
    "NA": [
        ["50.116.1.42", 22023],
        ["104.237.135.186", 22023],
        ["45.79.40.75", 22023],
        ["198.58.115.57", 22023],
        ["198.58.99.71", 22023],
        ["45.79.5.6", 22023]
    ],
    "EU": [
        ["172.105.251.170", 22023],
        ["172.105.249.25", 22023]
    ],
    "AS": [
        ["172.104.96.99", 22023],
        ["139.162.111.196", 22023]
    ]
} as Record<"NA"|"EU"|"AS", [string, number][]>;