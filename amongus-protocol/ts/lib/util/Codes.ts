const V2 = "QWXRTYLPESDFGHUJKZOCVBINMA";
const V2Map = [ 25, 21, 19, 10, 8, 11, 12, 13, 22, 15, 16, 6, 24, 23, 18, 7, 0, 3, 9, 4, 14, 20, 1, 2, 5, 17 ];

export function Code2Int(code) {
    var a = V2Map[code.charCodeAt(0) - 65];
    var b = V2Map[code.charCodeAt(1) - 65];
    var c = V2Map[code.charCodeAt(2) - 65];
    var d = V2Map[code.charCodeAt(3) - 65];
    var e = V2Map[code.charCodeAt(4) - 65];
    var f = V2Map[code.charCodeAt(5) - 65];

    var one = (a + 26 * b) & 0x3FF;
    var two = (c + 26 * (d + 26 * (e + 26 * f)));

    return (one | ((two << 10) & 0x3FFFFC00) | 0x80000000);
}

export function Int2Code(bytes) {
    var a = bytes & 0x3FF;
    var b = (bytes >> 10) & 0xFFFFF;

    return V2[a % 26] +
        V2[~~(a / 26)] +
        V2[b % 26] +
        V2[~~(b / 26 % 26)] +
        V2[~~(b / (26 * 26) % 26)] +
        V2[~~(b / (26 * 26 * 26) % 26)];
}