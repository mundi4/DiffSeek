function isRectVisible(
	top: number,
	bottom: number,
	left: number,
	right: number,
	viewportTop: number,
	viewportLeft: number,
	viewportWidth: number,
	viewportHeight: number
): boolean {
	return bottom >= viewportTop && top <= viewportTop + viewportHeight && right >= viewportLeft && left <= viewportLeft + viewportWidth;
}

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

function findIndexByPos(arr: { pos: number; len: number }[], pos: number): number {
	// binary search
	let low = 0;
	let high = arr.length - 1;
	while (low <= high) {
		const mid = (low + high) >>> 1;
		const item = arr[mid];
		const start = item.pos,
			end = item.pos + item.len;
		if (start <= pos && pos < end) {
			return mid;
		} else if (start > pos) {
			high = mid - 1;
		} else if (end <= pos) {
			low = mid + 1;
		}
	}
	return ~low;
}

function findDiffEntryRangeByPos(entries: DiffEntry[], side: "left" | "right", pos: number, endPos: number) {
	console.log("findDiffEntryRangeByPos", { entries, side, pos, endPos });
	let low = 0;
	let high = entries.length - 1;
	let mappedStart = 0;
	let mappedEnd = 0;

	while (low <= high) {
		const mid = (low + high) >> 1;
		const s = entries[mid][side];
		if (pos < s.pos) {
			high = mid - 1;
		} else if (pos >= s.pos + s.len) {
			low = mid + 1;
		} else {
			mappedStart = mid;
			break;
		}
	}

	low = mappedStart;
	high = entries.length - 1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		const s = entries[mid][side];
		if (endPos - 1 < s.pos) {
			high = mid - 1;
		} else if (endPos - 1 >= s.pos + s.len) {
			low = mid + 1;
		} else {
			mappedEnd = mid + 1;
			break;
		}
	}

	return [mappedStart, mappedEnd];
}

function mapTokenRangeToOtherSide(rawEntries: DiffEntry[], side: "left" | "right", startIndex: number, endIndex: number): [number, number] {
	const otherSide = side === "left" ? "right" : "left";
	let low = 0;
	let high = rawEntries.length - 1;
	let mappedStart = 0;
	let mappedEnd = 0;

	while (low <= high) {
		const mid = (low + high) >> 1;
		const s = rawEntries[mid][side];
		if (startIndex < s.pos) {
			high = mid - 1;
		} else if (startIndex >= s.pos + s.len) {
			low = mid + 1;
		} else {
			mappedStart = rawEntries[mid][otherSide].pos;
			low = mid; // reuse for mappedEnd search
			break;
		}
	}

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
		console.log("current selection", {
			range,
			startContainer: range.startContainer,
			startOffset: range.startOffset,
			endContainer: range.endContainer,
			endOffset: range.endOffset,
		});
		return range;
	} else {
		console.log("no selection");
	}
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

function isLastChildOrFollowing(container: Node, child: Node) {
	// fast path. 여기서 얼마나 걸릴 지 모르겠지만...
	if (container.lastChild === child || container.nextSibling === child) {
		return true;
	}

	const range = document.createRange();
	range.selectNode(container);

	range.comparePoint;
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

function findFirstTextNode(root: Node): Text | null {
	const stack: Node[] = [root];

	while (stack.length > 0) {
		const node = stack.pop()!;

		if (node.nodeType === Node.TEXT_NODE) {
			const text = node as Text;
			if (text.nodeValue && text.nodeValue.trim() !== "") {
				return text;
			}
		}

		const children = node.childNodes;
		// 앞에서부터 순회 (0 → N)
		for (let i = children.length - 1; i >= 0; i--) {
			stack.push(children[i]);
		}
	}

	return null;
}

function findLastTextNode(root: Node, skipEmpty = false): Text | null {
	const stack: Node[] = [root];

	while (stack.length > 0) {
		const node = stack.pop()!;

		if (node.nodeType === Node.TEXT_NODE) {
			const text = node as Text;
			if (!skipEmpty || text.nodeValue !== "") {
				return text;
			}
		}

		const children = node.childNodes;
		for (let i = children.length - 1; i >= 0; i--) {
			stack.push(children[i]);
		}
	}

	return null;
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

function isEmptyElement(el: HTMLElement): boolean {
	for (const node of Array.from(el.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			if (node.textContent?.trim()) {
				return false; // 내용이 있는 텍스트
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const elem = node as HTMLElement;
			if (elem.tagName !== "BR") {
				return false; // <br> 외의 요소가 있음
			}
		} else {
			return false; // 알 수 없는 노드 (예: 주석 등)
		}
	}
	return true;
}

function isNodeStartInsideRange(element: Node, range: Range) {
	const elementStart = document.createRange();
	elementStart.setStartBefore(element);
	elementStart.setEndBefore(element);

	return range.compareBoundaryPoints(Range.START_TO_START, elementStart) <= 0 && range.compareBoundaryPoints(Range.END_TO_START, elementStart) > 0;
}
