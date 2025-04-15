"use strict";
const MANUAL_ANCHOR1 = "@@@";
const MANUAL_ANCHOR2 = "###";
const TOKEN_CACHE_SIZE = 2;
// token flags
// tokenize.ts과 같은 값 사용 필수
const FIRST_OF_LINE = 1;
const LAST_OF_LINE = 2;
const WILD_CARD = 16;
const NORMALIZE = 32; // &middot;, 따옴표 -, 말머리문자 등등 실제로 문자 코드는 다르지만 같다고 처리해야 할 문자들이 있다.
const SECTION_HEADING = 64;
const MANUAL_ANCHOR = 128; // @@@, ### 등등
const SPACE_CHARS = {
    " ": true,
    "\t": true,
    "\n": true,
    "\r": true, // 글쎄...
    "\f": true, // 이것들은...
    "\v": true, // 볼일이 없을것...
};
const normalizeChars = {};
let _nextCtx = null;
let _currentCtx = null;
function registerNormalizeChar(chars) {
    const norm = chars[0];
    normalizeChars[norm] = norm;
    for (let i = 1; i < chars.length; i++) {
        normalizeChars[chars[i]] = norm;
    }
}
const tokenCache = {
    ["char"]: [],
    ["word"]: [],
    ["line"]: [],
};
function createTrieNode(ignoreSpaces) {
    const children = {};
    function next(char) {
        return ignoreSpaces && char === " " ? this : children[char] || null;
    }
    function addChild(char) {
        if (!children[char]) {
            children[char] = createTrieNode(ignoreSpaces);
        }
        return children[char];
    }
    return { next, addChild, word: null, flags: null };
}
function createTrie(ignoreSpaces = false) {
    const root = createTrieNode(ignoreSpaces);
    function insert(word, flags = 0) {
        let node = root;
        for (const char of word) {
            node = node.addChild(char);
        }
        node.word = word;
        node.flags = flags;
    }
    return { insert, root };
}
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
    SectionHeadingTrie.insert(`(${i}) `);
    SectionHeadingTrie.insert(`${i}) `);
}
const syllables = "가나다라마바사아자차카타파하";
for (let i = 0; i < syllables.length; i++) {
    SectionHeadingTrie.insert(`(${syllables[i]}) `);
    SectionHeadingTrie.insert(`${syllables[i]}) `);
    SectionHeadingTrie.insert(`(${String.fromCharCode(syllables.charCodeAt(i) + 112)}) `);
    SectionHeadingTrie.insert(`${String.fromCharCode(syllables.charCodeAt(i) + 112)}) `);
}
const SectionHeadingTrieNode = SectionHeadingTrie.root;
const ManualAnchorTrie = createTrie(false);
ManualAnchorTrie.insert(MANUAL_ANCHOR1, MANUAL_ANCHOR);
ManualAnchorTrie.insert(MANUAL_ANCHOR2, MANUAL_ANCHOR);
const ManualAnchorTrieNode = ManualAnchorTrie.root;
self.onmessage = (e) => {
    if (e.data.type === "diff") {
        const request = e.data;
        const ctx = {
            ...request,
            cancel: false,
            start: 0,
            finish: 0,
            lastYield: 0,
            entries: [],
            states: {},
        };
        if (_currentCtx) {
            _currentCtx.cancel = true;
            _nextCtx = ctx;
            return;
        }
        runDiff(ctx);
    }
    else if (e.data.type === "normalizeChars") {
        // TODO 이런 요상한 방법을 쓰지말고 UI쓰레드에서 Worker 생성 후 initialize 메시지를 한번 보내기.
        registerNormalizeChar(e.data.chars);
        // } else if (e.data.type === "option") {
        // 	if (e.data.key === "greedyMatch") {
        // 		greedyMatch = e.data.value;
        // 	}
    }
};
async function runDiff(ctx) {
    _currentCtx = ctx;
    try {
        ctx.lastYield = ctx.start = performance.now();
        self.postMessage({
            reqId: ctx.reqId,
            type: "start",
            start: ctx.start,
        });
        let result;
        if (ctx.options.algorithm === "histogram") {
            result = await runHistogramDiff(ctx);
        }
        else if (ctx.options.algorithm === "myers") {
            result = await runMyersDiff(ctx);
        }
        else if (ctx.options.algorithm === "lcs") {
            result = await runLcsDiff(ctx);
        }
        else {
            throw new Error("Unknown algorithm: " + ctx.options.algorithm);
        }
        ctx.finish = performance.now();
        _currentCtx = null;
        self.postMessage({
            reqId: ctx.reqId,
            type: "diff",
            processTime: ctx.finish - ctx.start,
            ...result,
        });
    }
    catch (e) {
        if (e instanceof Error && e.message === "cancelled") {
            // console.debug("Diff canceled");
        }
        else {
            console.error(e);
        }
    }
    [ctx, _nextCtx] = [_nextCtx, null];
    if (ctx) {
        return await runDiff(ctx);
    }
}
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
    let node = null;
    const inputPos = 0;
    const inputEnd = input.length;
    for (let i = inputPos; i < inputEnd; i++) {
        const char = input[i];
        if (!SPACE_CHARS[char]) {
            if (char === "(") {
                let p = i + 1;
                let found = null;
                for (node = WildcardTrieNode; p < inputEnd && (node = node.next(input[p++])) !== null;) {
                    if (node.word !== null) {
                        found = node;
                        break;
                    }
                }
                if (found) {
                    flags |= tokens.length === 0 && checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;
                    tokens.push({
                        text: found.word,
                        pos: i,
                        len: p - i,
                        lineNum: lineNum,
                        flags: flags | (found.flags || 0),
                    });
                    flags = 0;
                    i = p - 1;
                    continue;
                }
            }
            if ((node = ManualAnchorTrieNode.next(char))) {
                let p = i + 1;
                let found = null;
                for (; p < inputEnd && (node = node.next(input[p++])) !== null;) {
                    if (node.word !== null) {
                        found = node;
                        break;
                    }
                }
                if (found) {
                    flags |= tokens.length === 0 && checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;
                    tokens.push({
                        text: found.word,
                        pos: i,
                        len: p - i,
                        lineNum: lineNum,
                        flags: flags | (found.flags || 0),
                    });
                    flags = 0;
                    i = p - 1;
                    continue;
                }
            }
            flags |= tokens.length === 0 && checkIfFirstOfLine(input, i) ? FIRST_OF_LINE : 0;
            tokens.push({
                text: char,
                pos: i,
                len: 1,
                lineNum: lineNum,
                flags,
            });
            flags = 0;
        }
        if (char === "\n") {
            lineNum++;
            flags = FIRST_OF_LINE;
            if (tokens.length > 0) {
                tokens[tokens.length - 1].flags |= LAST_OF_LINE;
            }
        }
    }
    if (tokens.length > 0) {
        let p = inputEnd;
        while (p <= input.length) {
            if (p === input.length || input[p] === "\n") {
                tokens[tokens.length - 1].flags |= LAST_OF_LINE;
                break;
            }
            else if (!SPACE_CHARS[input[p]]) {
                break;
            }
            p++;
        }
    }
    //console.debug("tokenizeByChar", tokens);
    return tokens;
}
function tokenizeByWord(input) {
    const tokens = [];
    let currentStart = -1;
    let lineNum = 1;
    let flags = FIRST_OF_LINE;
    const inputPos = 0;
    const inputEnd = input.length;
    for (let i = inputPos; i < inputEnd; i++) {
        let char = input[i];
        // 문장부호를 별개로 단어로 분리하는 방법도 생각해볼 필요가 있음.
        // 문제는 (hello)와 (world)에서 '('만 매치되면 눈이 피곤해진다. 괄호안의 문자들이 여러줄이면 더더욱..
        if (SPACE_CHARS[char]) {
            if (currentStart !== -1) {
                flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
                const text = flags & NORMALIZE ? normalize(input.substring(currentStart, i)) : input.substring(currentStart, i);
                if (text === MANUAL_ANCHOR1 || text === MANUAL_ANCHOR2) {
                    flags |= MANUAL_ANCHOR;
                }
                tokens.push({
                    text: text,
                    pos: currentStart,
                    len: i - currentStart,
                    lineNum: lineNum,
                    flags,
                });
                flags = 0;
                currentStart = -1;
            }
            if (char === "\n") {
                lineNum++;
                flags = FIRST_OF_LINE;
                if (tokens.length > 0) {
                    tokens[tokens.length - 1].flags |= LAST_OF_LINE;
                }
            }
        }
        else {
            if (normalizeChars[char]) {
                flags |= NORMALIZE;
                char = normalizeChars[char];
            }
            if (char === "(") {
                let p = i + 1;
                let found = null;
                for (let node = WildcardTrieNode; p < inputEnd && (node = node.next(input[p++])) !== null;) {
                    if (node.word !== null) {
                        found = node;
                        break;
                    }
                }
                if (found) {
                    if (currentStart !== -1) {
                        flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
                        tokens.push({
                            text: input.substring(currentStart, i),
                            pos: currentStart,
                            len: i - currentStart,
                            lineNum: lineNum,
                            flags,
                        });
                        flags = 0;
                        currentStart = -1;
                    }
                    flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
                    tokens.push({
                        text: found.word,
                        pos: i,
                        len: p - i,
                        lineNum: lineNum,
                        flags: flags | (found.flags || 0),
                    });
                    flags = 0;
                    i = p - 1;
                    continue;
                }
            }
            if (flags & FIRST_OF_LINE) {
                let p = i;
                let found = null;
                for (let node = SectionHeadingTrieNode; p < inputEnd && (node = node.next(input[p++])) !== null;) {
                    if (node.word !== null) {
                        found = node;
                        break;
                    }
                }
                if (found) {
                    while (p < inputEnd && SPACE_CHARS[input[p]]) {
                        p++;
                    }
                    if (p < inputEnd) {
                        flags |= SECTION_HEADING;
                    }
                }
            }
            if (currentStart === -1) {
                currentStart = i;
            }
        }
    }
    if (currentStart !== -1) {
        const text = flags & NORMALIZE ? normalize(input.substring(currentStart)) : input.substring(currentStart);
        if (text === MANUAL_ANCHOR1 || text === MANUAL_ANCHOR2) {
            flags |= MANUAL_ANCHOR;
        }
        flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
        tokens.push({
            text: text,
            pos: currentStart,
            len: inputEnd - currentStart,
            lineNum: lineNum,
            flags: flags,
        });
    }
    if (tokens.length > 0) {
        let p = inputEnd;
        while (p <= input.length) {
            if (p === input.length || input[p] === "\n") {
                tokens[tokens.length - 1].flags |= LAST_OF_LINE;
                break;
            }
            else if (!SPACE_CHARS[input[p]]) {
                break;
            }
            p++;
        }
    }
    //console.debug("tokenizeByWord", tokens);
    return tokens;
}
function tokenizeByLine(input) {
    const tokens = [];
    let currentStart = -1;
    let currentEnd = -1;
    let lineNum = 1;
    let flags = FIRST_OF_LINE | LAST_OF_LINE;
    const inputPos = 0;
    const inputEnd = input.length;
    for (let i = inputPos; i < inputEnd; i++) {
        const char = input[i];
        if (char !== "\n") {
            if (!SPACE_CHARS[char]) {
                if (currentStart === -1) {
                    currentStart = i;
                    let p = i;
                    let found = null;
                    for (let node = SectionHeadingTrieNode; p < inputEnd && (node = node.next(input[p++])) !== null;) {
                        if (node.word !== null) {
                            found = node;
                            break;
                        }
                    }
                    if (found) {
                        while (p < inputEnd && SPACE_CHARS[input[p]]) {
                            p++;
                        }
                        if (p < inputEnd) {
                            flags |= SECTION_HEADING;
                        }
                    }
                }
                currentEnd = i + 1;
            }
        }
        else {
            if (currentStart !== -1) {
                const text = input.substring(currentStart, currentEnd).replace(/\s+/g, " ");
                if (text === MANUAL_ANCHOR1 || text === MANUAL_ANCHOR2) {
                    flags |= MANUAL_ANCHOR;
                }
                tokens.push({
                    text: text,
                    pos: currentStart,
                    len: i - currentStart,
                    lineNum: lineNum,
                    flags: flags,
                });
                flags = FIRST_OF_LINE | LAST_OF_LINE;
                currentStart = currentEnd = -1;
            }
            lineNum++;
        }
    }
    if (currentStart !== -1) {
        const text = input.substring(currentStart, currentEnd).replace(/\s+/g, " ");
        if (text === MANUAL_ANCHOR1 || text === MANUAL_ANCHOR2) {
            flags |= MANUAL_ANCHOR;
        }
        tokens.push({
            text: text,
            pos: currentStart,
            len: currentEnd - currentStart,
            lineNum: lineNum,
            flags: flags,
        });
    }
    //console.debug("tokenizeByLine", tokens);
    return tokens;
}
function tokenize(input, mode, noCache = false) {
    let cacheArr = !noCache && tokenCache[mode];
    if (cacheArr) {
        for (let i = 0; i < cacheArr.length; i++) {
            const cache = cacheArr[i];
            if (cache.text === input) {
                if (i !== cacheArr.length - 1) {
                    cacheArr.splice(i, 1);
                    cacheArr.push(cache);
                }
                return cache.tokens;
            }
        }
    }
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
// #endregion
// =============================================================
// LCS Algorithm
// =============================================================
async function runLcsDiff(ctx) {
    const lhrTokens = tokenize(ctx.leftText, ctx.options.tokenization);
    const rhsTokens = tokenize(ctx.rightText, ctx.options.tokenization);
    const rawResult = await computeDiff(lhrTokens, rhsTokens, !!ctx.options.greedyMatch, ctx);
    return postProcess(ctx, rawResult, lhrTokens, rhsTokens);
}
async function computeLCS(leftTokens, rightTokens, ctx) {
    const m = leftTokens.length;
    const n = rightTokens.length;
    const dp = new Array(m + 1);
    for (let i = 0; i <= m; i++) {
        dp[i] = new Array(n + 1).fill(0);
    }
    // 텍스트가 길어지는 경우(토큰이 많은 경우) 끔찍하게 많은 반복을 수행하게된다.
    for (let i = 1; i <= m; i++) {
        const leftText = leftTokens[i - 1].text;
        for (let j = 1; j <= n; j++) {
            // 주기적으로 yield 해서 취소요청을 받아야함.
            // performance.now()는 미친게 아닌가 싶을 정도로 무거운 함수이기 때문에 되도록 자제.
            // await new Promise(...) 역시 자주 사용하면 안됨
            // (i+j) % 0x4000 === 0 일 때만 사용하기로. 브라우저 js엔진의 비트연산 속도를 믿어본다 ㅋ
            if (ctx && ((i + j) & 16383) === 0) {
                const now = performance.now();
                if (now - ctx.lastYield > 100) {
                    ctx.lastYield = now;
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    if (ctx.cancel) {
                        throw new Error("cancelled");
                    }
                }
            }
            if (leftText === rightTokens[j - 1].text) {
                dp[i][j] = dp[i - 1][j - 1] + 1; // + consecutive[i][j];
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    let i = m;
    let j = n;
    const lcsIndices = [];
    while (i > 0 && j > 0) {
        if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
            lcsIndices.push({
                leftIndex: i - 1,
                rightIndex: j - 1,
            });
            i--;
            j--;
        }
        else if (dp[i - 1][j] >= dp[i][j - 1]) {
            i--;
        }
        else {
            j--;
        }
    }
    lcsIndices.reverse();
    return lcsIndices;
}
// 정들었던 diff 함수. 폐기처분 예정.
async function computeDiff(lhsTokens, rhsTokens, greedyMatch = false, ctx) {
    const entries = [];
    const lcs = await computeLCS(lhsTokens, rhsTokens, ctx);
    const lcsLength = lcs.length;
    const leftTokensLength = lhsTokens.length;
    const rightTokensLength = rhsTokens.length;
    if (leftTokensLength === 0 && rightTokensLength === 0) {
    }
    else if (leftTokensLength === 0) {
        entries.push({
            type: 2,
            left: {
                pos: 0,
                len: leftTokensLength,
                empty: true,
            },
            right: {
                pos: 0,
                len: rightTokensLength,
            },
        });
    }
    else if (rightTokensLength === 0) {
        entries.push({
            type: 1,
            left: {
                pos: 0,
                len: leftTokensLength,
            },
            right: {
                pos: 0,
                len: rightTokensLength,
                empty: true,
            },
        });
    }
    else {
        let i = 0;
        let j = 0;
        let lcsIndex = 0;
        let iteration = 0;
        while (lcsIndex < lcsLength || i < leftTokensLength || j < rightTokensLength) {
            if (ctx && (iteration & 1023) === 0) {
                const now = performance.now();
                if (now - ctx.lastYield > 100) {
                    ctx.lastYield = now;
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    if (ctx.cancel) {
                        throw new Error("cancelled");
                    }
                }
            }
            if (lcsIndex < lcsLength &&
                ((greedyMatch &&
                    lhsTokens[i].text === lhsTokens[lcs[lcsIndex].leftIndex].text &&
                    rhsTokens[j].text === rhsTokens[lcs[lcsIndex].rightIndex].text) ||
                    (i === lcs[lcsIndex].leftIndex && j === lcs[lcsIndex].rightIndex))) {
                entries.push({
                    type: 0,
                    left: {
                        pos: i,
                        len: 1,
                    },
                    right: {
                        pos: j,
                        len: 1,
                    },
                });
                i++;
                j++;
                lcsIndex++;
                continue;
            }
            const lcsEntry = lcs[lcsIndex];
            while (i < leftTokensLength && // 유효한 토큰 index
                (!lcsEntry || // 공통 sequence가 없는 경우
                    (!greedyMatch && i < lcsEntry.leftIndex) || // 정확한 lcsIndex에만 매칭시키는 경우
                    lhsTokens[i].text !== lhsTokens[lcsEntry.leftIndex].text) // or 텍스트가 같으면 바로 중단
            ) {
                entries.push({
                    type: 1,
                    left: {
                        pos: i,
                        len: 1,
                    },
                    right: {
                        pos: j,
                        len: 0,
                    },
                });
                i++;
            }
            while (j < rightTokensLength && // 유효한 토큰 index
                (!lcsEntry || // 공통 sequence가 없는 경우
                    (!greedyMatch && j < lcsEntry.rightIndex) || // 정확한 lcsIndex에만 매칭시키는 경우
                    rhsTokens[j].text !== rhsTokens[lcsEntry.rightIndex].text) // or 텍스트가 같으면 바로 중단
            ) {
                entries.push({
                    type: 2,
                    left: {
                        pos: i,
                        len: 0,
                    },
                    right: {
                        pos: j,
                        len: 1,
                    },
                });
                j++;
            }
        }
    }
    return entries;
}
// ============================================================
// Myers Algorithm
// ============================================================
// not fully working yet! 생각보다 이해가 안되는 알고리즘...
async function runMyersDiff(ctx) {
    const lhsTokens = tokenize(ctx.leftText, ctx.options.tokenization, false);
    const rhsTokens = tokenize(ctx.rightText, ctx.options.tokenization, false);
    const vectorSize = (lhsTokens.length + rhsTokens.length + 1) * 2;
    const vectorDown = new Array(vectorSize);
    const vectorUp = new Array(vectorSize);
    ctx.states.vectorDown = vectorDown;
    ctx.states.vectorUp = vectorUp;
    const rawEntries = await diffCore(ctx, lhsTokens, 0, lhsTokens.length, rhsTokens, 0, rhsTokens.length, findMiddleSnake);
    return postProcess(ctx, rawEntries, lhsTokens, rhsTokens);
}
// 알쏭달쏭.
function findMiddleSnake(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, ctx) {
    const max = lhsTokens.length + rhsTokens.length + 1;
    const width = lhsUpper - lhsLower;
    const height = rhsUpper - rhsLower;
    const delta = width - height;
    const kdown = lhsLower - rhsLower;
    const kup = lhsUpper - rhsUpper;
    const offset_down = max - kdown;
    const offset_up = max - kup;
    const maxD = (lhsUpper - lhsLower + rhsUpper - rhsLower) / 2 + 1;
    const odd = (delta & 1) != 0;
    // const ret = { x: 0, y: 0 };
    // console.log("getShortestMiddleSnake", {
    // 	lhsLower,
    // 	lhsUpper,
    // 	rhsLower,
    // 	rhsUpper,
    // 	width,
    // 	height,
    // 	delta,
    // 	kDown: kdown,
    // 	kUp: kup,
    // 	offsetDown: offset_down,
    // 	offsetUp: offset_up,
    // 	maxD,
    // 	odd,
    // });
    const { vectorDown, vectorUp } = ctx.states;
    vectorDown[offset_down + kdown + 1] = lhsLower;
    vectorUp[offset_up + kup - 1] = lhsUpper;
    // console.log("offsetDown", offset_down, kdown, vectorD[offset_down + kdown + 1]);
    let d, k, x, y;
    for (d = 0; d <= maxD; d++) {
        for (k = kdown - d; k <= kdown + d; k += 2) {
            if (k === kdown - d) {
                x = vectorDown[offset_down + k + 1]; //down
            }
            else {
                x = vectorDown[offset_down + k - 1] + 1; //right
                if (k < kdown + d && vectorDown[offset_down + k + 1] >= x) {
                    x = vectorDown[offset_down + k + 1]; //down
                }
            }
            y = x - k;
            // console.log("BEFORE \\", x, y);
            while (x < lhsUpper && y < rhsUpper && lhsTokens[x].text === rhsTokens[y].text) {
                x++;
                y++;
            }
            vectorDown[offset_down + k] = x;
            // console.log("FORWARD", {
            // 	x,
            // 	y,
            // 	k,
            // 	d,
            // 	kDown: kdown,
            // 	vectorD,
            // 	vectorU,
            // 	"vectorDown[offsetDown + k + 1]": vectorD[offset_down + k + 1],
            // 	"vectorDown[offsetDown + k - 1]": vectorD[offset_down + k - 1],
            // });
            if (odd && kup - d < k && k < kup + d) {
                //if (vectorUp[offset_up + k] <= vectorDown[offset_down + k]) {
                if (vectorDown[offset_down + k] >= vectorUp[offset_up + k]) {
                    return {
                        lhsIndex: vectorDown[offset_down + k],
                        lhsLength: 1,
                        rhsIndex: vectorDown[offset_down + k] - k,
                        rhsLength: 1,
                    };
                    // ret.x = vectorDown[offset_down + k];
                    // ret.y = vectorDown[offset_down + k] - k;
                    // return ret;
                }
            }
        }
        for (k = kup - d; k <= kup + d; k += 2) {
            // find the only or better starting point
            if (k === kup + d) {
                x = vectorUp[offset_up + k - 1]; // up
            }
            else {
                x = vectorUp[offset_up + k + 1] - 1; // left
                if (k > kup - d && vectorUp[offset_up + k - 1] < x)
                    x = vectorUp[offset_up + k - 1]; // up
            }
            y = x - k;
            while (x > lhsLower && y > rhsLower && lhsTokens[x - 1].text === rhsTokens[y - 1].text) {
                // diagonal
                x--;
                y--;
            }
            vectorUp[offset_up + k] = x;
            // console.log("BACKWARD", {
            // 	x,
            // 	y,
            // 	k,
            // 	d,
            // 	kUp: kup,
            // 	vectorD,
            // 	vectorU,
            // 	"vectorD[offset_down + k]": vectorD[offset_down + k],
            // 	"vectorU[offset_up + k]": vectorU[offset_up + k],
            // });
            // overlap ?
            if (!odd && kdown - d <= k && k <= kdown + d) {
                // if (vectorUp[offset_up + k] <= vectorDown[offset_down + k]) {
                if (vectorDown[offset_down + k] >= vectorUp[offset_up + k]) {
                    return {
                        lhsIndex: vectorDown[offset_down + k],
                        lhsLength: 1,
                        rhsIndex: vectorDown[offset_down + k] - k,
                        rhsLength: 1,
                    };
                }
            }
        }
    }
    return null;
    // throw new Error("No middle snake found");
    // return { x: lhsLower - 1, y: rhsLower - 1 };
    // return { x: -1, y: -1 }; // No snake found
}
// ============================================================
// Histogram Algorithm
// 일단 지금은 이놈이 디폴트
// ============================================================
async function runHistogramDiff(ctx) {
    const lhsTokens = tokenize(ctx.leftText, ctx.options.tokenization, false);
    const rightTokens = tokenize(ctx.rightText, ctx.options.tokenization, false);
    ctx.states.entries = [];
    const rawEntries = await diffCore(ctx, lhsTokens, 0, lhsTokens.length, rightTokens, 0, rightTokens.length, findBestHistogramAnchor);
    return postProcess(ctx, rawEntries, lhsTokens, rightTokens);
}
// histogram diff에서 가장 중요한 함수
// 얼마나 값어치 있는 공통 앵커를 찾느냐가 매우 중요하고 고로 그 값어치를 매기는 기준과 방법이 또 매우 중요함
// 여러가지 생각해볼 것들이 많지만...
const findBestHistogramAnchor = function (lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, ctx) {
    const diffOptions = ctx.options;
    const LENGTH_BIAS_FACTOR = diffOptions.lengthBiasFactor || 0.7; // 길이가 너무 크게 영향을 주는 경향이 있어서 이걸로 조절
    const UNIQUE_BONUS = 1 / (diffOptions.uniqueMultiplier || 1 / 0.5);
    const LINE_START_BONUS = 1 / (diffOptions.lineStartMultiplier || 1 / 0.85);
    const LINE_END_BONUS = 1 / (diffOptions.lineEndMultiplier || 1 / 0.9);
    const SECTION_HEADING_BONUS = 1 / (diffOptions.lineStartMultiplier || 1 / 0.75);
    //const FULL_LINE_BONUS = 0.85; n그램을 사용시 여러단어가 매치되는 경우 오히려 마지막 단어가 다음 줄로 넘어가서 보너스를 못 받을 수가 있다
    const useLengthBias = !!ctx.options.useLengthBias;
    const maxGram = ctx.options.maxGram || 1;
    const useMatchPrefix = ctx.options.whitespace === "ignore";
    const maxLen = useMatchPrefix ? Math.floor(maxGram * 1.5) : maxGram; //1=>1, 2=>3, 3=>4, 4=>6, 5=>7, 6=>9, 7=>10, 8=>12, 9=>13, 10=>15,...
    const delimiter = ctx.options.whitespace === "ignore" ? "" : "\u0000";
    const freq = {};
    for (let n = 1; n <= maxLen; n++) {
        for (let i = lhsLower; i <= lhsUpper - n; i++) {
            let key = lhsTokens[i].text;
            for (let k = 1; k < n; k++) {
                key += delimiter + lhsTokens[i + k].text;
            }
            freq[key] = (freq[key] || 0) + 1;
        }
        for (let i = rhsLower; i <= rhsUpper - n; i++) {
            let key = rhsTokens[i].text;
            for (let k = 1; k < n; k++) {
                key += delimiter + rhsTokens[i + k].text;
            }
            freq[key] = (freq[key] || 0) + 1;
        }
    }
    let best = null;
    for (let i = lhsLower; i < lhsUpper; i++) {
        const ltext1 = lhsTokens[i].text;
        // 특수 케이스
        // 강제로 문서의 특정 지점끼리 매칭시킴. 문서 구조가 항상 내 맘 같은 것이 아니야. ㅠ
        // if (ltext1 === MANUAL_ANCHOR1 || ltext1 === MANUAL_ANCHOR2) {
        // 	for (let j = rhsLower; j < rhsUpper; j++) {
        // 		if (rhsTokens[j].text === ltext1) {
        // 			return {
        // 				lhsIndex: i,
        // 				lhsLength: 1,
        // 				rhsIndex: j,
        // 				rhsLength: 1,
        // 			};
        // 		}
        // 	}
        // }
        for (let j = rhsLower; j < rhsUpper; j++) {
            const rtext1 = rhsTokens[j].text;
            let li = i, ri = j;
            let lhsLen = 0, rhsLen = 0;
            let nGrams = 0;
            while (li < lhsUpper && ri < rhsUpper && lhsLen < maxLen && rhsLen < maxLen && nGrams < maxGram) {
                const ltext = lhsTokens[li].text;
                const rtext = rhsTokens[ri].text;
                if (ltext === rtext) {
                    if (ltext === MANUAL_ANCHOR1 || ltext === MANUAL_ANCHOR2) {
                        // 강제로 문서의 특정 지점끼리 매칭시킴. 문서 구조가 항상 내 맘 같은 것이 아니야. ㅠ
                        return {
                            lhsIndex: li,
                            lhsLength: 1,
                            rhsIndex: ri,
                            rhsLength: 1,
                        };
                    }
                    li++;
                    ri++;
                    lhsLen++;
                    rhsLen++;
                    nGrams++;
                    continue;
                }
                if (useMatchPrefix && ltext1.length !== rtext1.length && ltext[0] === rtext[0]) {
                    const match = matchPrefixTokens(lhsTokens, li, lhsUpper, rhsTokens, ri, rhsUpper);
                    if (match) {
                        const matchedGrams = Math.min(match[0], match[1]);
                        if (lhsLen + match[0] <= maxLen && rhsLen + match[1] <= maxLen && nGrams + matchedGrams <= maxGram) {
                            li += match[0];
                            ri += match[1];
                            lhsLen += match[0];
                            rhsLen += match[1];
                            nGrams += matchedGrams;
                            continue;
                        }
                    }
                }
                break;
            }
            if (lhsLen > 0 && rhsLen > 0) {
                let frequency;
                let len;
                // let anchorText: string;
                if (lhsLen === 1) {
                    // anchorText = ltext1;
                    frequency = freq[ltext1] || 1;
                    len = ltext1.length;
                    // score = freq[ltext1] || 1;
                    // if (useLengthBias) {
                    // 	score += 1 / (ltext1.length + 1);
                    // }
                }
                else {
                    let key = lhsTokens[i].text;
                    len = key.length;
                    for (let k = 1; k < lhsLen; k++) {
                        const text = lhsTokens[i + k].text;
                        key += delimiter + text;
                        len += text.length;
                    }
                    // anchorText = key;
                    frequency = freq[key] || 1;
                    // score = (freq[key] || 1) / ((lhsLen + 1) * (len + 1));
                    // score = (freq[key] || 1) / (lhsLen * len + 1);
                    // score = (freq[key] || 1) / (len + 1);
                }
                let score = 0;
                score = useLengthBias ? frequency / (1 + Math.log(len + 1) * LENGTH_BIAS_FACTOR) : frequency;
                if (frequency === 1) {
                    score *= UNIQUE_BONUS;
                }
                if (lhsTokens[i].flags & rhsTokens[j].flags & FIRST_OF_LINE) {
                    // if (lhsTokens[i + lhsLen - 1].flags & rhsTokens[j + rhsLen - 1].flags & LAST_OF_LINE) {
                    // 	score *= FULL_LINE_BONUS;
                    // } else {
                    // }
                    score *= LINE_START_BONUS;
                }
                else if (lhsTokens[i + lhsLen - 1].flags & rhsTokens[j + rhsLen - 1].flags & LAST_OF_LINE) {
                    score *= LINE_END_BONUS;
                }
                if (lhsTokens[i].flags & rhsTokens[j].flags & SECTION_HEADING) {
                    score *= SECTION_HEADING_BONUS;
                }
                if (!best || score < best.score) {
                    best = {
                        lhsIndex: i,
                        lhsLength: lhsLen,
                        rhsIndex: j,
                        rhsLength: rhsLen,
                        score,
                        // anchorText,
                    };
                }
            }
        }
    }
    return best ?? null;
};
// ============================================================
// Helper functions
// ============================================================
// Divide and conquer!
// myers, histogram, patience 알고리즘에 공통으로 사용되는 재귀함수
// 1. 양 텍스트를 공통되는 부분(앵커)으로 분할
// 2. 분할된 영역에 대해서 재귀호출
async function diffCore(ctx, leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, findAnchor) {
    if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
        throw new Error("Invalid range");
    }
    // 사실 이걸 쓰면 리턴값이 필요 없는데...
    // 함수 시그니처를 고치기 귀찮아서 일단 내비둠.
    const entries = ctx.entries;
    const now = performance.now();
    if (now - ctx.lastYield > 100) {
        ctx.lastYield = now;
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (ctx.cancel)
            throw new Error("cancelled");
    }
    // TODO
    // 공통 부분을 스킵하는건데 문제는 여기에서 HEAD, TAIL을 스킵하고
    // 이후에 diffCore를 재귀적으로 호출할 때 앞쪽 절반에 대해서 HEAD부분, 뒤쪽 절반에 대해서 TAIL부분을 다시 한번 스킵을 시도하게 된다.
    // 더 이상 스킵할 게 없으니 결과에는 차이가 없겠지만 불필요한 시도를 안하는 쪽으로 개선해 볼 필요가 있음!
    // 생각해볼 것: 공통 prefix,suffix를 스킵하지 않았을 경우 스킵되지 않은 부분에서 더 나은 앵커가 나올 확률이 있다.
    // 그렇지만 스킵하지 않으면 성능 상 아주 큰 문제가 생김!
    let skippedHead;
    let skippedTail;
    [lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(leftTokens, rightTokens, lhsLower, lhsUpper, rhsLower, rhsUpper, ctx.options.tokenization === "word" ? ctx.options.whitespace : "normalize" // consumeCommonEdges 함수에 글자단위 매치를 시도할지를 가르키는 인자를 추가해야 맞지만 지금은 좀 귀찮네!
    );
    entries.push(...skippedHead);
    // 양쪽 모두 남아있는 영역이 있는 경우 공통 앵커를 찾아본다!
    let anchor = null;
    if (lhsLower < lhsUpper &&
        rhsLower < rhsUpper &&
        (anchor = findAnchor(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx)) &&
        (anchor.lhsLength > 0 || anchor.rhsLength > 0) && // for safety! 적어도 한쪽이라도 영역을 줄여야 무한루프 안 생길 듯?
        anchor.lhsIndex >= lhsLower &&
        anchor.lhsIndex + anchor.lhsLength <= lhsUpper &&
        anchor.rhsIndex >= rhsLower &&
        anchor.rhsIndex + anchor.rhsLength <= rhsUpper) {
        console.debug("anchor:", anchor, lhsLower, lhsUpper, rhsLower, rhsUpper);
        await diffCore(ctx, leftTokens, lhsLower, anchor.lhsIndex, rightTokens, rhsLower, anchor.rhsIndex, findAnchor);
        // 앵커는 common sequence임!
        entries.push({
            type: 0,
            left: {
                pos: anchor.lhsIndex,
                len: anchor.lhsLength,
            },
            right: {
                pos: anchor.rhsIndex,
                len: anchor.rhsLength,
            },
        });
        await diffCore(ctx, leftTokens, anchor.lhsIndex + anchor.lhsLength, lhsUpper, rightTokens, anchor.rhsIndex + anchor.rhsLength, rhsUpper, findAnchor);
    }
    else {
        // 유효한 앵커는 못찾았지만 남아있는 토큰들이 있다면 diff로 처리
        if (lhsLower < lhsUpper || rhsLower < rhsUpper) {
            let type = 0;
            if (lhsLower < lhsUpper)
                type |= 1;
            if (rhsLower < rhsUpper)
                type |= 2;
            entries.push({
                type: type,
                left: {
                    pos: lhsLower,
                    len: lhsUpper - lhsLower,
                },
                right: {
                    pos: rhsLower,
                    len: rhsUpper - rhsLower,
                },
            });
        }
    }
    entries.push(...skippedTail);
    return entries;
}
// 공백을 완전히 무시하는 경우 "안녕 하세요" vs "안녕하세요"는 같다고 처리해야하지만
// 단어단위 토큰인 경우 토큰 대 토큰 비교는 실패할 수 밖에 없다.
// 따라서 각 토큰의 글자를 한땀한땀 매치시켜봐야하고 양쪽에서 토큰이 끝나는 시점까지 모든 글자가 매치되었다면
// 그 끝나는 시점까지의 토큰 수만큼 consume을 함.
function consumeCommonEdges(lhsTokens, rhsTokens, lhsLower, lhsUpper, rhsLower, rhsUpper, whitespace = "ignore") {
    const head = [];
    const tail = [];
    let matchedCount;
    // Prefix
    while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
        if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text) {
            head.push({
                type: 0,
                left: { pos: lhsLower, len: 1 },
                right: { pos: rhsLower, len: 1 },
            });
            lhsLower++;
            rhsLower++;
        }
        else if (whitespace === "ignore" &&
            lhsTokens[lhsLower].text.length !== rhsTokens[rhsLower].text.length &&
            lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] &&
            (matchedCount = matchPrefixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper))) {
            head.push({
                type: 0,
                left: {
                    pos: lhsLower,
                    len: matchedCount[0],
                },
                right: {
                    pos: rhsLower,
                    len: matchedCount[1],
                },
            });
            lhsLower += matchedCount[0];
            rhsLower += matchedCount[1];
        }
        else {
            break;
        }
    }
    // Suffix
    while (lhsUpper > lhsLower && rhsUpper > rhsLower) {
        if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {
            tail.push({
                type: 0,
                left: { pos: lhsUpper - 1, len: 1 },
                right: { pos: rhsUpper - 1, len: 1 },
            });
            lhsUpper--;
            rhsUpper--;
        }
        else if (whitespace === "ignore" &&
            lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length &&
            lhsTokens[lhsUpper - 1].text.at(-1) === rhsTokens[rhsUpper - 1].text.at(-1) &&
            (matchedCount = matchSuffixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper))) {
            tail.push({
                type: 0,
                left: {
                    pos: lhsUpper - matchedCount[0],
                    len: matchedCount[0],
                },
                right: {
                    pos: rhsUpper - matchedCount[1],
                    len: matchedCount[1],
                },
            });
            lhsUpper -= matchedCount[0];
            rhsUpper -= matchedCount[1];
        }
        else {
            break;
        }
    }
    tail.reverse();
    return [lhsLower, lhsUpper, rhsLower, rhsUpper, head, tail];
}
function matchPrefixTokens(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper) {
    let i = lhsLower, j = rhsLower;
    let ci = 0, cj = 0;
    const llen = lhsUpper;
    const rlen = rhsUpper;
    while (i < llen && j < rlen) {
        const ltext = leftTokens[i].text;
        const rtext = rightTokens[j].text;
        const llen2 = ltext.length;
        const rlen2 = rtext.length;
        while (ci < llen2 && cj < rlen2) {
            if (ltext[ci++] !== rtext[cj++])
                return false;
        }
        if (ci >= ltext.length) {
            i++;
            ci = 0;
        }
        if (cj >= rtext.length) {
            j++;
            cj = 0;
        }
        if (ci === 0 && cj === 0)
            return [i - lhsLower, j - rhsLower];
    }
    return false;
}
function matchSuffixTokens(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper) {
    let i = lhsUpper - 1, j = rhsUpper - 1;
    let ci = leftTokens[i].text.length - 1, cj = rightTokens[j].text.length - 1;
    const llen = lhsLower;
    const rlen = rhsLower;
    OUTER: while (i >= llen && j >= rlen) {
        const ltext = leftTokens[i].text;
        const rtext = rightTokens[j].text;
        while (ci >= 0 && cj >= 0) {
            if (ltext[ci--] !== rtext[cj--]) {
                break OUTER;
            }
        }
        if (ci === -1 && cj === -1) {
            return [lhsUpper - i, rhsUpper - j];
        }
        if (ci < 0) {
            i--;
            if (i >= llen)
                ci = leftTokens[i].text.length - 1;
        }
        if (cj < 0) {
            j--;
            if (j >= rlen)
                cj = rightTokens[j].text.length - 1;
        }
    }
    return false;
}
// 무식하게 긴 함수지만 괜히 여러 함수로 쪼개서 오버헤드를 추가하고 싶진 않아서 그런거임. 귀찮은거 아님.
function postProcess(ctx, rawEntries, leftTokens, rightTokens) {
    //console.log("postProcess", "raw entries:", Array.from(rawEntries), leftTokens, rightTokens);
    const leftText = ctx.leftText;
    const rightText = ctx.rightText;
    let prevEntry = null;
    const diffs = [];
    const anchors = [];
    // const mappings: DiffEntry[] = [];
    for (let i = 0; i < rawEntries.length; i++) {
        const entry = rawEntries[i];
        if (entry.type) {
            if (prevEntry) {
                console.assert(prevEntry.left.pos + prevEntry.left.len === entry.left.pos, prevEntry, entry);
                console.assert(prevEntry.right.pos + prevEntry.right.len === entry.right.pos, prevEntry, entry);
                prevEntry.type |= entry.type;
                prevEntry.left.len += entry.left.len;
                prevEntry.right.len += entry.right.len;
            }
            else {
                prevEntry = { left: { ...entry.left }, right: { ...entry.right }, type: entry.type };
                //prevEntry = entry;
            }
        }
        else {
            if (prevEntry) {
                addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
                // mappings.push(prevEntry);
            }
            prevEntry = null;
            const leftToken = leftTokens[entry.left.pos];
            const rightToken = rightTokens[entry.right.pos];
            if (leftToken.flags & rightToken.flags & FIRST_OF_LINE) {
                // 앵커 추가
                addAnchor("before", leftToken.pos, rightToken.pos, null);
            }
            // mappings.push(entry);
        }
    }
    if (prevEntry) {
        addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
        // mappings.push(prevEntry);
    }
    function addAnchor(type, leftPos, rightPos, diffIndex) {
        if (leftPos === undefined || rightPos === undefined) {
            console.error("addAnchor", { type, leftPos, rightPos, diffIndex });
        }
        if (type === "before") {
            // before 앵커는 항상 줄의 시작위치일 때만 추가하므로 줄바꿈 문자만 확인하면 된다!
            while (leftPos > 0 && leftText[leftPos - 1] !== "\n") {
                leftPos--;
            }
            while (rightPos > 0 && rightText[rightPos - 1] !== "\n") {
                rightPos--;
            }
        }
        else if (type === "after") {
            // empty diff의 after앵커는 이후에 다른 토큰이 존재할 수 있음.
            // 공백이 아닌 문자가 나오면 멈추고 기본 위치 사용.
            let p;
            p = leftPos;
            while (p < leftText.length) {
                const ch = leftText[p++];
                if (ch === "\n") {
                    leftPos = p - 1;
                    break;
                }
                else if (!SPACE_CHARS[ch]) {
                    break;
                }
            }
            p = rightPos;
            while (p < rightText.length) {
                const ch = rightText[p++];
                if (ch === "\n") {
                    rightPos = p - 1;
                    break;
                }
                else if (!SPACE_CHARS[ch]) {
                    break;
                }
            }
        }
        if (anchors.length > 0) {
            let lastAnchor = anchors[anchors.length - 1];
            if (lastAnchor.left > leftPos || lastAnchor.right > rightPos) {
                return;
            }
            if (lastAnchor.left === leftPos || lastAnchor.right === rightPos) {
                if (type === lastAnchor.type || type === "before") {
                    return;
                }
            }
        }
        anchors.push({ type, left: leftPos, right: rightPos, diffIndex });
    }
    function addDiff(leftIndex, leftCount, rightIndex, rightCount) {
        let leftPos, leftLen, rightPos, rightLen;
        let leftBeforeAnchorPos, rightBeforeAnchorPos, leftAfterAnchorPos, rightAfterAnchorPos;
        let leftEmpty, rightEmpty;
        let type;
        // 양쪽에 대응하는 토큰이 모두 존재하는 경우. 쉬운 케이스
        if (leftCount > 0 && rightCount > 0) {
            type = 3;
            let leftTokenStart = leftTokens[leftIndex];
            let leftTokenEnd = leftTokens[leftIndex + leftCount - 1];
            let rightTokenEnd = rightTokens[rightIndex + rightCount - 1];
            let rightTokenStart = rightTokens[rightIndex];
            leftPos = leftTokenStart.pos;
            leftLen = leftTokenEnd.pos + leftTokenEnd.len - leftPos;
            leftEmpty = false;
            rightPos = rightTokenStart.pos;
            rightLen = rightTokenEnd.pos + rightTokenEnd.len - rightPos;
            rightEmpty = false;
            // 생각: 한쪽만 줄의 첫 토큰일 때에도 앵커를 넣을까? 앵커에 display:block을 줘서 강제로 줄바꿈 시킨 후에에
            // 좌우 정렬을 할 수 있을 것 같기도 한데...
            if (leftTokenStart.flags & rightTokenStart.flags & FIRST_OF_LINE) {
                leftBeforeAnchorPos = leftPos;
                rightBeforeAnchorPos = rightPos;
                while (leftBeforeAnchorPos > 0 && leftText[leftBeforeAnchorPos - 1] !== "\n") {
                    leftBeforeAnchorPos--;
                }
                while (rightBeforeAnchorPos > 0 && rightText[rightBeforeAnchorPos - 1] !== "\n") {
                    rightBeforeAnchorPos--;
                }
                // addAnchor("before", leftAnchorPos, rightAnchorPos, null);
                if (leftTokenEnd.flags & rightTokenEnd.flags & LAST_OF_LINE) {
                    leftAfterAnchorPos = leftPos + leftLen;
                    rightAfterAnchorPos = rightPos + rightLen;
                    if (leftText[leftAfterAnchorPos] !== "\n") {
                        do {
                            leftAfterAnchorPos++;
                        } while (leftAfterAnchorPos < leftText.length && leftText[leftAfterAnchorPos] !== "\n");
                    }
                    if (rightText[rightAfterAnchorPos] !== "\n") {
                        do {
                            rightAfterAnchorPos++;
                        } while (rightAfterAnchorPos < rightText.length && rightText[rightAfterAnchorPos] !== "\n");
                    }
                    // while (leftAnchorPos + 1 < leftText.length && leftText[leftAnchorPos + 1] !== "\n") {
                    // 	leftAnchorPos++;
                    // }
                    // while (rightAnchorPos + 1 < rightText.length && rightText[rightAnchorPos + 1] !== "\n") {
                    // 	rightAnchorPos++;
                    // }
                    // addAnchor("after", leftBeforeAnchorPos, rightBeforeAnchorPos, null);
                }
            }
        }
        else {
            // 한쪽이 비어있음.
            // 단순하게 토큰 사이에 위치시켜도 되지만 되도록이면 대응하는 쪽과 유사한 위치(줄시작/줄끝)에 위치시키기 위해...
            // 자꾸 이런저런 시도를 하다보니 난장판인데 만지기 싫음...
            let longSideText, shortSideText;
            let longSideIndex, longSideCount, longSideTokens;
            let shortSideIndex, shortSideTokens;
            let longSidePos, longSideLen;
            let shortSidePos, shortSideLen;
            let longSideBeforeAnchorPos, shortSideBeforeAnchorPos;
            let longSideAfterAnchorPos, shortSideAfterAnchorPos;
            let longSideTokenStart, longSideTokenEnd;
            let shortSideBeforeToken, shortSideAfterToken;
            if (leftCount > 0) {
                type = 1; // 1: left
                longSideText = leftText;
                longSideTokens = leftTokens;
                longSideIndex = leftIndex;
                longSideCount = leftCount;
                shortSideText = rightText;
                shortSideTokens = rightTokens;
                shortSideIndex = rightIndex;
                leftEmpty = false;
                rightEmpty = true;
            }
            else {
                type = 2; // 2: right
                longSideText = rightText;
                longSideTokens = rightTokens;
                longSideIndex = rightIndex;
                longSideCount = rightCount;
                shortSideText = leftText;
                shortSideTokens = leftTokens;
                shortSideIndex = leftIndex;
                leftEmpty = true;
                rightEmpty = false;
            }
            longSideTokenStart = longSideTokens[longSideIndex];
            longSideTokenEnd = longSideTokens[longSideIndex + longSideCount - 1];
            shortSideBeforeToken = shortSideTokens[shortSideIndex - 1];
            shortSideAfterToken = shortSideTokens[shortSideIndex];
            longSidePos = longSideTokenStart.pos;
            longSideLen = longSideTokenEnd.pos + longSideTokenEnd.len - longSidePos;
            shortSidePos = shortSideBeforeToken ? shortSideBeforeToken.pos + shortSideBeforeToken.len : 0;
            shortSideLen = 0;
            const longSideIsFirstWord = longSideTokenStart.flags & FIRST_OF_LINE;
            const longSideIsLastWord = longSideTokenEnd.flags & LAST_OF_LINE;
            const shortSideIsOnLineEdge = shortSideTokens.length === 0 ||
                (shortSideBeforeToken && shortSideBeforeToken.flags & LAST_OF_LINE) ||
                (shortSideAfterToken && shortSideAfterToken.flags & FIRST_OF_LINE);
            // base pos는 되도록이면 앞쪽으로 잡자. 난데없이 빈줄 10개 스킵하고 diff가 시작되면 이상하자나.
            if (shortSideIsOnLineEdge) {
                // 줄의 경계에 empty diff를 표시하는 경우 현재 줄의 끝이나 다음 줄의 시작 중 "적절하게" 선택. 현재 줄의 끝(이전 토큰의 뒤)에 위치 중임.
                if (longSideIsFirstWord) {
                    if (shortSidePos !== 0) {
                        // pos가 0이 아닌 경우는 이전 토큰의 뒤로 위치를 잡은 경우니까 다음 줄바꿈을 찾아서 그 줄바꿈 뒤로 밀어줌
                        // 주의: 현재 위치 이후에 줄바꿈이 있는지 없는지 확인하기보다는 원본 텍스트의 마지막에 줄바꿈이 없는 경우 강제로 줄바꿈을 붙여주는게 편함.
                        // 잊지말고 꼭 원본텍스트의 끝에 줄바꿈 하나 붙일 것.
                        // const maxPos = shortSideAfterToken ? shortSideAfterToken.pos - 1 : shortSideText.length - 1;
                        // while (shortSidePos < maxPos && shortSideText[shortSidePos++] !== "\n");
                        while (shortSideText[shortSidePos++] !== "\n")
                            ;
                    }
                    // 양쪽 모두 줄의 시작 부분에 위치하므로 앵커 추가.
                    // 빈 diff가 줄 시작이나 줄 끝 위치에 있다면 하나의 줄로 표시되게 할 수 있음(css 사용)
                    longSideBeforeAnchorPos = longSidePos;
                    shortSideBeforeAnchorPos = shortSidePos;
                    if (longSideIsLastWord) {
                        longSideAfterAnchorPos = longSidePos + longSideLen;
                        shortSideAfterAnchorPos = shortSidePos;
                    }
                }
            }
            if (leftCount > 0) {
                leftPos = longSidePos;
                leftLen = longSideLen;
                leftEmpty = false;
                leftBeforeAnchorPos = longSideBeforeAnchorPos;
                leftAfterAnchorPos = longSideAfterAnchorPos;
                rightPos = shortSidePos;
                rightLen = shortSideLen;
                rightEmpty = true;
                rightBeforeAnchorPos = shortSideBeforeAnchorPos;
                rightAfterAnchorPos = shortSideAfterAnchorPos;
            }
            else {
                leftPos = shortSidePos;
                leftLen = shortSideLen;
                leftEmpty = true;
                leftBeforeAnchorPos = shortSideBeforeAnchorPos;
                leftAfterAnchorPos = shortSideAfterAnchorPos;
                rightPos = longSidePos;
                rightLen = longSideLen;
                rightEmpty = false;
                rightBeforeAnchorPos = longSideBeforeAnchorPos;
                rightAfterAnchorPos = longSideAfterAnchorPos;
            }
        }
        if (leftBeforeAnchorPos !== undefined && rightBeforeAnchorPos !== undefined) {
            addAnchor("before", leftBeforeAnchorPos, rightBeforeAnchorPos, diffs.length);
        }
        if (leftAfterAnchorPos !== undefined && rightAfterAnchorPos !== undefined) {
            addAnchor("after", leftAfterAnchorPos, rightAfterAnchorPos, diffs.length);
        }
        const newEntry = {
            type: type,
            left: {
                pos: leftPos,
                len: leftLen,
                empty: leftEmpty,
            },
            right: {
                pos: rightPos,
                len: rightLen,
                empty: rightEmpty,
            },
        };
        diffs.push(newEntry);
    }
    // console.log("postProcess", "final diffs:", diffs, anchors);
    return { diffs, anchors, leftTokenCount: leftTokens.length, rightTokenCount: rightTokens.length };
}
//# sourceMappingURL=worker.js.map