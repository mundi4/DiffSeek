import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenization/tokenize';
import {
    HEADING_MASK,
    TOKEN_FLAGS_LINE_START,
    TOKEN_FLAGS_WORD_LIKE,
    TOKEN_FLAGS_SECTION_HEADING_TYPE1,
    TOKEN_FLAGS_SECTION_HEADING_TYPE2,
    TOKEN_FLAGS_SECTION_HEADING_TYPE3,
    TOKEN_FLAGS_SECTION_HEADING_TYPE4,
    TOKEN_FLAGS_SECTION_HEADING_TYPE5,
    TOKEN_FLAGS_SECTION_HEADING_TYPE6,
    TOKEN_FLAGS_SECTION_HEADING_LAW_ARTICLE,
} from '../src/tokenization/token-flags';

function makeContainer(html: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
}

async function tok(html: string) {
    const container = makeContainer(html);
    const signal = new AbortController().signal;
    const result = await tokenize(container, signal);
    const texts = result.tokens.map(t =>
        result.wholeText.slice(t.textOffset, t.textOffset + t.textLength)
    );
    return { ...result, texts };
}

// ─── 섹션 헤딩 토큰화 ────────────────────────────────────────────────────────

describe('section heading tokenization', () => {

    it('TYPE1: "1. 제목" — 첫 토큰에 TYPE1 플래그', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>1. 제목</div>');
        // "1", ".", "제목"
        expect(texts[0]).toBe('1');
        expect(tokens[0].flags & TOKEN_FLAGS_SECTION_HEADING_TYPE1).toBeTruthy();
        expect(tokens[0].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
        expect(tokens[0].flags & TOKEN_FLAGS_WORD_LIKE).toBeTruthy();
        // 나머지 토큰에는 헤딩 플래그 없음
        expect(tokens[1].flags & HEADING_MASK).toBe(0);
        expect(tokens[2].flags & HEADING_MASK).toBe(0);

        expect(sectionHeadings).toHaveLength(1);
        expect(sectionHeadings[0].type).toBe(TOKEN_FLAGS_SECTION_HEADING_TYPE1);
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[0].tokenIndex).toBe(0);
        expect(sectionHeadings[0].tokenCount).toBe(2);
    });

    it('TYPE1: "3. 내용" — ordinal=3', async () => {
        const { sectionHeadings } = await tok('<div>3. 내용</div>');
        expect(sectionHeadings[0].ordinal).toBe(3);
        expect(sectionHeadings[0].type).toBe(TOKEN_FLAGS_SECTION_HEADING_TYPE1);
    });

    it('TYPE2: "가. 제목" — 첫 토큰에 TYPE2 플래그', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>가. 제목</div>');
        expect(texts[0]).toBe('가');
        expect(tokens[0].flags & TOKEN_FLAGS_SECTION_HEADING_TYPE2).toBeTruthy();
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[0].tokenCount).toBe(2);
    });

    it('TYPE3: "(1) 제목" — 첫 토큰 "("에 TYPE3 플래그', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>(1) 제목</div>');
        // "(", "1", ")", "제목"
        expect(texts[0]).toBe('(');
        expect(tokens[0].flags & TOKEN_FLAGS_SECTION_HEADING_TYPE3).toBeTruthy();
        expect(tokens[0].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
        expect(tokens[1].flags & HEADING_MASK).toBe(0);
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[0].tokenCount).toBe(3);
    });

    it('TYPE4: "(가) 제목" — 첫 토큰 "("에 TYPE4 플래그', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>(가) 제목</div>');
        expect(texts[0]).toBe('(');
        expect(tokens[0].flags & TOKEN_FLAGS_SECTION_HEADING_TYPE4).toBeTruthy();
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[0].tokenCount).toBe(3);
    });

    it('TYPE5: "1) 제목" — 첫 토큰 "1"에 TYPE5 플래그', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>1) 제목</div>');
        expect(texts[0]).toBe('1');
        expect(tokens[0].flags & TOKEN_FLAGS_SECTION_HEADING_TYPE5).toBeTruthy();
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[0].tokenCount).toBe(2);
    });

    it('TYPE6: "가) 제목" — 첫 토큰 "가"에 TYPE6 플래그', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>가) 제목</div>');
        expect(texts[0]).toBe('가');
        expect(tokens[0].flags & TOKEN_FLAGS_SECTION_HEADING_TYPE6).toBeTruthy();
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[0].tokenCount).toBe(2);
    });

    it('LAW_ARTICLE: "제1조 제목" — 첫 토큰 "제"에 LAW_ARTICLE 플래그', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>제1조 제목</div>');
        // "제", "1", "조", "제목"
        expect(texts[0]).toBe('제');
        expect(tokens[0].flags & TOKEN_FLAGS_SECTION_HEADING_LAW_ARTICLE).toBeTruthy();
        expect(tokens[1].flags & HEADING_MASK).toBe(0);
        expect(tokens[2].flags & HEADING_MASK).toBe(0);
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[0].tokenCount).toBe(3);
    });

    it('LAW_ARTICLE: "제32조 내용" — ordinal=32', async () => {
        const { sectionHeadings } = await tok('<div>제32조 내용</div>');
        expect(sectionHeadings[0].ordinal).toBe(32);
        expect(sectionHeadings[0].type).toBe(TOKEN_FLAGS_SECTION_HEADING_LAW_ARTICLE);
    });

    it('헤딩 뒤에 word-like 없으면 헤딩 아님 — "1." 단독', async () => {
        const { tokens, texts, sectionHeadings } = await tok('<div>1.</div>');
        expect(sectionHeadings).toHaveLength(0);
        expect(tokens[0].flags & HEADING_MASK).toBe(0);
    });

    it('헤딩 뒤에 word-like 없으면 헤딩 아님 — "(1)" 단독', async () => {
        const { sectionHeadings } = await tok('<div>(1)</div>');
        expect(sectionHeadings).toHaveLength(0);
    });

    it('줄 중간에 나오는 "1."은 헤딩 아님', async () => {
        const { sectionHeadings } = await tok('<div>ABC 1. 내용</div>');
        expect(sectionHeadings).toHaveLength(0);
    });

    it('여러 줄 각각 헤딩 — tokenIndex가 올바름', async () => {
        const { tokens, sectionHeadings } = await tok(
            '<div>1. 제목A</div><div>2. 제목B</div>'
        );
        expect(sectionHeadings).toHaveLength(2);
        expect(sectionHeadings[0].ordinal).toBe(1);
        expect(sectionHeadings[1].ordinal).toBe(2);
        // 각 tokenIndex가 실제로 LINE_START | TYPE1 플래그를 가진 토큰 인덱스인지 확인
        for (const sh of sectionHeadings) {
            expect(tokens[sh.tokenIndex].flags & TOKEN_FLAGS_SECTION_HEADING_TYPE1).toBeTruthy();
        }
    });
});

// ─── letter/digit 경계 분리 ────────────────────────────────────────────────

async function tokWithMerge(html: string, merge: boolean) {
    const container = makeContainer(html);
    const signal = new AbortController().signal;
    const result = await tokenize(container, signal, { mergeLetterNumberBoundary: merge });
    return result.tokens.map(t =>
        result.wholeText.slice(t.textOffset, t.textOffset + t.textLength)
    );
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
