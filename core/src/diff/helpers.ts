import type { DiffInput } from "./types";
import { RESULT_BUFFER_STRIDE } from "./constants";
import { TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_LINE_END, TOKEN_FLAGS_TYPE_IMAGE } from "../tokenization";

export function calculateHash(buffer: Uint16Array, start: number, len: number): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < len; i++) {
        h ^= buffer[start + i];
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function isTokenRangeTextEqual(bufA: Uint16Array, offA: Uint32Array, sA: number, eA: number, bufB: Uint16Array, offB: Uint32Array, sB: number, eB: number): boolean {
    const startA = offA[sA], len = offA[eA] - startA;
    if (len !== (offB[eB] - offB[sB])) return false;
    const startB = offB[sB];
    for (let i = 0; i < len; i++) if (bufA[startA + i] !== bufB[startB + i]) return false;
    return true;
}

export function matchPrefixTokens(lhsInput: DiffInput, rhsInput: DiffInput, lIdx: number, lUpper: number, rIdx: number, rUpper: number, ignoreWhitespaces: boolean): [number, number] | null {
    const { buffer: lhsBuf, offsets: lhsOffsets, flags: lhsFlags } = lhsInput;
    const { buffer: rhsBuf, offsets: rhsOffsets, flags: rhsFlags } = rhsInput;

    let i = lIdx, j = rIdx;

    if (!ignoreWhitespaces) {
        const lFlags = lhsFlags[i];
        const rFlags = rhsFlags[j];
        // 공백을 무시하지 않을 때는 토큰 뒤 WS 여부도 일치해야 함.
        if (!(lFlags & (TOKEN_FLAGS_HAS_FOLLOWING_SPACE | TOKEN_FLAGS_LINE_END)) !==
            !(rFlags & (TOKEN_FLAGS_HAS_FOLLOWING_SPACE | TOKEN_FLAGS_LINE_END))) {
            return null;
        }
    }

    let ci = lhsOffsets[i], cj = rhsOffsets[j];
    let lTargetPos = lhsOffsets[i + 1];
    let rTargetPos = rhsOffsets[j + 1];

    // 첫 시작부터 이미지면 바로 아웃
    //if ((lhsFlags[i] & TOKEN_FLAGS_IMAGE) || (rhsFlags[j] & TOKEN_FLAGS_IMAGE)) return null;

    while (true) {
        // [Scan 구간] Target 중 가까운 곳까지 전력 질주
        while (ci < lTargetPos && cj < rTargetPos) {
            if (lhsBuf[ci++] !== rhsBuf[cj++]) return null;
        }

        const isLReached = (ci === lTargetPos);
        const isRReached = (cj === rTargetPos);

        // [동기화 지점] 둘 다 토큰 끝에 도달했는가? (드디어 정렬됨)
        if (isLReached && isRReached) {
            return [(i + 1) - lIdx, (j + 1) - rIdx];
        }

        // [전이 구간] 한쪽만 끝났다면 다음 토큰으로 목표 갱신 (Flag 검사)
        if (isLReached) {
            if (++i === lUpper) return null; // 더 갈 곳 없으면 동기화 실패
            // const prevF = lhsFlags[i - 1];
            const nextF = lhsFlags[i];

            if (!ignoreWhitespaces && (nextF & (TOKEN_FLAGS_HAS_FOLLOWING_SPACE | TOKEN_FLAGS_LINE_END))) {
                // 새 토큰에 후행 공백이 있으므로 이어 붙이면 안됨
                return null;
            }

            if (//(prevF & TOKEN_FLAGS_NO_JOIN_NEXT) || (nextF & TOKEN_FLAGS_NO_JOIN_PREV) ||
                (nextF & TOKEN_FLAGS_TYPE_IMAGE)) return null;
            //if (isIgnoreAtEdge && (!(prevF & TOKEN_FLAGS_LINE_END) || !(nextF & TOKEN_FLAGS_LINE_START))) return null;

            lTargetPos = lhsOffsets[i + 1];
        } else { // isRReached
            if (++j === rUpper) return null;
            // const prevF = rhsFlags[j - 1];
            const nextF = rhsFlags[j];

            if (!ignoreWhitespaces && (nextF & (TOKEN_FLAGS_HAS_FOLLOWING_SPACE | TOKEN_FLAGS_LINE_END))) {
                return null;
            }

            if (//(prevF & TOKEN_FLAGS_NO_JOIN_NEXT) || (nextF & TOKEN_FLAGS_NO_JOIN_PREV) || 
                (nextF & TOKEN_FLAGS_TYPE_IMAGE)) return null;
            //if (isIgnoreAtEdge && (!(prevF & TOKEN_FLAGS_LINE_END) || !(nextF & TOKEN_FLAGS_LINE_START))) return null;

            rTargetPos = rhsOffsets[j + 1];
        }
    }
}

export function matchSuffixTokens(lhsInput: DiffInput, rhsInput: DiffInput, lLower: number, lUpper: number, rLower: number, rUpper: number, ignoreWhitespaces: boolean): [number, number] | null {
    const { buffer: lhsBuf, offsets: lhsOffsets, flags: lhsFlags } = lhsInput;
    const { buffer: rhsBuf, offsets: rhsOffsets, flags: rhsFlags } = rhsInput;

    let i = lUpper - 1, j = rUpper - 1;

    if (!ignoreWhitespaces) {
        const lFlags = lhsFlags[i];
        const rFlags = rhsFlags[j];
        // 공백을 무시하지 않을 때는 토큰 뒤 WS 여부도 일치해야 함.
        if (!(lFlags & (TOKEN_FLAGS_HAS_FOLLOWING_SPACE | TOKEN_FLAGS_LINE_END)) !==
            !(rFlags & (TOKEN_FLAGS_HAS_FOLLOWING_SPACE | TOKEN_FLAGS_LINE_END))) {
            return null;
        }
    }

    let ci = lhsOffsets[i + 1], cj = rhsOffsets[j + 1];

    let lTarget = lhsOffsets[i];
    let rTarget = rhsOffsets[j];

    //if ((lhsFlags[i] & TOKEN_FLAGS_IMAGE) || (rhsFlags[j] & TOKEN_FLAGS_IMAGE)) return null;

    while (true) {
        while (ci > lTarget && cj > rTarget) {
            if (lhsBuf[--ci] !== rhsBuf[--cj]) return null;
        }

        const isLReached = (ci === lTarget);
        const isRReached = (cj === rTarget);

        if (isLReached && isRReached) {
            return [lUpper - i, rUpper - j];
        }

        if (isLReached) {
            if (--i < lLower) return null;
            // const currF = lhsFlags[i + 1];
            const prevF = lhsFlags[i];

            if (!ignoreWhitespaces && prevF & (TOKEN_FLAGS_HAS_FOLLOWING_SPACE | TOKEN_FLAGS_LINE_END)) {
                // 새 토큰에 후행 공백이 있으므로 매치 불가
                return null;
            }

            if (//(prevF & TOKEN_FLAGS_NO_JOIN_NEXT) || (currF & TOKEN_FLAGS_NO_JOIN_PREV) || 
                (prevF & TOKEN_FLAGS_TYPE_IMAGE)) return null;


            // if (isIgnoreAtEdge && (!(prevF & TOKEN_FLAGS_LINE_END) || !(currF & TOKEN_FLAGS_LINE_START))) return null;

            lTarget = lhsOffsets[i];
        } else { // isRReached
            if (--j < rLower) return null;
            // const currF = rhsFlags[j + 1];
            const prevF = rhsFlags[j];

            if (!ignoreWhitespaces && (prevF & (TOKEN_FLAGS_HAS_FOLLOWING_SPACE | TOKEN_FLAGS_LINE_END))) {
                return null;
            }

            if (//(prevF & TOKEN_FLAGS_NO_JOIN_NEXT) || (currF & TOKEN_FLAGS_NO_JOIN_PREV) || 
                (prevF & TOKEN_FLAGS_TYPE_IMAGE)) return null;
            // if (isIgnoreAtEdge && (!(prevF & TOKEN_FLAGS_LINE_END) || (!(currF & TOKEN_FLAGS_LINE_START)))) return null;

            rTarget = rhsOffsets[j];
        }
    }
}

export function compareBuffers(bufA: Uint16Array, offsetA: number, bufB: Uint16Array, offsetB: number, count: number): boolean {
    if (offsetA + count > bufA.length || offsetB + count > bufB.length) return false;
    for (let i = 0; i < count; i++) {
        if (bufA[offsetA + i] !== bufB[offsetB + i]) return false;
    }
    return true;
}

export function sliceDiffInput(input: DiffInput, lower: number, upper: number): DiffInput {
    return {
        buffer: input.buffer, // 그대로
        offsets: input.offsets.subarray(lower, upper + 1),
        flags: input.flags.subarray(lower, upper),
        resultBuffer: input.resultBuffer.subarray(lower * RESULT_BUFFER_STRIDE, upper * RESULT_BUFFER_STRIDE),
        tokenCount: upper - lower,
    } satisfies DiffInput;
}

export function writeToResultBuffer(lhsResultBuffer: Int32Array, rhsResultBuffer: Int32Array, lhsPos: number, lhsEnd: number, rhsPos: number, rhsEnd: number, diffType: number, lhsBase = 0, rhsBase = 0) {
    for (let i = lhsPos, lo = lhsPos * RESULT_BUFFER_STRIDE; i < lhsEnd; i++, lo += RESULT_BUFFER_STRIDE) {
        lhsResultBuffer[lo + 0] = lhsPos + lhsBase;
        lhsResultBuffer[lo + 1] = lhsEnd + lhsBase;
        lhsResultBuffer[lo + 2] = rhsPos + rhsBase;
        lhsResultBuffer[lo + 3] = rhsEnd + rhsBase;
        lhsResultBuffer[lo + 4] = diffType;
    }
    for (let i = rhsPos, lo = rhsPos * RESULT_BUFFER_STRIDE; i < rhsEnd; i++, lo += RESULT_BUFFER_STRIDE) {
        rhsResultBuffer[lo + 0] = rhsPos + rhsBase;
        rhsResultBuffer[lo + 1] = rhsEnd + rhsBase;
        rhsResultBuffer[lo + 2] = lhsPos + lhsBase;
        rhsResultBuffer[lo + 3] = lhsEnd + lhsBase;
        rhsResultBuffer[lo + 4] = diffType;
    }
}

export function tokenRangeToString(buffer: Uint16Array, offsets: Uint32Array, start: number, end: number): string {
    const offsetStart = offsets[start];
    const offsetEnd = offsets[end];
    let text = "";
    for (let i = offsetStart; i < offsetEnd; i++) {
        text += String.fromCharCode(buffer[i]);
    }
    return text;
}
