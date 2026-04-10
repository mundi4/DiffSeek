/**
 * 토크나이저 엣지케이스 테스트
 *
 * 제외: MANUAL_ANCHOR (미구현), NO_JOIN_NEXT/NO_JOIN_PREV
 */
import { describe, it, expect } from "vitest";
import { tokenize } from "../src/tokenization/tokenize";
import {
    TOKEN_FLAGS_HAS_FOLLOWING_SPACE,
    TOKEN_FLAGS_HAS_PRECEDING_SPACE,
    TOKEN_FLAGS_LINE_END,
    TOKEN_FLAGS_LINE_START,
    TOKEN_FLAGS_PUNCTUATION,
    TOKEN_FLAGS_TYPE_IMAGE,
    TOKEN_FLAGS_TYPE_STRUCTURAL,
    TOKEN_FLAGS_TYPE_TEXT,
    TOKEN_FLAGS_WILDCARD,
    TOKEN_FLAGS_WORD_LIKE,
    TOKEN_TYPE_MASK,
    getStructuralElementType,
    isStructuralOpen,
    isStructuralClose,
    STRUCTURAL_ELEMENT_TD,
    STRUCTURAL_ELEMENT_TR,
} from "../src/tokenization/token-flags";

// ── helpers ──────────────────────────────────────────────────────

function makeContainer(html: string): HTMLElement {
    const div = document.createElement("div");
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

/** 텍스트 토큰만 반환 */
function textTokens(result: Awaited<ReturnType<typeof tok>>) {
    return result.tokens.filter(t => (t.flags & TOKEN_TYPE_MASK) === TOKEN_FLAGS_TYPE_TEXT);
}

/** 토큰의 텍스트 추출 */
function text(result: Awaited<ReturnType<typeof tok>>, token: { textOffset: number; textLength: number }) {
    return result.wholeText.slice(token.textOffset, token.textOffset + token.textLength);
}

// ── LINE_END / LINE_START: 블록 요소들 ─────────────────────────

describe("LINE_END / LINE_START across block elements", () => {

    it("<p> 사이 텍스트에 LINE_END/LINE_START", async () => {
        const r = await tok("<p>가</p><p>나</p>");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END, "가 → LINE_END").toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START, "나 → LINE_START").toBeTruthy();
    });

    it("<div> 사이 텍스트에 LINE_END/LINE_START", async () => {
        const r = await tok("<div>가</div><div>나</div>");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
    });

    it("<h1>~<h6> 각각 줄 경계 생성", async () => {
        const r = await tok("<h1>제목1</h1><h2>제목2</h2><h3>제목3</h3>");
        const tt = textTokens(r);
        // "제목"과 "1" 등이 별도 토큰으로 분리될 수 있음 (글자/숫자 카테고리 분리)
        expect(tt.length).toBeGreaterThanOrEqual(3);
        // 첫 토큰과 마지막 토큰 사이에 LINE_END/LINE_START 경계가 있어야 함
        expect(tt[0].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
        expect(tt[tt.length - 1].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
    });

    it("<li> 각각 줄 경계 생성", async () => {
        const r = await tok("<ul><li>항목A</li><li>항목B</li><li>항목C</li></ul>");
        const tt = textTokens(r);
        expect(tt.length).toBe(3);
        for (let i = 0; i < tt.length - 1; i++) {
            expect(tt[i].flags & TOKEN_FLAGS_LINE_END, `tt[${i}] LINE_END`).toBeTruthy();
            expect(tt[i + 1].flags & TOKEN_FLAGS_LINE_START, `tt[${i + 1}] LINE_START`).toBeTruthy();
        }
    });

    it("<blockquote> 줄 경계 생성", async () => {
        const r = await tok("앞<blockquote>인용</blockquote>뒤");
        const tt = textTokens(r);
        expect(tt.length).toBe(3);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
        expect(tt[2].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
    });

    it("중첩 블록: div > p", async () => {
        const r = await tok("<div><p>안</p><p>녕</p></div>");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
    });
});

// ── LINE_END / LINE_START: BR ───────────────────────────────────

describe("BR line boundary", () => {

    it("BR 전후 텍스트에 LINE_END/LINE_START", async () => {
        const r = await tok("가<br>나");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END, "가 → LINE_END").toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START, "나 → LINE_START").toBeTruthy();
    });

    it("연속 BR", async () => {
        const r = await tok("가<br><br>나");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
    });

    it("BR로 시작하는 문서", async () => {
        const r = await tok("<br>가");
        const tt = textTokens(r);
        expect(tt.length).toBe(1);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
    });
});

// ── LINE_END / LINE_START: HR (void block) ──────────────────────

describe("HR (void block element)", () => {

    it("HR 전후 텍스트에 LINE_END/LINE_START", async () => {
        const r = await tok("위<hr>아래");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
    });
});

// ── LINE_END: 마지막 토큰 (구조적 토큰 뒤) ─────────────────────

describe("LINE_END on last text token", () => {

    it("문서 끝이 구조적 토큰이면 마지막 텍스트 토큰에 LINE_END", async () => {
        const r = await tok("<table><tr><td>마지막</td></tr></table>");
        const tt = textTokens(r);
        expect(tt.length).toBe(1);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END, "마지막 → LINE_END").toBeTruthy();
    });

    it("여러 TD의 마지막 텍스트 토큰 모두 LINE_END", async () => {
        const r = await tok("<table><tr><td>가</td><td>나</td><td>다</td></tr></table>");
        const tt = textTokens(r);
        expect(tt.length).toBe(3);
        for (const t of tt) {
            expect(t.flags & TOKEN_FLAGS_LINE_END, `"${text(r, t)}" → LINE_END`).toBeTruthy();
        }
    });

    it("마지막 토큰이 텍스트면 LINE_END (구조적 토큰 없는 경우)", async () => {
        const r = await tok("끝");
        const tt = textTokens(r);
        expect(tt[tt.length - 1].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
    });

    it("중첩 테이블: 내부 테이블 마지막 텍스트 토큰에도 LINE_END", async () => {
        const r = await tok("<table><tr><td><table><tr><td>내부</td></tr></table></td></tr></table>");
        const tt = textTokens(r);
        expect(tt.length).toBe(1);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
    });
});

// ── HAS_PRECEDING_SPACE / HAS_FOLLOWING_SPACE ───────────────────

describe("HAS_PRECEDING_SPACE / HAS_FOLLOWING_SPACE", () => {

    it("공백으로 구분된 단어 간 space 플래그", async () => {
        const r = await tok("가 나");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE, "가 → HAS_FOLLOWING_SPACE").toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_HAS_PRECEDING_SPACE, "나 → HAS_PRECEDING_SPACE").toBeTruthy();
    });

    it("줄 시작 후에는 HAS_PRECEDING_SPACE 클리어", async () => {
        const r = await tok("가<br>  나");
        const tt = textTokens(r);
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_HAS_PRECEDING_SPACE, "줄 시작이면 HAS_PRECEDING_SPACE 없음").toBeFalsy();
    });

    it("연속 공백은 하나로 축소 (collapse)", async () => {
        const r = await tok("가   나");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_HAS_PRECEDING_SPACE).toBeTruthy();
    });

    it("공백 없이 붙은 단어에는 space 플래그 없음", async () => {
        const r = await tok("가나");
        const tt = textTokens(r);
        // 같은 카테고리면 하나의 토큰
        for (const t of tt) {
            expect(t.flags & TOKEN_FLAGS_HAS_PRECEDING_SPACE).toBeFalsy();
            expect(t.flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE).toBeFalsy();
        }
    });
});

// ── WORD_LIKE / PUNCTUATION ─────────────────────────────────────

describe("WORD_LIKE and PUNCTUATION flags", () => {

    it("한글 토큰은 WORD_LIKE", async () => {
        const r = await tok("가나다");
        const tt = textTokens(r);
        expect(tt[0].flags & TOKEN_FLAGS_WORD_LIKE).toBeTruthy();
    });

    it("영어 토큰은 WORD_LIKE", async () => {
        const r = await tok("hello");
        const tt = textTokens(r);
        expect(tt[0].flags & TOKEN_FLAGS_WORD_LIKE).toBeTruthy();
    });

    it("숫자 토큰은 WORD_LIKE", async () => {
        const r = await tok("12345");
        const tt = textTokens(r);
        expect(tt[0].flags & TOKEN_FLAGS_WORD_LIKE).toBeTruthy();
    });

    it("구두점 토큰은 WORD_LIKE 아님", async () => {
        const r = await tok("가, 나");
        const tt = textTokens(r);
        const comma = tt.find(t => text(r, t) === ",");
        expect(comma, "쉼표 토큰 존재").toBeTruthy();
        expect(comma!.flags & TOKEN_FLAGS_WORD_LIKE, "쉼표 → not WORD_LIKE").toBeFalsy();
    });
});

// ── IMAGE 토큰 ──────────────────────────────────────────────────

describe("IMAGE token", () => {

    it("<img>는 TOKEN_FLAGS_TYPE_IMAGE", async () => {
        const r = await tok('<p>앞<img src="test.png">뒤</p>');
        const imgTokens = r.tokens.filter(t => (t.flags & TOKEN_TYPE_MASK) === TOKEN_FLAGS_TYPE_IMAGE);
        expect(imgTokens.length).toBe(1);
    });

    it("이미지 전후 텍스트 토큰은 정상", async () => {
        const r = await tok('<p>앞<img src="test.png">뒤</p>');
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(text(r, tt[0])).toBe("앞");
        expect(text(r, tt[1])).toBe("뒤");
    });
});

// ── WILDCARD 토큰 ───────────────────────────────────────────────

describe("WILDCARD token", () => {

    it("(추가)는 WILDCARD 플래그", async () => {
        const r = await tok("가 (추가) 나");
        const wt = r.tokens.filter(t => t.flags & TOKEN_FLAGS_WILDCARD);
        expect(wt.length).toBe(1);
        expect(text(r, wt[0])).toBe("(추가)");
    });

    it("<삭제>는 WILDCARD 플래그", async () => {
        const r = await tok("가 <삭제> 나");
        const wt = r.tokens.filter(t => t.flags & TOKEN_FLAGS_WILDCARD);
        expect(wt.length).toBe(1);
        expect(text(r, wt[0])).toBe("<삭제>");
    });

    it("[신설]는 WILDCARD 플래그", async () => {
        const r = await tok("가 [신설] 나");
        const wt = r.tokens.filter(t => t.flags & TOKEN_FLAGS_WILDCARD);
        expect(wt.length).toBe(1);
        expect(text(r, wt[0])).toBe("[신설]");
    });

    it("(현행과같음)은 WILDCARD 플래그", async () => {
        const r = await tok("가 (현행과같음) 나");
        const wt = r.tokens.filter(t => t.flags & TOKEN_FLAGS_WILDCARD);
        expect(wt.length).toBe(1);
        expect(text(r, wt[0])).toBe("(현행과같음)");
    });
});

// ── 구조적 토큰 ─────────────────────────────────────────────────

describe("structural tokens", () => {

    it("TD open/close 구분", async () => {
        const r = await tok("<table><tr><td>내용</td></tr></table>");
        const structural = r.tokens.filter(t => t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL);
        const tdOpen = structural.filter(t => isStructuralOpen(t.flags) && getStructuralElementType(t.flags) === STRUCTURAL_ELEMENT_TD);
        const tdClose = structural.filter(t => isStructuralClose(t.flags) && getStructuralElementType(t.flags) === STRUCTURAL_ELEMENT_TD);
        expect(tdOpen.length).toBe(1);
        expect(tdClose.length).toBe(1);
    });

    it("TR open/close 구분", async () => {
        const r = await tok("<table><tr><td>내용</td></tr></table>");
        const structural = r.tokens.filter(t => t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL);
        const trOpen = structural.filter(t => isStructuralOpen(t.flags) && getStructuralElementType(t.flags) === STRUCTURAL_ELEMENT_TR);
        const trClose = structural.filter(t => isStructuralClose(t.flags) && getStructuralElementType(t.flags) === STRUCTURAL_ELEMENT_TR);
        expect(trOpen.length).toBe(1);
        expect(trClose.length).toBe(1);
    });

    it("TH는 TD와 동일한 구조적 타입", async () => {
        const r = await tok("<table><tr><th>헤더</th></tr></table>");
        const structural = r.tokens.filter(t => t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL);
        const thAsTd = structural.filter(t => getStructuralElementType(t.flags) === STRUCTURAL_ELEMENT_TD);
        expect(thAsTd.length).toBe(2); // open + close
    });

    it("구조적 토큰은 lastToken을 갱신하지 않음 (wholeText 기여 없음)", async () => {
        const r = await tok("<table><tr><td>가</td><td>나</td></tr></table>");
        // wholeText에 구조적 토큰 텍스트가 포함되지 않음
        expect(r.wholeText).not.toContain("\uE000");
        expect(r.wholeText).not.toContain("\uE001");
        // 텍스트만 포함
        expect(r.wholeText).toContain("가");
        expect(r.wholeText).toContain("나");
    });
});

// ── 빈 요소 ─────────────────────────────────────────────────────

describe("empty elements", () => {

    it("빈 TD — 구조적 토큰만, 텍스트 토큰 없음", async () => {
        const r = await tok("<table><tr><td></td></tr></table>");
        const tt = textTokens(r);
        expect(tt.length).toBe(0);
        const structural = r.tokens.filter(t => t.flags & TOKEN_FLAGS_TYPE_STRUCTURAL);
        expect(structural.length).toBeGreaterThan(0);
    });

    it("빈 TD와 채워진 TD 혼합", async () => {
        const r = await tok("<table><tr><td></td><td>내용</td><td></td></tr></table>");
        const tt = textTokens(r);
        expect(tt.length).toBe(1);
        expect(text(r, tt[0])).toBe("내용");
    });

    it("빈 <p>", async () => {
        const r = await tok("<p></p><p>내용</p>");
        const tt = textTokens(r);
        expect(tt.length).toBe(1);
        expect(text(r, tt[0])).toBe("내용");
    });

    it("빈 <div>", async () => {
        const r = await tok("<div></div><div>내용</div>");
        const tt = textTokens(r);
        expect(tt.length).toBe(1);
    });
});

// ── TEXTLESS 요소 ───────────────────────────────────────────────

describe("TEXTLESS elements", () => {

    it("UL/OL 직접 자식 텍스트 노드는 무시됨 (TEXTLESS)", async () => {
        // jsdom은 TABLE/TR 안 텍스트를 밖으로 밀어내므로 UL로 테스트
        const r = await tok("<ol>무시됨<li>항목</li></ol>");
        const tt = textTokens(r);
        const texts = tt.map(t => text(r, t));
        expect(texts).not.toContain("무시됨");
        expect(texts).toContain("항목");
    });

    it("UL 직접 자식 텍스트 노드는 무시됨", async () => {
        const r = await tok("<ul>무시됨<li>항목</li></ul>");
        const tt = textTokens(r);
        const texts = tt.map(t => text(r, t));
        expect(texts).not.toContain("무시됨");
        expect(texts).toContain("항목");
    });
});

// ── 컨테이너 (TD/TH) ───────────────────────────────────────────

describe("container tracking (TD/TH)", () => {

    it("각 TD는 별도의 containerIndex", async () => {
        const r = await tok("<table><tr><td>가</td><td>나</td></tr></table>");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].containerIndex).not.toBe(tt[1].containerIndex);
    });

    it("containers 배열에 TD 요소 포함", async () => {
        const r = await tok("<table><tr><td>가</td><td>나</td></tr></table>");
        // 첫 번째 container는 루트 DIV일 수 있음
        const tdContainers = r.containers.filter(c => c.el.nodeName === "TD");
        expect(tdContainers.length).toBeGreaterThanOrEqual(2);
    });
});

// ── lineNumber ──────────────────────────────────────────────────

describe("lineNumber tracking", () => {

    it("블록 요소 사이 lineNumber 증가", async () => {
        const r = await tok("<p>가</p><p>나</p><p>다</p>");
        const tt = textTokens(r);
        expect(tt[0].lineNumber).toBeLessThan(tt[1].lineNumber);
        expect(tt[1].lineNumber).toBeLessThan(tt[2].lineNumber);
    });

    it("BR로 lineNumber 증가", async () => {
        const r = await tok("가<br>나<br>다");
        const tt = textTokens(r);
        expect(tt[0].lineNumber).toBeLessThan(tt[1].lineNumber);
        expect(tt[1].lineNumber).toBeLessThan(tt[2].lineNumber);
    });

    it("같은 줄 토큰은 같은 lineNumber", async () => {
        const r = await tok("가 나 다");
        const tt = textTokens(r);
        const lineNums = new Set(tt.map(t => t.lineNumber));
        expect(lineNums.size).toBe(1);
    });

    it("TD 사이 lineNumber 다름", async () => {
        const r = await tok("<table><tr><td>가</td><td>나</td></tr></table>");
        const tt = textTokens(r);
        expect(tt[0].lineNumber).not.toBe(tt[1].lineNumber);
    });
});

// ── wholeText 구성 ──────────────────────────────────────────────

describe("wholeText construction", () => {

    it("블록 사이 개행", async () => {
        const r = await tok("<p>가</p><p>나</p>");
        expect(r.wholeText).toContain("가\n");
        expect(r.wholeText).toContain("나");
    });

    it("인라인 공백은 스페이스", async () => {
        const r = await tok("가 나");
        expect(r.wholeText).toContain("가 나");
    });

    it("끝에 개행 포함", async () => {
        const r = await tok("가");
        expect(r.wholeText.endsWith("\n")).toBe(true);
    });
});

// ── 복합 구조 ───────────────────────────────────────────────────

describe("complex structures", () => {

    it("테이블 안에 블록 요소", async () => {
        const r = await tok("<table><tr><td><p>가</p><p>나</p></td></tr></table>");
        const tt = textTokens(r);
        expect(tt.length).toBe(2);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
        expect(tt[1].flags & TOKEN_FLAGS_LINE_START).toBeTruthy();
    });

    it("여러 행 테이블: 모든 셀 마지막 토큰에 LINE_END", async () => {
        const r = await tok("<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>");
        const tt = textTokens(r);
        expect(tt.length).toBe(4);
        for (const t of tt) {
            expect(t.flags & TOKEN_FLAGS_LINE_END, `"${text(r, t)}" → LINE_END`).toBeTruthy();
        }
    });

    it("colspan TD 다음 행의 다중 TD", async () => {
        const r = await tok('<table><tr><td colspan="2">hello world</td></tr><tr><td>1.대출개요</td><td>개인택시</td></tr></table>');
        const tt = textTokens(r);
        // hello, world, 1., 대출개요, 개인택시
        const allTexts = tt.map(t => text(r, t));
        expect(allTexts).toContain("hello");
        expect(allTexts).toContain("world");
        expect(allTexts).toContain("대출개요");
        expect(allTexts).toContain("개인택시");
        // 모든 셀의 마지막 텍스트 토큰에 LINE_END
        // "world"는 첫 TD의 마지막, "대출개요"는 두번째 TD의 마지막, "개인택시"는 세번째 TD의 마지막
        const worldToken = tt.find(t => text(r, t) === "world");
        const 대출개요Token = tt.find(t => text(r, t) === "대출개요");
        const 개인택시Token = tt.find(t => text(r, t) === "개인택시");
        expect(worldToken!.flags & TOKEN_FLAGS_LINE_END, "world → LINE_END").toBeTruthy();
        expect(대출개요Token!.flags & TOKEN_FLAGS_LINE_END, "대출개요 → LINE_END").toBeTruthy();
        expect(개인택시Token!.flags & TOKEN_FLAGS_LINE_END, "개인택시 → LINE_END").toBeTruthy();
    });

    it("리스트 안에 테이블", async () => {
        const r = await tok("<ul><li><table><tr><td>셀</td></tr></table></li></ul>");
        const tt = textTokens(r);
        expect(tt.length).toBe(1);
        expect(tt[0].flags & TOKEN_FLAGS_LINE_END).toBeTruthy();
    });
});
