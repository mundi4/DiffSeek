const FALLBACK_DIFF_HUE = 30;

export function getDiffHue(diffIndex: number, diffHues: readonly number[]): number {
	if (diffHues.length === 0) {
		return FALLBACK_DIFF_HUE;
	}

	return diffHues[diffIndex % diffHues.length] ?? FALLBACK_DIFF_HUE;
}
