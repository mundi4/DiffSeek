import { HANGUL_ORDER, WS_TABLE } from "../constants";
import { TokenFlags } from "../TokenFlags";
import type { NumberingInfo } from "../types";

const hangulOrderSet: Record<string, true> = (() => {
    const set: Record<string, true> = Object.create(null);
    for (let i = 0; i < HANGUL_ORDER.length; i++) set[HANGUL_ORDER[i]] = true;
    return set;
})();

export function tryMatchNumbering(text: string): NumberingInfo | null {
    let charIndex = 0;
    const firstChar = text[charIndex];

    const skipWhitespace = () => {
        while (charIndex < text.length && WS_TABLE[text.charCodeAt(charIndex)]) {
            charIndex++;
        }
    }

    const readNumber = (): string => {
        const start = charIndex;
        while (charIndex < text.length) {
            const c = text.charCodeAt(charIndex);
            if (c < 48 || c > 57) break;
            charIndex++;
        }
        return text.slice(start, charIndex);
    };

    const readNumberOrHangulOrder = (): string => {
        if (charIndex >= text.length) return "";

        const ch0 = text[charIndex];
        if (hangulOrderSet[ch0]) {
            charIndex++;
            return ch0;
        }

        const c0 = text.charCodeAt(charIndex);
        if (c0 >= 48 && c0 <= 57) {
            return readNumber();
        }

        return "";
    };


    if (firstChar === "제") {
        charIndex++;
        skipWhitespace();

        const number = readNumber();
        if (!number) return null;

        skipWhitespace();

        const type = text[charIndex];
        if (type !== "조") {
            return null;
        }
        charIndex++;

        let charCode: number;
        if (
            charIndex === text.length // 제1조
            || WS_TABLE[(charCode = text.charCodeAt(charIndex))] // 제1조 총칙
            || charCode === 46 // 제1조. 총칙
            || charCode === 40 // 제1조(총칙)
            // || ch === "[" // 제1조[총칙]
        ) {
            return {
                wholeText: text.slice(0, charIndex),
                number,
                length: charIndex,
                type: TokenFlags.LAW_ARTICLE,
            } satisfies NumberingInfo;
        }

        return null;

    } else if (firstChar === "(") {
        charIndex++;
        skipWhitespace();

        const number = readNumberOrHangulOrder();
        if (!number) return null;

        skipWhitespace();

        if (text[charIndex] !== ")") {
            return null;
        }
        charIndex++;

        return {
            wholeText: text.slice(0, charIndex),
            number,
            length: charIndex,
            type: hangulOrderSet[number] ? TokenFlags.SECTION_HEADING_TYPE4 : TokenFlags.SECTION_HEADING_TYPE3,
        } satisfies NumberingInfo;
    }

    const number = readNumberOrHangulOrder();
    if (!number) return null;

    let ch = text[charIndex];
    if (ch === "." || ch === ")") {
        charIndex++;
        const type = hangulOrderSet[number] ? (ch === "." ? TokenFlags.SECTION_HEADING_TYPE2 : TokenFlags.SECTION_HEADING_TYPE6) : (ch === "." ? TokenFlags.SECTION_HEADING_TYPE1 : TokenFlags.SECTION_HEADING_TYPE5);
        return {
            wholeText: text.slice(0, charIndex),
            number,
            length: charIndex,
            type,
        } satisfies NumberingInfo;
    }

    return null;
}