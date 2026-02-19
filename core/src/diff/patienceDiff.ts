import { TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_LINE_END } from "../tokenization";
import { calculateHash, isTokenRangeTextEqual } from "./helpers";
import type { DiffAnchor, DiffInput } from "./types";

export function buildPatienceAnchors(
    lhsInput: DiffInput,
    rhsInput: DiffInput,
    lhsLineCount: number,
    rhsLineCount: number,
    ignoreWhitespaces: boolean
): DiffAnchor[] {

    console.debug("Building patience anchors...", { lhsLineCount, rhsLineCount, ignoreWhitespaces });

    const HASH_MASK = 0xFFFF;
    const MIN_TEXT_LEN = 5;
    const LINE_BUFFER_STRIDE = 4;

    const HEAD = new Int32Array(HASH_MASK + 1);

    const links = lhsInput.resultBuffer.subarray(0, lhsLineCount);
    const lineBuffer = lhsInput.resultBuffer.subarray(lhsLineCount);

    HEAD.fill(-1);
    links.fill(-1);

    const lhsBuffer = lhsInput.buffer;
    const rhsBuffer = rhsInput.buffer;

    const lhsFlags = lhsInput.flags;
    const rhsFlags = rhsInput.flags;

    const lhsOffsets = lhsInput.offsets;
    const rhsOffsets = rhsInput.offsets;

    const lhsTknCount = lhsFlags.length;
    const rhsTknCount = rhsFlags.length;

    let nextLineIdx = 0;

    // ------------------------
    // LHS 스캔
    // ------------------------
    let i = 0;
    while (i < lhsTknCount) {
        const lineStart = i;
        while (i < lhsTknCount && (lhsFlags[i++] & TOKEN_FLAGS_LINE_END) === 0);
        const lineEnd = i;

        const charPos = lhsOffsets[lineStart];
        const charLen = lhsOffsets[lineEnd] - charPos;
        if (charLen < MIN_TEXT_LEN) continue;

        let h = calculateHash(lhsBuffer, charPos, charLen);
        if (!ignoreWhitespaces) {
            // console.log("applying whitespace positions to hash for LHS line", { lineStart, lineEnd, charPos, charLen, h });
            // 버퍼에는 공백이 포함되어 있지 않으므로 해시에 공백의 위치를 반영해줘야함
            for (let j = lineStart; j < lineEnd; j++) {
                if (lhsFlags[j] & TOKEN_FLAGS_HAS_FOLLOWING_SPACE) {
                    const wsOffset = lhsOffsets[j + 1] - charPos; // 시작위치에서의 상대 오프셋이어야 함!
                    h ^= wsOffset;
                    h = Math.imul(h, 16777619);
                }
            }
            h = h >>> 0;
            // console.log("final hash for LHS line after applying whitespace positions", h);
        }
        h = h & HASH_MASK;

        let foundIdx = -1;

        for (let curr = HEAD[h]; curr !== -1; curr = links[curr]) {
            const base = curr * LINE_BUFFER_STRIDE;
            const foundStart = lineBuffer[base];
            if (foundStart === -1) continue;

            const foundEnd = lineBuffer[base + 1];

            // 1. 공백의 위치까지 첨가된 해시가 충돌
            // 2. 그런데 두 범위의 토큰 수가 같음
            // 3. 그런데 거기에 또 공백이 제거된 문자열까지 완전히 일치함
            // 여기까지 왔는데 실제로 두 줄이 같지 않다면(공백의 위치가 서로 다르다면) 나에게 돌을 던져도 좋다...
            if (ignoreWhitespaces || (foundEnd - foundStart) === (lineEnd - lineStart)) {
                if (isTokenRangeTextEqual(lhsBuffer, lhsOffsets, foundStart, foundEnd,
                    lhsBuffer, lhsOffsets, lineStart, lineEnd)) {
                    // 여기에서 공백 위치 검증을 해 볼 수도 있다. 정말 할 일 없을 때...
                    foundIdx = curr;
                    break;
                }
            }
        }

        if (foundIdx === -1) {
            const idx = nextLineIdx++;
            links[idx] = HEAD[h];
            HEAD[h] = idx;

            const base = idx * LINE_BUFFER_STRIDE;
            lineBuffer[base] = lineStart;
            lineBuffer[base + 1] = lineEnd;
            lineBuffer[base + 2] = -1; // rhsStart
        } else {
            // duplicate
            lineBuffer[foundIdx * LINE_BUFFER_STRIDE] = -1;
        }
    }

    // ------------------------
    // RHS 스캔
    // ------------------------
    i = 0;
    while (i < rhsTknCount) {
        const lineStart = i;
        while (i < rhsTknCount && (rhsFlags[i++] & TOKEN_FLAGS_LINE_END) === 0);
        const lineEnd = i;

        const charPos = rhsOffsets[lineStart];
        const charLen = rhsOffsets[lineEnd] - charPos;
        if (charLen < MIN_TEXT_LEN) continue;

        let h = calculateHash(rhsBuffer, charPos, charLen);
        if (!ignoreWhitespaces) {
            // 버퍼에는 공백이 포함되어 있지 않으므로 해시에 공백의 위치를 반영해줘야함
            for (let j = lineStart; j < lineEnd; j++) {
                if (rhsFlags[j] & TOKEN_FLAGS_HAS_FOLLOWING_SPACE) {
                    const wsOffset = rhsOffsets[j + 1] - charPos; // 시작위치에서의 상대 오프셋이어야 함!
                    h ^= wsOffset;
                    h = Math.imul(h, 16777619);
                }
            }
            h = h >>> 0;
        }
        h = h & HASH_MASK;

        for (let curr = HEAD[h]; curr !== -1; curr = links[curr]) {
            const base = curr * LINE_BUFFER_STRIDE;
            const lhsStart = lineBuffer[base];
            if (lhsStart === -1) continue;

            const lhsEnd = lineBuffer[base + 1];

            if (ignoreWhitespaces || (lhsEnd - lhsStart) === (lineEnd - lineStart)) {
                if (!isTokenRangeTextEqual(lhsBuffer, lhsOffsets, lhsStart, lhsEnd,
                    rhsBuffer, rhsOffsets, lineStart, lineEnd)) {
                    continue;
                }
            }

            const rhsStartStored = lineBuffer[base + 2];

            if (rhsStartStored === -1) {
                lineBuffer[base + 2] = lineStart;
                lineBuffer[base + 3] = lineEnd;
            } else {
                // rhs duplicate
                lineBuffer[base] = -1;
            }

            break; // 텍스트 매치했으니 더 볼 필요 없음
        }
    }

    // ------------------------
    // Compaction
    // ------------------------
    let numMatches = 0;

    for (let lineIdx = 0; lineIdx < nextLineIdx; lineIdx++) {
        const base = lineIdx * LINE_BUFFER_STRIDE;

        const lhsStart = lineBuffer[base];
        if (lhsStart === -1) continue;

        const rhsStart = lineBuffer[base + 2];
        if (rhsStart === -1) continue;

        if (lineIdx !== numMatches) {
            const dst = numMatches * LINE_BUFFER_STRIDE;
            lineBuffer[dst] = lineBuffer[base];
            lineBuffer[dst + 1] = lineBuffer[base + 1];
            lineBuffer[dst + 2] = lineBuffer[base + 2];
            lineBuffer[dst + 3] = lineBuffer[base + 3];
        }

        numMatches++;
    }

    if (numMatches === 0) return [];

    // ------------------------
    // LIS (rhsStart 기준)
    // ------------------------
    const tails = new Int32Array(numMatches);
    const prev = new Int32Array(numMatches);

    let length = 0;

    for (let i = 0; i < numMatches; i++) {
        const rhsVal = lineBuffer[i * LINE_BUFFER_STRIDE + 2];

        let lo = 0;
        let hi = length;

        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            const midIdx = tails[mid];
            const midVal = lineBuffer[midIdx * LINE_BUFFER_STRIDE + 2];

            if (midVal < rhsVal) lo = mid + 1;
            else hi = mid;
        }

        tails[lo] = i;
        prev[i] = lo > 0 ? tails[lo - 1] : -1;

        if (lo === length) length++;
    }

    // const result = new Int32Array(length * 4);
    const anchors: DiffAnchor[] = new Array(length);

    let k = tails[length - 1];

    for (let i = length - 1; i >= 0; i--) {
        const base = k * LINE_BUFFER_STRIDE;
        anchors[i] = {
            lhsStart: lineBuffer[base],
            lhsEnd: lineBuffer[base + 1],
            rhsStart: lineBuffer[base + 2],
            rhsEnd: lineBuffer[base + 3],
        };
        k = prev[k];
    }

    return anchors;
}
