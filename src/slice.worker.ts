type CharToken = {
	char: string;
	index: number;
	count: number;
};

type SliceDiffRequest =
	| {
			type: "slice";
			reqId: number;
			leftText: string;
			rightText: string;
			options?: SliceDiffOptions;
	  }
	| {
			type: "init";
			normalizedCharMap: Record<number, number>;
	  };

type SliceDiffResponse = {
	type: "slice";
	reqId: number;
	diffs: SliceDiffEntry[];
	processTime: number;
};

type SliceDiffEntry = {
	type: 0 | 1 | 2; // 0: equal, 1: removed, 2: inserted
	left?: {
		index: number;
		count: number;
	};
	right?: {
		index: number;
		count: number;
	};
};

type SliceDiffOptions = {
	greedyMatch?: boolean;
};

type SliceDiffWorkContext = {
	reqId: number;
	options: SliceDiffOptions;
	cancel?: boolean;
};

let currentReqId = -1;
let _normalizedCharMap: Record<number, number> = {};

onmessage = (e: MessageEvent) => {
	const req = e.data as SliceDiffRequest;

	if (req.type === "init") {
		_normalizedCharMap = req.normalizedCharMap;
		return;
	}

	if (req.type !== "slice") return;

	currentReqId = req.reqId;

	setTimeout(() => {
		if (req.reqId !== currentReqId) return;

		const t0 = performance.now();
		const diffs = computeSliceDiff(req.leftText, req.rightText, req.options || {});
		const t1 = performance.now();

		const response: SliceDiffResponse = {
			reqId: req.reqId,
			type: "slice",
			diffs,
			processTime: t1 - t0,
		};

		postMessage(response);
	}, 0);
};

function tokenizeChars(text: string, options: SliceDiffOptions): CharToken[] {
	const tokens: CharToken[] = [];
	let i = 0;
	while (i < text.length) {
		const charCode = text.codePointAt(i)!;
		const normCode = _normalizedCharMap[charCode] ?? charCode;

		if (charCode === undefined) {
			throw new Error(`Invalid character at index ${i}`);
		}
		const count = charCode > 0xffff ? 2 : 1;
		tokens.push({
			char: String.fromCodePoint(normCode),
			count: count,
			index: i,
		});

		i += count;
	}
	return tokens;
}

function computeSliceDiff(leftText: string, rightText: string, options: SliceDiffOptions): SliceDiffEntry[] {
	const A = tokenizeChars(leftText, options);
	const B = tokenizeChars(rightText, options);

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
	const diffs: SliceDiffEntry[] = [];

	// diff 결과 생성
	while (i < A.length || j < B.length) {
		if (i < A.length && j < B.length && A[i].char === B[j].char) {
			diffs.push({
				type: 0,
				left: { index: A[i].index, count: A[i].count }, // `index`는 이제 실제 문자열의 인덱스
				right: { index: B[j].index, count: B[j].count },
			});
			i++;
			j++;
		} else if (i < A.length && (j >= B.length || dp[i + 1][j] >= dp[i][j + 1])) {
			diffs.push({
				type: 1,
				left: { index: A[i].index, count: A[i].count }, // `index`는 그대로 사용
			});
			i++;
		} else if (j < B.length) {
			diffs.push({
				type: 2,
				right: { index: B[j].index, count: B[j].count }, // `index`는 그대로 사용
			});
			j++;
		}
	}

	return diffs;
}
