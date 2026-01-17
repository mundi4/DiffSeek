// import { DIFF_TAG_NAME } from "../constants";
import { DIFF_TAG_NAME } from "../constants";
import type { Rect } from "../types";

// // diff element
// if (
//     emptyDiff &&
//     range.startContainer.nodeType === 1 &&
//     range.startContainer.nodeName === DIFF_TAG_NAME
// ) {
//     const diffEl = range.startContainer.childNodes[range.startOffset] as HTMLElement;
//     tempRange.selectNodeContents(diffEl.firstChild!);
//     for (const rect of tempRange.getClientRects()) {
//         result.push({
//             x: rect.x + offsetLeft - expandX,
//             y: rect.y + offsetTop - expandY,
//             width: rect.width + expandX * 2,
//             height: rect.height + expandY * 2,
//         });
//     }
//     return result;
// }

//
// 큰 실수 했음.
// 이 함수는 diff rect를 추출할 때 외에도
// 선택영역 highlight rect를 추출할 때도 사용되는데 이 경우에는 이 함수에서 가정하는 range 형태가 아닐 수 있음!
// 현재 가정: 텍스트노드~텍스트노드 || 하나의 element
// => 예전 버전으로 돌리거나 diff, highlight를 두개의 함수로 분리하거나(거의 중복)
const tempRange = document.createRange();
const results: Rect[] = [];
export function extractRectsFromRange(range: Range, offsetLeft: number, offsetTop: number, expandX = 0, expandY = 0, emptyDiff = false): Rect[] {
    results.length = 0;

    if (
        emptyDiff &&
        range.startContainer.nodeType === 1 &&
        range.startContainer === range.endContainer && range.startOffset + 1 === range.endOffset) {
        const diffEl = range.startContainer.childNodes[range.startOffset] as HTMLElement;

        // diffEl.classList.add("extracting");
        // void diffEl.offsetWidth; // force reflow
        const tempText = diffEl.firstChild!;
        tempRange.selectNodeContents(tempText);

        for (const rect of tempRange.getClientRects()) {
            results.push({
                x: rect.x + offsetLeft - expandX,
                y: rect.y + offsetTop - expandY,
                width: rect.width + expandX * 2,
                height: rect.height + expandY * 2,
            });
        }
        // diffEl.classList.remove("extracting");

        return results;
    }

    if (range.startContainer.nodeType === 1) {
        if (import.meta.env.DEV) {
            console.assert(range.startContainer === range.endContainer, "extractRectsFromRange: startContainer and endContainer should be the same when startContainer is an element.");
            console.assert(range.startOffset + 1 === range.endOffset, "extractRectsFromRange: startOffset and endOffset should differ by 1 when startContainer is an element.");
        }

        const element = range.startContainer.childNodes[range.startOffset] as HTMLElement;
        if (import.meta.env.DEV) {
            console.assert(element?.nodeType === 1, "extractRectsFromRange: child node at startOffset should exist and be an element.");
        }

        if (element.nodeName === DIFF_TAG_NAME) {
            const innerText = element.firstChild;
            if (import.meta.env.DEV) {
                console.assert(innerText?.nodeType === 3, "extractRectsFromRange: diff element should have a first child that is a text node.");
            }
            tempRange.selectNodeContents(innerText!);
            const domRect = tempRange.getBoundingClientRect();
            return [{
                x: domRect.x + offsetLeft - expandX,
                y: domRect.y + offsetTop - expandY,
                width: domRect.width + expandX * 2,
                height: domRect.height + expandY * 2,
            }];
        } else if (element.nodeName === "IMG") {
            const domRect = element.getBoundingClientRect();
            return [{
                x: domRect.x + offsetLeft - expandX,
                y: domRect.y + offsetTop - expandY,
                width: domRect.width + expandX * 2,
                height: domRect.height + expandY * 2,
            }];
        } else {
            const domRect = element.getBoundingClientRect();
            return [{
                x: domRect.x + offsetLeft - expandX,
                y: domRect.y + offsetTop - expandY,
                width: domRect.width + expandX * 2,
                height: domRect.height + expandY * 2,
            }];
        }
    }


    // text node ~ text node
    if (import.meta.env.DEV) {
        console.assert(range.startContainer.nodeType === 3, "extractRectsFromRange: startContainer should be a text node.");
        console.assert(range.endContainer.nodeType === 3, "extractRectsFromRange: endContainer should be a text node.");
    }

    // 내가 만들어서 보내는 range는
    // 하나의 element이거나 textNode ~ textNode임.

    // text node ~ text node

    // fast path: same container
    if (range.startContainer === range.endContainer) {
        for (const rect of range.getClientRects()) {
            if (rect.x === 0 && rect.y === 0) continue;
            results.push({
                x: rect.x + offsetLeft - expandX,
                y: rect.y + offsetTop - expandY,
                width: rect.width + expandX * 2,
                height: rect.height + expandY * 2,
            });
            // if (emptyDiff) return result;
        }
        return results;
    }

    tempRange.setStart(range.startContainer, range.startOffset);
    tempRange.setEnd(range.startContainer, range.startContainer.nodeValue!.length);
    for (const rect of tempRange.getClientRects()) {
        if (rect.width === 0 && rect.height === 0) continue;
        results.push({
            x: rect.x + offsetLeft - expandX,
            y: rect.y + offsetTop - expandY,
            width: rect.width + expandX * 2,
            height: rect.height + expandY * 2,
        });
        // if (emptyDiff) return result;
    }

    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    walker.currentNode = range.startContainer; // nextNode()부터 시작하기 위해
    let endNode = range.endContainer;
    let endOffset = range.endOffset;

    let node: Text;
    while ((node = walker.nextNode() as Text)) {
        if (node === endNode) {
            // 마지막 노드인 경우 text일부분만 범위에 포함되었을 수 있으므로
            // offset까지만 별도 범위로 만들어서 추출함
            if (endOffset >= 0) {
                tempRange.setStart(endNode, 0);
                tempRange.setEnd(endNode, endOffset);
                for (const rect of tempRange.getClientRects()) {
                    if (rect.width === 0 && rect.height === 0) continue;
                    results.push({
                        x: rect.x + offsetLeft - expandX,
                        y: rect.y + offsetTop - expandY,
                        width: rect.width + expandX * 2,
                        height: rect.height + expandY * 2,
                    });
                    // if (emptyDiff) return result;
                }
            }
            break;
        }

        tempRange.selectNodeContents(node);
        for (const rect of tempRange.getClientRects()) {
            if (rect.width === 0 && rect.height === 0) continue;
            results.push({
                x: rect.x + offsetLeft - expandX,
                y: rect.y + offsetTop - expandY,
                width: rect.width + expandX * 2,
                height: rect.height + expandY * 2,
            });
            // if (emptyDiff) return result;
        }
    }

    if (results.length === 0) {
        console.warn("extractRectsFromRange: no rects extracted for range", range);
    }

    return results;
}

export function zzzextractRectsFromRange(range: Range, offsetLeft: number, offsetTop: number, expandX = 0, expandY = 0, emptyDiff = false): Rect[] {
    results.length = 0;

    if (range.startContainer.nodeType === 1) {
        if (import.meta.env.DEV) {
            console.assert(range.startContainer === range.endContainer, "extractRectsFromRange: startContainer and endContainer should be the same when startContainer is an element.");
            console.assert(range.startOffset + 1 === range.endOffset, "extractRectsFromRange: startOffset and endOffset should differ by 1 when startContainer is an element.");
        }

        const element = range.startContainer.childNodes[range.startOffset] as HTMLElement;
        if (import.meta.env.DEV) {
            console.assert(element?.nodeType === 1, "extractRectsFromRange: child node at startOffset should exist and be an element.");
        }

        if (element.nodeName === DIFF_TAG_NAME) {
            const innerText = element.firstChild;
            if (import.meta.env.DEV) {
                console.assert(innerText?.nodeType === 3, "extractRectsFromRange: diff element should have a first child that is a text node.");
            }
            tempRange.selectNodeContents(innerText!);
            const domRect = tempRange.getBoundingClientRect();
            return [{
                x: domRect.x + offsetLeft - expandX,
                y: domRect.y + offsetTop - expandY,
                width: domRect.width + expandX * 2,
                height: domRect.height + expandY * 2,
            }];
        } else if (element.nodeName === "IMG") {
            const domRect = element.getBoundingClientRect();
            return [{
                x: domRect.x + offsetLeft - expandX,
                y: domRect.y + offsetTop - expandY,
                width: domRect.width + expandX * 2,
                height: domRect.height + expandY * 2,
            }];
        } else {
            const domRect = element.getBoundingClientRect();
            return [{
                x: domRect.x + offsetLeft - expandX,
                y: domRect.y + offsetTop - expandY,
                width: domRect.width + expandX * 2,
                height: domRect.height + expandY * 2,
            }];
        }
    }


    // text node ~ text node
    if (import.meta.env.DEV) {
        console.assert(range.startContainer.nodeType === 3, "extractRectsFromRange: startContainer should be a text node.");
        console.assert(range.endContainer.nodeType === 3, "extractRectsFromRange: endContainer should be a text node.");
    }

    // 내가 만들어서 보내는 range는
    // 하나의 element이거나 textNode ~ textNode임.

    // text node ~ text node

    // fast path: same container
    if (range.startContainer === range.endContainer) {
        for (const rect of range.getClientRects()) {
            if (rect.x === 0 && rect.y === 0) continue;
            results.push({
                x: rect.x + offsetLeft - expandX,
                y: rect.y + offsetTop - expandY,
                width: rect.width + expandX * 2,
                height: rect.height + expandY * 2,
            });
            // if (emptyDiff) return result;
        }
        return results;
    }

    tempRange.setStart(range.startContainer, range.startOffset);
    tempRange.setEnd(range.startContainer, range.startContainer.nodeValue!.length);
    for (const rect of tempRange.getClientRects()) {
        if (rect.width === 0 && rect.height === 0) continue;
        results.push({
            x: rect.x + offsetLeft - expandX,
            y: rect.y + offsetTop - expandY,
            width: rect.width + expandX * 2,
            height: rect.height + expandY * 2,
        });
        // if (emptyDiff) return result;
    }

    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    walker.currentNode = range.startContainer; // nextNode()부터 시작하기 위해
    let endNode = range.endContainer;
    let endOffset = range.endOffset;

    let node: Text;
    while ((node = walker.nextNode() as Text)) {
        if (node === endNode) {
            // 마지막 노드인 경우 text일부분만 범위에 포함되었을 수 있으므로
            // offset까지만 별도 범위로 만들어서 추출함
            if (endOffset >= 0) {
                tempRange.setStart(endNode, 0);
                tempRange.setEnd(endNode, endOffset);
                for (const rect of tempRange.getClientRects()) {
                    if (rect.width === 0 && rect.height === 0) continue;
                    results.push({
                        x: rect.x + offsetLeft - expandX,
                        y: rect.y + offsetTop - expandY,
                        width: rect.width + expandX * 2,
                        height: rect.height + expandY * 2,
                    });
                    // if (emptyDiff) return result;
                }
            }
            break;
        }

        tempRange.selectNodeContents(node);
        for (const rect of tempRange.getClientRects()) {
            if (rect.width === 0 && rect.height === 0) continue;
            results.push({
                x: rect.x + offsetLeft - expandX,
                y: rect.y + offsetTop - expandY,
                width: rect.width + expandX * 2,
                height: rect.height + expandY * 2,
            });
            // if (emptyDiff) return result;
        }
    }

    if (results.length === 0) {
        console.warn("extractRectsFromRange: no rects extracted for range", range);
    }

    return results;
}