import { TOKEN_BUFFER_STRIDE } from "../constants";
import {
	PAYLOAD_SHIFT,
	TOKEN_FLAGS_HAS_FOLLOWING_SPACE,
	TOKEN_FLAGS_LINE_END,
	TOKEN_FLAGS_LINE_START,
	TOKEN_FLAGS_STRUCTURAL_OPEN,
	TOKEN_FLAGS_TYPE_IMAGE,
	TOKEN_FLAGS_TYPE_STRUCTURAL,
	TOKEN_TYPE_MASK,
} from "../tokenization";
import type { DiffInput, DiffOptions } from "./types";

const STRUCTURAL_OPEN_TEXTS = [
	"\uE000", // 0: unused
	"\uE001", // 1: structural token type 1 (e.g. <td>, <th>)
	"\uE002", // 2: structural token type 2 (e.g. <tr>)
	"\uE003", // 3: structural token type 3 (e.g. <table>)
];
const STRUCTURAL_CLOSE_TEXTS = [
	"\uE100", // 0: unused
	"\uE101", // 1: structural token type 1 (e.g. </td>, </th>)
	"\uE102", // 2: structural token type 2 (e.g. </tr>)
	"\uE103", // 3: structural token type 3 (e.g. </table>)
];

export function buildDiffInput(
	wholeText: string,
	data: Int32Array,
	_diffOptions: DiffOptions,
): { input: DiffInput; lineCount: number } {
	const STRUCTURAL_TOKEN_LENGTH = _diffOptions.structuralTokenLength;
	const tokenCount = data.length / TOKEN_BUFFER_STRIDE;

	// 공백을 넣어줘야 자연스럽게 공백을 포함한 텍스트로 sa가 만들어짐.
	const insertSpace = _diffOptions.whitespace === "collapse";

	const flagsArray = new Uint32Array(tokenCount);
	const offsetArray = new Uint32Array(tokenCount + 1);

	let totalBufLen = 0;
	let lineCount = 0;
	let lastCharWasSpace = false;
	for (let i = 0; i < tokenCount; i++) {
		const textLength = data[i * TOKEN_BUFFER_STRIDE + 1];
		const flags = data[i * TOKEN_BUFFER_STRIDE + 2];
		const tokenType = flags & TOKEN_TYPE_MASK;

		if (flags & TOKEN_FLAGS_LINE_START) {
			lineCount++;
		}

		flagsArray[i] = flags;

		// 이미지 토큰 앞에 공백 정규화
		// 이미지 앞뒤로의 공백 여부는 whitespace 옵션과는 상관 없이 무시하는 것이 사람의 눈에 더 자연스러움!!
		if (insertSpace && tokenType === TOKEN_FLAGS_TYPE_IMAGE && !lastCharWasSpace && totalBufLen > 0) {
			totalBufLen++;
		}

		offsetArray[i] = totalBufLen;

		if (tokenType === TOKEN_FLAGS_TYPE_STRUCTURAL) {
			totalBufLen += STRUCTURAL_TOKEN_LENGTH;
		} else {
			totalBufLen += textLength;
		}

		lastCharWasSpace = false;

		// 이미지 토큰 뒤에 공백 정규화
		// 이미지 앞뒤로의 공백 여부는 whitespace 옵션과는 상관 없이 무시하는 것이 사람의 눈에 더 자연스러움!!
		if (insertSpace && tokenType === TOKEN_FLAGS_TYPE_IMAGE) {
			totalBufLen++;
			lastCharWasSpace = true;
		}

		if (
			insertSpace &&
			!lastCharWasSpace &&
			(flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE || flags & TOKEN_FLAGS_LINE_END)
		) {
			totalBufLen++;
			lastCharWasSpace = true;
		}
	}
	offsetArray[tokenCount] = totalBufLen;

	const textBuffer = new Uint16Array(totalBufLen);

	let currentPos = 0;
	lastCharWasSpace = false;
	for (let i = 0; i < tokenCount; i++) {
		const ofs = data[i * TOKEN_BUFFER_STRIDE + 0];
		const len = data[i * TOKEN_BUFFER_STRIDE + 1];
		const flags = flagsArray[i];
		const tokenType = flags & TOKEN_TYPE_MASK;

		// 이미지 토큰 앞에 공백 정규화
		if (insertSpace && tokenType === TOKEN_FLAGS_TYPE_IMAGE && !lastCharWasSpace && currentPos > 0) {
			textBuffer[currentPos++] = 32;
		}

		if (tokenType === TOKEN_FLAGS_TYPE_STRUCTURAL) {
			if (STRUCTURAL_TOKEN_LENGTH > 0) {
				const structuralType = (flags >>> PAYLOAD_SHIFT) & 0x7;
				let structuralText = (
					flags & TOKEN_FLAGS_STRUCTURAL_OPEN ? STRUCTURAL_OPEN_TEXTS : STRUCTURAL_CLOSE_TEXTS
				)[structuralType];
				for (let j = 0; j < STRUCTURAL_TOKEN_LENGTH; j++) {
					textBuffer[currentPos++] = structuralText.charCodeAt(0);
				}
			}
		} else {
			for (let j = 0; j < len; j++) {
				textBuffer[currentPos++] = wholeText.charCodeAt(ofs + j);
			}
		}

		lastCharWasSpace = false;

		// 이미지 토큰 뒤에 공백 정규화
		if (insertSpace && tokenType === TOKEN_FLAGS_TYPE_IMAGE) {
			textBuffer[currentPos++] = 32;
			lastCharWasSpace = true;
		}

		if (
			insertSpace &&
			!lastCharWasSpace &&
			(flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE || flags & TOKEN_FLAGS_LINE_END)
		) {
			textBuffer[currentPos++] = 32;
			lastCharWasSpace = true;
		}
	}

	data.fill(0);

	return {
		input: {
			buffer: textBuffer,
			offsets: offsetArray,
			flags: flagsArray,
			resultBuffer: data,
			tokenCount,
		},
		lineCount,
	};
}
