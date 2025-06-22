const enum RenderFlags {
	NONE = 0,
	DIFF = 1 << 0,
	GEOMETRY = 1 << 1,
	HIGHLIGHT_DIFF = 1 << 2,
	HIGHLIGHT_SELECTION = 1 << 3,
	//LAYOUT = 1 << 4,

	HIGHLIGHT = HIGHLIGHT_DIFF | HIGHLIGHT_SELECTION,
	SCROLL = DIFF | HIGHLIGHT,
	RESIZE = DIFF | HIGHLIGHT | GEOMETRY,
	ALL = DIFF | GEOMETRY | HIGHLIGHT,
	LEFT_REGION = 1 << 10,
	RIGHT_REGION = 1 << 11,
}

const DIFF_EXPAND_X = 2;
const DIFF_EXPAND_Y = 1;
const DIFF_LINE_EXPAND_Y = 0;
const DIFF_LINE_FILL_STYLE = "hsl(0 100% 95%)";
const DIFF_LINE_HEIGHT_MULTIPLIER = 1.4;
const SELECTION_HIGHLIGHT_FILL_STYLE = "rgba(128, 128, 128, 0.3)";

type DiffRenderItem = {
	diffIndex: number;
	range: Range;
	hue: number;
	geometry: RectSet | null;
};

type RendererCallbacks = {
	onRender: () => void;
	onDiffVisibilityChanged: (region: "left" | "right", entries: VisibilityChangeEntry[]) => void;
};

class Renderer {
	#container: HTMLElement;
	#canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#highlightCanvas: HTMLCanvasElement;
	#highlightCtx: CanvasRenderingContext2D;

	#leftRegion: RenderRegion;
	#rightRegion: RenderRegion;
	#canvasX: number = 0;
	#canvasY: number = 0;
	#canvasWidth: number = 0;
	#canvasHeight: number = 0;
	#callbacks: RendererCallbacks;
	#renderCallbackId: number | null = null;
	#layoutDirty: boolean = false;

	constructor(container: HTMLElement, leftRegion: EditorRegionInfo, rightRegion: EditorRegionInfo, callbacks: RendererCallbacks) {
		this.#container = container;
		this.#canvas = document.createElement("canvas");
		this.#ctx = this.#canvas.getContext("2d")!;
		container.appendChild(this.#canvas);

		this.#highlightCanvas = document.createElement("canvas");
		this.#highlightCtx = this.#highlightCanvas.getContext("2d")!;
		container.appendChild(this.#highlightCanvas);

		this.#callbacks = callbacks;
		this.#leftRegion = new RenderRegion("left", this, this.#ctx, this.#highlightCtx, leftRegion, callbacks);
		this.#rightRegion = new RenderRegion("right", this, this.#ctx, this.#highlightCtx, rightRegion, callbacks);
	}

	#updateLayout() {
		const { x, y, width, height } = this.#container.getBoundingClientRect();
		this.#canvasX = x;
		this.#canvasY = y;
		this.#canvasWidth = width;
		this.#canvasHeight = height;
		this.#canvas.width = width;
		this.#canvas.height = height;
		this.#highlightCanvas.width = width;
		this.#highlightCanvas.height = height;

		this.#leftRegion.updateLayout(this.#canvasX, this.#canvasY, this.#canvasWidth, this.#canvasHeight);
		this.#rightRegion.updateLayout(this.#canvasX, this.#canvasY, this.#canvasWidth, this.#canvasHeight);
	}

	#render() {
		if (this.#renderCallbackId !== null) {
			//console.log("already pending...");
			// Already pending
			// 가장 마지막에 실행되도록 기존 콜백을 취소하고 다시 등록하면 어떨까...?
			return;
		}

		this.#renderCallbackId = requestAnimationFrame(() => {
			this.#renderCallbackId = null;
			this.#doRender();
		});
	}

	#doRender() {
		//console.log("Rendering...");
		if (this.#layoutDirty) {
			this.#updateLayout();
			this.#layoutDirty = false;
		}

		this.#callbacks.onRender();

		// onRender() 콜백에서 invalidateLayout()을 호출이 될 수 있을까...? 지금은 아니지만...
		if (this.#layoutDirty) {
			this.#updateLayout();
			this.#layoutDirty = false;
		}

		this.#leftRegion.render();
		this.#rightRegion.render();
	}

	invalidateAll(skipRender: boolean = false) {
		this.#layoutDirty = true;
		this.#leftRegion.markDirty(RenderFlags.ALL);
		this.#rightRegion.markDirty(RenderFlags.ALL);
		if (!skipRender) {
			this.#render();
		}
	}

	invalidateLayout(skipRender: boolean = false) {
		this.#layoutDirty = true;
		if (!skipRender) {
			this.#render();
		}
	}

	invalidateGeometries(which?: "left" | "right", skipRender: boolean = false) {
		if (which === undefined) {
			this.#leftRegion.markDirty(RenderFlags.GEOMETRY);
			this.#rightRegion.markDirty(RenderFlags.GEOMETRY);
		} else {
			const region = which === "left" ? this.#leftRegion : this.#rightRegion;
			region.markDirty(RenderFlags.GEOMETRY);
		}
		if (!skipRender) {
			this.#render();
		}
	}

	invalidateScroll(which?: "left" | "right", skipRender: boolean = false) {
		if (which === undefined) {
			this.#leftRegion.markDirty(RenderFlags.SCROLL);
			this.#rightRegion.markDirty(RenderFlags.SCROLL);
		} else {
			const region = which === "left" ? this.#leftRegion : this.#rightRegion;
			region.markDirty(RenderFlags.SCROLL);
		}
		if (!skipRender) {
			this.#render();
		}
	}

	setDiffs(diffs: DiffItem[]) {
		const leftDiffs: DiffRenderItem[] = new Array(diffs.length);
		const rightDiffs: DiffRenderItem[] = new Array(diffs.length);

		for (let i = 0; i < diffs.length; i++) {
			const diff = diffs[i];
			const leftRange = diff.leftRange;
			const rightRange = diff.rightRange;

			leftDiffs[i] = {
				diffIndex: i,
				range: leftRange,
				hue: diff.hue,
				geometry: null,
			};
			rightDiffs[i] = {
				diffIndex: i,
				range: rightRange,
				hue: diff.hue,
				geometry: null,
			};
		}

		this.#leftRegion.setDiffs(leftDiffs);
		this.#rightRegion.setDiffs(rightDiffs);
	}

	setDiffHighlight(diffIndex: number | null) {
		const leftShouldRender = this.#leftRegion.setDiffHighlight(diffIndex);
		const rightShouldRender = this.#rightRegion.setDiffHighlight(diffIndex);
		if (leftShouldRender || rightShouldRender) {
			this.#render();
		}
	}

	setSelectionHighlight(which: "left" | "right", range: Range | null) {
		const region = which === "left" ? this.#leftRegion : this.#rightRegion;
		const regionOther = which === "left" ? this.#rightRegion : this.#leftRegion;
		const shouldRender = region.setSelectionHighlight(range);
		const shouldRenderOther = regionOther.setSelectionHighlight(null);
		if (shouldRender || shouldRenderOther) {
			this.#render();
		}
	}

	hitTest(x: number, y: number) {
		let region;
		if (x >= this.#rightRegion.regionX) {
			region = this.#rightRegion;
			x = x - this.#rightRegion.regionX;
		} else {
			region = this.#leftRegion;
			x = x - this.#leftRegion.regionX;
		}
		return region.hitTest(x, y);
	}

	getDiffRect(which: "left" | "right", diffIndex: number): Rect | null {
		const region = which === "left" ? this.#leftRegion : this.#rightRegion;
		return region.getDiffRect(diffIndex);
	}
}

class RenderRegion {
	#name: "left" | "right";
	#renderer: Renderer;
	#diffs: DiffRenderItem[] = [];
	#diffGeometries: RectSet[] = [];
	#diffLineRects: Rect[] = [];
	#selectionHighlight: Range | null = null;
	#selectionHighlightRects: RectSet | null = null;
	#dirtyFlags: RenderFlags = RenderFlags.NONE;
	#visibleDiffIndices: Set<number> = new Set();
	#ctx: CanvasRenderingContext2D;
	#highlightCtx: CanvasRenderingContext2D;
	#regionInfo: EditorRegionInfo;
	regionX: number = 0;
	regionY: number = 0;
	regionWidth: number = 0;
	regionHeight: number = 0;
	#highlightedDiffIndex: number | null = null;
	#callbacks: RendererCallbacks;

	constructor(
		name: "left" | "right",
		renderer: Renderer,
		ctx: CanvasRenderingContext2D,
		highlightCtx: CanvasRenderingContext2D,
		regionInfo: EditorRegionInfo,
		callbacks: RendererCallbacks
	) {
		this.#name = name;
		this.#renderer = renderer;
		this.#ctx = ctx;
		this.#highlightCtx = highlightCtx;
		this.#regionInfo = regionInfo;
		this.#callbacks = callbacks;
	}

	updateLayout(canvasX: number, canvasY: number, canvasWidth: number, canvasHeight: number) {
		const rect = this.#regionInfo.getBoundingClientRect();
		this.regionX = rect.x - canvasX;
		this.regionY = rect.y - canvasY;
		this.regionWidth = rect.width;
		this.regionHeight = rect.height;
		this.markDirty(RenderFlags.ALL);
	}

	get name() {
		return this.#name;
	}

	get diffs() {
		return this.#diffs;
	}

	get diffGeometries() {
		return this.#diffGeometries;
	}

	get diffLineRects() {
		return this.#diffLineRects;
	}

	get selectionHighlight() {
		return this.#selectionHighlight;
	}

	get selectionHighlightRects() {
		return this.#selectionHighlightRects;
	}

	get dirtyFlags() {
		return this.#dirtyFlags;
	}

	get visibleDiffIndices() {
		return this.#visibleDiffIndices;
	}

	markDirty(flags: RenderFlags) {
		this.#dirtyFlags |= flags;
	}

	setDiffs(diffs: DiffRenderItem[]) {
		this.#diffs = diffs;
		this.markDirty(RenderFlags.DIFF | RenderFlags.GEOMETRY);
		this.#visibleDiffIndices.clear();
		this.#selectionHighlight = null;
	}

	setDiffHighlight(diffIndex: number | null) {
		if (this.#highlightedDiffIndex === diffIndex) {
			return; // No change
		}
		// RECT는 필요 없음
		let prevShowing = this.#highlightedDiffIndex !== null && this.#visibleDiffIndices.has(this.#highlightedDiffIndex);
		this.#highlightedDiffIndex = diffIndex;
		let shouldShow = (diffIndex !== null && this.#visibleDiffIndices.has(diffIndex)) || (prevShowing && diffIndex === null);
		if (prevShowing || shouldShow) {
			this.markDirty(RenderFlags.HIGHLIGHT_DIFF);
			return true;
		} else {
			return false;
		}
	}

	setSelectionHighlight(range: Range | null) {
		const current = this.#selectionHighlight;
		if (current === range) {
			return false; // No change
		}
		if (
			current &&
			range &&
			current.startContainer === range.startContainer &&
			current.endContainer === range.endContainer &&
			current.startOffset === range.startOffset &&
			current.endOffset === range.endOffset
		) {
			return false; // No change in selection
		}

		this.#selectionHighlight = range;
		this.#selectionHighlightRects = null;
		this.markDirty(RenderFlags.HIGHLIGHT_SELECTION);
		return true;
	}

	render() {
		if (this.#dirtyFlags & RenderFlags.DIFF) {
			this.renderDiffs();
		}

		if (this.#dirtyFlags & RenderFlags.HIGHLIGHT) {
			this.renderHighlightLayer();
		}

		this.#dirtyFlags = RenderFlags.NONE;
	}

	renderDiffs() {
		this.#ctx.save();
		this.#ctx.translate(this.regionX, this.regionY);
		this.#ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);
		this.#ctx.rect(this.regionX, this.regionY, this.regionWidth, this.regionHeight);

		if (this.#dirtyFlags & RenderFlags.GEOMETRY) {
			this.buildDiffGeometries();
		}
		// console.log("Rendering diffs:", this.#diffs, this.#diffGeometries);

		const ctx = this.#ctx;
		const canvasWidth = this.regionWidth;
		const canvasHeight = this.regionHeight;
		const visibleDiffIndices = this.#visibleDiffIndices;
		const visChangeEntries: VisibilityChangeEntry[] = [];

		ctx.clearRect(this.regionX, this.regionY, canvasWidth, canvasHeight);

		let scrollTop = this.#regionInfo.scrollTop;
		let scrollLeft = 0;

		ctx.fillStyle = DIFF_LINE_FILL_STYLE;
		for (const rect of this.#diffLineRects) {
			const x = Math.floor(rect.x - scrollLeft),
				y = Math.floor(rect.y - scrollTop),
				width = Math.ceil(rect.width),
				height = Math.ceil(rect.height);

			if (y + height < 0) continue;
			if (y > canvasHeight) break;
			ctx.fillRect(x, y, width, height);
		}

		const visibleIndices: Set<number> = new Set();

		for (let diffIndex = 0; diffIndex < this.#diffGeometries.length; diffIndex++) {
			const geometry = this.#diffGeometries[diffIndex];

			let isVisible =
				!(geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > canvasHeight) &&
				!(geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > canvasWidth);

			if (isVisible) {
				visibleIndices.add(diffIndex);
				if (!visibleDiffIndices.has(diffIndex)) {
					visibleDiffIndices.add(diffIndex);
					visChangeEntries.push({ item: diffIndex, isVisible: true });
				}
			} else {
				if (visibleDiffIndices.has(diffIndex)) {
					visibleDiffIndices.delete(diffIndex);
					visChangeEntries.push({ item: diffIndex, isVisible: false });
				}
				continue;
			}

			ctx.fillStyle = geometry.fillStyle!;
			ctx.strokeStyle = geometry.strokeStyle!;

			for (const rect of geometry.rects) {
				const x = Math.floor(rect.x - scrollLeft),
					y = Math.floor(rect.y - scrollTop),
					width = Math.ceil(rect.width),
					height = Math.ceil(rect.height);

				if (y + height < 0 || y > canvasHeight) continue;
				if (x + width < 0 || x > canvasWidth) continue;

				// console.log("rendering rect:", x, y, width, height, "isVisible:", isVisible);
				ctx.fillRect(x, y, width, height);
				ctx.strokeRect(x, y, width, height);
			}
		}

		if (visChangeEntries.length > 0) {
			this.#callbacks.onDiffVisibilityChanged(this.#name, visChangeEntries);
		}

		//this.#shouldClearCanvas = renderedAny;
		this.#ctx.restore();
	}

	renderHighlightLayer() {
		const ctx = this.#highlightCtx;
		const canvasWidth = this.regionWidth;
		const canvasHeight = this.regionHeight;
		const scrollTop = this.#regionInfo.scrollTop;
		const scrollLeft = 0;

		this.#highlightCtx.save();
		this.#highlightCtx.translate(this.regionX, this.regionY);
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);
		if (this.#highlightedDiffIndex !== null) {
			// console.log("Rendering highlighted diff index:", this.#highlightedDiffIndex);
			const diff = this.#diffs[this.#highlightedDiffIndex];
			const rects = this.#diffGeometries[this.#highlightedDiffIndex];
			if (rects) {
				let isVisible =
					!(rects.maxY - scrollTop < 0 || rects.minY - scrollTop > canvasHeight) &&
					!(rects.maxX - scrollLeft < 0 || rects.minX - scrollLeft > canvasWidth);
				if (!isVisible) {
					return;
				}

				ctx.lineWidth = 2;
				ctx.fillStyle = `hsl(0 100% 80%)`;
				ctx.strokeStyle = `hsl(0 100% 50% / 0.5)`;
				// ctx.strokeStyle = `hsl(${diff.hue} 100% 50% / 0.5)`;

				for (const rect of rects.rects) {
					const x = Math.floor(rect.x - scrollLeft) - 1,
						y = Math.floor(rect.y - scrollTop) - 1,
						width = Math.ceil(rect.width),
						height = Math.ceil(rect.height);

					if (y + height < 0 || y > canvasHeight) continue;
					if (x + width < 0 || x > canvasWidth) continue;

					ctx.strokeRect(x, y, width, height);
					ctx.fillRect(x, y, width, height);

					// ctx.lineWidth = 2;
					// ctx.strokeStyle = "white";
					// ctx.shadowBlur = 0;
					// ctx.shadowColor = "transparent";
					// ctx.strokeRect(x-1, y-1, width + 2, height + 2);
				}
			}
			ctx.lineWidth = 1;
			// ctx.shadowBlur = 0;
			// ctx.strokeStyle = "transparent";
		}

		if (this.#selectionHighlight) {
			if (!this.#selectionHighlightRects || this.#dirtyFlags & RenderFlags.GEOMETRY) {
				let start = performance.now();
				const offsetX = -this.regionX + scrollLeft;
				const offsetY = -this.regionY + scrollTop;

				const rawRects = extractRects(this.#selectionHighlight);

				let end = performance.now();
				start = end;

				const mergedRect = mergeRects(rawRects, 1, 1) as RectSet;
				for (const rect of mergedRect.rects) {
					rect.x += offsetX;
					rect.y += offsetY;
				}
				mergedRect.minX += offsetX;
				mergedRect.minY += offsetY;
				mergedRect.maxX += offsetX;
				mergedRect.maxY += offsetY;
				mergedRect.fillStyle = SELECTION_HIGHLIGHT_FILL_STYLE;
				mergedRect.strokeStyle = null;

				this.#selectionHighlightRects = mergedRect;
				// console.log("Extracted selection highlight rects in", performance.now() - start, "ms");
			}
			let geometry = this.#selectionHighlightRects;

			let isVisible =
				!(geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > canvasHeight) &&
				!(geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > canvasWidth);
			if (!isVisible) {
				return;
			}

			ctx.fillStyle = geometry.fillStyle!;
			for (const rect of geometry.rects) {
				const x = Math.floor(rect.x - scrollLeft),
					y = Math.floor(rect.y - scrollTop),
					width = Math.ceil(rect.width),
					height = Math.ceil(rect.height);

				if (y + height < 0) continue;
				if (y > canvasHeight) break;

				ctx.fillRect(x, y, width, height);
			}
		}

		this.#highlightCtx.restore();
	}

	buildDiffGeometries() {
		const scrollTop = this.#regionInfo.scrollTop;
		const offsetX = -this.regionX;
		const offsetY = -this.regionY + scrollTop;

		//void this.#container.offsetWidth; // force reflow

		const allDiffRects: Rect[] = [];
		this.#diffGeometries.length = this.#diffs.length;

		for (let diffIndex = 0; diffIndex < this.#diffs.length; diffIndex++) {
			const item = this.#diffs[diffIndex];
			const range = item.range;
			const rawRects = extractRects(range, true);
			for (const rect of rawRects) {
				rect.x += offsetX - DIFF_EXPAND_X;
				rect.y += offsetY - DIFF_EXPAND_Y;
				rect.width += DIFF_EXPAND_X * 2;
				rect.height += DIFF_EXPAND_Y * 2;
				allDiffRects.push(rect);
			}
			const mergedRects = mergeRects(rawRects, 1, 1) as RectSet;
			mergedRects.fillStyle = `hsl(${item.hue} 100% 80%)`;
			mergedRects.strokeStyle = `hsl(${item.hue} 100% 40% / 0.5)`;
			this.#diffGeometries[diffIndex] = mergedRects;
			item.geometry = mergedRects;
		}

		this.buildDiffLineRects(allDiffRects);
	}

	buildDiffLineRects(diffRects: Rect[]) {
		const TOLERANCE = 1;

		const lineRects: Rect[] = [];

		diffRects.sort((a, b) => a.y - b.y);
		const rects: Rect[] = [];

		const canvasWidth = this.regionWidth;
		let lineRect: Rect | null = null;
		for (const rect of diffRects) {
			const height = rect.height * DIFF_LINE_HEIGHT_MULTIPLIER + DIFF_LINE_EXPAND_Y * 2;
			const heightDelta = height - rect.height;
			const y = rect.y - DIFF_LINE_EXPAND_Y - heightDelta / 2;
			if (lineRect === null || y > lineRect.y + lineRect.height) {
				lineRect = {
					x: 0,
					y: y,
					width: canvasWidth,
					height: height,
				};
				rects.push(lineRect);
			} else {
				lineRect.height = y + height - lineRect.y;
			}
		}

		if (rects.length > 0) {
			let current = rects[0];

			for (let i = 1; i < rects.length; i++) {
				const next = rects[i];

				const currentBottom = current.y + current.height;
				const nextTop = next.y;
				const gap = nextTop - currentBottom;

				if (gap <= TOLERANCE) {
					const newBottom = Math.max(currentBottom, next.y + next.height);
					current = {
						x: current.x,
						y: current.y,
						width: current.width,
						height: newBottom - current.y,
					};
				} else {
					// 병합 불가: 현재까지 병합된 것 push
					lineRects.push(current);
					current = next;
				}
			}
			lineRects.push(current);
		}

		this.#diffLineRects = lineRects;
	}

	hitTest(x: number, y: number) {
		if (this.#dirtyFlags & (RenderFlags.GEOMETRY | RenderFlags.DIFF)) {
			return null;
		}

		y += this.#regionInfo.scrollTop;
		for (const diffIndex of this.#visibleDiffIndices) {
			const geometry = this.#diffGeometries[diffIndex];
			if (geometry) {
				for (const rect of geometry.rects) {
					if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
						return diffIndex;
					}
				}
			}
		}

		return null;
	}

	getDiffAtPoint(x: number, y: number): number | null {
		// console.log("Getting diff at point:", x, y);
		for (const diffIndex of this.#visibleDiffIndices) {
			// console.log("Checking diff index:", diffIndex, "at point:", x, y);
			const geometry = this.#diffGeometries[diffIndex];
			// console.log("Geometry for diff index:", diffIndex, "is", geometry);
			for (const rect of geometry.rects) {
				// console.log("Checking rect:", rect, "at point:", x, y);
				if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
					// console.log("Found diff at index:", diffIndex);
					return diffIndex;
				}
			}
		}
		return null;
	}

	getDiffRect(diffIndex: number): Rect | null {
		const geometry = this.#diffGeometries[diffIndex];
		if (geometry) {
			return {
				x: geometry.minX,
				y: geometry.minY,
				width: geometry.maxX - geometry.minX,
				height: geometry.maxY - geometry.minY,
			};
		}
		return null;
	}
}
