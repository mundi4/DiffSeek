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

describe('runHistogramDiff whitespace: ignore — edge cases', () => {
    it('match starts after a single differing head token', async () => {
        // First tokens differ; rest should match via suffix consume (n:m)
        const { lhs, rhs } = await diffHtml(
            '<p>alpha helloworld tail</p>',
            '<p>beta hello world tail</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // Head differs → MODIFIED (both sides have leftover)
        expect(lhsTypes.find(e => e.text === 'alpha')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'beta')?.type).toBe(DIFF_TYPE_MODIFIED);
        // Middle matches via n:m consume
        expect(lhsTypes.find(e => e.text === 'helloworld')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Tail matches via SA (identical token)
        expect(lhsTypes.find(e => e.text === 'tail')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'tail')?.type).toBe(DIFF_TYPE_UNCHANGED);
    });

    it('match ends before a single differing tail token', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>head helloworld alpha</p>',
            '<p>head hello world beta</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'head')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'head')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'helloworld')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'alpha')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'beta')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('extreme 1:N split — "abcdef" vs "a b c d e f" — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>abcdef</p>', '<p>a b c d e f</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('extreme N:1 split — "h e l l o" vs "hello" — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>h e l l o</p>', '<p>hello</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('boundary-misaligned 2:2 — "abc def" vs "abcd ef" — all UNCHANGED', async () => {
        // Both sides have 2 tokens but split at different positions; normalized text is identical
        const { lhs, rhs } = await diffHtml('<p>abc def</p>', '<p>abcd ef</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('boundary-misaligned 3:2 — "ab cd ef" vs "abcd ef" — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>ab cd ef</p>', '<p>abcd ef</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('boundary-misaligned 3:3 — "ab cd ef" vs "abc de f" — all UNCHANGED', async () => {
        const { lhs, rhs } = await diffHtml('<p>ab cd ef</p>', '<p>abc de f</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('n:m middle surrounded by SA-matchable anchors — all UNCHANGED', async () => {
        // "XXX" and "YYY" match as SA anchors; middle "abcdef" vs "a b c d e f" via n:m consume
        const { lhs, rhs } = await diffHtml(
            '<p>XXX abcdef YYY</p>',
            '<p>XXX a b c d e f YYY</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('multiple separate n:m match regions — all UNCHANGED', async () => {
        // Two n:m regions separated by a common anchor
        const { lhs, rhs } = await diffHtml(
            '<p>abcdef mid ghijkl</p>',
            '<p>a b c d e f mid g h i j k l</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('n:m match content identical but surrounding tokens completely differ (no anchors) — LIMITATION: all MODIFIED', async () => {
        // No SA anchors (no shared token IDs).
        // consumeCommonEdges(3) tries prefix "foo" vs "baz" (equal length ≠ match) → break,
        // then suffix "bar" vs "qux" (equal length ≠ match) → break.
        // Middle n:m is NEVER examined because the algorithm only consumes from edges.
        // This documents a known limitation of the current histogram-diff algorithm.
        const { lhs, rhs } = await diffHtml(
            '<p>foo abcdef bar</p>',
            '<p>baz a b c d e f qux</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // Everything is MODIFIED because both sides have leftover content in the else branch.
        for (const { text, type } of lhsTypes) {
            expect(type, `lhs "${text}" expected MODIFIED`).toBe(DIFF_TYPE_MODIFIED);
        }
        for (const { text, type } of rhsTypes) {
            expect(type, `rhs "${text}" expected MODIFIED`).toBe(DIFF_TYPE_MODIFIED);
        }
    });

    it('n:m match with one-side garbage surrounding (prefix garbage only)', async () => {
        // lhs has garbage head; rhs has garbage head; but tail "end" matches as SA anchor
        const { lhs, rhs } = await diffHtml(
            '<p>XXX abcdef end</p>',
            '<p>YYY a b c d e f end</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // "end" is the SA anchor
        expect(lhsTypes.find(e => e.text === 'end')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'end')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Middle n:m via suffix consume in the sub-diff
        expect(lhsTypes.find(e => e.text === 'abcdef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'a')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'f')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Head garbage: both sides have leftover → MODIFIED
        expect(lhsTypes.find(e => e.text === 'XXX')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'YYY')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('n:m match with one-side garbage surrounding (suffix garbage only)', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>start abcdef XXX</p>',
            '<p>start a b c d e f YYY</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'start')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'start')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'abcdef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'a')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'f')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'XXX')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'YYY')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('n:m match span values — UNCHANGED tokens in a match region report the full span', async () => {
        // lhs: "abcdef" (1 token), rhs: "a b c" + "def" (need rhs to match)
        // Simpler: lhs ["abcdef"] vs rhs ["a", "b", "c", "d", "e", "f"]
        // Expected: lhs token 0 has otherStart=0, otherEnd=6 (covering all 6 rhs tokens)
        //           rhs tokens 0..5 each have otherStart=0, otherEnd=1 (covering the single lhs token)
        const { lhs, rhs } = await diffHtml('<p>abcdef</p>', '<p>a b c d e f</p>', 'ignore');
        const lhsRange = readRange(lhs.resultBuffer, 0);
        expect(lhsRange.type, 'lhs[0] type').toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsRange.selfStart, 'lhs[0] selfStart').toBe(0);
        expect(lhsRange.selfEnd, 'lhs[0] selfEnd').toBe(1);
        expect(lhsRange.otherStart, 'lhs[0] otherStart').toBe(0);
        expect(lhsRange.otherEnd, 'lhs[0] otherEnd').toBe(6);

        for (let i = 0; i < 6; i++) {
            const rr = readRange(rhs.resultBuffer, i);
            expect(rr.type, `rhs[${i}] type`).toBe(DIFF_TYPE_UNCHANGED);
            expect(rr.selfStart, `rhs[${i}] selfStart`).toBe(0);
            expect(rr.selfEnd, `rhs[${i}] selfEnd`).toBe(6);
            expect(rr.otherStart, `rhs[${i}] otherStart`).toBe(0);
            expect(rr.otherEnd, `rhs[${i}] otherEnd`).toBe(1);
        }
    });

    it('two separate n:m regions — each reports its own span', async () => {
        // lhs: ["abc", "mid", "def"] (3 tokens)
        // rhs: ["a", "b", "c", "mid", "d", "e", "f"] (7 tokens, "mid" at index 3)
        // Expected:
        //   lhs[0] ("abc"): UNCHANGED, otherStart=0, otherEnd=3
        //   lhs[1] ("mid"): UNCHANGED, otherStart=3, otherEnd=4
        //   lhs[2] ("def"): UNCHANGED, otherStart=4, otherEnd=7
        const { lhs, rhs } = await diffHtml(
            '<p>abc mid def</p>',
            '<p>a b c mid d e f</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        // All lhs tokens should be UNCHANGED
        for (const { text, type } of lhsTypes) {
            expect(type, `lhs "${text}" UNCHANGED`).toBe(DIFF_TYPE_UNCHANGED);
        }
        const lhsAbc = readRange(lhs.resultBuffer, lhs.tokens.findIndex(t =>
            lhs.wholeText.slice(t.textOffset, t.textOffset + t.textLength) === 'abc'));
        expect(lhsAbc.otherEnd - lhsAbc.otherStart, 'lhs "abc" other span').toBe(3);

        const lhsDef = readRange(lhs.resultBuffer, lhs.tokens.findIndex(t =>
            lhs.wholeText.slice(t.textOffset, t.textOffset + t.textLength) === 'def'));
        expect(lhsDef.otherEnd - lhsDef.otherStart, 'lhs "def" other span').toBe(3);
    });
});
