"use strict";
/*
지금은 딱히 사용되지 않는 utility 함수들.
편집기에 약간의 html을 허용할 때 사용.
*/
const colorCache = new Map();
function isReddish(color) {
    const rgb = parseColorFast(color);
    if (!rgb)
        return false;
    const [r, g, b] = rgb;
    return r > 150 && r - (g > b ? g : b) >= 60;
}
let _ctx = null;
function parseColorFast(color) {
    if (colorCache.has(color))
        return colorCache.get(color);
    if (!_ctx) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        _ctx = canvas.getContext("2d");
    }
    if (!_ctx)
        return null;
    _ctx.clearRect(0, 0, 1, 1);
    _ctx.fillStyle = color;
    _ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = _ctx.getImageData(0, 0, 1, 1).data;
    const rgb = [r, g, b];
    colorCache.set(color, rgb);
    // _ctx.fillStyle = "#000";
    // _ctx.fillStyle = color;
    // const computed = _ctx.fillStyle;
    // console.log("computed", computed);
    // const match = computed.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    // if (!match) return null;
    // const rgb: [number, number, number] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    // colorCache.set(color, rgb);
    return rgb;
}
function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function insertHTMLAtCursor(html) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount)
        return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    range.insertNode(fragment);
    // 커서 맨 뒤로 이동
    selection.collapseToEnd();
}
const LINEBREAK_ELEMENTS = {
    P: true,
    DIV: true,
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
    TR: true,
    BR: true,
    HR: true,
};
function flattenHTML(rawHTML) {
    const START_TAG = "<!--StartFragment-->";
    const END_TAG = "<!--EndFragment-->";
    const startIndex = rawHTML.indexOf(START_TAG);
    if (startIndex >= 0) {
        const endIndex = rawHTML.lastIndexOf(END_TAG);
        if (endIndex >= 0) {
            rawHTML = rawHTML.substring(startIndex + START_TAG.length, endIndex);
        }
        else {
            rawHTML = rawHTML.substring(startIndex + START_TAG.length);
        }
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, "text/html");
    const body = doc.body;
    // console.log("body", body.innerHTML);
    const textProps = [];
    let currentTextProps = { pos: 0, color: null, supsub: null };
    let textPropsStack = [];
    textProps.push(currentTextProps);
    textPropsStack.push(currentTextProps);
    let finalHTML = "";
    let finalText = "";
    function extractFlattenedHTML(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue || "";
            finalHTML += escapeHTML(text);
            finalText += text;
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            let newTextProps = null;
            let prevTextProps = currentTextProps;
            let spanAppended = false;
            let color = null;
            let colorChanged = false;
            if (el.classList.contains("red")) {
                color = "red";
                colorChanged = true;
            }
            else if (el.style?.color) {
                color = el.style?.color || null;
                if (color && isReddish(color)) {
                    color = "red";
                }
                else {
                    color = null;
                }
                colorChanged = true;
            }
            if (colorChanged && currentTextProps.color !== color) {
                if (!newTextProps) {
                    currentTextProps = newTextProps = { ...currentTextProps, pos: finalText.length };
                    textProps.push(newTextProps);
                    textPropsStack.push(currentTextProps);
                }
                newTextProps.color = color;
            }
            // if (el.style?.color) {
            // 	console.log(el.style.color, isColorRedLike(el.style.color));
            // 	let color = el.style?.color || null;
            // 	if (color && isColorRedLike(color)) {
            // 		color = "red";
            // 	} else {
            // 		color = null;
            // 	}
            // 	if (currentTextProps.color !== color) {
            // 		if (!newTextProps) {
            // 			currentTextProps = newTextProps = { ...currentTextProps, pos: finalText.length };
            // 			textProps.push(newTextProps);
            // 			textPropsStack.push(currentTextProps);
            // 		}
            // 		newTextProps.color = color;
            // 	}
            // }
            if (el.nodeName === "SUP" || el.nodeName === "SUB") {
                if (currentTextProps.supsub !== el.nodeName) {
                    if (!newTextProps) {
                        currentTextProps = newTextProps = { ...currentTextProps, pos: finalText.length };
                        textProps.push(newTextProps);
                        textPropsStack.push(currentTextProps);
                    }
                    newTextProps.supsub = el.nodeName;
                }
                finalHTML += `<${el.nodeName} class="${currentTextProps.color || ""}">`;
            }
            else if (prevTextProps.color !== currentTextProps.color) {
                if (currentTextProps.color) {
                    finalHTML += `<span class="${currentTextProps.color}">`;
                    spanAppended = true;
                }
            }
            for (const child of el.childNodes) {
                extractFlattenedHTML(child);
            }
            if (el.nodeName === "SUP" || el.nodeName === "SUB") {
                finalHTML += `</${el.nodeName}>`;
            }
            else if (spanAppended) {
                finalHTML += "</span>";
            }
            if (LINEBREAK_ELEMENTS[el.nodeName]) {
                finalHTML += "<br>";
                finalText += "\n";
            }
            if (newTextProps) {
                textPropsStack.pop();
                console.assert(textPropsStack.length > 0, "textPropsStack is empty!");
                currentTextProps = { ...textPropsStack[textPropsStack.length - 1], pos: finalText.length };
                textProps.push(currentTextProps);
            }
        }
    }
    extractFlattenedHTML(body);
    // flatten된 HTML 생성
    console.log("flattened", { finalHTML, finalText, textProps });
    return [finalHTML, finalText, textProps];
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
//# sourceMappingURL=utils.js.map