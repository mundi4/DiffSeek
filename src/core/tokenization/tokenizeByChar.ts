import { normalizedCharMap } from "./normalizedCharMap";

export type CharToken = {
	char: string;
	index: number;
	count: number;
};

export function tokenizeByChar(text: string): CharToken[] {
	const tokens: CharToken[] = [];
	let i = 0;
	while (i < text.length) {
		const charCode = text.codePointAt(i)!;
		const count = charCode > 0xffff ? 2 : 1;
		const normCode = normalizedCharMap[charCode] ?? charCode;
		tokens.push({
			char: String.fromCodePoint(normCode),
			count: count,
			index: i,
		});
		i += count;
	}
	return tokens;
}
