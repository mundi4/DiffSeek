import { describe, it, expect } from 'vitest';
import { findEmptyDiffMarkerPosition } from '../src/engine/find-empty-diff-marker-position';
import type { LineBoundaryInfo, Token } from '../src/tokenization/types';
import {
    TOKEN_FLAGS_LINE_START,
    TOKEN_FLAGS_STRUCTURAL_OPEN,
    TOKEN_FLAGS_TYPE_STRUCTURAL,
    TOKEN_FLAGS_NONE,
} from '../src/tokenization/token-flags';

// ── helpers ──────────────────────────────────────────────────────────────────

let tokenIndexCounter = 0;

function makeToken(overrides: Partial<Token> & { startNode?: Node; endNode?: Node } = {}): Token {
    const node = document.createTextNode("x");
    return {
        index: tokenIndexCounter++,
        flags: TOKEN_FLAGS_NONE,
        textOffset: 0,
        textLength: 1,
        startNode: node,
        startOffset: 0,
        endNode: node,
        endOffset: 1,
        lineNumber: 0,
        containerIndex: 0,
        ...overrides,
    };
}

function makeLineBoundary(
    which: Node,
    where: InsertPosition,
    containerIndex: number,
): LineBoundaryInfo {
    return { startWhich: which, startWhere: where, endWhich: null, endWhere: null, containerIndex };
}

function call(
    filledTokens: Token[],
    filledStart: number,
    emptyTokens: Token[],
    emptyLineBoundaries: LineBoundaryInfo[],
    emptyStart: number,
) {
    return findEmptyDiffMarkerPosition(filledTokens, filledStart, emptyTokens, emptyLineBoundaries, emptyStart);
}

// ── Case A ───────────────────────────────────────────────────────────────────

describe('Case A — empty document', () => {
    it('lineBoundaries[1]이 있으면 [1]을 사용', () => {
        const n0 = document.createElement('div');
        const n1 = document.createElement('div');
        const lb0 = makeLineBoundary(n0, 'afterbegin', 0);
        const lb1 = makeLineBoundary(n1, 'beforebegin', 1);

        const result = call(
            [makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 1 })],
            0,
            [],           // empty tokens
            [lb0, lb1],
            0,
        );
        expect(result?.which).toBe(n1);
        expect(result?.where).toBe('beforebegin');
    });

    it('lineBoundaries[1]이 없으면 [0]을 사용', () => {
        const n0 = document.createElement('div');
        const lb0 = makeLineBoundary(n0, 'afterbegin', 0);

        const result = call(
            [makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 1 })],
            0,
            [],
            [lb0],
            0,
        );
        expect(result?.which).toBe(n0);
        expect(result?.where).toBe('afterbegin');
    });

    it('lineBoundaries가 아예 없으면 null', () => {
        const result = call(
            [makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 1 })],
            0,
            [],
            [],
            0,
        );
        expect(result).toBeNull();
    });
});

// ── Case B ───────────────────────────────────────────────────────────────────

describe('Case B — 앞뒤가 같은 텍스트노드', () => {
    it('같은 텍스트노드 안 → null 반환', () => {
        const sharedText = document.createTextNode('hello world');
        const prev = makeToken({ endNode: sharedText });
        const next = makeToken({ startNode: sharedText });
        const filled = makeToken({ flags: TOKEN_FLAGS_NONE, containerIndex: 1 });

        const result = call([filled], 0, [prev, next], [], 1);
        expect(result).toBeNull();
    });

    it('다른 노드면 null이 아님', () => {
        const nodeA = document.createTextNode('a');
        const nodeB = document.createTextNode('b');
        const prev = makeToken({ endNode: nodeA });
        const next = makeToken({ startNode: nodeB });
        const filled = makeToken({ flags: TOKEN_FLAGS_NONE, containerIndex: 1 });

        const result = call([filled], 0, [prev, next], [], 1);
        expect(result).not.toBeNull();
    });
});

// ── Case C ───────────────────────────────────────────────────────────────────

describe('Case C — filled이 container 경계에서 시작', () => {
    it('gap lineBoundary(중간 container)가 있으면 사용', () => {
        // filled: ci=1 → ci=3 (container 경계)
        // empty:  ci=1 prev, ci=2 gap, ci=3 next
        const gapNode = document.createElement('span');
        const prevNode = document.createTextNode('intro');
        const nextNode = document.createTextNode('body');

        const filledPrev = makeToken({ containerIndex: 1, lineNumber: 1 });
        const filledStart = makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 3, lineNumber: 2 });

        const emptyPrev = makeToken({ endNode: prevNode, containerIndex: 1, lineNumber: 1 });
        const emptyNext = makeToken({ startNode: nextNode, containerIndex: 3, lineNumber: 3 });

        const lb0 = makeLineBoundary(document.createElement('div'), 'afterbegin', 0);
        const lb1 = makeLineBoundary(prevNode, 'beforebegin', 1);  // ci=1 (prev container)
        const lb2 = makeLineBoundary(gapNode, 'afterbegin', 2);    // ci=2 (gap — 이걸 써야 함)
        const lb3 = makeLineBoundary(nextNode, 'beforebegin', 3);  // ci=3 (next container)

        const result = call(
            [filledPrev, filledStart], 1,
            [emptyPrev, emptyNext], [lb0, lb1, lb2, lb3], 1,
        );
        expect(result?.which).toBe(gapNode);
        expect(result?.where).toBe('afterbegin');
    });

    it('gap lineBoundary 없이 prev·next container만 있으면 Case D로 fallthrough', () => {
        const prevNode = document.createTextNode('intro');
        const nextNode = document.createTextNode('body');

        const filledPrev = makeToken({ containerIndex: 1, lineNumber: 1 });
        const filledStart = makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 3, lineNumber: 2 });

        const emptyPrev = makeToken({ endNode: prevNode, containerIndex: 1, lineNumber: 1 });
        const emptyNext = makeToken({ startNode: nextNode, containerIndex: 3, lineNumber: 2 });

        // lb1=ci1, lb2=ci3 — gap container 없음
        const lb1 = makeLineBoundary(prevNode, 'beforebegin', 1);
        const lb2 = makeLineBoundary(nextNode, 'beforebegin', 3);

        const result = call(
            [filledPrev, filledStart], 1,
            [emptyPrev, emptyNext], [lb1, lb2], 1,
        );
        // Case D: emptyPrev 있음 → afterend
        expect(result?.which).toBe(prevNode);
        expect(result?.where).toBe('afterend');
    });

    it('empty 쪽 gap lineBoundary가 emptyNext container라면 건너뜀 → Case D', () => {
        // lb2가 ci=3 (emptyNext container) — 써서는 안됨
        const prevNode = document.createTextNode('intro');
        const nextNode = document.createTextNode('body');

        const filledPrev = makeToken({ containerIndex: 1, lineNumber: 1 });
        const filledStart = makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 3, lineNumber: 2 });

        const emptyPrev = makeToken({ endNode: prevNode, containerIndex: 1, lineNumber: 1 });
        const emptyNext = makeToken({ startNode: nextNode, containerIndex: 3, lineNumber: 3 });

        const lb1 = makeLineBoundary(prevNode, 'beforebegin', 1);
        const lb2 = makeLineBoundary(nextNode, 'beforebegin', 3); // ci=3 = emptyNext container → skip
        // lb3 없음

        const result = call(
            [filledPrev, filledStart], 1,
            [emptyPrev, emptyNext], [lb1, lb2], 1,
        );
        // lb2는 emptyNext container라 skip → Case D
        expect(result?.which).toBe(prevNode);
        expect(result?.where).toBe('afterend');
    });

    it('empty 쪽 <br> 줄경계(same container)는 건너뛰고 진짜 gap을 사용', () => {
        // empty 첫 container 안에 <br>로 인한 lineBoundary(ci=1)가 하나 더 있음
        const prevNode = document.createTextNode('intro');
        const brLineNode = document.createTextNode('');   // <br> 뒤 빈 줄
        const gapNode = document.createElement('span');
        const nextNode = document.createTextNode('body');

        const filledPrev = makeToken({ containerIndex: 1, lineNumber: 1 });
        const filledStart = makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 3, lineNumber: 3 });

        // empty: "intro"(ln1,ci1), "body"(ln3,ci3) — <br> 빈 줄은 토큰 없음
        const emptyPrev = makeToken({ endNode: prevNode, containerIndex: 1, lineNumber: 1 });
        const emptyNext = makeToken({ startNode: nextNode, containerIndex: 3, lineNumber: 3 });

        const lb0 = makeLineBoundary(document.createElement('div'), 'afterbegin', 0);
        const lb1 = makeLineBoundary(prevNode, 'beforebegin', 1);
        const lb2 = makeLineBoundary(brLineNode, 'beforebegin', 1); // <br> 줄경계, ci=1 → skip
        const lb3 = makeLineBoundary(gapNode, 'afterbegin', 2);     // gap, ci=2 → 이걸 사용
        // lb3 = ci3 도 있지만 이미 lb3(ci=2)에서 break

        const result = call(
            [filledPrev, filledStart], 1,
            [emptyPrev, emptyNext], [lb0, lb1, lb2, lb3], 1,
        );
        expect(result?.which).toBe(gapNode);
        expect(result?.where).toBe('afterbegin');
    });

    it('filled가 <br>로 인한 LINE_START(같은 container) → Case C skip → Case D', () => {
        // filledPrev와 filledStart가 같은 containerIndex → crossesContainerBoundary=false
        const prevNode = document.createTextNode('intro');
        const nextNode = document.createTextNode('body');
        const gapNode = document.createElement('span');

        const filledPrev = makeToken({ containerIndex: 1, lineNumber: 1 });
        const filledStart = makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 1, lineNumber: 2 }); // 같은 ci

        const emptyPrev = makeToken({ endNode: prevNode, containerIndex: 1, lineNumber: 1 });
        const emptyNext = makeToken({ startNode: nextNode, containerIndex: 3, lineNumber: 3 });

        const lb2 = makeLineBoundary(gapNode, 'afterbegin', 2); // gap이 있어도 Case C 진입 안 함

        const result = call(
            [filledPrev, filledStart], 1,
            [emptyPrev, emptyNext], [lb2], 1,
        );
        // Case C skip → Case D: emptyPrev → afterend
        expect(result?.which).toBe(prevNode);
        expect(result?.where).toBe('afterend');
    });

    it('filledStart=0 (문서 맨 앞)은 container 경계로 취급', () => {
        const gapNode = document.createElement('span');
        const nextNode = document.createTextNode('body');

        // filled는 문서 첫 토큰 (prev 없음)
        const filledStart = makeToken({ flags: TOKEN_FLAGS_LINE_START, containerIndex: 1, lineNumber: 1 });

        // emptyPrev 없음 → emptyPrevLineNum=0, 루프는 lineNum=1 부터 시작
        // lineBoundaries는 line number로 인덱싱 — lb1을 index 1에 배치해야 함
        const emptyNext = makeToken({ startNode: nextNode, containerIndex: 2, lineNumber: 2 });

        const lb0 = makeLineBoundary(document.createElement('div'), 'afterbegin', 0);
        const lb1 = makeLineBoundary(gapNode, 'afterbegin', 1); // ci=1, != -1(prev) != 2(next) → gap

        const result = call(
            [filledStart], 0,
            [emptyNext], [lb0, lb1], 0,
        );
        expect(result?.which).toBe(gapNode);
        expect(result?.where).toBe('afterbegin');
    });
});

// ── Structural token 처리 ─────────────────────────────────────────────────────

describe('structural 토큰 처리', () => {
    it('filledStart가 STRUCTURAL_OPEN이면 첫 content 토큰으로 skip', () => {
        const tdEl = document.createElement('td');
        const textNode = document.createTextNode('연령');
        const prevNode = document.createTextNode('생년월일');

        // filled: [STRUCTURAL_OPEN(td), "연령"(LINE_START, ci=3)]
        const structOpen = makeToken({ flags: TOKEN_FLAGS_STRUCTURAL_OPEN, startNode: tdEl, endNode: tdEl, containerIndex: 3, lineNumber: 2 });
        const content = makeToken({ flags: TOKEN_FLAGS_LINE_START, startNode: textNode, endNode: textNode, containerIndex: 3, lineNumber: 2 });
        // filledPrev (before STRUCTURAL_OPEN): "생년월일" in ci=1
        const filledPrev = makeToken({ containerIndex: 1, lineNumber: 1 });

        // emptyPrev: STRUCTURAL_CLOSE(td-생년월일) — 마지막 컨테이너 닫힘
        const emptyTdEl = document.createElement('td');
        const emptyPrev = makeToken({ flags: TOKEN_FLAGS_TYPE_STRUCTURAL, startNode: emptyTdEl, endNode: emptyTdEl, containerIndex: 1, lineNumber: 1 });

        // STRUCTURAL_OPEN skip → content 토큰 사용 → LINE_START + container boundary
        // Case C 진입하지만 gap lineBoundary 없음 → Case D
        // Case D: emptyPrev = STRUCTURAL_CLOSE → beforeend of td
        const result = call(
            [filledPrev, structOpen, content], 1, // filledStart=1 (STRUCTURAL_OPEN)
            [emptyPrev], [], 1,
        );
        expect(result?.which).toBe(emptyTdEl);
        expect(result?.where).toBe('beforeend');
    });

    it('emptyPrev가 STRUCTURAL_CLOSE → afterend 대신 beforeend(컨테이너 안)', () => {
        const tdEl = document.createElement('td');
        const emptyPrev = makeToken({ flags: TOKEN_FLAGS_TYPE_STRUCTURAL, startNode: tdEl, endNode: tdEl, containerIndex: 1, lineNumber: 1 });
        const filled = makeToken({ flags: TOKEN_FLAGS_NONE, containerIndex: 2, lineNumber: 2 });

        const result = call([filled], 0, [emptyPrev], [], 1);
        expect(result?.which).toBe(tdEl);
        expect(result?.where).toBe('beforeend');
    });

    it('filled가 STRUCTURAL_OPEN만 있으면 null', () => {
        const tdEl = document.createElement('td');
        const structOpen = makeToken({ flags: TOKEN_FLAGS_STRUCTURAL_OPEN, startNode: tdEl, endNode: tdEl, containerIndex: 1, lineNumber: 1 });
        const emptyNext = makeToken({ startNode: document.createTextNode('x'), containerIndex: 0, lineNumber: 0 });

        const result = call([structOpen], 0, [emptyNext], [], 0);
        expect(result).toBeNull();
    });
});

// ── Case D ───────────────────────────────────────────────────────────────────

describe('Case D — DOM 노드 기준 fallback', () => {
    it('emptyPrev가 STRUCTURAL_OPEN → afterbegin', () => {
        const containerEl = document.createElement('td');
        const prev = makeToken({ flags: TOKEN_FLAGS_STRUCTURAL_OPEN, endNode: containerEl, containerIndex: 1, lineNumber: 1 });
        const filled = makeToken({ flags: TOKEN_FLAGS_NONE, containerIndex: 2, lineNumber: 2 });

        const result = call([filled], 0, [prev], [], 1);
        expect(result?.which).toBe(containerEl);
        expect(result?.where).toBe('afterbegin');
    });

    it('emptyPrev가 일반 토큰 → afterend', () => {
        const textNode = document.createTextNode('hello');
        const prev = makeToken({ flags: TOKEN_FLAGS_NONE, endNode: textNode, containerIndex: 1, lineNumber: 1 });
        const filled = makeToken({ flags: TOKEN_FLAGS_NONE, containerIndex: 2, lineNumber: 2 });

        const result = call([filled], 0, [prev], [], 1);
        expect(result?.which).toBe(textNode);
        expect(result?.where).toBe('afterend');
    });

    it('emptyPrev 없고 emptyNext가 STRUCTURAL_CLOSE → beforeend', () => {
        const containerEl = document.createElement('td');
        const next = makeToken({ flags: TOKEN_FLAGS_TYPE_STRUCTURAL, startNode: containerEl, containerIndex: 1, lineNumber: 1 });
        const filled = makeToken({ flags: TOKEN_FLAGS_NONE, containerIndex: 0, lineNumber: 0 });

        const result = call([filled], 0, [next], [], 0);
        expect(result?.which).toBe(containerEl);
        expect(result?.where).toBe('beforeend');
    });

    it('emptyPrev 없고 emptyNext가 일반 토큰 → beforebegin', () => {
        const textNode = document.createTextNode('body');
        const next = makeToken({ flags: TOKEN_FLAGS_NONE, startNode: textNode, containerIndex: 1, lineNumber: 1 });
        const filled = makeToken({ flags: TOKEN_FLAGS_NONE, containerIndex: 0, lineNumber: 0 });

        const result = call([filled], 0, [next], [], 0);
        expect(result?.which).toBe(textNode);
        expect(result?.where).toBe('beforebegin');
    });
});
