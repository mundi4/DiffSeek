/**
 * Renderer types
 * Rendering and visualization definitions
 */

import type { Span } from "../shared/types";

export type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type DiffVisibilityChangeEntry = {
    item: number;
    isVisible: boolean;
};

export type RenderedDiff = {
    diffIndex: number;
    hue: number;
    leftRange: Range;
    rightRange: Range;
    leftSpan: Span;
    rightSpan: Span;
    leftMarkerEl: HTMLElement | null;
    rightMarkerEl: HTMLElement | null;
};

export type RenderViewport = {
    getBoundingClientRect: () => Rect;
    getScrollTop(): number;
    getScrollHeight(): number;
};

export type DiffRenderItem = {
    diffIndex: number;
    range: Range;
    color: string;
    empty: boolean;
}

export type RectSet = {
    rects: Rect[] | null;
    // fillStyle: string | null;
    // strokeStyle: string | null;
} & RenderBounds;

export type RenderBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

export * from "./RenderFlags";