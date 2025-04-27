"use strict";
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
                const prevEnd = mid > 0 ? tokens[mid - 1].pos + tokens[mid - 1].len : 0;
                if (offset > prevEnd && offset < tokenEnd) {
                    return mid;
                }
                if (mid === 0 && offset >= token.pos && offset < tokenEnd) {
                    return 0;
                }
            }
            else {
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
    const endIndex = findTokenIndex(endOffset - 1, startIndex);
    return [startIndex, endIndex + 1]; // [inclusive, exclusive]
}
function findDiffEntryRangeByPos(entries, side, pos, endPos) {
    console.log("findDiffEntryRangeByPos", { entries, side, pos, endPos });
    let low = 0;
    let high = entries.length - 1;
    let mappedStart = 0;
    let mappedEnd = 0;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const s = entries[mid][side];
        if (pos < s.pos) {
            high = mid - 1;
        }
        else if (pos >= s.pos + s.len) {
            low = mid + 1;
        }
        else {
            mappedStart = mid;
            break;
        }
    }
    low = mappedStart;
    high = entries.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const s = entries[mid][side];
        if (endPos - 1 < s.pos) {
            high = mid - 1;
        }
        else if (endPos - 1 >= s.pos + s.len) {
            low = mid + 1;
        }
        else {
            mappedEnd = mid + 1;
            break;
        }
    }
    return [mappedStart, mappedEnd];
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
    let inDiff = false;
    let result = options.htmlPre ? "<pre>" : "";
    for (const run of textRuns) {
        if (run.type === "DIFF") {
            const diffIndex = run.dataIndex;
            // result += "<mark>";
            const color = DIFF_COLOR_HUES[diffIndex % DIFF_COLOR_HUES.length];
            result += `<mark style="background-color: hsl(${color}, 100%, 80%);">`;
            inDiff = true;
        }
        else if (run.type === "DIFF_END") {
            if (inDiff) {
                // result += "</mark>";
                result += "</mark>";
                inDiff = false;
            }
        }
        else if (run.type === "CHARS") {
            result += escapeHTML(text.slice(run.pos, run.pos + run.len));
        }
        else if (run.type === "LINEBREAK") {
            result += "<br/>";
        }
    }
    if (inDiff)
        result += "</mark>";
    if (options.htmlPre)
        result += "</pre>";
    // result += "<br/>";
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
    const htmlFormat = options.htmlFormat ?? "div";
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
function parseOrdinalNumber(ordinalText) {
    const norm = ordinalText.replace(/[\(\)\.]/g, "");
    if (/^\d+$/.test(norm)) {
        return Number(norm);
    }
    const idx = hangulOrder.indexOf(norm);
    if (idx !== -1) {
        return idx + 1;
    }
    return NaN;
}
function findFirstNodeAfter(root, after) {
    let current = after;
    while (current && current !== root) {
        if (current.nextSibling) {
            return current.nextSibling;
        }
        else {
            current = current.parentNode;
        }
    }
    return null;
}
function getTextOffsetOfNode(root, node) {
    const filter = node.nodeType === 3 ? NodeFilter.SHOW_TEXT : NodeFilter.SHOW_ALL;
    let walker = document.createTreeWalker(root, filter, null);
    let pos = 0;
    let currentNode;
    while ((currentNode = walker.nextNode())) {
        if (currentNode === node) {
            break;
        }
        if (currentNode.nodeType === 3) {
            pos += currentNode.nodeValue.length;
        }
    }
    return pos;
}
//# sourceMappingURL=utils.js.map