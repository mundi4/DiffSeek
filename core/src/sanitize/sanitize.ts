import { TEXTLESS_ELEMENTS, VOID_ELEMENTS } from "../constants";
import { getElementPolicy } from "./element-policies";
import { resolveFont, normalizeDingbatText } from "./normalize-font";
import { resolveColor } from "./resolve-color";
import type { DingbatFont } from "./types";

const START_TAG = "<!--StartFragment-->";
const END_TAG = "<!--EndFragment-->";

function sliceFragment(html: string): string {
	const s = html.indexOf(START_TAG);
	if (s < 0) return html;
	const e = html.lastIndexOf(END_TAG);
	return e >= 0 ? html.slice(s + START_TAG.length, e) : html.slice(s + START_TAG.length);
}

const UNWRAPPABLE_TAGS: Record<string, boolean> = {
	TBODY: true,
	THEAD: true,
	TFOOT: true,
	SPAN: true,
	FONT: true,
	FIELDSET: true,
}

export function sanitizeHTML(rawHTML: string): Node {
	const sessionTs = Date.now();
	// 보통 복붙을 하면 내용은 <!--StartFragment-->...<!--EndFragment-->로 감싸져 있고 그 앞으로 잡다한 메타데이터들이 포함됨.
	rawHTML = sliceFragment(rawHTML);

	// if (import.meta.env.DEV) {
	// 	console.log("Sanitizing HTML:", rawHTML);
	// }

	function processTextNode(textNode: Text, font: "NORMAL" | DingbatFont, preformatted: boolean): Node | null {
		const text = normalizeTextContent(textNode.nodeValue!, preformatted, font);
		if (text.length > 0) {
			return document.createTextNode(text);
		}
		return null;
	}

	const tmpl = document.createElement("template");
	tmpl.innerHTML = rawHTML;

	let current: Element | DocumentFragment = tmpl.content;
	let childIndex: number = 0;
	let numChildren: number = current.childNodes.length;
	let isTextless: boolean = false;
	let font: "NORMAL" | DingbatFont = "NORMAL";
	let color: "NORMAL" | "red" = "NORMAL";
	let preformatted: boolean = false;
	let currentSanitized: Element | DocumentFragment = document.createDocumentFragment();
	let yieldCounter = 0;

	const parentStack: {
		current: Element | DocumentFragment;
		currentSanitized: Element | DocumentFragment;
		childIndex: number;
		numChildren: number,
		isTextless: boolean,
		font: "NORMAL" | DingbatFont,
		color: "NORMAL" | "red",
		preformatted: boolean,
	}[] = [];

	// Node를 리턴하는 경우: 새로 생성된 노드 (appendChild 필요). 정상적으로 플로우 처리 필요(childIndex++ 등)
	// null를 리턴하는 경우: 결과 없음. (appendChild 불필요). 정상적으로 플로우 처리 필요(childIndex++ 등)
	// true를 리턴하는 경우: 내부에서 플로우 처리가 완료 됐음. 밖에서는 아무것도 하지말고 그냥 continue;
	// 이렇게 난잡해진 이유는 이 함수는 결국 두개의 역할을 수행하면서 두개의 값을 리턴하는데,
	// 두 개의 함수로 나누려면 오히려 더 복잡해지고 비효율적이 될 것 같음.
	// 그렇다고 {result,pointerHandled} 같은 객체를 리턴하는 건 괜한 오버헤드만 가중시키는 느낌
	function processElement(parent: Element): Node | null | true {
		const policy = getElementPolicy(parent);
		if (policy.exclude) {
			// null를 리턴할 때에는 포인터 처리 필수
			return null;
		}

		const isVoidElement = VOID_ELEMENTS[parent.nodeName];
		const attrs = extractAllowedAttributes(parent as Element, policy.allowedAttrs);
		const styles = extractAllowedStyles((parent as HTMLElement).style, policy.allowedStyles);

		if (attrs?.src?.startsWith("file://")) {
			attrs.src = `${attrs.src}?t=${sessionTs}`;
		}

		if (isVoidElement || parent.childNodes.length === 0) {
			if (!attrs && !styles && UNWRAPPABLE_TAGS[parent.nodeName]) {
				// null를 리턴할 때에는 포인터 처리 필수
				return null;
			} else {
				const sanitizedNode = document.createElement(policy.replaceTag || parent.nodeName) as HTMLElement;
				if (attrs) {
					for (const [attrName, attrValue] of Object.entries(attrs)) {
						(sanitizedNode as HTMLElement).setAttribute(attrName, attrValue);
					}
				}
				if (styles) {
					(sanitizedNode as HTMLElement).setAttribute("style", styles);
				}
				return sanitizedNode;
			}
		}

		const newFont = resolveFont(parent as HTMLElement) ?? font;
		const newColor = resolveColor(parent as HTMLElement) ?? color;
		const newPreformatted = preformatted || parent.nodeName === "PRE" || parent.nodeName === "CODE";
		const colorChanged = newColor !== color;

		let sanitizedNode: Element | DocumentFragment;
		if (!attrs && !styles && UNWRAPPABLE_TAGS[parent.nodeName] && !colorChanged) {
			sanitizedNode = document.createDocumentFragment();
		} else {
			sanitizedNode = document.createElement(policy.replaceTag || parent.nodeName) as HTMLElement;
			if (attrs) {
				for (const [attrName, attrValue] of Object.entries(attrs)) {
					(sanitizedNode as HTMLElement).setAttribute(attrName, attrValue);
				}
			}
			if (styles) {
				(sanitizedNode as HTMLElement).setAttribute("style", styles);
			}

			if (colorChanged) {
				// (newElement as HTMLElement).classList.remove("ds-color-red", "ds-color-normal");
				if (newColor === "red") {
					(sanitizedNode as HTMLElement).classList.add("ds-color-red");
				} else {//if (states.color === "normal") {
					(sanitizedNode as HTMLElement).classList.add("ds-color-normal");
				}
			}
		}

		parentStack.push({
			current,
			currentSanitized: currentSanitized,
			childIndex,
			numChildren,
			isTextless,
			font,
			color,
			preformatted,
		});

		current = parent as Element | DocumentFragment;
		currentSanitized = sanitizedNode;
		childIndex = 0;
		numChildren = current.childNodes.length;
		isTextless = TEXTLESS_ELEMENTS[current.nodeName];
		font = newFont;
		color = newColor;
		preformatted = newPreformatted;
		return true;
	}

	function restoreParent() {
		if (parentStack.length === 0) {
			return false;
		}
		({
			current,
			currentSanitized: currentSanitized,
			childIndex,
			numChildren,
			isTextless,
			color,
			font,
			preformatted
		} = parentStack.pop()!);
		return true;
	}

	OUTER:
	while (true) {
		while (childIndex >= numChildren) {
			const prev = currentSanitized;
			if (restoreParent()) {
				currentSanitized.appendChild(prev);
				childIndex++; // 다음 형제로 이동 필요!
			} else {
				break OUTER;
			}
		}
		const child = current.childNodes[childIndex];
		console.assert(child !== null, "child should not be null");

		let childSanitized: Node | null = null;
		if (child.nodeType === 1) {
			const result = processElement(child as Element);
			if (result === true) {
				// 내부에서 완전히 처리됨
				continue;
			}
			childSanitized = result satisfies Node | null;
		} else if (child.nodeType === 3) {
			if (!isTextless && (child as Text).length) {
				childSanitized = processTextNode(child as Text, font, preformatted);
			}
		}

		if (childSanitized !== null) {
			currentSanitized.appendChild(childSanitized);
		}

		childIndex++;
	}

	currentSanitized.normalize();
	return currentSanitized;
}

function extractAllowedAttributes(from: Element, allowed?: Record<string, boolean>): Record<string, string> | null {
	if (!allowed) return null;
	let result: Record<string, string> | null = null;
	const keys = Object.keys(allowed);
	for (let i = 0; i < keys.length; i++) {
		const name = keys[i];
		if (allowed[name]) {
			const value = from.getAttribute(name);
			if (value !== null) {
				if (!result) result = {};
				result[name] = value;
			}
		}
	}
	return result;
}

function extractAllowedStyles(from: CSSStyleDeclaration, allowed?: Record<string, boolean>): string {
	if (!allowed) return "";
	let css = "";
	const keys = Object.keys(allowed);
	for (let i = 0; i < keys.length; i++) {
		const name = keys[i];
		if (allowed[name]) {
			const value = from.getPropertyValue(name);
			if (value) css += `${name}:${value};`;
		}
	}
	return css;
}

export function normalizeTextContent(text: string, preformatted: boolean, font: "NORMAL" | DingbatFont): string {
	let normalized = preformatted ? text : text.replace(/[\s\r\n]+/g, " ");
	if (font !== "NORMAL") {
		normalized = normalizeDingbatText(normalized, font);
	}
	return normalized;
}