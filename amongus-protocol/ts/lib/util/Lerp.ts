export function Clamp(val: number, min: number, max: number) {
    return Math.max(Math.min(val, max), min);
}

export function LerpValue(val: number, min: number, max: number) {
    const clamped = Clamp(val, min, max);

    return min + (max - min) * clamped;
}

export function UnlerpValue(val: number, min: number, max: number) {
    return (val - min) / (max - min);
}