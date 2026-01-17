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
    // LI: true,
    // DT: true,
    // DD: true,
    // BLOCKQUOTE: true,
    PRE: true,
    // FIGURE: true,
} as const;

/**
 * Space characters including NBSP (\u00A0)
 * Keys: both character and codepoint for fast lookup
 */
export const SPACE_CHARS: Record<string | number, true> = {
    " ": true, 32: true,   // SPACE
    "\t": true, 9: true,    // TAB
    "\n": true, 10: true,   // LF
    "\r": true, 13: true,   // CR
    "\f": true, 12: true,   // FF
    "\v": true, 11: true,   // VT
    "\u00A0": true, 160: true, // NBSP
};

export const COLLAPSIBLE_SPACE_CHARS: Record<string | number, true> = {
    " ": true, 32: true,
    "\t": true, 9: true,
    "\n": true, 10: true,
    "\r": true, 13: true,
    "\f": true, 12: true,
    "\v": true, 11: true,
};

export const WS_TABLE = new Uint8Array(65536);
WS_TABLE[32] = 1;   // space
WS_TABLE[9] = 1;    // \t
WS_TABLE[10] = 1;   // \n
WS_TABLE[13] = 1;   // \r
WS_TABLE[12] = 1;   // \f
WS_TABLE[11] = 1;   // \v
WS_TABLE[160] = 2;  // nbsp

// export const NON_COLLAPSIBLE_SPACE_CHARS: Record<string | number, true> = {
//     "\u00A0": true, 160: true, // NBSP (Glue)
// };

/**
 * Hangul order (가, 나, 다, 라, 마, 바, 사, 아, 자)
 * Used for section headings
 */
export const HANGUL_ORDER = "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허";



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