export const ABORT_REASON_CANCELLED = "aborted";

export const VOID_ELEMENTS: Record<string, boolean> = {
    AREA: true,
    BASE: true,
    BR: true,
    COL: true,
    COMMAND: true,
    EMBED: true,
    HR: true,
    IMG: true,
    INPUT: true,
    LINK: true,
    META: true,
    PARAM: true,
    SOURCE: true,
    TRACK: true,
    WBR: true,
    SVG: true,

    // VOID는 아니지만 VOID로 취급하고 바로 무시해야 할 태그들
    SCRIPT: true,
    NOSCRIPT: true,
    STYLE: true,
    IFRAME: true,
} as const;

export const TEXTLESS_ELEMENTS: Record<string, boolean> = {
    ...VOID_ELEMENTS,
    VIDEO: true,
    AUDIO: true,
    OBJECT: true,
    CANVAS: true,
    SVG: true,
    TABLE: true,
    THEAD: true,
    TBODY: true,
    TFOOT: true,
    TR: true,
    OL: true,
    UL: true,
    DL: true,
    STYLE: true,
    HEAD: true,
    TITLE: true,
    SCRIPT: true,
} as const;

export const BLOCK_ELEMENTS: Record<string, boolean> = {
    DD: true,
    DT: true,
    DIV: true,
    P: true,
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
    HR: true,
    UL: true,
    OL: true,
    LI: true,
    BLOCKQUOTE: true,
    FORM: true,
    HEADER: true,
    FOOTER: true,
    ARTICLE: true,
    SECTION: true,
    ASIDE: true,
    NAV: true,
    ADDRESS: true,
    FIGURE: true,
    FIGCAPTION: true,
    TABLE: true,
    CAPTION: true,
    TR: true,
    TD: true,
    TH: true,
    PRE: true,
    "#document-fragment": true,
} as const;

export const CONTAINER_TAGS: Record<string, boolean> = {
    TD: true,
    TH: true,
    // TR: true,ra
    // LI: true,
    // BLOCKQUOTE: true,
    // PRE: true,
    // DT: true,
    // DD: true,
    // FIGURE: true,
} as const;


/**
 * Hangul order (가, 나, 다, 라, 마, 바, 사, 아, 자)
 * Used for section headings
 */


export const DIFF_COLOR_HUES = [
    30, // 주황?
    180, // cyan
    300, // 핑크?
    120, // 초록
    240, // 파랑
    60, // 노랑
    270, // 보라?
] as const;
export const NUM_DIFF_COLORS = DIFF_COLOR_HUES.length;


export const DIFF_TAG_NAME = "DS-DIFF";
export const MANUAL_ANCHOR_TAG_NAME = "DS-MANUAL-ANCHOR";
export const ANCHOR_TAG_NAME = "DS-ANCHOR";
export const ANCHOR_CLASS_NAME = "ds-anchor";


export const TOKEN_BUFFER_STRIDE = 5;

export const STRUCTURAL_TD_OPEN_TEXT = "\uE000td";
export const STRUCTURAL_TD_CLOSE_TEXT = "\uE001td";
export const STRUCTURAL_TR_OPEN_TEXT = "\uE000tr";
export const STRUCTURAL_TR_CLOSE_TEXT = "\uE001tr";
