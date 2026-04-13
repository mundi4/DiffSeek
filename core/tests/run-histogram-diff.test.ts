import { describe, expect, it } from 'vitest';
import { TOKEN_BUFFER_STRIDE } from '../src/constants';
import { buildDiffInput } from '../src/diff/build-diff-input';
import { buildDiffScoreSystem } from '../src/diff/build-diff-score-system';
import { getDefaultDiffOptions } from '../src/diff/get-default-diff-options';
import { runHistogramDiff } from '../src/diff/run-histogram-diff';
import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED, type DiffOptions } from '../src/diff/types';
import { tokenize } from '../src/tokenization/tokenize';
import { TOKEN_FLAGS_TYPE_STRUCTURAL } from '../src/tokenization/token-flags';

async function makeInputFromHtml(html: string, opts: DiffOptions = getDefaultDiffOptions()) {
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

    return { tokens, wholeText, ...buildDiffInput(wholeText, data, opts).input };
}

async function diffHtml(lhsHtml: string, rhsHtml: string, whitespace: 'collapse' | 'ignore') {
    const opts = getDefaultDiffOptions();
    opts.whitespace = whitespace;
    const lhs = await makeInputFromHtml(lhsHtml, opts);
    const rhs = await makeInputFromHtml(rhsHtml, opts);
    await runHistogramDiff({
        reqId: 1,
        diffOptions: opts,
        score: buildDiffScoreSystem(),
        signal: new AbortController().signal,
    }, lhs, rhs);
    return { lhs, rhs };
}

function contentTokenTypes(input: Awaited<ReturnType<typeof makeInputFromHtml>>): Array<{ text: string; type: number }> {
    const result: Array<{ text: string; type: number }> = [];
    for (let i = 0; i < input.tokens.length; i++) {
        const t = input.tokens[i]!;
        if (t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) continue;
        const text = input.wholeText.slice(t.textOffset, t.textOffset + t.textLength);
        result.push({ text, type: readType(input.resultBuffer, i) });
    }
    return result;
}

function expectAllContentUnchanged(input: Awaited<ReturnType<typeof makeInputFromHtml>>, side: string) {
    const entries = contentTokenTypes(input);
    for (const { text, type } of entries) {
        expect(type, `${side} content token "${text}" should be UNCHANGED`).toBe(DIFF_TYPE_UNCHANGED);
    }
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

describe('runHistogramDiff whitespace: ignore', () => {
    it('identical text — same tokenization — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<p>hello world</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('single joined token vs two split tokens with same normalized text — all UNCHANGED', async () => {
        // "helloworld" → 1 token, "hello world" → 2 tokens; both normalize to "helloworld"
        const { lhs, rhs } = await diffHtml('<p>helloworld</p>', '<p>hello world</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('three tokens vs one token with same normalized text — all UNCHANGED', async () => {
        // "a b c" → 3 tokens, "abc" → 1 token; both normalize to "abc"
        const { lhs, rhs } = await diffHtml('<p>a b c</p>', '<p>abc</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('Korean: joined vs space-split — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>안녕하세요</p>', '<p>안녕 하세요</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('differing tokenization inside common anchor neighborhood — all UNCHANGED', async () => {
        // Both sides have anchors "foo" and "bar"; middle differs in token boundary only
        const { lhs, rhs } = await diffHtml(
            '<p>foo hello world bar</p>',
            '<p>foo helloworld bar</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('differing tokenization inside common anchor neighborhood (reversed) — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>foo helloworld bar</p>',
            '<p>foo hello world bar</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('leading/trailing whitespace variations — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<p>  hello world  </p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('genuinely different content — common "hello" anchor, differing "world"/"there" marked MODIFIED', async () => {
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<p>hello there</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // "hello" matches on both sides
        expect(lhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Both sides have leftover single token → MODIFIED (REMOVED | ADDED)
        expect(lhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'there')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('common prefix/suffix with differing middle — anchors match, middle tokens MODIFIED', async () => {
        // lhs: "alpha bravo charlie delta"
        // rhs: "alpha XXX delta"
        const { lhs, rhs } = await diffHtml(
            '<p>alpha bravo charlie delta</p>',
            '<p>alpha XXX delta</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'alpha')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'alpha')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'delta')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'delta')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Middle: both sides have leftover content → all MODIFIED
        expect(lhsTypes.find(e => e.text === 'bravo')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(lhsTypes.find(e => e.text === 'charlie')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'XXX')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('common prefix only — lhs-joined vs rhs-split prefix matches via consume, suffix MODIFIED', async () => {
        // prefix "helloworld" (1 token) vs "hello world" (2 tokens); different suffix
        const { lhs, rhs } = await diffHtml(
            '<p>helloworld foo</p>',
            '<p>hello world bar</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'helloworld')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Both sides have leftover suffix → MODIFIED
        expect(lhsTypes.find(e => e.text === 'foo')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'bar')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('common suffix only — lhs-joined vs rhs-split suffix matches via consume, prefix MODIFIED', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>foo helloworld</p>',
            '<p>bar hello world</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'helloworld')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Both sides have leftover prefix → MODIFIED
        expect(lhsTypes.find(e => e.text === 'foo')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'bar')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('lhs-only leftover after prefix match — ADDED/REMOVED when one side is empty', async () => {
        // lhs has extra trailing token; rhs is prefix
        const { lhs } = await diffHtml('<p>helloworld foo</p>', '<p>hello world</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        expect(lhsTypes.find(e => e.text === 'helloworld')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // "foo" only on lhs → REMOVED
        expect(lhsTypes.find(e => e.text === 'foo')?.type).toBe(DIFF_TYPE_REMOVED);
    });

    it('rhs-only leftover after prefix match — ADDED when one side is empty', async () => {
        const { rhs } = await diffHtml('<p>helloworld</p>', '<p>hello world bar</p>', 'ignore');
        const rhsTypes = contentTokenTypes(rhs);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // "bar" only on rhs → ADDED
        expect(rhsTypes.find(e => e.text === 'bar')?.type).toBe(DIFF_TYPE_ADDED);
    });
});

describe('runHistogramDiff whitespace: collapse', () => {
    it('identical text — same tokenization — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<p>hello world</p>', 'collapse');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('multiple whitespace runs vs single whitespace — all UNCHANGED', async () => {
        // Multiple spaces collapse to a single space
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<p>hello     world</p>', 'collapse');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('tab vs space — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<p>hello\tworld</p>', 'collapse');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('joined "helloworld" vs split "hello world" — NOT all UNCHANGED (collapse preserves inner whitespace difference)', async () => {
        // In collapse mode, these are semantically different: "helloworld" is one word, "hello world" is two.
        const { lhs, rhs } = await diffHtml('<p>helloworld</p>', '<p>hello world</p>', 'collapse');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // "helloworld" should not trivially match "hello" or "world"
        expect(lhsTypes.find(e => e.text === 'helloworld')?.type).not.toBe(DIFF_TYPE_UNCHANGED);
        // At least one of rhs tokens should not be UNCHANGED either
        const allRhsUnchanged = rhsTypes.every(e => e.type === DIFF_TYPE_UNCHANGED);
        expect(allRhsUnchanged).toBe(false);
    });

    it('genuinely different content — "hello" anchor matches, differing tokens MODIFIED', async () => {
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<p>hello there</p>', 'collapse');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Both sides have leftover single token → MODIFIED
        expect(lhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'there')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('common prefix/suffix with different middle — anchors match, middle MODIFIED', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>alpha bravo charlie delta</p>',
            '<p>alpha XXX delta</p>',
            'collapse',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'alpha')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'delta')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'alpha')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'delta')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Middle: both sides have leftover tokens → MODIFIED
        expect(lhsTypes.find(e => e.text === 'bravo')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(lhsTypes.find(e => e.text === 'charlie')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'XXX')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('pure lhs removal — REMOVED when rhs has no leftover', async () => {
        // lhs has extra token that rhs does not
        const { lhs } = await diffHtml('<p>hello extra world</p>', '<p>hello world</p>', 'collapse');
        const lhsTypes = contentTokenTypes(lhs);
        expect(lhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'extra')?.type).toBe(DIFF_TYPE_REMOVED);
    });

    it('pure rhs addition — ADDED when lhs has no leftover', async () => {
        const { rhs } = await diffHtml('<p>hello world</p>', '<p>hello new world</p>', 'collapse');
        const rhsTypes = contentTokenTypes(rhs);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'new')?.type).toBe(DIFF_TYPE_ADDED);
    });
});
