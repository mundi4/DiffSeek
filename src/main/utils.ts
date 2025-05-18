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

function getSelectedTokenRange(tokens: Token[], startOffset: number, endOffset: number): [number, number] {
	function findTokenIndex(offset: number, low?: number): number {
		let isStart;
		if (low === undefined) {
			isStart = true;
			low = 0;
		} else {
			isStart = false;
		}
		let high = tokens.length - 1;
		let result = isStart ? tokens.length : -1;

		while (low! <= high) {
			const mid: number = (low! + high) >> 1;
			const token = tokens[mid];
			const tokenEnd = token.pos + token.len;

			if (isStart) {
				const prevEnd = mid > 0 ? tokens[mid - 1].pos + tokens[mid - 1].len : 0;
				if (offset > prevEnd && offset < tokenEnd) {
					return mid;
				}
				if (mid === 0 && offset >= token.pos && offset < tokenEnd) {
					return 0;
				}
			} else {
				const nextStart = mid + 1 < tokens.length ? tokens[mid + 1].pos : Infinity;
				if (offset >= token.pos && offset < nextStart) {
					return mid;
				}
			}

			if (isStart) {
				if (token.pos >= offset) {
					result = mid;
					high = mid - 1;
				} else {
					low = mid + 1;
				}
			} else {
				if (tokenEnd < offset) {
					result = mid;
					low = mid + 1;
				} else {
					high = mid - 1;
				}
			}
		}

		return result;
	}

	const startIndex = findTokenIndex(startOffset);
	const endIndex = findTokenIndex(endOffset - 1, startIndex);
	return [startIndex, endIndex + 1]; // [inclusive, exclusive]
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

// #region by ChatGTP
function insertFragmentSmart(fragment: DocumentFragment, hasBlockElements: boolean) {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return;
	const range = selection.getRangeAt(0);

	// 커서가 있는 가장 가까운 p 찾기
	const pEl = getClosestElement(range.startContainer, "p");
	if (!hasBlockElements) {
		// 블록 요소 없으면 그냥 삽입
		insertAtRange(range, fragment);
		return;
	}

	console.log("p???", pEl);
	if (pEl) {
		// p가 있으면 p 기준으로 쪼개기 + 인라인도 쪼개기
		splitAncestorsAtRange(range, pEl);

		// p 다시 찾기 (split 했으니)
		const newP = getClosestElement(range.startContainer, "p");
		if (!newP) {
			insertAtRange(range, fragment);
			return;
		}

		// p 앞뒤 나누고 fragment 삽입
		splitAndInsert(range, newP, fragment);
	} else {
		// p 없으면 인라인 요소들만 쪼개고 fragment 삽입
		splitAncestorsAtRange(range, null);

		// 그냥 삽입
		insertAtRange(range, fragment);
	}
}
function splitAndInsert(range: Range, p: HTMLElement, fragment: DocumentFragment) {
	// p 내부 텍스트와 인라인 요소만 쪼개기
	const beforeFragment = document.createDocumentFragment();
	const afterFragment = document.createDocumentFragment();

	// p 자식 노드 순회하며 커서 위치 기준으로 before/after 분리
	let passedCursor = false;

	p.childNodes.forEach((node) => {
		if (!passedCursor) {
			// 커서 이전 노드면 beforeFragment에 복사
			if (node === range.startContainer || node.contains(range.startContainer)) {
				// 커서가 이 노드 안에 있으면 텍스트 쪼개기
				if (node.nodeType === Node.TEXT_NODE) {
					const textNode = node as Text;
					const beforeText = textNode.textContent!.slice(0, range.startOffset);
					const afterText = textNode.textContent!.slice(range.startOffset);

					if (beforeText) beforeFragment.appendChild(document.createTextNode(beforeText));
					if (afterText) afterFragment.appendChild(document.createTextNode(afterText));
				} else {
					// 커서가 인라인 요소 안에 있으면 별도 처리 (재귀 등)
					// 간단히 일단 전체 노드는 afterFragment로
					afterFragment.appendChild(node.cloneNode(true));
				}
				passedCursor = true;
			} else {
				beforeFragment.appendChild(node.cloneNode(true));
			}
		} else {
			afterFragment.appendChild(node.cloneNode(true));
		}
	});

	// 새 p 요소 생성 (중첩 방지)
	const pBefore = document.createElement("p");
	pBefore.appendChild(beforeFragment);

	const pAfter = document.createElement("p");
	pAfter.appendChild(afterFragment);

	// p 교체
	const parent = p.parentNode!;
	parent.insertBefore(pBefore, p);
	parent.insertBefore(fragment, p);
	parent.insertBefore(pAfter, p);
	parent.removeChild(p);

	moveCursorAfterNode(window.getSelection()!, fragment);
}

function getClosestElement(node: Node, tagName: string): HTMLElement | null {
	if (node.nodeType === Node.ELEMENT_NODE) {
		return (node as Element).closest(tagName);
	}
	if (node.parentElement) {
		return node.parentElement.closest(tagName);
	}
	return null;
}

function insertAtRange(range: Range, fragment: DocumentFragment) {
	const selection = window.getSelection();
	range.deleteContents();
	range.insertNode(fragment);
	moveCursorAfterNode(selection!, fragment);
}

function moveCursorAfterNode(selection: Selection, fragment: DocumentFragment) {
	const lastNode = fragment.lastChild;
	if (!lastNode) return;
	const newRange = document.createRange();
	newRange.setStartAfter(lastNode);
	newRange.collapse(true);
	selection.removeAllRanges();
	selection.addRange(newRange);
}

/**
 * 인자로 받은 범위 기준으로,
 * stopAt이 있으면 그 요소까지,
 * 없으면 최상위 인라인 요소까지
 * 모두 쪼갭니다.
 */
function splitAncestorsAtRange(range: Range, stopAt: HTMLElement | null) {
	let currentNode = range.startContainer;
	let offset = range.startOffset;

	// 텍스트 노드면 splitText
	if (currentNode.nodeType === Node.TEXT_NODE) {
		const textNode = currentNode as Text;
		if (offset > 0 && offset < textNode.length) {
			const afterText = textNode.splitText(offset);
			range.setStart(afterText, 0);
			range.setEnd(afterText, 0);
			currentNode = afterText;
			offset = 0;
		}
	}

	while (currentNode.parentNode && currentNode.parentNode !== stopAt) {
		const parent = currentNode.parentNode as Element;

		// stopAt 이 null이면 p 없는 상황이니,
		// inline 요소만 쪼개야 함

		if (BLOCK_ELEMENTS[parent.nodeName]) break;
		// if (stopAt === null && !INLINE_ELEMENTS[parent.nodeName]) {
		// 	break;
		// }
		// console.log("not stopped", { parent, stopAt });

		const index = Array.prototype.indexOf.call(parent.childNodes, currentNode);
		const afterSiblings = Array.prototype.slice.call(parent.childNodes, index + 1);

		const newParent = parent.cloneNode(false);
		afterSiblings.forEach((node: Node) => newParent.appendChild(node));

		// console.log(newParent)
		parent.parentNode!.insertBefore(newParent, parent.nextSibling);

		currentNode = parent;
	}
}
//#endregion by ChatGTP
