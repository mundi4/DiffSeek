import type { LineBoundaryInfo, Token } from "../tokenization/types";
import { getStructuralElementType, isStructuralClose, STRUCTURAL_ELEMENT_TR, TOKEN_FLAGS_LINE_START, TOKEN_FLAGS_STRUCTURAL_OPEN, TOKEN_FLAGS_TYPE_STRUCTURAL } from "../tokenization/token-flags";

/**
 * empty 쪽에 diff marker를 삽입할 DOM 위치를 결정한다.
 *
 * @param filledTokens  - diff가 있는 쪽 토큰 배열
 * @param filledStart   - filled 쪽 diff 시작 인덱스
 * @param emptyTokens   - marker를 삽입할 쪽 토큰 배열
 * @param emptyLineBoundaries - marker를 삽입할 쪽 lineBoundary 배열
 * @param emptyStart    - marker가 놓일 위치 (emptyTokens 기준 인덱스, insertBefore 시맨틱)
 * @returns { which, where } 또는 null (삽입 불가 — Case B)
 */
export function findEmptyDiffMarkerPosition(
    filledTokens: readonly Token[],
    filledStart: number,
    emptyTokens: readonly Token[],
    emptyLineBoundaries: readonly LineBoundaryInfo[],
    emptyStart: number,
): { which: Node; where: InsertPosition } | null {

    // [케이스 A] empty 쪽 문서 자체가 완전히 비어있음.
    // lineBoundaries[1]이 있으면 그걸 우선 사용 — [0]은 root container의 가상 줄이고
    // [1]이 실제 편집 가능한 첫 줄 위치이기 때문.
    if (emptyTokens.length === 0) {
        const line = emptyLineBoundaries[1] ?? emptyLineBoundaries[0];
        if (!line) return null;
        return { which: line.startWhich, where: line.startWhere };
    }

    const emptyPrevToken = emptyStart > 0 ? emptyTokens[emptyStart - 1] : null;
    const emptyNextToken = emptyStart < emptyTokens.length ? emptyTokens[emptyStart] : null;

    // [케이스 B] 앞뒤 토큰이 같은 텍스트노드 안에 있음.
    // 텍스트노드 중간에는 요소를 삽입할 수 없으므로 null 반환.
    // (렌더러가 토큰 범위로 하이라이팅하므로 marker 없어도 diff는 표시됨)
    if (emptyPrevToken && emptyNextToken &&
        emptyPrevToken.endNode === emptyNextToken.startNode &&
        emptyPrevToken.endNode.nodeType === 3) {
        return null;
    }

    let which: Node | null = null;
    let where: InsertPosition | null = null;

    // structural 토큰(OPEN/CLOSE)은 위치 판단에 사용하지 않음.
    // STRUCTURAL_OPEN은 LINE_START가 없어 Case C를 타지 못하고,
    // STRUCTURAL_CLOSE는 컨테이너 요소 자체를 DOM 앵커로 갖기 때문에
    // afterend 위치가 <tr> 안의 invalid 위치가 됨.
    // → 양 끝의 structural 토큰을 건너뛰고 첫 content 토큰을 기준으로 삼음.
    while (filledStart < filledTokens.length && (filledTokens[filledStart].flags & TOKEN_FLAGS_STRUCTURAL_OPEN)) filledStart++;

    const filledStartToken = filledTokens[filledStart];
    // filledStartToken이 null이면 (filled diff가 structural만) Case C 건너뛰고 Case D로
    const filledPrevToken = filledStart > 0 ? filledTokens[filledStart - 1] : null;

    if (filledStartToken && (filledStartToken.flags & TOKEN_FLAGS_LINE_START)) {
        // [케이스 C] filled 쪽 diff가 줄의 시작에서 시작됨.
        // 단, LINE_START가 container 경계 때문인지(<td> 진입 등) 아니면
        // 같은 container 안의 <br> 때문인지 구분해야 함.
        //
        // <br>로 인한 LINE_START(같은 containerIndex) → Case D로.
        // container 경계에서의 LINE_START(containerIndex 달라짐) → gap lineBoundary 탐색.

        const crossesContainerBoundary =
            filledPrevToken === null ||
            filledPrevToken.containerIndex !== filledStartToken.containerIndex;

        if (crossesContainerBoundary && !(emptyPrevToken && (emptyPrevToken.flags & TOKEN_FLAGS_STRUCTURAL_OPEN))) {
            // emptyPrevToken이 STRUCTURAL_OPEN이면 컨테이너 안에 막 진입한 상태.
            // Case D가 afterbegin으로 정확히 처리하므로 lineBoundary 검색 불필요.
            //
            // structural 토큰은 lineNumber/containerIndex가 의미 없음.
            // → structural을 건너뛴 content 토큰으로 탐색 범위를 결정.
            // contentPrev가 null이면 검색 범위의 시작점을 잡을 수 없으므로 Case D로 fallthrough.
            let pi = emptyStart - 1;
            while (pi >= 0 && (emptyTokens[pi].flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) pi--;
            const contentPrev = pi >= 0 ? emptyTokens[pi] : null;

            if (contentPrev) {
                let ni = emptyStart;
                while (ni < emptyTokens.length && (emptyTokens[ni].flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) ni++;
                const contentNext = ni < emptyTokens.length ? emptyTokens[ni] : null;

                const emptyPrevLineNum = contentPrev.lineNumber;
                const emptyNextLineNum = contentNext ? contentNext.lineNumber : emptyPrevLineNum + 1;
                const emptyPrevContainerIndex = contentPrev.containerIndex;
                const emptyNextContainerIndex = contentNext?.containerIndex ?? -1;

                if (emptyNextLineNum > emptyPrevLineNum) {
                    for (let lineNum = emptyPrevLineNum + 1; lineNum <= emptyNextLineNum; lineNum++) {
                        const line = emptyLineBoundaries[lineNum];
                        if (line &&
                            line.containerIndex !== emptyPrevContainerIndex &&
                            line.containerIndex !== emptyNextContainerIndex) {
                            which = line.startWhich;
                            where = line.startWhere;
                            break;
                        }
                    }
                }
            }
        }
    }

    if (!which) {
        // [케이스 D] fallback: lineBoundary로 위치를 못 잡은 경우.
        // 인접 토큰의 DOM 노드 기준으로 직접 삽입 위치를 결정.
        if (emptyPrevToken) {
            if (emptyPrevToken.flags & TOKEN_FLAGS_STRUCTURAL_OPEN) {
                // structural open 바로 뒤 → 컨테이너 안 첫 위치
                const el = emptyPrevToken.endNode as HTMLElement;
                if (getStructuralElementType(emptyPrevToken.flags) >= STRUCTURAL_ELEMENT_TR) {
                    // TR/TABLE level → 직접 삽입 불가, 첫 번째 자식(td/th)으로 이동
                    const firstChild = el.firstElementChild;
                    if (firstChild) {
                        which = firstChild;
                        where = "afterbegin";
                    }
                } else {
                    which = el;
                    where = "afterbegin";
                }
            } else if (isStructuralClose(emptyPrevToken.flags)) {
                // structural close 바로 뒤 = 컨테이너가 방금 닫힘.
                const el = emptyPrevToken.startNode as HTMLElement;
                if (getStructuralElementType(emptyPrevToken.flags) >= STRUCTURAL_ELEMENT_TR) {
                    // TR/TABLE level → 마지막 자식(td/th)으로 이동
                    const lastChild = el.lastElementChild;
                    if (lastChild) {
                        which = lastChild;
                        where = "beforeend";
                    }
                } else {
                    which = el;
                    where = "beforeend";
                }
            } else {
                which = emptyPrevToken.endNode;
                where = "afterend";
            }
        }
        if (!which) {
            // 앞 토큰도 없음 (또는 TR-level에서 자식 없음) → 뒤 토큰 기준
            if (emptyNextToken && (emptyNextToken.flags & TOKEN_FLAGS_STRUCTURAL_OPEN)) {
                const el = emptyNextToken.startNode as HTMLElement;
                if (getStructuralElementType(emptyNextToken.flags) >= STRUCTURAL_ELEMENT_TR) {
                    const firstChild = el.firstElementChild;
                    if (firstChild) {
                        which = firstChild;
                        where = "afterbegin";
                    }
                } else {
                    which = el;
                    where = "afterbegin";
                }
            } else if (emptyNextToken && isStructuralClose(emptyNextToken.flags)) {
                const el = emptyNextToken.startNode as HTMLElement;
                if (getStructuralElementType(emptyNextToken.flags) >= STRUCTURAL_ELEMENT_TR) {
                    const lastChild = el.lastElementChild;
                    if (lastChild) {
                        which = lastChild;
                        where = "beforeend";
                    }
                } else {
                    which = el;
                    where = "beforeend";
                }
            } else if (emptyNextToken) {
                which = emptyNextToken.startNode;
                where = "beforebegin";
            }
        }
    }

    if (!which || !where) return null;
    return { which, where };
}
