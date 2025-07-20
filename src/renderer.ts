type RectSet = {
	rects: Rect[] | null;
	// fillStyle: string | null;
	// strokeStyle: string | null;
} & RenderBounds;

type RenderBounds = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

const enum RenderFlags {
	NONE = 0,
	// LAYOUT FLAGS
	LAYOUT = 1 << 0,
	HIT_TEST = 1 << 1, // For hit testing only, not for rendering

	// REGIONAL FLAGS
	DIFF_LAYER = 1 << 5,
	HIGHLIGHT_LAYER = 1 << 6,
	GEOMETRY = 1 << 7,

	SCROLL = DIFF_LAYER | HIGHLIGHT_LAYER,
	RESIZE = SCROLL | GEOMETRY,
	GENERAL_MASK = LAYOUT | HIT_TEST,
	REGION_MASK = DIFF_LAYER | HIGHLIGHT_LAYER | GEOMETRY,
}
const REGION_FLAGS_SHIFT = 10;

const enum RenderStage {
	Idle = 0,
	Prepare = 1,
	Draw = 2,
}

const DIFF_EXPAND_X = 2;
const DIFF_EXPAND_Y = 2;
const DIFF_LINE_EXPAND_Y = 0;
const DIFF_LINE_FILL_STYLE = "hsl(0 100% 90% / 0.5)";
const DIFF_LINE_HEIGHT_MULTIPLIER = 1.2;
const SELECTION_HIGHLIGHT_FILL_STYLE = "rgba(128, 128, 128, 0.3)";
const GUIDELINE_STROKE_STYLE = "rgba(128, 128, 128, 0.3)";

type DiffRenderItem = {
	diffIndex: number;
	range: Range;
	hue: number;
	empty: boolean;
	//geometry: RectSet | null;
};

type RendererCallbacks = {
	onPrepare: (time: number) => void;
	onDraw: (time: number) => void;
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
	#nextRenderFlags: RenderFlags = RenderFlags.NONE;
	#mouseX: number = -1;
	#mouseY: number = -1;
	#guideLineEnabled: boolean = false;
	#guideLineY: number = -1;
	#stage: RenderStage = RenderStage.Idle;
	#diffHovered = false;

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

		container.addEventListener("mousemove", (e) => {
			const rect = container.getBoundingClientRect();
			let x = e.clientX - rect.x;
			let y = e.clientY - rect.y;
			if (x < 0 || x > this.#canvasWidth || y < 0 || y > this.#canvasHeight) {
				x = -1;
				y = -1;
			}
			if (this.#mouseX !== x || this.#mouseY !== y) {
				this.#mouseX = x;
				this.#mouseY = y;
				this.#invalidate(RenderFlags.HIT_TEST);
			}
		});

		container.addEventListener("mouseleave", () => {
			if (this.#mouseX === -1 && this.#mouseY === -1) {
				return; // No change
			}
			this.#mouseX = -1;
			this.#mouseY = -1;
			if (hoveredDiffIndexAtom.get() !== null) {
				this.#invalidate(RenderFlags.HIT_TEST);
			}
		});

		hoveredDiffIndexAtom.subscribe((diffIndex) => this.#onHighlightedDiffIndexChanged(diffIndex));
	}

	#onHighlightedDiffIndexChanged(diffIndex: number | null) {
		this.#leftRegion.setHoveredDiffIndex(diffIndex);
		this.#rightRegion.setHoveredDiffIndex(diffIndex);
	}

	get guideLineEnabled() {
		return this.#guideLineEnabled;
	}

	set guideLineEnabled(enabled: boolean) {
		enabled = !!enabled;
		if (this.#guideLineEnabled === enabled) {
			return; // No change
		}

		this.#guideLineEnabled = enabled;
		if (enabled || this.#guideLineY !== null) {
			this.invalidateHighlightLayer(undefined);
		}
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
		this.#leftRegion.updateLayout(x, y, width, height);
		this.#rightRegion.updateLayout(x, y, width, height);
	}

	queueRender() {
		if (this.#renderCallbackId !== null) {
			//console.log("already pending...");
			// Already pending
			// 가장 마지막에 실행되도록 기존 콜백을 취소하고 다시 등록하면 어떨까...?
			return;
		}

		// console.debug(`Queueing render with flags: ${this.#renderFlagsToString(this.#nextRenderFlags)}`);
		this.#renderCallbackId = requestAnimationFrame((ts) => {
			this.#renderCallbackId = null;
			this.#render(ts);
		});
	}

	cancelRender() {
		if (this.#renderCallbackId !== null) {
			cancelAnimationFrame(this.#renderCallbackId);
			this.#renderCallbackId = null;
			this.#nextRenderFlags = RenderFlags.NONE;
			this.#stage = RenderStage.Idle;
		}
	}

	#renderFlagsToString(flags: RenderFlags): string {
		const parts: string[] = [];
		if ((flags & RenderFlags.LAYOUT) === RenderFlags.LAYOUT) parts.push("LAYOUT");
		if ((flags & RenderFlags.DIFF_LAYER) === RenderFlags.DIFF_LAYER) parts.push("DIFF_LAYER");
		if ((flags & RenderFlags.HIGHLIGHT_LAYER) === RenderFlags.HIGHLIGHT_LAYER) parts.push("HIGHLIGHT_LAYER");
		if ((flags & RenderFlags.GEOMETRY) === RenderFlags.GEOMETRY) parts.push("GEOMETRY");
		// if ((flags & RenderFlags.SCROLL) === RenderFlags.SCROLL) parts.push("SCROLL");
		// if ((flags & RenderFlags.RESIZE) === RenderFlags.RESIZE) parts.push("RESIZE");
		return parts.join(", ") || "NONE";
	}

	#render(time: number) {
		let leftRegionFlags;
		let rightRegionFlags;

		// prepare
		this.#stage = RenderStage.Prepare;
		this.#callbacks.onPrepare(time);

		if (this.#nextRenderFlags & RenderFlags.LAYOUT) {
			this.#updateLayout();
		}

		leftRegionFlags = this.#nextRenderFlags & RenderFlags.REGION_MASK;
		rightRegionFlags = (this.#nextRenderFlags >> REGION_FLAGS_SHIFT) & RenderFlags.REGION_MASK;
		if (leftRegionFlags) {
			this.#leftRegion.prepare(leftRegionFlags);
		}
		if (rightRegionFlags) {
			this.#rightRegion.prepare(rightRegionFlags);
		}

		if (this.#nextRenderFlags & RenderFlags.HIT_TEST) {
			this.hitTest(this.#mouseX, this.#mouseY);
			if (this.#guideLineEnabled) {
				if (this.#guideLineY !== this.#mouseY) {
					if (this.#guideLineY >= 0) {
						// 이전에 그렸던 guide line을 지워야함
						this.invalidateHighlightLayer();
					}
					this.#guideLineY = this.#mouseY;
				}
			}
		}

		// draw
		this.#stage = RenderStage.Draw;
		leftRegionFlags = this.#nextRenderFlags & RenderFlags.REGION_MASK;
		rightRegionFlags = (this.#nextRenderFlags >> REGION_FLAGS_SHIFT) & RenderFlags.REGION_MASK;
		this.#nextRenderFlags = RenderFlags.NONE;

		if (leftRegionFlags) {
			this.#leftRegion.render(leftRegionFlags);
		}
		if (rightRegionFlags) {
			this.#rightRegion.render(rightRegionFlags);
		}

		if (this.#guideLineEnabled && this.#mouseY >= 0) {
			this.#renderGuideLine();
		}

		// if (this.#guideLineEnabled && this.#mouseY >= 0) {
		// 	this.#renderGuideLine();
		// }

		this.#stage = RenderStage.Idle;
		if (this.#nextRenderFlags !== RenderFlags.NONE) {
			// If there are still flags to render, schedule another render
			this.queueRender();
		}
	}

	#renderGuideLine() {
		const ctx = this.#highlightCtx;
		const y = this.#guideLineY + 0.5;
		ctx.beginPath();
		ctx.moveTo(0, y); // +0.5는 픽셀 정렬을 위해. 안 그러면 흐려짐
		ctx.lineTo(this.#canvasWidth, y);
		ctx.strokeStyle = GUIDELINE_STROKE_STYLE; // 눈에 띄게
		ctx.lineWidth = 1;
		ctx.stroke();
	}

	invalidateAll() {
		this.#invalidate(RenderFlags.GENERAL_MASK | RenderFlags.REGION_MASK | (RenderFlags.REGION_MASK << REGION_FLAGS_SHIFT));
	}

	invalidateLayout(rect: Rect) {
		this.#invalidate(RenderFlags.LAYOUT);
	}

	invalidateDiffLayer(which?: "left" | "right") {
		return this.#invalidateRegion(RenderFlags.DIFF_LAYER, which);
	}

	invalidateHighlightLayer(which?: "left" | "right") {
		return this.#invalidateRegion(RenderFlags.HIGHLIGHT_LAYER, which);
	}

	invalidateGeometries(which?: "left" | "right") {
		return this.#invalidateRegion(RenderFlags.GEOMETRY | RenderFlags.DIFF_LAYER | RenderFlags.HIGHLIGHT_LAYER, which);
	}

	invalidateScroll(which?: "left" | "right") {
		return this.#invalidateRegion(RenderFlags.SCROLL, which);
	}

	#invalidate(flags: RenderFlags) {
		this.#nextRenderFlags |= flags;
		if (this.#stage === RenderStage.Idle) {
			this.queueRender();
		} else if (this.#stage === RenderStage.Prepare) {
			// we are already in rendering cycle, just set the flags
		} else if (this.#stage === RenderStage.Draw) {
			// 렌더링 중이라면 렌더링이 끝난 후 flags가 None이 아닐 때 render()가 다시 호출됨.
			// 여기서는 아무것 할 게 없음
		}
	}

	#invalidateRegion(flags: RenderFlags, which?: "left" | "right") {
		if (which === "right") {
			flags <<= REGION_FLAGS_SHIFT;
		} else if (!which) {
			flags |= flags << REGION_FLAGS_SHIFT;
		}
		this.#invalidate(flags);
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
				empty: diff.leftSpan.count === 0,
			};
			rightDiffs[i] = {
				diffIndex: i,
				range: rightRange,
				hue: diff.hue,
				empty: diff.rightSpan.count === 0,
			};
		}

		this.#leftRegion.setDiffs(leftDiffs);
		this.#rightRegion.setDiffs(rightDiffs);
		this.invalidateGeometries();
	}

	setDiffHighlight(diffIndex: number | null) {
		this.#leftRegion.setHoveredDiffIndex(diffIndex);
		this.#rightRegion.setHoveredDiffIndex(diffIndex);
	}

	setSelectionHighlight(which: "left" | "right", range: Range | null) {
		let leftRange: Range | null = null;
		let rightRange: Range | null = null;
		if (which === "left") {
			leftRange = range;
		} else if (which === "right") {
			rightRange = range;
		}

		this.#leftRegion.setSelectionHighlight(leftRange);
		this.#rightRegion.setSelectionHighlight(rightRange);
	}

	hitTest(x: number, y: number): number | null {
		let diffIndex: number | null = null;

		if (x < 0 || y < 0) {
			//
		} else if (x > this.#canvasWidth || y > this.#canvasHeight) {
			//
		} else {
			const region = x >= this.#rightRegion.regionX ? this.#rightRegion : this.#leftRegion;
			x = x - region.regionX;
			diffIndex = region.hitTest(x, y);
			if (diffIndex !== null) {
				hoveredDiffIndexAtom.set(diffIndex);
				this.#diffHovered = true;
			} else if (this.#diffHovered) {
				hoveredDiffIndexAtom.set(null);
				this.#diffHovered = false;
			}
		}

		return diffIndex;
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
	//dirtyFlags: RenderFlags = RenderFlags.NONE;
	#visibleDiffIndices: Set<number> = new Set();
	#ctx: CanvasRenderingContext2D;
	#highlightCtx: CanvasRenderingContext2D;
	#regionInfo: EditorRegionInfo;
	regionX: number = 0;
	regionY: number = 0;
	regionWidth: number = 0;
	regionHeight: number = 0;
	#hoveredDiffIndex: number | null = null;
	#callbacks: RendererCallbacks;
	#diffIndicesToRender: number[] = [];
	#diffVisibilityChangeEntries: VisibilityChangeEntry[] = [];
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
		const x = rect.x - canvasX;
		const y = rect.y - canvasY;
		const width = rect.width;
		const height = rect.height;
		if (this.regionX !== x || this.regionWidth !== width) {
			this.#renderer.invalidateGeometries(this.#name);
		} else if (this.regionY !== y || this.regionHeight !== height) {
			this.#renderer.invalidateDiffLayer(this.#name);
			this.#renderer.invalidateHighlightLayer(this.#name);
		}
		this.regionX = rect.x - canvasX;
		this.regionY = rect.y - canvasY;
		this.regionWidth = rect.width;
		this.regionHeight = rect.height;
	}

	get name() {
		return this.#name;
	}

	get diffs() {
		return this.#diffs;
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

	get visibleDiffIndices() {
		return this.#visibleDiffIndices;
	}

	// markDirty(flags: RenderFlags) {
	// 	this.dirtyFlags |= flags;
	// }

	setDiffs(diffs: DiffRenderItem[]) {
		this.#diffs = diffs;
		this.#diffGeometries.length = 0;
		//this.#diffGeometries = new Array(diffs.length);
		// this.markDirty(RenderFlags.DIFF | RenderFlags.GEOMETRY);
		this.#visibleDiffIndices.clear();
		this.#selectionHighlight = null;
	}

	setHoveredDiffIndex(diffIndex: number | null) {
		if (this.#hoveredDiffIndex === diffIndex) {
			return false; // No change
		}

		let wasShown = this.#hoveredDiffIndex !== null && this.visibleDiffIndices.has(this.#hoveredDiffIndex);
		let shouldShow = diffIndex !== null && (!this.#diffGeometries[diffIndex] || this.visibleDiffIndices.has(diffIndex));
		this.#hoveredDiffIndex = diffIndex;

		if (wasShown || shouldShow) {
			this.#renderer.invalidateHighlightLayer(this.#name);
			return true;
		}

		return false;
	}

	ensureGeometries() {}

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
		this.#renderer.invalidateHighlightLayer(this.#name);
	}

	prepare(dirtyFlags: RenderFlags) {
		const diffGeometries = this.#diffGeometries;
		const diffsToRender = this.#diffIndicesToRender;
		const diffVisibilityChangeEntries = this.#diffVisibilityChangeEntries;
		const visibleDiffIndices = this.#visibleDiffIndices;
		const diffs = this.#diffs;
		const newGeometryRects: Rect[] = [];

		diffsToRender.length = 0;
		diffVisibilityChangeEntries.length = 0;
		if (dirtyFlags & RenderFlags.GEOMETRY) {
			diffGeometries.length = 0;
			this.#diffLineRects.length = 0;
		}

		const scrollTop = this.#regionInfo.scrollTop;
		const offsetX = -this.regionX;
		const offsetY = -this.regionY + scrollTop;
		const regionHeight = this.regionHeight;

		for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
			let geometry = diffGeometries[diffIndex];
			if (!geometry) {
				const diff = diffs[diffIndex];
				const wholeRect = diff.range.getBoundingClientRect();
				const x = wholeRect.x + offsetX - DIFF_EXPAND_X,
					y = wholeRect.y + offsetY - DIFF_EXPAND_Y,
					width = wholeRect.width + DIFF_EXPAND_X * 2,
					height = wholeRect.height + DIFF_EXPAND_Y * 2;
				diffGeometries[diffIndex] = geometry = {
					minX: x,
					minY: y,
					maxX: x + width,
					maxY: y + height,
					rects: null,
					// fillStyle: null,
					// strokeStyle: null,
				};
			}

			if (geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > regionHeight) {
				if (visibleDiffIndices.delete(diffIndex)) {
					diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: false });
				}
				continue;
			}

			if (geometry.rects === null) {
				const rangeRects = extractRects(diffs[diffIndex].range, diffs[diffIndex].empty);
				for (const rect of rangeRects) {
					rect.x += offsetX - DIFF_EXPAND_X;
					rect.y += offsetY - DIFF_EXPAND_Y;
					rect.width += DIFF_EXPAND_X * 2;
					rect.height += DIFF_EXPAND_Y * 2;
					newGeometryRects.push(rect);
				}
				diffGeometries[diffIndex] = geometry = mergeRects(rangeRects, 1, 1) as RectSet;
				// geometry.fillStyle = `hsl(${diffs[diffIndex].hue} 100% 80%)`;
				// geometry.strokeStyle = `hsl(${diffs[diffIndex].hue} 100% 40% / 0.5)`;
				// geometry.fillStyle = `hsl(${diffs[diffIndex].hue} 100% 80% / 0.7)`;
				// geometry.strokeStyle = `hsl(${diffs[diffIndex].hue} 100% 30% / 0.5)`;
			}
			diffsToRender.push(diffIndex);
		}

		if (newGeometryRects.length > 0) {
			this.#mergeIntoDiffLineRects(newGeometryRects);
		}
	}

	render(dirtyFlags: RenderFlags) {
		if (dirtyFlags & RenderFlags.DIFF_LAYER) {
			this.renderDiffLayer();
		}

		if (dirtyFlags & RenderFlags.HIGHLIGHT_LAYER) {
			this.renderHighlightLayer(dirtyFlags);
		}
	}

	renderDiffLayer() {
		const ctx = this.#ctx;
		ctx.save();
		ctx.translate(this.regionX, this.regionY);
		ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);

		const diffGeometries = this.#diffGeometries;
		const diffsToRender = this.#diffIndicesToRender;
		const diffVisibilityChangeEntries = this.#diffVisibilityChangeEntries;
		const visibleDiffIndices = this.#visibleDiffIndices;
		const diffs = this.#diffs;
		const scrollTop = this.#regionInfo.scrollTop;
		const scrollLeft = 0;
		const regionHeight = this.regionHeight;

		for (const diffLineRect of this.#diffLineRects) {
			const x = Math.floor(diffLineRect.x - scrollLeft),
				y = Math.floor(diffLineRect.y - scrollTop),
				width = Math.ceil(diffLineRect.width),
				height = Math.ceil(diffLineRect.height);

			if (y + height < 0) continue;
			if (y > regionHeight) break;

			ctx.fillStyle = DIFF_LINE_FILL_STYLE;
			ctx.fillRect(x, y, width, height);
		}

		for (const diffIndex of diffsToRender) {
			const geometry = diffGeometries[diffIndex]!;
			ctx.fillStyle = `hsl(${diffs[diffIndex].hue} 100% 80%)`;
			ctx.strokeStyle = `hsl(${diffs[diffIndex].hue} 100% 40%)`;

			let rendered = false;
			for (const rect of geometry.rects!) {
				const x = Math.floor(rect.x - scrollLeft),
					y = Math.floor(rect.y - scrollTop),
					width = Math.ceil(rect.width),
					height = Math.ceil(rect.height);

				if (y + height < 0) continue;
				if (y + height < 0 || y > regionHeight) break;

				// ctx.strokeRect(x, y, width, height);
				ctx.fillRect(x, y, width, height);
				rendered = true;
			}

			if (rendered) {
				const prevCount = visibleDiffIndices.size;
				visibleDiffIndices.add(diffIndex);
				if (visibleDiffIndices.size > prevCount) {
					diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: true });
				}
			} else {
				if (visibleDiffIndices.delete(diffIndex)) {
					diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: false });
				}
			}
		}

		if (diffVisibilityChangeEntries.length > 0) {
			// console.warn(`[RenderRegion] Visibility change entries for ${this.#name} region:`, visChangeEntries);
			this.#callbacks.onDiffVisibilityChanged(this.#name, diffVisibilityChangeEntries);
		}

		//this.#shouldClearCanvas = renderedAny;
		ctx.restore();
	}

	renderHighlightLayer(dirtyFlags: RenderFlags) {
		const ctx = this.#highlightCtx;
		ctx.save();
		ctx.translate(this.regionX, this.regionY);
		ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);

		const regionWidth = this.regionWidth;
		const regionHeight = this.regionHeight;
		const scrollTop = this.#regionInfo.scrollTop;
		const scrollLeft = 0;

		if (this.#hoveredDiffIndex !== null) {
			const rects = this.#diffGeometries[this.#hoveredDiffIndex];
			if (rects && rects.rects) {
				let isVisible =
					!(rects.maxY - scrollTop < 0 || rects.minY - scrollTop > regionHeight) &&
					!(rects.maxX - scrollLeft < 0 || rects.minX - scrollLeft > regionWidth);
				if (isVisible) {
					// console.debug(`[RenderRegion] Rendering highlighted diff rects for ${this.#name} region at index ${this.#highlightedDiffIndex}.`, rects);

					ctx.lineWidth = 2;
					ctx.fillStyle = `hsl(0 100% 80%)`;
					ctx.strokeStyle = `hsl(0 100% 50% / 0.5)`;
					// ctx.strokeStyle = `hsl(${diff.hue} 100% 50% / 0.5)`;

					for (const rect of rects.rects) {
						const x = Math.floor(rect.x - scrollLeft),
							y = Math.floor(rect.y - scrollTop),
							width = Math.ceil(rect.width),
							height = Math.ceil(rect.height);

						if (y + height < 0 || y > regionHeight) continue;
						if (x + width < 0 || x > regionWidth) continue;

						//ctx.strokeRect(x, y, width, height);
						ctx.fillRect(x, y, width, height);

						// ctx.lineWidth = 2;
						// ctx.strokeStyle = "white";
						// ctx.shadowBlur = 0;
						// ctx.shadowColor = "transparent";
						// ctx.strokeRect(x-1, y-1, width + 2, height + 2);
					}
					ctx.lineWidth = 1;
				}
			}
			// ctx.shadowBlur = 0;
			// ctx.strokeStyle = "transparent";
		}

		if (this.#selectionHighlight) {
			if (!this.#selectionHighlightRects || dirtyFlags & RenderFlags.GEOMETRY) {
				let start = performance.now();
				const offsetX = -this.regionX + scrollLeft;
				const offsetY = -this.regionY + scrollTop;

				const rawRects = extractRects(this.#selectionHighlight);

				let end = performance.now();
				start = end;

				const mergedRect = mergeRects(rawRects, 1, 1) as RectSet;
				// FIXE
				if (mergedRect.rects) {
					for (const rect of mergedRect.rects) {
						rect.x += offsetX;
						rect.y += offsetY;
					}
					mergedRect.minX += offsetX;
					mergedRect.minY += offsetY;
					mergedRect.maxX += offsetX;

					mergedRect.maxY += offsetY;
					this.#selectionHighlightRects = mergedRect;
				}
				// console.log("Extracted selection highlight rects in", performance.now() - start, "ms");
			}
			let geometry = this.#selectionHighlightRects!;
			////////
			let isVisible =
				!(geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > regionHeight) &&
				!(geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > regionWidth);
			if (isVisible) {
				ctx.fillStyle = SELECTION_HIGHLIGHT_FILL_STYLE;
				for (const rect of geometry.rects!) {
					const x = Math.floor(rect.x - scrollLeft),
						y = Math.floor(rect.y - scrollTop),
						width = Math.ceil(rect.width),
						height = Math.ceil(rect.height);

					if (y + height < 0) continue;
					if (y > regionHeight) break;

					ctx.fillRect(x, y, width, height);
				}
			}
		}

		ctx.restore();
	}

	#mergeIntoDiffLineRects(incoming: Rect[]): void {
		const TOLERANCE = 1;
		const regionWidth = this.regionWidth;
		const allRects: Rect[] = [];

		// 1. 기존 라인 rect들 복사해서 allRects에 넣기
		for (const rect of this.#diffLineRects) {
			allRects.push(rect);
		}

		// 2. 새로 들어온 rect들을 line rect 형태로 변형해서 넣기
		for (const rect of incoming) {
			const height = rect.height * DIFF_LINE_HEIGHT_MULTIPLIER;
			const heightDelta = height - rect.height;
			const y = rect.y - heightDelta / 2;

			allRects.push({
				x: 0,
				y,
				width: regionWidth,
				height,
			});
		}

		// 3. 정렬 후 병합
		allRects.sort((a, b) => a.y - b.y);
		this.#diffLineRects.length = 0;

		let current = allRects[0];
		for (let i = 1; i < allRects.length; i++) {
			const next = allRects[i];
			const gap = next.y - (current.y + current.height);

			if (gap <= TOLERANCE) {
				const newBottom = Math.max(current.y + current.height, next.y + next.height);
				current = {
					x: 0,
					y: current.y,
					width: regionWidth,
					height: newBottom - current.y,
				};
			} else {
				this.#diffLineRects.push(current);
				current = next;
			}
		}
		this.#diffLineRects.push(current);
	}

	hitTest(x: number, y: number) {
		y += this.#regionInfo.scrollTop;
		for (const diffIndex of this.#visibleDiffIndices) {
			const geometry = this.#diffGeometries[diffIndex];
			if (geometry && geometry.rects) {
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
			if (!geometry || !geometry.rects) {
				// console.log("No geometry for diff index:", diffIndex);
				continue;
			}
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
