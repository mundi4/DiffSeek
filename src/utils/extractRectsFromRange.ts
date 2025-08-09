// import { advanceNode } from "./advanceNode";

// export function extractRectsFromRange(range: Range, offsetLeft: number, offsetTop: number, expandX = 0, expandY = 0, emptyDiff = false): Rect[] {
// 	const result: Rect[] = [];
// 	const tempRange = document.createRange();

// 	let startNode: Node | null;

// 	if (range.startContainer.nodeType === 3) {
// 		tempRange.setStart(range.startContainer, range.startOffset);
// 		if (emptyDiff) {
// 			tempRange.collapse(true);
// 		} else {
// 			if (range.startContainer === range.endContainer) {
// 				tempRange.setEnd(range.startContainer, range.endOffset);
// 			} else {
// 				tempRange.setEnd(range.startContainer, range.startContainer.nodeValue!.length);
// 			}
// 		}
// 		for (const rect of tempRange.getClientRects()) {
// 			result.push({
// 				x: rect.x + offsetLeft - expandX,
// 				y: rect.y + offsetTop - expandY,
// 				width: rect.width + expandX * 2,
// 				height: rect.height + expandY * 2,
// 			});
// 			if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
// 		}
// 		startNode = advanceNode(range.startContainer)!;
// 	} else {
// 		startNode = range.startContainer.childNodes[range.startOffset] ?? advanceNode(range.startContainer, null, true);
// 		if (!startNode) return result;
// 	}

// 	const endContainer = range.endContainer;
// 	let endOffset: number;
// 	let endNode: Node;
// 	if (endContainer.nodeType === 3) {
// 		endNode = endContainer;
// 		endOffset = range.endOffset;
// 	} else {
// 		endNode = endContainer.childNodes[range.endOffset] ?? advanceNode(endContainer, null, true)!;
// 		endOffset = -1;
// 	}

// 	if (!startNode || !endNode || endNode.compareDocumentPosition(startNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
// 		return result;
// 	}

// 	const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
// 	walker.currentNode = startNode;

// 	do {
// 		const node = walker.currentNode;
// 		if (!node) break;

// 		if (node === endNode) {
// 			if (node.nodeType === 3 && endOffset >= 0) {
// 				tempRange.setStart(endNode, 0);
// 				emptyDiff ? tempRange.collapse(true) : tempRange.setEnd(endNode, endOffset);
// 				for (const rect of tempRange.getClientRects()) {
// 					result.push({
// 						x: rect.x + offsetLeft - expandX,
// 						y: rect.y + offsetTop - expandY,
// 						width: rect.width + expandX * 2,
// 						height: rect.height + expandY * 2,
// 					});
// 					if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
// 				}
// 			}
// 			break;
// 		}

// 		if (node.nodeType === 3) {
// 			tempRange.selectNodeContents(node);
// 			for (const rect of tempRange.getClientRects()) {
// 				result.push({
// 					x: rect.x + offsetLeft - expandX,
// 					y: rect.y + offsetTop - expandY,
// 					width: rect.width + expandX * 2,
// 					height: rect.height + expandY * 2,
// 				});
// 			}
// 		} else if (node.nodeName === "BR") {
// 			// no-op
// 		} else if (node.nodeName === DIFF_TAG_NAME) {
// 			if (emptyDiff) {
// 				const tempText = document.createTextNode("\u200B");
// 				node.appendChild(tempText);
// 				tempRange.selectNodeContents(tempText);
// 				for (const rect of tempRange.getClientRects()) {
// 					result.push({
// 						x: rect.x + offsetLeft - expandX,
// 						y: rect.y + offsetTop - expandY - 1.5,
// 						width: rect.width + expandX * 2,
// 						height: rect.height + expandY * 2,
// 					});
// 				}
// 				tempText.remove();
// 			} else {
// 				if ((node as HTMLElement).classList.contains(MANUAL_ANCHOR_CLASS_NAME)) {
// 					tempRange.selectNode(node as HTMLElement);
// 					for (const rect of (node as HTMLElement).getClientRects()) {
// 						result.push({
// 							x: rect.x + offsetLeft - expandX,
// 							y: rect.y + offsetTop - expandY,
// 							width: rect.width + expandX * 2,
// 							height: rect.height + expandY * 2,
// 						});
// 					}
// 				}
// 			}
// 		} else if (node.nodeName === "IMG") {
// 			tempRange.selectNode(node);
// 			for (const rect of tempRange.getClientRects()) {
// 				result.push({
// 					x: rect.x + offsetLeft - expandX,
// 					y: rect.y + offsetTop - expandY,
// 					width: rect.width + expandX * 2,
// 					height: rect.height + expandY * 2,
// 				});
// 			}
// 		}
// 	} while (walker.nextNode());

// 	return result;
// }
