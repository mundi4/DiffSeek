import { HANGUL_ORDER } from "@/constants";

export function parseOrdinalNumber(ordinalText: string): number {
	const norm = ordinalText.replace(/[\(\)\.]/g, "");
	if (/^\d+$/.test(norm)) {
		return Number(norm);
	}
	const idx = HANGUL_ORDER.indexOf(norm);
	if (idx !== -1) {
		return idx + 1;
	}
	return NaN;
}
