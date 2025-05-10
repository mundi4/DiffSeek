const STYLE_NONE = 0;
const STYLE_COLOR_RED = 1;
const STYLE_MASK_COLOR = STYLE_COLOR_RED;

const reddishCache = new Map<string, boolean>([
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
]);

let _ctx: CanvasRenderingContext2D | null = null;

// 캔버스는 많이 느릴테니까 최대한 정규식을 우선 씀!
// 정규식은 수명단축의 지름길이므로 절대적으로 chatgtp한테 맡기고 눈길 조차 주지 말 것.
function getRGB(color: string): [number, number, number] | null {
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
		if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
	}

	// fallback: canvas. 아마도 많이 느릴 것...

	if (!_ctx) {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		_ctx = canvas.getContext("2d")!;
	}

	try {
		_ctx.clearRect(0, 0, 1, 1);
		_ctx.fillStyle = color;
		_ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = _ctx.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	} catch {
		return null;
	}
}

function isReddish(color: string): boolean {
	let isRed = reddishCache.get(color);
	if (isRed !== undefined) return isRed;

	console.log("no cache hit", color);
	const rgb = getRGB(color);
	isRed = rgb ? rgb[0] >= 139 && rgb[0] - Math.max(rgb[1], rgb[2]) >= 65 : false;

	reddishCache.set(color, isRed);
	return isRed;
}

type ElementState = {
	flags: number;
	firstNonWhitespaceSeen: boolean;
};

type TextFragment = {
	text: string;
	flags: number;
};

const BLOCK_ELEMENTS: Record<string, boolean> = {
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
	//TD: true,
	"#document-fragment": true,
};

const LINEBREAK_ELEMENTS: Record<string, boolean> = {
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
};

const TEXTLESS_ELEMENTS: Record<string, boolean> = {
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
	"#document-fragment": true,
};

const EXCLUDED_HTML_TAGS: Record<string, number> = {
	SCRIPT: 1,
	STYLE: 1,
	IFRAME: 1,
	OBJECT: 1,
	EMBED: 1,
	LINK: 1,
	META: 1,
	BASE: 1,
	APPLET: 1,
	FRAME: 1,
	FRAMESET: 1,
	NOSCRIPT: 1,
	SVG: 1,
	MATH: 1,
	TEMPLATE: 1,
	HEAD: 1,
};

function customTrim(str:string) {
    return str.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '');
}

function sanitizeHTML2(rawHTML: string) {
	const START_TAG = "<!--StartFragment-->";
	const END_TAG = "<!--EndFragment-->";
	const startIndex = rawHTML.indexOf(START_TAG);
	if (startIndex >= 0) {
		const endIndex = rawHTML.lastIndexOf(END_TAG);
		if (endIndex >= 0) {
			rawHTML = rawHTML.slice(startIndex + START_TAG.length, endIndex);
		} else {
			rawHTML = rawHTML.slice(startIndex + START_TAG.length);
		}
	}

	const tmpl = document.createElement("template");
	tmpl.innerHTML = rawHTML;
	console.log("tmpl", {
		tmpl,
		tmplContent: tmpl.content,
		tmplContentChild: tmpl.content.firstChild,
	});
	function traverse(node: Node): Node | null {
        if (node.nodeName === "#comment") {
            return null;
        }
		if (node.nodeType === 3) {
			if (EXCLUDED_HTML_TAGS[node.nodeName]) {
				return null;
			}
			if (TEXTLESS_ELEMENTS[node.parentNode!.nodeName]) {
				return null;
			}
			let text = node.nodeValue!;
			if (BLOCK_ELEMENTS[node.parentNode!.nodeName]) {
				text = customTrim(text);
			}
			if (text.length === 0) {
				return null;
			}
			return document.createTextNode(text);
		} else {
			let newNode: Node | null = null;
            if (node.nodeName === "#document-fragment") {
                newNode = document.createDocumentFragment();
            } else {
                newNode = document.createElement(node.nodeName);
            }
            if (node.nodeName === "TD" || node.nodeName === "TH") {
                const colspan = (node as HTMLTableCellElement).colSpan;
                const rowspan = (node as HTMLTableCellElement).rowSpan;
                if (colspan > 1) {
                    (newNode as HTMLTableCellElement).colSpan = colspan;
                }
                if (rowspan > 1) {
                    (newNode as HTMLTableCellElement).rowSpan = rowspan;
                }
            } else if (node.nodeName === "IMG") {
                const src = (node as HTMLImageElement).src;
                if (src && src.startsWith("data:")) {
                    (newNode as HTMLImageElement).src = src;
                }
            }
			for (const child of node.childNodes) {
				const result = traverse(child);
				if (result) {
					// if (!newNode) {
					// 	if (node.nodeName === "#document-fragment") {
					// 		newNode = document.createDocumentFragment();
					// 	} else {
					// 		newNode = document.createElement(node.nodeName);
					// 	}
					// 	if (node.nodeName === "TD" || node.nodeName === "TH") {
					// 		const colspan = (node as HTMLTableCellElement).colSpan;
					// 		const rowspan = (node as HTMLTableCellElement).rowSpan;
					// 		if (colspan > 1) {
					// 			(newNode as HTMLTableCellElement).colSpan = colspan;
					// 		}
					// 		if (rowspan > 1) {
					// 			(newNode as HTMLTableCellElement).rowSpan = rowspan;
					// 		}
					// 	}
					// }
					newNode.appendChild(result);
				}
			}

            if (!newNode && BLOCK_ELEMENTS[node.nodeName]) {

            }


            console.log("newNode", newNode, node.nodeName, node.childNodes.length);
			return newNode;
		}
		// return null;
	}

	console.log("tmpl.content", tmpl.content.firstChild);
	const final = traverse(tmpl.content as Node) as DocumentFragment;
	return final;
}

function sanitizeHTML(rawHTML: string) {
	const START_TAG = "<!--StartFragment-->";
	const END_TAG = "<!--EndFragment-->";
	const startIndex = rawHTML.indexOf(START_TAG);
	if (startIndex >= 0) {
		const endIndex = rawHTML.lastIndexOf(END_TAG);
		if (endIndex >= 0) {
			rawHTML = rawHTML.slice(startIndex + START_TAG.length, endIndex);
		} else {
			rawHTML = rawHTML.slice(startIndex + START_TAG.length);
		}
	}

	const tmpl = document.createElement("template");
	tmpl.innerHTML = rawHTML;

	const flagsStack: number[] = [0];

	function visit(node: Node): TextFragment[] {
		const isBlock = BLOCK_ELEMENTS[node.nodeName];
		let isNewFlags = false;
		let flags = flagsStack[0];
		if (node.nodeType === 1) {
			const color = (node as HTMLElement).style?.color;
			if (color) {
				flags &= ~STYLE_MASK_COLOR;
				if (isReddish(color)) {
					flags |= STYLE_COLOR_RED;
				}
			}
			if (flags !== flagsStack[flagsStack.length - 1]) {
				isNewFlags = true;
				flagsStack.push(flags);
			}
		}

		const results: TextFragment[] = [];

		if (node.nodeName === "TD" || node.nodeName === "TH") {
			// results.push({ text: "\t", flags: flags });
			results.push({ text: "<td>", flags: flags });
		} else if (node.nodeName === "TR") {
			results.push({ text: "<tr>", flags: flags });
		} else if (node.nodeName === "TABLE") {
			results.push({ text: "<table>", flags: flags });
		}
		if (node.childNodes) {
			const isTextless = TEXTLESS_ELEMENTS[node.nodeName];
			let prevIsBlock = false;
			let first = true;
			for (let i = 0; i < node.childNodes.length; i++) {
				const child = node.childNodes[i];
				if (child.nodeType === 3) {
					if (isTextless) {
						continue;
					}
					let text = child.nodeValue!;
					if (isBlock || node.nodeName === "TD") {
						text = text.trim();
						if (text.length === 0) {
							continue;
						}
					}

					if (i === 0 && (BLOCK_ELEMENTS[node.nodeName] || node.nodeName === "TD")) {
						text = text.trimStart();
					} else if (i === node.childNodes.length - 1 && (BLOCK_ELEMENTS[node.nodeName] || node.nodeName === "TD")) {
						text = text.trimEnd();
						console.log("last text:", { text, flags, parent: node, node: child });
					}
					if (text.length === 0) {
						continue;
					}

					// text = text.replace(/\t/g, "    ");

					if (first) {
					} else {
						if (prevIsBlock) {
							results.push({ text: "\n", flags, child: child, prev: node.childNodes[i - 1] } as TextFragment);
						}
					}
					prevIsBlock = false;
					first = false;
					//console.log("text", { text, flags, parent: node, node: child });

					results.push({ text, flags, parent: node } as TextFragment);
				} else if (child.nodeType === 1) {
					if (child.nodeName.startsWith("O:")) {
						continue;
					}
					if (child.nodeName === "BR") {
						prevIsBlock = false;
						results.push({ text: "\n", flags, child } as TextFragment);
						continue;
					}
					let childIsBlock = BLOCK_ELEMENTS[child.nodeName];
					if (first) {
					} else {
						if (childIsBlock || prevIsBlock) {
							results.push({ text: "\n", flags, childIsBlock, prevIsBlock, child } as TextFragment);
						}
					}
					prevIsBlock = childIsBlock;
					const childResults = visit(child);
					results.push(...childResults);
					first = false;
				}
			}
		}

		if (node.nodeName === "TD" || node.nodeName === "TH") {
			// results.push({ text: "\t", flags: flags });
			results.push({ text: "</td>", flags: flags });
		} else if (node.nodeName === "TR") {
			results.push({ text: "</tr>", flags: flags });
		} else if (node.nodeName === "TABLE") {
			results.push({ text: "</table>", flags: flags });
		}
		// if (node.nodeName === "TD" || node.nodeName === "TH") {
		// 	results.push({ text: "\t", flags: flags });
		// }

		if (isNewFlags) {
			flagsStack.pop();
		}

		return results;
	}

	const results = visit(tmpl.content);
	console.log("results", results);

	let prevFlags = 0;
	const strArr: string[] = [];
	let first = true;
	for (const { text, flags } of results) {
		if (first) {
			first = false;
			if (text === "\n") {
				continue;
			}
		}
		if (flags !== prevFlags) {
			if (prevFlags !== 0) {
				strArr.push(`</span>`);
			}
			if (flags !== 0) {
				if (flags & STYLE_MASK_COLOR) {
					strArr.push(`<span style="color: red">`);
				} else {
					strArr.push(`<span>`);
				}
			}
		}
		strArr.push(text);
		prevFlags = flags;
	}
	if (prevFlags !== 0) {
		strArr.push(`</span>`);
	}

	const result2 = sanitizeHTML2(rawHTML);
    // return result2.innerHTML;
	return strArr.join("");
}
