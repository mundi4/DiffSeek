// ── Dirty flags (invalidation reasons) ──
export const DIRTY_NONE = 0x0 as const;
export const DIRTY_LAYOUT = 0x1 as const;
export const DIRTY_HIT_TEST = 0x2 as const;
export const DIRTY_GEOMETRY = 0x20 as const;
export const DIRTY_SCROLL = 0x40 as const;
export const DIRTY_RESIZE = 0x80 as const;
export const DIRTY_SELECTION = 0x100 as const;
export const DIRTY_DIFF_HIGHLIGHT = 0x200 as const;
export const DIRTY_DIFF_HIGHLIGHT_OFFSCREEN = 0x400 as const;
export const DIRTY_MINIMAP = 0x800 as const;

// ── Render masks (which dirty bits trigger each layer to render) ──
export const RENDER_MINIMAP = DIRTY_GEOMETRY | DIRTY_RESIZE | DIRTY_DIFF_HIGHLIGHT | DIRTY_DIFF_HIGHLIGHT_OFFSCREEN | DIRTY_MINIMAP;
export const RENDER_DIFF_LAYER = DIRTY_GEOMETRY | DIRTY_SCROLL | DIRTY_RESIZE | DIRTY_DIFF_HIGHLIGHT;
export const RENDER_HIGHLIGHT_LAYER = DIRTY_GEOMETRY | DIRTY_SCROLL | DIRTY_RESIZE | DIRTY_SELECTION | DIRTY_DIFF_HIGHLIGHT;
export const RENDER_GENERAL = DIRTY_LAYOUT | DIRTY_HIT_TEST;
export const RENDER_REGION_MASK = 0xFE0;
export const RENDER_REGION_SHIFT = 12 as const;
