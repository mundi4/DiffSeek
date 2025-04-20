"use strict";
const STYLE_NONE = 0;
const STYLE_COLOR_DEFAULT = 1 << 0;
const STYLE_COLOR_RED = 1 << 1;
const STYLE_ELEMENT_SUP = 1 << 2;
const STYLE_ELEMENT_SUB = 1 << 3;
const STYLE_ELEMENT_BOLD = 1 << 4;
const STYLE_ELEMENT_ITALIC = 1 << 5;
const STYLE_MASK_COLOR = STYLE_COLOR_DEFAULT | STYLE_COLOR_RED;
const STYLE_MASK_ELEMENT = STYLE_ELEMENT_SUP | STYLE_ELEMENT_SUB | STYLE_ELEMENT_BOLD | STYLE_ELEMENT_ITALIC;
// textrun과 그에 따른 렌더링이 쉬운게 아니다.
// 특히 영역이 오버랩 되는 경우 기존 엘러먼트를 닫고 순서에 맞춰서 새로 열고...
const ELEMENT_STYLES = {
// STRONG: STYLE_ELEMENT_BOLD,
// B: STYLE_ELEMENT_BOLD,
// EM: STYLE_ELEMENT_ITALIC,
// I: STYLE_ELEMENT_ITALIC,
// SUP: STYLE_ELEMENT_SUP,
// SUB: STYLE_ELEMENT_SUB,
};
const reddishCache = new Map([
    ["red", true],
    ["#ff0000", true],
    ["#e60000", true],
    ["#c00000", true],
    ["rgb(255,0,0)", true],
    ["rgb(230,0,0)", true],
    ["#000000", false],
    ["#333333", false],
    ["#ffffff", false],
    ["black", false],
    ["blue", false],
    ["white", false],
    ["window", false],
    ["windowtext", false],
    // 기타 등등?
]);
// 캔버스는 많이 느릴테니까 최대한 정규식을 우선 씀!
// 정규식은 사람이 쓰는건 수명단축의 지름길이므로 절대적으로 chatgtp한테 맡겨야함.
let _ctx = null;
function getRGB(color) {
    // #rrggbb
    const hex6 = /^#([0-9a-f]{6})$/i.exec(color);
    if (hex6) {
        const n = parseInt(hex6[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    // #rgb
    const hex3 = /^#([0-9a-f]{3})$/i.exec(color);
    if (hex3) {
        const [r, g, b] = hex3[1].split("").map((c) => parseInt(c + c, 16));
        return [r, g, b];
    }
    // rgb(...) / rgba(...)
    const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
    if (rgb) {
        const parts = rgb[1].split(",").map((s) => parseInt(s.trim(), 10));
        if (parts.length >= 3)
            return [parts[0], parts[1], parts[2]];
    }
    // 최후..의 fallback: canvas
    if (!_ctx) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        _ctx = canvas.getContext("2d");
    }
    try {
        _ctx.clearRect(0, 0, 1, 1);
        _ctx.fillStyle = color;
        _ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = _ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
    }
    catch {
        return null;
    }
}
function isReddish(color) {
    let isRed = reddishCache.get(color);
    if (isRed !== undefined)
        return isRed;
    console.log("no cache hit", color);
    const rgb = getRGB(color);
    isRed = rgb ? rgb[0] >= 139 && rgb[0] - Math.max(rgb[1], rgb[2]) >= 65 : false;
    reddishCache.set(color, isRed);
    return isRed;
}
// function escapeHTML(str: string): string {
// 	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// }
const BLOCK_ELEMENTS = {
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
    HR: true,
    BR: true, // BLOCK요소가 아니긴 한데...
};
const TEXTLESS_ELEMENTS = {
    HR: true,
    BR: true,
    IMG: true,
    VIDEO: true,
    AUDIO: true,
    EMBED: true,
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
    LINK: true,
    META: true,
    BASE: true,
    AREA: true,
};
// paste 이벤트 때 붙여넣기될 html을 정리함
// 거~의~ 모든 html을 제거하고 지금으로써는 redish한 색상(개정되는 부분 강조색색)만 남겨둠
function sanitizeHTML(rawHTML) {
    const START_TAG = "<!--StartFragment-->";
    const END_TAG = "<!--EndFragment-->";
    const startIndex = rawHTML.indexOf(START_TAG);
    if (startIndex >= 0) {
        const endIndex = rawHTML.lastIndexOf(END_TAG);
        if (endIndex >= 0) {
            rawHTML = rawHTML.slice(startIndex + START_TAG.length, endIndex);
        }
        else {
            rawHTML = rawHTML.slice(startIndex + START_TAG.length);
        }
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, "text/html");
    const body = doc.body;
    // const textProps: TextProperties[] = [];
    // let currentTextProps: TextProperties = { pos: 0, color: null, supsub: null, flags: STYLE_NONE };
    // let textPropsStack: TextProperties[] = [];
    // textProps.push(currentTextProps);
    // textPropsStack.push(currentTextProps);
    let finalHTML = "";
    let currentFlags = STYLE_COLOR_DEFAULT;
    let styleStack = [];
    function extractFlattenedHTML(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (TEXTLESS_ELEMENTS[node.parentElement.nodeName]) {
                return;
            }
            let text = node.nodeValue;
            if (BLOCK_ELEMENTS[node.parentElement.nodeName]) {
                text = text.replace(/[\r\n]/g, "");
            }
            finalHTML += escapeHTML(text);
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            if (el.nodeName === "BR") {
                finalHTML += "\n";
                return;
            }
            if (el.nodeName === "IMG") {
                finalHTML += "🖼️";
                return;
            }
            // let newTextProps: TextProperties | null = null;
            // let prevTextProps = currentTextProps;
            // let spanAppended = false;
            let color = null; // null: color style은 있지만 빨간계통 색이 아닌 경우
            // let pushed = false;
            let colorStyle = null;
            let pushed = false;
            let newFlags = currentFlags;
            if (el.classList.contains("red")) {
                colorStyle = STYLE_COLOR_RED;
            }
            else if (el.style?.color) {
                if (isReddish(el.style.color)) {
                    colorStyle = STYLE_COLOR_RED;
                }
                else {
                    colorStyle = STYLE_COLOR_DEFAULT;
                }
            }
            else {
                colorStyle = currentFlags & STYLE_MASK_COLOR;
            }
            if (colorStyle !== null && (currentFlags & STYLE_MASK_COLOR) !== colorStyle) {
                if (colorStyle === STYLE_COLOR_RED) {
                    color = "red";
                }
                else {
                    color = "default";
                }
                newFlags = (currentFlags & ~STYLE_MASK_COLOR) | colorStyle;
            }
            let tagName = null;
            const elementStyle = ELEMENT_STYLES[el.nodeName];
            if (elementStyle && (currentFlags & STYLE_MASK_ELEMENT) !== elementStyle) {
                newFlags = (currentFlags & ~STYLE_MASK_ELEMENT) | elementStyle;
                tagName = el.nodeName;
            }
            if (!tagName && color !== null) {
                tagName = "SPAN";
            }
            if (tagName && color) {
                finalHTML += `<${tagName} class="${color}">`;
            }
            else if (tagName) {
                finalHTML += `<${tagName}>`;
            }
            if (currentFlags !== newFlags) {
                styleStack.push(currentFlags);
                currentFlags = newFlags;
                pushed = true;
            }
            for (const child of el.childNodes) {
                extractFlattenedHTML(child);
            }
            if (tagName) {
                finalHTML += `</${tagName}>`;
            }
            if (BLOCK_ELEMENTS[el.nodeName]) {
                finalHTML += "\n";
            }
            if (pushed) {
                currentFlags = styleStack.pop();
            }
        }
    }
    extractFlattenedHTML(body);
    console.log("sanitized", { rawHTML, finalHTML });
    return finalHTML;
}
function flattenHTML(rootNode) {
    console.log("flattenHTML", rootNode);
    const textProps = [];
    let currentTextProps = { pos: 0, color: null, supsub: null, flags: 0 };
    let textPropsStack = [];
    textProps.push(currentTextProps);
    textPropsStack.push(currentTextProps);
    let finalText = "";
    function extractFlattenedHTML(node) {
        // console.log("extractFlattenedHTML", node)
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue || "";
            finalText += text;
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            let newTextProps = null;
            let color = null;
            if (el.classList.contains("red")) {
                color = "red";
            }
            if (currentTextProps.color !== color) {
                if (!newTextProps) {
                    currentTextProps = newTextProps = { ...currentTextProps, pos: finalText.length };
                    textProps.push(newTextProps);
                    textPropsStack.push(currentTextProps);
                }
                newTextProps.color = color;
            }
            if (el.nodeName === "SUP" || el.nodeName === "SUB") {
                if (currentTextProps.supsub !== el.nodeName) {
                    if (!newTextProps) {
                        currentTextProps = newTextProps = { ...currentTextProps, pos: finalText.length };
                        textProps.push(newTextProps);
                        textPropsStack.push(currentTextProps);
                    }
                    newTextProps.supsub = el.nodeName;
                }
            }
            for (const child of el.childNodes) {
                extractFlattenedHTML(child);
            }
            if (BLOCK_ELEMENTS[el.nodeName]) {
                finalText += "\n";
            }
            if (newTextProps) {
                textPropsStack.pop();
                currentTextProps = { ...textPropsStack[textPropsStack.length - 1], pos: finalText.length };
                textProps.push(currentTextProps);
            }
        }
    }
    extractFlattenedHTML(rootNode);
    //console.log("flattened", { rootNode, finalText, textProps });
    return [finalText, textProps];
}
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(function () {
            func.apply(context, args);
        }, delay);
    };
}
function findIndexByPos(arr, pos) {
    // binary search
    let low = 0;
    let high = arr.length - 1;
    while (low <= high) {
        const mid = (low + high) >>> 1;
        const item = arr[mid];
        const start = item.pos, end = item.pos + item.len;
        if (start <= pos && pos < end) {
            return mid;
        }
        else if (start > pos) {
            high = mid - 1;
        }
        else if (end <= pos) {
            low = mid + 1;
        }
    }
    return ~low;
}
function getSelectedTokenRange(tokens, startOffset, endOffset) {
    function findTokenIndex(offset, low) {
        let isStart;
        if (low === undefined) {
            isStart = true;
            low = 0;
        }
        else {
            isStart = false;
        }
        let high = tokens.length - 1;
        let result = isStart ? tokens.length : -1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const token = tokens[mid];
            const tokenEnd = token.pos + token.len;
            if (isStart) {
                // 이전 토큰의 끝부터 현재 토큰의 끝까지 포함
                const prevEnd = mid > 0 ? tokens[mid - 1].pos + tokens[mid - 1].len : 0;
                if (offset > prevEnd && offset < tokenEnd) {
                    return mid;
                }
                if (mid === 0 && offset >= token.pos && offset < tokenEnd) {
                    return 0;
                }
            }
            else {
                // 현재 토큰의 시작부터 다음 토큰의 시작까지 포함
                const nextStart = mid + 1 < tokens.length ? tokens[mid + 1].pos : Infinity;
                if (offset >= token.pos && offset < nextStart) {
                    return mid;
                }
            }
            if (isStart) {
                if (token.pos >= offset) {
                    result = mid;
                    high = mid - 1;
                }
                else {
                    low = mid + 1;
                }
            }
            else {
                if (tokenEnd < offset) {
                    result = mid;
                    low = mid + 1;
                }
                else {
                    high = mid - 1;
                }
            }
        }
        return result;
    }
    const startIndex = findTokenIndex(startOffset);
    const endIndex = findTokenIndex(endOffset, startIndex);
    return [startIndex, endIndex + 1]; // [inclusive, exclusive]
}
function mapTokenRangeToOtherSide(rawEntries, side, startIndex, endIndex) {
    const otherSide = side === "left" ? "right" : "left";
    let low = 0;
    let high = rawEntries.length - 1;
    let mappedStart = 0;
    let mappedEnd = 0;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const s = rawEntries[mid][side];
        if (startIndex < s.pos) {
            high = mid - 1;
        }
        else if (startIndex >= s.pos + s.len) {
            low = mid + 1;
        }
        else {
            mappedStart = rawEntries[mid][otherSide].pos;
            low = mid; // reuse for mappedEnd search
            break;
        }
    }
    high = rawEntries.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const s = rawEntries[mid][side];
        if (endIndex - 1 < s.pos) {
            high = mid - 1;
        }
        else if (endIndex - 1 >= s.pos + s.len) {
            low = mid + 1;
        }
        else {
            mappedEnd = rawEntries[mid][otherSide].pos + rawEntries[mid][otherSide].len;
            break;
        }
    }
    return [mappedStart, mappedEnd];
}
function buildOutputHTMLFromRuns(text, textRuns, options) {
    let result = "<pre>";
    let inMark = false;
    for (const run of textRuns) {
        if (run.type === "DIFF") {
            result += "<mark>";
            inMark = true;
        }
        else if (run.type === "DIFF_END") {
            if (inMark) {
                result += "</mark>";
                inMark = false;
            }
        }
        else if (run.type === "CHARS") {
            result += escapeHTML(text.slice(run.pos, run.pos + run.len));
        }
        else if (run.type === "LINEBREAK") {
            result += "\n";
        }
    }
    if (inMark)
        result += "</mark>";
    result += "\n\n</pre>";
    return result;
}
function buildOutputPlainText(leftText, leftRuns, rightText, rightRuns, options = {}) {
    const leftLabel = options.leftLabel ?? "Left";
    const rightLabel = options.rightLabel ?? "Right";
    const leftBody = buildOutputPlainTextFromRuns(leftText, leftRuns, options);
    const rightBody = buildOutputPlainTextFromRuns(rightText, rightRuns, options);
    return `${leftLabel}: ${leftBody}\n${rightLabel}: ${rightBody}\n`;
}
function buildOutputPlainTextFromRuns(text, textRuns, options) {
    const format = options.textFormat ?? 0;
    let result = "";
    let inDiff = false;
    // 강조 마크 선택
    let markStart;
    let markEnd;
    if (format === 1) {
        markStart = "**";
        markEnd = "**";
    }
    else if (format === 2) {
        markStart = "[[ ";
        markEnd = " ]]";
    }
    else {
        markStart = "";
        markEnd = "";
    }
    for (const run of textRuns) {
        if (run.type === "DIFF") {
            if (format !== 0 && !inDiff) {
                result += markStart;
                inDiff = true;
            }
        }
        else if (run.type === "DIFF_END") {
            if (format !== 0 && inDiff) {
                result += markEnd;
                inDiff = false;
            }
        }
        else if (run.type === "CHARS") {
            result += text.slice(run.pos, run.pos + run.len);
        }
        else if (run.type === "LINEBREAK") {
            result += "\n";
        }
    }
    if (inDiff && format !== 0)
        result += markEnd;
    return result;
}
function buildOutputHTML(leftText, leftRuns, rightText, rightRuns, options = {}) {
    const leftLabel = options.leftLabel ?? "Left";
    const rightLabel = options.rightLabel ?? "Right";
    const htmlFormat = options.htmlFormat ?? "dl";
    if (htmlFormat === "table") {
        // Default: table format
        return `<table border="1" cellpadding="8" cellspacing="0">
  <thead>
    <tr><th>${escapeHTML(leftLabel)}</th><th>${escapeHTML(rightLabel)}</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><pre>${buildOutputHTMLFromRuns(leftText, leftRuns, options)}</pre></td>
      <td><pre>${buildOutputHTMLFromRuns(rightText, rightRuns, options)}</pre></td>
    </tr>
  </tbody>
</table>`.trim();
    }
    if (htmlFormat === "dl") {
        return `<dl>
  <dt>${escapeHTML(leftLabel)}</dt>
  <dd><pre>${buildOutputHTMLFromRuns(leftText, leftRuns, options)}</pre></dd>
  <dt>${escapeHTML(rightLabel)}</dt>
  <dd><pre>${buildOutputHTMLFromRuns(rightText, rightRuns, options)}</pre></dd>
</dl>`.trim();
    }
    return `<div>
<div><strong>${escapeHTML(leftLabel)}:</strong> ${buildOutputHTMLFromRuns(leftText, leftRuns, options)}</div>
<div><strong>${escapeHTML(rightLabel)}:</strong> ${buildOutputHTMLFromRuns(rightText, rightRuns, options)}</div>
</div>`.trim();
}
function escapeHTML(str) {
    return str.replace(/[&<>"]|'/g, (char) => {
        switch (char) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#039;";
            default:
                return char;
        }
    });
}
//# sourceMappingURL=utils.js.map