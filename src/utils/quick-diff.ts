import { tokenizeByChar } from "../core/tokenization/tokenizeByChar";

export type QuickDiffResult = {
	diffs: DiffEntry[];
	processTime: number;
};

export type QuickDiffOptions = {
	greedyMatch?: boolean;
};

export function createQuickDiff() {
  let ricId: number | null = null;

  function quickDiff(leftText: string, rightText: string, options: QuickDiffOptions): DiffEntry[] {
    const A = tokenizeByChar(leftText, options);
    const B = tokenizeByChar(rightText, options);

    const dp: number[][] = Array(A.length + 1)
      .fill(null)
      .map(() => Array(B.length + 1).fill(0));

    // LCS 계산
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
    const diffs: DiffEntry[] = [];

    // diff 결과 생성
    while (i < A.length || j < B.length) {
      if (i < A.length && j < B.length && A[i].char === B[j].char) {
        diffs.push({
          type: 0,
          left: { start: A[i].index, end: A[i].index + A[i].count },
          right: { start: B[j].index, end: B[j].index + B[j].count },
        });
        i++;
        j++;
      } else if (i < A.length && (j >= B.length || dp[i + 1][j] >= dp[i][j + 1])) {
        diffs.push({
          type: 1,
          left: { start: A[i].index, end: A[i].index + A[i].count },
          right: null!,
        });
        i++;
      } else if (j < B.length) {
        diffs.push({
          type: 2,
          left: null!,
          right: { start: B[j].index, end: B[j].index + B[j].count },
        });
        j++;
      }
    }

    return diffs;
  }

  function requestQuickDiff(
    leftText: string,
    rightText: string,
    options: QuickDiffOptions = {},
    onComplete: (result: DiffEntry[]) => void
  ) {
    if (ricId !== null) {
      cancelIdleCallback(ricId);
    }
    ricId = requestIdleCallback(() => {
      const result = quickDiff(leftText, rightText, options);
      onComplete(result);
      ricId = null;
    });
  }

  function cancel() {
    if (ricId !== null) {
      cancelIdleCallback(ricId);
      ricId = null;
    }
  }

  return {
    quickDiff,
    requestQuickDiff,
    cancel,
  };
}