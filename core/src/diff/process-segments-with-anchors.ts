import { isTokenRangeTextEqual, matchPrefixTokens, matchSuffixTokens, sliceDiffInput, tokenRangeToString, writeToResultBuffer } from "./helpers";
import { runHistogramDiff } from "./run-histogram-diff";
import { type DiffJobContext, type DiffInput, type DiffAnchor, DIFF_TYPE_ADDED, DIFF_TYPE_REMOVED, DIFF_TYPE_MODIFIED, DIFF_TYPE_UNCHANGED } from "./types";


export async function processSegmentsWithAnchors(
    ctx: DiffJobContext,
    lhs: DiffInput,
    rhs: DiffInput,
    anchors: DiffAnchor[]
) {
    let lastL = 0;
    let lastR = 0;

    // console.log("=== anchors ===");
    // for (const anchor of anchors) {
    //     const textL = tokenRangeToString(lhs.buffer, lhs.offsets, anchor.lhsStart, anchor.lhsEnd);
    //     const textR = tokenRangeToString(rhs.buffer, rhs.offsets, anchor.rhsStart, anchor.rhsEnd);
    //     console.log(`lhs[${anchor.lhsStart}, ${anchor.lhsEnd}): "${textL}"`);
    //     console.log(`rhs[${anchor.rhsStart}, ${anchor.rhsEnd}): "${textR}"`);
    // }
    // console.log("===============");

    // lhs.resultBuffer.fill(0);
    // rhs.resultBuffer.fill(0);

    async function diff(lhsStart: number, lhsEnd: number, rhsStart: number, rhsEnd: number) {
        const lhsCount = lhsEnd - lhsStart;
        const rhsCount = rhsEnd - rhsStart;
        if (lhsCount === 0 && rhsCount === 0) {
            return;
        }

        if (lhsCount === 0 || rhsCount === 0) {
            const diffType = lhsCount === 0 ? DIFF_TYPE_ADDED : DIFF_TYPE_REMOVED;
            writeToResultBuffer(lhs.resultBuffer, rhs.resultBuffer, lhsStart, lhsEnd, rhsStart, rhsEnd, diffType);
            return;
        }

        if (lhsCount === 1 && rhsCount === 1) {
            let diffType = isTokenRangeTextEqual(lhs.buffer, lhs.offsets, lhsStart, lhsEnd, rhs.buffer, rhs.offsets, rhsStart, rhsEnd) ? DIFF_TYPE_UNCHANGED : DIFF_TYPE_MODIFIED;
            writeToResultBuffer(lhs.resultBuffer, rhs.resultBuffer, lhsStart, lhsEnd, rhsStart, rhsEnd, diffType);
            return;
        }

        // const ltext = tokenRangeToString(lhs.buffer, lhs.offsets, lhsStart, lhsEnd);
        // const rtext = tokenRangeToString(rhs.buffer, rhs.offsets, rhsStart, rhsEnd);
        // console.debug(`Diffing segments: lhs[${lhsStart}, ${lhsEnd}) "${ltext}", rhs[${rhsStart}, ${rhsEnd}) "${rtext}"`);

        return runHistogramDiff(
            ctx,
            sliceDiffInput(lhs, lhsStart, lhsEnd),
            sliceDiffInput(rhs, rhsStart, rhsEnd),
            lhsStart,
            rhsStart
        );
    }

    const ignoreWhitespaces = ctx.diffOptions.whitespace === "ignore";
    for (const anchor of anchors) {
        const lhsPos = anchor.lhsStart;
        const lhsEnd = anchor.lhsEnd;
        const rhsPos = anchor.rhsStart;
        const rhsEnd = anchor.rhsEnd;

        // const lText = tokenRangeToString(lhs.buffer, lhs.offsets, lhsPos, lhsEnd);
        // const rText = tokenRangeToString(rhs.buffer, rhs.offsets, rhsPos, rhsEnd);
        // console.debug(`Processing anchor: lhs[${lhsPos}, ${lhsEnd}) "${lText}", rhs[${rhsPos}, ${rhsEnd}) "${rText}" (last: lhs[${lastL}], rhs[${lastR}])`);
        // console.debug(`Processing anchor: lhs[${lhsPos}, ${lhsEnd}) "${lText}", rhs[${rhsPos}, ${rhsEnd}) "${rText}" (last: lhs[${lastL}], rhs[${lastR}])`);

        // console.debug(`Processing anchor: lhs[${lhsPos}, ${lhsEnd}), rhs[${rhsPos}, ${rhsEnd}) (last: lhs[${lastL}], rhs[${lastR}])`);
        // const textL = tokenRangeToString(lhs.buffer, lhs.offsets, lhsPos, lhsEnd);
        // const textR = tokenRangeToString(rhs.buffer, rhs.offsets, rhsPos, rhsEnd);

        if (lhsPos > lastL || rhsPos > lastR) {
            let l = lhsPos, r = rhsPos;
            // if (ignoreWhitespaces) {
            //     while (l > lastL && r > lastR) {
            //         const match = matchSuffixTokens(lhs, rhs, lastL, l, lastR, r, ignoreWhitespaces);
            //         if (match) {
            //             writeToResultBuffer(lhs.resultBuffer, rhs.resultBuffer, l - match[0], l, r - match[1], r, DIFF_TYPE_UNCHANGED);
            //             l -= match[0];
            //             r -= match[1];
            //         } else {
            //             break;
            //         }
            //     }
            // }
            if (l > lastL || r > lastR) {
                await diff(lastL, l, lastR, r);
            }
        }

        markUnchanged(lhs, rhs, lhsPos, lhsEnd, rhsPos, rhsEnd);

        lastL = lhsEnd;
        lastR = rhsEnd;
    }

    if (lastL < lhs.tokenCount || lastR < rhs.tokenCount) {
        let l = lhs.tokenCount, r = rhs.tokenCount;
        if (ignoreWhitespaces) {
            while (l > lastL && r > lastR) {
                const match = matchSuffixTokens(lhs, rhs, lastL, l, lastR, r);
                if (match) {
                    writeToResultBuffer(lhs.resultBuffer, rhs.resultBuffer, l - match[0], l, r - match[1], r, DIFF_TYPE_UNCHANGED);
                    l -= match[0];
                    r -= match[1];
                } else {
                    break;
                }
            }
        }
        if (l > lastL || r > lastR) {
            await diff(lastL, l, lastR, r);
        }
    }
}

function markUnchanged(lhs: DiffInput, rhs: DiffInput, lhsPos: number, lhsEnd: number, rhsPos: number, rhsEnd: number) {
    const lhsResultBuf = lhs.resultBuffer;
    const rhsResultBuf = rhs.resultBuffer;
    let l = lhsPos;
    let r = rhsPos;
    while (l < lhsEnd && r < rhsEnd) {
        const match = matchPrefixTokens(lhs, rhs, l, lhsEnd, r, rhsEnd);
        if (import.meta.env.DEV) {
            if (!match || match[0] <= 0 || match[1] <= 0) {
                throw new Error(`Invalid anchor match at lhs[${l}, ${lhsEnd}), rhs[${r}, ${rhsEnd})`);
            }
        }

        if (!match || match[0] === 0 || match[1] === 0) {
            if (import.meta.env.DEV) {
                console.warn(`Anchor mismatch at lhs[${l}, ${lhsEnd}), rhs[${r}, ${rhsEnd})`);
            }
            writeToResultBuffer(lhsResultBuf, rhsResultBuf, l, lhsEnd, r, rhsEnd, DIFF_TYPE_UNCHANGED);
            return;
        }

        const [lMatchLen, rMatchLen] = match;
        writeToResultBuffer(lhsResultBuf, rhsResultBuf, l, l + lMatchLen, r, r + rMatchLen, DIFF_TYPE_UNCHANGED);
        l += lMatchLen;
        r += rMatchLen;
    }
}
