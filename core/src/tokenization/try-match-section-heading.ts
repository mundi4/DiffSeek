import type { TextNodeCursor } from "./text-node-cursor";
import { CHAR_META } from "../char-meta";
import { CM_LETTER, CM_WS } from "../char-meta-flags";
import { SECTION_HEADING_TYPE_HANGUL_DOT, SECTION_HEADING_TYPE_HANGUL_PAREN, SECTION_HEADING_TYPE_LAW_ARTICLE, SECTION_HEADING_TYPE_NUMERIC_DOT, SECTION_HEADING_TYPE_NUMERIC_PAREN, SECTION_HEADING_TYPE_PAREN_HANGUL, SECTION_HEADING_TYPE_PAREN_NUMERIC } from "../constants/section-heading";

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

export type SectionHeadingMatch = {
    type: number;
    text: string;
    ordinal: number;
};

function tryMatchLawArticle(cursor: TextNodeCursor): NumberingMatch | null {
    let code: number = -1;
    let meta: number = 0;

    code = skipOptionalWs(cursor);
    if (code < 0x30 || code > 0x39) {
        return null;
    }

    let number = parseAsciiNumber(cursor, code);
    if (!number) {
        return null;
    }

    code = cursor.current;
    meta = CHAR_META[code];

    if (meta & CM_WS) {
        if (!cursor.moveNext()) return null;
        code = cursor.current;
    }

    if (code !== 0xc870) { // 조
        return null;
    }

    code = cursor.peek();

    // 제1조의2 형식 처리
    let subNumber: number | null = null;
    if (code === 0xc758) { // 의
        cursor.moveNext(); // cursor: 조 → 의
        code = skipOptionalWs(cursor); // 의 소비, 공백 최대 1개 건너뜀 ("조의 2" 허용)
        if (code >= 0x30 && code <= 0x39) {
            // cursor는 이미 첫 숫자에 위치 (skipWs가 전진함)
            subNumber = parseAsciiNumber(cursor, code);
            if (!subNumber) return null;
            code = cursor.current; // parseAsciiNumber가 종결자까지 전진함
        } else {
            return null;
        }
        // 종결자 검증
        if (code !== -1 && !(code === 46 || code === 40 || CHAR_META[code] & CM_WS)) {
            return null;
        }
        // '의N'까지 이미 소비됨 — 추가 moveNext 불필요
    } else {
        if (code !== -1) {
            if (code === 46 // 제1조.
                || code === 40 // 제1조(
                || CHAR_META[code] & CM_WS) { // "제1조 "
                // good
            } else {
                return null;
            }
        }
        // '조'를 소비하여 cursor를 종결자 위치로 이동
        cursor.moveNext();
    }

    const text = subNumber !== null ? `제${number}조의${subNumber}` : `제${number}조`;
    const ordinal = subNumber !== null ? number * 10000 + subNumber : number * 10000;
    return {
        text,
        ordinal,
        type: SECTION_HEADING_TYPE_LAW_ARTICLE,
    };
}

function tryMatchParenthesized(cursor: TextNodeCursor): NumberingMatch | null {
    let code: number = -1;
    let meta: number = 0;

    code = skipOptionalWs(cursor);
    if (code === -1) return null;

    const number = parseOrdinal(cursor, code);
    if (!number) {
        return null;
    }

    code = cursor.current;
    meta = CHAR_META[code];
    if (meta & CM_WS) {
        if (!cursor.moveNext()) return null;
        code = cursor.current;
    }

    if (code !== 0x29) { // )
        return null;
    }

    // 닫는 괄호를 소비해서 중복 ')' 토큰 생성을 방지한다.
    cursor.moveNext();

    number.text = `(${number.text})`;
    number.type = (number.type === SECTION_HEADING_TYPE_NUMERIC_DOT) ? SECTION_HEADING_TYPE_PAREN_NUMERIC : SECTION_HEADING_TYPE_PAREN_HANGUL;
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
        if (!cursor.moveNext()) return null;
        code = cursor.current;
    }

    if (code === 0x2e) { // .
        // false positive 보호: 1.5 같은 소수점 방지
        const peek = cursor.peek();
        if (peek >= 0x30 && peek <= 0x39) {
            return null;
        }
        number.text = `${number.text}.`;
        // 접미 문자를 소비해서 중복 토큰 생성을 방지한다.
        cursor.moveNext();
        return number;
    } else if (code === 0x29) { // )
        number.text = `${number.text})`;
        number.type = (number.type === SECTION_HEADING_TYPE_NUMERIC_DOT) ? SECTION_HEADING_TYPE_NUMERIC_PAREN : SECTION_HEADING_TYPE_HANGUL_PAREN;
        // 접미 문자를 소비해서 중복 토큰 생성을 방지한다.
        cursor.moveNext();
        return number;
    }

    return null;
}

/** 현재 커서 위치부터 줄 끝까지 word-like 문자가 하나라도 있으면 true. */
function scanHasWordLike(cursor: TextNodeCursor): boolean {
    while (cursor.moveNext()) {
        const meta = CHAR_META[cursor.current];
        if (meta & CM_LETTER) return true;
    }
    return false;
}

export function tryMatchSectionHeading(cursor: TextNodeCursor, firstCharCode: number, allowStandaloneLawArticle = false, requireWordLike = true): SectionHeadingMatch | null {
    const start = cursor.getPos();
    let match: NumberingMatch | null = null;

    if (firstCharCode === 0xc81c) { // 제
        match = tryMatchLawArticle(cursor);
    } else if (firstCharCode === 0x28) { // (
        match = tryMatchParenthesized(cursor);
    } else if (firstCharCode >= 0x30 && firstCharCode <= 0x39) { // 1., 2., 1), 2)
        match = tryMatchNumberWithSuffix(cursor);
    } else if (hangulOrderMap[firstCharCode]) { // 가., 나., 가), 나)
        match = tryMatchNumberWithSuffix(cursor);
    }

    if (match) {
        const headingEndPos = cursor.getPos();
        if (requireWordLike) {
            // LAW_ARTICLE(제N조)은 줄 시작에 나오는 것 자체가 강한 신호이므로
            // allowStandaloneLawArticle 옵션이 켜져 있으면 word-like 검사를 건너뛴다.
            if (!(allowStandaloneLawArticle && match.type === SECTION_HEADING_TYPE_LAW_ARTICLE)) {
                const hasWordLike = scanHasWordLike(cursor);
                if (!hasWordLike) {
                    cursor.moveTo(start);
                    return null;
                }
            }
        }
        cursor.moveTo(headingEndPos);
        return {
            type: match.type,
            text: match.text,
            ordinal: match.ordinal,
        };
    }

    cursor.moveTo(start);
    return null;
}

function parseOrdinal(cursor: TextNodeCursor, firstCode: number): NumberingMatch | null {
    const num = parseAsciiNumber(cursor, firstCode);
    if (num) {
        return {
            ordinal: num,
            text: String(num),
            type: SECTION_HEADING_TYPE_NUMERIC_DOT
        };
    }

    const hangul = hangulOrderMap[firstCode];
    if (hangul) {
        if (!cursor.moveNext()) return null;
        return {
            ordinal: hangul,
            text: String.fromCharCode(firstCode),
            type: SECTION_HEADING_TYPE_HANGUL_DOT
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

/** 공백을 최대 1개만 건너뜀 (0 or 1). */
function skipOptionalWs(cursor: TextNodeCursor): number {
    if (!cursor.moveNext()) return -1;
    let code = cursor.current;
    if (CHAR_META[code] & CM_WS) {
        if (!cursor.moveNext()) return -1;
        code = cursor.current;
    }
    return code;
}
