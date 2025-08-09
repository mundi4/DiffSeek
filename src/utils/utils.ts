



// function findBlockContainer(node: Node): HTMLElement | null {
// 	let el: HTMLElement | null = getParentElement(node);
// 	while (el) {
// 		if (BLOCK_ELEMENTS[el.nodeName]) return el;
// 		el = el.parentElement;
// 	}
// 	return null;
// }

// function getElement(container: Node, childIndex: number): HTMLElement | null {
// 	let node = container;
// 	if (node.nodeType === 3) {
// 		return node.parentNode as HTMLElement;
// 	}

// 	if (container.nodeType === Node.ELEMENT_NODE) {
// 		const element = (container as HTMLElement).children[childIndex];
// 		if (element && element.nodeType === Node.ELEMENT_NODE) {
// 			return element as HTMLElement;
// 		}
// 	}
// 	return null;
// }

// export function buildTokenArray(richTokens: readonly RichToken[], mode: "char" | "word" = "word"): Token[] {
// 	if (mode === "word") {
// 		return buildTokenArrayWord(richTokens, mode);
// 	} else if (mode === "char") {
// 		return buildTokenArrayByChar(richTokens, mode);
// 	} else {
// 		throw new Error(`Unsupported tokenization mode: ${mode}`);
// 	}
// }

// function buildTokenArrayWord(richTokens: readonly RichToken[], mode: "char" | "word" = "word"): Token[] {
// 	const result: Token[] = new Array(richTokens.length);
// 	for (let i = 0; i < richTokens.length; i++) {
// 		const richToken = richTokens[i];
// 		result[i] = {
// 			text: richToken.text,
// 			flags: richToken.flags,
// 		};
// 	}
// 	return result;
// }

// function buildTokenArrayByChar(richTokens: readonly RichToken[], mode: "char" | "word" = "word"): Token[] {
// 	const result: Token[] = [];
// 	for (let i = 0; i < richTokens.length; i++) {
// 		const richToken = richTokens[i];
// 		const flags = richToken.flags;
// 		if (flags & (TokenFlags.WILD_CARD | TokenFlags.IMAGE)) {
// 			result.push({
// 				text: richToken.text,
// 				flags: flags,
// 			});
// 		} else {
// 			const text = richToken.text;
// 			for (const char of text) {
// 				result.push({
// 					text: char,
// 					flags: 0,
// 				});
// 			}
// 		}
// 	}
// 	return result;
// }




// export function normalizeMultiline(text: string): string {
// 	return text
// 		.split(/\r?\n/)
// 		.map((line) => line.trim())
// 		.filter((line) => line.length > 0)
// 		.join("\n");
// }

