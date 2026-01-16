import { TEXTLESS_ELEMENTS } from "./constants";
import { sanitizeWordVMLPairs } from "./sanitizeWordVMLPairs";

type ElementOptions = {
	allowedAttrs?: Record<string, boolean>;
	allowedStyles?: Record<string, boolean>;
	replaceTag?: string;
	void?: boolean;
	unwrap?: boolean;
	exclude?: boolean;
};

const EXCLUDED_TAG_OPTIONS: ElementOptions = {
	exclude: true,
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
	allowedStyles: COMMON_ALLOWED_STYLES,
};

const COMMON_INLINE_ELEMENT_OPTIONS: ElementOptions = {
	replaceTag: "SPAN",
	allowedStyles: COMMON_ALLOWED_STYLES,
};

const SMART_TAG_OPTIONS: ElementOptions = COMMON_INLINE_ELEMENT_OPTIONS;

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
	IMG: { void: true, allowedAttrs: { ["data-hash"]: true, src: true, width: true, height: true }, allowedStyles: { width: true, height: true } },
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
	MARK: {
		replaceTag: "SPAN",
		allowedStyles: COMMON_ALLOWED_STYLES,
	},
	FIGURE: DefaultElementOptions,
	FIGCAPTION: DefaultElementOptions,
	"#document-fragment": DefaultElementOptions,
};

// die. just die.
type CharMap = Record<string, string>;
const DINGBAT_TRANSFORM: Record<string, CharMap> = {
	wingdings: {
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
		"\x9E": "·",
		"\x9F": "•",
		"\xA0": "▪",
		"\xA2": "🞆",
		"\xA4": "◉",
		"\xA5": "◎",
	},
	["wingdings 2"]: {
		"\x3F": "🖙",
		"\x9F": "⬝",
		"\xA0": "▪",
		"\xA1": "■",
		"\xF8": "※",
	},
	["wingdings 3"]: {
		"\x33": "→", "\x34": "←", "\x35": "↑", "\x36": "↓",
		"\x39": "↔", "\x3A": "↕",
		"\x41": "▶", "\x42": "◀", "\x43": "▲", "\x44": "▼",
	},
	symbol: {
		"\xAB": "↔",
		"\xAC": "←",
		"\xAD": "↑",
		"\xAE": "→",
		"\xAF": "↓",
	},
};

function transformText(input: string, font: keyof typeof DINGBAT_TRANSFORM): string {
	const charMap = DINGBAT_TRANSFORM[font];
	let result = "";
	for (const ch of input) {
		result += charMap[ch] || ch;
	}
	return result;
}

const START_TAG = "<!--StartFragment-->";
const END_TAG = "<!--EndFragment-->";
function sliceFragment(html: string): string {
	const s = html.indexOf(START_TAG);
	if (s < 0) return html;
	const e = html.lastIndexOf(END_TAG);
	return e >= 0 ? html.slice(s + START_TAG.length, e) : html.slice(s + START_TAG.length);
}

const _EMPTY_LINE = (() => {
	const p = document.createElement("P");
	p.appendChild(document.createElement("BR"));
	return p;
})();

function appendEmptyLine(parent: ParentNode) {
	//parent.appendChild(_EMPTY_LINE.cloneNode(true));
}

function getElementPolicy(node: Node): ElementOptions {
	const nodeName = node.nodeName; // 변환 금지: DOM 그대로

	const direct = ELEMENT_POLICIES[nodeName];
	if (direct) return direct;

	// 워드에서 복붙할 때 따라오는 잡다한 태그들
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

function copyAllowedAttributes(from: Element, to: Element, allowed?: Record<string, boolean>) {
	if (!allowed) return;
	for (const attr of from.attributes) {
		if (allowed[attr.name]) to.setAttribute(attr.name, attr.value);
	}
}

function copyAllowedStyles(from: CSSStyleDeclaration, to: CSSStyleDeclaration, allowed?: Record<string, boolean>) {
	if (!allowed) return;
	for (const k in allowed) {
		const v = (from as CSSStyleDeclaration).getPropertyValue(k);
		if (v) (to as CSSStyleDeclaration).setProperty(k, v);
	}
}

function normalizeFont(raw: string | null | undefined) {
	if (!raw) return null;
	let s = raw.split(",")[0].trim();
	s = s.replace(/^['"]+|['"]+$/g, "").toLowerCase();
	return s || null;
}

function resolveDingbatFont(node: HTMLElement, prev: string | null): string | null {
	const el = node as HTMLElement;

	const raw = el.style?.fontFamily || (node.nodeName === "FONT" ? el.getAttribute("face") || "" : "");
	const fam = normalizeFont(raw);

	if (!fam || fam === "inherit") return prev;
	return DINGBAT_TRANSFORM[fam] ? fam : null;
}

function resolveColor(node: HTMLElement, prev: string | null) {
	let color: string | null = null;

	if ((node as HTMLElement).classList.contains("color-red")) {
		color = "red";
	} else {
		const colorValue = (node as HTMLElement).style?.color || "inherit";
		//console.log("Resolvecolor:", node.nodeName, colorValue, node.textContent)
		if (colorValue) {
			if (colorValue === "inherit") {
				// use parent color
				color = prev;
			} else {
				// 빨간색에만... 나는 빨간색만 알고 싶다.
				if (isReddish(colorValue)) {
					color = "red";
				} else {
					color = "default";
				}
			}
		}
	}
	return color;
}
/**
 * 안전한 워드 VML 정리 + 텍스트박스 복구
 * - 문서 전체를 건드리는 전역 문법 수선 절대 없음
 * - 블록 단위로만 치환/정리 (매칭된 블록 내부에서만 '>' 경계 같은 걸 정리)
 * - v:textbox 우선 추출, 그다음 !vml fallback, 그다음 <v:imagedata>
 */
export function sanitizeWordVMLImages(rawHtml: string): string {
	if (!rawHtml) return rawHtml;
	let html = rawHtml;

	// (A) gte vml 1 + optional !vml fallback 세트: 블록 단위로 처리 (안전)
	html = html.replace(
		new RegExp(
			String.raw`(?:<!--\s*\[if\s*gte\s+vml\s+1\]\s*>|<!\s*\[if\s*gte\s+vml\s+1\]\s*>)([\s\S]*?)<!\s*\[endif\]\s*(?:-->)?\s*` +
			String.raw`(?:(?:<!--\s*\[if\s*!vml\]\s*>|<!\s*\[if\s*!vml\]\s*>)([\s\S]*?)<!\s*\[endif\]\s*(?:-->)?)?`,
			"gi"
		),
		(_m, vmlInner: string, vmlFallback?: string) => {
			// --- 모든 처리는 이 콜백 내부에서만 이뤄진다 (문서 전역 변경 금지) ---
			// 1) v:textbox 내부 텍스트 우선 추출
			const text = extractTextboxText(vmlInner);
			if (text) {
				return `<div data-origin="word-textbox">${escapeHTML(text)}</div>`;
			}

			// 2) !vml fallback(주로 data: URL 등)이 있으면 그 내용을 사용 (trimmed, 내부 정리)
			if (vmlFallback && vmlFallback.trim()) {
				return safeTrimBlock(vmlFallback);
			}

			// 3) 그 외엔 v:imagedata src -> <img>
			const img = /<v:imagedata\b[^>]*\bsrc="([^"]+)"[^>]*>/i.exec(vmlInner);
			if (img) {
				return `<img src="${normalizeFileSrc(img[1])}" />`;
			}

			// 4) 아무 것도 없으면 빈문자열(제거)
			return "";
		}
	);

	// (B) 남은 !vml 블록만 언랩. 단, 블록 내부가 '닫는 태그 잔해'만 있으면 버림.
	html = html.replace(
		/(?:<!--\s*\[if\s*!vml\]\s*>|<!\s*\[if\s*!vml\]\s*>)([\s\S]*?)<!\s*\[endif\]\s*(?:-->)?/gi,
		(_m, inner: string) => {
			const trimmed = inner.trim();
			// 만약 블록 내부가 단순히 닫는 태그(</td> 등) 같은 '잔해'면 제거
			if (/^<\/(td|tr|table|div|span|p)[^>]*>$/i.test(trimmed)) return "";
			// 아니면 블록 내부 내용(이미지 등)을 그대로 돌려주되, 내부에서만 안전정리
			return safeTrimBlock(trimmed);
		}
	);

	// (C) file: 경로 정규화 — 제한적 패턴만 변경 (이미지 src의 Windows 경로만 대상)
	html = html.replace(
		/(<img\b[^>]*\bsrc=")([A-Za-z]:\\[^"]+)(")/gi,
		(_m, pre, p, post) => `${pre}${normalizeFileSrc(p)}${post}`
	);

	// (D) VML / Word 네임스페이스 잔재 제거 — 태그 레벨로만 제거 (속성은 건드리지 않음)
	html = html
		.replace(/<\/?v:[^>]+>/gi, "")
		.replace(/<\/?w:[^>]+>/gi, "")
		.replace(/<\/?o:[^>]+>/gi, "")
		.replace(/<o:p>\s*<\/o:p>/gi, ""); // 완전 빈 o:p만 제거

	return html;

	// ----------------- helpers -----------------

	// v:textbox 내부에서 텍스트만 안전하게 추출. 실패하면 null 반환.
	function extractTextboxText(vmlInner: string): string | null {
		const tb = /<v:textbox\b[^>]*>([\s\S]*?)<\/v:textbox>/i.exec(vmlInner);
		if (!tb) return null;
		let inner = tb[1];

		// 내부의 조건부 주석/오피스 잔재는 제거
		inner = inner.replace(/(?:<!--\s*\[if[\s\S]*?\]\s*>|<!\s*\[if[\s\S]*?\]\s*>)[\s\S]*?<!\s*\[endif\]\s*(?:-->)?/gi, "");
		inner = inner.replace(/<\/?[vwo]:[^>]+>/gi, "");
		inner = inner.replace(/<o:p>\s*<\/o:p>/gi, "");

		// 태그 제거 후 공백 정리 — 이건 textbox 내부에서만 적용
		const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
		return text || null;
	}

	// 블록 내부 문자열에만 안전하게 '경계 정리' 수행 (전역 변경 절대 없음)
	function safeTrimBlock(block: string): string {
		// 1) trim whitespace
		let s = block.trim();
		// 2) 중복 '>>' 같은 건 블록 내부에서만 정리
		s = s.replace(/>\s*>/g, ">");
		// 3) 불필요한 인접 '><'는 정상적인 태그 연결을 위한 최소 정리
		s = s.replace(/>\s+</g, "><");
		return s;
	}

	function normalizeFileSrc(src: string): string {
		if (/^file:\/\//i.test(src)) return src;
		if (/^[A-Za-z]:\\/.test(src)) return `file:///${src.replace(/\\/g, "/")}`;
		return src;
	}

	function escapeHTML(s: string): string {
		return s.replace(/[&<>"']/g, c =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
		);
	}
}


export async function sanitizeHTML(rawHTML: string): Promise<Node> {
	// 보통 복붙을 하면 내용은 <!--StartFragment-->...<!--EndFragment-->로 감싸져 있고 그 앞으로 잡다한 메타데이터들이 포함됨.
	rawHTML = sliceFragment(rawHTML);
	if (import.meta.env.DEV) {
		console.debug("rawHTML", rawHTML);
	}

	rawHTML = sanitizeWordVMLPairs(rawHTML);

	// 이거 하지마. 쉽지 않아.
	//rawHTML = sanitizeWordVMLImages(rawHTML);

	// console.debug("rawHTML", rawHTML); // 회사에서 급할 때... ㅋ

	const tmpl = document.createElement("template");
	tmpl.innerHTML = rawHTML;

	type TraversalState = {
		font: string | null;
		color: string | null;
		preformatted: boolean;
	};

	const statesStack: TraversalState[] = [];
	let states: TraversalState = {
		font: null,
		color: null,
		preformatted: false,
	};

	type TraversalResult = {
		node: Node;
		hasText: boolean;
		hasNonEmptyText: boolean;
		caretReachable: boolean;
	};

	async function traverse(node: Node): Promise<TraversalResult | null> {
		if (
			node.nodeType !== 1 && // element
			node.nodeType !== 11 // document fragment
		) {
			return null;
		}

		// ctrl-a로 전체 페이지 복붙 했을때 따라오는 잡다한 unwanted 요소들 제거.
		if (node.nodeType === 1) {
			const el = node as HTMLElement;
			if (node.nodeName === "DIV") {
				if (
					el.className === "aspNetHidden" ||
					el.className === "pak_aside clear" ||
					el.className === "pak_tab_menu" ||
					el.className === "listBtn" ||
					el.className === "ManualEvalWrap"
				)
					return null;
			} else if (node.nodeName === "P") {
				if (el.className === "pak_search") return null;
			}
		}

		const policy = getElementPolicy(node);
		if (policy.exclude) {
			return null;
		}

		const nodeName = node.nodeName;
		let container: ParentNode;
		if (policy.unwrap || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			container = document.createDocumentFragment();
		} else {
			container = document.createElement(policy.replaceTag || nodeName);
			copyAllowedAttributes(node as HTMLElement, container as HTMLElement, policy.allowedAttrs);
			copyAllowedStyles((node as HTMLElement).style, (container as HTMLElement).style, policy.allowedStyles);
		}

		if (policy.void) {
			return {
				node: container,
				hasText: false,
				hasNonEmptyText: false,
				caretReachable: false,
			};
		}

		statesStack.push(states);
		states = { ...states };
		if (nodeName === "DIV" && (node as HTMLElement).dataset.origin === "word-textbox") {
			(container as HTMLElement).classList.add("word-textbox");
		}
		if (nodeName === "PRE" || nodeName === "CODE") {
			states.preformatted = true;
		}

		const result = {
			node: container,
			hasText: false,
			hasNonEmptyText: false,
			caretReachable: false,
		};

		if (container.nodeType === Node.ELEMENT_NODE && node.nodeType === Node.ELEMENT_NODE) {
			states.color = resolveColor(node as HTMLElement, states.color);
			if (states.color) {
				(container as HTMLElement).classList.add(`color-${states.color}`);
			}
			states.font = resolveDingbatFont(node as HTMLElement, states.font);
		}

		const children: TraversalResult[] = [];
		const isTextless = TEXTLESS_ELEMENTS[nodeName];
		for (const childNode of node.childNodes) {
			let childResult: TraversalResult | null = null;
			if (childNode.nodeType === 3) {
				if (!isTextless) {
					let text = childNode.nodeValue!;

					if (!states.preformatted) {
						// 텍스트에 \n이 들어가있으면 토큰화 단계에서 골아파진다.
						text = text.replace(/[\s\r\n]+/g, " ");
					}

					// 딩뱃 폰트를 사용 중인 텍스트
					if (states.font) {
						text = transformText(text, states.font);
					}

					if (text.length > 0) {
						childResult = {
							node: document.createTextNode(text),
							hasText: false,
							hasNonEmptyText: false,
							caretReachable: false,
						};
					}
				}
			} else {
				childResult = await traverse(childNode);
			}

			if (childResult !== null) {
				children.push(childResult);
			}
		}

		states = statesStack.pop()!;

		let prevCaretReachable = false;
		for (let i = 0; i < children.length; i++) {
			const childResult = children[i];

			if (node === tmpl.content || nodeName === "TD") {
				//
			}

			if (childResult.node.nodeType === 3) {
				result.hasText = true;
				result.hasNonEmptyText ||= childResult.node.nodeValue!.trim().length > 0;
				if (!result.caretReachable) {
					result.caretReachable = childResult.node.nodeValue!.length > 0;
				}
			} else {
				result.hasText ||= childResult.hasText;
				result.hasNonEmptyText ||= childResult.hasNonEmptyText;
				result.caretReachable ||= childResult.caretReachable || childResult.node.nodeName === "BR";
			}

			if (node === tmpl.content || nodeName === "TD") {
				if (childResult.node.nodeName === "TABLE") {
					if (!prevCaretReachable) {
						appendEmptyLine(container);
					}
					prevCaretReachable = false;
				}
			}

			container.appendChild(childResult.node);

			if (childResult.node.nodeName === "TABLE") {
				prevCaretReachable = false;
			} else {
				prevCaretReachable ||= childResult.caretReachable;
			}
		}

		if (!prevCaretReachable && (node === tmpl.content || nodeName === "TD")) {
			appendEmptyLine(container);
		}

		if (container.nodeName === "TABLE") {
			result.caretReachable = false;
			result.hasText = false;
			result.hasNonEmptyText = false;
		}

		return result;
	}

	const result = await traverse(tmpl.content);
	if (!result) {
		throw new Error("Failed to traverse template content");
	}

	return result.node;
}

const isReddish = (() => {
	let ctx: OffscreenCanvasRenderingContext2D | null = null;

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

		// fallback
		if (!ctx) {
			const canvas = new OffscreenCanvas(1, 1);
			ctx = canvas.getContext("2d", { willReadFrequently: true })!;
		}

		try {
			ctx.clearRect(0, 0, 1, 1);
			ctx.fillStyle = color;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			return [r, g, b];
		} catch {
			return null;
		}
	}

	return (color: string) => {
		let isRed = reddishCache.get(color);
		if (isRed !== undefined) return isRed;

		const rgb = getRGB(color);
		isRed = rgb ? rgb[0] >= 139 && rgb[0] - Math.max(rgb[1], rgb[2]) >= 65 : false;
		reddishCache.set(color, isRed);
		return isRed;
	};
})();
