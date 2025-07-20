type CharToken = {
    char: string;         // 실제 보이는 문자
    norm?: string;        // 비교용 (소문자화, 공백제거 등 적용)
};

type SliceDiffRequest = {
    type: "slice";
    reqId: number;
    leftText: string;
    rightText: string;
    options?: SliceDiffOptions;
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

onmessage = (e: MessageEvent) => {
    const req = e.data as SliceDiffRequest;
    if (req.type !== "slice") return;

    currentReqId = req.reqId;

    setTimeout(() => {
        if (req.reqId !== currentReqId) return; // 뒤늦게 도착한 응답 무시

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
    }, 0); // 비동기로 실행해서 요청 연속 처리 시 취소 타이밍 보장
};


function tokenizeChars(text: string, options: SliceDiffOptions): CharToken[] {
    const tokens: CharToken[] = [];
    for (const char of text) {
        //if (options.ignoreWhitespace && /\s/.test(char)) continue;
        //const norm = options.ignoreCase ? char.toLowerCase() : char;
        tokens.push({ char, norm: char });
    }
    return tokens;
}

function computeSliceDiff(leftText: string, rightText: string, options: SliceDiffOptions): SliceDiffEntry[] {
	const A = tokenizeChars(leftText, options);
	const B = tokenizeChars(rightText, options);

	const dp: number[][] = Array(A.length + 1).fill(null).map(() => Array(B.length + 1).fill(0));

	for (let i = A.length - 1; i >= 0; i--) {
		for (let j = B.length - 1; j >= 0; j--) {
			if (A[i].norm === B[j].norm) {
				dp[i][j] = dp[i + 1][j + 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
			}
		}
	}

	let i = 0, j = 0;
	const diffs: SliceDiffEntry[] = [];

	while (i < A.length || j < B.length) {
		if (i < A.length && j < B.length && A[i].norm === B[j].norm) {
			diffs.push({
				type: 0,
				left: { index: i, count: 1 },
				right: { index: j, count: 1 }
			});
			i++;
			j++;
		}
		else if (i < A.length && (j >= B.length || dp[i + 1][j] >= dp[i][j + 1])) {
			diffs.push({
				type: 1,
				left: { index: i, count: 1 }
			});
			i++;
		}
		else if (j < B.length) {
			diffs.push({
				type: 2,
				right: { index: j, count: 1 }
			});
			j++;
		}
	}

	return diffs;
}
