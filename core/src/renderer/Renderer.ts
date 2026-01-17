import type { RenderedDiff, EditorName, Rect, DiffVisibilityChangeEntry } from "../types";
import { deepMerge } from "../utils/deepMerge";
import { Editor } from "../editor/Editor";
import type { DiffRenderItem } from "./types";
import { REGION_FLAGS_SHIFT, RenderFlags } from "./RenderFlags";
import { EditorRegion } from "./EditorRegion";

export const defaultRendererOptions = {
    diffSaturation: 100,
    diffLightness: 80,
    diffAlpha: 1,

    diffHighlightColor: "hsl(0 100% 80%)",
    diffLineColor: "hsl(0 100% 90% / 0.5)",

    // overlays
    selectionColor: "hsl(0 0% 50% / 0.3)",
    guidelineColor: "hsl(0 0% 50% / 0.3)",

    // geometry
    diffExpandX: 2,
    diffExpandY: 2,
    diffLineExpandY: 0,
    diffLineHeightMultiplier: 1,

    // minimap
    minimapEnabled: true,
    minimapWidth: 15,
    minimapColor: "hsl(0 100% 50% / 0.4)",
};

export type RendererOptions = typeof defaultRendererOptions;

const enum RenderStage {
    Idle = 0,
    Prepare = 1,
    Draw = 2,
}

export type DiffVisibilityChangedCallback = (changes: Record<EditorName, DiffVisibilityChangeEntry[]>) => void;

export type HoveredDiffIndexChangedCallback = (diffIndex: number | null) => void;

export type RendererCallbacks = {
    prepare: (time: number) => void;
    draw: (time: number) => void;
    diffVisibilityChanged: DiffVisibilityChangedCallback;
    hoveredDiffIndexChanged: HoveredDiffIndexChangedCallback;
};

export class Renderer {
    readonly rootElement: HTMLElement;
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;
    readonly highlightCanvas: HTMLCanvasElement;
    readonly highlightCtx: CanvasRenderingContext2D;

    options: RendererOptions;
    leftRegion: EditorRegion;
    rightRegion: EditorRegion;
    canvasX: number = 0;
    canvasY: number = 0;
    canvasWidth: number = 0;
    canvasHeight: number = 0;

    // 레이아웃 업데이트 시에 이전 값 비교 용도로만 사용. 렌더링 시에는 사용하면 안됨.
    scaledWidth: number = 0;
    scaledHeight: number = 0;


    renderCallbackId: number | null = null;
    nextRenderFlags: RenderFlags = RenderFlags.NONE;
    mouseX: number = -1;
    mouseY: number = -1;
    syncMode: boolean = false;
    _guideLineY: number = -1;
    stage: RenderStage = RenderStage.Idle;
    callbacks: Partial<RendererCallbacks> = {};
    hoveredDiffIndex: number | null = null;
    hoveredRegion: EditorName | null = null;
    highlightedDiffIndex: number | null = null;
    readonly visibleDiffIndices: Record<EditorName, Set<number>> = {
        left: new Set(),
        right: new Set(),
    };
    minimapEnabled: boolean = false;

    constructor(left: Editor, right: Editor, options?: Partial<RendererOptions>) {
        this.options = { ...defaultRendererOptions, ...options };
        this.rootElement = document.createElement("div");
        this.rootElement.className = "ds-renderer";

        this.canvas = document.createElement("canvas");
        this.canvas.className = "ds-diff-layer";
        this.ctx = this.canvas.getContext("2d")!;

        this.highlightCanvas = document.createElement("canvas");
        this.highlightCanvas.className = "ds-highlight-layer";
        this.highlightCtx = this.highlightCanvas.getContext("2d")!;

        this.leftRegion = new EditorRegion(this, left);
        this.rightRegion = new EditorRegion(this, right);

        this.rootElement.appendChild(this.canvas);
        this.rootElement.appendChild(this.highlightCanvas);
        this.ctx.imageSmoothingEnabled = false;
        this.highlightCtx.imageSmoothingEnabled = false;
    }

    setOptions(newOptions: Partial<RendererOptions>) {
        deepMerge(this.options, newOptions);
    }

    getOptions(): RendererOptions {
        return this.options;
    }

    setCallbacks(callbacks: Partial<RendererCallbacks>) {
        Object.assign(this.callbacks, callbacks);
    }

    setSyncMode(enabled: boolean) {
        this.syncMode = enabled;
    }

    get x() {
        return this.canvasX;
    }

    get y() {
        return this.canvasY;
    }

    get width() {
        return this.canvasWidth;
    }

    get height() {
        return this.canvasHeight;
    }

    get guideLineY() {
        return this._guideLineY;
    }

    handleResize() {
        this.updateLayout();
    }

    setDiffHighlight(diffIndex: number | null) {
        this.highlightedDiffIndex = diffIndex;
        this.updateHighlightedDiffIndex();
    }

    setHoveredDiffIndex(diffIndex: number | null, region?: EditorName) {
        this.hoveredDiffIndex = diffIndex;
        this.hoveredRegion = region ?? null;
        this.updateHighlightedDiffIndex();
        this.callbacks.hoveredDiffIndexChanged?.(diffIndex);
    }

    updateHighlightedDiffIndex() {
        const actualDiffIndex = this.hoveredDiffIndex ?? this.highlightedDiffIndex ?? null;
        const l = this.leftRegion.setHighlightedDiffIndex(actualDiffIndex);
        const r = this.rightRegion.setHighlightedDiffIndex(actualDiffIndex);
        this.nextRenderFlags |= l | (r << REGION_FLAGS_SHIFT);
    }

    get isSyncMode() {
        return this.syncMode;
    }

    set isSyncMode(enabled: boolean) {
        enabled = !!enabled;
        if (this.syncMode === enabled) {
            return; // No change
        }

        this.syncMode = enabled;
        this._guideLineY = -1;
        if (enabled) {
            this.invalidateHighlightLayer();
        }
    }

    updateLayout() {
        if (!this.rootElement) {
            return;
        }

        const { x, y, width, height } = this.rootElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const scaledWidth = (width * dpr) | 0;
        const scaledHeight = (height * dpr) | 0;

        this.canvasX = x;
        this.canvasY = y;
        this.canvasWidth = width;
        this.canvasHeight = height;

        if (this.scaledWidth !== scaledWidth || this.scaledHeight !== scaledHeight) {
            this.scaledWidth = scaledWidth;
            this.scaledHeight = scaledHeight;
            this.canvas.width = this.highlightCanvas.width = scaledWidth;
            this.canvas.height = this.highlightCanvas.height = scaledHeight;
            this.nextRenderFlags = RenderFlags.GENERAL_MASK
                | RenderFlags.REGION_MASK
                | (RenderFlags.REGION_MASK << REGION_FLAGS_SHIFT)
        }

        this.nextRenderFlags |= this.leftRegion.updateLayout();
        this.nextRenderFlags |= this.rightRegion.updateLayout() << REGION_FLAGS_SHIFT;

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.highlightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    updateMousePosition(x: number, y: number) {
        this.mouseX = x - this.canvasX;
        this.mouseY = y - this.canvasY;
        //this.hitTest(x, y);
        this.invalidate(RenderFlags.HIT_TEST);
    }

    queueRender() {
        if (this.suspended) {
            return;
        }

        if (this.renderCallbackId !== null) {
            //console.log("already pending...");
            // Already pending
            // 가장 마지막에 실행되도록 기존 콜백을 취소하고 다시 등록하면 어떨까...?
            return;
        }

        // console.debug(`Queueing render with flags: ${this.renderFlagsToString(this.nextRenderFlags)}`);
        this.renderCallbackId = requestAnimationFrame((ts) => {
            this.renderCallbackId = null;
            this.render(ts);
        });
    }

    cancelRender() {
        if (this.renderCallbackId !== null) {
            cancelAnimationFrame(this.renderCallbackId);
            this.renderCallbackId = null;
            this.nextRenderFlags = RenderFlags.NONE;
            this.stage = RenderStage.Idle;
        }
    }

    render(time: number) {
        if (this.suspended) {
            return;
        }

        // prepare
        this.stage = RenderStage.Prepare;
        this.callbacks.prepare?.(time);

        if (this.nextRenderFlags & RenderFlags.LAYOUT) {
            this.updateLayout();
        }

        let leftRegionFlags = this.nextRenderFlags & RenderFlags.REGION_MASK;
        let rightRegionFlags = (this.nextRenderFlags >> REGION_FLAGS_SHIFT) & RenderFlags.REGION_MASK;

        let leftDiffVisibilityChangeEntries: DiffVisibilityChangeEntry[] | null = null;
        let rightDiffVisibilityChangeEntries: DiffVisibilityChangeEntry[] | null = null;

        if (leftRegionFlags) {
            this.leftRegion.prepare(leftRegionFlags);
            if (leftRegionFlags & RenderFlags.DIFF_LAYER) {
                leftDiffVisibilityChangeEntries = this.updateVisibleDiffIndices(this.visibleDiffIndices.left, this.leftRegion.visibleDiffIndices);
            }
        }
        if (rightRegionFlags) {
            this.rightRegion.prepare(rightRegionFlags);
            if (rightRegionFlags & RenderFlags.DIFF_LAYER) {
                rightDiffVisibilityChangeEntries = this.updateVisibleDiffIndices(this.visibleDiffIndices.right, this.rightRegion.visibleDiffIndices);
            }
        }

        //console.log(this.workspaceEl.getBoundingClientRect(), this.workspaceEl.scrollTop);

        if (this.nextRenderFlags & RenderFlags.HIT_TEST) {
            this.hitTest(this.mouseX, this.mouseY);
        }

        // draw
        this.callbacks.draw?.(time);

        this.stage = RenderStage.Draw;
        leftRegionFlags |= this.nextRenderFlags & RenderFlags.REGION_MASK;
        rightRegionFlags |= (this.nextRenderFlags >> REGION_FLAGS_SHIFT) & RenderFlags.REGION_MASK;
        this.nextRenderFlags = RenderFlags.NONE;

        if (leftRegionFlags) {
            this.leftRegion.render(leftRegionFlags);
        }
        if (rightRegionFlags) {
            this.rightRegion.render(rightRegionFlags);
        }

        if (this.isSyncMode && this.guideLineY >= 0) {
            this.drawGuideLine(this.highlightCtx);
        }

        this.stage = RenderStage.Idle;
        if (this.nextRenderFlags !== RenderFlags.NONE) {
            // If there are still flags to render, schedule another render
            this.queueRender();
        }

        // 실제로 변경내역이 있을 때에만 이벤트 발생
        if (leftDiffVisibilityChangeEntries?.length || rightDiffVisibilityChangeEntries?.length) {
            this.callbacks.diffVisibilityChanged?.({
                left: leftDiffVisibilityChangeEntries ?? [],
                right: rightDiffVisibilityChangeEntries ?? [],
            });
        }
    }

    updateVisibleDiffIndices(set: Set<number>, newSet: Set<number>): DiffVisibilityChangeEntry[] {
        const result: DiffVisibilityChangeEntry[] = [];

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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.highlightCtx.clearRect(0, 0, this.highlightCanvas.width, this.highlightCanvas.height);
        this.invalidate(RenderFlags.GENERAL_MASK | RenderFlags.REGION_MASK | (RenderFlags.REGION_MASK << REGION_FLAGS_SHIFT));
    }

    invalidateLayout() {
        this.invalidate(RenderFlags.LAYOUT);
    }

    invalidateDiffLayer(which?: "left" | "right" | undefined) {
        return this.invalidateRegion(RenderFlags.DIFF_LAYER, which);
    }

    invalidateHighlightLayer(which?: "left" | "right" | undefined) {
        return this.invalidateRegion(RenderFlags.HIGHLIGHT_LAYER, which);
    }

    invalidateGeometries(which?: "left" | "right" | undefined) {
        return this.invalidateRegion(RenderFlags.GEOMETRY, which);
    }

    invalidateScroll(which?: "left" | "right" | undefined) {
        return this.invalidateRegion(RenderFlags.SCROLL, which);
    }

    invalidate(flags: RenderFlags) {
        this.nextRenderFlags |= flags;
        if (this.stage === RenderStage.Idle) {
            this.queueRender();
        } else if (this.stage === RenderStage.Prepare) {
            // we are already in rendering cycle, just set the flags
        } else if (this.stage === RenderStage.Draw) {
            // 렌더링 중이라면 렌더링이 끝난 후 flags가 None이 아닐 때 render()가 다시 호출됨.
            // 여기서는 아무것 할 게 없음
        }
    }

    invalidateRegion(flags: RenderFlags, which?: "left" | "right") {
        if (which === "right") {
            flags <<= REGION_FLAGS_SHIFT;
        } else if (!which) {
            flags |= flags << REGION_FLAGS_SHIFT;
        }
        this.invalidate(flags);
    }

    setDiffs(diffs: RenderedDiff[]) {
        const leftDiffs: DiffRenderItem[] = new Array(diffs.length);
        const rightDiffs: DiffRenderItem[] = new Array(diffs.length);

        const { diffSaturation, diffLightness, diffAlpha } = this.options;
        for (let i = 0; i < diffs.length; i++) {
            const diff = diffs[i];
            const leftRange = diff.leftRange;
            const rightRange = diff.rightRange;
            const color = `hsl(${diff.hue} ${diffSaturation}% ${diffLightness}% / ${diffAlpha})`;
            leftDiffs[i] = {
                diffIndex: i,
                range: leftRange,
                color,
                empty: diff.leftSpan.end === diff.leftSpan.start,
            };
            rightDiffs[i] = {
                diffIndex: i,
                range: rightRange,
                color,
                empty: diff.rightSpan.end === diff.rightSpan.start,
            };
        }

        this.leftRegion.setDiffs(leftDiffs);
        this.rightRegion.setDiffs(rightDiffs);
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

        this.leftRegion.setSelectionHighlight(leftRange);
        this.rightRegion.setSelectionHighlight(rightRange);
    }

    hitTest(x: number, y: number): number | null {
        // console.log("hitTest", x, y);
        let diffIndex: number | null = null;
        if (x < 0 || y < 0) {
            //
        } else if (x > this.canvasWidth || y > this.canvasHeight) {
            //
        } else {
            let region: EditorRegion | null = null;

            if (
                x >= this.leftRegion.regionX &&
                x < this.leftRegion.regionX + this.leftRegion.regionWidth &&
                y >= this.leftRegion.regionY &&
                y < this.leftRegion.regionY + this.leftRegion.regionHeight
            ) {
                region = this.leftRegion;
            } else if (this.rightRegion && x >= this.rightRegion.regionX) {
                region = this.rightRegion;
            }

            let guideLineY = -1;

            if (region) {
                diffIndex = region.hitTest(x - region.regionX, y - region.regionY);
                guideLineY = y - region.regionY;
            }

            if (diffIndex !== this.hoveredDiffIndex || region?.name !== this.hoveredRegion) {
                this.hoveredDiffIndex = diffIndex;
                this.hoveredRegion = region?.name ?? null;
                this.setHoveredDiffIndex(diffIndex, region?.name);
            }

            if (this.syncMode && this._guideLineY !== guideLineY) {
                this._guideLineY = guideLineY;
                this.invalidateHighlightLayer();
            }
        }

        return diffIndex;
    }

    getDiffRect(which: EditorName, diffIndex: number): Rect | null {
        const region = which === "left" ? this.leftRegion : this.rightRegion;
        return region?.getDiffRect(diffIndex) ?? null;
    }

    isDiffVisible(which: EditorName, diffIndex: number): boolean {
        const region = which === "left" ? this.leftRegion : this.rightRegion;
        return region.visibleDiffIndices.has(diffIndex);
    }

    drawGuideLine(ctx: CanvasRenderingContext2D) {
        const guideLineY = this.guideLineY + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, guideLineY);
        ctx.lineTo(this.width, guideLineY);
        ctx.strokeStyle = this.options.guidelineColor;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    suspended = false;
    suspendRendering() {
        this.suspended = true;
        this.rootElement.classList.add("ds-renderer--suspended");
    }

    resumeRendering() {
        this.suspended = false;
        this.rootElement.classList.remove("ds-renderer--suspended");
        this.queueRender();
    }
}
