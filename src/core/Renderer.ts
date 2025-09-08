import { mergeRects } from "@/utils/mergeRects";
import { DIFF_TAG_NAME, MANUAL_ANCHOR_CLASS_NAME } from "@/core/constants/index";
import { advanceNode } from "@/utils/advanceNode";
import { mountHelper } from "@/utils/mountHelper";
import type { EditorName } from "./types";
import { deepMerge } from "@/utils/deepMerge";

export interface RendererOptions {
	styles: {
		diff: {
			normal: {
				fillSaturation: number;
				fillLightness: number;
				fillAlpha: number;
				strokeSaturation: number;
				strokeLightness: number;
				strokeAlpha: number;
			};
			highlight: {
				fill: string; // hsl or rgba or CSS named color
				stroke: string;
			};
			line: {
				fill: string; // ← 요거 추가
			};
		};
		selection: {
			fill: string;
		};
		guideline: {
			stroke: string;
		};
	};
	geometry: {
		diffExpandX: number;
		diffExpandY: number;
		diffLineExpandY: number;
		diffLineHeightMultiplier: number;
	};
}

const _defaultRendererOptions: RendererOptions = {
	styles: {
		diff: {
			normal: {
				fillSaturation: 100,
				fillLightness: 80,
				fillAlpha: 1,
				strokeSaturation: 100,
				strokeLightness: 40,
				strokeAlpha: 1,
			},
			highlight: {
				fill: "hsl(0 100% 80%)",
				stroke: "hsl(0 100% 50% / 0.5)",
			},
			line: {
				fill: "hsl(0 100% 90% / 0.5)",
			},
		},
		selection: {
			fill: "hsl(0 0% 50% / 0.3)",
		},
		guideline: {
			stroke: "hsl(0 0% 50% / 0.3)",
		},
	},
	geometry: {
		diffExpandX: 2,
		diffExpandY: 2,
		diffLineExpandY: 0,
		diffLineHeightMultiplier: 1,
	},
};

export function getDefaultRendererOptions(): RendererOptions {
	return structuredClone(_defaultRendererOptions);
}

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

export type RenderViewport = {
	getBoundingClientRect: () => Rect;
	getScroll(): [x: number, y: number];
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

type DiffRenderItem = {
	diffIndex: number;
	range: Range;
	hue: number;
	empty: boolean;
	//geometry: RectSet | null;
};

export type DiffVisibilityChangedCallback = (changes: Record<EditorName, VisibilityChangeEntry[]>) => void;

export type HoveredDiffIndexChangedCallback = (diffIndex: number | null) => void;

export type RendererCallbacks = {
	prepare: (time: number) => void;
	draw: (time: number) => void;
	diffVisibilityChanged: DiffVisibilityChangedCallback;
	hoveredDiffIndexChanged: HoveredDiffIndexChangedCallback;
};

export class Renderer {
	#wrapper: HTMLElement | null = null;
	#canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#highlightCanvas: HTMLCanvasElement;
	#highlightCtx: CanvasRenderingContext2D;
	#resizeObserver: ResizeObserver = new ResizeObserver(this.#handleResize.bind(this));
	#options: RendererOptions = getDefaultRendererOptions();
	#leftRegion: RenderRegion;
	#rightRegion: RenderRegion;
	#canvasX: number = 0;
	#canvasY: number = 0;
	#canvasWidth: number = 0;
	#canvasHeight: number = 0;
	#renderCallbackId: number | null = null;
	#nextRenderFlags: RenderFlags = RenderFlags.NONE;
	#mouseX: number = -1;
	#mouseY: number = -1;
	#guideLineEnabled: boolean = true;
	#guideLineY: number = -1;
	#stage: RenderStage = RenderStage.Idle;
	#callbacks: Partial<RendererCallbacks> = {};
	#hoveredDiffIndex: number | null = null;
	#hoveredRegion: EditorName | null = null;
	#highlightedDiffIndex: number | null = null;
	#mountHelper: ReturnType<typeof mountHelper>;
	#visibleDiffIndices: Record<EditorName, Set<number>> = {
		left: new Set(),
		right: new Set(),
	};

	constructor(left: RenderViewport, right: RenderViewport) {
		this.#canvas = document.createElement("canvas");
		this.#canvas.className = "diff-layer";
		this.#ctx = this.#canvas.getContext("2d")!;

		this.#highlightCanvas = document.createElement("canvas");
		this.#highlightCanvas.className = "highlight-layer";
		this.#highlightCtx = this.#highlightCanvas.getContext("2d")!;

		this.#leftRegion = new RenderRegion("left", this, left, this.#ctx, this.#highlightCtx);
		this.#rightRegion = new RenderRegion("right", this, right, this.#ctx, this.#highlightCtx);

		this.#wrapper = document.createElement("div");
		this.#wrapper.className = "renderer";
		this.#wrapper.appendChild(this.#canvas);
		this.#wrapper.appendChild(this.#highlightCanvas);

		this.#mountHelper = mountHelper(this.#wrapper, {
			onMount: (target) => {
				this.#resizeObserver.observe(target);
			},
			onUnmount: (target) => {
				this.#resizeObserver.unobserve(target);
			},
		});
	}

	setOptions(newOptions: Partial<RendererOptions>) {
		deepMerge(this.#options, newOptions);
	}

	getOptions(): RendererOptions {
		return this.#options;
	}

	setCallbacks(callbacks: Partial<RendererCallbacks>) {
		Object.assign(this.#callbacks, callbacks);
	}

	mount(target: HTMLElement) {
		this.#mountHelper.mount(target);
	}

	unmount() {
		this.#mountHelper.unmount();
	}

	get x() {
		return this.#canvasX;
	}

	get y() {
		return this.#canvasY;
	}

	get width() {
		return this.#canvasWidth;
	}

	get height() {
		return this.#canvasHeight;
	}

	get guideLineY() {
		return this.#guideLineY;
	}

	#handleResize(_entries: ResizeObserverEntry[]) {
		this.#updateLayout();
	}

	setDiffHighlight(diffIndex: number | null) {
		this.#highlightedDiffIndex = diffIndex;
		this.#updateHighlightedDiffIndex();
	}

	setHoveredDiffIndex(diffIndex: number | null, region?: EditorName) {
		this.#hoveredDiffIndex = diffIndex;
		this.#hoveredRegion = region ?? null;
		this.#updateHighlightedDiffIndex();
		this.#callbacks.hoveredDiffIndexChanged?.(diffIndex);
	}

	#updateHighlightedDiffIndex() {
		const actualDiffIndex = this.#hoveredDiffIndex ?? this.#highlightedDiffIndex ?? null;
		this.#leftRegion.setHighlightedDiffIndex(actualDiffIndex);
		this.#rightRegion.setHighlightedDiffIndex(actualDiffIndex);
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
		this.#guideLineY = -1;
		if (enabled || this.#guideLineY !== null) {
			this.invalidateHighlightLayer(undefined);
		}
	}

	#updateLayout() {
		if (!this.#wrapper) {
			return;
		}

		const { x, y, width, height } = this.#wrapper.getBoundingClientRect();

		// canvas width,height가 업데이트 되면 현재 캔버스는 무조건 clear되는 것 같다.
		//

		this.#canvasX = x;
		this.#canvasY = y;
		if (this.#canvasWidth !== width || this.#canvasHeight !== height) {
			this.#canvas.width = this.#canvasWidth = width;
			this.#canvas.height = this.#canvasHeight = height;
			this.#nextRenderFlags = RenderFlags.GENERAL_MASK | RenderFlags.REGION_MASK | (RenderFlags.REGION_MASK << REGION_FLAGS_SHIFT);
		}
		this.#highlightCanvas.width = width;
		this.#highlightCanvas.height = height;

		this.#nextRenderFlags |= this.#leftRegion.updateLayout();
		this.#nextRenderFlags |= this.#rightRegion.updateLayout() << REGION_FLAGS_SHIFT;
	}

	updateMousePosition(x: number, y: number) {
		this.#mouseX = x - this.#canvasX;
		this.#mouseY = y - this.#canvasY;
		//this.hitTest(x, y);
		this.#invalidate(RenderFlags.HIT_TEST);
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

	#render(time: number) {
		// prepare
		this.#stage = RenderStage.Prepare;
		this.#callbacks.prepare?.(time);

		if (this.#nextRenderFlags & RenderFlags.LAYOUT) {
			this.#updateLayout();
		}

		let leftRegionFlags = this.#nextRenderFlags & RenderFlags.REGION_MASK;
		let rightRegionFlags = (this.#nextRenderFlags >> REGION_FLAGS_SHIFT) & RenderFlags.REGION_MASK;

		let leftDiffVisibilityChangeEntries: VisibilityChangeEntry[] | null = null;
		let rightDiffVisibilityChangeEntries: VisibilityChangeEntry[] | null = null;

		if (leftRegionFlags) {
			this.#leftRegion.prepare(leftRegionFlags);
			if (leftRegionFlags & RenderFlags.DIFF_LAYER) {
				leftDiffVisibilityChangeEntries = this.#updateVisibleDiffIndices(this.#visibleDiffIndices.left, this.#leftRegion.visibleDiffIndices);
			}
		}
		if (rightRegionFlags) {
			this.#rightRegion.prepare(rightRegionFlags);
			if (rightRegionFlags & RenderFlags.DIFF_LAYER) {
				rightDiffVisibilityChangeEntries = this.#updateVisibleDiffIndices(this.#visibleDiffIndices.right, this.#rightRegion.visibleDiffIndices);
			}
		}

		if (this.#nextRenderFlags & RenderFlags.HIT_TEST) {
			this.hitTest(this.#mouseX, this.#mouseY);
		}

		// draw
		this.#callbacks.draw?.(time);

		this.#stage = RenderStage.Draw;
		leftRegionFlags |= this.#nextRenderFlags & RenderFlags.REGION_MASK;
		rightRegionFlags |= (this.#nextRenderFlags >> REGION_FLAGS_SHIFT) & RenderFlags.REGION_MASK;
		this.#nextRenderFlags = RenderFlags.NONE;

		if (leftRegionFlags) {
			this.#leftRegion.render(leftRegionFlags);
		}
		if (rightRegionFlags) {
			this.#rightRegion.render(rightRegionFlags);
		}

		this.#stage = RenderStage.Idle;
		if (this.#nextRenderFlags !== RenderFlags.NONE) {
			// If there are still flags to render, schedule another render
			this.queueRender();
		}

		// 실제로 변경내역이 있을 때에만 이벤트 발생
		if (leftDiffVisibilityChangeEntries?.length || rightDiffVisibilityChangeEntries?.length) {
			this.#callbacks.diffVisibilityChanged?.({
				left: leftDiffVisibilityChangeEntries ?? [],
				right: rightDiffVisibilityChangeEntries ?? [],
			});
		}
	}

	#updateVisibleDiffIndices(set: Set<number>, newSet: Set<number>): VisibilityChangeEntry[] {
		const result: VisibilityChangeEntry[] = [];

		for (const index of set) {
			if (!newSet.has(index)) {
				set.delete(index);
				result.push({ item: index, isVisible: false });
			}
		}

		let prevSize = set.size;
		for (const index of newSet) {
			set.add(index);
			if (set.size > prevSize) {
				result.push({ item: index, isVisible: true });
				prevSize++;
			}
		}

		return result;
	}

	invalidateAll() {
		this.#invalidate(RenderFlags.GENERAL_MASK | RenderFlags.REGION_MASK | (RenderFlags.REGION_MASK << REGION_FLAGS_SHIFT));
	}

	invalidateLayout() {
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
				empty: diff.leftSpan.end === diff.leftSpan.start,
			};
			rightDiffs[i] = {
				diffIndex: i,
				range: rightRange,
				hue: diff.hue,
				empty: diff.rightSpan.end === diff.rightSpan.start,
			};
		}

		this.#leftRegion.setDiffs(leftDiffs);
		this.#rightRegion.setDiffs(rightDiffs);
		this.invalidateGeometries();
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
			let region: RenderRegion | null = null;
			if (
				x >= this.#leftRegion.regionX &&
				x < this.#leftRegion.regionX + this.#leftRegion.regionWidth &&
				y >= this.#leftRegion.regionY &&
				y < this.#leftRegion.regionY + this.#leftRegion.regionHeight
			) {
				region = this.#leftRegion;
			} else if (this.#rightRegion && x >= this.#rightRegion.regionX) {
				region = this.#rightRegion;
			}

			let diffIndex: number | null = null;
			let guideLineY = -1;
			if (region) {
				diffIndex = region.hitTest(x - region.regionX, y - region.regionY);
				guideLineY = y - region.regionY;
			}

			if (diffIndex !== this.#hoveredDiffIndex || region?.name !== this.#hoveredRegion) {
				this.#hoveredDiffIndex = diffIndex;
				this.#hoveredRegion = region?.name ?? null;
				this.setHoveredDiffIndex(diffIndex, region?.name);
			}

			if (this.#guideLineEnabled && this.#guideLineY !== guideLineY) {
				this.#guideLineY = guideLineY;
				this.invalidateHighlightLayer();
			}
		}

		return diffIndex;
	}

	getDiffRect(which: EditorName, diffIndex: number): Rect | null {
		const region = which === "left" ? this.#leftRegion : this.#rightRegion;
		return region?.getDiffRect(diffIndex) ?? null;
	}

	isDiffVisible(which: EditorName, diffIndex: number): boolean {
		const region = which === "left" ? this.#leftRegion : this.#rightRegion;
		return region.visibleDiffIndices.has(diffIndex);
	}
}

class RenderRegion {
	#name: "left" | "right";
	#renderer: Renderer;
	#viewport: RenderViewport;
	#diffs: DiffRenderItem[] = [];
	#diffGeometries: RectSet[] = [];
	#diffLineRects: Rect[] = [];
	#selectionHighlight: Range | null = null;
	#selectionHighlightRects: RectSet | null = null;
	//dirtyFlags: RenderFlags = RenderFlags.NONE;
	#visibleDiffIndices: Set<number> = new Set();
	#visibleDiffIndicesArr: number[] = [];
	#ctx: CanvasRenderingContext2D;
	#highlightCtx: CanvasRenderingContext2D;
	regionX: number = 0;
	regionY: number = 0;
	regionWidth: number = 0;
	regionHeight: number = 0;
	highlightedDiffIndex: number | null = null;
	#scrollTop: number = 0;
	#scrollLeft: number = 0;

	constructor(name: "left" | "right", renderer: Renderer, viewport: RenderViewport, ctx: CanvasRenderingContext2D, highlightCtx: CanvasRenderingContext2D) {
		this.#name = name;
		this.#renderer = renderer;
		this.#ctx = ctx;
		this.#highlightCtx = highlightCtx;
		this.#viewport = viewport;
	}

	updateLayout(): RenderFlags {
		let { x, y, width, height } = this.#viewport.getBoundingClientRect();
		const [scrollLeft, scrollTop] = this.#viewport.getScroll();

		const renderer = this.#renderer;
		x -= renderer.x;
		y -= renderer.y;

		let ret = RenderFlags.NONE;
		if (this.regionX !== x || this.regionY !== y || this.regionWidth !== width || this.regionHeight !== height) {
			renderer.invalidateGeometries(this.#name);
			ret = RenderFlags.RESIZE;
		} else if (this.#scrollLeft !== scrollLeft || this.#scrollTop !== scrollTop) {
			renderer.invalidateScroll(this.#name);
			ret = RenderFlags.SCROLL;
		}

		this.regionX = x;
		this.regionY = y;
		this.regionWidth = width;
		this.regionHeight = height;
		this.#scrollLeft = scrollLeft;
		this.#scrollTop = scrollTop;

		return ret;
	}

	updateScroll(scrollTop: number, scrollLeft: number) {
		if (this.#scrollTop !== scrollTop || this.#scrollLeft !== scrollLeft) {
			this.#scrollTop = scrollTop;
			this.#scrollLeft = scrollLeft;
			this.#renderer.invalidateScroll(this.#name);
		}
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
		this.#visibleDiffIndices.clear();
		//this.#selectionHighlight = null;
	}

	setHighlightedDiffIndex(diffIndex: number | null) {
		if (this.highlightedDiffIndex === diffIndex) {
			return false; // No change
		}

		let wasShown = this.highlightedDiffIndex !== null && this.visibleDiffIndices.has(this.highlightedDiffIndex);
		let shouldShow = diffIndex !== null && (!this.#diffGeometries[diffIndex] || this.visibleDiffIndices.has(diffIndex));
		this.highlightedDiffIndex = diffIndex;

		if (wasShown || shouldShow) {
			//console.log(`Invalidating highlight layer for ${this.#name} region due to highlighted diff change.`);
			this.#renderer.invalidateDiffLayer(this.#name);
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
		[this.#scrollLeft, this.#scrollTop] = this.#viewport.getScroll();

		const diffGeometries = this.#diffGeometries;
		const visibleDiffIndices = this.#visibleDiffIndices;
		const diffs = this.#diffs;
		const newGeometryRects: Rect[] = [];

		visibleDiffIndices.clear();
		if (dirtyFlags & RenderFlags.GEOMETRY) {
			diffGeometries.length = 0;
			this.#diffLineRects.length = 0;
		}

		const scrollTop = this.#scrollTop;
		const scrollLeft = this.#scrollLeft;

		const canvasX = this.#renderer.x;
		const canvasY = this.#renderer.y;
		const offsetTop = -this.regionY - canvasY + scrollTop;
		const offsetLeft = -this.regionX - canvasX + scrollLeft;
		const regionHeight = this.regionHeight;
		const { diffExpandX, diffExpandY } = this.#renderer.getOptions().geometry;

		for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
			let geometry = diffGeometries[diffIndex];

			if (!geometry) {
				// geometry 정보가 전혀 없음.
				// rough한 rect만 추출. 어차피 이 rect가 렌더 조건을 통과하게되면 더 정밀한 rect들을 추출하고 다시 테스트를 해봐야되므로 rough한 rect추출은 의미 없어보일 수 있지만
				// 문서가 크고 diff가 많은 경우은 확실히 이득이 있을 것이다. extractRects()는 정말 무거운 작업임.
				const diff = diffs[diffIndex];
				const wholeRect = diff.range.getBoundingClientRect();
				const x = wholeRect.x + offsetLeft - diffExpandX,
					y = wholeRect.y + offsetTop - diffExpandY,
					width = wholeRect.width + diffExpandX * 2,
					height = wholeRect.height + diffExpandY * 2;
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

			if (
				geometry.maxY - scrollTop < 0 ||
				geometry.minY - scrollTop > regionHeight ||
				geometry.maxX - scrollLeft < 0 ||
				geometry.minX - scrollLeft > this.regionWidth
			) {
				// if (visibleDiffIndices.delete(diffIndex)) {
				// 	diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: false });
				// }
				continue;
			}

			// rough test를 통과했으므로 이제 완벽한 rects 필요.
			if (geometry.rects === null) {
				const rangeRects = this.#extractRectsFromRange(
					diffs[diffIndex].range,
					offsetLeft,
					offsetTop,
					diffExpandX,
					diffExpandY,
					diffs[diffIndex].empty
				);
				// let added = false;
				for (const rect of rangeRects) {
					// rect.x += offsetLeft - DIFF_EXPAND_X;
					// rect.y += offsetTop - DIFF_EXPAND_Y;
					// rect.width += DIFF_EXPAND_X * 2;
					// rect.height += DIFF_EXPAND_Y * 2;
					newGeometryRects.push(rect);

					// 이왕 루프를 도는김에 여기서 visibility 체크를 하려고 했지만..
					// 뭐 얼마 차이나지 않을 것 같으니 rects를 완전히 만든 후에 y좌표로 정렬된 배열을 가지고 테스트 하는 걸로..
					// if (!added && rect.y + rect.height >= 0 && rect.y <= regionHeight) {
					// 	visibleDiffIndices.add(diffIndex);
					// 	added = true;
					// }
				}

				diffGeometries[diffIndex] = geometry = mergeRects(rangeRects, 1, 1) as RectSet;
			}

			for (const rect of geometry.rects!) {
				if (rect.y + rect.height - scrollTop < 0) continue;
				if (rect.y - scrollTop > regionHeight) break; // rect들은 y좌표로 정렬되어 있으므로 조기 탈출 가능.
				visibleDiffIndices.add(diffIndex);
				break;
			}
		}

		// 새로 만들어진 rect들에 대해서 line rect들을 만들어야함.
		if (newGeometryRects.length > 0) {
			this.#mergeIntoDiffLineRects(newGeometryRects);
		}

		// hittest용 visibleDiffIndices 배열인데... 의미가 있을까 싶지만(set에 대해 for of 루프를 돌려도되니까) 일단 그냥 냅둠.
		// 배열이 더 빠르지 않겠어? 특히 hittest는 마우스 움직이는 동안 매 프레임 발생해야하므로...
		const arr = this.#visibleDiffIndicesArr;
		arr.length = 0;
		let i = 0;
		for (const index of visibleDiffIndices) {
			arr[i++] = index;
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
		ctx.beginPath();
		ctx.rect(0, 0, this.regionWidth, this.regionHeight);
		ctx.clip();

		const diffGeometries = this.#diffGeometries;
		const diffsToRender = this.#visibleDiffIndicesArr;
		// const diffVisibilityChangeEntries = this.diffVisibilityChangeEntries;
		// const visibleDiffIndices = this.#visibleDiffIndices;
		const diffs = this.#diffs;
		const scrollTop = this.#scrollTop;
		const scrollLeft = this.#scrollLeft;
		const regionHeight = this.regionHeight;
		const diffStyles = this.#renderer.getOptions().styles.diff;

		ctx.fillStyle = diffStyles.line.fill;
		for (const diffLineRect of this.#diffLineRects) {
			const x = Math.floor(diffLineRect.x - scrollLeft),
				y = Math.floor(diffLineRect.y - scrollTop),
				width = Math.ceil(diffLineRect.width),
				height = Math.ceil(diffLineRect.height);

			if (y + height < 0) continue;
			if (y > regionHeight) break;
			ctx.fillRect(x, y, width, height);
		}

		const diffNormalStyles = diffStyles.normal;
		for (const diffIndex of diffsToRender) {
			const geometry = diffGeometries[diffIndex]!;

			// 하이라이트된 diff를 하이라이트 레이어에 그리지 않고 이 레이어에서 처리하는게 느낌이 좋지 않지만
			// 이걸 하이라이트 레이어에 그려버리게 되면 하이라이트 레이어는 에디터보다 반드시 낮은 z-index를 가져야한다는 제약이 생김
			// 그리고 렌더링 코드는 거의 동일...
			if (this.highlightedDiffIndex === diffIndex) {
				const { fill, stroke } = diffStyles.highlight;
				ctx.fillStyle = fill;
				ctx.strokeStyle = stroke;
			} else {
				ctx.fillStyle = `hsl(${diffs[diffIndex].hue} ${diffNormalStyles.fillSaturation}% ${diffNormalStyles.fillLightness}% / ${diffNormalStyles.fillAlpha})`;
				ctx.strokeStyle = `hsl(${diffs[diffIndex].hue} ${diffNormalStyles.strokeSaturation}% ${diffNormalStyles.strokeLightness}% / ${diffNormalStyles.strokeAlpha})`;
			}

			// let rendered = false;
			for (const rect of geometry.rects!) {
				const x = Math.floor(rect.x - scrollLeft),
					y = Math.floor(rect.y - scrollTop),
					width = Math.ceil(rect.width),
					height = Math.ceil(rect.height);

				if (y + height < 0) continue;
				if (y > regionHeight) break;

				// ctx.strokeRect(x, y, width, height);
				ctx.fillRect(x, y, width, height);
				// rendered = true;
			}

			// if (rendered) {
			// 	const prevCount = visibleDiffIndices.size;
			// 	visibleDiffIndices.add(diffIndex);
			// 	if (visibleDiffIndices.size > prevCount) {
			// 		diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: true });
			// 	}
			// } else {
			// 	if (visibleDiffIndices.delete(diffIndex)) {
			// 		diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: false });
			// 	}
			// }
		}

		// if (diffVisibilityChangeEntries.length > 0) {
		// 	// console.warn(`[RenderRegion] Visibility change entries for ${this.#name} region:`, visChangeEntries);
		// 	this.#callbacks.onDiffVisibilityChanged(this.#name, diffVisibilityChangeEntries);
		// 	// diffVisibilityChangedEvent.emit({ editor: this.#name, entries: diffVisibilityChangeEntries });
		// }

		//this.#shouldClearCanvas = renderedAny;
		ctx.restore();
	}

	renderHighlightLayer(dirtyFlags: RenderFlags) {
		//console.log(`[RenderRegion] Rendering highlight layer for ${this.#name} region with flags: ${dirtyFlags}`);
		const ctx = this.#highlightCtx;
		ctx.save();
		ctx.translate(this.regionX, this.regionY);
		ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);
		ctx.beginPath();
		ctx.rect(0, 0, this.regionWidth, this.regionHeight);
		ctx.clip();

		const regionWidth = this.regionWidth;
		const regionHeight = this.regionHeight;
		const scrollTop = this.#scrollTop;
		const scrollLeft = this.#scrollLeft;

		// if (this.highlightedDiffIndex !== null) {
		// 	const rects = this.#diffGeometries[this.highlightedDiffIndex];
		// 	if (rects && rects.rects) {
		// 		let isVisible =
		// 			!(rects.maxY - scrollTop < 0 || rects.minY - scrollTop > regionHeight) &&
		// 			!(rects.maxX - scrollLeft < 0 || rects.minX - scrollLeft > regionWidth);
		// 		if (isVisible) {
		// 			// console.debug(`[RenderRegion] Rendering highlighted diff rects for ${this.#name} region at index ${this.#highlightedDiffIndex}.`, rects);

		// 			ctx.lineWidth = 2;
		// 			ctx.fillStyle = `hsl(0 100% 80%)`;
		// 			ctx.strokeStyle = `hsl(0 100% 50% / 0.5)`;
		// 			// ctx.strokeStyle = `hsl(${diff.hue} 100% 50% / 0.5)`;

		// 			for (const rect of rects.rects) {
		// 				const x = Math.floor(rect.x - scrollLeft),
		// 					y = Math.floor(rect.y - scrollTop),
		// 					width = Math.ceil(rect.width),
		// 					height = Math.ceil(rect.height);

		// 				if (y + height < 0 || y > regionHeight) continue;
		// 				if (x + width < 0 || x > regionWidth) continue;

		// 				//ctx.strokeRect(x, y, width, height);
		// 				ctx.fillRect(x, y, width, height);

		// 				// ctx.lineWidth = 2;
		// 				// ctx.strokeStyle = "white";
		// 				// ctx.shadowBlur = 0;
		// 				// ctx.shadowColor = "transparent";
		// 				// ctx.strokeRect(x-1, y-1, width + 2, height + 2);
		// 			}
		// 			ctx.lineWidth = 1;
		// 		}
		// 	}
		// 	// ctx.shadowBlur = 0;
		// 	// ctx.strokeStyle = "transparent";
		// }

		if (this.#selectionHighlight) {
			if (!this.#selectionHighlightRects || dirtyFlags & RenderFlags.GEOMETRY) {
				const offsetX = -this.regionX + scrollLeft;
				const offsetY = -this.regionY + scrollTop;
				const rawRects = this.#extractRectsFromRange(this.#selectionHighlight, offsetX, offsetY, 0, 0, false);
				const mergedRect = mergeRects(rawRects, 1, 1) as RectSet;
				this.#selectionHighlightRects = mergedRect;
			}

			let geometry = this.#selectionHighlightRects!;
			let isVisible =
				!(geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > regionHeight) &&
				!(geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > regionWidth);
			if (isVisible) {
				ctx.fillStyle = this.#renderer.getOptions().styles.selection.fill;
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

		if (this.#renderer.guideLineEnabled && this.#renderer.guideLineY >= 0) {
			const guideLineY = this.#renderer.guideLineY + 0.5; // +0.5는 픽셀 정렬을 위해. 안 그러면 흐려짐
			ctx.beginPath();
			ctx.moveTo(0, guideLineY);
			ctx.lineTo(this.regionWidth, guideLineY);
			ctx.strokeStyle = this.#renderer.getOptions().styles.guideline.stroke;
			ctx.lineWidth = 1;
			ctx.stroke();
		}

		ctx.restore();
	}

	#mergeIntoDiffLineRects(incoming: Rect[]): void {
		const TOLERANCE = 1;
		const regionWidth = this.regionWidth;
		const allRects: Rect[] = [];

		for (const rect of this.#diffLineRects) {
			allRects.push(rect);
		}

		const { diffLineHeightMultiplier, diffLineExpandY } = this.#renderer.getOptions().geometry;
		for (const rect of incoming) {
			const height = rect.height * diffLineHeightMultiplier + diffLineExpandY * 2;
			const heightDelta = height - rect.height;
			const y = rect.y - heightDelta / 2;

			allRects.push({
				x: 0,
				y,
				width: regionWidth,
				height,
			});
		}

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
		x += this.#scrollLeft;
		y += this.#scrollTop;
		for (const diffIndex of this.#visibleDiffIndicesArr) {
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

	#extractRectsFromRange(range: Range, offsetLeft: number, offsetTop: number, expandX = 0, expandY = 0, emptyDiff = false): Rect[] {
		const result: Rect[] = [];
		const tempRange = document.createRange();

		let startNode: Node | null;

		if (range.startContainer.nodeType === 3) {
			tempRange.setStart(range.startContainer, range.startOffset);
			if (emptyDiff) {
				tempRange.collapse(true);
			} else {
				if (range.startContainer === range.endContainer) {
					tempRange.setEnd(range.startContainer, range.endOffset);
				} else {
					tempRange.setEnd(range.startContainer, range.startContainer.nodeValue!.length);
				}
			}
			for (const rect of tempRange.getClientRects()) {
				result.push({
					x: rect.x + offsetLeft - expandX,
					y: rect.y + offsetTop - expandY,
					width: rect.width + expandX * 2,
					height: rect.height + expandY * 2,
				});
				if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
			}
			startNode = advanceNode(range.startContainer)!;
		} else {
			startNode = range.startContainer.childNodes[range.startOffset] ?? advanceNode(range.startContainer, null, true);
			if (!startNode) return result;
		}

		const endContainer = range.endContainer;
		let endOffset: number;
		let endNode: Node;
		if (endContainer.nodeType === 3) {
			endNode = endContainer;
			endOffset = range.endOffset;
		} else {
			endNode = endContainer.childNodes[range.endOffset] ?? advanceNode(endContainer, null, true)!;
			endOffset = -1;
		}

		if (!startNode || !endNode || endNode.compareDocumentPosition(startNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
			return result;
		}

		const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
		walker.currentNode = startNode;

		do {
			const node = walker.currentNode;
			if (!node) break;

			if (node === endNode) {
				if (node.nodeType === 3 && endOffset >= 0) {
					tempRange.setStart(endNode, 0);
					emptyDiff ? tempRange.collapse(true) : tempRange.setEnd(endNode, endOffset);
					for (const rect of tempRange.getClientRects()) {
						result.push({
							x: rect.x + offsetLeft - expandX,
							y: rect.y + offsetTop - expandY,
							width: rect.width + expandX * 2,
							height: rect.height + expandY * 2,
						});
						if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
					}
				}
				break;
			}

			if (node.nodeType === 3) {
				tempRange.selectNodeContents(node);
				for (const rect of tempRange.getClientRects()) {
					result.push({
						x: rect.x + offsetLeft - expandX,
						y: rect.y + offsetTop - expandY,
						width: rect.width + expandX * 2,
						height: rect.height + expandY * 2,
					});
				}
			} else if (node.nodeName === "BR") {
				// no-op
			} else if (node.nodeName === DIFF_TAG_NAME) {
				if (emptyDiff) {
					const tempText = document.createTextNode("\u200B");
					node.appendChild(tempText);
					tempRange.selectNodeContents(tempText);
					for (const rect of tempRange.getClientRects()) {
						result.push({
							x: rect.x + offsetLeft - expandX,
							y: rect.y + offsetTop - expandY,
							width: rect.width + expandX * 2,
							height: rect.height + expandY * 2,
						});
					}
					tempText.remove();
				} else {
					if ((node as HTMLElement).classList.contains(MANUAL_ANCHOR_CLASS_NAME)) {
						tempRange.selectNode(node as HTMLElement);
						for (const rect of (node as HTMLElement).getClientRects()) {
							result.push({
								x: rect.x + offsetLeft - expandX,
								y: rect.y + offsetTop - expandY,
								width: rect.width + expandX * 2,
								height: rect.height + expandY * 2,
							});
						}
					}
				}
			} else if (node.nodeName === "IMG") {
				tempRange.selectNode(node);
				for (const rect of tempRange.getClientRects()) {
					result.push({
						x: rect.x + offsetLeft - expandX,
						y: rect.y + offsetTop - expandY,
						width: rect.width + expandX * 2,
						height: rect.height + expandY * 2,
					});
				}
			}
		} while (walker.nextNode());

		return result;
	}
}
