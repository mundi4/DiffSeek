import { describe, expect, it } from 'vitest';
import { TOKEN_BUFFER_STRIDE } from '../src/constants';
import { buildDiffInput } from '../src/diff/build-diff-input';
import { buildDiffScoreSystem } from '../src/diff/build-diff-score-system';
import { getDefaultDiffOptions } from '../src/diff/get-default-diff-options';
import { runHistogramDiff } from '../src/diff/run-histogram-diff';
import { DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED } from '../src/diff/types';
import { tokenize } from '../src/tokenization/tokenize';
import { TOKEN_FLAGS_TYPE_STRUCTURAL } from '../src/tokenization/token-flags';

async function makeInputFromHtml(html: string) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const signal = new AbortController().signal;
    const { tokens, wholeText } = await tokenize(div, signal);

    const data = new Int32Array(tokens.length * TOKEN_BUFFER_STRIDE);
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]!;
        data[i * TOKEN_BUFFER_STRIDE + 0] = t.textOffset;
        data[i * TOKEN_BUFFER_STRIDE + 1] = t.textLength;
        data[i * TOKEN_BUFFER_STRIDE + 2] = t.flags;
    }

    return { tokens, wholeText, ...buildDiffInput(wholeText, data, getDefaultDiffOptions()).input };
}

function readType(resultBuffer: Int32Array, i: number) {
    return resultBuffer[i * TOKEN_BUFFER_STRIDE + 4]!;
}

describe('runHistogramDiff structural token case', () => {
    it('keeps structural pairs aligned and removes only content tokens', async () => {
        const lhs = await makeInputFromHtml('<table><tr><td>연령</td><td>만 세</td><td></td><td>현주소</td></tr></table>');
        const rhs = await makeInputFromHtml('<table><tr><td></td><td></td><td></td><td>현주소</td></tr></table>');

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        // structural 토큰은 모두 UNCHANGED여야 함
        for (let i = 0; i < lhs.tokens.length; i++) {
            if (lhs.tokens[i]!.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) {
                expect(readType(lhs.resultBuffer, i), `lhs structural token[${i}]`).toBe(DIFF_TYPE_UNCHANGED);
            }
        }
        for (let i = 0; i < rhs.tokens.length; i++) {
            if (rhs.tokens[i]!.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) {
                expect(readType(rhs.resultBuffer, i), `rhs structural token[${i}]`).toBe(DIFF_TYPE_UNCHANGED);
            }
        }

        // content 토큰 확인
        for (let i = 0; i < lhs.tokens.length; i++) {
            const t = lhs.tokens[i]!;
            if (t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) continue;
            const text = lhs.wholeText.slice(t.textOffset, t.textOffset + t.textLength);
            const type = readType(lhs.resultBuffer, i);
            if (text === '연령' || text === '만세') {
                expect(type, `lhs "${text}" should be REMOVED`).toBe(DIFF_TYPE_REMOVED);
            } else if (text === '현주소') {
                expect(type, `lhs "현주소" should be UNCHANGED`).toBe(DIFF_TYPE_UNCHANGED);
            }
        }
    });

    it('uses occurrence order instead of cross matching when repeated anchors have equal counts', async () => {
        const lhs = await makeInputFromHtml('<table><tr><td>alpha</td><td>beta</td><td></td><td>tail</td></tr></table>');
        const rhs = await makeInputFromHtml('<table><tr><td></td><td></td><td></td><td>tail</td></tr></table>');

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        // structural 토큰은 모두 UNCHANGED여야 함
        for (let i = 0; i < lhs.tokens.length; i++) {
            if (lhs.tokens[i]!.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) {
                expect(readType(lhs.resultBuffer, i), `lhs structural token[${i}]`).toBe(DIFF_TYPE_UNCHANGED);
            }
        }
        for (let i = 0; i < rhs.tokens.length; i++) {
            if (rhs.tokens[i]!.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) {
                expect(readType(rhs.resultBuffer, i), `rhs structural token[${i}]`).toBe(DIFF_TYPE_UNCHANGED);
            }
        }

        // content 토큰 확인
        for (let i = 0; i < lhs.tokens.length; i++) {
            const t = lhs.tokens[i]!;
            if (t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) continue;
            const text = lhs.wholeText.slice(t.textOffset, t.textOffset + t.textLength);
            const type = readType(lhs.resultBuffer, i);
            if (text === 'alpha' || text === 'beta') {
                expect(type, `lhs "${text}" should be REMOVED`).toBe(DIFF_TYPE_REMOVED);
            } else if (text === 'tail') {
                expect(type, `lhs "tail" should be UNCHANGED`).toBe(DIFF_TYPE_UNCHANGED);
            }
        }
    });
});
