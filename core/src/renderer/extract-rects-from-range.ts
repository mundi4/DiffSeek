// import { DIFF_TAG_NAME } from "../constants";
import { DIFF_TAG_NAME } from "../constants";
import { advanceNode } from "../utils/advance-node";
import type { Rect } from "./types";

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

export function extractRectsFromRange(range: Range, offsetLeft: number, offsetTop: number, expandX = 0, expandY = 0, isEmptyDiff = false): Rect[] {
    const result: Rect[] = [];
    const tempRange = document.createRange();
    let startNode: Node | null;

    // if (
    //     isDiff &&
    //     range.startContainer.nodeType === 1 &&
    //     range.startContainer === range.endContainer &&
    //     range.startOffset + 1 === range.endOffset) {
    //     const diffEl = range.startContainer.childNodes[range.startOffset] as HTMLElement;

    //     // diffEl.classList.add("extracting");
    //     // void diffEl.offsetWidth; // force reflow
    //     const tempText = diffEl.firstChild!;
    //     tempRange.selectNodeContents(tempText);

    //     for (const rect of tempRange.getClientRects()) {
    //         result.push({
    //             x: rect.x + offsetLeft - expandX,
    //             y: rect.y + offsetTop - expandY,
    //             width: rect.width + expandX * 2,
    //             height: rect.height + expandY * 2,
    //         });
    //     }
    //     // diffEl.classList.remove("extracting");

    //     return result;
    // }

    // console.log("extracting rects from range", { range, offsetLeft, offsetTop, expandX, expandY, isEmptyDiff });

    if (range.startContainer.nodeType === 3) {
        tempRange.setStart(range.startContainer, range.startOffset);

        // if (isEmptyDiff) {
        //     tempRange.collapse(true);
        // } else {
        //     if (range.startContainer === range.endContainer) {
        //         tempRange.setEnd(range.startContainer, range.endOffset);
        //     } else {
        //         tempRange.setEnd(range.startContainer, range.startContainer.nodeValue!.length);
        //     }
        // }
        if (range.startContainer === range.endContainer) {
            tempRange.setEnd(range.startContainer, range.endOffset);
        } else {
            tempRange.setEnd(range.startContainer, range.startContainer.nodeValue!.length);
        }
        for (const rect of tempRange.getClientRects()) {
            result.push({
                x: rect.x + offsetLeft - expandX,
                y: rect.y + offsetTop - expandY,
                width: rect.width + expandX * 2,
                height: rect.height + expandY * 2,
            });
            if (isEmptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
        }
        startNode = advanceNode(range.startContainer)!;
    } else {
        startNode = range.startContainer.childNodes[range.startOffset] ?? advanceNode(range.startContainer, null, true);
        if (!startNode) return result;
    }

    const endContainer = range.endContainer;
    let endOffset: number;
    let endNode: Node;
    if (endContainer.nodeType === 3) {
        endNode = endContainer;
        endOffset = range.endOffset;
    } else {
        endNode = endContainer.childNodes[range.endOffset] ?? advanceNode(endContainer, null, true)!;
        endOffset = -1;
    }

    const commonAncestorContainer = range.commonAncestorContainer;
    if (!startNode || !endNode || !commonAncestorContainer.contains(startNode) || endNode.compareDocumentPosition(startNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return result;
    }

    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
    walker.currentNode = startNode;

    do {
        const node = walker.currentNode;
        if (!node) break;

        if (node === endNode) {
            if (node.nodeType === 3 && endOffset >= 0) {
                tempRange.setStart(endNode, 0);
                // if (isEmptyDiff) {
                //     tempRange.collapse(true);
                // } else {
                //tempRange.setEnd(endNode, endOffset);
                // }
                tempRange.setEnd(endNode, endOffset);
                for (const rect of tempRange.getClientRects()) {
                    result.push({
                        x: rect.x + offsetLeft - expandX,
                        y: rect.y + offsetTop - expandY,
                        width: rect.width + expandX * 2,
                        height: rect.height + expandY * 2,
                    });
                    if (isEmptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
                }
            }
            break;
        }

        if (node.nodeType === 3) {
            // 텍스트 노드. 경계에 걸린 경우가 아니므로 전체 텍스트를 그대로 선택.
            tempRange.selectNodeContents(node);
            for (const rect of tempRange.getClientRects()) {
                result.push({
                    x: rect.x + offsetLeft - expandX,
                    y: rect.y + offsetTop - expandY,
                    width: rect.width + expandX * 2,
                    height: rect.height + expandY * 2,
                });
            }
        } else if (node.nodeName === "BR") {
            // 아이고 의미 없다
        } else if (node.nodeName === DIFF_TAG_NAME) {
            if (isEmptyDiff) { // diff rects 추출 시에만
                // 우리가 이미 zws를 넣고 있으므로

                // diff용 rect 추출 시에만
                // const tempText = document.createTextNode("\u200B");
                let tempText = node.firstChild;
                let shoudRemoveTempText = false;
                if (!tempText) {
                    if (import.meta.env.DEV) {
                        console.warn("diff element has no child, inserting temporary text node for rect extraction", node);
                    }
                    tempText = document.createTextNode("\u200B");
                    node.appendChild(tempText);
                    shoudRemoveTempText = true;
                }
                tempRange.selectNodeContents(tempText);
                for (const rect of tempRange.getClientRects()) {
                    result.push({
                        x: rect.x + offsetLeft - expandX,
                        y: rect.y + offsetTop - expandY,
                        width: rect.width + expandX * 2,
                        height: rect.height + expandY * 2,
                    });
                }
                shoudRemoveTempText && tempText.remove();
            }
        } else if (node.nodeName === "IMG") {
            tempRange.selectNode(node);
            for (const rect of tempRange.getClientRects()) {
                result.push({
                    x: rect.x + offsetLeft - expandX,
                    y: rect.y + offsetTop - expandY,
                    width: rect.width + expandX * 2,
                    height: rect.height + expandY * 2,
                });
            }
        }
    } while (walker.nextNode());

    return result;
}