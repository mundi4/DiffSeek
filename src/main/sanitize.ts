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

const INLINE_ELEMENTS: Record<string, boolean> = {
	SPAN: true,
	A: true,
	B: true,
	I: true,
	U: true,
	EM: true,
	STRONG: true,
	S: true,
	STRIKE: true,
	SUB: true,
	SUP: true,
	SMALL: true,
	BIG: true,
	MARK: true,
	INS: true,
	DEL: true,
	CODE: true,
	KBD: true,
	SAMP: true,
	VAR: true,
	DFN: true,
	ABBR: true,
	TIME: true,
	CITE: true,
	Q: true,
	LABEL: true,
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

const EMPTY_ATTRS = {};

const ALLOWED_CONTAINER_TAGS: Record<string, Record<string, boolean>> = {
	TABLE: EMPTY_ATTRS,
	TBODY: EMPTY_ATTRS,
	THEAD: EMPTY_ATTRS,
	TFOOT: EMPTY_ATTRS,
	CAPTION: EMPTY_ATTRS,
	TR: EMPTY_ATTRS,
	TH: { colspan: true, rowspan: true },
	TD: { colspan: true, rowspan: true },
	H1: EMPTY_ATTRS,
	H2: EMPTY_ATTRS,
	H3: EMPTY_ATTRS,
	H4: EMPTY_ATTRS,
	H5: EMPTY_ATTRS,
	H6: EMPTY_ATTRS,
	SUP: EMPTY_ATTRS,
	SUB: EMPTY_ATTRS,
	EM: EMPTY_ATTRS,
	I: EMPTY_ATTRS,
	S: EMPTY_ATTRS,
	B: EMPTY_ATTRS,
	STRONG: EMPTY_ATTRS,
	U: EMPTY_ATTRS,
	STRIKE: EMPTY_ATTRS,
	P: EMPTY_ATTRS,
	UL: EMPTY_ATTRS,
	OL: EMPTY_ATTRS,
	LI: EMPTY_ATTRS,
	DL: EMPTY_ATTRS,
	DT: EMPTY_ATTRS,
	DD: EMPTY_ATTRS,
	DIV: EMPTY_ATTRS,
	HEADER: EMPTY_ATTRS,
	FOOTER: EMPTY_ATTRS,
	SECTION: EMPTY_ATTRS,
	ARTICLE: EMPTY_ATTRS,
	ASIDE: EMPTY_ATTRS,
	BLOCKQUOTE: EMPTY_ATTRS,
	ADDRESS: EMPTY_ATTRS,

	//"#document-fragment": EMPTY_ATTRS,
};

const TEXT_FLOW_CONTAINERS: Record<string, boolean> = {
	DIV: true,
	PRE: true,
	BLOCKQUOTE: true,
	LI: true,
	TD: true,
	TH: true,
	SECTION: true,
	ARTICLE: true,
	HEADER: true,
	FOOTER: true,
	ASIDE: true,
	MAIN: true,
	CAPTION: true,
	FIGURE: true,
	FIGCAPTION: true,
};

function customTrim(str: string) {
	return str.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, "");
}

type ContainerStackItem = {
	node: ParentNode;
	color?: string;
};

function coerceColor(color: string): string | undefined {
	if (isReddish(color)) {
		return "red";
	}
	return undefined;
}

type ConditionalBlock = {
	condition: string;
	children: (string | ConditionalBlock)[];
};

// 조건 시작 정규식 (주석 유무 상관없이, [if ...]> 또는 <![if ...]> 모두 포괄)
const ifRegex = /(?:<!--)?<?!?\[if\s+([^\]]+?)\]>?/gi;
// 조건 종료 정규식
const endifRegex = /<!\[endif\](?:-->|\])?/i;

/**
 * input: 파싱할 전체 문자열
 * start: 파싱 시작 위치 (무조건 [if ...]가 시작하는 위치여야 함)
 *
 * returns: [조건부 블록, 종료 위치]
 */
function parseIfBlock(input: string, start: number): [ConditionalBlock, number] {
	ifRegex.lastIndex = start;
	const ifMatch = ifRegex.exec(input);
	if (!ifMatch || ifMatch.index !== start) {
		console.error("parseIfBlock must start at an [if] condition", { ifMatch, start, input });
		throw new Error("parseIfBlock must start at an [if] condition");
	}

	const condition = ifMatch[1].trim();
	let cursor = ifRegex.lastIndex;
	const children: (string | ConditionalBlock)[] = [];

	while (cursor < input.length) {
		ifRegex.lastIndex = cursor;
		endifRegex.lastIndex = cursor;

		const nextIf = ifRegex.exec(input);
		const nextEndIf = endifRegex.exec(input);

		if (nextEndIf && (!nextIf || nextEndIf.index < nextIf.index)) {
			// endif가 먼저 나오면 현재 조건 종료
			if (nextEndIf.index > cursor) {
				const text = input.slice(cursor, nextEndIf.index);
				if (text.trim()) children.push(text);
			}
			cursor = nextEndIf.index + nextEndIf[0].length;
			return [{ condition, children }, cursor];
		}

		if (nextIf && nextIf.index === cursor) {
			// 중첩된 if 조건 파싱 재귀 호출
			console.log("parseIfBlock called at pos:", start);
			console.log("String at start:", input.slice(start, start + 20));
			const [childBlock, newPos] = parseIfBlock(input, cursor);
			children.push(childBlock);
			cursor = newPos;
			continue;
		}

		// 일반 텍스트 추출 (다음 조건문 혹은 endif까지)
		let nextPos = input.length;
		if (nextIf) nextPos = Math.min(nextPos, nextIf.index);
		if (nextEndIf) nextPos = Math.min(nextPos, nextEndIf.index);

		const text = input.slice(cursor, nextPos);
		if (text.trim()) children.push(text);
		cursor = nextPos;
	}

	throw new Error("Missing matching [endif]");
}

function sanitizeHTML(rawHTML: string): Node {
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

	let flags = 0;
	const containerStack: ContainerStackItem[] = [];

	function traverse(node: Node) {
		if (node.nodeType === 3) {
			if (TEXTLESS_ELEMENTS[node.parentNode!.nodeName]) {
				return null;
			}
			let text = node.nodeValue!;
			if (TEXT_FLOW_CONTAINERS[node.parentNode!.nodeName]) {
				text = customTrim(text);
			}
			if (text.length === 0) {
				return null;
			}
			text = text.replace(/\n+/g, " ");
			return document.createTextNode(text);
		}

		// if (node.nodeType === 8) {
		// 	console.log("comment", node.nodeValue);
		// 	const parseResult = parseIfBlock(node.nodeValue!, 0);
		// 	console.log("parseResult", parseResult);
		// 	return null;
		// }

		if (node.nodeType !== 1 && node.nodeType !== 11) {
			return null;
		}

		if (EXCLUDED_HTML_TAGS[node.nodeName]) {
			return null;
		}

		if (node.nodeName === "O:P") {
			// if (node.childNodes.length === 1) {
			// 	const onlyChild = node.childNodes[0];
			// 	if (onlyChild.nodeType === 3 && onlyChild.nodeValue === "\u00A0") {
			// 		return document.createTextNode("");
			// 	}
			// }
			return null;
		}

		if (node.nodeName === "BR") {
			return document.createElement("BR");
		}

		if (node.nodeName === "IMG") {
			const span = document.createElement("SPAN");
			span.textContent = "🖼️";
			span.className = "dsimg";
			span.contentEditable = "false";
			span.dataset.src = (node as HTMLImageElement).src;
			return span;
		}

		let color: string | undefined = containerStack[containerStack.length - 1].color;
		if (node.nodeType === 1) {
			let colorValue = (node as HTMLElement).style?.color;
			if (colorValue) {
				if (colorValue === "inherit") {
					// use parent color
				} else {
					if (isReddish(colorValue)) {
						color = "red";
					} else {
						color = undefined!;
					}
				}
			}
		}

		let containerNode: ParentNode | null = null;
		const allowedAttrs = ALLOWED_CONTAINER_TAGS[node.nodeName];
		if (allowedAttrs) {
			containerNode = document.createElement(node.nodeName === "P" ? "DIV" : node.nodeName);
			for (const attr of (node as HTMLElement).attributes) {
				if (allowedAttrs[attr.name]) {
					(containerNode as HTMLElement).setAttribute(attr.name, attr.value);
				}
			}
		} else {
			containerNode = document.createDocumentFragment();
		}
		//containerStack[containerStack.length - 1].node.appendChild(containerNode);
		containerStack.push({ node: containerNode, color: color });

		let hasChildren = false;
		//node.normalize();

		for (const child of node.childNodes) {
			let childResult = traverse(child);
			if (!childResult) {
				continue;
			}

			if (childResult.nodeType === 3) {
				if (color) {
					const span = document.createElement("span");
					span.className = "color-" + color;
					span.appendChild(childResult);
					childResult = span;
				}
				// console.log("childresult:", {
				// 	child:child,
				// 	childResult: childResult,
				// 	nodeName: childResult.nodeName,
				// 	nodeType: childResult.nodeType,
				// 	textContent: (childResult as Text).textContent,
				// });
			}

			containerNode.appendChild(childResult);
			if (!TEXTLESS_ELEMENTS[node.nodeName]) {
				if (BLOCK_ELEMENTS[child.nodeName] && !BLOCK_ELEMENTS[childResult.nodeName]) {
					// containerNode.appendChild(document.createElement("BR"));
				}
			}
		}

		containerNode.normalize();

		if (containerNode.nodeName === "P") {
			if (containerNode.childNodes.length === 0) {
				containerNode.appendChild(document.createElement("BR"));
			}
		} else {
			if (BLOCK_ELEMENTS[node.nodeName] && !BLOCK_ELEMENTS[containerNode.nodeName]) {
				containerNode.appendChild(document.createElement("BR"));
			}
		}

		// if (containerNode.nodeType !== 11) {
		// }
		containerStack.pop();

		if (containerNode.nodeType === 1 && !TEXTLESS_ELEMENTS[containerNode.nodeName] && containerNode.childNodes.length === 0) {
			containerNode.appendChild(document.createTextNode(""));
		}

		if (INLINE_ELEMENTS[containerNode.nodeName]) {
			if (containerNode.childNodes.length === 0) {
				containerNode = null;
			} else if (containerNode.childNodes.length === 1) {
				const onlyChild = containerNode.childNodes[0];
				if (onlyChild.nodeType === 3 && onlyChild.nodeValue === "") {
					containerNode = null;
				}
			}
		}

		return containerNode;
	}

	const root = document.createDocumentFragment();
	containerStack.push({ node: root, color: undefined });
	const result = traverse(tmpl.content)!;
	result.normalize();
	if (result.childNodes.length === 0) {
		result.appendChild(document.createTextNode(""));
	}
	return result;
}

function sanitizeNode(content: Node): [Node, boolean] {
	let hasBlockElements = false;
	const containerStack: ContainerStackItem[] = [];

	function traverse(node: Node) {
		if (node.nodeType === 3) {
			if (TEXTLESS_ELEMENTS[node.parentNode!.nodeName]) {
				return null;
			}
			let text = node.nodeValue!;
			if (TEXT_FLOW_CONTAINERS[node.parentNode!.nodeName]) {
				text = customTrim(text);
			}
			if (text.length === 0) {
				return null;
			}
			text = text.replace(/\n+/g, " ");
			return document.createTextNode(text);
		}

		// if (node.nodeType === 8) {
		// 	console.log("comment", node.nodeValue);
		// 	const parseResult = parseIfBlock(node.nodeValue!, 0);
		// 	console.log("parseResult", parseResult);
		// 	return null;
		// }

		if (node.nodeType !== 1 && node.nodeType !== 11) {
			return null;
		}

		if (EXCLUDED_HTML_TAGS[node.nodeName]) {
			return null;
		}

		if (node.nodeName === "O:P") {
			// if (node.childNodes.length === 1) {
			// 	const onlyChild = node.childNodes[0];
			// 	if (onlyChild.nodeType === 3 && onlyChild.nodeValue === "\u00A0") {
			// 		return document.createTextNode("");
			// 	}
			// }
			return null;
		}

		if (node.nodeName === "BR") {
			return document.createElement("BR");
		}

		if (node.nodeName === "IMG") {
			const span = document.createElement("SPAN");
			span.textContent = "🖼️";
			span.className = "dsimg";
			span.contentEditable = "false";
			span.dataset.src = (node as HTMLImageElement).src;
			return span;
		}

		let color: string | undefined = containerStack[containerStack.length - 1].color;
		if (node.nodeType === 1) {
			let colorValue = (node as HTMLElement).style?.color;
			if (colorValue) {
				if (colorValue === "inherit") {
					// use parent color
				} else {
					if (isReddish(colorValue)) {
						color = "red";
					} else {
						color = undefined!;
					}
				}
			}
		}

		let containerNode: ParentNode | null = null;
		const allowedAttrs = ALLOWED_CONTAINER_TAGS[node.nodeName];
		if (allowedAttrs) {
			containerNode = document.createElement(node.nodeName);
			for (const attr of (node as HTMLElement).attributes) {
				if (allowedAttrs[attr.name]) {
					(containerNode as HTMLElement).setAttribute(attr.name, attr.value);
				}
			}
		} else {
			containerNode = document.createDocumentFragment();
		}
		//containerStack[containerStack.length - 1].node.appendChild(containerNode);
		containerStack.push({ node: containerNode, color: color });

		let hasChildren = false;
		//node.normalize();

		for (const child of node.childNodes) {
			let childResult = traverse(child);
			if (!childResult) {
				continue;
			}

			if (childResult.nodeType === 3) {
				if (color) {
					const span = document.createElement("span");
					span.className = "color-" + color;
					span.appendChild(childResult);
					childResult = span;
				}
				// console.log("childresult:", {
				// 	child:child,
				// 	childResult: childResult,
				// 	nodeName: childResult.nodeName,
				// 	nodeType: childResult.nodeType,
				// 	textContent: (childResult as Text).textContent,
				// });
			}

			containerNode.appendChild(childResult);
			if (!TEXTLESS_ELEMENTS[node.nodeName]) {
				if (BLOCK_ELEMENTS[child.nodeName] && !BLOCK_ELEMENTS[childResult.nodeName]) {
					// containerNode.appendChild(document.createElement("BR"));
				}
			}
		}

		containerNode.normalize();

		if (containerNode.nodeName === "P") {
			if (containerNode.childNodes.length === 0) {
				containerNode.appendChild(document.createElement("BR"));
			}
		} else {
			if (BLOCK_ELEMENTS[node.nodeName] && !BLOCK_ELEMENTS[containerNode.nodeName]) {
				containerNode.appendChild(document.createElement("BR"));
			}
		}

		// if (containerNode.nodeType !== 11) {
		// }
		containerStack.pop();

		if (containerNode.nodeType === 1 && !TEXTLESS_ELEMENTS[containerNode.nodeName] && containerNode.childNodes.length === 0) {
			containerNode.appendChild(document.createTextNode(""));
		}

		if (INLINE_ELEMENTS[containerNode.nodeName]) {
			if (containerNode.childNodes.length === 0) {
				containerNode = null;
			} else if (containerNode.childNodes.length === 1) {
				const onlyChild = containerNode.childNodes[0];
				if (onlyChild.nodeType === 3 && onlyChild.nodeValue === "") {
					containerNode = null;
				}
			}
		} else if (!hasBlockElements && BLOCK_ELEMENTS[containerNode.nodeName]) {
			hasBlockElements = true;
		}

		return containerNode;
	}

	const root = document.createDocumentFragment();
	containerStack.push({ node: root, color: undefined });
	const result = traverse(content)!;
	result.normalize();
	if (result.childNodes.length === 0) {
		result.appendChild(document.createTextNode(""));
	}
	return [result, hasBlockElements];
}
