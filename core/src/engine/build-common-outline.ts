import { TOKEN_BUFFER_STRIDE } from "../constants";
import { HEADING_MASK, TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_LINE_END, type Token } from "../tokenization";
import type { CommonOutlineHeading } from "./types";

type BuildCommonOutlineParams = {
    leftWholeText: string;
    rightWholeText: string;
    leftTokens: readonly Token[];
    rightTokens: readonly Token[];
    leftResultBuffer: Readonly<Int32Array>;
};

type HeadingPair = {
    leftIndex: number;
    rightIndex: number;
    leftSpan: { start: number; end: number };
    rightSpan: { start: number; end: number };
};

function getTokenText(wholeText: string, token: Token): string {
    return wholeText.slice(token.textOffset, token.textOffset + token.textLength);
}

function collectHeadingLineText(wholeText: string, tokens: readonly Token[], headingTokenIndex: number): string {
    let result = "";
    for (let i = headingTokenIndex; i < tokens.length; i++) {
        const token = tokens[i];
        result += getTokenText(wholeText, token);

        const flags = token.flags;
        if ((flags & TOKEN_FLAGS_LINE_END) !== 0) {
            break;
        }
        if ((flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE) !== 0) {
            result += " ";
        }
    }
    return result.trim();
}

export function buildCommonOutline(params: BuildCommonOutlineParams): CommonOutlineHeading[] {
    const {
        leftWholeText,
        rightWholeText,
        leftTokens,
        rightTokens,
        leftResultBuffer,
    } = params;

    const headings: CommonOutlineHeading[] = [];
    const rightHeadingSet = new Set<number>();

    const leftHeadingIndexes: number[] = [];
    for (let i = 0; i < leftTokens.length; i++) {
        if ((leftTokens[i].flags & HEADING_MASK) !== 0) {
            leftHeadingIndexes.push(i);
        }
    }

    for (let i = 0; i < rightTokens.length; i++) {
        if ((rightTokens[i].flags & HEADING_MASK) !== 0) {
            rightHeadingSet.add(i);
        }
    }

    const pairs: HeadingPair[] = [];

    for (const leftHeadingTokenIndex of leftHeadingIndexes) {
        const leftHeadingToken = leftTokens[leftHeadingTokenIndex];
        const base = leftHeadingTokenIndex * TOKEN_BUFFER_STRIDE;
        const leftStart = leftResultBuffer[base + 0];
        const leftEnd = leftResultBuffer[base + 1];
        const rightStart = leftResultBuffer[base + 2];
        const rightEnd = leftResultBuffer[base + 3];

        if (leftStart !== leftHeadingTokenIndex || rightStart >= rightEnd) {
            continue;
        }
        if (!rightHeadingSet.has(rightStart)) {
            continue;
        }

        pairs.push({
            leftIndex: leftHeadingTokenIndex,
            rightIndex: rightStart,
            leftSpan: { start: leftStart, end: leftEnd },
            rightSpan: { start: rightStart, end: rightEnd },
        });
    }

    if (pairs.length === 0) {
        return headings;
    }

    // rhs 인덱스 기준 LIS로 교차 매칭을 제거하여 순서가 일관된 공통 목차만 남긴다.
    const tails = new Int32Array(pairs.length);
    const prev = new Int32Array(pairs.length);
    let lisLength = 0;

    for (let i = 0; i < pairs.length; i++) {
        const rhsVal = pairs[i].rightIndex;

        let lo = 0;
        let hi = lisLength;

        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            const midIdx = tails[mid];
            const midVal = pairs[midIdx].rightIndex;
            if (midVal < rhsVal) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }

        tails[lo] = i;
        prev[i] = lo > 0 ? tails[lo - 1] : -1;
        if (lo === lisLength) {
            lisLength++;
        }
    }

    const lisIndexes = new Int32Array(lisLength);
    let k = tails[lisLength - 1];
    for (let i = lisLength - 1; i >= 0; i--) {
        lisIndexes[i] = k;
        k = prev[k];
    }

    for (let i = 0; i < lisIndexes.length; i++) {
        const pair = pairs[lisIndexes[i]];
        const leftHeadingTokenIndex = pair.leftIndex;
        const rightStart = pair.rightIndex;
        const leftHeadingToken = leftTokens[leftHeadingTokenIndex];
        const rightHeadingToken = rightTokens[rightStart];

        headings.push({
            index: headings.length,
            leftTokenIndex: leftHeadingTokenIndex,
            rightTokenIndex: rightStart,
            leftLineNumber: leftHeadingToken.lineNumber,
            rightLineNumber: rightHeadingToken.lineNumber,
            leftHeadingFlags: leftHeadingToken.flags & HEADING_MASK,
            rightHeadingFlags: rightHeadingToken.flags & HEADING_MASK,
            leftSpan: pair.leftSpan,
            rightSpan: pair.rightSpan,
            leftLabel: collectHeadingLineText(leftWholeText, leftTokens, leftHeadingTokenIndex),
            rightLabel: collectHeadingLineText(rightWholeText, rightTokens, rightStart),
        });
    }

    return headings;
}
