import { tokenizeByChar } from "../core/tokenization/tokenizeByChar";

export type QuickDiffResult = {
	diffs: RawDiff[];
	processTime: number;
};

export type QuickDiffOptions = {
	greedyMatch?: boolean;
};

export function quickDiff(leftText: string, rightText: string, options: QuickDiffOptions): RawDiff[] {
	const A = tokenizeByChar(leftText, options);
	const B = tokenizeByChar(rightText, options);

	const dp: number[][] = Array(A.length + 1)
		.fill(null)
		.map(() => Array(B.length + 1).fill(0));

	// LCS 계산 (동적 계획법)
	for (let i = A.length - 1; i >= 0; i--) {
		for (let j = B.length - 1; j >= 0; j--) {
			if (A[i].char === B[j].char) {
				dp[i][j] = dp[i + 1][j + 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
			}
		}
	}

	let i = 0,
		j = 0;
	const diffs: RawDiff[] = [];

	// diff 결과 생성
	while (i < A.length || j < B.length) {
		if (i < A.length && j < B.length && A[i].char === B[j].char) {
			diffs.push({
				type: 0,
				left: { start: A[i].index, end: A[i].index + A[i].count }, // `index`는 이제 실제 문자열의 인덱스
				right: { start: B[j].index, end: B[j].index + B[j].count },
			});
			i++;
			j++;
		} else if (i < A.length && (j >= B.length || dp[i + 1][j] >= dp[i][j + 1])) {
			diffs.push({
				type: 1,
				left: { start: A[i].index, end: A[i].index + A[i].count }, // `index`는 이제 실제 문자열의 인덱스
				right: null!, //{ start: B[j].index, end: B[j].index }, // `index`는 그대로 사용
			});
			i++;
		} else if (j < B.length) {
			diffs.push({
				type: 2,
				left: null!, //{ start: A[i].index, end: A[i].index }, // `index`는 그대로 사용
				right: { start: B[j].index, end: B[j].index + B[j].count }, // `index`는 그대로 사용
			});
			j++;
		}
	}

	return diffs;
}

let ricId: number | null = null;
export function requestQuickDiff(leftText: string, rightText: string, options: QuickDiffOptions = {}, onComplete: (result: RawDiff[]) => void) {
	if (ricId !== null) {
		cancelIdleCallback(ricId);
	}

	ricId = requestIdleCallback(() => {
		const result = quickDiff(leftText, rightText, options);
		onComplete(result);
		ricId = null;
	});
}
