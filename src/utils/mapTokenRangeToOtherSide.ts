export function mapTokenRangeToOtherSide(rawEntries: RawDiff[], side: "left" | "right", startIndex: number, endIndex: number): [number, number, boolean] {
	// console.log("mapTokenRangeToOtherSide", { rawEntries, side, startIndex, endIndex });
	const otherSide = side === "left" ? "right" : "left";
	let low = 0;
	let high = rawEntries.length - 1;
	let mappedStart = -1;
	let mappedEnd = -1;
	let hasDiff = false;
	let firstEntryIndex = -1;
	let lastEntryIndex = -1;

	while (low <= high) {
		const mid = (low + high) >> 1;
		const s = rawEntries[mid][side];
		if (startIndex < s.start) {
			high = mid - 1;
		} else if (startIndex >= s.end) {
			low = mid + 1;
		} else {
			mappedStart = rawEntries[mid][otherSide].start;
			if (endIndex <= s.end) {
				mappedEnd = rawEntries[mid][otherSide].end;
			}
			if (!hasDiff && rawEntries[mid].type !== 0) {
				hasDiff = true;
			}
			// if (rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len < endIndex) {
			// 	mappedEnd = rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len;
			// }
			firstEntryIndex = low = mid; // reuse for mappedEnd search
			break;
		}
	}

	if (mappedStart >= 0 && mappedEnd === -1) {
		mappedEnd = mappedStart;
		high = rawEntries.length - 1;
		while (low <= high) {
			const mid = (low + high) >> 1;
			const s = rawEntries[mid][side];
			if (endIndex - 1 < s.start) {
				high = mid - 1;
			} else if (endIndex - 1 >= s.end) {
				low = mid + 1;
			} else {
				mappedEnd = rawEntries[mid][otherSide].end;
				lastEntryIndex = mid;
				if (!hasDiff && rawEntries[mid].type !== 0) {
					hasDiff = true;
				}
				break;
			}
		}
	}

	// fallback: linear scan for overlaps
	if (!hasDiff && firstEntryIndex >= 0 && lastEntryIndex >= 0) {
		for (let i = firstEntryIndex; i <= lastEntryIndex; i++) {
			if (rawEntries[i].type !== 0) {
				hasDiff = true;
				break;
			}
		}
	}

	// console.warn("mapTokenRangeToOtherSide result", { mappedStart, mappedEnd });
	return [mappedStart, mappedEnd, hasDiff];
}
