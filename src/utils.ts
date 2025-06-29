// 개정대비표와 전문에서는 빨간색만 의미 있음. 변태처럼 빨간색이 아닌 뻘건색을 써도 허용.
const isReddish = (() => {
	let ctx: CanvasRenderingContext2D | null = null;

	const reddishCache = new Map<string, boolean>([
		["red", true],
		["#ff0000", true],
		["#e60000", true],
		["#c00000", true],
		["rgb(255,0,0)", true],
		["rgb(230,0,0)", true],
		["#000000", false],
		["#333333", false],
		["#ffffff", false],
		["black", false],
		["blue", false],
		["white", false],
		["window", false],
		["windowtext", false],
	]);

	function getRGB(color: string): [number, number, number] | null {
		// #rrggbb
		const hex6 = /^#([0-9a-f]{6})$/i.exec(color);
		if (hex6) {
			const n = parseInt(hex6[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}

		// #rgb
		const hex3 = /^#([0-9a-f]{3})$/i.exec(color);
		if (hex3) {
			const [r, g, b] = hex3[1].split("").map((c) => parseInt(c + c, 16));
			return [r, g, b];
		}

		// rgb(...) / rgba(...)
		const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
		if (rgb) {
			const parts = rgb[1].split(",").map((s) => parseInt(s.trim(), 10));
			if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
		}

		// fallback
		if (!ctx) {
			const canvas = document.createElement("canvas");
			canvas.width = canvas.height = 1;
			ctx = canvas.getContext("2d")!;
		}

		try {
			ctx.clearRect(0, 0, 1, 1);
			ctx.fillStyle = color;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			return [r, g, b];
		} catch {
			return null;
		}
	}

	return (color: string) => {
		let isRed = reddishCache.get(color);
		if (isRed !== undefined) return isRed;

		const rgb = getRGB(color);
		isRed = rgb ? rgb[0] >= 139 && rgb[0] - Math.max(rgb[1], rgb[2]) >= 65 : false;
		reddishCache.set(color, isRed);
		return isRed;
	};
})();

function mapTokenRangeToOtherSide(rawEntries: RawDiff[], side: "left" | "right", startIndex: number, endIndex: number): [number, number] {
	// console.log("mapTokenRangeToOtherSide", { rawEntries, side, startIndex, endIndex });
	const otherSide = side === "left" ? "right" : "left";
	let low = 0;
	let high = rawEntries.length - 1;
	let mappedStart = -1;
	let mappedEnd = -1;

	while (low <= high) {
		const mid = (low + high) >> 1;
		const s = rawEntries[mid][side];
		if (startIndex < s.pos) {
			high = mid - 1;
		} else if (startIndex >= s.pos + s.len) {
			low = mid + 1;
		} else {
			mappedStart = rawEntries[mid][otherSide].pos;
			if (endIndex <= s.pos + s.len) {
				mappedEnd = rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len;
			}
			// if (rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len < endIndex) {
			// 	mappedEnd = rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len;
			// }
			low = mid; // reuse for mappedEnd search
			break;
		}
	}

	if (mappedStart >= 0 && mappedEnd === -1) {
		mappedEnd = mappedStart;
		high = rawEntries.length - 1;
		while (low <= high) {
			const mid = (low + high) >> 1;
			const s = rawEntries[mid][side];
			if (endIndex - 1 < s.pos) {
				high = mid - 1;
			} else if (endIndex - 1 >= s.pos + s.len) {
				low = mid + 1;
			} else {
				mappedEnd = rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len;
				break;
			}
		}
	}

	// console.warn("mapTokenRangeToOtherSide result", { mappedStart, mappedEnd });
	return [mappedStart, mappedEnd];
}

function parseOrdinalNumber(ordinalText: string): number {
	const norm = ordinalText.replace(/[\(\)\.]/g, "");
	if (/^\d+$/.test(norm)) {
		return Number(norm);
	}
	const idx = HANGUL_ORDER.indexOf(norm);
	if (idx !== -1) {
		return idx + 1;
	}
	return NaN;
}

function findAdjacentTextNode(node: Node, skipEmpty = false): Text | null {
	let root: Node = node;
	while (root && !BLOCK_ELEMENTS[root.nodeName]) {
		root = root.parentNode!;
	}

	let next: Node | null = advanceNode(node, root, true);
	while (next) {
		if (next.nodeType === 3) {
			if (!skipEmpty || next.nodeValue!.length > 0) {
				return next as Text;
			}
		} else {
			const nextName = next.nodeName;
			if (BLOCK_ELEMENTS[nextName]) {
				break;
			}
			if (nextName === "BR" || nextName === "IMG" || nextName === "HR") {
				break;
			}
		}
		next = advanceNode(next, root);
	}

	return null;
}

function advanceNode(currentNode: Node, rootNode: Node | null = null, skipChildren = false): Node | null {
	if (!skipChildren && currentNode.firstChild) {
		return currentNode.firstChild;
	}

	let node: Node | null = currentNode;

	while (node && node !== rootNode) {
		if (node.nextSibling) {
			return node.nextSibling;
		}
		node = node.parentNode;
	}

	return null;
}

function retreatNode(currentNode: Node): Node | null {
	if (!currentNode) return null;

	const prev = currentNode.previousSibling;
	if (prev) {
		let node = prev;
		while (node.lastChild) node = node.lastChild;
		return node;
	}

	return currentNode.parentNode;
}

function mergeRects(rects: Rect[], toleranceX: number = 0, toleranceY: number = 0): { minX: number; minY: number; maxX: number; maxY: number; rects: Rect[] } {
	rects.sort((a, b) => a.y - b.y || a.x - b.x);

	const merged: Rect[] = [];
	const used = new Array(rects.length).fill(false);

	let minX = Number.MAX_SAFE_INTEGER;
	let minY = Number.MAX_SAFE_INTEGER;
	let maxX = 0;
	let maxY = 0;

	for (let i = 0; i < rects.length; i++) {
		if (used[i]) continue;
		let base = rects[i];

		for (let j = i + 1; j < rects.length; j++) {
			if (used[j]) continue;
			const compare = rects[j];

			// 세로 위치/높이 거의 같아야 병합 대상이 됨
			const sameY = Math.abs(base.y - compare.y) <= toleranceY && Math.abs(base.height - compare.height) <= toleranceY;

			if (!sameY) continue;

			// x축 겹치거나 toleranceX 이내
			const baseRight = base.x + base.width;
			const compareRight = compare.x + compare.width;
			const xOverlapOrClose = baseRight >= compare.x - toleranceX && compareRight >= base.x - toleranceX;

			if (xOverlapOrClose) {
				const newX = Math.min(base.x, compare.x);
				const newRight = Math.max(baseRight, compareRight);
				base = {
					x: newX,
					y: Math.min(base.y, compare.y),
					width: newRight - newX,
					height: Math.max(base.height, compare.height),
				};
				used[j] = true;
			}
		}

		merged.push(base);
		used[i] = true;

		minX = Math.min(minX, base.x);
		minY = Math.min(minY, base.y);
		maxX = Math.max(maxX, base.x + base.width);
		maxY = Math.max(maxY, base.y + base.height);
	}

	return {
		minX,
		minY,
		maxX,
		maxY,
		rects: merged,
	};
}

function extractRects(sourceRange: Range, forceAnchorRects: boolean = false): Rect[] {
	// console.debug("extractRects", sourceRange);

	const result: Rect[] = [];

	const tempRange = document.createRange();

	let startNode: Node | null;
	if (sourceRange.startContainer.nodeType === 3) {
		tempRange.setStart(sourceRange.startContainer, sourceRange.startOffset);
		if (sourceRange.startContainer === sourceRange.endContainer) {
			tempRange.setEnd(sourceRange.startContainer, sourceRange.endOffset);
		} else {
			tempRange.setEnd(sourceRange.startContainer, sourceRange.startContainer.nodeValue!.length);
		}
		for (const rect of tempRange.getClientRects()) {
			result.push({
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
			});
		}
		startNode = advanceNode(sourceRange.startContainer)!;
	} else {
		startNode = sourceRange.startContainer.childNodes[sourceRange.startOffset];
		if (!startNode) {
			startNode = advanceNode(sourceRange.startContainer, null, true);
			if (!startNode) {
				console.warn("extractRects: No startNode found", sourceRange);
				return result;
			}
		}
	}

	const endContainer = sourceRange.endContainer;
	let endOffset: number;
	let endNode: Node;
	if (endContainer.nodeType === 3) {
		endNode = endContainer;
		endOffset = sourceRange.endOffset;
	} else {
		endNode = endContainer.childNodes[sourceRange.endOffset];
		if (!endNode) {
			endNode = advanceNode(endContainer, null, true)!;
		}
		endOffset = -1;
	}

	// console.debug("extractRects", { sourceRange, startNode, endNode, endOffset });
	const walker = document.createTreeWalker(sourceRange.commonAncestorContainer, NodeFilter.SHOW_ALL);

	if (!startNode || !endNode) {
		console.warn("extractRects: No startNode or endNode", sourceRange);
		return result;
	}

	if (endNode.compareDocumentPosition(startNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
		// startNode가 endNode보다 뒤에 있는 경우
		// console.warn("extractRects: startNode is after endNode", startNode, endNode);
		return result;
	}

	walker.currentNode = startNode;
	// const hardEnd = advanceNode(editor);
	do {
		const currentNode = walker.currentNode;
		if (!currentNode) {
			console.error("extractRects: currentNode is null", sourceRange);
		}
		if (currentNode === endNode) {
			if (currentNode.nodeType === 3 && endOffset >= 0) {
				tempRange.setStart(endNode, 0);
				tempRange.setEnd(endNode, endOffset);
				for (const rect of tempRange.getClientRects()) {
					result.push({
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
					});
				}
			}
			break;
		}

		// if (currentNode === hardEnd) {
		// 	console.warn("extractRects: reached hard end", currentNode, endOffset);
		// 	break;
		// }

		if (currentNode.nodeType === 3) {
			tempRange.selectNodeContents(currentNode);
			for (const rect of tempRange.getClientRects()) {
				result.push({
					x: rect.x,
					y: rect.y,
					width: rect.width,
					height: rect.height,
				});
			}
		} else if (currentNode.nodeName === "BR") {
			//
		} else if (currentNode.nodeName === "A") {
			if (forceAnchorRects && (currentNode as HTMLElement).classList.contains("diff")) {
				// 가장 확실한 방법이지만 넣었다 뺐다 잘못하면 인생 망가짐... reflow 유발 => 많이 느리다.
				const tempText = document.createTextNode("\u200B"); // zero-width space
				currentNode.appendChild(tempText);
				tempRange.selectNodeContents(tempText);
				for (const rect of tempRange.getClientRects()) {
					result.push({
						x: rect.x,
						y: rect.y - 1.5,
						width: rect.width,
						height: rect.height + 3,
					});
				}
				tempText.remove();
			} else {
				if ((currentNode as HTMLElement).classList.contains("manual-anchor")) {
					tempRange.selectNode(currentNode as HTMLElement);
					for (const rect of (currentNode as HTMLElement).getClientRects()) {
						result.push({
							x: rect.x,
							y: rect.y,
							width: rect.width,
							height: rect.height,
						});
					}
				}
			}
		} else if (currentNode.nodeName === "IMG") {
			tempRange.selectNode(currentNode);
			for (const rect of tempRange.getClientRects()) {
				result.push({
					x: rect.x,
					y: rect.y,
					width: rect.width,
					height: rect.height,
				});
			}
		}
	} while (walker.nextNode());

	return result;
}

// plaintext를 복붙할 때...
function formatPlaintext(plaintext: string) {
	const lines = plaintext.split(/\r?\n/);
	const fragment = document.createDocumentFragment();
	for (const line of lines) {
		const p = document.createElement("P");
		if (line === "") {
			p.appendChild(document.createElement("BR"));
		} else {
			p.appendChild(document.createTextNode(line));
		}
		fragment.appendChild(p);
	}

	return fragment;
}

const __rangeA = document.createRange();
const __rangeB = document.createRange();
function comparePoint(lhsContainer: Node, lhsOffset: number, rhsContainer: Node, rhsOffset: number): number {
	try {
		if (lhsContainer === rhsContainer) {
			return lhsOffset - rhsOffset;
		}

		__rangeA.setStart(lhsContainer, lhsOffset);
		__rangeB.setStart(rhsContainer, rhsOffset);

		return __rangeA.compareBoundaryPoints(Range.START_TO_START, __rangeB);
	} catch (err) {
		console.warn("comparePoint failed", { lhsContainer, lhsOffset, rhsContainer, rhsOffset, err });
		throw err;
	}
}

function tokenFlagsToString(flags: TokenFlags): string {
	const parts: string[] = [];
	if (flags & TokenFlags.TABLE_START) parts.push("TABLE_START");
	if (flags & TokenFlags.TABLE_END) parts.push("TABLE_END");
	if (flags & TokenFlags.TABLEROW_START) parts.push("TABLEROW_START");
	if (flags & TokenFlags.TABLEROW_END) parts.push("TABLEROW_END");
	if (flags & TokenFlags.TABLECELL_START) parts.push("TABLECELL_START");
	if (flags & TokenFlags.TABLECELL_END) parts.push("TABLECELL_END");
	if (flags & TokenFlags.BLOCK_START) parts.push("BLOCK_START");
	if (flags & TokenFlags.BLOCK_END) parts.push("BLOCK_END");
	if (flags & TokenFlags.CONTAINER_START) parts.push("CONTAINER_START");
	if (flags & TokenFlags.CONTAINER_END) parts.push("CONTAINER_END");
	return parts.join(", ");
}

function translateTokenFlagsToAnchorFlags(tokenFlags: number, endTokenFlags?: number): AnchorFlags {
	endTokenFlags ??= tokenFlags;
	let flags = 0;
	if (tokenFlags & TokenFlags.LINE_START) {
		flags |= AnchorFlags.LINE_START;
	}
	if (tokenFlags & TokenFlags.CONTAINER_START) {
		flags |= AnchorFlags.CONTAINER_START;
	}
	if (tokenFlags & TokenFlags.TABLE_START) {
		flags |= AnchorFlags.TABLE_START;
	}
	if (tokenFlags & TokenFlags.TABLEROW_START) {
		flags |= AnchorFlags.TABLEROW_START;
	}
	if (tokenFlags & TokenFlags.TABLECELL_START) {
		flags |= AnchorFlags.TABLECELL_START;
	}
	if (tokenFlags & TokenFlags.BLOCK_START) {
		flags |= AnchorFlags.BLOCK_START;
	}
	if (tokenFlags & TokenFlags.SECTION_HEADING_MASK) {
		// flags |= AnchorFlags.SECTION_HEADING;
	}
	return flags;
}

function cycleWhitespace(mode: WhitespaceHandling): WhitespaceHandling {
	return mode === "ignore" ? "normalize" : mode === "normalize" ? "onlyAtEdge" : "ignore";
}
