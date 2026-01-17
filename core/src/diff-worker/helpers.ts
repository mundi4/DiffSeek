
export function isSame(buf: Uint16Array, off: Uint32Array, idxA: number, idxB: number): boolean {
    const lenA = off[idxA + 1] - off[idxA];
    const lenB = off[idxB + 1] - off[idxB];
    if (lenA !== lenB) return false;
    const sA = off[idxA], sB = off[idxB];
    for (let i = 0; i < lenA; i++) {
        if (buf[sA + i] !== buf[sB + i]) return false;
    }
    return true;
}

export function isSameCross(
    rhsBuf: Uint16Array, rhsOff: Uint32Array, rIdx: number,
    lhsBuf: Uint16Array, lhsOff: Uint32Array, lIdx: number
): boolean {
    const rs = rhsOff[rIdx], ls = lhsOff[lIdx];
    const length = rhsOff[rIdx + 1] - rs;
    if (length !== (lhsOff[lIdx + 1] - ls)) return false;
    for (let i = 0; i < length; i++) {
        if (rhsBuf[rs + i] !== lhsBuf[ls + i]) return false;
    }
    return true;
}

export function calculateHash(buffer: Uint16Array, start: number, len: number): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < len; i++) {
        h ^= buffer[start + i];
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
