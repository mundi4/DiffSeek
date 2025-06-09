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

	const rgb = getRGB(color);
	isRed = rgb ? rgb[0] >= 139 && rgb[0] - Math.max(rgb[1], rgb[2]) >= 65 : false;

	reddishCache.set(color, isRed);
	return isRed;
}

// const INLINE_ELEMENTS: Record<string, boolean> = {
// 	SPAN: true,
// 	A: true,
// 	B: true,
// 	I: true,
// 	U: true,
// 	EM: true,
// 	STRONG: true,
// 	S: true,
// 	STRIKE: true,
// 	SUB: true,
// 	SUP: true,
// 	SMALL: true,
// 	BIG: true,
// 	MARK: true,
// 	INS: true,
// 	DEL: true,
// 	CODE: true,
// 	KBD: true,
// 	SAMP: true,
// 	VAR: true,
// 	DFN: true,
// 	ABBR: true,
// 	TIME: true,
// 	CITE: true,
// 	Q: true,
// 	LABEL: true,
// };

// const LINEBREAK_ELEMENTS: Record<string, boolean> = {
// 	DD: true,
// 	DT: true,
// 	DIV: true,
// 	P: true,
// 	H1: true,
// 	H2: true,
// 	H3: true,
// 	H4: true,
// 	H5: true,
// 	H6: true,
// 	UL: true,
// 	OL: true,
// 	LI: true,
// 	BLOCKQUOTE: true,
// 	FORM: true,
// 	HEADER: true,
// 	FOOTER: true,
// 	ARTICLE: true,
// 	SECTION: true,
// 	ASIDE: true,
// 	NAV: true,
// 	ADDRESS: true,
// 	FIGURE: true,
// 	FIGCAPTION: true,
// 	TABLE: true,
// 	CAPTION: true,
// 	TR: true,
// };

// const EXCLUDED_HTML_TAGS: Record<string, number> = {
// 	SCRIPT: 1,
// 	STYLE: 1,
// 	IFRAME: 1,
// 	OBJECT: 1,
// 	EMBED: 1,
// 	LINK: 1,
// 	META: 1,
// 	BASE: 1,
// 	APPLET: 1,
// 	FRAME: 1,
// 	FRAMESET: 1,
// 	NOSCRIPT: 1,
// 	SVG: 1,
// 	MATH: 1,
// 	TEMPLATE: 1,
// 	HEAD: 1,
// };

type ElementOptions = {
	allowedAttrs?: Record<string, boolean>;
	allowedStyles?: Record<string, boolean>;
	replaceTag?: string;
	void?: boolean;
	unwrap?: boolean;
};

const COMMON_ALLOWED_STYLES: Record<string, boolean> = {
	textAlign: true,
	fontSize: true,
	fontWeight: true,
	fontStyle: true,
	margin: true,
	marginLeft: true,
	marginRight: true,
	marginTop: true,
	marginBottom: true,
	marginBlockStart: true,
	marginBlockEnd: true,
	marginBlock: true,
	marginInlineStart: true,
	marginInlineEnd: true,
	marginInline: true,
	padding: true,
	paddingLeft: true,
	paddingRight: true,
	paddingTop: true,
	paddingBottom: true,
	paddingBlockStart: true,
	paddingBlockEnd: true,
	paddingBlock: true,
	paddingInlineStart: true,
	paddingInlineEnd: true,
	paddingInline: true,
};

const DefaultElementOptions: ElementOptions = {
	allowedStyles: COMMON_ALLOWED_STYLES,
};

const AsDivElementOptions: ElementOptions = {
	replaceTag: "DIV",
};

const SMART_TAG_OPTIONS: ElementOptions = {
	unwrap: true,
};

const ALLOWED_ELEMENTS: Record<string, ElementOptions> = {
	TABLE: DefaultElementOptions,
	TBODY: DefaultElementOptions,
	THEAD: DefaultElementOptions,
	TFOOT: DefaultElementOptions,
	CAPTION: DefaultElementOptions,
	TR: DefaultElementOptions,
	TH: { allowedAttrs: { colspan: true, rowspan: true }, allowedStyles: COMMON_ALLOWED_STYLES },
	TD: { allowedAttrs: { colspan: true, rowspan: true }, allowedStyles: COMMON_ALLOWED_STYLES },
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
	MARK: DefaultElementOptions,
	CODE: DefaultElementOptions,
	PRE: DefaultElementOptions,
	SMALL: DefaultElementOptions,
	DEL: DefaultElementOptions,
	INS: DefaultElementOptions,
	IMG: { allowedAttrs: { src: true, width: true, height: true }, allowedStyles: { width: true, height: true } },
	SPAN: DefaultElementOptions,
	LABEL: DefaultElementOptions,
	BR: { void: true },
	HR: { void: true },
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
	"#document-fragment": DefaultElementOptions,
};

type ContainerStackItem = {
	node: ParentNode;
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

const TRIM_CHARS: Record<string, boolean> = {
	" ": true,
	"\n": true,
	"\r": true,
	"\t": true,
	"\f": true,
};

type SanitizedNodeResult = {
	node: Node;
	hasText: boolean;
	hasNonEmptyText: boolean;
};


// TODO
// 워드에서 복붙할때 빈줄이 <p><o:p></o:p></p> 이런식으로 들어올 수도 있다
// 이 경우 <p><br></p>로 바꿔야 한다.
function sanitizeHTML(rawHTML: string): Node {
	// 보통 복붙을 하면 <!--StartFragment-->와 <!--EndFragment--> 태그로 감싸져 있다.
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

	// console.debug("sanitizeHTML called with rawHTML:", rawHTML);

	const containerStack: ContainerStackItem[] = [];

	function traverse(node: Node) {
		if (
			node.nodeType !== 1 && // element
			node.nodeType !== 11 // document fragment
		) {
			return null;
		}

		const nodeName = node.nodeName;
		let elementOptions = ALLOWED_ELEMENTS[nodeName];
		if (!elementOptions) {
			if (nodeName.startsWith("ST1:")) {
				elementOptions = SMART_TAG_OPTIONS;
			}
			if (!elementOptions) {
				return null;
			}
		}

		let containerNode: ParentNode;

		if (elementOptions.unwrap) {
			containerNode = containerStack[containerStack.length - 1].node;
		} else {
			if (node.nodeType === 1) {
				containerNode = document.createElement(elementOptions.replaceTag || nodeName);
				if (elementOptions.allowedAttrs) {
					for (const attr of (node as HTMLElement).attributes) {
						if (elementOptions.allowedAttrs[attr.name]) {
							(containerNode as HTMLElement).setAttribute(attr.name, attr.value);
						}
					}
				}
				if (elementOptions.allowedStyles) {
					const style = (node as HTMLElement).style;
					for (const prop in elementOptions.allowedStyles) {
						if (style[prop as any]) {
							(containerNode as HTMLElement).style[prop as any] = style[prop as any];
						}
					}
				}

				let colorValue = (node as HTMLElement).style?.color;
				if (colorValue) {
					if (colorValue === "inherit") {
						// use parent color
					} else {
						if (isReddish(colorValue)) {
							(containerNode as HTMLElement).classList.add("color-red");
						}
					}
				}
			} else {
				// document fragment
				containerNode = document.createDocumentFragment();
			}
			containerStack.push({ node: containerNode });
		}

		if (!elementOptions.void) {
			let isTextless = TEXTLESS_ELEMENTS[nodeName];
			for (const childNode of node.childNodes) {
				let sanitizedChild: Node | null = null;

				if (childNode.nodeType === 3) {
					if (isTextless) {
						continue;
					}
					sanitizedChild = document.createTextNode(childNode.nodeValue!);
				} else {
					sanitizedChild = traverse(childNode);
					if (!sanitizedChild) {
						continue;
					}
				}

				containerNode.appendChild(sanitizedChild);
			}
		}

		// containerNode.normalize();

		// if (containerNode.nodeName === "P") {
		// 	if (containerNode.childNodes.length === 0) {
		// 		containerNode.appendChild(document.createElement("BR"));
		// 	}
		// } else {
		// 	if (BLOCK_ELEMENTS[nodeName] && !BLOCK_ELEMENTS[containerNode.nodeName]) {
		// 		containerNode.appendChild(document.createElement("BR"));
		// 	}
		// }

		// if (containerNode.nodeType !== 11) {
		// }

		if ((elementOptions.unwrap || (containerNode.nodeType === 1 && !TEXTLESS_ELEMENTS[containerNode.nodeName])) && containerNode.childNodes.length === 0) {
			containerNode.appendChild(document.createTextNode(""));
		}

		if (!elementOptions.unwrap) {
			containerStack.pop();
		}

		return containerNode;
	}

	const tmpl = document.createElement("template");
	tmpl.innerHTML = rawHTML;

	const root = document.createDocumentFragment();
	containerStack.push({ node: root });
	const result = traverse(tmpl.content)!;
	// result.normalize();
	// if (result.childNodes.length === 0) {
	// 	result.appendChild(document.createTextNode(""));
	// }
	return result;
}
