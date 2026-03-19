import { ANCHOR_TAG_NAME, DIFF_TAG_NAME, MANUAL_ANCHOR_TAG_NAME } from "../constants";
import type { ElementPolicy } from "./types";

const EXCLUDED_TAG_OPTIONS: ElementPolicy = {
    exclude: true,
};

const COMMON_ALLOWED_STYLES: Record<string, boolean> = {
    textAlign: true,
    fontSize: true,
    fontWeight: true,
    fontStyle: true,
};

const DefaultElementOptions: ElementPolicy = {
    allowedStyles: COMMON_ALLOWED_STYLES,
};

const AsDivElementOptions: ElementPolicy = {
    replaceTag: "DIV",
    allowedStyles: COMMON_ALLOWED_STYLES,
};

const COMMON_INLINE_ELEMENT_OPTIONS: ElementPolicy = {
    replaceTag: "SPAN",
    allowedStyles: COMMON_ALLOWED_STYLES,
};

const SMART_TAG_OPTIONS: ElementPolicy = COMMON_INLINE_ELEMENT_OPTIONS;

const ELEMENT_POLICIES: Record<string, ElementPolicy> = {
    [ANCHOR_TAG_NAME]: EXCLUDED_TAG_OPTIONS,
    [DIFF_TAG_NAME]: EXCLUDED_TAG_OPTIONS,
    [MANUAL_ANCHOR_TAG_NAME]: {},
    SCRIPT: EXCLUDED_TAG_OPTIONS,
    STYLE: EXCLUDED_TAG_OPTIONS,
    IFRAME: EXCLUDED_TAG_OPTIONS,
    OBJECT: EXCLUDED_TAG_OPTIONS,
    EMBED: EXCLUDED_TAG_OPTIONS,
    LINK: EXCLUDED_TAG_OPTIONS,
    META: EXCLUDED_TAG_OPTIONS,
    BASE: EXCLUDED_TAG_OPTIONS,
    APPLET: EXCLUDED_TAG_OPTIONS,
    FRAME: EXCLUDED_TAG_OPTIONS,
    FRAMESET: EXCLUDED_TAG_OPTIONS,
    NOSCRIPT: EXCLUDED_TAG_OPTIONS,
    SVG: EXCLUDED_TAG_OPTIONS,
    MATH: EXCLUDED_TAG_OPTIONS,
    TEMPLATE: EXCLUDED_TAG_OPTIONS,
    HEAD: EXCLUDED_TAG_OPTIONS,
    TITLE: EXCLUDED_TAG_OPTIONS,
    CANVAS: EXCLUDED_TAG_OPTIONS,
    AUDIO: EXCLUDED_TAG_OPTIONS,
    VIDEO: EXCLUDED_TAG_OPTIONS,
    TRACK: EXCLUDED_TAG_OPTIONS,
    SOURCE: EXCLUDED_TAG_OPTIONS,
    BGSOUND: EXCLUDED_TAG_OPTIONS,
    TABLE: DefaultElementOptions,

    CAPTION: DefaultElementOptions,
    TR: DefaultElementOptions,
    TD: { allowedAttrs: { colspan: true, rowspan: true, width: true }, allowedStyles: { ...COMMON_ALLOWED_STYLES, width: true } },
    TH: { replaceTag: "TD", allowedAttrs: { colspan: true, rowspan: true }, allowedStyles: COMMON_ALLOWED_STYLES },
    H1: DefaultElementOptions,
    H2: DefaultElementOptions,
    H3: DefaultElementOptions,
    H4: DefaultElementOptions,
    H5: DefaultElementOptions,
    H6: DefaultElementOptions,
    SUP: DefaultElementOptions,
    SUB: DefaultElementOptions,
    EM: DefaultElementOptions,
    I: DefaultElementOptions,
    S: DefaultElementOptions,
    B: DefaultElementOptions,
    STRONG: DefaultElementOptions,
    U: DefaultElementOptions,
    STRIKE: DefaultElementOptions,
    P: DefaultElementOptions,
    UL: DefaultElementOptions,
    OL: DefaultElementOptions,
    LI: DefaultElementOptions,
    DL: DefaultElementOptions,
    DT: DefaultElementOptions,
    DD: DefaultElementOptions,
    DIV: DefaultElementOptions,
    BLOCKQUOTE: DefaultElementOptions,
    ADDRESS: DefaultElementOptions,
    FIELDSET: DefaultElementOptions,
    LEGEND: DefaultElementOptions,
    CODE: DefaultElementOptions,
    PRE: DefaultElementOptions,
    SMALL: DefaultElementOptions,
    DEL: DefaultElementOptions,
    INS: DefaultElementOptions,
    IMG: { allowedAttrs: { ["data-hash"]: true, src: true, width: true, height: true }, allowedStyles: { width: true, height: true } },
    FONT: { replaceTag: "SPAN", allowedStyles: COMMON_ALLOWED_STYLES },
    SPAN: DefaultElementOptions,
    LABEL: DefaultElementOptions,
    FORM: AsDivElementOptions,
    NAV: AsDivElementOptions,
    MAIN: AsDivElementOptions,
    HEADER: AsDivElementOptions,
    FOOTER: AsDivElementOptions,
    SECTION: AsDivElementOptions,
    ARTICLE: AsDivElementOptions,
    ASIDE: AsDivElementOptions,
    A: {
        replaceTag: "SPAN",
        allowedStyles: COMMON_ALLOWED_STYLES,
    },
    MARK: {
        replaceTag: "SPAN",
        allowedStyles: COMMON_ALLOWED_STYLES,
    },
    FIGURE: DefaultElementOptions,
    FIGCAPTION: DefaultElementOptions,
    TBODY: DefaultElementOptions,
    THEAD: DefaultElementOptions,
    TFOOT: DefaultElementOptions,
    "#document-fragment": DefaultElementOptions,
    BR: {},
};

export function getElementPolicy(node: Node): ElementPolicy {
    const nodeName = node.nodeName;

    const direct = ELEMENT_POLICIES[nodeName];
    if (direct) return direct;

    if (
        nodeName === "O:P" &&
        (node.childNodes.length === 0 ||
            (node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE && (node.firstChild as Text).nodeValue === "\u00A0"))
    ) {
        return ELEMENT_POLICIES["BR"]; // <o:p>&nbsp;</o:p> => <br>
    }

    if (nodeName.startsWith("ST1:")) {
        return SMART_TAG_OPTIONS; // 날짜 따위가 이런 태그로 들어오는 경우가 있다.
    }

    // 나머지는 인라인 요소로 처리하기. 완전히 버려버리면 안된다!
    return COMMON_INLINE_ELEMENT_OPTIONS;
}
