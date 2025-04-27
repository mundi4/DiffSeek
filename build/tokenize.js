"use strict";
const MANUAL_ANCHOR1 = "@@@";
const MANUAL_ANCHOR2 = "###";
const FIRST_OF_LINE = 1;
const LAST_OF_LINE = 2;
const WILD_CARD = 16;
const MANUAL_ANCHOR = 32; // @@@, ### 등등
const SECTION_HEADING = 64;
const SECTION_HEADING_LV2 = 128; // 가.
const SECTION_HEADING_LV3 = 256; // (1)
const SECTION_HEADING_LV4 = 384; // (가)
const SECTION_HEADING_LV5 = 512; // 1)
const SECTION_HEADING_LV6 = 640; // 가)
const SECTION_HEADING_LEVEL = SECTION_HEADING_LV2 | SECTION_HEADING_LV3 | SECTION_HEADING_LV4 | SECTION_HEADING_LV5 | SECTION_HEADING_LV6;
const normalizeChars = {};
const SPLIT_CHARS = {
    "(": true,
    ")": true,
    "[": true,
    "]": true,
    "{": true,
    "}": true,
};
// TODO
// 그냥 { type: "init? config?", normalizeChars: {...}, ... } 이런 식으로 보내는게 더 나을듯.
for (var entry of NORMALIZE_CHARS) {
    // entry[0] = encoder.encode(entry[0]);
    const norm = entry[0];
    normalizeChars[norm] = norm;
    for (var i = 0; i < entry.length; i++) {
        const char = entry[i];
        if (char.length === 1) {
            normalizeChars[char] = norm;
        }
        else if (typeof char === "number") {
            normalizeChars[String.fromCharCode(char)] = norm;
        }
        else if (char[0] === "&") {
            normalizeChars[htmlEntityToChar(char)] = norm;
        }
        else {
            throw new Error("normalizeChars: not a single character: " + char);
        }
    }
}
function htmlEntityToChar(entity) {
    const doc = new DOMParser().parseFromString(entity, "text/html");
    const char = doc.body.textContent;
    if (char.length !== 1) {
        throw new Error("htmlEntityToChar: not a single character entity: " + entity);
    }
    return char;
}
const SPACE_CHARS = {
    " ": true,
    "\t": true,
    "\n": true,
    "\r": true, // 글쎄...
    "\f": true, // 이것들은...
    "\v": true, // 볼일이 없을것...
    "\u00A0": true, // &nbsp; ??
};
const TOKEN_CACHE_SIZE = 2;
const tokenCache = {
    ["char"]: [],
    ["word"]: [],
    ["line"]: [],
};
// wildcards.
// 이걸 어떻게 구현해야할지 감이 안오지만 지금으로써는 얘네들을 atomic하게 취급(사이에 공백이 있어도 하나의 토큰으로 만듬. '(현행과 같음)'에서 일부분만 매치되는 것을 방지)
// 글자단위로 토큰화하는 경우에도 얘네들은 (...) 통채로 하나의 토큰으로 취급.
// 와일드카드diff인 경우 다른 diff와 병합되지 않으면 좋지만 와일드카드가 얼마나 greedy하게 반대쪽 텍스트를 잡아먹어야 할지
// 양쪽에 wildcard가 동시에 나오는 경우 경계를 어디서 어떻게 짤라야할지 쉽지 않음.
// 또한 wildcard를 강제로 다른 diff와 분리하는 경우 diff가 같은 위치에 두 개 이상 생기게 되는 수가 있다. (wildcard와 wildcard가 아닌 것)
// 이 경우 정확히 같은 위치에 두개의 diff를 렌더링해야하고 결국 두개가 겹쳐보이게 되는데 분간이 잘 안된다.
const WildcardTrie = createTrie(true);
WildcardTrie.insert("(추가)", WILD_CARD);
WildcardTrie.insert("(삭제)", WILD_CARD);
WildcardTrie.insert("(신설)", WILD_CARD);
WildcardTrie.insert("(생략)", WILD_CARD);
WildcardTrie.insert("(현행과같음)", WILD_CARD);
const TrieRoot = WildcardTrie.root;
const WildcardTrieNode = WildcardTrie.root.next("(");
const SectionHeadingTrie = createTrie(false);
for (let i = 1; i < 40; i++) {
    // 1. 제목 ==> 이 패턴은 무시. 보통 이 제목들은 왼쪽 문서 전체 테이블의 맨 왼쪽 컬럼에 들어가 있는데
    // 많은 문서들이 섹션을 테이블 행으로 분리하지 않고 그냥 엔터키를 열심히 눌러서 분리해두었기 때문에
    // 이런 경우 복사붙여넣기 하면 1. 제목, 2. 제목2, ...이 모두 문서의 첫 부분에 나와버림. 영구같다!
    SectionHeadingTrie.insert(`${i}. `, SECTION_HEADING);
    SectionHeadingTrie.insert(`(${i}) `, SECTION_HEADING | SECTION_HEADING_LV3);
    SectionHeadingTrie.insert(`${i}) `, SECTION_HEADING | SECTION_HEADING_LV5);
}
const hangulOrder = "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허";
for (let i = 0; i < hangulOrder.length; i++) {
    SectionHeadingTrie.insert(`${hangulOrder[i]}. `, SECTION_HEADING | SECTION_HEADING_LV2);
    SectionHeadingTrie.insert(`(${hangulOrder[i]}) `, SECTION_HEADING | SECTION_HEADING_LV4);
    SectionHeadingTrie.insert(`${hangulOrder[i]}) `, SECTION_HEADING | SECTION_HEADING_LV6);
    // SectionHeadingTrie.insert(`(${String.fromCharCode(syllables.charCodeAt(i) + 112)}) `);
    // SectionHeadingTrie.insert(`${String.fromCharCode(syllables.charCodeAt(i) + 112)}) `);
}
const SectionHeadingTrieNode = SectionHeadingTrie.root;
const SECTION_HEADING_START = extractStartCharsFromTrie(SectionHeadingTrieNode);
const ManualAnchorTrie = createTrie(false);
ManualAnchorTrie.insert(MANUAL_ANCHOR1, MANUAL_ANCHOR);
ManualAnchorTrie.insert(MANUAL_ANCHOR2, MANUAL_ANCHOR);
const ManualAnchorTrieNode = ManualAnchorTrie.root;
const MANUAL_ANCHOR_START = extractStartCharsFromTrie(ManualAnchorTrieNode);
// ============================================================
// Tokenization
// tokenize를 ui쓰레드에서 실행하는 것으로 바꿔봤지만
// editor에서 물흐르듯 자연스러운 편집이 안되는 느낌. 불쾌함!
// 그래도 UI쓰레드에서 토큰을 직접 가지고 있으면 편리한 부분이 있긴 있음.
// ============================================================
// #region Tokenization
function tokenizeByChar(input) {
    const tokens = [];
    let lineNum = 1;
    let flags = FIRST_OF_LINE;
    const inputEnd = input.length;
    for (let i = 0; i < inputEnd; i++) {
        const ch = input[i];
        if (!SPACE_CHARS[ch]) {
            if (ch === "(") {
                const result = findInTrie(WildcardTrieNode, input, i + 1);
                if (result) {
                    if (tokens.length === 0 || checkIfFirstOfLine(input, i)) {
                        flags |= FIRST_OF_LINE;
                    }
                    tokens.push({
                        text: result.word,
                        pos: i,
                        len: result.end - i,
                        lineNum,
                        flags: flags | result.flags,
                    });
                    flags = 0;
                    i = result.end - 1;
                    continue;
                }
            }
            if (MANUAL_ANCHOR_START[ch]) {
                const nextNode = ManualAnchorTrieNode.next(ch);
                const result = findInTrie(nextNode, input, i + 1);
                if (result) {
                    if (tokens.length === 0 || checkIfFirstOfLine(input, i)) {
                        flags |= FIRST_OF_LINE;
                    }
                    tokens.push({
                        text: result.word,
                        pos: i,
                        len: result.end - i,
                        lineNum,
                        flags: flags | result.flags,
                    });
                    flags = 0;
                    i = result.end - 1;
                    continue;
                }
            }
            if (tokens.length === 0 || checkIfFirstOfLine(input, i)) {
                flags |= FIRST_OF_LINE;
            }
            const normalized = normalizeChars[ch] || ch;
            tokens.push({
                text: normalized,
                pos: i,
                len: 1,
                lineNum,
                flags,
            });
            flags = 0;
        }
        if (ch === "\n") {
            lineNum++;
            flags = FIRST_OF_LINE;
            if (tokens.length) {
                tokens[tokens.length - 1].flags |= LAST_OF_LINE;
            }
        }
    }
    if (tokens.length) {
        tokens[tokens.length - 1].flags |= LAST_OF_LINE;
    }
    return tokens;
}
function tokenizeByWord(input) {
    const tokens = [];
    let currentStart = -1;
    let lineNum = 1;
    let flags = FIRST_OF_LINE;
    let shouldNormalize = false;
    const inputEnd = input.length;
    function emitToken(end) {
        const raw = input.slice(currentStart, end);
        const normalized = shouldNormalize ? normalize(raw) : raw;
        flags |= tokens.length === 0 || checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
        if (normalized === MANUAL_ANCHOR1 || normalized === MANUAL_ANCHOR2) {
            flags |= MANUAL_ANCHOR;
        }
        tokens.push({
            text: normalized,
            pos: currentStart,
            len: end - currentStart,
            lineNum,
            flags,
        });
        currentStart = -1;
        flags = 0;
        shouldNormalize = false;
    }
    for (let i = 0; i < inputEnd; i++) {
        let ch = input[i];
        if (SPACE_CHARS[ch]) {
            if (currentStart !== -1)
                emitToken(i);
            if (ch === "\n") {
                lineNum++;
                flags = FIRST_OF_LINE;
                if (tokens.length)
                    tokens[tokens.length - 1].flags |= LAST_OF_LINE;
            }
            continue;
        }
        if (normalizeChars[ch]) {
            shouldNormalize = true;
            ch = normalizeChars[ch];
        }
        if (ch === "(") {
            const result = findInTrie(WildcardTrieNode, input, i);
            if (result) {
                if (currentStart !== -1)
                    emitToken(i);
                flags |= tokens.length === 0 || checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;
                tokens.push({
                    text: result.word,
                    pos: i,
                    len: result.end - i,
                    lineNum,
                    flags: flags | result.flags,
                });
                flags = 0;
                currentStart = -1;
                i = result.end - 1;
                continue;
            }
        }
        if (currentStart === -1 && flags & FIRST_OF_LINE && SECTION_HEADING_START[ch]) {
            const result = findInTrie(SectionHeadingTrieNode, input, i);
            if (result) {
                let p = result.end;
                while (p < inputEnd && SPACE_CHARS[input[p]])
                    p++;
                if (p < inputEnd)
                    flags |= SECTION_HEADING | result.flags;
            }
        }
        // if (SPLIT_CHARS[ch]) {
        // 	if (currentStart !== -1) emitToken(i);
        // 	flags |= tokens.length === 0 || checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;
        // 	tokens.push({
        // 		text: ch,
        // 		pos: i,
        // 		len: 1,
        // 		lineNum,
        // 		flags,
        // 	});
        // 	flags = 0;
        // 	currentStart = -1;
        // 	continue;
        // }
        if (currentStart === -1)
            currentStart = i;
    }
    if (currentStart !== -1)
        emitToken(inputEnd);
    if (tokens.length) {
        tokens[tokens.length - 1].flags |= LAST_OF_LINE;
    }
    return tokens;
}
function tokenizeByLine(input) {
    const tokens = [];
    let lineNum = 1;
    let flags = FIRST_OF_LINE | LAST_OF_LINE;
    const inputEnd = input.length;
    let buffer = "";
    let started = false;
    let inSpace = false;
    let pos = -1;
    for (let i = 0; i < inputEnd; i++) {
        const ch = input[i];
        if (ch !== "\n") {
            if (!SPACE_CHARS[ch]) {
                if (!started) {
                    pos = i;
                    started = true;
                    const result = findInTrie(SectionHeadingTrieNode, input, i);
                    if (result) {
                        let p = result.end;
                        while (p < inputEnd && SPACE_CHARS[input[p]])
                            p++;
                        if (p < inputEnd)
                            flags |= SECTION_HEADING;
                    }
                }
                if (inSpace && buffer.length > 0)
                    buffer += " ";
                buffer += ch;
                inSpace = false;
            }
            else {
                inSpace = started;
            }
        }
        else {
            if (started) {
                if (buffer === MANUAL_ANCHOR1 || buffer === MANUAL_ANCHOR2) {
                    flags |= MANUAL_ANCHOR;
                }
                tokens.push({
                    text: buffer,
                    pos,
                    len: i - pos,
                    lineNum,
                    flags,
                });
                buffer = "";
                started = false;
                inSpace = false;
                flags = FIRST_OF_LINE | LAST_OF_LINE;
            }
            lineNum++;
        }
    }
    return tokens;
}
function tokenize(input, mode, noCache = false) {
    let cacheArr = !noCache && tokenCache[mode];
    if (cacheArr) {
        for (let i = 0; i < cacheArr.length; i++) {
            const cache = cacheArr[i];
            if (cache.text.length === input.length && cache.text === input) {
                if (i !== cacheArr.length - 1) {
                    cacheArr.splice(i, 1);
                    cacheArr.push(cache);
                }
                return cache.tokens;
            }
        }
    }
    const now = performance.now();
    let tokens;
    switch (mode) {
        case "char":
            tokens = tokenizeByChar(input);
            break;
        case "word":
            tokens = tokenizeByWord(input);
            break;
        case "line":
            tokens = tokenizeByLine(input);
            break;
        default:
            throw new Error("Unknown tokenization mode: " + mode);
    }
    console.debug("tokenize took %d ms", performance.now() - now);
    // tokens.push({
    // 	text: "",
    // 	pos: input.length,
    // 	len: 0,
    // 	lineNum: tokens.length > 0 ? tokens[tokens.length - 1].lineNum : 1,
    // 	flags: FIRST_OF_LINE | LAST_OF_LINE,
    // });
    if (cacheArr) {
        if (cacheArr.length >= TOKEN_CACHE_SIZE) {
            cacheArr.shift();
        }
        cacheArr.push({ text: input, tokens: tokens });
    }
    return tokens;
}
function normalize(text) {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        result += normalizeChars[char] || char;
    }
    return result;
}
function checkIfFirstOfLine(input, pos) {
    pos--;
    while (pos >= 0) {
        if (input[pos] === "\n") {
            break;
        }
        else if (!SPACE_CHARS[input[pos]]) {
            return false;
        }
        pos--;
    }
    return true;
}
function createTrie(ignoreSpaces = false) {
    const root = createTrieNode(ignoreSpaces);
    function insert(word, flags = 0) {
        let node = root;
        for (let i = 0; i < word.length; i++) {
            node = node.addChild(word[i]);
        }
        node.word = word;
        node.flags = flags;
    }
    return { insert, root };
}
function createTrieNode(ignoreSpaces) {
    const children = {};
    const node = {
        children,
        word: null,
        flags: 0,
        next(char) {
            if (ignoreSpaces && char === " ")
                return node;
            return children[char] || null;
        },
        addChild(char) {
            return children[char] ?? (children[char] = createTrieNode(ignoreSpaces));
        },
    };
    return node;
}
function findInTrie(trie, input, start) {
    let node = trie;
    let i = start;
    while (i < input.length) {
        const ch = input[i++];
        node = node.next(ch);
        if (!node)
            break;
        if (node.word) {
            return { word: node.word, flags: node.flags, end: i };
        }
    }
    return null;
}
function extractStartCharsFromTrie(trie) {
    const table = {};
    for (const ch in trie.children) {
        table[ch] = 1;
    }
    return table;
}
//# sourceMappingURL=tokenize.js.map