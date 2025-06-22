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
	TITLE: 1,
	CANVAS: 1,
	AUDIO: 1,
	VIDEO: 1,
	TRACK: 1,
	SOURCE: 1,
	BGSOUND: 1,
};

type ElementOptions = {
	allowedAttrs?: Record<string, boolean>;
	allowedStyles?: Record<string, boolean>;
	replaceTag?: string;
	void?: boolean;
	unwrap?: boolean;
	exclude?: boolean;
};

const COMMON_ALLOWED_STYLES: Record<string, boolean> = {
	textAlign: true,
	fontSize: true,
	fontWeight: true,
	fontStyle: true,
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

const EXCLUDED_TAG_OPTIONS: ElementOptions = {
	exclude: true,
};

const COMMON_INLINE_ELEMENT_OPTIONS: ElementOptions = {
	allowedStyles: COMMON_ALLOWED_STYLES,
	replaceTag: "SPAN",
};

const ELEMENT_POLICIES: Record<string, ElementOptions> = {
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
	TBODY: { unwrap: true },
	THEAD: { unwrap: true },
	TFOOT: { unwrap: true },
	CAPTION: DefaultElementOptions,
	TR: DefaultElementOptions,
	TD: { allowedAttrs: { colspan: true, rowspan: true }, allowedStyles: COMMON_ALLOWED_STYLES },
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
	MARK: DefaultElementOptions,
	CODE: DefaultElementOptions,
	PRE: DefaultElementOptions,
	SMALL: DefaultElementOptions,
	DEL: DefaultElementOptions,
	INS: DefaultElementOptions,
	IMG: { allowedAttrs: { src: true, width: true, height: true }, allowedStyles: { width: true, height: true } },
	FONT: { replaceTag: "SPAN", allowedStyles: COMMON_ALLOWED_STYLES },
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

// die. just die.
type CharMap = Record<string, string>;
const WINGDINGS_TRANSFORM: Record<string, CharMap> = {
	Wingdings: {
		"\u00DF": "🡠",
		"\u00E0": "🡢",
		"\u00E1": "🡡",
		"\u00E2": "🡣",
		"\u00E3": "🡤",
		"\u00E4": "🡥",
		"\u00E5": "🡧",
		"\u00E6": "🡦",
		"\u00E7": "🡠",
		"\u00E8": "🡢",
		"\u00E9": "🡡",
		"\u00EA": "🡣",
		"\u00EB": "🡤",
		"\u00EC": "🡥",
		"\u00ED": "🡧",
		"\u00EE": "🡦",
		"\u0080": "⓪",	
		"\u0081": "①",
		"\u0082": "②",
		"\u0083": "③",
		"\u0084": "④",
		"\u0085": "⑤",
		"\u0086": "⑥",
		"\u0087": "⑦",
		"\u0088": "⑧",
		"\u0089": "⑨",
		"\u008A": "⑩",
		"\u008B": "⓿",
		"\u008C": "❶",
		"\u008D": "❷",
		"\u008E": "❸",
		"\u008F": "❹",
		"\u0090": "❺",
		"\u0091": "❻",
		"\u0092": "❼",
		"\u0093": "❽",
		"\u0094": "❾",
		"\u0095": "❿",
	},
};

function transformText(input: string, charMap: CharMap): string {
	let result = "";
	for (const ch of input) {
		result += charMap[ch] || ch;
	}
	return result;
}

// 진짜 병목은 execCommand("insertHTML", ...)임. 이 함수는 죄가 없다.
function sanitizeHTML(rawHTML: string): Node {
	// 보통 복붙을 하면 내용은 <!--StartFragment-->...<!--EndFragment-->로 감싸져 있고 그 앞으로 잡다한 메타데이터들이 포함됨.
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

	console.log("rawHTML", rawHTML);

	type _States = {
		font: string | null;
	};

	const statesStack: _States[] = [];
	let states: _States = {
		font: null,
	};

	function traverse(node: Node) {
		if (
			node.nodeType !== 1 && // element
			node.nodeType !== 11 // document fragment
		) {
			return null;
		}

		const nodeName = node.nodeName;
		let elementOptions = ELEMENT_POLICIES[nodeName];

		if (!elementOptions) {
			if (nodeName === "O:P" && node.childNodes.length === 1 && node.childNodes[0].nodeValue! === "\u00A0") {
				// 워드에서 복붙할때 빈줄이 <p><o:p>&nbsp;</o:p></p> 이런 형태로 들어올 수도 있다
				return document.createElement("BR");
			} else if (nodeName.startsWith("ST1:")) {
				// 워드에서 날짜 같은 값이 종종 <st1:date>태그로 표현됨. WTF?
				elementOptions = SMART_TAG_OPTIONS;
			}
			if (!elementOptions) {
				elementOptions = COMMON_INLINE_ELEMENT_OPTIONS;
			}
		}

		if (elementOptions.exclude) {
			return null;
		}
		
		statesStack.push(states);
		states = { ...states };

		let containerNode: ParentNode;
		if (elementOptions.unwrap || node.nodeType === 11) {
			containerNode = document.createDocumentFragment();
		} else {
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

			let fontFamily = (node as HTMLElement).style?.fontFamily;
			if (fontFamily) {
				if (fontFamily === "inherit") {
					// use parent font
				} else {
					if (fontFamily !== states.font) {
						if (WINGDINGS_TRANSFORM[fontFamily]) {
							states.font = fontFamily;
						}
					}
				}
			}
		}

		if (!elementOptions.void) {
			let isTextless = TEXTLESS_ELEMENTS[nodeName];
			for (const childNode of node.childNodes) {
				let sanitizedChild: Node | null = null;

				if (childNode.nodeType === 3) {
					if (isTextless) {
						continue;
					}
					let text = childNode.nodeValue!;
					if (states.font) {
						text = transformText(text, WINGDINGS_TRANSFORM[states.font]!);
					}
					sanitizedChild = document.createTextNode(text);
				} else {
					sanitizedChild = traverse(childNode);
					if (!sanitizedChild) {
						continue;
					}
				}

				containerNode.appendChild(sanitizedChild);
			}
		}

		states = statesStack.pop()!;

		if (!BLOCK_ELEMENTS[nodeName] && !VOID_ELEMENTS[nodeName]) {
			if (
				containerNode.childNodes.length === 0 ||
				(containerNode.childNodes.length === 1 && containerNode.firstChild?.nodeType === 3 && containerNode.firstChild.nodeValue === "")
			) {
				return null;
			}
		}

		if ((elementOptions.unwrap || (containerNode.nodeType === 1 && !TEXTLESS_ELEMENTS[containerNode.nodeName])) && containerNode.childNodes.length === 0) {
			containerNode.appendChild(document.createTextNode(""));
		}
		return containerNode;
	}

	const result = traverse(tmpl.content)!;
	// result.normalize();
	// if (result.childNodes.length === 0) {
	// 	result.appendChild(document.createTextNode(""));
	// }
	return result;
}
