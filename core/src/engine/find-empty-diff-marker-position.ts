import type { LineBoundaryInfo, Token } from "../tokenization/types";
import { TOKEN_FLAGS_LINE_START, TOKEN_FLAGS_STRUCTURAL_CLOSE, TOKEN_FLAGS_STRUCTURAL_OPEN } from "../tokenization/token-flags";

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
    if (!filledStartToken) {
        // filled diff가 structural 토큰만으로 이루어진 경우 — 위치 잡을 수 없음
        return null;
    }
    const filledPrevToken = filledStart > 0 ? filledTokens[filledStart - 1] : null;

    if (filledStartToken.flags & TOKEN_FLAGS_LINE_START) {
        // [케이스 C] filled 쪽 diff가 줄의 시작에서 시작됨.
        // 단, LINE_START가 container 경계 때문인지(<td> 진입 등) 아니면
        // 같은 container 안의 <br> 때문인지 구분해야 함.
        //
        // <br>로 인한 LINE_START(같은 containerIndex) → Case D로.
        // container 경계에서의 LINE_START(containerIndex 달라짐) → gap lineBoundary 탐색.

        const crossesContainerBoundary =
            filledPrevToken === null ||
            filledPrevToken.containerIndex !== filledStartToken.containerIndex;

        if (crossesContainerBoundary) {
            const emptyPrevLineNum = emptyPrevToken ? emptyPrevToken.lineNumber : 0;
            const emptyNextLineNum = emptyNextToken ? emptyNextToken.lineNumber : emptyPrevLineNum + 1;
            // Case C에서 쓸 lineBoundary는 emptyPrev와 emptyNext 사이의
            // "중간" continuation container의 것이어야 함.
            // emptyPrev container의 <br> 줄경계 → 같은 container → 틀림
            // emptyNext container의 lineBoundary → next content container → 틀림
            // 둘 다 아닌 것만 사용. 없으면 Case D로 fallthrough.
            const emptyPrevContainerIndex = emptyPrevToken?.containerIndex ?? -1;
            const emptyNextContainerIndex = emptyNextToken?.containerIndex ?? -1;

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

    if (!which) {
        // [케이스 D] fallback: lineBoundary로 위치를 못 잡은 경우.
        // 인접 토큰의 DOM 노드 기준으로 직접 삽입 위치를 결정.
        if (emptyPrevToken) {
            if (emptyPrevToken.flags & TOKEN_FLAGS_STRUCTURAL_OPEN) {
                // structural open 바로 뒤 → 컨테이너 안 첫 위치
                which = emptyPrevToken.endNode;
                where = "afterbegin";
            } else if (emptyPrevToken.flags & TOKEN_FLAGS_STRUCTURAL_CLOSE) {
                // structural close 바로 뒤 = 컨테이너가 방금 닫힘.
                // afterend(containerEl)은 <tr> 안에 비-<td> 삽입 같은 invalid HTML이 될 수 있음.
                // → 해당 컨테이너 안 마지막 위치(beforeend)에 삽입.
                which = emptyPrevToken.startNode;
                where = "beforeend";
            } else {
                which = emptyPrevToken.endNode;
                where = "afterend";
            }
        }
        if (!which) {
            // 앞 토큰도 없음 → 뒤 토큰 기준
            if (emptyNextToken!.flags & TOKEN_FLAGS_STRUCTURAL_CLOSE) {
                // 구조 토큰(structural close) 바로 앞 → 컨테이너 안 마지막 위치
                which = emptyNextToken!.startNode;
                where = "beforeend";
            } else {
                which = emptyNextToken!.startNode;
                where = "beforebegin";
            }
        }
    }

    if (!which || !where) return null;
    return { which, where };
}
