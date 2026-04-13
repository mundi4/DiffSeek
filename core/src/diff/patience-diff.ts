import {
	TOKEN_FLAGS_LINE_END,
	TOKEN_FLAGS_LINE_START,
	TOKEN_FLAGS_STRUCTURAL_OPEN,
	isStructuralClose,
} from "../tokenization";
import { calculateHash, isTokenRangeTextEqual } from "./helpers";
import type { DiffAnchor, DiffInput, DiffOptions } from "./types";

export function buildPatienceAnchors(
	lhsInput: DiffInput,
	rhsInput: DiffInput,
	lhsLineCount: number,
	rhsLineCount: number,
	diffOptions: DiffOptions,
): DiffAnchor[] {
	const HASH_MASK = 0xffff;
	const MIN_TOKEN_COUNT = diffOptions.patienceMinTokenCount;
	const MIN_TEXT_LEN = diffOptions.patienceMinTextLen;
	const LINE_BUFFER_STRIDE = 4;
	const MAX_STRUCTURAL_PAIR_EXPANSION = 1; // 0=없음, 1=<td>까지, 2=<tr>+<td>까지
	const ignoreWhitespaces = diffOptions.whitespace === "ignore";

	const HEAD = new Int32Array(HASH_MASK + 1);

	const links = lhsInput.resultBuffer.subarray(0, lhsLineCount);
	const lineBuffer = lhsInput.resultBuffer.subarray(lhsLineCount);

	HEAD.fill(-1);
	links.fill(-1);

	const lhsBuffer = lhsInput.buffer;
	const rhsBuffer = rhsInput.buffer;

	const lhsFlags = lhsInput.flags;
	const rhsFlags = rhsInput.flags;

	const lhsOffsets = lhsInput.offsets;
	const rhsOffsets = rhsInput.offsets;

	const lhsTknCount = lhsFlags.length;
	const rhsTknCount = rhsFlags.length;

	let nextLineIdx = 0;

	// ------------------------
	// LHS 스캔
	// ------------------------
	let i = 0;
	while (i < lhsTknCount) {
		// LINE_START까지 건너뜀 (structural close 토큰들을 스킵)
		while (i < lhsTknCount && !(lhsFlags[i] & TOKEN_FLAGS_LINE_START)) i++;
		if (i >= lhsTknCount) break;

		const lineStart = i;
		while (i < lhsTknCount && (lhsFlags[i++] & TOKEN_FLAGS_LINE_END) === 0);
		const lineEnd = i;

		if (lineEnd - lineStart < MIN_TOKEN_COUNT) continue;

		// structural OPEN/CLOSE 쌍 확장 (both-or-nothing per level)
		let extStart = lineStart;
		let extEnd = lineEnd;
		for (let depth = 0; depth < MAX_STRUCTURAL_PAIR_EXPANSION; depth++) {
			if (
				extStart > 0 &&
				extEnd < lhsTknCount &&
				lhsFlags[extStart - 1] & TOKEN_FLAGS_STRUCTURAL_OPEN &&
				isStructuralClose(lhsFlags[extEnd])
			) {
				extStart--;
				extEnd++;
			} else {
				break;
			}
		}

		const charPos = lhsOffsets[extStart];
		const charLen = lhsOffsets[extEnd] - charPos;
		if (charLen < MIN_TEXT_LEN) continue;

		let h = calculateHash(lhsBuffer, charPos, charLen);
		h = h & HASH_MASK;

		let foundIdx = -1;

		for (let curr = HEAD[h]; curr !== -1; curr = links[curr]) {
			const base = curr * LINE_BUFFER_STRIDE;
			const foundStart = lineBuffer[base];
			if (foundStart === -1) continue;

			const foundEnd = lineBuffer[base + 1];

			// 1. 공백의 위치까지 첨가된 해시가 충돌
			// 2. 그런데 두 범위의 토큰 수가 같음
			// 3. 그런데 거기에 또 공백이 제거된 문자열까지 완전히 일치함
			// 여기까지 왔는데 실제로 두 줄이 같지 않다면(공백의 위치가 서로 다르다면) 나에게 돌을 던져도 좋다...
			if (ignoreWhitespaces || foundEnd - foundStart === extEnd - extStart) {
				if (
					isTokenRangeTextEqual(
						lhsBuffer,
						lhsOffsets,
						foundStart,
						foundEnd,
						lhsBuffer,
						lhsOffsets,
						extStart,
						extEnd,
					)
				) {
					foundIdx = curr;
					break;
				}
			}
		}

		if (foundIdx === -1) {
			const idx = nextLineIdx++;
			links[idx] = HEAD[h];
			HEAD[h] = idx;

			const base = idx * LINE_BUFFER_STRIDE;
			lineBuffer[base] = extStart;
			lineBuffer[base + 1] = extEnd;
			lineBuffer[base + 2] = -1; // rhsStart
		} else {
			// duplicate
			lineBuffer[foundIdx * LINE_BUFFER_STRIDE] = -1;
		}
	}

	// ------------------------
	// RHS 스캔
	// ------------------------
	i = 0;
	while (i < rhsTknCount) {
		// LINE_START까지 건너뜀 (structural close 토큰들을 스킵)
		while (i < rhsTknCount && !(rhsFlags[i] & TOKEN_FLAGS_LINE_START)) i++;
		if (i >= rhsTknCount) break;

		const lineStart = i;
		while (i < rhsTknCount && (rhsFlags[i++] & TOKEN_FLAGS_LINE_END) === 0);
		const lineEnd = i;

		// structural OPEN/CLOSE 쌍 확장 (both-or-nothing per level)
		let extStart = lineStart;
		let extEnd = lineEnd;
		for (let depth = 0; depth < MAX_STRUCTURAL_PAIR_EXPANSION; depth++) {
			if (
				extStart > 0 &&
				extEnd < rhsTknCount &&
				rhsFlags[extStart - 1] & TOKEN_FLAGS_STRUCTURAL_OPEN &&
				isStructuralClose(rhsFlags[extEnd])
			) {
				extStart--;
				extEnd++;
			} else {
				break;
			}
		}

		const charPos = rhsOffsets[extStart];
		const charLen = rhsOffsets[extEnd] - charPos;
		if (charLen < MIN_TEXT_LEN) continue;

		let h = calculateHash(rhsBuffer, charPos, charLen);
		h = h & HASH_MASK;

		for (let curr = HEAD[h]; curr !== -1; curr = links[curr]) {
			const base = curr * LINE_BUFFER_STRIDE;
			const lhsStart = lineBuffer[base];
			if (lhsStart === -1) continue;

			const lhsEnd = lineBuffer[base + 1];

			if (ignoreWhitespaces || lhsEnd - lhsStart === extEnd - extStart) {
				if (
					!isTokenRangeTextEqual(
						lhsBuffer,
						lhsOffsets,
						lhsStart,
						lhsEnd,
						rhsBuffer,
						rhsOffsets,
						extStart,
						extEnd,
					)
				) {
					continue;
				}
			} else {
				continue;
			}

			const rhsStartStored = lineBuffer[base + 2];

			if (rhsStartStored === -1) {
				lineBuffer[base + 2] = extStart;
				lineBuffer[base + 3] = extEnd;
			} else {
				// rhs duplicate
				lineBuffer[base] = -1;
			}

			break; // 텍스트 매치했으니 더 볼 필요 없음
		}
	}

	// ------------------------
	// Compaction
	// ------------------------
	let numMatches = 0;

	for (let lineIdx = 0; lineIdx < nextLineIdx; lineIdx++) {
		const base = lineIdx * LINE_BUFFER_STRIDE;

		const lhsStart = lineBuffer[base];
		if (lhsStart === -1) continue;

		const rhsStart = lineBuffer[base + 2];
		if (rhsStart === -1) continue;

		if (lineIdx !== numMatches) {
			const dst = numMatches * LINE_BUFFER_STRIDE;
			lineBuffer[dst] = lineBuffer[base];
			lineBuffer[dst + 1] = lineBuffer[base + 1];
			lineBuffer[dst + 2] = lineBuffer[base + 2];
			lineBuffer[dst + 3] = lineBuffer[base + 3];
		}

		numMatches++;
	}

	if (numMatches === 0) return [];

	// ------------------------
	// LIS (rhsStart 기준)
	// ------------------------
	const tails = new Int32Array(numMatches);
	const prev = new Int32Array(numMatches);

	let length = 0;

	for (let i = 0; i < numMatches; i++) {
		const rhsVal = lineBuffer[i * LINE_BUFFER_STRIDE + 2];

		let lo = 0;
		let hi = length;

		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			const midIdx = tails[mid];
			const midVal = lineBuffer[midIdx * LINE_BUFFER_STRIDE + 2];

			if (midVal < rhsVal) lo = mid + 1;
			else hi = mid;
		}

		tails[lo] = i;
		prev[i] = lo > 0 ? tails[lo - 1] : -1;

		if (lo === length) length++;
	}

	// const result = new Int32Array(length * 4);
	const anchors: DiffAnchor[] = new Array(length);

	let k = tails[length - 1];

	for (let i = length - 1; i >= 0; i--) {
		const base = k * LINE_BUFFER_STRIDE;
		anchors[i] = {
			lhsStart: lineBuffer[base],
			lhsEnd: lineBuffer[base + 1],
			rhsStart: lineBuffer[base + 2],
			rhsEnd: lineBuffer[base + 3],
		};
		k = prev[k];
	}

	return anchors;
}
