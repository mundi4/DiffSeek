import { TOKEN_BUFFER_STRIDE } from "../shared/constants";
import type { EditorName } from "../editor";
import type { Span } from "../shared/types";
import type { DiffContext } from "./types";

/**
 * sourceSpan이 가리키는 토큰 구간을 기준으로 반대편 구간을 찾아낸다.
 * 토큰이 항상 1대1로 매칭이 된다면 참으로 아름다운 세상이었겠지만 인생 그렇게 쉽지 않다...
 *
 * 예: 왼쪽은 ["가","나"](두개의 토큰), 오른쪽은 ["가나"](하나의 토큰)인 경우 왼쪽에서 "가"만 선택하더라도
 * 오른쪽은 "가나"가 매칭이 되어야 한다. 그러면 오른쪽의 "가나"에 매칭되는 왼쪽은 토큰은? "가"와 "나"가 된다.
 *
 * source, dest, source, dest 확장이 안될때까지 무한 확장을 시도하는 방법을 쓰다가 잠들기 전 더 쉽고 빠른 방법이 생각나서 바꿈.
 *
 * 파라미터:
 * @param side - `"left"` or `"right"`.
 * @param sourceSpan { start, end } 형태. start와 end는 토큰 인덱스. end는 exclusive임.
 *
 * 반환값:
 * @returns { left: Span, right: Span } left와 right는 start,end 토큰인덱스가 들어있는 span이고
 * 										마찬가지로 end는 exclusive.
 *
 * 예외:
 * @throws {Error} sourceSpan의 토큰인덱스가 out of bound인 경우. side 체크는 안한다. 그건 알아서 잘 하겠지.
 *
 * 예시:
 * // 왼쪽 ["가","나"], 오른쪽 ["가나"]
 * // side = "left", sourceSpan = "가"
 * // 결과 => left=["가","나"], right=["가나"]
 */
export function resolveMatchingSpanPair(diffContext: DiffContext, side: EditorName, sourceSpan: Span): { left: Span; right: Span } {
    const tokenBuffer = side === "left" ? diffContext.leftTokenBuffer : diffContext.rightTokenBuffer;
    if (tokenBuffer.length === 0) {
        return { left: { start: 0, end: 0 }, right: { start: 0, end: 0 } };
    }

    // if (diffContext.entries.length === 0) {
    //     return { left: { start: 0, end: 0 }, right: { start: 0, end: 0 } };
    // }

    const start = tokenBuffer[sourceSpan.start * TOKEN_BUFFER_STRIDE + 0];
    const end = tokenBuffer[sourceSpan.start * TOKEN_BUFFER_STRIDE + 1];
    const oppStart = tokenBuffer[sourceSpan.start * TOKEN_BUFFER_STRIDE + 2];
    const oppEnd = tokenBuffer[sourceSpan.end * TOKEN_BUFFER_STRIDE - 1 + 3];

    const thisSpan: Span = { start, end };
    const otherSpan: Span = { start: oppStart, end: oppEnd };
    return side === "left" ? { left: thisSpan, right: otherSpan } : { left: otherSpan, right: thisSpan };

    // if (diffContext.entries.length === 0) {
    //     return { left: { start: 0, end: 0 }, right: { start: 0, end: 0 } };
    // }

    // const leftEntries = diffContext.leftEntries;
    // const rightEntries = diffContext.rightEntries;


    // const thisEntries = side === "left" ? leftEntries : rightEntries;
    // const n = thisEntries.length;

    // if (n === 0 || (sourceSpan.start === 0 && sourceSpan.end === 0)) {
    //     return { left: { start: 0, end: 0 }, right: { start: 0, end: 0 } };
    // }

    // if (sourceSpan.start < 0 || sourceSpan.end < sourceSpan.start || sourceSpan.end > n) {
    //     throw new Error(`Invalid span [${sourceSpan.start}, ${sourceSpan.end}) for side=${side}`);
    // }

    // const other: EditorName = side === "left" ? "right" : "left";

    // // 비어있지 않은 스팬이면 엔트리 경계에 맞춰 좌우 확장
    // const expandOnSide = (fromSide: EditorName, span: Span): Span => {
    //     const entries = fromSide === "left" ? leftEntries : rightEntries;
    //     let a = span.start;
    //     let b = span.end;

    //     let realStart, realEnd;
    //     if (a >= entries.length) {
    //         realStart = realEnd = entries.length;
    //     } else if (a === b) {
    //         realStart = entries[a][fromSide].start;
    //         if (realStart < a) {
    //             realEnd = entries[a][fromSide].end;
    //         } else {
    //             realEnd = a;
    //         }
    //     } else {
    //         realStart = entries[a][fromSide].start;
    //         realEnd = entries[b - 1][fromSide].end;
    //     }

    //     return { start: realStart, end: realEnd };
    // };

    // const expanded = expandOnSide(side, sourceSpan);
    // let otherSpan: Span;
    // if (expanded.start === expanded.end) {
    //     const k = expanded.start;
    //     if (k >= thisEntries.length) {
    //         const startAndEnd = thisEntries[thisEntries.length - 1]?.[other]?.end ?? 0;
    //         otherSpan = {
    //             start: startAndEnd,
    //             end: startAndEnd,
    //         };
    //     } else if (thisEntries[k] && thisEntries[k][other]) {
    //         otherSpan = {
    //             start: thisEntries[k][other].start,
    //             end: thisEntries[k][other].start,
    //         };
    //     } else {
    //         // fallback: 빈 span 반환
    //         otherSpan = { start: 0, end: 0 };
    //     }
    // } else {
    //     otherSpan = {
    //         start: thisEntries[expanded.start][other].start,
    //         end: thisEntries[expanded.end - 1][other].end,
    //     };
    // }

    // return side === "left" ? { left: expanded, right: otherSpan } : { left: otherSpan, right: expanded };
}