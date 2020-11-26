export type bit = boolean;
export type byte = number;
export type bitfield = byte;

export type uint8 = number;
export type int8 = number;
export type uint16 = number;
export type int16 = number;
export type uint32 = number;
export type int32 = number;

export type float = number;
export type float16 = number;
export type double = number;

export type packed = number;

export type code = int32;

export type vector<A, B> = [A, B];

export interface Vector2 {
    x: float16;
    y: float16;
}
