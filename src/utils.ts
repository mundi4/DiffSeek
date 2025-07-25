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

function mapTokenRangeToOtherSide(rawEntries: RawDiff[], side: "left" | "right", startIndex: number, endIndex: number): [number, number, boolean] {
	// console.log("mapTokenRangeToOtherSide", { rawEntries, side, startIndex, endIndex });
	const otherSide = side === "left" ? "right" : "left";
	let low = 0;
	let high = rawEntries.length - 1;
	let mappedStart = -1;
	let mappedEnd = -1;
	let hasDiff = false;
	let firstEntryIndex = -1;
	let lastEntryIndex = -1;

	while (low <= high) {
		const mid = (low + high) >> 1;
		const s = rawEntries[mid][side];
		if (startIndex < s.index) {
			high = mid - 1;
		} else if (startIndex >= s.index + s.count) {
			low = mid + 1;
		} else {
			mappedStart = rawEntries[mid][otherSide].index;
			if (endIndex <= s.index + s.count) {
				mappedEnd = rawEntries[mid][otherSide].index + rawEntries[mid][otherSide].count;
			}
			if (!hasDiff && rawEntries[mid].type !== 0) {
				hasDiff = true;
			}
			// if (rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len < endIndex) {
			// 	mappedEnd = rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len;
			// }
			firstEntryIndex = low = mid; // reuse for mappedEnd search
			break;
		}
	}

	if (mappedStart >= 0 && mappedEnd === -1) {
		mappedEnd = mappedStart;
		high = rawEntries.length - 1;
		while (low <= high) {
			const mid = (low + high) >> 1;
			const s = rawEntries[mid][side];
			if (endIndex - 1 < s.index) {
				high = mid - 1;
			} else if (endIndex - 1 >= s.index + s.count) {
				low = mid + 1;
			} else {
				mappedEnd = rawEntries[mid][otherSide].index + rawEntries[mid][otherSide].count;
				lastEntryIndex = mid;
				if (!hasDiff && rawEntries[mid].type !== 0) {
					hasDiff = true;
				}
				break;
			}
		}
	}

	// fallback: linear scan for overlaps
	if (!hasDiff && firstEntryIndex >= 0 && lastEntryIndex >= 0) {
		for (let i = firstEntryIndex; i <= lastEntryIndex; i++) {
			if (rawEntries[i].type !== 0) {
				hasDiff = true;
				break;
			}
		}
	}

	// console.warn("mapTokenRangeToOtherSide result", { mappedStart, mappedEnd });
	return [mappedStart, mappedEnd, hasDiff];
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

function extractRects(sourceRange: Range, emptyDiff: boolean = false): Rect[] {
	// console.debug("extractRects", sourceRange);

	const result: Rect[] = [];

	const tempRange = document.createRange();

	let startNode: Node | null;
	if (sourceRange.startContainer.nodeType === 3) {
		tempRange.setStart(sourceRange.startContainer, sourceRange.startOffset);
		if (emptyDiff) {
			tempRange.collapse(true);
		} else {
			if (sourceRange.startContainer === sourceRange.endContainer) {
				tempRange.setEnd(sourceRange.startContainer, sourceRange.endOffset);
			} else {
				tempRange.setEnd(sourceRange.startContainer, sourceRange.startContainer.nodeValue!.length);
			}
		}
		for (const rect of tempRange.getClientRects()) {
			result.push({
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
			});
			if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) {
				return result;
				// 빈 diff가 아닌 경우에만 rect를 추가
				// console.warn("extractRects: emptyDiff but rect found", rect);
			}
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
				if (emptyDiff) {
					tempRange.collapse(true); // collapse to start
				} else {
					tempRange.setEnd(endNode, endOffset);
				}
				for (const rect of tempRange.getClientRects()) {
					result.push({
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
					});
					if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) {
						return result;
						// 빈 diff가 아닌 경우에만 rect를 추가
						// console.warn("extractRects: emptyDiff but rect found", rect);
					}
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
		} else if (currentNode.nodeName === DIFF_ELEMENT_NAME) {
			if (emptyDiff && (currentNode as HTMLElement).classList.contains("diff")) {
				// 가장 확실한 방법이지만 넣었다 뺐다 잘못하면 인생 망가짐... reflow 유발 => 많이 느리다.
				const tempText = document.createTextNode("\u200B"); // zero-width space
				currentNode.appendChild(tempText);
				tempRange.selectNodeContents(tempText);
				for (const rect of tempRange.getClientRects()) {
					result.push({
						x: rect.x,
						y: rect.y - 1.5,
						width: rect.width,
						height: rect.height,
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

	// if (emptyDiff && result.length > 1) {
	// 	result.length = 1;
	// }
	return result;
}

// plaintext를 복붙할 때...
function createParagraphsFromText(plaintext: string, trimLines: boolean = false): DocumentFragment {
	const lines = plaintext.split(/\r?\n/);
	const fragment = document.createDocumentFragment();

	for (const line of lines) {
		const p = document.createElement("P");
		const trimmedLine = trimLines ? line.trim() : line;
		// 빈 줄 처리
		if (trimmedLine === "") {
			p.appendChild(document.createElement("BR"));
		} else {
			p.textContent = trimmedLine;
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

function quickHash53ToString(str: string) {
	let hash = 0n;
	const PRIME = 131n;
	for (let i = 0; i < str.length; i++) {
		hash = hash * PRIME + BigInt(str.charCodeAt(i));
		hash &= 0x1fffffffffffffn; // 53비트 마스크
	}
	return hash.toString(36); // 36진수 문자열 변환
}

function getHeadingLevelFromFlag(flag: number): number {
	switch (flag) {
		case TokenFlags.SECTION_HEADING_TYPE1:
			return 0; // 1.
		case TokenFlags.SECTION_HEADING_TYPE2:
			return 1; // 가.
		case TokenFlags.SECTION_HEADING_TYPE3:
			return 2; // (1)
		case TokenFlags.SECTION_HEADING_TYPE4:
			return 3; // (가)
		case TokenFlags.SECTION_HEADING_TYPE5:
			return 4; // 1)
		case TokenFlags.SECTION_HEADING_TYPE6:
			return 5; // 가)
		default:
			return -1;
	}
}

function getHeadingTypeFromFlag(flag: TokenFlags): number | null {
	const masked = flag & TokenFlags.SECTION_HEADING_MASK;
	return masked || null;
}

function findDeepestSectionHeading(sectionRoots: SectionHeading[], tokenIndex: number): SectionHeading | null {
	let result: SectionHeading | null = null;

	function search(node: SectionHeading) {
		if (tokenIndex < node.startTokenIndex || tokenIndex >= node.endTokenIndex) return;
		result = node;

		let child = node.firstChild;
		while (child) {
			search(child);
			child = child.nextSibling;
		}
	}

	for (const root of sectionRoots) {
		search(root);
	}

	return result;
}

function buildSectionTrail(heading: SectionHeading): SectionHeading[] {
	const trail: SectionHeading[] = [];

	let current: SectionHeading | null = heading;
	while (current) {
		trail.unshift(current); // 루트부터 순서대로 되도록 unshift
		current = current.parent;
	}

	return trail;
}

function getSectionTrail(sectionRoots: SectionHeading[], tokenIndex: number): SectionHeading[] {
	const deepest = findDeepestSectionHeading(sectionRoots, tokenIndex);
	if (!deepest) return [];
	const trail = buildSectionTrail(deepest);
	return trail;
}

function getSectionTrailText(sectionRoots: SectionHeading[], tokenIndex: number) {
	const trail = getSectionTrail(sectionRoots, tokenIndex);
	let result = "";
	for (let i = 0; i < trail.length; i++) {
		const heading = trail[i];
		if (i > 0) result += " > "; // 구분자
		result += heading.title;
	}
	return result;
}

function getTableCellPosition(td: HTMLElement): [rowIndex: number, colIndex: number] | null {
	if (td.tagName !== "TD") return null;

	const tr = td.parentElement as HTMLTableRowElement;
	if (!tr || tr.tagName !== "TR") return null;

	const table = tr.parentElement as HTMLTableElement;
	if (!table || table.tagName !== "TABLE") return null;

	const rowIndex = Array.prototype.indexOf.call(table.rows, tr);
	const colIndex = Array.prototype.indexOf.call(tr.cells, td);

	if (rowIndex === -1 || colIndex === -1) return null;

	return [rowIndex, colIndex];
}

function clampRange(range: Range, startAfter: HTMLElement | null, endBefore: HTMLElement | null): Range {
	try {
		if (startAfter && range.comparePoint(startAfter, 0) >= 0) {
			range.setStartAfter(startAfter);
		}
	} catch (e) {
		console.warn("modifyRange 실패", e);
	}
	try {
		if (endBefore && range.comparePoint(endBefore, 0) <= 0) {
			range.setEndBefore(endBefore);
		}
	} catch (e) {
		console.warn("modifyRange 실패", e);
	}
	return range;
}

function getParentElement(node: Node): HTMLElement {
	const element = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
	return element as HTMLElement;
}

function findClosestContainer(node: Node, selector: string): HTMLElement | null {
	return getParentElement(node).closest(selector);
}

function findBlockContainer(node: Node): HTMLElement | null {
	let el: HTMLElement | null = getParentElement(node);
	while (el) {
		if (BLOCK_ELEMENTS[el.nodeName]) return el;
		el = el.parentElement;
	}
	return null;
}

function getElement(container: Node, childIndex: number): HTMLElement | null {
	let node = container;
	if (node.nodeType === 3) {
		return node.parentNode as HTMLElement;
	}

	if (container.nodeType === Node.ELEMENT_NODE) {
		const element = (container as HTMLElement).children[childIndex];
		if (element && element.nodeType === Node.ELEMENT_NODE) {
			return element as HTMLElement;
		}
	}
	return null;
}

function buildTokenArray(richTokens: readonly RichToken[], mode: "char" | "word" = "word"): Token[] {
	if (mode === "word") {
		return buildTokenArrayWord(richTokens, mode);
	} else if (mode === "char") {
		return buildTokenArrayByChar(richTokens, mode);
	} else {
		throw new Error(`Unsupported tokenization mode: ${mode}`);
	}
}

function buildTokenArrayWord(richTokens: readonly RichToken[], mode: "char" | "word" = "word"): Token[] {
	const result: Token[] = new Array(richTokens.length);
	for (let i = 0; i < richTokens.length; i++) {
		const richToken = richTokens[i];
		result[i] = {
			text: richToken.text,
			flags: richToken.flags,
		};
	}
	return result;
}

function buildTokenArrayByChar(richTokens: readonly RichToken[], mode: "char" | "word" = "word"): Token[] {
	const result: Token[] = [];
	for (let i = 0; i < richTokens.length; i++) {
		const richToken = richTokens[i];
		const flags = richToken.flags;
		if (flags & (TokenFlags.WILD_CARD | TokenFlags.IMAGE)) {
			result.push({
				text: richToken.text,
				flags: flags,
			});
		} else {
			const text = richToken.text;
			for (const char of text) {
				result.push({
					text: char,
					flags: 0,
				});
			}
		}
	}
	return result;
}

function renderUnifiedDiffHTML(leftText: string, rightText: string, diffs: RawDiff[]): string {
	let html = "";

	for (const diff of diffs) {
		const { type, left, right } = diff;

		if (type === 0) {
			html += escapeHTML(rightText.slice(right.index, right.index + right.count));
		} else if (type === 1) {
			html += `<del>${escapeHTML(leftText.slice(left.index, left.index + left.count))}</del>`;
		} else if (type === 2) {
			html += `<ins>${escapeHTML(rightText.slice(right.index, right.index + right.count))}</ins>`;
		}
	}

	return html;
}

function escapeHTML(str: string): string {
	return str.replace(
		/[&<>"']/g,
		(m) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			}[m]!)
	);
}

function normalizeMultiline(text: string): string {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join("\n");
}
