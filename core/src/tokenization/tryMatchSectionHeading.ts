import type { TextNodeCursor } from "./TextNodeCursor";
import { CHAR_META } from "../shared/charMeta";
import { CM_WS } from "../shared/charMetaFlags";
import { TOKEN_FLAGS_SECTION_HEADING_LAW_ARTICLE, TOKEN_FLAGS_SECTION_HEADING_TYPE1, TOKEN_FLAGS_SECTION_HEADING_TYPE2, TOKEN_FLAGS_SECTION_HEADING_TYPE3, TOKEN_FLAGS_SECTION_HEADING_TYPE4, TOKEN_FLAGS_SECTION_HEADING_TYPE5, TOKEN_FLAGS_SECTION_HEADING_TYPE6 } from "./types";

export const HANGUL_ORDER = "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허";

export const CM_HEADING_START = 1 << 15;

for (const ch of ["제", "(", "1", "2", "3", "4", "5", "6", "7", "8", "9",]) {
    CHAR_META[ch.charCodeAt(0)] |= CM_HEADING_START;
}

for (const ch of HANGUL_ORDER) {
    CHAR_META[ch.charCodeAt(0)] |= CM_HEADING_START;
}

const hangulOrderMap = (() => {
    const map: Record<number, number> = Object.create(null);
    for (let i = 0; i < HANGUL_ORDER.length; i++) map[HANGUL_ORDER[i].charCodeAt(0)] = i + 1;
    return map;
})();

type NumberingMatch = {
    text: string;
    ordinal: number;
    type: number;
};

function tryMatchLawArticle(cursor: TextNodeCursor): NumberingMatch | null {
    // console.log("Trying to match law article...");
    let code: number = -1;
    let meta: number = 0;

    code = skipWs(cursor);
    if (code < 0x30 || code > 0x39) {
        // console.log("Expected digit after '제', but not found.", { char: String.fromCharCode(code), code });
        return null;
    }

    let number = parseAsciiNumber(cursor, code);
    if (!number) {
        // console.log("Failed to parse law article number.");
        return null;
    }

    code = cursor.current;
    meta = CHAR_META[code];

    if (meta & CM_WS) {
        code = skipWs(cursor);
    }

    if (code !== 0xc870) { // 조
        // console.log("Expected '조' after law article number, but not found.", { char: String.fromCharCode(code), code });
        return null;
    }

    // console.log("Matched law article number.", { number });

    // 허용되는 다음 문자
    code = cursor.peek();
    if (code !== -1) {
        // code = cursor.current;
        if (code === 46 // 제1조.
            || code === 40 // 제1조(
            || CHAR_META[code] & CM_WS) { // "제1조 "
            // good
        } else {
            // console.log("Unexpected character after law article number.", { char: String.fromCharCode(code), code });
            // 실패.
            return null;
        }
    }

    return {
        text: `제${number}조`,
        ordinal: number,
        type: TOKEN_FLAGS_SECTION_HEADING_LAW_ARTICLE,
    };
}

function tryMatchParenthesized(cursor: TextNodeCursor): NumberingMatch | null {
    let code: number = -1;
    let meta: number = 0;

    while (cursor.moveNext()) {
        code = cursor.current;
        meta = CHAR_META[code];
        if (!(meta & CM_WS)) {
            break;
        }
    }

    const number = parseOrdinal(cursor, code);
    if (!number) {
        return null;
    }

    code = cursor.current;
    meta = CHAR_META[code];
    if (meta & CM_WS) {
        while (cursor.moveNext()) {
            code = cursor.current;
            meta = CHAR_META[code];
            if (!(meta & CM_WS)) {
                break;
            }
        }
    }

    if (code !== 0x29) { // )
        return null;
    }

    number.text = `(${number.text})`;
    number.type = (number.type === TOKEN_FLAGS_SECTION_HEADING_TYPE1) ? TOKEN_FLAGS_SECTION_HEADING_TYPE3 : TOKEN_FLAGS_SECTION_HEADING_TYPE4;
    return number;
}

function tryMatchNumberWithSuffix(cursor: TextNodeCursor): NumberingMatch | null {
    let number = parseOrdinal(cursor, cursor.current);
    if (!number) {
        return null;
    }

    let code: number = cursor.current;
    let meta: number = CHAR_META[code];

    if (meta & CM_WS) {
        code = skipWs(cursor);
    }

    if (code === 0x2e) { // .
        number.text = `${number.text}.`;
        return number;
    } else if (code === 0x29) { // )
        number.text = `${number.text})`;
        number.type = (number.type === TOKEN_FLAGS_SECTION_HEADING_TYPE1) ? TOKEN_FLAGS_SECTION_HEADING_TYPE5 : TOKEN_FLAGS_SECTION_HEADING_TYPE6;
        return number;
    }

    return null;
}

export function tryMatchSectionHeading(cursor: TextNodeCursor, firstCharCode: number) {
    let match: NumberingMatch | null = null;
    const start = cursor.getPos();

    if (firstCharCode === 0xc81c) { // 제
        match = tryMatchLawArticle(cursor);
    } else if (firstCharCode === 0x28) { // (
        match = tryMatchParenthesized(cursor);
    } else if (firstCharCode >= 0x30 && firstCharCode <= 0x39) { // 1., 2., 1), 2)
        match = tryMatchNumberWithSuffix(cursor);
    }

    if (!match) {
        cursor.moveTo(start);
    }

    return match;
}

function parseOrdinal(cursor: TextNodeCursor, firstCode: number): NumberingMatch | null {
    const num = parseAsciiNumber(cursor, firstCode);
    if (num) {
        return {
            ordinal: num,
            text: String(num),
            type: TOKEN_FLAGS_SECTION_HEADING_TYPE1
        };
    }

    const hangul = hangulOrderMap[firstCode];
    if (hangul) {
        if (!cursor.moveNext()) return null;
        return {
            ordinal: hangul,
            text: String.fromCharCode(firstCode),
            type: TOKEN_FLAGS_SECTION_HEADING_TYPE2
        };
    }

    return null;
}

function parseAsciiNumber(cursor: TextNodeCursor, firstCode: number): number | null {
    if (firstCode < 0x30 || firstCode > 0x39) return null;

    let number = firstCode - 0x30;
    let code = firstCode;

    while (cursor.moveNext()) {
        code = cursor.current;
        if (code < 0x30 || code > 0x39) break;
        number = number * 10 + (code - 0x30);
    }

    if (number === 0 || cursor.eof()) return null;

    return number;
}

function skipWs(cursor: TextNodeCursor): number {
    let code = -1;
    let meta = 0;

    while (cursor.moveNext()) {
        code = cursor.current;
        meta = CHAR_META[code];
        if (!(meta & CM_WS)) break;
    }
    return code;
}

