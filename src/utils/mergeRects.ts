
export function mergeRects(rects: Rect[], toleranceX: number = 0, toleranceY: number = 0): { minX: number; minY: number; maxX: number; maxY: number; rects: Rect[] } {
	rects.sort((a, b) => a.y - b.y || a.x - b.x);

	const merged: Rect[] = [];
	const used = new Array(rects.length).fill(false);

	let minX = Number.MAX_SAFE_INTEGER;
	let minY = Number.MAX_SAFE_INTEGER;
	let maxX = 0;
	let maxY = 0;

	for (let i = 0; i < rects.length; i++) {
		if (used[i]) continue;
		let base = rects[i];

		for (let j = i + 1; j < rects.length; j++) {
			if (used[j]) continue;
			const compare = rects[j];

			// 세로 위치/높이 거의 같아야 병합 대상이 됨
			const sameY = Math.abs(base.y - compare.y) <= toleranceY && Math.abs(base.height - compare.height) <= toleranceY;

			if (!sameY) continue;

			// x축 겹치거나 toleranceX 이내
			const baseRight = base.x + base.width;
			const compareRight = compare.x + compare.width;
			const xOverlapOrClose = baseRight >= compare.x - toleranceX && compareRight >= base.x - toleranceX;

			if (xOverlapOrClose) {
				const newX = Math.min(base.x, compare.x);
				const newRight = Math.max(baseRight, compareRight);
				base = {
					x: newX,
					y: Math.min(base.y, compare.y),
					width: newRight - newX,
					height: Math.max(base.height, compare.height),
				};
				used[j] = true;
			}
		}

		merged.push(base);
		used[i] = true;

		minX = Math.min(minX, base.x);
		minY = Math.min(minY, base.y);
		maxX = Math.max(maxX, base.x + base.width);
		maxY = Math.max(maxY, base.y + base.height);
	}

	return {
		minX,
		minY,
		maxX,
		maxY,
		rects: merged,
	};
}
