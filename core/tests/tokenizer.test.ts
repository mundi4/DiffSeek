import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenization/tokenize';
import {
    HEADING_MASK,
    TOKEN_FLAGS_LINE_END,
    TOKEN_FLAGS_LINE_START,
    TOKEN_FLAGS_WORD_LIKE,
    TOKEN_FLAGS_TYPE_STRUCTURAL,
} from '../src/tokenization/token-flags';
import {
    SECTION_HEADING_TYPE_NUMERIC_DOT,
    SECTION_HEADING_TYPE_HANGUL_DOT,
    SECTION_HEADING_TYPE_PAREN_NUMERIC,
    SECTION_HEADING_TYPE_PAREN_HANGUL,
    SECTION_HEADING_TYPE_NUMERIC_PAREN,
    SECTION_HEADING_TYPE_HANGUL_PAREN,
    SECTION_HEADING_TYPE_LAW_ARTICLE,
    headingFlagsToType,
} from '../src/constants/section-heading';

function makeContainer(html: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
}

async function tok(html: string, options: Parameters<typeof tokenize>[2] = {}) {
    const container = makeContainer(html);
    const signal = new AbortController().signal;
    const result = await tokenize(container, signal, options);
    const texts = result.tokens.map(t =>
        result.wholeText.slice(t.textOffset, t.textOffset + t.textLength)
    );
    return { ...result, texts };
}

// ─── 섹션 헤딩 토큰화 ────────────────────────────────────────────────────────

describe('section heading tokenization', () => {

    it('TYPE1: "1. 제목" — 단일 헤딩 토큰 "1."', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>1. 제목</div>');
        // "1.", "제목"
        expect(texts[0]).toBe('1.');
        expect(headingFlagsToType(tokens[0].flags)).toBe(SECTION_HEADING_TYPE_NUMERIC_DOT);
        expect(tokens[0].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
        expect(tokens[0].flags & TOKEN_FLAGS_WORD_LIKE).toBeTruthy();
        // 나머지 토큰에는 헤딩 플래그 없음
        expect(tokens[1].flags & HEADING_MASK).toBe(0);

        expect(sectionHeadings).toHaveLength(1);
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_NUMERIC_DOT);
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[0].tokenIndex).toBe(0);
    });

    it('TYPE1: "3. 내용" — ordinal=3', async () => {
        const { sectionHeadings } = await tok('<div>3. 내용</div>');
        expect(sectionHeadings[0].ordinal).toBe(3);
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_NUMERIC_DOT);
    });

    it('TYPE2: "가. 제목" — 단일 헤딩 토큰 "가."', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>가. 제목</div>');
        expect(texts[0]).toBe('가.');
        expect(headingFlagsToType(tokens[0].flags)).toBe(SECTION_HEADING_TYPE_HANGUL_DOT);
        expect(sectionHeadings[0].ordinal).toBe(1);
    });

    it('TYPE3: "(1) 제목" — 단일 헤딩 토큰 "(1)"', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>(1) 제목</div>');
        // "(1)", "제목"
        expect(texts[0]).toBe('(1)');
        expect(headingFlagsToType(tokens[0].flags)).toBe(SECTION_HEADING_TYPE_PAREN_NUMERIC);
        expect(tokens[0].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
        expect(tokens[1].flags & HEADING_MASK).toBe(0);
        expect(sectionHeadings[0].ordinal).toBe(1);
    });

    it('TYPE4: "(가) 제목" — 단일 헤딩 토큰 "(가)"', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>(가) 제목</div>');
        expect(texts[0]).toBe('(가)');
        expect(headingFlagsToType(tokens[0].flags)).toBe(SECTION_HEADING_TYPE_PAREN_HANGUL);
        expect(sectionHeadings[0].ordinal).toBe(1);
    });

    it('TYPE5: "1) 제목" — 단일 헤딩 토큰 "1)"', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>1) 제목</div>');
        expect(texts[0]).toBe('1)');
        expect(headingFlagsToType(tokens[0].flags)).toBe(SECTION_HEADING_TYPE_NUMERIC_PAREN);
        expect(sectionHeadings[0].ordinal).toBe(1);
    });

    it('TYPE6: "가) 제목" — 단일 헤딩 토큰 "가)"', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>가) 제목</div>');
        expect(texts[0]).toBe('가)');
        expect(headingFlagsToType(tokens[0].flags)).toBe(SECTION_HEADING_TYPE_HANGUL_PAREN);
        expect(sectionHeadings[0].ordinal).toBe(1);
    });

    it('LAW_ARTICLE: "제1조 제목" — 단일 헤딩 토큰 "제1조"', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>제1조 제목</div>');
        // "제1조", "제목"
        expect(texts[0]).toBe('제1조');
        expect(headingFlagsToType(tokens[0].flags)).toBe(SECTION_HEADING_TYPE_LAW_ARTICLE);
        expect(tokens[1].flags & HEADING_MASK).toBe(0);
        expect(sectionHeadings[0].ordinal).toBe(10000);
    });

    it('LAW_ARTICLE: "제32조 내용" — ordinal=320000', async () => {
        const { sectionHeadings } = await tok('<div>제32조 내용</div>');
        expect(sectionHeadings[0].ordinal).toBe(320000);
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_LAW_ARTICLE);
    });

    // ─── 조의N (부조) ─────────────────────────────────────────────────────────

    it('LAW_ARTICLE: "제1조의2 내용" — 부조 헤딩', async () => {
        const { texts, sectionHeadings } = await tok('<div>제1조의2 내용</div>');
        expect(texts[0]).toBe('제1조의2');
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_LAW_ARTICLE);
        expect(sectionHeadings[0].ordinal).toBe(10002);
        expect(sectionHeadings[0].text).toBe('제1조의2');
    });

    it('LAW_ARTICLE: "제1조의 2 내용" — 공백 있는 부조 헤딩', async () => {
        const { texts, sectionHeadings } = await tok('<div>제1조의 2 내용</div>');
        expect(texts[0]).toBe('제1조의2');
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_LAW_ARTICLE);
        expect(sectionHeadings[0].ordinal).toBe(10002);
        expect(sectionHeadings[0].text).toBe('제1조의2');
    });

    // ─── 공백 normalize ───────────────────────────────────────────────────────

    it('LAW_ARTICLE: "제 1 조 제목" — 공백 있어도 normalize된 단일 토큰 "제1조"', async () => {
        const { texts, sectionHeadings } = await tok('<div>제 1 조 제목</div>');
        expect(texts[0]).toBe('제1조');
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_LAW_ARTICLE);
        expect(sectionHeadings[0].ordinal).toBe(10000);
        expect(sectionHeadings[0].text).toBe('제1조');
    });

    it('TYPE3: "( 1 ) 제목" — 내부 공백 있어도 normalize된 단일 토큰 "(1)"', async () => {
        const { texts, sectionHeadings } = await tok('<div>( 1 ) 제목</div>');
        expect(texts[0]).toBe('(1)');
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_PAREN_NUMERIC);
        expect(sectionHeadings[0].text).toBe('(1)');
    });

    // ─── sectionHeadings.text ─────────────────────────────────────────────────

    it('sectionHeadings.text — 각 타입별 정규화된 text 값', async () => {
        expect((await tok('<div>1. 제목</div>')).sectionHeadings[0].text).toBe('1.');
        expect((await tok('<div>가. 제목</div>')).sectionHeadings[0].text).toBe('가.');
        expect((await tok('<div>(1) 제목</div>')).sectionHeadings[0].text).toBe('(1)');
        expect((await tok('<div>(가) 제목</div>')).sectionHeadings[0].text).toBe('(가)');
        expect((await tok('<div>1) 제목</div>')).sectionHeadings[0].text).toBe('1)');
        expect((await tok('<div>가) 제목</div>')).sectionHeadings[0].text).toBe('가)');
        expect((await tok('<div>제1조 제목</div>')).sectionHeadings[0].text).toBe('제1조');
    });

    // ─── 다자릿수 ordinal ─────────────────────────────────────────────────────

    it('TYPE1: "10. 제목" — ordinal=10', async () => {
        const { texts, sectionHeadings } = await tok('<div>10. 제목</div>');
        expect(texts[0]).toBe('10.');
        expect(sectionHeadings[0].ordinal).toBe(10);
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_NUMERIC_DOT);
    });

    it('TYPE5: "12) 제목" — ordinal=12', async () => {
        const { texts, sectionHeadings } = await tok('<div>12) 제목</div>');
        expect(texts[0]).toBe('12)');
        expect(sectionHeadings[0].ordinal).toBe(12);
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_NUMERIC_PAREN);
    });

    // ─── 가나다 순서 ──────────────────────────────────────────────────────────

    it('TYPE2: "나. 제목" — ordinal=2', async () => {
        const { sectionHeadings } = await tok('<div>나. 제목</div>');
        expect(sectionHeadings[0].ordinal).toBe(2);
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_HANGUL_DOT);
    });

    it('TYPE6: "하) 제목" — ordinal=14', async () => {
        const { sectionHeadings } = await tok('<div>하) 제목</div>');
        expect(sectionHeadings[0].ordinal).toBe(14);
        expect(sectionHeadings[0].type).toBe(SECTION_HEADING_TYPE_HANGUL_PAREN);
    });

    // ─── word-like 없으면 헤딩 아님 ───────────────────────────────────────────

    it('헤딩 뒤에 word-like 없으면 헤딩 아님 — "1." 단독', async () => {
        const { tokens, sectionHeadings } = await tok('<div>1.</div>');
        expect(sectionHeadings).toHaveLength(0);
        expect(tokens[0].flags & HEADING_MASK).toBe(0);
    });

    it('헤딩 뒤에 word-like 없으면 헤딩 아님 — "(1)" 단독', async () => {
        const { sectionHeadings } = await tok('<div>(1)</div>');
        expect(sectionHeadings).toHaveLength(0);
    });

    it('allowStandaloneLawArticle: "제1조" 단독도 헤딩', async () => {
        const { sectionHeadings, texts } = await tok('<div>제1조</div>', { allowStandaloneLawArticle: true });
        expect(sectionHeadings).toHaveLength(1);
        expect(texts[0]).toBe('제1조');
    });

    it('allowStandaloneLawArticle: "제995조" 단독도 헤딩', async () => {
        const { sectionHeadings, texts } = await tok('<div>제995조</div>', { allowStandaloneLawArticle: true });
        expect(sectionHeadings).toHaveLength(1);
        expect(texts[0]).toBe('제995조');
    });

    it('allowStandaloneLawArticle 없으면 "제1조" 단독은 헤딩 아님', async () => {
        const { sectionHeadings } = await tok('<div>제1조</div>');
        expect(sectionHeadings).toHaveLength(0);
    });

    it('헤딩 뒤에 word-like 없으면 헤딩 아님 — "1)" 단독', async () => {
        const { sectionHeadings } = await tok('<div>1)</div>');
        expect(sectionHeadings).toHaveLength(0);
    });

    // ─── 줄 중간 패턴 병합 (헤딩 플래그 없음) ──────────────────────────────────

    it('줄 중간 "1."은 패턴 병합되지만 헤딩 아님', async () => {
        const { texts, sectionHeadings } = await tok('<div>ABC 1. 내용</div>');
        expect(texts).toContain('1.');
        expect(sectionHeadings).toHaveLength(0);
    });

    it('줄 중간 "(1)"은 패턴 병합되지만 헤딩 아님', async () => {
        const { texts, sectionHeadings } = await tok('<div>ABC (1) 내용</div>');
        expect(texts).toContain('(1)');
        expect(sectionHeadings).toHaveLength(0);
    });

    it('줄 중간 "제1조"는 패턴 병합되지만 헤딩 아님', async () => {
        const { texts, sectionHeadings } = await tok('<div>ABC 제1조 내용</div>');
        expect(texts).toContain('제1조');
        expect(sectionHeadings).toHaveLength(0);
    });

    it('줄 중간 병합 토큰에는 HEADING_MASK 없음', async () => {
        const { tokens, texts } = await tok('<div>ABC (1) 내용</div>');
        const idx = texts.indexOf('(1)');
        expect(idx).toBeGreaterThan(0);
        expect(tokens[idx].flags & HEADING_MASK).toBe(0);
    });

    // ─── false positive 보호 ──────────────────────────────────────────────────

    it('"1.5" — 소수점이므로 병합하지 않음', async () => {
        const { texts } = await tok('<div>1.5 내용</div>');
        expect(texts).not.toContain('1.');
        expect(texts[0]).toBe('1');
    });

    it('줄 중간 "1.5" — 소수점이므로 병합하지 않음', async () => {
        const { texts } = await tok('<div>ABC 1.5 내용</div>');
        expect(texts).not.toContain('1.');
    });

    // ─── 공백 규칙 강화 (공백? — 최대 1개) ────────────────────────────────────

    it('"제  1  조" — 공백 2개 이상이면 병합하지 않음', async () => {
        const { texts, sectionHeadings } = await tok('<div>제  1  조 제목</div>');
        expect(texts).not.toContain('제1조');
        expect(sectionHeadings).toHaveLength(0);
    });

    it('"(  1  )" — 공백 2개 이상이면 병합하지 않음', async () => {
        const { texts, sectionHeadings } = await tok('<div>(  1  ) 제목</div>');
        expect(texts).not.toContain('(1)');
        expect(sectionHeadings).toHaveLength(0);
    });

    // ─── 여러 줄 / tokenIndex ─────────────────────────────────────────────────

    it('여러 줄 각각 헤딩 — tokenIndex가 올바름', async () => {
        const { tokens, sectionHeadings } = await tok(
            '<div>1. 제목A</div><div>2. 제목B</div>'
        );
        expect(sectionHeadings).toHaveLength(2);
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[1].ordinal).toBe(2);
        for (const sh of sectionHeadings) {
            expect(headingFlagsToType(tokens[sh.tokenIndex].flags)).toBe(SECTION_HEADING_TYPE_NUMERIC_DOT);
        }
    });

    it('여러 타입 혼합 — tokenIndex가 각각 올바름', async () => {
        const { tokens, sectionHeadings } = await tok(
            '<div>제1조 조문</div><div>(1) 항목</div><div>가. 내용</div>'
        );
        expect(sectionHeadings).toHaveLength(3);
        expect(headingFlagsToType(tokens[sectionHeadings[0].tokenIndex].flags)).toBe(SECTION_HEADING_TYPE_LAW_ARTICLE);
        expect(headingFlagsToType(tokens[sectionHeadings[1].tokenIndex].flags)).toBe(SECTION_HEADING_TYPE_PAREN_NUMERIC);
        expect(headingFlagsToType(tokens[sectionHeadings[2].tokenIndex].flags)).toBe(SECTION_HEADING_TYPE_HANGUL_DOT);
    });
});

// ─── letter/digit 경계 분리 ────────────────────────────────────────────────

async function tokWithMerge(html: string, merge: boolean) {
    const container = makeContainer(html);
    const signal = new AbortController().signal;
    const result = await tokenize(container, signal, { mergeLetterNumberBoundary: merge });
    return result.tokens
        .filter(t => (t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL) === 0)
        .map(t => result.wholeText.slice(t.textOffset, t.textOffset + t.textLength));
}

describe('letter/digit boundary split', () => {

    it('"제32조" — split(기본값): 3토큰', async () => {
        expect(await tokWithMerge('<div>제32조</div>', false)).toEqual(['제', '32', '조']);
    });

    it('"제32조" — merge: 1토큰', async () => {
        expect(await tokWithMerge('<div>제32조</div>', true)).toEqual(['제32조']);
    });

    it('"page3" — split(기본값): 분리', async () => {
        expect(await tokWithMerge('<div>page3</div>', false)).toEqual(['page', '3']);
    });

    it('"page3" — merge: 하나로', async () => {
        expect(await tokWithMerge('<div>page3</div>', true)).toEqual(['page3']);
    });

    it('"H2O" — split(기본값): 분리', async () => {
        expect(await tokWithMerge('<div>H2O</div>', false)).toEqual(['H', '2', 'O']);
    });

    it('"H2O" — merge: 하나로', async () => {
        expect(await tokWithMerge('<div>H2O</div>', true)).toEqual(['H2O']);
    });

    // 같은 카테고리 내에서는 split 모드에서도 분리 없음
    it('순수 한글 "제목" — split 모드에서도 하나로', async () => {
        expect(await tokWithMerge('<div>제목</div>', false)).toEqual(['제목']);
    });

    it('순수 영문 "ABC" — split 모드에서도 하나로', async () => {
        expect(await tokWithMerge('<div>ABC</div>', false)).toEqual(['ABC']);
    });

    it('순수 숫자 "123" — split 모드에서도 하나로', async () => {
        expect(await tokWithMerge('<div>123</div>', false)).toEqual(['123']);
    });
});

// ─── 특수 문자 토큰 경계 ──────────────────────────────────────────────────

describe('special character token boundaries', () => {

    it('"foo_bar" — underscore splits tokens', async () => {
        expect(await tokWithMerge('<div>foo_bar</div>', false)).toEqual(['foo', '_', 'bar']);
    });

    it('"__init__" — underscores split tokens individually', async () => {
        expect(await tokWithMerge('<div>__init__</div>', false)).toEqual(['_', '_', 'init', '_', '_']);
    });

    it('"항목ㆍ내용" — U+318D (HANGUL LETTER ARAEA) splits tokens', async () => {
        expect(await tokWithMerge('<div>항목ㆍ내용</div>', false)).toEqual(['항목', 'ㆍ', '내용']);
    });

    it('"가ㆍ나ㆍ다" — multiple U+318D split correctly', async () => {
        expect(await tokWithMerge('<div>가ㆍ나ㆍ다</div>', false)).toEqual(['가', 'ㆍ', '나', 'ㆍ', '다']);
    });
});

// ─── structural 토큰 불변식 ────────────────────────────────────────────────

describe('structural token invariants', () => {
    it('structural 토큰 전후 content 토큰은 LINE_END/LINE_START이고 lineNumber가 다르다', async () => {
        const html = '<table><tr><td>셀A</td><td>셀B</td></tr><tr><td>셀C</td><td>셀D</td></tr></table>';
        const container = makeContainer(html);
        const signal = new AbortController().signal;
        const { tokens } = await tokenize(container, signal);

        for (let i = 0; i < tokens.length; i++) {
            if (!(tokens[i].flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) continue;

            let pi = i - 1;
            while (pi >= 0 && (tokens[pi].flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) pi--;

            let ni = i + 1;
            while (ni < tokens.length && (tokens[ni].flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) ni++;

            if (pi >= 0 && ni < tokens.length) {
                expect(tokens[pi].flags & TOKEN_FLAGS_LINE_END, `token[${pi}] should have LINE_END before structural at ${i}`).toBeTruthy();
                expect(tokens[ni].flags & TOKEN_FLAGS_LINE_START, `token[${ni}] should have LINE_START after structural at ${i}`).toBeTruthy();
                expect(tokens[pi].lineNumber, `lineNumber should differ across structural boundary at ${i}`).not.toBe(tokens[ni].lineNumber);
            }
        }
    });
});
