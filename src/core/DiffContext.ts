import { getSectionHeadingTrail } from "@/utils/getSectionTrail";
import type { RichToken } from "./tokenization/TokenizeContext";
import type { EditorName } from "./types";

/**
 * DiffContext
 *
 * diff 입력과 결과를 한데 모아서 들고 있는 컨텍스트다. 사실 그냥 데이터 집합인데 편의 메서드를 한두개 넣음
 */
export class DiffContext {
	leftTokens: readonly RichToken[];
	rightTokens: readonly RichToken[];
	diffOptions: DiffOptions;
	rawEntries: DiffEntry[];
	entries: DiffEntry[];
	leftEntries: DiffEntry[];
	rightEntries: DiffEntry[];
	diffs: DiffItem[];
	leftSectionHeadings: SectionHeading[];
	rightSectionHeadings: SectionHeading[];

	constructor(
		leftTokens: readonly RichToken[],
		rightTokens: readonly RichToken[],
		diffOptions: DiffOptions,
		rawEntries: DiffEntry[],
		entries: DiffEntry[],
		leftEntries: DiffEntry[],
		rightEntries: DiffEntry[],
		diffs: DiffItem[],
		leftSectionHeadings: SectionHeading[] = [],
		rightSectionHeadings: SectionHeading[] = []
	) {
		this.leftTokens = leftTokens;
		this.rightTokens = rightTokens;
		this.diffOptions = diffOptions;
		this.rawEntries = rawEntries;
		this.entries = entries;
		this.leftEntries = leftEntries;
		this.rightEntries = rightEntries;
		this.diffs = diffs;
		this.leftSectionHeadings = leftSectionHeadings;
		this.rightSectionHeadings = rightSectionHeadings;
	}

	/**
	 * 주어진 `tokenIndex`의 토큰이 속한 섹션 헤딩을 찾고, 해당 헤딩부터 최상위 부모 헤딩까지의 계층적 trail을 반환함.
	 *
	 * 토큰이 속한 섹션 헤딩을 찾지 못하는 경우 빈 배열을 반환함.
	 *
	 * @param side - `"left"` or `"right"`.
	 * @param tokenIndex - trail을 구하려는 토큰의 인덱스.
	 * @returns {SectionHeading[]}
	 *          최하위 섹션 헤딩부터 상위 부모 헤딩까지 포함된 배열.
	 *          배열 순서는 [조상 > 부모 > 현재] 형태.
	 */
	getSelectionTrailFromTokenIndex(side: EditorName, tokenIndex: number): SectionHeading[] {
		const headings = side === "left" ? this.leftSectionHeadings : this.rightSectionHeadings;
		return getSectionHeadingTrail(headings, tokenIndex);
	}

	/**
	 * sourceSpan이 가리키는 토큰 구간을 기준으로 반대편 구간을 찾아낸다.
	 * 토큰이 항상 1대1로 매칭이 된다면 참으로 아름다운 세상이었겠지만 인생 그렇게 쉽지 않다...
	 *
	 * 예: 왼쪽은 ["가","나"](두개의 토큰), 오른쪽은 ["가나"](하나의 토큰)인 경우 왼쪽에서 "가"만 선택하더라도
	 * 오른쪽은 "가나"가 매칭이 되어야 한다. 그러면 오른쪽의 "가나"에 매칭되는 왼쪽은 토큰은? "가"와 "나"가 된다.
	 *
	 * source, dest, source, dest 확장이 안될때까지 무한 확장을 시도하는 방법을 쓰다가 잠들기 전 더 쉽고 빠른 방법이 생각나서 바꿈.
	 *
	 * 파라미터:
	 * @param side - `"left"` or `"right"`.
	 * @param sourceSpan { start, end } 형태. start와 end는 토큰 인덱스. end는 exclusive임.
	 *
	 * 반환값:
	 * @returns { left: Span, right: Span } left와 right는 start,end 토큰인덱스가 들어있는 span이고
	 * 										마찬가지로 end는 exclusive.
	 *
	 * 예외:
	 * @throws {Error} sourceSpan의 토큰인덱스가 out of bound인 경우. side 체크는 안한다. 그건 알아서 잘 하겠지.
	 *
	 * 예시:
	 * // 왼쪽 ["가","나"], 오른쪽 ["가나"]
	 * // side = "left", sourceSpan = "가"
	 * // 결과 => left=["가","나"], right=["가나"]
	 */
	resolveMatchingSpanPair(side: EditorName, sourceSpan: Span): { left: Span; right: Span } {
		if (this.entries.length === 0) {
			return { left: { start: 0, end: 0 }, right: { start: 0, end: 0 } };
		}


		const thisEntries = this[`${side}Entries`] as DiffEntry[];
		const n = thisEntries.length;

		if (n === 0 || (sourceSpan.start === 0 && sourceSpan.end === 0)) {
			return { left: { start: 0, end: 0 }, right: { start: 0, end: 0 } };
		}

		if (sourceSpan.start < 0 || sourceSpan.end < sourceSpan.start || sourceSpan.end > n) {
			throw new Error(`Invalid span [${sourceSpan.start}, ${sourceSpan.end}) for side=${side}`);
		}

		const other: EditorName = side === "left" ? "right" : "left";

		// 비어있지 않은 스팬이면 엔트리 경계에 맞춰 좌우 확장
		const expandOnSide = (fromSide: EditorName, span: Span): Span => {
			const entries = this[`${fromSide}Entries`] as DiffEntry[];
			let a = span.start;
			let b = span.end;

			let realStart, realEnd;
			if (a >= entries.length) {
				realStart = realEnd = entries.length;
			} else if (a === b) {
				realStart = entries[a][fromSide].start;
				if (realStart < a) {
					realEnd = entries[a][fromSide].end;
				} else {
					realEnd = a;
				}
			} else {
				realStart = entries[a][fromSide].start;
				realEnd = entries[b - 1][fromSide].end;
			}

			return { start: realStart, end: realEnd };
		};

		const expanded = expandOnSide(side, sourceSpan);
		let otherSpan: Span;
		if (expanded.start === expanded.end) {
			const k = expanded.start;
			if (k >= thisEntries.length) {
				const startAndEnd = thisEntries[thisEntries.length - 1]?.[other]?.end ?? 0;
				otherSpan = {
					start: startAndEnd,
					end: startAndEnd,
				};
			} else if (thisEntries[k] && thisEntries[k][other]) {
				otherSpan = {
					start: thisEntries[k][other].start,
					end: thisEntries[k][other].start,
				};
			} else {
				// fallback: 빈 span 반환
				otherSpan = { start: 0, end: 0 };
			}
		} else {
			otherSpan = {
				start: thisEntries[expanded.start][other].start,
				end: thisEntries[expanded.end - 1][other].end,
			};
		}

		return side === "left" ? { left: expanded, right: otherSpan } : { left: otherSpan, right: expanded };
	}

	zresolveMatchingSpanPair(side: EditorName, sourceSpan: Span): { left: Span; right: Span } {
		console.log("resolveMatchingSpanPair:", side, sourceSpan);
		const thisEntries = this[`${side}Entries`] as DiffEntry[];
		const entriesLen = thisEntries.length;

		if (sourceSpan.start < 0 || sourceSpan.end < sourceSpan.start || sourceSpan.end > entriesLen) {
			throw new Error(`Invalid span [${sourceSpan.start}, ${sourceSpan.end}) for side=${side}`);
		}

		const expand = (fromSide: EditorName, span: Span): Span => {
			const entries = this[`${fromSide}Entries`] as DiffEntry[];
			console.log("expanding", entries, span);
			let realStart = span.start;
			let realEnd = span.end;
			if (span.start === span.end) {
				if (entries[realStart - 1].type !== 0) {
					realStart = entries[realStart - 1][fromSide].start;
					realEnd = entries[realStart - 1][fromSide].end;
				}
				// while (realEnd < entries.length && entries[realEnd][fromSide].start < span.end) {
				// 	realEnd++;
				// 	console.log("Expand right", realEnd);
				// }
			} else {
				while (realStart > 0 && entries[realStart - 1][fromSide].start <= span.start && entries[realStart - 1][fromSide].end > span.start) {
					realStart--;
				}

				while (realEnd < entries.length && entries[realEnd][fromSide].start < span.end) {
					realEnd++;
				}
			}

			return { start: realStart, end: realEnd };
		};

		const expanded = expand(side, sourceSpan);
		console.log("expanded:", expanded);
		const otherSide = side === "left" ? "right" : "left";
		const thisFirstEntry = thisEntries[expanded.start];
		const thisLastEntry = thisEntries[Math.max(expanded.end - 1, expanded.start)];

		console.log(
			"ret:",
			side === "left"
				? {
						left: expanded,
						right: {
							start: thisFirstEntry[otherSide].start,
							end: thisLastEntry[otherSide].end,
						},
				  }
				: {
						left: {
							start: thisFirstEntry[otherSide].start,
							end: thisLastEntry[otherSide].end,
						},
						right: expanded,
				  }
		);
		return side === "left"
			? {
					left: expanded,
					right: {
						start: thisFirstEntry[otherSide].start,
						end: thisLastEntry[otherSide].end,
					},
			  }
			: {
					left: {
						start: thisFirstEntry[otherSide].start,
						end: thisLastEntry[otherSide].end,
					},
					right: expanded,
			  };
	}
}
