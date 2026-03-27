export const TOKEN_FLAGS_NONE = 0x0 as const;
export const TOKEN_FLAGS_TYPE_TEXT = 0x1 as const;
export const TOKEN_FLAGS_TYPE_IMAGE = 0x2 as const;
export const TOKEN_FLAGS_TYPE_STRUCTURAL = 0x4 as const;
export const TOKEN_FLAGS_LINE_START = 0x20 as const;
export const TOKEN_FLAGS_LINE_END = 0x40 as const;
export const TOKEN_FLAGS_HAS_PRECEDING_SPACE = 0x80000 as const;
export const TOKEN_FLAGS_HAS_FOLLOWING_SPACE = 0x100000 as const;
export const TOKEN_FLAGS_WORD_LIKE = 0x8 as const;
export const TOKEN_FLAGS_PUNCTUATION = 0x10 as const;
export const TOKEN_FLAGS_STRUCTURAL_OPEN = 0x200000 as const;
export const TOKEN_FLAGS_STRUCTURAL_CLOSE = 0x400000 as const;
export const TOKEN_FLAGS_MANUAL_ANCHOR = 0x8000 as const;
export const TOKEN_FLAGS_NO_JOIN_NEXT = 0x20000 as const;
export const TOKEN_FLAGS_NO_JOIN_PREV = 0x40000 as const;
export const TOKEN_FLAGS_SECTION_HEADING_TYPE1 = 0x80 as const;  // 1. 2.
export const TOKEN_FLAGS_SECTION_HEADING_TYPE2 = 0x100 as const;  // 가. 나.
export const TOKEN_FLAGS_SECTION_HEADING_TYPE3 = 0x200 as const;  // (1) (2)
export const TOKEN_FLAGS_SECTION_HEADING_TYPE4 = 0x400 as const;  // (가) (나)
export const TOKEN_FLAGS_SECTION_HEADING_TYPE5 = 0x800 as const;  // 1) 2)
export const TOKEN_FLAGS_SECTION_HEADING_TYPE6 = 0x1000 as const;  // 가) 나)
export const TOKEN_FLAGS_SECTION_HEADING_LAW_ARTICLE = 0x2000 as const; // 제1조, 제2조
export const TOKEN_FLAGS_WILDCARD = 0x4000 as const;

// export type TokenFlags = 
//   | typeof TOKEN_FLAGS_NONE
//   | typeof TOKEN_FLAGS_TYPE_TEXT
//   | typeof TOKEN_FLAGS_TYPE_IMAGE
//   | typeof TOKEN_FLAGS_TYPE_STRUCTURAL
//   | typeof TOKEN_FLAGS_LINE_START
//   | typeof TOKEN_FLAGS_LINE_END
//   | typeof TOKEN_FLAGS_HAS_PRECEDING_SPACE
//   | typeof TOKEN_FLAGS_HAS_FOLLOWING_SPACE
//   | typeof TOKEN_FLAGS_WORD_LIKE
//   | typeof TOKEN_FLAGS_PUNCTUATION
//   | typeof TOKEN_FLAGS_STRUCTURAL_OPEN
//   | typeof TOKEN_FLAGS_STRUCTURAL_CLOSE
//   | typeof TOKEN_FLAGS_MANUAL_ANCHOR
//   | typeof TOKEN_FLAGS_NO_JOIN_NEXT
//   | typeof TOKEN_FLAGS_NO_JOIN_PREV
//   | typeof TOKEN_FLAGS_SECTION_HEADING_TYPE1
//   | typeof TOKEN_FLAGS_SECTION_HEADING_TYPE2
//   | typeof TOKEN_FLAGS_SECTION_HEADING_TYPE3
//   | typeof TOKEN_FLAGS_SECTION_HEADING_TYPE4
//   | typeof TOKEN_FLAGS_SECTION_HEADING_TYPE5
//   | typeof TOKEN_FLAGS_SECTION_HEADING_TYPE6
//   | typeof TOKEN_FLAGS_SECTION_HEADING_LAW_ARTICLE
//   | typeof TOKEN_FLAGS_WILDCARD;

export const TOKEN_TYPE_MASK = 0x7 as const;  // 0x1 | 0x2 | 0x4

export const HEADING_MASK = 0x3F80 as const;  // 0x80 | 0x100 | 0x200 | 0x400 | 0x800 | 0x1000 | 0x2000

export const STRUCTURAL_MASK = 0x600000 as const;  // 0x200000 | 0x400000