import { describe, expect, it } from 'vitest';
import { STRUCTURAL_TD_CLOSE_TEXT, STRUCTURAL_TD_OPEN_TEXT, TOKEN_BUFFER_STRIDE } from '../src/constants';
import { buildDiffInput } from '../src/diff/build-diff-input';
import { buildDiffScoreSystem } from '../src/diff/build-diff-score-system';
import { getDefaultDiffOptions } from '../src/diff/get-default-diff-options';
import { runHistogramDiff } from '../src/diff/run-histogram-diff';
import { DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED } from '../src/diff/types';
import {
    TOKEN_FLAGS_TYPE_STRUCTURAL,
    TOKEN_FLAGS_TYPE_TEXT,
    TOKEN_FLAGS_STRUCTURAL_OPEN,
} from '../src/tokenization/token-flags';

type TokenSpec = {
    text: string;
    flags: number;
};

function structuralClose(): TokenSpec {
    return { text: STRUCTURAL_TD_CLOSE_TEXT, flags: TOKEN_FLAGS_TYPE_STRUCTURAL };
}

function structuralOpen(): TokenSpec {
    return { text: STRUCTURAL_TD_OPEN_TEXT, flags: TOKEN_FLAGS_TYPE_STRUCTURAL | TOKEN_FLAGS_STRUCTURAL_OPEN };
}

function text(value: string): TokenSpec {
    return { text: value, flags: TOKEN_FLAGS_TYPE_TEXT };
}

function makeInput(tokens: TokenSpec[]) {
    let wholeText = '';
    let offset = 0;
    const data = new Int32Array(tokens.length * TOKEN_BUFFER_STRIDE);

    for (let i = 0; i < tokens.length; i++) {
        const base = i * TOKEN_BUFFER_STRIDE;
        const token = tokens[i]!;
        wholeText += token.text;
        data[base] = offset;
        data[base + 1] = token.text.length;
        data[base + 2] = token.flags;
        offset += token.text.length;
    }

    return buildDiffInput(wholeText, data, getDefaultDiffOptions()).input;
}

function readTypes(resultBuffer: Int32Array, tokenCount: number) {
    const out: number[] = [];
    for (let i = 0; i < tokenCount; i++) {
        out.push(resultBuffer[i * TOKEN_BUFFER_STRIDE + 4]!);
    }
    return out;
}

describe('runHistogramDiff structural token case', () => {
    it('keeps structural pairs aligned and removes only content tokens', async () => {
        const lhsTokens = [
            structuralClose(),
            structuralOpen(),
            text('연령'),
            structuralClose(),
            structuralOpen(),
            text('만세'),
            structuralClose(),
            structuralOpen(),
            structuralClose(),
            structuralOpen(),
            text('현주소'),
        ];
        const rhsTokens = [
            structuralClose(),
            structuralOpen(),
            structuralClose(),
            structuralOpen(),
            structuralClose(),
            structuralOpen(),
            structuralClose(),
            structuralOpen(),
            text('현주소'),
        ];

        const lhs = makeInput(lhsTokens);
        const rhs = makeInput(rhsTokens);

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        expect(readTypes(lhs.resultBuffer, lhs.tokenCount)).toEqual([
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_REMOVED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_REMOVED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
        ]);
        expect(readTypes(rhs.resultBuffer, rhs.tokenCount)).toEqual([
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
        ]);
    });

    it('uses occurrence order instead of cross matching when repeated anchors have equal counts', async () => {
        const lhsTokens = [
            structuralClose(),
            structuralOpen(),
            text('alpha'),
            structuralClose(),
            structuralOpen(),
            text('beta'),
            structuralClose(),
            structuralOpen(),
            structuralClose(),
            structuralOpen(),
            text('tail'),
        ];
        const rhsTokens = [
            structuralClose(),
            structuralOpen(),
            structuralClose(),
            structuralOpen(),
            structuralClose(),
            structuralOpen(),
            structuralClose(),
            structuralOpen(),
            text('tail'),
        ];

        const lhs = makeInput(lhsTokens);
        const rhs = makeInput(rhsTokens);

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        expect(readTypes(lhs.resultBuffer, lhs.tokenCount)).toEqual([
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_REMOVED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_REMOVED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
        ]);
        expect(readTypes(rhs.resultBuffer, rhs.tokenCount)).toEqual([
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
            DIFF_TYPE_UNCHANGED,
        ]);
    });
});
