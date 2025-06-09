const enum RenderFlags {
	NONE = 0,
	DIFF = 1 << 0,
	GEOMETRY = 1 << 1,
	HIGHLIGHT_DIFF = 1 << 2,
	HIGHLIGHT_SELECTION = 1 << 3,
	HIGHLIGHT = HIGHLIGHT_DIFF | HIGHLIGHT_SELECTION,
	SCROLL = DIFF | HIGHLIGHT,
	RESIZE = DIFF | HIGHLIGHT | GEOMETRY,
	ALL = DIFF | GEOMETRY | HIGHLIGHT,
}

const DIFF_EXPAND_X = 2;
const DIFF_EXPAND_Y = 0;
const DIFF_LINE_EXPAND_Y = 0;
const DIFF_LINE_FILL_STYLE = "hsl(0 100% 95%)";
const DIFF_LINE_HEIGHT_MULTIPLIER = 1.1;
const SELECTION_HIGHLIGHT_FILL_STYLE = "rgba(128, 128, 128, 0.3)";

type RendererCallbacks = {
	diffVisibilityChanged: (entries: VisibilityChangeEntry[]) => void;
};

type DiffRenderItem = {
	diffIndex: number;
	range: Range;
	hue: number;
	geometry: RectSet | null;
};

class Renderer {
	#container: HTMLElement;
	#editor: Editor;
	#canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#shouldClearCanvas: boolean = false;

	#highlightCanvas: HTMLCanvasElement;
	#highlightCtx: CanvasRenderingContext2D;
	#shouldClearHighlightCanvas: boolean = false;

	#canvasX: number = 0;
	#canvasY: number = 0;
	#canvasWidth: number = 0;
	#canvasHeight: number = 0;

	#diffs: DiffRenderItem[] = [];
	#diffGeometries: RectSet[] = [];
	#diffLineRects: Rect[] = [];

	#selectionHighlight: Range | null = null;
	#selectionHighlightRects: RectSet | null = null;

	#dirtyFlags: number = 0;
	#renderPending: boolean = false;
	#visibleDiffIndices: Set<number> = new Set();
	#callbacks: RendererCallbacks;
	#highlightedDiffIndex: number | null = null;

	constructor(editor: Editor, container: HTMLElement, callbacks: RendererCallbacks) {
		this.#editor = editor;
		this.#container = container;
		this.#callbacks = callbacks;
		this.#canvas = document.createElement("canvas");
		this.#ctx = this.#canvas.getContext("2d")!;
		container.appendChild(this.#canvas);

		this.#highlightCanvas = document.createElement("canvas");
		this.#highlightCtx = this.#highlightCanvas.getContext("2d")!;
		container.appendChild(this.#highlightCanvas);

		this.updateLayout();
	}

	updateLayout() {
		const { x, y, width, height } = this.#container.getBoundingClientRect();
		this.#canvasX = x;
		this.#canvasY = y;
		this.#canvasWidth = width;
		this.#canvasHeight = height;

		this.#canvas.width = width;
		this.#canvas.height = height;
		this.#highlightCanvas.width = width;
		this.#highlightCanvas.height = height;
		this.markDirty(RenderFlags.ALL);
	}

	setDiffs(diffs: DiffRenderItem[]) {
		{
			const entries: VisibilityChangeEntry[] = [];
			for (let i = 0; i < this.#diffs.length; i++) {
				entries.push({ item: i, isVisible: false });
			}
			this.#callbacks.diffVisibilityChanged(entries);
		}
		this.#diffs = diffs;
		this.markDirty(RenderFlags.DIFF | RenderFlags.GEOMETRY);
		this.#visibleDiffIndices.clear();
		this.#selectionHighlight = null;
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

	markDirty(flags: number) {
		this.#dirtyFlags |= flags;
		if (this.#renderPending) {
			return;
		}
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

	render() {
		if (this.#dirtyFlags & RenderFlags.DIFF) {
			this.renderDiffs();
		}

		if (this.#dirtyFlags & RenderFlags.HIGHLIGHT) {
			this.renderHighlightLayer();
		}

		this.#dirtyFlags = 0;
	}

	renderDiffs() {
		if (this.#dirtyFlags & RenderFlags.GEOMETRY) {
			this.buildDiffGeometries();
		}
		// console.log("Rendering diffs:", this.#diffs, this.#diffGeometries);

		const ctx = this.#ctx;
		const canvasWidth = this.#canvasWidth;
		const canvasHeight = this.#canvasHeight;
		const visibleDiffIndices = this.#visibleDiffIndices;
		const visChangeEntries: VisibilityChangeEntry[] = [];

		if (this.#shouldClearCanvas) {
			ctx.clearRect(0, 0, this.#canvasWidth, this.#canvasHeight);
			this.#shouldClearCanvas = false;
		}

		let renderedAny = false;
		const { scrollLeft, scrollTop } = this.#container;

		ctx.fillStyle = DIFF_LINE_FILL_STYLE;
		for (const rect of this.#diffLineRects) {
			const x = Math.floor(rect.x - scrollLeft),
				y = Math.floor(rect.y - scrollTop),
				width = Math.ceil(rect.width),
				height = Math.ceil(rect.height);

			if (y + height < 0) continue;
			if (y > canvasHeight) break;
			ctx.fillRect(x, y, width, height);
			renderedAny = true;
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
				renderedAny = true;
			}
		}

		if (visChangeEntries.length > 0) {
			this.#callbacks.diffVisibilityChanged(visChangeEntries);
		}

		this.#shouldClearCanvas = renderedAny;
	}

	buildDiffGeometries() {
		const scrollTop = this.#container.scrollTop;
		const scrollLeft = this.#container.scrollLeft;
		const offsetX = -this.#canvasX + scrollLeft;
		const offsetY = -this.#canvasY + scrollTop;

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

		const canvasWidth = this.#canvasWidth;
		let lineRect: Rect | null = null;
		for (const rect of diffRects) {
			const y = rect.y - DIFF_LINE_EXPAND_Y;
			const height = rect.height * DIFF_LINE_HEIGHT_MULTIPLIER + DIFF_LINE_EXPAND_Y * 2;
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

	renderHighlightLayer() {
		// console.log("Rendering selection highlight:", this.#selectionHighlight);

		const ctx = this.#highlightCtx;
		if (this.#shouldClearHighlightCanvas) {
			ctx.clearRect(0, 0, this.#highlightCanvas.width, this.#highlightCanvas.height);
			this.#shouldClearHighlightCanvas = false;
		}

		const scrollTop = this.#container.scrollTop;
		const scrollLeft = this.#container.scrollLeft;
		const canvasWidth = this.#canvasWidth;
		const canvasHeight = this.#canvasHeight;
		let renderedAny = false;

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
				ctx.strokeStyle = `hsl(${diff.hue} 100% 50% / 0.5)`;
				// ctx.shadowColor = `hsl(${baseHue} 100% 60% / 0.8)`;
				// ctx.shadowBlur = 20;

				for (const rect of rects.rects) {
					const x = Math.floor(rect.x - scrollLeft) - 1,
						y = Math.floor(rect.y - scrollTop) - 1,
						width = Math.ceil(rect.width) + 2,
						height = Math.ceil(rect.height) + 2;

					if (y + height < 0 || y > canvasHeight) continue;
					if (x + width < 0 || x > canvasWidth) continue;

					ctx.strokeRect(x, y, width, height);

					// ctx.lineWidth = 2;
					// ctx.strokeStyle = "white";
					// ctx.shadowBlur = 0;
					// ctx.shadowColor = "transparent";
					// ctx.strokeRect(x-1, y-1, width + 2, height + 2);

					renderedAny = true;
				}
			}
			ctx.lineWidth = 1;
			// ctx.shadowBlur = 0;
			// ctx.strokeStyle = "transparent";
		}

		if (this.#selectionHighlight) {
			if (!this.#selectionHighlightRects || this.#dirtyFlags & RenderFlags.GEOMETRY) {
				let start = performance.now();
				const offsetX = -this.#canvasX + scrollLeft;
				const offsetY = -this.#canvasY + scrollTop;

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
				renderedAny = true;
			}
		}

		if (renderedAny) {
			this.#shouldClearHighlightCanvas = true;
		}
	}

	setDiffHighlight(diffIndex: number | null) {
		if (this.#highlightedDiffIndex === diffIndex) {
			return; // No change
		}
		// RECT는 필요 없음
		let prevShowing = this.#highlightedDiffIndex !== null && this.#visibleDiffIndices.has(this.#highlightedDiffIndex);
		this.#highlightedDiffIndex = diffIndex;
		let shouldShow = diffIndex !== null && this.#visibleDiffIndices.has(diffIndex);
		this.#dirtyFlags |= RenderFlags.HIGHLIGHT_DIFF;
		return prevShowing || shouldShow;
	}

	getDiffOffsetY(diffIndex: number): number | undefined {
		const geometry = this.#diffGeometries[diffIndex];
		if (!geometry) {
			return undefined;
		}
		return geometry.minY;
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
