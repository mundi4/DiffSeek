const LINE_START = 1;
const LINE_END = 2;
const CONTAINER_START = 1 << 2;
const CONTAINER_END = 1 << 3;
const NO_JOIN = 1 << 4; // @@@, ### 등등
const WILD_CARD = 1 << 5;
const MANUAL_ANCHOR = 1 << 6; // 32. @@@, ### 등등
const IMAGE = 1 << 7;

const SECTION_HEADING_BIT = 10;
const SECTION_HEADING_TYPE1 = 1 << (SECTION_HEADING_BIT + 0); // 1.
const SECTION_HEADING_TYPE2 = 1 << (SECTION_HEADING_BIT + 1); // 가.
const SECTION_HEADING_TYPE3 = 1 << (SECTION_HEADING_BIT + 2); // (1)
const SECTION_HEADING_TYPE4 = 1 << (SECTION_HEADING_BIT + 3); // (가)
const SECTION_HEADING_TYPE5 = 1 << (SECTION_HEADING_BIT + 4); // 1)
const SECTION_HEADING_TYPE6 = 1 << (SECTION_HEADING_BIT + 5); // 가)

const LINE_BOUNDARY = LINE_START | LINE_END;
const CONTAINER_BOUNDARY = CONTAINER_START | CONTAINER_END;
const SECTION_HEADING_MASK =
	SECTION_HEADING_TYPE1 | SECTION_HEADING_TYPE2 | SECTION_HEADING_TYPE3 | SECTION_HEADING_TYPE4 | SECTION_HEADING_TYPE5 | SECTION_HEADING_TYPE6;
let _nextCtx: WorkContext | null = null;
let _currentCtx: WorkContext | null = null;

type WorkContext = {
	reqId: number;
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
	states: Record<string, any>;
};

self.onmessage = (e) => {
	if (e.data.type === "diff") {
		const request = e.data as DiffRequest;
		const ctx: WorkContext = {
			...request,
			cancel: false,
			start: 0,
			finish: 0,
			lastYield: 0,
			entries: [],
			states: {},
		};
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
		if (ctx.options.algorithm === "histogram") {
			result = await runHistogramDiff(ctx);
		} else if (ctx.options.algorithm === "lcs") {
			result = await runLcsDiff(ctx);
		} else {
			throw new Error("Unknown algorithm: " + ctx.options.algorithm);
		}
		ctx.finish = performance.now();
		_currentCtx = null;

		self.postMessage({
			reqId: ctx.reqId,
			type: "diff",
			processTime: ctx.finish - ctx.start,
			diffs: result,
		} as DiffResponse);
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

// =============================================================
// LCS Algorithm
// =============================================================

async function runLcsDiff(ctx: WorkContext): Promise<DiffEntry[]> {
	const lhsTokens = ctx.leftTokens; // tokenize(ctx.leftText, ctx.options.tokenization);
	const rhsTokens = ctx.rightTokens; // tokenize(ctx.rightText, ctx.options.tokenization);
	const rawResult = await computeDiff(lhsTokens, rhsTokens, !!ctx.options.greedyMatch, ctx);
	// return postProcess(ctx, rawResult, lhsTokens, rhsTokens);
	return rawResult;
}

async function computeLCS(leftTokens: Token[], rightTokens: Token[], ctx?: WorkContext) {
	const m = leftTokens.length;
	const n = rightTokens.length;

	const dp = new Array(m + 1);
	for (let i = 0; i <= m; i++) {
		dp[i] = new Array(n + 1).fill(0);
	}

	// 텍스트가 길어지는 경우(토큰이 많은 경우) 끔찍하게 많은 반복을 수행하게된다.
	for (let i = 1; i <= m; i++) {
		const leftText = leftTokens[i - 1].text;
		for (let j = 1; j <= n; j++) {
			// 주기적으로 yield 해서 취소요청을 받아야함.
			// performance.now()는 미친게 아닌가 싶을 정도로 무거운 함수이기 때문에 되도록 자제.
			// await new Promise(...) 역시 자주 사용하면 안됨
			// (i+j) % 0x4000 === 0 일 때만 사용하기로. 브라우저 js엔진의 비트연산 속도를 믿어본다 ㅋ
			if (ctx && ((i + j) & 16383) === 0) {
				const now = performance.now();
				if (now - ctx.lastYield > 50) {
					ctx.lastYield = now;
					await new Promise((resolve) => setTimeout(resolve, 0));
					if (ctx.cancel) {
						throw new Error("cancelled");
					}
				}
			}

			if (leftText === rightTokens[j - 1].text) {
				dp[i][j] = dp[i - 1][j - 1] + 1; // + consecutive[i][j];
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	let i = m;
	let j = n;
	const lcsIndices = [];
	while (i > 0 && j > 0) {
		if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
			lcsIndices.push({
				leftIndex: i - 1,
				rightIndex: j - 1,
			});
			i--;
			j--;
		} else if (dp[i - 1][j] >= dp[i][j - 1]) {
			i--;
		} else {
			j--;
		}
	}
	lcsIndices.reverse();
	return lcsIndices;
}

// 정들었던 diff 함수. 폐기처분 예정.
async function computeDiff(lhsTokens: Token[], rhsTokens: Token[], greedyMatch = false, ctx: WorkContext): Promise<DiffEntry[]> {
	const entries: DiffEntry[] = [];
	const lcs = await computeLCS(lhsTokens as Token[], rhsTokens as Token[], ctx);
	const lcsLength = lcs.length;
	const leftTokensLength = lhsTokens.length;
	const rightTokensLength = rhsTokens.length;

	if (leftTokensLength === 0 && rightTokensLength === 0) {
	} else if (leftTokensLength === 0) {
		entries.push({
			type: 2,
			left: {
				pos: 0,
				len: leftTokensLength,
				// empty: true,
			},
			right: {
				pos: 0,
				len: rightTokensLength,
			},
		});
	} else if (rightTokensLength === 0) {
		entries.push({
			type: 1,
			left: {
				pos: 0,
				len: leftTokensLength,
			},
			right: {
				pos: 0,
				len: rightTokensLength,
				// empty: true,
			},
		});
	} else {
		let i = 0;
		let j = 0;
		let lcsIndex = 0;
		let iteration = 0;

		while (lcsIndex < lcsLength || i < leftTokensLength || j < rightTokensLength) {
			if (ctx && (iteration & 1023) === 0) {
				const now = performance.now();
				if (now - ctx.lastYield > 100) {
					ctx.lastYield = now;
					await new Promise((resolve) => setTimeout(resolve, 0));
					if (ctx.cancel) {
						throw new Error("cancelled");
					}
				}
			}
			if (
				lcsIndex < lcsLength &&
				((greedyMatch &&
					lhsTokens[i].text === lhsTokens[lcs[lcsIndex].leftIndex].text &&
					rhsTokens[j].text === rhsTokens[lcs[lcsIndex].rightIndex].text) ||
					(i === lcs[lcsIndex].leftIndex && j === lcs[lcsIndex].rightIndex))
			) {
				entries.push({
					type: 0,
					left: {
						pos: i,
						len: 1,
					},
					right: {
						pos: j,
						len: 1,
					},
				});
				i++;
				j++;
				lcsIndex++;
				continue;
			}

			const lcsEntry = lcs[lcsIndex];
			while (
				i < leftTokensLength && // 유효한 토큰 index
				(!lcsEntry || // 공통 sequence가 없는 경우
					(!greedyMatch && i < lcsEntry.leftIndex) || // 정확한 lcsIndex에만 매칭시키는 경우
					lhsTokens[i].text !== lhsTokens[lcsEntry.leftIndex].text) // or 텍스트가 같으면 바로 중단
			) {
				entries.push({
					type: 1,
					left: {
						pos: i,
						len: 1,
					},
					right: {
						pos: j,
						len: 0,
					},
				});
				i++;
			}

			while (
				j < rightTokensLength && // 유효한 토큰 index
				(!lcsEntry || // 공통 sequence가 없는 경우
					(!greedyMatch && j < lcsEntry.rightIndex) || // 정확한 lcsIndex에만 매칭시키는 경우
					rhsTokens[j].text !== rhsTokens[lcsEntry.rightIndex].text) // or 텍스트가 같으면 바로 중단
			) {
				entries.push({
					type: 2,
					left: {
						pos: i,
						len: 0,
					},
					right: {
						pos: j,
						len: 1,
					},
				});
				j++;
			}
		}
	}
	return entries;
}

// ============================================================
// Histogram Algorithm
// 일단 지금은 이놈이 디폴트
// ============================================================
async function runHistogramDiff(ctx: WorkContext): Promise<DiffEntry[]> {
	const lhsTokens = ctx.leftTokens; // tokenize(ctx.leftText, ctx.options.tokenization);
	const rhsTokens = ctx.rightTokens; // tokenize(ctx.rightText, ctx.options.tokenization);
	// ctx.entries = [] as DiffEntry[];

	let leftAnchors: number[] = [];
	let rightAnchors: number[] = [];
	for (let i = 0; i < lhsTokens.length; i++) {
		if (lhsTokens[i].flags & MANUAL_ANCHOR) {
			leftAnchors.push(i);
		}
	}
	if (leftAnchors.length > 0) {
		for (let i = 0; i < rhsTokens.length; i++) {
			if (rhsTokens[i].flags & MANUAL_ANCHOR) {
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
				pos: lhsAnchor,
				len: 1,
			},
			right: {
				pos: rhsAnchor,
				len: 1,
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
	const LINE_START_BONUS = 1 / (diffOptions.lineStartMultiplier || 1 / 0.85);
	const LINE_END_BONUS = 1 / (diffOptions.lineEndMultiplier || 1 / 0.9);
	const SECTION_HEADING_BONUS = 1 / (diffOptions.sectionHeadingMultiplier || 1 / 0.75);
	//const FULL_LINE_BONUS = 0.85; n그램을 사용시 여러단어가 매치되는 경우 오히려 마지막 단어가 다음 줄로 넘어가서 보너스를 못 받을 수가 있다

	const useLengthBias = !!ctx.options.useLengthBias;
	const maxGram = ctx.options.maxGram || 1;
	const useMatchPrefix = ctx.options.whitespace === "ignore";
	const maxLen = useMatchPrefix ? Math.floor(maxGram * 1.5) : maxGram; //1=>1, 2=>3, 3=>4, 4=>6, 5=>7, 6=>9, 7=>10, 8=>12, 9=>13, 10=>15,...
	const delimiter = ctx.options.whitespace === "ignore" ? "" : "\u0000";

	const freq: Record<string, number> = {};
	for (let n = 1; n <= maxLen; n++) {
		for (let i = lhsLower; i <= lhsUpper - n; i++) {
			let key = lhsTokens[i].text;
			for (let k = 1; k < n; k++) {
				key += delimiter + lhsTokens[i + k].text;
			}
			freq[key] = (freq[key] || 0) + 1;
		}
		for (let i = rhsLower; i <= rhsUpper - n; i++) {
			let key = rhsTokens[i].text;
			for (let k = 1; k < n; k++) {
				key += delimiter + rhsTokens[i + k].text;
			}
			freq[key] = (freq[key] || 0) + 1;
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

				if (ltext === rtext) {
					// if (lhsTokens[li].flags & rhsTokens[ri].flags & MANUAL_ANCHOR) {
					// 	return {
					// 		lhsIndex: li,
					// 		lhsLength: 1,
					// 		rhsIndex: ri,
					// 		rhsLength: 1,
					// 	};
					// }
					li++;
					ri++;
					lhsLen++;
					rhsLen++;
					nGrams++;
					continue;
				}

				if (useMatchPrefix && ltext.length !== rtext.length && ltext[0] === rtext[0]) {
					const match = matchPrefixTokens(lhsTokens, li, lhsUpper, rhsTokens, ri, rhsUpper);
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

				if (lhsTokens[i].flags & rhsTokens[j].flags & LINE_START) {
					// if (lhsTokens[i + lhsLen - 1].flags & rhsTokens[j + rhsLen - 1].flags & LAST_OF_LINE) {
					// 	score *= FULL_LINE_BONUS;
					// } else {
					// }
					score *= LINE_START_BONUS;
				} else if (lhsTokens[i + lhsLen - 1].flags & rhsTokens[j + rhsLen - 1].flags & LINE_END) {
					score *= LINE_END_BONUS;
				}

				if (lhsTokens[i].flags & rhsTokens[j].flags & SECTION_HEADING_MASK) {
					// if ((lhsTokens[i].flags & SECTION_HEADING_MASK) !== 0) {
					// 	// LEVEL1은 무시. 문서 구조가 영구같은 경우가 많음.
					// } else {
					// }
					score *= SECTION_HEADING_BONUS;
				}

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
		ctx.options.tokenization === "word" ? ctx.options.whitespace : "normalize",
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
					pos: lhsLower,
					len: lhsUpper - lhsLower,
				},
				right: {
					pos: rhsLower,
					len: rhsUpper - rhsLower,
				},
			});
		}
	}

	for (const item of skippedTail) {
		entries.push(item);
	}

	return entries;
}

// function appendEqualEntriesFromAnchor(
// 	leftTokens: Token[],
// 	lhsIndex: number,
// 	lhsLength: number,
// 	rightTokens: Token[],
// 	rhsIndex: number,
// 	rhsLength: number,
// 	whitespace: WhitespaceHandling = "ignore",
// 	entries: DiffEntry[]
// ) {
// 	let li = lhsIndex;
// 	let ri = rhsIndex;

// 	while (li < lhsIndex + lhsLength && ri < rhsIndex + rhsLength) {
// 		const lt = leftTokens[li];
// 		const rt = rightTokens[ri];

// 		if (lt.text === rt.text) {
// 			entries.push({
// 				type: 0,
// 				left: { pos: li, len: 1 },
// 				right: { pos: ri, len: 1 },
// 			});
// 			li++;
// 			ri++;
// 		} else if (whitespace === "ignore" && lt.text.length !== rt.text.length && lt.text[0] === rt.text[0]) {
// 			// 1:N, N:1 or N:M → custom matching (e.g. matchPrefixTokens)
// 			const match = matchPrefixTokens(leftTokens, li, lhsIndex + lhsLength, rightTokens, ri, rhsIndex + rhsLength);
// 			if (!match) break;

// 			entries.push({
// 				type: 0,
// 				left: { pos: li, len: match[0] },
// 				right: { pos: ri, len: match[1] },
// 			});

// 			li += match[0];
// 			ri += match[1];
// 		} else {
// 			break;
// 		}
// 	}
// }

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
	whitespace: WhitespaceHandling = "ignore",
	consumeDirections: 0 | 1 | 2 | 3 = 3
): [lhsLower: number, lhsUpper: number, rhsLower: number, rhsUpper: number, head: DiffEntry[], tail: DiffEntry[]] {
	const head: DiffEntry[] = [];
	const tail: DiffEntry[] = [];
	let matchedCount;

	// Prefix
	if (consumeDirections & 1) {
		while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
			if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text) {
				head.push({
					type: 0,
					left: { pos: lhsLower, len: 1 },
					right: { pos: rhsLower, len: 1 },
				});
				lhsLower++;
				rhsLower++;
			} else if (
				whitespace === "ignore" &&
				lhsTokens[lhsLower].text.length !== rhsTokens[rhsLower].text.length &&
				lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] &&
				(matchedCount = matchPrefixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper))
			) {
				head.push({
					type: 0,
					left: {
						pos: lhsLower,
						len: matchedCount[0],
					},
					right: {
						pos: rhsLower,
						len: matchedCount[1],
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
			if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {
				tail.push({
					type: 0,
					left: { pos: lhsUpper - 1, len: 1 },
					right: { pos: rhsUpper - 1, len: 1 },
				});
				lhsUpper--;
				rhsUpper--;
			} else if (
				whitespace === "ignore" &&
				lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length &&
				lhsTokens[lhsUpper - 1].text.at(-1) === rhsTokens[rhsUpper - 1].text.at(-1) &&
				(matchedCount = matchSuffixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper))
			) {
				tail.push({
					type: 0,
					left: {
						pos: lhsUpper - matchedCount[0],
						len: matchedCount[0],
					},
					right: {
						pos: rhsUpper - matchedCount[1],
						len: matchedCount[1],
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
	rhsUpper: number
): false | [leftMatched: number, rightMatched: number] {
	if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

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
			if (lhsToken.flags & CONTAINER_END) return false;

			lhsToken = leftTokens[i++];
			if (!lhsToken || lhsToken.flags & CONTAINER_START) return false;

			ltext = lhsToken.text;
			lhsLen = ltext.length;
			ci = 0;
		}
		if (cj === rhsLen) {
			if (j === rhsUpper) return false;
			if (rhsToken.flags & CONTAINER_END) return false;

			rhsToken = rightTokens[j++];
			if (!rhsToken || rhsToken.flags & CONTAINER_START) return false;

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
	rhsUpper: number
): false | [leftMatched: number, rightMatched: number] {
	if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;

	let i = lhsUpper - 1,
		j = rhsUpper - 1;

	let lhsToken = leftTokens[i--],
		ltext = lhsToken.text,
		rhsToken = rightTokens[j--],
		rtext = rhsToken.text;
	let ci = ltext.length - 1,
		cj = rtext.length - 1;

	while(true) {
		while (ci >= 0 && cj >= 0) {
			if (ltext[ci--] !== rtext[cj--]) {
				return false;
			}
		}
		if (ci < 0 && cj < 0) return [lhsUpper - i - 1, rhsUpper - j - 1];

		if (ci < 0) {
			if (i < lhsLower) return false;
			if (lhsToken.flags & CONTAINER_START) return false;
			
			lhsToken = leftTokens[i--];
			if (lhsToken.flags & CONTAINER_END) return false;
			
			ltext = lhsToken.text;
			ci = lhsToken.text.length - 1;
		}
		if (cj < 0) {
			if (j < rhsLower) return false;
			if (rhsToken.flags & CONTAINER_START) return false;

			rhsToken = rightTokens[j--];
			if (rhsToken.flags & CONTAINER_END) return false;
			
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
