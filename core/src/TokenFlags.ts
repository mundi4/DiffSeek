export const enum TokenFlags {
    None = 0,
    WORD_LIKE = 1 << 0,
    PUNCTUATION = 1 << 1,
    LINE_START = 1 << 2,
    LINE_END = 1 << 3,
    SECTION_HEADING_TYPE1 = 1 << 4,  // 1. 2. (numeric)
    SECTION_HEADING_TYPE2 = 1 << 5,  // 가. 나. (hangul)
    SECTION_HEADING_TYPE3 = 1 << 6,  // (1) (2)(numeric in parens)
    SECTION_HEADING_TYPE4 = 1 << 7,  // (가) (나) (hangul in parens)
    SECTION_HEADING_TYPE5 = 1 << 8,  // 1) 2) (numeric paren)
    SECTION_HEADING_TYPE6 = 1 << 9,  // 가) 나) (hangul paren)
    LAW_ARTICLE = 1 << 10,
    WILDCARD = 1 << 11,
    MANUAL_ANCHOR = 1 << 12,
    IMAGE = 1 << 13,
    NO_JOIN_NEXT = 1 << 14,
    NO_JOIN_PREV = 1 << 15,
    HAS_PRECEDING_SPACE = 1 << 16,
    //    HAS_FOLLOWING_SPACE = 1 << 17,
}

export const HEADING_MASK = TokenFlags.SECTION_HEADING_TYPE1
    | TokenFlags.SECTION_HEADING_TYPE2
    | TokenFlags.SECTION_HEADING_TYPE3
    | TokenFlags.SECTION_HEADING_TYPE4
    | TokenFlags.SECTION_HEADING_TYPE5
    | TokenFlags.SECTION_HEADING_TYPE6
    | TokenFlags.LAW_ARTICLE;