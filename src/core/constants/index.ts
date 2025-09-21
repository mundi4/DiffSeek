export const DEBUG = true;

export const MAX_TOKEN_COUNT = 0xfffff; // 1,048,575
export const COMPUTE_DIFF_TIMEOUT = 500;

// DIFF 색(HUE). 0(빨)은 DIFF 배경색으로 쓰이니 패스
// 완전한 색상 코드보다 HUE만 사용하면 용도에 따라 색을 조절하기 쉬움.
// 인접한 색상과 너무 가깝지 않도록 아주 CAREFUL하게 고른 순서. 과학이다.
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

export const BASE_FONT_SIZE = 16;
export const EDITOR_PADDING = 8;
export const LINE_HEIGHT = 1.5;
export const TOPBAR_HEIGHT = 0;
export const EDITOR_SCROLL_MARGIN = LINE_HEIGHT * 2 * BASE_FONT_SIZE; // px

export const HANGUL_ORDER = "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허";

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
};

// 많은 요소들이 있지만 다 무시하고 root와 td/th만 생각함.
// 다른 요소들은 어차피 레이아웃과 무관
export const TEXT_FLOW_CONTAINERS: Record<string, boolean> = {
    TD: true,
    TH: true,
    // DIV: true,
    // PRE: true,
    // BLOCKQUOTE: true,
    // LI: true,
    // SECTION: true,
    // ARTICLE: true,
    // HEADER: true,
    // FOOTER: true,
    // ASIDE: true,
    // MAIN: true,
    // CAPTION: true,
    // FIGURE: true,
    // FIGCAPTION: true,
};

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
    "#document-fragment": true,
};

export const FRAME_BUDGET_MS = 1000 / 60;


export const ANCHOR_TAG_NAME = "A";
export const ANCHOR_CLASS_NAME = "anchor";
export const LINE_TAG = "DIV";
export const MANUAL_ANCHOR_ELEMENT_NAME = "HR";
export const DIFF_TAG_NAME = "DIFF-MARKER";
export const DIFF_CLASS_NAME = "diff";
export const MANUAL_ANCHOR_CLASS_NAME = "manual-anchor";