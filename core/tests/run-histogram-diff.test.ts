import { describe, expect, it } from 'vitest';
import { TOKEN_BUFFER_STRIDE } from '../src/constants';
import { buildDiffInput } from '../src/diff/build-diff-input';
import { buildDiffScoreSystem } from '../src/diff/build-diff-score-system';
import { getDefaultDiffOptions } from '../src/diff/get-default-diff-options';
import { runHistogramDiff } from '../src/diff/run-histogram-diff';
import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED } from '../src/diff/types';
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

function readRange(resultBuffer: Int32Array, i: number) {
    const base = i * TOKEN_BUFFER_STRIDE;
    return {
        selfStart: resultBuffer[base + 0]!,
        selfEnd: resultBuffer[base + 1]!,
        otherStart: resultBuffer[base + 2]!,
        otherEnd: resultBuffer[base + 3]!,
        type: resultBuffer[base + 4]!,
    };
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

describe('runHistogramDiff resultBuffer range values', () => {
    it('UNCHANGED tokens have consistent range values on both sides', async () => {
        const lhs = await makeInputFromHtml('<p>hello world</p>');
        const rhs = await makeInputFromHtml('<p>hello world</p>');

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        // All tokens should be UNCHANGED
        for (let i = 0; i < lhs.tokenCount; i++) {
            const lr = readRange(lhs.resultBuffer, i);
            expect(lr.type, `lhs token[${i}] type`).toBe(DIFF_TYPE_UNCHANGED);
            // selfStart <= i < selfEnd
            expect(i).toBeGreaterThanOrEqual(lr.selfStart);
            expect(i).toBeLessThan(lr.selfEnd);
        }
        for (let i = 0; i < rhs.tokenCount; i++) {
            const rr = readRange(rhs.resultBuffer, i);
            expect(rr.type, `rhs token[${i}] type`).toBe(DIFF_TYPE_UNCHANGED);
            expect(i).toBeGreaterThanOrEqual(rr.selfStart);
            expect(i).toBeLessThan(rr.selfEnd);
        }
    });

    it('REMOVED tokens have empty other-side range', async () => {
        const lhs = await makeInputFromHtml('<p>hello extra world</p>');
        const rhs = await makeInputFromHtml('<p>hello world</p>');

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        for (let i = 0; i < lhs.tokenCount; i++) {
            const lr = readRange(lhs.resultBuffer, i);
            if (lr.type === DIFF_TYPE_REMOVED) {
                // REMOVED: other side should be empty (otherStart === otherEnd)
                expect(lr.otherStart, `lhs REMOVED token[${i}] otherStart === otherEnd`).toBe(lr.otherEnd);
            }
        }
    });

    it('ADDED tokens on rhs have empty self-side range on lhs', async () => {
        const lhs = await makeInputFromHtml('<p>hello world</p>');
        const rhs = await makeInputFromHtml('<p>hello extra world</p>');

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        for (let i = 0; i < rhs.tokenCount; i++) {
            const rr = readRange(rhs.resultBuffer, i);
            if (rr.type === DIFF_TYPE_ADDED) {
                // ADDED: other side (lhs) should be empty
                expect(rr.otherStart, `rhs ADDED token[${i}] otherStart === otherEnd`).toBe(rr.otherEnd);
            }
        }
    });

    it('range values are self-consistent: selfStart <= tokenIndex < selfEnd for every token', async () => {
        const lhs = await makeInputFromHtml('<table><tr><td>A</td><td>B</td></tr></table>');
        const rhs = await makeInputFromHtml('<table><tr><td></td><td>B</td></tr></table>');

        await runHistogramDiff({
            reqId: 1,
            diffOptions: getDefaultDiffOptions(),
            score: buildDiffScoreSystem(),
            signal: new AbortController().signal,
        }, lhs, rhs);

        for (let i = 0; i < lhs.tokenCount; i++) {
            const lr = readRange(lhs.resultBuffer, i);
            expect(lr.selfEnd, `lhs token[${i}] selfEnd > selfStart`).toBeGreaterThan(lr.selfStart);
            expect(i, `lhs token[${i}] should be >= selfStart(${lr.selfStart})`).toBeGreaterThanOrEqual(lr.selfStart);
            expect(i, `lhs token[${i}] should be < selfEnd(${lr.selfEnd})`).toBeLessThan(lr.selfEnd);
            // otherEnd >= otherStart (may be equal for REMOVED/ADDED)
            expect(lr.otherEnd, `lhs token[${i}] otherEnd >= otherStart`).toBeGreaterThanOrEqual(lr.otherStart);
        }
        for (let i = 0; i < rhs.tokenCount; i++) {
            const rr = readRange(rhs.resultBuffer, i);
            expect(rr.selfEnd, `rhs token[${i}] selfEnd > selfStart`).toBeGreaterThan(rr.selfStart);
            expect(i, `rhs token[${i}] should be >= selfStart(${rr.selfStart})`).toBeGreaterThanOrEqual(rr.selfStart);
            expect(i, `rhs token[${i}] should be < selfEnd(${rr.selfEnd})`).toBeLessThan(rr.selfEnd);
            expect(rr.otherEnd, `rhs token[${i}] otherEnd >= otherStart`).toBeGreaterThanOrEqual(rr.otherStart);
        }
    });
});
