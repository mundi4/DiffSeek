import type { Rect } from "../types";

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
