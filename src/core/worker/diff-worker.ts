import { TokenFlags } from "../tokenization/TokenFlags";
import pixelmatch from "pixelmatch";

let imageCompareCache: Record<string, boolean> = {};

let _nextCtx: WorkContext | null = null;
let _currentCtx: WorkContext | null = null;



export type DiffWorkerRequest = {
	type: "diff";
	reqId: number;
	leftTokens: Token[];
	rightTokens: Token[];
	options: DiffOptions;
};

export type DiffWorkerMessage =
	| { type: "diff"; reqId: number; diffs: DiffEntry[]; options: DiffOptions; processTime: number }
	| { type: "error"; reqId: number; error: string };


type WorkContext = {
	reqId: number;
	type: "diff";
	cancel: boolean;
	// leftText: string;
	// rightText: string;
	leftTokens: Token[];
	rightTokens: Token[];
	start: number;
	finish: number;
	lastYield: number;
	options: DiffOptions;
	entries: DiffEntry[];
	//states: Record<string, any>;
};

self.onmessage = (e) => {
	if (e.data.type === "diff") {
		const request = e.data as DiffWorkerRequest;
		const ctx: WorkContext = {
			...request,
			cancel: false,
			start: 0,
			finish: 0,
			lastYield: 0,
			entries: [],
			//states: {},
		} as WorkContext;


		if (_currentCtx) {
			_currentCtx.cancel = true;
			_nextCtx = ctx;
			return;
		}
		runDiff(ctx);
	}
};

async function runDiff(ctx: WorkContext) {
	_currentCtx = ctx;
	try {
		ctx.lastYield = ctx.start = performance.now();
		self.postMessage({
			reqId: ctx.reqId,
			type: "start",
			start: ctx.start,
		});

		let result: DiffEntry[];
		imageCompareCache = {};
		if (ctx.options.algorithm === "histogram") {
			result = await runHistogramDiff(ctx);
		} else {
			throw new Error("Unknown algorithm: " + ctx.options.algorithm);
		}
		ctx.finish = performance.now();
		_currentCtx = null;

		if (ctx.type === "diff") {
			self.postMessage({
				reqId: ctx.reqId,
				type: ctx.type,
				processTime: ctx.finish - ctx.start,
				diffs: result,
				options: ctx.options,
			} as DiffResponse);
		} else if (ctx.type === "slice") {
			self.postMessage({
				reqId: ctx.reqId,
				type: ctx.type,
				accepted: true,
				processTime: ctx.finish - ctx.start,
				diffs: result,
				options: ctx.options,
			});
		}
	} catch (e) {
		if (e instanceof Error && e.message === "cancelled") {
			// console.debug("Diff canceled");
		} else {
			console.error(e);
		}
	}
	[ctx, _nextCtx] = [_nextCtx!, null];
	if (ctx) {
		return await runDiff(ctx);
	}
}

// #endregion


// ============================================================
// Histogram Algorithm
// 일단 지금은 이놈이 디폴트
// ============================================================
async function runHistogramDiff(ctx: WorkContext): Promise<DiffEntry[]> {
	const lhsTokens = ctx.leftTokens; // tokenize(ctx.leftText, ctx.options.tokenization);
	const rhsTokens = ctx.rightTokens; // tokenize(ctx.rightText, ctx.options.tokenization);
	// ctx.entries = [] as DiffEntry[];

	const leftAnchors: number[] = [];
	const rightAnchors: number[] = [];
	for (let i = 0; i < lhsTokens.length; i++) {
		if (lhsTokens[i].flags & TokenFlags.MANUAL_ANCHOR) {
			leftAnchors.push(i);
		}
	}
	if (leftAnchors.length > 0) {
		for (let i = 0; i < rhsTokens.length; i++) {
			if (rhsTokens[i].flags & TokenFlags.MANUAL_ANCHOR) {
				rightAnchors.push(i);
			}
		}
	}

	const matches: { lhsIndex: number; rhsIndex: number }[] = [];
	if (rightAnchors.length > 0) {
		let rightPos = 0;
		for (let l = 0; l < leftAnchors.length; l++) {
			const leftTokenIndex = leftAnchors[l];
			for (let r = rightPos; r < rightAnchors.length; r++) {
				const rightTokenIndex = rightAnchors[r];

				if (lhsTokens[leftTokenIndex].text === rhsTokens[rightTokenIndex].text) {
					matches.push({ lhsIndex: leftTokenIndex, rhsIndex: rightTokenIndex });
					rightPos = r + 1;
					break;
				}
			}
		}
	}

	let prevLhs = 0;
	let prevRhs = 0;
	for (const match of matches) {
		const lhsAnchor = match.lhsIndex;
		const rhsAnchor = match.rhsIndex;
		if (prevLhs < lhsAnchor || prevRhs < rhsAnchor) {
			// console.log("diffCore", {
			// 	lhsTokens,
			// 	lhsLower: prevLhs,
			// 	lhsUpper: lhsAnchor,
			// 	rhsTokens,
			// 	rhsLower: prevRhs,
			// 	rhsUpper: rhsAnchor,
			// });
			await diffCore(ctx, lhsTokens, prevLhs, lhsAnchor, rhsTokens, prevRhs, rhsAnchor, findBestHistogramAnchor);
		}
		ctx.entries.push({
			type: 0,
			left: {
				start: lhsAnchor,
				end: lhsAnchor + 1,
			},
			right: {
				start: rhsAnchor,
				end: rhsAnchor + 1,
			},
		});

		prevLhs = lhsAnchor + 1;
		prevRhs = rhsAnchor + 1;
	}

	if (prevLhs < lhsTokens.length || prevRhs < rhsTokens.length) {
		// console.log("diffCore", {
		// 	lhsTokens,
		// 	lhsLower: prevLhs,
		// 	lhsUpper: lhsTokens.length,
		// 	rhsTokens,
		// 	rhsLower: prevRhs,
		// 	rhsUpper: rhsTokens.length,
		// });
		await diffCore(ctx, lhsTokens, prevLhs, lhsTokens.length, rhsTokens, prevRhs, rhsTokens.length, findBestHistogramAnchor);
	}

	// const rawEntries = await diffCore(ctx, lhsTokens, 0, lhsTokens.length, rhsTokens, 0, rhsTokens.length, findBestHistogramAnchor);
	// return postProcess(ctx, rawEntries, lhsTokens, rhsTokens);
	return ctx.entries;
}

// histogram diff에서 가장 중요한 함수
// 얼마나 값어치 있는 공통 앵커를 찾느냐가 매우 중요하고 고로 그 값어치를 매기는 기준과 방법이 또 매우 중요함
// 여러가지 생각해볼 것들이 많지만...
const findBestHistogramAnchor: FindAnchorFunc = function (
	lhsTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rhsTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	ctx: WorkContext
): { lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number } | null {
	const diffOptions = ctx.options;
	const LENGTH_BIAS_FACTOR = diffOptions.lengthBiasFactor || 0.7; // 길이가 너무 크게 영향을 주는 경향이 있어서 이걸로 조절
	const UNIQUE_BONUS = 1 / (diffOptions.uniqueMultiplier || 1 / 0.5);
	const CONTAINER_START_BONUS = 1 / (diffOptions.containerStartMultiplier || 1 / 0.85);
	const CONTAINER_END_BONUS = 1 / (diffOptions.containerEndMultiplier || 1 / 0.8);
	const LINE_START_BONUS = 1 / (diffOptions.lineStartMultiplier || 1 / 0.85);
	const LINE_END_BONUS = 1 / (diffOptions.lineEndMultiplier || 1 / 0.9);
	const SECTION_HEADING_BONUS = 1 / (diffOptions.sectionHeadingMultiplier || 1 / 0.75);
	//const FULL_LINE_BONUS = 0.85; n그램을 사용시 여러단어가 매치되는 경우 오히려 마지막 단어가 다음 줄로 넘어가서 보너스를 못 받을 수가 있다

	const useLengthBias = !!diffOptions.useLengthBias;
	const maxGram = diffOptions.maxGram || 1;
	const compareSupSub = diffOptions.compareSupSub;
	const useMatchPrefix = diffOptions.ignoreWhitespace !== "normalize";
	const maxLen = useMatchPrefix ? Math.floor(maxGram * 1.5) : maxGram; //1=>1, 2=>3, 3=>4, 4=>6, 5=>7, 6=>9, 7=>10, 8=>12, 9=>13, 10=>15,...
	const delimiter = useMatchPrefix ? "" : "\u0000";

	const freq: Record<string, number> = {};
	for (let n = 1; n <= maxLen; n++) {
		OUTER: for (let i = lhsLower; i <= lhsUpper - n; i++) {
			let key = lhsTokens[i].text;
			if (lhsTokens[i].flags & TokenFlags.IMAGE) {
				continue;
			}
			// if (!(lhsTokens[i].flags & NO_JOIN)) {
			for (let k = 1; k < n; k++) {
				// if (lhsTokens[i + k].flags & NO_JOIN) {
				// 	failed = true;
				// 	break;
				// }
				// if ((lhsTokens[i + k - 1].flags & TokenFlags.HTML_SUPSUB) !== (lhsTokens[i + k].flags & TokenFlags.HTML_SUPSUB)) {
				// 	continue OUTER; // SUP/SUB가 중간에 바뀌면 N-그램으로 묶지 않음	
				// }
				if (lhsTokens[i + k].flags & TokenFlags.IMAGE) {
					continue OUTER;
				}
				key += delimiter + lhsTokens[i + k].text;
			}
			// } else {
			// 	failed = n > 1;
			// }
			// if (!failed) {
			freq[key] = (freq[key] || 0) + 1;
			// }
		}
		OUTER: for (let i = rhsLower; i <= rhsUpper - n; i++) {
			let key = rhsTokens[i].text;
			if (rhsTokens[i].flags & TokenFlags.IMAGE) {
				continue;
			}
			// if (!(rhsTokens[i].flags & NO_JOIN)) {
			for (let k = 1; k < n; k++) {
				// if (rhsTokens[i + k].flags & NO_JOIN) {
				// 	failed = true;
				// 	break;
				// }
				// if ((rhsTokens[i + k - 1].flags & TokenFlags.HTML_SUPSUB) !== (rhsTokens[i + k].flags & TokenFlags.HTML_SUPSUB)) {
				// 	continue OUTER; // SUP/SUB가 중간에 바뀌면 N-그램으로 묶지 않음
				// }
				if (rhsTokens[i + k].flags & TokenFlags.IMAGE) {
					continue OUTER;
				}
				key += delimiter + rhsTokens[i + k].text;
			}
			// } else {
			// 	failed = n > 1;
			// }
			// if (!failed) {
			freq[key] = (freq[key] || 0) + 1;
			// }
		}
	}

	let best: null | {
		lhsIndex: number;
		lhsLength: number;
		rhsIndex: number;
		rhsLength: number;
		score: number;
		// anchorText: string
	} = null;

	for (let i = lhsLower; i < lhsUpper; i++) {
		const ltext1 = lhsTokens[i].text;

		// 특수 케이스
		// 강제로 문서의 특정 지점끼리 매칭시킴. 문서 구조가 항상 내 맘 같은 것이 아니야. ㅠ
		// if (lhsTokens[i].flags & MANUAL_ANCHOR) {
		// 	for (let j = rhsLower; j < rhsUpper; j++) {
		// 		if (rhsTokens[j].text === ltext1) {
		// 			console.log("manual anchor", ltext1, i, j);
		// 			return {
		// 				lhsIndex: i,
		// 				lhsLength: 1,
		// 				rhsIndex: j,
		// 				rhsLength: 1,
		// 			};
		// 		}
		// 	}
		// }

		for (let j = rhsLower; j < rhsUpper; j++) {
			let li = i,
				ri = j;
			let lhsLen = 0,
				rhsLen = 0;
			let nGrams = 0;

			while (li < lhsUpper && ri < rhsUpper && lhsLen < maxLen && rhsLen < maxLen && nGrams < maxGram) {
				const ltext = lhsTokens[li].text;
				const rtext = rhsTokens[ri].text;

				let equal: boolean | null = null;
				if ((lhsTokens[li].flags & rhsTokens[ri].flags & TokenFlags.IMAGE)) {
					// 둘 다 이미지
					equal = compareImageTokens(lhsTokens[li], rhsTokens[ri], ctx);
					if (!equal) break;
				} else
					if ((lhsTokens[li].flags | rhsTokens[ri].flags) & TokenFlags.IMAGE) {
						break;
					} else if (compareSupSub && (lhsTokens[li].flags & TokenFlags.HTML_SUPSUB) !== (rhsTokens[ri].flags & TokenFlags.HTML_SUPSUB)) {
						break;
					} else if (ltext === rtext) {
						equal = true;
					}

				if (equal) {
					li++;
					ri++;
					lhsLen++;
					rhsLen++;
					nGrams++;
					continue;
				}

				if (useMatchPrefix &&
					ltext.length !== rtext.length && ltext[0] === rtext[0]
				) {
					const match = matchPrefixTokens(lhsTokens, li, lhsUpper, rhsTokens, ri, rhsUpper, diffOptions);
					if (match) {
						const matchedGrams = Math.min(match[0], match[1]);
						if (lhsLen + match[0] <= maxLen && rhsLen + match[1] <= maxLen && nGrams + matchedGrams <= maxGram) {
							li += match[0];
							ri += match[1];
							lhsLen += match[0];
							rhsLen += match[1];
							nGrams += matchedGrams;
							continue;
						}
					}
				}

				break;
			}

			if (lhsLen > 0 && rhsLen > 0) {
				let frequency: number;
				let len: number;
				// let anchorText: string;
				if (lhsLen === 1) {
					// anchorText = ltext1;
					frequency = freq[ltext1] || 1;
					len = ltext1.length;
					// score = freq[ltext1] || 1;
					// if (useLengthBias) {
					// 	score += 1 / (ltext1.length + 1);
					// }
				} else {
					let key = lhsTokens[i].text;
					len = key.length;
					for (let k = 1; k < lhsLen; k++) {
						const text = lhsTokens[i + k].text;
						key += delimiter + text;
						len += text.length;
					}
					// anchorText = key;
					frequency = freq[key] || 1;
					// score = (freq[key] || 1) / ((lhsLen + 1) * (len + 1));
					// score = (freq[key] || 1) / (lhsLen * len + 1);
					// score = (freq[key] || 1) / (len + 1);
				}

				let score = 0;
				score = useLengthBias ? frequency / (1 + Math.log(len + 1) * LENGTH_BIAS_FACTOR) : frequency;
				if (frequency === 1) {
					score *= UNIQUE_BONUS;
				}

				let boundaryBonus = 1;

				// if (boundaryBonus > CONTAINER_START_BONUS && lhsTokens[i].flags & rhsTokens[j].flags & CONTAINER_START) {
				// 	boundaryBonus = CONTAINER_START_BONUS;
				// }
				// if (boundaryBonus > CONTAINER_END_BONUS && lhsTokens[i + lhsLen - 1].flags & rhsTokens[j + rhsLen - 1].flags & CONTAINER_END) {
				// 	boundaryBonus = CONTAINER_END_BONUS;
				// }
				// if (boundaryBonus > LINE_START_BONUS && lhsTokens[i].flags & rhsTokens[j].flags & LINE_START) {
				// 	boundaryBonus = LINE_START_BONUS;
				// }
				// if (boundaryBonus > LINE_END_BONUS && lhsTokens[i + lhsLen - 1].flags & rhsTokens[j + rhsLen - 1].flags & LINE_END) {
				// 	boundaryBonus = LINE_END_BONUS;
				// }
				score *= boundaryBonus;

				// 사용 안하는 것이 낫다
				// 항번호만 바뀌는 경우(중간에 항 추가/삭제)에도 항 번호가 우선적으로 매치되어 버리기 때문.
				// if (lhsTokens[i].flags & rhsTokens[j].flags & (TokenFlags.SECTION_HEADING_MASK & ~TokenFlags.SECTION_HEADING_TYPE1)) {
				// 	// SECTION_HEADING_TYPE1 1., 2., 3., ...은 무시. 문서 구조가 영구일 때가 많음.
				// 	score *= SECTION_HEADING_BONUS;
				// }

				if (!best || score < best.score) {
					best = {
						lhsIndex: i,
						lhsLength: lhsLen,
						rhsIndex: j,
						rhsLength: rhsLen,
						score,
						// anchorText,
					};
				}
			}
		}
	}

	return best ?? null;
};

// ============================================================
// Helper functions
// ============================================================

// Divide and conquer!
// myers, histogram, patience 알고리즘에 공통으로 사용되는 재귀함수
// 1. 양 텍스트를 공통되는 부분(앵커)으로 분할
// 2. 분할된 영역에 대해서 재귀호출
async function diffCore(
	ctx: WorkContext,
	leftTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rightTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	findAnchor: FindAnchorFunc,
	consumeDirections: 0 | 1 | 2 | 3 = 3
): Promise<DiffEntry[]> {
	if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
		throw new Error("Invalid range");
	}

	// 사실 이걸 쓰면 리턴값이 필요 없는데...
	// 함수 시그니처를 고치기 귀찮아서 일단 내비둠.
	const entries: DiffEntry[] = ctx.entries;
	const diffOptions = ctx.options;

	const now = performance.now();
	if (now - ctx.lastYield > 100) {
		ctx.lastYield = now;
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (ctx.cancel) throw new Error("cancelled");
	}

	// TODO
	// 공통 부분을 스킵하는건데 문제는 여기에서 HEAD, TAIL을 스킵하고
	// 이후에 diffCore를 재귀적으로 호출할 때 앞쪽 절반에 대해서 HEAD부분, 뒤쪽 절반에 대해서 TAIL부분을 다시 한번 스킵을 시도하게 된다.
	// 더 이상 스킵할 게 없으니 결과에는 차이가 없겠지만 불필요한 시도를 안하는 쪽으로 개선해 볼 필요가 있음!
	// 생각해볼 것: 공통 prefix,suffix를 스킵하지 않았을 경우 스킵되지 않은 부분에서 더 나은 앵커가 나올 확률이 있다.
	// 그렇지만 스킵하지 않으면 성능 상 아주 큰 문제가 생김!
	let skippedHead: DiffEntry[];
	let skippedTail: DiffEntry[];
	[lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(
		leftTokens,
		rightTokens,
		lhsLower,
		lhsUpper,
		rhsLower,
		rhsUpper,
		ctx,
		//ctx.options.tokenization === "word" ? ctx.options.ignoreWhitespace : "normalize",
		consumeDirections
	);

	// 	entries.push(...skippedHead); 이렇게 넣으면 폭발함.
	for (const item of skippedHead) {
		entries.push(item);
	}

	// 양쪽 모두 남아있는 영역이 있는 경우 공통 앵커를 찾아본다!
	let anchor: null | { lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number } = null;
	if (
		lhsLower < lhsUpper &&
		rhsLower < rhsUpper &&
		(anchor = findAnchor(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx)) &&
		(anchor.lhsLength > 0 || anchor.rhsLength > 0) && // for safety! 적어도 한쪽이라도 영역을 줄여야 무한루프 안 생길 듯?
		anchor.lhsIndex >= lhsLower &&
		anchor.lhsIndex + anchor.lhsLength <= lhsUpper &&
		anchor.rhsIndex >= rhsLower &&
		anchor.rhsIndex + anchor.rhsLength <= rhsUpper
	) {
		// console.debug("anchor:", anchor, lhsLower, lhsUpper, rhsLower, rhsUpper);
		await diffCore(ctx, leftTokens, lhsLower, anchor.lhsIndex, rightTokens, rhsLower, anchor.rhsIndex, findAnchor, 2);

		// 의도적으로 앵커 영역까지 포함해서 호출함
		await diffCore(ctx, leftTokens, anchor.lhsIndex, lhsUpper, rightTokens, anchor.rhsIndex, rhsUpper, findAnchor, 1);
		// await diffCore(ctx, leftTokens, anchor.lhsIndex + anchor.lhsLength, lhsUpper, rightTokens, anchor.rhsIndex + anchor.rhsLength, rhsUpper, findAnchor, 1);
	} else {
		// 유효한 앵커는 못찾았지만 남아있는 토큰들이 있다면 diff로 처리
		if (lhsLower < lhsUpper || rhsLower < rhsUpper) {
			let type: DiffType = 0;
			if (lhsLower < lhsUpper) type |= 1;
			if (rhsLower < rhsUpper) type |= 2;

			entries.push({
				type: type as DiffType,
				left: {
					start: lhsLower,
					end: lhsUpper,
				},
				right: {
					start: rhsLower,
					end: rhsUpper,
				},
			});
		}
	}

	for (const item of skippedTail) {
		entries.push(item);
	}

	return entries;
}

// 공백을 완전히 무시하는 경우 "안녕 하세요" vs "안녕하세요"는 같다고 처리해야하지만
// 단어단위 토큰인 경우 토큰 대 토큰 비교는 실패할 수 밖에 없다.
// 따라서 각 토큰의 글자를 한땀한땀 매치시켜봐야하고 양쪽에서 토큰이 끝나는 시점까지 모든 글자가 매치되었다면
// 그 끝나는 시점까지의 토큰 수만큼 consume을 함.
function consumeCommonEdges(
	lhsTokens: Token[],
	rhsTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rhsLower: number,
	rhsUpper: number,
	ctx: WorkContext,
	consumeDirections: 0 | 1 | 2 | 3 = 3
): [lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number, head: DiffEntry[], tail: DiffEntry[]] {
	const diffOptions = ctx.options;
	const whitespace = diffOptions.ignoreWhitespace;
	const compareSupSub = diffOptions.compareSupSub;
	const head: DiffEntry[] = [];
	const tail: DiffEntry[] = [];
	let matchedCount;
	// Prefix
	if (consumeDirections & 1) {
		while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
			if (lhsTokens[lhsLower].flags & TokenFlags.IMAGE || rhsTokens[rhsLower].flags & TokenFlags.IMAGE) {
				if (lhsTokens[lhsLower].flags & rhsTokens[rhsLower].flags & TokenFlags.IMAGE) {
					if (compareImageTokens(lhsTokens[lhsLower], rhsTokens[rhsLower], ctx)) {
						head.push({
							type: 0,
							left: { start: lhsLower, end: lhsLower + 1 },
							right: { start: rhsLower, end: rhsLower + 1 },
						});
						lhsLower++;
						rhsLower++;
						continue;
					}
				}
				break;
			}

			if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text &&
				(!compareSupSub || (lhsTokens[lhsLower].flags & TokenFlags.HTML_SUPSUB) === (rhsTokens[rhsLower].flags & TokenFlags.HTML_SUPSUB))) {
				head.push({
					type: 0,
					left: { start: lhsLower, end: lhsLower + 1 },
					right: { start: rhsLower, end: rhsLower + 1 },
				});
				lhsLower++;
				rhsLower++;
			} else if (
				whitespace !== "normalize" &&
				lhsTokens[lhsLower].text.length !== rhsTokens[rhsLower].text.length &&
				lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] &&
				(matchedCount = matchPrefixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, diffOptions))
			) {
				head.push({
					type: 0,
					left: {
						start: lhsLower,
						end: lhsLower + matchedCount[0],
					},
					right: {
						start: rhsLower,
						end: rhsLower + matchedCount[1],
					},
				});
				lhsLower += matchedCount[0];
				rhsLower += matchedCount[1];
			} else {
				break;
			}
		}
	}

	// Suffix
	if (consumeDirections & 2) {
		while (lhsUpper > lhsLower && rhsUpper > rhsLower) {
			if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text &&
				(!compareSupSub || (lhsTokens[lhsUpper - 1].flags & TokenFlags.HTML_SUPSUB) === (rhsTokens[rhsUpper - 1].flags & TokenFlags.HTML_SUPSUB))) {
				tail.push({
					type: 0,
					left: { start: lhsUpper - 1, end: lhsUpper },
					right: { start: rhsUpper - 1, end: rhsUpper },
				});
				lhsUpper--;
				rhsUpper--;
			} else if (
				whitespace !== "normalize" &&
				lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length &&
				lhsTokens[lhsUpper - 1].text.at(-1) === rhsTokens[rhsUpper - 1].text.at(-1) &&
				(matchedCount = matchSuffixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, diffOptions))
			) {
				tail.push({
					type: 0,
					left: {
						start: lhsUpper - matchedCount[0],
						end: lhsUpper,
					},
					right: {
						start: rhsUpper - matchedCount[1],
						end: rhsUpper,
					},
				});
				lhsUpper -= matchedCount[0];
				rhsUpper -= matchedCount[1];
			} else {
				break;
			}
		}
		tail.reverse();
	}
	return [lhsLower, lhsUpper, rhsLower, rhsUpper, head, tail];
}

function matchPrefixTokens(
	leftTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rightTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	diffOptions: DiffOptions
	//allowJoinOnlyAtLineBoundary: boolean
): false | [leftMatched: number, rightMatched: number] {
	if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

	const compareSupSub = diffOptions.compareSupSub;
	const allowJoinOnlyAtLineBoundary = diffOptions.ignoreWhitespace === "onlyAtEdge";

	let i = lhsLower,
		j = rhsLower;
	let ci = 0,
		cj = 0;

	let lhsToken = leftTokens[i++],
		ltext = lhsToken.text,
		lhsLen = ltext.length;
	let rhsToken = rightTokens[j++],
		rtext = rhsToken.text,
		rhsLen = rtext.length;

	// if (lhsToken.flags & NO_JOIN_NEXT || rhsToken.flags & NO_JOIN_NEXT) {
	// 	// return false;
	// }

	if (compareSupSub && ((lhsToken.flags & TokenFlags.HTML_SUPSUB) !== (rhsToken.flags & TokenFlags.HTML_SUPSUB))) {
		return false;
	}

	while (true) {
		while (ci < lhsLen && cj < rhsLen) {
			if (ltext[ci++] !== rtext[cj++]) {
				return false;
			}
		}

		// 문자 불일치 없이 양쪽 토큰이 동시에 끝난 경우
		if (ci === lhsLen && cj === rhsLen) return [i - lhsLower, j - rhsLower];

		if (ci === lhsLen) {
			if (i === lhsUpper) return false;
			if (
				lhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
				(allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
			) {
				return false;
			}

			lhsToken = leftTokens[i++];
			if (!lhsToken) return false;
			if (compareSupSub && ((lhsToken.flags & TokenFlags.HTML_SUPSUB) !== (rhsToken.flags & TokenFlags.HTML_SUPSUB))) {
				return false;
			}
			if (lhsToken.flags & TokenFlags.IMAGE) {
				// 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
				return false;
			}
			if (
				lhsToken.flags & TokenFlags.NO_JOIN_PREV ||
				(allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
			) {
				return false;
			}

			ltext = lhsToken.text;
			lhsLen = ltext.length;
			ci = 0;
		}
		if (cj === rhsLen) {
			if (j === rhsUpper) return false;
			if (
				rhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
				(allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
			) {
				return false;
			}

			rhsToken = rightTokens[j++];
			if (!rhsToken) return false;
			if (compareSupSub && ((lhsToken.flags & TokenFlags.HTML_SUPSUB) !== (rhsToken.flags & TokenFlags.HTML_SUPSUB))) {
				return false;
			}
			if (rhsToken.flags & TokenFlags.IMAGE) {
				// 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
				return false;
			}
			if (
				rhsToken.flags & TokenFlags.NO_JOIN_PREV ||
				(allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
			) {
				return false;
			}

			rtext = rhsToken.text;
			rhsLen = rtext.length;
			cj = 0;
		}
	}
}

function matchSuffixTokens(
	leftTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rightTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	diffOptions: DiffOptions
): false | [leftMatched: number, rightMatched: number] {
	if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

	const allowJoinOnlyAtLineBoundary = diffOptions.ignoreWhitespace === "onlyAtEdge";
	const compareSupSub = diffOptions.compareSupSub;

	let i = lhsUpper - 1,
		j = rhsUpper - 1;

	let lhsToken = leftTokens[i--],
		ltext = lhsToken.text,
		rhsToken = rightTokens[j--],
		rtext = rhsToken.text;
	let ci = ltext.length - 1,
		cj = rtext.length - 1;

	// if (lhsToken.flags & NO_JOIN_PREV || rhsToken.flags & NO_JOIN_PREV) {
	// 	return false;
	// }

	if (compareSupSub && ((lhsToken.flags & TokenFlags.HTML_SUPSUB) !== (rhsToken.flags & TokenFlags.HTML_SUPSUB))) {
		return false;
	}

	while (true) {
		while (ci >= 0 && cj >= 0) {
			if (ltext[ci--] !== rtext[cj--]) {
				return false;
			}
		}
		if (ci < 0 && cj < 0) return [lhsUpper - i - 1, rhsUpper - j - 1];

		if (ci < 0) {
			if (i < lhsLower) return false;
			if (
				lhsToken.flags & TokenFlags.NO_JOIN_PREV ||
				(allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
			) {
				return false;
			}

			lhsToken = leftTokens[i--];
			if (!lhsToken) return false;
			if (compareSupSub && ((lhsToken.flags & TokenFlags.HTML_SUPSUB) !== (rhsToken.flags & TokenFlags.HTML_SUPSUB))) {
				return false;
			}
			if (lhsToken.flags & TokenFlags.IMAGE) {
				// 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
				return false;
			}
			if (
				lhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
				(allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
			) {
				return false;
			}

			ltext = lhsToken.text;
			ci = lhsToken.text.length - 1;
		}
		if (cj < 0) {
			if (j < rhsLower) return false;
			if (
				rhsToken.flags & TokenFlags.NO_JOIN_PREV ||
				(allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) // 줄바꿈 경계에서만 이어붙이기 허용
			) {
				return false;
			}

			rhsToken = rightTokens[j--];
			if (!rhsToken) return false;
			if (compareSupSub && ((lhsToken.flags & TokenFlags.HTML_SUPSUB) !== (rhsToken.flags & TokenFlags.HTML_SUPSUB))) {
				return false;
			}
			if (rhsToken.flags & TokenFlags.IMAGE) {
				// 한쪽은 텍스트가 안끝났고 다른 새로 시작하는 경우기 때문에 img가 나오는 경우 무조건 매치 실패
				return false;
			}
			if (
				rhsToken.flags & TokenFlags.NO_JOIN_NEXT ||
				(allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) // 줄바꿈 경계에서만 이어붙이기 허용
			) {
				return false;
			}

			rtext = rhsToken.text;
			cj = rhsToken.text.length - 1;
		}
	}
}

type FindAnchorFunc = (
	lhsTokens: Token[],
	lhsLower: number,
	lhsUpper: number,
	rhsTokens: Token[],
	rhsLower: number,
	rhsUpper: number,
	ctx: WorkContext
) => { lhsIndex: number; lhsLength: number; rhsIndex: number; rhsLength: number } | null;

function compareImageTokens(leftToken: Token, rightToken: Token, ctx: WorkContext): boolean {
	if (!(leftToken.flags & rightToken.flags & TokenFlags.IMAGE)) {
		return false;
	}

	if (leftToken.text === rightToken.text) {
		return true;
	}

	const diffOptions = ctx.options;
	// if (!diffOptions.compareImage) {
	// 	return false;
	// }

	const cacheKey = [leftToken.text, rightToken.text].sort().join("||");
	if (imageCompareCache[cacheKey] !== undefined) {
		return imageCompareCache[cacheKey];
	}



	let result: boolean | undefined = undefined;
	if (!leftToken.data || !rightToken.data) {
		result = false;
	} else {
		const width = leftToken.width!;
		const height = leftToken.height!;
		const leftArr = new Uint8ClampedArray(leftToken.data!);
		const rightArr = new Uint8ClampedArray(rightToken.data!);
		const diffCount = pixelmatch(leftArr, rightArr, void 0, width, height, { threshold: 0.1 });
		const similarity = ((width * height - diffCount) / (width * height)) * 100;
		result = similarity >= diffOptions.compareImageTolerance;
	}

	imageCompareCache[cacheKey] = result;
	return result;
}

