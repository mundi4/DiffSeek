import { beforeAll, describe, expect, it } from 'vitest';
import { TOKEN_BUFFER_STRIDE } from '../src/constants';
import { buildDiffInput } from '../src/diff/build-diff-input';
import { buildDiffScoreSystem } from '../src/diff/build-diff-score-system';
import { getDefaultDiffOptions } from '../src/diff/get-default-diff-options';
import { runHistogramDiff } from '../src/diff/run-histogram-diff';
import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED, type DiffOptions } from '../src/diff/types';
import { tokenize } from '../src/tokenization/tokenize';
import { TOKEN_FLAGS_TYPE_STRUCTURAL } from '../src/tokenization/token-flags';

beforeAll(() => {
    if (typeof (globalThis as any).scheduler?.yield !== 'function') {
        (globalThis as any).scheduler = {
            ...(globalThis as any).scheduler,
            yield: () => Promise.resolve(),
        };
    }
});

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

    it('PROBE: "bc ef" vs "a b cef" — lhs fully matches rhs suffix; rhs "a" is ADDED', async () => {
        // lhs buffer (ignore): "bcef" (2 tokens: "bc", "ef")
        // rhs buffer (ignore): "abcef" (3 tokens: "a", "b", "cef")
        // Expected: matchSuffixTokens walks backward, matches lhs ["bc","ef"] with rhs ["b","cef"].
        // "a" on rhs has no counterpart on lhs → ADDED.
        const { lhs, rhs } = await diffHtml('<p>bc ef</p>', '<p>a b cef</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'bc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'ef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'b')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'cef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // "a" has no match on lhs → pure ADDED
        expect(rhsTypes.find(e => e.text === 'a')?.type).toBe(DIFF_TYPE_ADDED);
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

describe('runHistogramDiff whitespace: ignore — probes for failure cases', () => {
    it('PROBE: cross-aligned n:m where both sides have >1 token and buffers are identical', async () => {
        // lhs buffer "abcdef" via ["abc","def"]
        // rhs buffer "abcdef" via ["ab","cdef"]
        // Both sides have 2 tokens but split differently
        const { lhs, rhs } = await diffHtml('<p>abc def</p>', '<p>ab cdef</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: multi-step zig-zag boundary 2:3 — "abc def" vs "ab cde f"', async () => {
        const { lhs, rhs } = await diffHtml('<p>abc def</p>', '<p>ab cde f</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: 4:3 zig-zag — "a bc def ghij" vs "abc defg hij"', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>a bc def ghij</p>',
            '<p>abc defg hij</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: single-char tokens all the way — "a b c d e" vs "abcde"', async () => {
        const { lhs, rhs } = await diffHtml('<p>a b c d e</p>', '<p>abcde</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: repeating tokens "abc abc abc" vs "a b c a b c a b c"', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>abc abc abc</p>',
            '<p>a b c a b c a b c</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: reverse of the "bc ef" / "a b cef" case — "a b cef" vs "bc ef"', async () => {
        // Same as the previous but with sides swapped. "a" is REMOVED on lhs side.
        const { lhs, rhs } = await diffHtml('<p>a b cef</p>', '<p>bc ef</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'a')?.type).toBe(DIFF_TYPE_REMOVED);
        expect(lhsTypes.find(e => e.text === 'b')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'cef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'bc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'ef')?.type).toBe(DIFF_TYPE_UNCHANGED);
    });

    it('PROBE: both-side leading garbage + suffix match — "X bc ef" vs "Y b cef"', async () => {
        // "X" and "Y" are single-char garbage; suffix "bcef" matches via n:m
        const { lhs, rhs } = await diffHtml('<p>X bc ef</p>', '<p>Y b cef</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'bc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'ef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'b')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'cef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        // Both sides have leftover head (single char, different) → MODIFIED
        expect(lhsTypes.find(e => e.text === 'X')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'Y')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('PROBE: head matches, tail n:m — "head abc def" vs "head a b c d e f"', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>head abc def</p>',
            '<p>head a b c d e f</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: tail matches, head n:m — "abc def tail" vs "a b c d e f tail"', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>abc def tail</p>',
            '<p>a b c d e f tail</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: n:m middle with SAME single-char wrapper on both sides — "X abc X" vs "X a b c X"', async () => {
        const { lhs, rhs } = await diffHtml('<p>X abc X</p>', '<p>X a b c X</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: ambiguous — multiple possible n:m splits', async () => {
        // lhs buffer "abab", rhs buffer "abab", split differently
        // lhs ["ab","ab"] vs rhs ["a","bab"]
        const { lhs, rhs } = await diffHtml('<p>ab ab</p>', '<p>a bab</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: partial-match-only — "abcxyz" vs "abc xyz different"', async () => {
        // lhs "abcxyz" (1 token), rhs "abc xyz different" (3 tokens)
        // prefix matches "abcxyz" vs "abc"+"xyz" → lhs fully consumed, rhs "different" left
        const { lhs, rhs } = await diffHtml('<p>abcxyz</p>', '<p>abc xyz different</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'abcxyz')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'abc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'xyz')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'different')?.type).toBe(DIFF_TYPE_ADDED);
    });

    it('PROBE: tail-match-only — "different abcxyz" vs "abc xyz"', async () => {
        const { lhs, rhs } = await diffHtml('<p>different abcxyz</p>', '<p>abc xyz</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'abcxyz')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'abc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'xyz')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'different')?.type).toBe(DIFF_TYPE_REMOVED);
    });

    it('PROBE: both prefix and suffix n:m match — "XXX abc def YYY" vs "XXX a b c d e f YYY"', async () => {
        const { lhs, rhs } = await diffHtml(
            '<p>XXX abc def YYY</p>',
            '<p>XXX a b c d e f YYY</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: SA-matchable token IDENTICAL but middle n:m — "A bc A def A" vs "A b c A d e f A"', async () => {
        // Repeated "A" anchor. The sub-regions between anchors have n:m matches.
        const { lhs, rhs } = await diffHtml(
            '<p>A bc A def A</p>',
            '<p>A b c A d e f A</p>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: empty lhs vs non-empty rhs — all ADDED', async () => {
        const { lhs, rhs } = await diffHtml('<p></p>', '<p>hello world</p>', 'ignore');
        expect(contentTokenTypes(lhs).length).toBe(0);
        const rhsTypes = contentTokenTypes(rhs);
        for (const { text, type } of rhsTypes) {
            expect(type, `rhs "${text}" should be ADDED`).toBe(DIFF_TYPE_ADDED);
        }
    });

    it('PROBE: non-empty lhs vs empty rhs — all REMOVED', async () => {
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<p></p>', 'ignore');
        expect(contentTokenTypes(rhs).length).toBe(0);
        const lhsTypes = contentTokenTypes(lhs);
        for (const { text, type } of lhsTypes) {
            expect(type, `lhs "${text}" should be REMOVED`).toBe(DIFF_TYPE_REMOVED);
        }
    });

    it('PROBE: identical content wrapped in completely different structural tokens — <p> vs <div>', async () => {
        // Structural tokens differ but content is the same
        const { lhs, rhs } = await diffHtml('<p>hello world</p>', '<div>hello world</div>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // Content tokens should match
        expect(lhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'hello')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'world')?.type).toBe(DIFF_TYPE_UNCHANGED);
    });

    it('PROBE: <br> vs space — line break should normalize like whitespace in ignore mode', async () => {
        // <br> creates LINE_END flag; in ignore mode, no space is inserted anyway
        const { lhs, rhs } = await diffHtml('<p>hello<br>world</p>', '<p>hello world</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: tab vs space vs no-whitespace in ignore mode', async () => {
        const { lhs, rhs } = await diffHtml('<p>hello\tworld</p>', '<p>helloworld</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: leading/trailing whitespace only differences', async () => {
        const { lhs, rhs } = await diffHtml('<p>  hello world  </p>', '<p>hello world</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: 1-char vs N-char token boundary shuffles — "a bcdef" vs "abc def"', async () => {
        const { lhs, rhs } = await diffHtml('<p>a bcdef</p>', '<p>abc def</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: adjacent n:m mismatches (no anchors) — "foo xabc bar" vs "FOO yabc BAR"', async () => {
        // Completely different surroundings; middle "abc" is sort-of-similar but offset
        const { lhs, rhs } = await diffHtml(
            '<p>foo xabc bar</p>',
            '<p>FOO yabc BAR</p>',
            'ignore',
        );
        // Expect: no SA anchors (case-sensitive). No consume (equal-length tokens that differ).
        // All MODIFIED is acceptable — this documents the limitation.
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // At minimum, none of these should crash or produce nonsensical output
        expect(lhsTypes.length).toBeGreaterThan(0);
        expect(rhsTypes.length).toBeGreaterThan(0);
    });

    it('PROBE: single-char "a" is not picked as anchor; prefix consume drives full n:m match', async () => {
        // lhs ["abc","a","def"] vs rhs ["a","b","c","a","d","e","f"]
        // SA correctly skips "a" as an anchor (short + low score). Else branch runs
        // consumeCommonEdges(3) from the start, which walks across token boundaries
        // via matchPrefixTokens repeatedly: "abc"→"a b c", "a"→"a" (ID match), "def"→"d e f".
        // Result: all UNCHANGED.
        const { lhs, rhs } = await diffHtml('<p>abc a def</p>', '<p>a b c a d e f</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE FAIL: both-side-blocked same-length head AND tail — "X abc Y" vs "Z a b c W"', async () => {
        // Prefix: 'X' vs 'Z', both len 1 → equal-length heuristic breaks.
        // Suffix: 'Y' vs 'W', both len 1 → equal-length heuristic breaks.
        // Interior "abc" vs "a b c" is lost.
        const { lhs, rhs } = await diffHtml('<p>X abc Y</p>', '<p>Z a b c W</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // Ideal: "abc" / "a","b","c" UNCHANGED, X/Z and Y/W MODIFIED
        expect(lhsTypes.find(e => e.text === 'abc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'a')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'b')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'c')?.type).toBe(DIFF_TYPE_UNCHANGED);
    });

    it('PROBE FAIL: prefix-blocked-by-different-first-char, suffix-blocked-by-equal-length', async () => {
        // Another variant: prefix mismatch on first char; suffix equal-length same-id-miss.
        // lhs: "hello abcxyz world" (3 tokens)
        // rhs: "bye abc xyz world" (4 tokens) — "world" should be a SA anchor actually
        // Wait "world" matches on both sides, so SA will find it. Not a failure case.
        // Let me instead: lhs "hello abcxyz end" vs rhs "bye abc xyz fin" — no SA match
        const { lhs, rhs } = await diffHtml(
            '<p>hello abcxyz end</p>',
            '<p>bye abc xyz fin</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // Ideal: "abcxyz" / "abc","xyz" UNCHANGED; outer tokens MODIFIED
        // Current: everything MODIFIED (both ends blocked)
        expect(lhsTypes.find(e => e.text === 'abcxyz')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'abc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'xyz')?.type).toBe(DIFF_TYPE_UNCHANGED);
    });

    it('PROBE FAIL: "bc ef h" vs "a bce fh j" — lhs content "bcefh" is substring of rhs "abcefhj"', async () => {
        // lhs buffer (ignore): "bcefh", tokens ["bc","ef","h"]
        // rhs buffer (ignore): "abcefhj", tokens ["a","bce","fh","j"]
        //
        // The lhs content is embedded in rhs buffer at positions 1..6.
        // Ideal: lhs all UNCHANGED, rhs "a"/"j" ADDED, rhs "bce"/"fh" UNCHANGED.
        //
        // Current behavior: no SA anchors; consume fails on both ends
        //   (prefix: 'b' ≠ 'a'; suffix: len("h")==len("j")==1 → equal-length heuristic breaks).
        // Everything becomes MODIFIED.
        const { lhs, rhs } = await diffHtml('<p>bc ef h</p>', '<p>a bce fh j</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'bc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'ef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'h')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'bce')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'fh')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'a')?.type).toBe(DIFF_TYPE_ADDED);
        expect(rhsTypes.find(e => e.text === 'j')?.type).toBe(DIFF_TYPE_ADDED);
    });

    it('PROBE: "bc ef h" vs "a bce fh" — lhs fully matches rhs[1..3]; rhs "a" is ADDED', async () => {
        // lhs ignore buffer: "bcefh", tokens ["bc","ef","h"]
        // rhs ignore buffer: "abcefh", tokens ["a","bce","fh"]
        // Expected: matchSuffixTokens walks entire lhs + rhs[1..3] as UNCHANGED. "a" is ADDED.
        const { lhs, rhs } = await diffHtml('<p>bc ef h</p>', '<p>a bce fh</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'bc')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'ef')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'h')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'a')?.type).toBe(DIFF_TYPE_ADDED);
        expect(rhsTypes.find(e => e.text === 'bce')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'fh')?.type).toBe(DIFF_TYPE_UNCHANGED);
    });

    it('PROBE LIMITATION: structural wrapper differs but inner matches via n:m', async () => {
        // lhs: <p>abcdef</p> (no structural tokens — <p> is a block, not structural)
        // rhs: <table><tr><td>a b c d e f</td></tr></table> (structural tokens around content)
        //
        // Content text is identical ("abcdef"). Ideally the text should match via n:m.
        // BUT: rhs has leading structural-open tokens (\uE003\uE002\uE001) whose buffer
        // bytes are non-Latin. consumeCommonEdges tries prefix walk lhs "abcdef" vs
        // rhs <struct_open_table>: first char 'a' ≠ '\uE003' → break.
        // Suffix walk similarly blocked by <struct_close_table>.
        // Result: all content tokens end up MODIFIED, even though the text is identical.
        //
        // This documents a current limitation: n:m matching cannot penetrate across
        // differing structural wrappers. The algorithm treats the whole region as
        // having "no anchor", and consume only walks along the outer edges.
        const { lhs, rhs } = await diffHtml(
            '<p>abcdef</p>',
            '<table><tr><td>a b c d e f</td></tr></table>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // Document current (suboptimal) behavior: content tokens are MODIFIED.
        expect(lhsTypes.find(e => e.text === 'abcdef')?.type).toBe(DIFF_TYPE_MODIFIED);
        for (const { text, type } of rhsTypes) {
            expect(type, `rhs "${text}" MODIFIED (limitation)`).toBe(DIFF_TYPE_MODIFIED);
        }
    });

    it('PROBE: same structural wrapper — n:m match works inside <table><tr><td>...</td></tr></table>', async () => {
        // Control case: when the structural wrapper matches, n:m inside should work.
        const { lhs, rhs } = await diffHtml(
            '<table><tr><td>abcdef</td></tr></table>',
            '<table><tr><td>a b c d e f</td></tr></table>',
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: a single-char SA anchor may block an n:m match that would otherwise cover everything', async () => {
        // lhs: "abc a def" — tokens ["abc","a","def"]
        // rhs: "a b c a d e f" — tokens ["a","b","c","a","d","e","f"]
        //
        // A "smart" diff would:
        //   - match lhs[0] "abc" with rhs[0..3] "a b c" via n:m
        //   - match lhs[1] "a" with rhs[3] "a" (second "a")
        //   - match lhs[2] "def" with rhs[4..7] "d e f" via n:m
        //   → all UNCHANGED
        //
        // What actually happens: SA may find "a" as an anchor and pick rhs[0] (first occurrence).
        // This leaves "abc" on lhs with nothing on rhs before the anchor → REMOVED.
        // After anchor, the remainder recurses and does n:m consume on the suffix.
        const { lhs, rhs } = await diffHtml('<p>abc a def</p>', '<p>a b c a d e f</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // Print the actual behavior so we understand what happens:
        // (don't assert yet — just check we don't crash)
        expect(lhsTypes.length).toBe(3);
        expect(rhsTypes.length).toBe(7);
    });

    it('PROBE: common repeated letter vs joined word — "XYZ a XYZ" vs "XYZ aa XYZ"', async () => {
        // "a" might match, but "aa" is a single token not equal to "a"
        // Expected: "XYZ" anchors match, middle "a" vs "aa" gets MODIFIED (1v1 path)
        const { lhs, rhs } = await diffHtml('<p>XYZ a XYZ</p>', '<p>XYZ aa XYZ</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        expect(lhsTypes.find(e => e.text === 'XYZ')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(rhsTypes.find(e => e.text === 'XYZ')?.type).toBe(DIFF_TYPE_UNCHANGED);
        expect(lhsTypes.find(e => e.text === 'a')?.type).toBe(DIFF_TYPE_MODIFIED);
        expect(rhsTypes.find(e => e.text === 'aa')?.type).toBe(DIFF_TYPE_MODIFIED);
    });

    it('PROBE LIMITATION: n:m match blocked by image token — "hello" vs "hel<img>lo"', async () => {
        // lhs "hello" → 1 token
        // rhs "hel" + IMG + "lo" → 3 tokens (image in the middle)
        // matchPrefixTokens / matchSuffixTokens return null when hitting an IMAGE token
        // So n:m cannot bridge across images.
        const { lhs, rhs } = await diffHtml(
            '<p>hello</p>',
            '<p>hel<img src="x">lo</p>',
            'ignore',
        );
        const lhsTypes = contentTokenTypes(lhs);
        // Document what happens — whatever the behavior, at minimum the test should not crash
        expect(lhsTypes.find(e => e.text === 'hello')).toBeDefined();
    });

    it('PROBE: yielding boundary — >256 tokens forces yieldIfNeeded', async () => {
        // YIELD_INTERVAL = 0xff = 255. Create enough tokens to trigger yields.
        // Use a long repeating sequence with an n:m section somewhere.
        const lhsParts: string[] = [];
        const rhsParts: string[] = [];
        for (let i = 0; i < 50; i++) {
            lhsParts.push(`word${i}`);
            rhsParts.push(`word${i}`);
        }
        // Inject an n:m section in the middle
        lhsParts.push('helloworld');
        rhsParts.push('hello world');
        for (let i = 50; i < 100; i++) {
            lhsParts.push(`tail${i}`);
            rhsParts.push(`tail${i}`);
        }
        const { lhs, rhs } = await diffHtml(
            `<p>${lhsParts.join(' ')}</p>`,
            `<p>${rhsParts.join(' ')}</p>`,
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: deep recursion — many SA anchors nested', async () => {
        // Create a document with many matching anchors interspersed with n:m regions
        const lhsParts: string[] = [];
        const rhsParts: string[] = [];
        for (let i = 0; i < 20; i++) {
            lhsParts.push(`ANCHOR${i}`);
            lhsParts.push('joinedword');
            rhsParts.push(`ANCHOR${i}`);
            rhsParts.push('joined word');
        }
        const { lhs, rhs } = await diffHtml(
            `<p>${lhsParts.join(' ')}</p>`,
            `<p>${rhsParts.join(' ')}</p>`,
            'ignore',
        );
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: Korean mixed with Latin — "Hello안녕" vs "Hello 안녕"', async () => {
        const { lhs, rhs } = await diffHtml('<p>Hello안녕</p>', '<p>Hello 안녕</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: Korean joined 5 tokens — "안녕하세요" vs "안 녕 하 세 요"', async () => {
        const { lhs, rhs } = await diffHtml('<p>안녕하세요</p>', '<p>안 녕 하 세 요</p>', 'ignore');
        expectAllContentUnchanged(lhs, 'lhs');
        expectAllContentUnchanged(rhs, 'rhs');
    });

    it('PROBE: punctuation adjacent to n:m — "hello.world" vs "hello . world"', async () => {
        // Depends on tokenizer behavior for period. "hello.world" may be 1 or 3 tokens.
        const { lhs, rhs } = await diffHtml('<p>hello.world</p>', '<p>hello . world</p>', 'ignore');
        const lhsTypes = contentTokenTypes(lhs);
        const rhsTypes = contentTokenTypes(rhs);
        // Both sides should have the same normalized buffer; all should be UNCHANGED
        for (const { text, type } of lhsTypes) {
            expect(type, `lhs "${text}" UNCHANGED`).toBe(DIFF_TYPE_UNCHANGED);
        }
        for (const { text, type } of rhsTypes) {
            expect(type, `rhs "${text}" UNCHANGED`).toBe(DIFF_TYPE_UNCHANGED);
        }
    });
});
