import { BLOCK_ELEMENTS, VOID_ELEMENTS } from "@/core/constants/index";

type extractTextFromRangeOptions = {
	maxLength?: number; // Optional max length for the extracted text
	newLineChar?: string; // Optional character to use for new lines, default is "\n"
};

const defaultOptions: extractTextFromRangeOptions = {
	maxLength: undefined, // No limit by default
	newLineChar: "\n", // Default new line character
};

export function extractTextFromRange(
	range: Range,
	{ maxLength, newLineChar }: extractTextFromRangeOptions = defaultOptions
): [result: string, trimmed: boolean] {
	//let text = "";
	const blockStack: { node: Node; hasVisibleContent: boolean }[] = [];
	let container = range.startContainer;
	let childIndex = range.startOffset;
	let endContainer = range.endContainer;
	let endOffset = range.endOffset;
	let hasVisibleContent = false;
	let length = 0;
	maxLength ??= 1000000;
	newLineChar ??= "\n";

	function normalizeText(str: string): string {
		return (
			str
				.replace(/[\r\n\t]+/g, " ") // 모든 공백 문자를 스페이스로 통일
				//.replace(/\u00A0/g, " ") // nbsp도 일반 공백으로? 할까말까?
				.replace(/ {2,}/g, " ") // 연속 공백 압축
		);
	}

	const lines: string[] = [""];
	function append(str: string) {
		let cleaned = normalizeText(str);
		if (cleaned) {
			const curr = lines[lines.length - 1];
			if (curr === "") {
				cleaned = cleaned.trimStart();
			}
			lines[lines.length - 1] += cleaned;
			//text += cleaned;
			hasVisibleContent = true;
		}
	}

	function newline() {
		const curr = lines[lines.length - 1].trimEnd();
		lines[lines.length - 1] = curr;
		if (curr !== "") {
			length += curr.length;
			lines.push("");
		}
		return maxLength ? length > maxLength : false;
	}

	function finalize(): [string, boolean] {
		let trimmed = false;
		let result = lines.join(newLineChar).trimEnd();
		if (maxLength && result.length > maxLength) {
			result = result.slice(0, maxLength);
			trimmed = true;
		}
		return [result, trimmed];
	}

	if (container.nodeType === 3) {
		// 시작과 끝이 같은 텍스트 노드인 경우 바로 텍스트 추출 후 끝
		if (container === endContainer) {
			append(container.nodeValue!.slice(childIndex, endOffset));
			return finalize();
		}

		// 해당 텍스트노드의 startOffset부분을 추출하고 다음 노드부터 시작
		append(container.nodeValue!.slice(childIndex));
		const parent = container.parentNode!;
		if (!parent) {
			return finalize();
		}
		childIndex = Array.prototype.indexOf.call(parent.childNodes, container) + 1;
		container = parent;
	}

	const indexStack: number[] = [];
	while (container) {
		if (container === endContainer) {
			if (childIndex >= endOffset) break;
		}

		const current = container.childNodes[childIndex];
		if (!current) {
			const prev = container;
			container = container.parentNode!;
			if (!container) break;

			if (indexStack.length > 0) {
				childIndex = indexStack.pop()!;
			} else {
				childIndex = Array.prototype.indexOf.call(container.childNodes, prev);
			}
			childIndex++;
			if (BLOCK_ELEMENTS[prev.nodeName]) {
				// If the previous element is a block element, we need to finalize the current block
				if (
					hasVisibleContent
					//|| prev.nodeName === "P" // P 우대 금지 ㅋ
				) {
					// text += "\n";
					if (newline()) break;
				}
				if (blockStack.length > 0) {
					({ hasVisibleContent } = blockStack.pop()!);
				} else {
					hasVisibleContent = false;
				}
			}
			continue;
		}

		if (current.nodeType === 1) {
			if (BLOCK_ELEMENTS[current.nodeName]) {
				blockStack.push({ node: current, hasVisibleContent });
				hasVisibleContent = false;
			}
			if (current.nodeName === "BR") {
				// append로 넣어버리면 줄바꿈이 제거되므로...
				if (newline()) break;
				// text += "\n";
				hasVisibleContent = false; // 블럭이 줄바꿈 문자로 끝난다면 닫힐 때 추가로 줄바꿈을 넣을 필요가 없음
			} else if (current.nodeName === "IMG") {
				append("🖼️");
			} else if (!VOID_ELEMENTS[current.nodeName]) {
				indexStack.push(childIndex);
				container = current;
				childIndex = 0;
				continue;
			}
		}

		if (current.nodeType === 3) {
			if (current === endContainer) {
				append(current.nodeValue!.slice(0, endOffset));
				break;
			}
			append(current.nodeValue!);
		}

		childIndex++;
	}

	return finalize();
}
