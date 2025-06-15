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

function debounce(func: { (): void; apply?: any }, delay: number | undefined) {
	let timeoutId: number;
	return function (this: any, ...args: any) {
		const context = this;
		clearTimeout(timeoutId);
		timeoutId = setTimeout(function () {
			func.apply(context, args);
		}, delay);
	};
}

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

function buildOutputHTMLFromRuns(text: string, textRuns: TextRun[], options: OutputOptions): string {
	let inDiff = false;
	let result = options.htmlPre ? "<pre>" : "";

	for (const run of textRuns) {
		if (run.type === "DIFF") {
			const diffIndex = run.dataIndex!;
			// result += "<mark>";
			const color = DIFF_COLOR_HUES[diffIndex % DIFF_COLOR_HUES.length];
			result += `<mark style="background-color: hsl(${color}, 100%, 80%);">`;
			inDiff = true;
		} else if (run.type === "DIFF_END") {
			if (inDiff) {
				// result += "</mark>";
				result += "</mark>";
				inDiff = false;
			}
		} else if (run.type === "CHARS") {
			result += escapeHTML(text.slice(run.pos, run.pos + run.len));
		} else if (run.type === "LINEBREAK") {
			result += "<br/>";
		}
	}

	if (inDiff) result += "</mark>";
	if (options.htmlPre) result += "</pre>";
	// result += "<br/>";
	return result;
}

function buildOutputPlainText(leftText: string, leftRuns: TextRun[], rightText: string, rightRuns: TextRun[], options: OutputOptions = {}): string {
	const leftLabel = options.leftLabel ?? "Left";
	const rightLabel = options.rightLabel ?? "Right";
	const leftBody = buildOutputPlainTextFromRuns(leftText, leftRuns, options);
	const rightBody = buildOutputPlainTextFromRuns(rightText, rightRuns, options);
	return `${leftLabel}: ${leftBody}\n${rightLabel}: ${rightBody}\n`;
}

function buildOutputPlainTextFromRuns(text: string, textRuns: TextRun[], options: OutputOptions): string {
	const format = options.textFormat ?? 0;

	let result = "";
	let inDiff = false;

	let markStart;
	let markEnd;

	if (format === 1) {
		markStart = "**";
		markEnd = "**";
	} else if (format === 2) {
		markStart = "[[ ";
		markEnd = " ]]";
	} else {
		markStart = "";
		markEnd = "";
	}

	for (const run of textRuns) {
		if (run.type === "DIFF") {
			if (format !== 0 && !inDiff) {
				result += markStart;
				inDiff = true;
			}
		} else if (run.type === "DIFF_END") {
			if (format !== 0 && inDiff) {
				result += markEnd;
				inDiff = false;
			}
		} else if (run.type === "CHARS") {
			result += text.slice(run.pos, run.pos + run.len);
		} else if (run.type === "LINEBREAK") {
			result += "\n";
		}
	}

	if (inDiff && format !== 0) result += markEnd;

	return result;
}

function buildOutputHTML(leftText: string, leftRuns: TextRun[], rightText: string, rightRuns: TextRun[], options: OutputOptions = {}): string {
	const leftLabel = options.leftLabel ?? "Left";
	const rightLabel = options.rightLabel ?? "Right";
	const htmlFormat = options.htmlFormat ?? "div";

	if (htmlFormat === "table") {
		// Default: table format
		return `<table border="1" cellpadding="8" cellspacing="0">
  <thead>
    <tr><th>${escapeHTML(leftLabel)}</th><th>${escapeHTML(rightLabel)}</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><pre>${buildOutputHTMLFromRuns(leftText, leftRuns, options)}</pre></td>
      <td><pre>${buildOutputHTMLFromRuns(rightText, rightRuns, options)}</pre></td>
    </tr>
  </tbody>
</table>`.trim();
	}
	if (htmlFormat === "dl") {
		return `<dl>
  <dt>${escapeHTML(leftLabel)}</dt>
  <dd><pre>${buildOutputHTMLFromRuns(leftText, leftRuns, options)}</pre></dd>
  <dt>${escapeHTML(rightLabel)}</dt>
  <dd><pre>${buildOutputHTMLFromRuns(rightText, rightRuns, options)}</pre></dd>
</dl>`.trim();
	}

	return `<div>
<div><strong>${escapeHTML(leftLabel)}:</strong> ${buildOutputHTMLFromRuns(leftText, leftRuns, options)}</div>
<div><strong>${escapeHTML(rightLabel)}:</strong> ${buildOutputHTMLFromRuns(rightText, rightRuns, options)}</div>
</div>`.trim();
}

function escapeHTML(str: string): string {
	return str.replace(/[&<>"]|'/g, (char) => {
		switch (char) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#039;";
			default:
				return char;
		}
	});
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

function findFirstNodeAfter(root: Node, after: Node): Node | null {
	let current: Node | null = after;
	while (current && current !== root) {
		if (current.nextSibling) {
			return current.nextSibling;
		} else {
			current = current.parentNode;
		}
	}
	return null;
}

function getTextOffsetOfNode(root: HTMLElement, node: Node, end: boolean = false) {
	const filter = node.nodeType === 3 ? NodeFilter.SHOW_TEXT : NodeFilter.SHOW_ALL;
	let walker = document.createTreeWalker(root, filter, null);
	let pos = 0;
	let currentNode;
	while ((currentNode = walker.nextNode())) {
		if (currentNode === node && !end) {
			break;
		}
		if (currentNode.nodeType === 3) {
			pos += currentNode.nodeValue!.length;
		}
		if (currentNode === node && end) {
			break;
		}
	}
	return pos;
}

function dumpRange() {
	const sel = window.getSelection()!;
	if (sel && sel.rangeCount > 0) {
		const range = sel.getRangeAt(0);
		// console.log("current selection", {
		// 	range,
		// 	startContainer: range.startContainer,
		// 	startOffset: range.startOffset,
		// 	endContainer: range.endContainer,
		// 	endOffset: range.endOffset,
		// });
		return range;
	} else {
		console.log("no selection");
	}
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

function findNextAncestorSibling(node: Node | null, rootNode?: Node): Node | null {
	while (node && node !== rootNode) {
		if (node.nextSibling) return node.nextSibling;
		node = node.parentNode;
	}
	return null;
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

function extractTextRanges(sourceRange: Range): Range[] {
	if (sourceRange.startContainer.nodeType === 3 && sourceRange.startContainer === sourceRange.endContainer) {
		return [sourceRange];
	}

	const root = sourceRange.commonAncestorContainer;
	const result: Range[] = [];

	const walker = document.createTreeWalker(sourceRange.commonAncestorContainer, NodeFilter.SHOW_ALL);

	let startNode: Node;
	let endNode: Node;
	let currentNode: Node | null;

	if (sourceRange.startContainer.nodeType === 3) {
		const r = document.createRange();
		r.setStart(sourceRange.startContainer, sourceRange.startOffset);
		r.setEnd(sourceRange.startContainer, sourceRange.startContainer.nodeValue!.length);
		result.push(r);
		walker.currentNode = sourceRange.startContainer;
		currentNode = walker.nextNode();
	} else if (sourceRange.startContainer.nodeType === 1) {
		startNode = sourceRange.startContainer.childNodes[sourceRange.startOffset]! || sourceRange.startContainer;
		walker.currentNode = currentNode = startNode;
	} else {
		throw new Error("Invalid start container");
	}

	if (sourceRange.endContainer.nodeType === 3) {
		endNode = sourceRange.endContainer;
	} else if (sourceRange.endContainer.nodeType === 1) {
		if (sourceRange.endOffset < sourceRange.endContainer.childNodes.length) {
			endNode = sourceRange.endContainer.childNodes[sourceRange.endOffset];
		} else {
			endNode = advanceNode(sourceRange.endContainer, root, true)!;
		}
	} else {
		throw new Error("Invalid end container");
	}

	while (currentNode && currentNode !== endNode) {
		if (currentNode.nodeType === 3) {
			const r = document.createRange();
			r.selectNodeContents(currentNode);
			result.push(r);
		} else {
			if (currentNode.nodeName === "BR") {
				const r = document.createRange();
				r.selectNode(currentNode);
				result.push(r);
			}
			// do nothing for now
		}
		currentNode = walker.nextNode();
	}

	if (sourceRange.endContainer.nodeType === 3) {
		const r = document.createRange();
		r.setStart(sourceRange.endContainer, 0);
		r.setEnd(sourceRange.endContainer, sourceRange.endOffset);
		result.push(r);
	}

	return result;
}

function getNodesInRange(range: Range, whatToShow: number = NodeFilter.SHOW_ALL, filter: NodeFilter | null = null) {
	const commonAncestor = range.commonAncestorContainer;

	const walker = document.createTreeWalker(commonAncestor, whatToShow, filter);

	walker.currentNode = range.startContainer;

	const nodes = [];

	let node: Node | null = walker.currentNode;

	while (node) {
		const nodeRange = document.createRange();
		nodeRange.selectNodeContents(node);

		const startsBeforeEnd = nodeRange.compareBoundaryPoints(Range.END_TO_START, range) < 0;
		const endsAfterStart = nodeRange.compareBoundaryPoints(Range.START_TO_END, range) > 0;

		if (startsBeforeEnd && endsAfterStart) {
			nodes.push(node);
		} else if (!startsBeforeEnd) {
			// 이미 범위를 지난 경우 break
			break;
		}

		node = walker.nextNode();
	}

	return nodes;
}

function getFullyContainedNodesInRange(range: Range, whatToShow: number = NodeFilter.SHOW_ALL, filter: NodeFilter | null = null): Node[] {
	const walker = document.createTreeWalker(range.commonAncestorContainer, whatToShow, filter);

	walker.currentNode = range.startContainer;

	const nodes: Node[] = [];
	let node: Node | null = walker.currentNode;

	while (node) {
		const nodeRange = document.createRange();

		try {
			nodeRange.selectNode(node);
		} catch {
			// 텍스트 노드 등 selectNode 실패 시에는 selectNodeContents
			nodeRange.selectNodeContents(node);
		}

		const startsAfterOrAt = nodeRange.compareBoundaryPoints(Range.START_TO_START, range) >= 0;
		const endsBeforeOrAt = nodeRange.compareBoundaryPoints(Range.END_TO_END, range) <= 0;

		if (startsAfterOrAt && endsBeforeOrAt) {
			nodes.push(node);
		} else if (!startsAfterOrAt && nodeRange.compareBoundaryPoints(Range.START_TO_END, range) > 0) {
			break; // 앞으로는 포함될 가능성 없음
		}

		node = walker.nextNode();
	}

	return nodes;
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
			if (forceAnchorRects) {
				// 가장 확실한 방법이지만 넣었다 뺐다 잘못하면 인생 망가짐... reflow 유발 => 많이 느리다.
				const tempText = document.createTextNode("\u200B"); // zero-width space
				currentNode.appendChild(tempText);
				tempRange.selectNodeContents(tempText);
				for (const rect of tempRange.getClientRects()) {
					result.push({
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
					});
				}
				tempText.remove();
			} else {
				for (const rect of (currentNode as HTMLElement).getClientRects()) {
					result.push({
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
					});
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
