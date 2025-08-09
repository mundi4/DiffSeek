import { getSectionHeadingTrail } from "@/utils/getSectionTrail";
import type { RichToken } from "./tokenization/TokenizeContext";
import type { EditorName } from "./types";

export class DiffContext {
	//reqId: number;
	leftTokens: readonly RichToken[];
	rightTokens: readonly RichToken[];
	diffOptions: DiffOptions;
	rawDiffs: RawDiff[];
	entries: RawDiff[];
	leftEntries: RawDiff[];
	rightEntries: RawDiff[];
	diffs: DiffItem[];
	leftSectionHeadings: SectionHeading[];
	rightSectionHeadings: SectionHeading[];

	constructor(
		leftTokens: readonly RichToken[],
		rightTokens: readonly RichToken[],
		diffOptions: DiffOptions,
		rawDiffs: RawDiff[],
		entries: RawDiff[],
		leftEntries: RawDiff[],
		rightEntries: RawDiff[],
		diffs: DiffItem[],
		leftSectionHeadings: SectionHeading[] = [],
		rightSectionHeadings: SectionHeading[] = []
	) {
		this.leftTokens = leftTokens;
		this.rightTokens = rightTokens;
		this.diffOptions = diffOptions;
		this.rawDiffs = rawDiffs;
		this.entries = entries;
		this.leftEntries = leftEntries;
		this.rightEntries = rightEntries;
		this.diffs = diffs;
		this.leftSectionHeadings = leftSectionHeadings;
		this.rightSectionHeadings = rightSectionHeadings;
	}

	getSelectionTrailFromTokenIndex(side: EditorName, tokenIndex: number): SectionHeading[] {
		const headings = side === "left" ? this.leftSectionHeadings : this.rightSectionHeadings;
		return getSectionHeadingTrail(headings, tokenIndex);
	}

	// 한쪽의 토큰span을 받고 반대쪽의 대응되는 span을 반환... 하는 것이 기본 포인트지만
	// 양쪽의 토큰들은 1:1 대응이 아니므로(예: ["가","나"] <-> ["가나"]) 대응되는 dest span에 역대응되는 span은 source span의 범위보다 클 수 있다.
	// 즉 source가 "가"를 가르킬때 dest에서는 "가나"가 그에 대응되고 dest의 "가나"에 대응되는건 source의 ["가","나"]임.
	// 그런 경우 source span도 적절히 확장해서 { left, right }의 형태로 반환함.
	// source->dest->source->dest->source->... 이런식으로 확장이 안될때까지 반복하는 방법을 쓰다가 잠들기 전에 새로운 방법이 생각나서 바꿈.
	resolveMatchingSpanPair(side: EditorName, sourceSpan: Span): { left: Span; right: Span } | null {
		// console.log("resolveMatchingSpanPair called with side:", side, "sourceSpan:", sourceSpan);
        // console.log("Current entries:", this.entries, "leftEntries:", this.leftEntries, "rightEntries:", this.rightEntries  );
		const thisEntries = this[`${side}Entries`] as RawDiff[];
		if (sourceSpan.start < 0 || sourceSpan.end < sourceSpan.start || sourceSpan.end > thisEntries.length) {
            // console.log("WTF? sourceSpan is invalid:", sourceSpan);
            return null;
        }

		const expand = (fromSide: EditorName, span: Span): Span => {
			const entries = this[`${fromSide}Entries`] as RawDiff[];
			// 왼쪽으로 확장?
			let realStart = span.start;
			while (realStart > 0 && entries[realStart - 1][fromSide].start <= span.start && entries[realStart - 1][fromSide].end > span.start) {
				realStart--;
			}

			// 오른쪽으로 확장?
			let realEnd = span.end;
			while (realEnd < entries.length && entries[realEnd][fromSide].start < span.end) {
				realEnd++;
			}
			return { start: realStart, end: realEnd };
		};
		const expanded = expand(side, sourceSpan);

		// console.log("Expanded span:", expanded);

		const otherSide = side === "left" ? "right" : "left";

		const thisFirstEntry = thisEntries[expanded.start];
		const thisLastEntry = thisEntries[Math.max(expanded.end - 1, expanded.start)];
		const result =
			side === "left"
				? { left: expanded, right: { start: thisFirstEntry[otherSide].start, end: thisLastEntry[otherSide].end } }
				: { left: { start: thisFirstEntry[otherSide].start, end: thisLastEntry[otherSide].end }, right: expanded };

		// console.log("Resolved span pair:", result);
		return result;
		// const lastEntryOtherSpan = { ...thisLastEntry[otherSide] };
		// if (firstEntryOtherSpan.start === firstEntryOtherSpan.end) {
		//     const prevEntry = thisEntries[expanded.start - 1];
		//     const prevEntryOtherSpan = prevEntry[otherSide];
		//     firstEntryOtherSpan.start = prevEntryOtherSpan.end;
		// }

		// const getOtherSpan = (fromSide: EditorName, span: Span): Span | null => {
		// 	const entries = this[`${fromSide}Entries`] as RawDiff[];
		// 	if (span.start < 0 || span.end < span.start || span.end > entries.length) return null;

		// 	const other = fromSide === "left" ? "right" : "left";

		// 	// 왼쪽으로 확장?
		// 	let realStart = span.start;
		// 	while (realStart > 0 && entries[realStart - 1][fromSide].start <= span.start && entries[realStart - 1][fromSide].end > span.start) {
		// 		realStart--;
		// 	}

		// 	// 오른쪽으로 확장?
		// 	let realEnd = span.end;
		// 	while (realEnd < entries.length && entries[realEnd][fromSide].start < span.end) {
		// 		realEnd++;
		// 	}

		// 	const otherStart = entries[realStart][other].start;
		// 	const otherEnd = entries[Math.max(realEnd - 1, realStart)][other].end;

		// 	if (otherStart < 0 || otherEnd < 0) return null;
		// 	return { start: otherStart, end: otherEnd };
		// };

		// const mapped = getOtherSpan(side, sourceSpan);
		// if (!mapped) return null;

		// // mapped가 빈 span이면 reverseMapped 이전 span의 끝과 다음 span의 시작 범위
		// // L: "what the hell", R: "" 일때, L쪽의 "the"가 선택된 경우. R쪽은 빈 span이지만 그 빈 span의 L쪽 대응범위는 "what the hell" 전체임!
		// let reverseMapped: Span;
		// if (mapped.start === mapped.end) {
		// 	const entries = this[`${otherSide}Entries`] as RawDiff[];
		// 	const i = mapped.start;

		// 	const before = i > 0 ? entries[i - 1][side].end : 0;
		// 	const after = i < entries.length ? entries[i][side].start : before;

		// 	reverseMapped = { start: before, end: after };
		// } else {
		// 	reverseMapped = getOtherSpan(otherSide, mapped)!;
		// }

		// return side === "left" ? { left: reverseMapped, right: mapped } : { left: mapped, right: reverseMapped };
	}

	// resolveMatchingSpanPair2(side: EditorName, sourceSpan: Span): { left: Span; right: Span } | null {
	// 	const otherSide = side === "left" ? "right" : "left";

	// 	const getOtherSpan = (fromSide: EditorName, span: Span): Span | null => {
	// 		const entries = this[`${fromSide}Entries`] as RawDiff[];
	// 		if (span.start < 0 || span.end <= span.start || span.end > entries.length) return null;

	// 		const other = fromSide === "left" ? "right" : "left";
	// 		const start = entries[span.start][other].start;
	// 		const end = entries[span.end - 1][other].end;

	// 		if (start < 0 || end < start) return null;
	// 		return { start, end };
	// 	};

	// 	let current = sourceSpan;
	// 	let other = getOtherSpan(side, current);
	// 	if (!other) {
	// 		return null;
	// 	}

	// 	// L: "가나 다라마", R: "가나다 라마"의 토큰들이 있을 때
	// 	// L의 "가나"에서 시작한다면 R의 "가나다"와 매칭이 된다. 하지만 R의 "가나다"와 매칭이 되는 토큰은 L의 "가나다라마"가 된다.
	// 	// 그리고 L의 "가나다라마"와 매칭이 되는 토큰은 다시 R의 "가나다 라마"가 된다.
	// 	// 더이상 확장이 되지 않을 때까지 확장 시도...
	// 	// 참고: 더 쉬운 방법이 있을 것 같아. 이전 엔트리와 다음 엔트리를 확인하면서
	// 	while (true) {
	// 		const newCurrent = getOtherSpan(otherSide, other);
	// 		if (!newCurrent) break;

	// 		const expanded = newCurrent.start < current.start || newCurrent.end > current.end;

	// 		if (!expanded) break;

	// 		current = {
	// 			start: Math.min(current.start, newCurrent.start),
	// 			end: Math.max(current.end, newCurrent.end),
	// 		};

	// 		const newOther = getOtherSpan(side, current);
	// 		if (!newOther) break;

	// 		other = {
	// 			start: Math.min(other.start, newOther.start),
	// 			end: Math.max(other.end, newOther.end),
	// 		};
	// 	}

	// 	return side === "left" ? { left: current, right: other } : { left: other, right: current };
	// }
}
