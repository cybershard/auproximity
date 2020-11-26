const basetable = new Array(512);
const shifttable = new Array(512);

for (let i = 0; i < 256; ++i) {
    let e = i - 127;

    if (e < -24) {
        basetable[i | 0x000] = 0x0000;
        basetable[i | 0x100] = 0x8000;
        shifttable[i | 0x000] = 24;
        shifttable[i | 0x100] = 24;
    } else if (e < -14) {
        basetable[i | 0x000] = (0x0400 >> (-e - 14));
        basetable[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000;
        shifttable[i | 0x000] = -e - 1;
        shifttable[i | 0x100] = -e - 1;
    } else if (e <= 15) {
        basetable[i | 0x000] = ((e + 15) << 10);
        basetable[i | 0x100] = ((e + 15) << 10) | 0x8000;
        shifttable[i | 0x000] = 13;
        shifttable[i | 0x100] = 13;
    } else if (e < 128) { 
        basetable[i | 0x000] = 0x7C00;
        basetable[i | 0x100] = 0xFC00;
        shifttable[i | 0x000] = 24;
        shifttable[i | 0x100] = 24;
    } else {
        basetable[i | 0x000] = 0x7C00;
        basetable[i | 0x100] = 0xFC00;
        shifttable[i | 0x000] = 13;
        shifttable[i | 0x100] = 13;
    }
}


export function getFloat16(val: number) {
    const float = Buffer.alloc(4);
    float.writeFloatBE(val);

    const int32 = float.readUInt32BE();
    
    return basetable[(int32 >> 23) & 0x1ff] + ((int32 & 0x007fffff) >> shifttable[(int32 >> 23) & 0x1ff]);
}

const mantissatable = new Array(2028);

mantissatable[0] = 0;

for (let i = 1; i < 1024; i++) {
    let m = i << 13;
    let e = 0;

    while (!(m & 0x00800000)) {
        e -= 0x00800000;
        m <<= 1;
    }

    m &= ~0x00800000;
    e += 0x38800000;

    mantissatable[i] = m | e;
}

for (let i = 1024; i < 2048; i++) {
    mantissatable[i] = 0x38000000 + ((i - 1024) << 13);
}

const offsettable = new Array(64);

for (let i = 0; i < 64; i++) {
    offsettable[i] = 1024;
}

offsettable[0] = 0;
offsettable[32] = 0;

const exponenttable = new Array(64);

exponenttable[0] = 0;
exponenttable[32] = 0x80000000;
for (let i = 1; i < 31; i++) {
    exponenttable[i] = i << 23;
}

exponenttable[31] = 0x47800000;
exponenttable[63] = 0xC7800000;

for (let i = 33; i < 63; i++) {
    exponenttable[i] = 0x80000000 + ((i - 32) << 23);
}

export function getFloat32(val) {
    const int32 = Buffer.alloc(4);
    int32.writeUInt32BE(mantissatable[offsettable[val >> 10] + (val & 0x3ff)] + exponenttable[val >> 10]);
    
    return int32.readFloatBE();
}