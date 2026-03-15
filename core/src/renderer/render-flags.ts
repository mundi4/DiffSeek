export const RENDER_FLAGS_NONE = 0x0 as const;
export const RENDER_FLAGS_LAYOUT = 0x1 as const;

export const RENDER_FLAGS_HIT_TEST = 0x2 as const;
export const RENDER_FLAGS_GEOMETRY = 0x20 as const;
export const RENDER_FLAGS_SCROLL = 0x40 as const;
export const RENDER_FLAGS_RESIZE = 0x80 as const;
export const RENDER_FLAGS_SELECTION_HIGHLIGHT = 0x100 as const;
export const RENDER_FLAGS_DIFF_HIGHLIGHT = 0x200 as const;

// export type RenderFlags = 
//   | typeof RENDER_FLAGS_NONE
//   | typeof RENDER_FLAGS_LAYOUT
//   | typeof RENDER_FLAGS_HIT_TEST
//   | typeof RENDER_FLAGS_GEOMETRY
//   | typeof RENDER_FLAGS_SCROLL
//   | typeof RENDER_FLAGS_RESIZE
//   | typeof RENDER_FLAGS_SELECTION_HIGHLIGHT
//   | typeof RENDER_FLAGS_DIFF_HIGHLIGHT;

export const RENDER_FLAGS_MINIMAP = 0xA0 as const;  // GEOMETRY | RESIZE
export const RENDER_FLAGS_DIFF_LAYER = 0xE0 as const;  // GEOMETRY | SCROLL | RESIZE
export const RENDER_FLAGS_HIGHLIGHT_LAYER = 0x3E0 as const;  // GEOMETRY | SCROLL | RESIZE | SELECTION_HIGHLIGHT | DIFF_HIGHLIGHT
export const RENDER_FLAGS_GENERAL_MASK = 0x3 as const;  // LAYOUT | HIT_TEST
export const RENDER_FLAGS_REGION_MASK = 0x3E0;
export const RENDER_FLAGS_REGION_SHIFT = 11 as const;