export function clampRange(range: Range, startAfter: HTMLElement | null, endBefore: HTMLElement | null): Range {
	try {
		if (startAfter && range.comparePoint(startAfter, 0) >= 0) {
			range.setStartAfter(startAfter);
		}
	} catch (e) {
		//console.warn("modifyRange 실패", e);
	}
	try {
		if (endBefore && range.comparePoint(endBefore, 0) <= 0) {
			range.setEndBefore(endBefore);
		}
	} catch (e) {
		//console.warn("modifyRange 실패", e);
	}
	return range;
}