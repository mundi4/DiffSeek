"use strict";
const MANUAL_ANCHOR1 = "@@@";
const MANUAL_ANCHOR2 = "###";
const TOKEN_CACHE_SIZE = 2;
// token flags
const FIRST_OF_LINE = 1;
const LAST_OF_LINE = 2;
const WILD_CARD = 16;
const NORMALIZE = 32; // &middot;, 따옴표 -, 말머리문자 등등 실제로 문자 코드는 다르지만 같다고 처리해야 할 문자들이 있다.
const SPACE_CHARS = {
    " ": true,
    "\t": true,
    "\n": true,
    "\r": true, // 글쎄...
    "\f": true, // 이것들은...
    "\v": true, // 볼일이 없을것...
};
const normalizeChars = {};
let _nextWork = null;
let _currentWork = null;
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
const Trie = createTrie();
Trie.insert("(추가)", WILD_CARD);
Trie.insert("(삭제)", WILD_CARD);
Trie.insert("(신설)", WILD_CARD);
Trie.insert("(생략)", WILD_CARD);
Trie.insert("(현행과같음)", WILD_CARD);
const TrieRoot = Trie.root;
const WildcardNode = Trie.root.next("(");
self.onmessage = (e) => {
    if (e.data.type === "diff") {
        const work = {
            reqId: e.data.reqId,
            leftText: e.data.leftText,
            rightText: e.data.rightText,
            options: e.data.options,
            cancel: false,
            start: 0,
            finish: 0,
            lastYield: 0,
            entries: [],
            states: {},
        };
        if (_currentWork) {
            _currentWork.cancel = true;
            _nextWork = work;
            return;
        }
        runDiff(work);
    }
    else if (e.data.type === "normalizeChars") {
        registerNormalizeChar(e.data.chars);
        // } else if (e.data.type === "option") {
        // 	if (e.data.key === "greedyMatch") {
        // 		greedyMatch = e.data.value;
        // 	}
    }
};
async function runDiff(work) {
    _currentWork = work;
    // const leftText = decoder.decode(work.left);
    // const rightText = decoder.decode(work.right);
    // const leftText = work.left;
    // const rightText = work.right;
    try {
        work.lastYield = work.start = performance.now();
        self.postMessage({
            reqId: work.reqId,
            type: "start",
            start: work.start,
        });
        console.log("algo:", work.options.algorithm);
        let results;
        console.log(work.options);
        if (work.options.algorithm === "histogram") {
            results = await runHistogramDiff(work);
        }
        else if (work.options.algorithm === "myers") {
            results = await runMyersDiff(work);
        }
        else if (work.options.algorithm === "lcs") {
            results = await runLcsDiff(work);
        }
        else {
            throw new Error("Unknown algorithm: " + work.options.algorithm);
        }
        work.finish = performance.now();
        //console.log("Elapsed time:", work.finish - work.start);
        _currentWork = null;
        if (results) {
            self.postMessage({
                reqId: work.reqId,
                type: "diffs",
                diffs: results.diffs,
                anchors: results.anchors,
            });
        }
        else {
            // console.debug("Diff canceled");
        }
    }
    catch (e) {
        if (e instanceof Error && e.message === "cancelled") {
            // console.debug("Diff canceled");
        }
        else {
            console.error(e);
        }
    }
    [work, _nextWork] = [_nextWork, null];
    if (work) {
        return await runDiff(work);
    }
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
function tokenizeByChar(input, inputPos, inputEnd, baseLineNum, whitespaceMode = "ignore") {
    const tokens = [];
    let lineCount = 0;
    let flags = 0;
    if (inputPos === undefined) {
        inputPos = 0;
    }
    if (inputEnd === undefined) {
        inputEnd = input.length;
    }
    if (baseLineNum === undefined) {
        baseLineNum = 1;
    }
    for (let i = inputPos; i < inputEnd; i++) {
        const char = input[i];
        if (!SPACE_CHARS[char]) {
            if (char === "(") {
                let p = i + 1;
                let found = null;
                for (let node = WildcardNode; p < inputEnd && (node = node.next(input[p++])) !== null;) {
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
                        lineNum: baseLineNum + lineCount,
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
                lineNum: baseLineNum + lineCount,
                flags,
            });
            flags = 0;
        }
        if (char === "\n") {
            lineCount++;
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
    //console.log("tokenizeByChar", tokens);
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
function tokenizeByWord(input, inputPos, inputEnd, baseLineNum, whitespaceMode = "ignore") {
    const tokens = [];
    let currentStart = -1;
    let lineCount = 0;
    let flags = 0;
    if (inputPos === undefined) {
        inputPos = 0;
    }
    if (inputEnd === undefined) {
        inputEnd = input.length;
    }
    if (baseLineNum === undefined) {
        baseLineNum = 1;
    }
    for (let i = inputPos; i < inputEnd; i++) {
        let char = input[i];
        // 문장부호를 별개로 단어로 분리하는 방법도 생각해볼 필요가 있음.
        // 문제는 (hello)와 (world)에서 '('만 매치되면 눈이 피곤해진다. 괄호안의 문자들이 여러줄이면 더더욱..
        if (SPACE_CHARS[char]) {
            if (currentStart !== -1) {
                flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
                tokens.push({
                    text: flags & NORMALIZE ? normalize(input.substring(currentStart, i)) : input.substring(currentStart, i),
                    pos: currentStart,
                    len: i - currentStart,
                    lineNum: baseLineNum + lineCount,
                    flags,
                });
                flags = 0;
                currentStart = -1;
            }
            if (char === "\n") {
                lineCount++;
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
                for (let node = WildcardNode; p < inputEnd && (node = node.next(input[p++])) !== null;) {
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
                            lineNum: baseLineNum + lineCount,
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
                        lineNum: baseLineNum + lineCount,
                        flags: flags | (found.flags || 0),
                    });
                    flags = 0;
                    i = p - 1;
                    continue;
                }
            }
            if (currentStart === -1) {
                currentStart = i;
            }
        }
    }
    if (currentStart !== -1) {
        flags |= tokens.length === 0 && checkIfFirstOfLine(input, currentStart) ? FIRST_OF_LINE : 0;
        tokens.push({
            text: flags & NORMALIZE ? normalize(input.substring(currentStart)) : input.substring(currentStart),
            pos: currentStart,
            len: inputEnd - currentStart,
            lineNum: baseLineNum + lineCount,
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
    //console.log("tokenizeByWord", tokens);
    return tokens;
}
function tokenizeByLine(input, inputPos, inputEnd, baseLineNum, whitespaceMode = "ignore") {
    const tokens = [];
    let currentStart = -1;
    let currentEnd = -1;
    let lineCount = 0;
    if (inputPos === undefined) {
        inputPos = 0;
    }
    if (inputEnd === undefined) {
        inputEnd = input.length;
    }
    if (baseLineNum === undefined) {
        baseLineNum = 1;
    }
    for (let i = inputPos; i < inputEnd; i++) {
        const char = input[i];
        if (char !== "\n") {
            if (!SPACE_CHARS[char]) {
                if (currentStart === -1) {
                    currentStart = i;
                }
                currentEnd = i + 1;
            }
        }
        else {
            if (currentStart !== -1) {
                tokens.push({
                    text: input.substring(currentStart, currentEnd).trim(),
                    pos: currentStart,
                    len: i - currentStart,
                    lineNum: baseLineNum + lineCount,
                    flags: FIRST_OF_LINE | LAST_OF_LINE,
                });
                currentStart = currentEnd = -1;
            }
            lineCount++;
        }
    }
    if (currentStart !== -1) {
        tokens.push({
            text: input.substring(currentStart, currentEnd).trim(),
            pos: currentStart,
            len: currentEnd - currentStart,
            lineNum: baseLineNum + lineCount,
            flags: FIRST_OF_LINE | LAST_OF_LINE,
        });
    }
    return tokens;
}
function tokenize(input, mode, inputPos, inputEnd, baseLineNum) {
    let cacheArr;
    if ((inputPos === undefined || inputPos === 0) && (inputEnd === undefined || inputEnd === input.length)) {
        cacheArr = tokenCache[mode];
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
    }
    let tokens;
    switch (mode) {
        case "char":
            tokens = tokenizeByChar(input, inputPos, inputEnd, baseLineNum);
            break;
        case "word":
            tokens = tokenizeByWord(input, inputPos, inputEnd, baseLineNum);
            break;
        case "line":
            tokens = tokenizeByLine(input, inputPos, inputEnd, baseLineNum);
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
async function runLcsDiff(ctx) {
    const leftText = ctx.leftText;
    const rightText = ctx.rightText;
    const leftTokens = tokenize(leftText, ctx.options.tokenization, 0, leftText.length, 1);
    const rightTokens = tokenize(rightText, ctx.options.tokenization, 0, rightText.length, 1);
    const entries = await computeDiff(leftTokens, rightTokens, ctx.options.greedyMatch, ctx);
    const result = postProcess(ctx, entries, leftText, leftTokens, rightText, rightTokens);
    //postProcess(entries, leftText, rightText, leftInputPos, leftInputEnd, rightInputPos, rightInputEnd, work.options.tokenization);
    return result;
}
// 정들었던 diff 함수. 곧 떠나보낸다... ㅋ
async function computeDiff(lhsTokens, rhsTokens, greedyMatch = false, ctx) {
    //console.log("computeDiff", { leftText, rightText, leftInputPos, leftInputEnd, rightInputPos, rightInputEnd, method, greedyMatch, useFallback });
    // 앵커라는 이름도 구현 방식도 사실 좀 마음에 안들지만
    // 양쪽 텍스트에서 공통 부분(diff가 아닌 부분)을 서로 대응시킬 만한 딱히 좋은 수가 없음
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
    // console.log("matchTokensBackward", leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper);
    let i = lhsUpper - 1, // Start from the last token of lhs
    j = rhsUpper - 1; // Start from the last token of rhs
    let ci = leftTokens[i].text.length - 1, // Start from the last character of the last token of lhs
    cj = rightTokens[j].text.length - 1; // Start from the last character of the last token of rhs
    const llen = lhsLower;
    const rlen = rhsLower;
    OUTER: while (i >= llen && j >= rlen) {
        const ltext = leftTokens[i].text;
        const rtext = rightTokens[j].text;
        while (ci >= 0 && cj >= 0) {
            if (ltext[ci--] !== rtext[cj--]) {
                // console.log("false", JSON.stringify(ltext), JSON.stringify(rtext), i, lhsUpper, j, rhsUpper, ci, cj);
                break OUTER;
            }
        }
        // If both ci and cj are -1, we know we've exhausted the tokens
        if (ci === -1 && cj === -1) {
            // console.log("true", lhsUpper - i + 1, rhsUpper - j + 1, leftTokens[i], rightTokens[j]);
            return [lhsUpper - i, rhsUpper - j]; // +1 to account for the initial token
        }
        if (ci < 0) {
            i--; // Move to the previous token on the left
            if (i >= llen)
                ci = leftTokens[i].text.length - 1;
        }
        if (cj < 0) {
            j--; // Move to the previous token on the right
            if (j >= rlen)
                cj = rightTokens[j].text.length - 1;
        }
    }
    // console.log("false")
    return false;
}
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
                if (vectorUp[offset_up + k] <= vectorDown[offset_down + k]) {
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
                if (vectorUp[offset_up + k] <= vectorDown[offset_down + k]) {
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
function postProcess(ctx, entries, leftText, leftTokens, rightText, rightTokens) {
    console.log("postProcess", "raw entries:", Array.from(entries), leftTokens, rightTokens);
    let prevEntry = null;
    const diffs = [];
    const anchors = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
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
            }
            prevEntry = null;
            const leftToken = leftTokens[entry.left.pos];
            const rightToken = rightTokens[entry.right.pos];
            if (leftToken.flags & rightToken.flags & FIRST_OF_LINE) {
                // 앵커 추가
                addAnchor("before", leftToken.pos, rightToken.pos, null);
            }
        }
    }
    if (prevEntry) {
        console.log(prevEntry);
        addDiff(prevEntry.left.pos, prevEntry.left.len, prevEntry.right.pos, prevEntry.right.len);
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
        if (leftCount > 0 && rightCount > 0) {
            type = 3; // 3: both
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
            if ((leftTokenStart.flags | rightTokenStart.flags) & FIRST_OF_LINE) {
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
                    // 줄바꿈 문자 위치까지 스킵
                    if (leftText[leftBeforeAnchorPos] !== "\n") {
                        do {
                            leftBeforeAnchorPos++;
                        } while (leftBeforeAnchorPos < leftText.length && leftText[leftBeforeAnchorPos] !== "\n");
                    }
                    if (rightText[rightBeforeAnchorPos] !== "\n") {
                        do {
                            rightBeforeAnchorPos++;
                        } while (rightBeforeAnchorPos < rightText.length && rightText[rightBeforeAnchorPos] !== "\n");
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
                (shortSideBeforeToken && shortSideBeforeToken.flags & FIRST_OF_LINE) ||
                (shortSideAfterToken && shortSideAfterToken.flags & FIRST_OF_LINE);
            // base pos는 되도록이면 앞쪽으로 잡자. 난데없이 빈줄 10개 스킵하고 diff가 시작되면 이상하자나.
            if (shortSideIsOnLineEdge) {
                // 줄의 경계에 empty diff를 표시하는 경우 현재 줄의 끝이나 다음 줄의 시작 중 "적절하게" 선택. 현재 줄의 끝(이전 토큰의 뒤)에 위치 중임.
                if (longSideIsFirstWord) {
                    if (shortSidePos !== 0) {
                        // pos가 0이 아닌 경우는 이전 토큰의 뒤로 위치를 잡은 경우니까 다음 줄바꿈을 찾아서 그 줄바꿈 뒤로 밀어줌
                        // 주의: 줄바꿈이 있는지 없는지 확인하기보다는 원본 텍스트의 마지막에 줄바꿈이 없는 경우 강제로 줄바꿈을 붙여주는게 편함. 잊지말고 꼭 붙일 것.
                        while (shortSideText[shortSidePos++] !== "\n")
                            ;
                    }
                    // 양쪽 모두 줄의 시작 부분에 위치하므로 앵커를 추가하기에 좋은 날씨
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
        diffs.push({
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
        });
    }
    console.log("postProcess", "final diffs:", diffs, anchors);
    return { diffs, anchors };
    // return entries;
}
async function runMyersDiff(ctx) {
    const leftText = ctx.leftText;
    const rightText = ctx.rightText;
    const leftTokens = tokenize(leftText, ctx.options.tokenization);
    const rightTokens = tokenize(rightText, ctx.options.tokenization);
    const vectorSize = (leftTokens.length + rightTokens.length + 1) * 2;
    const vectorDown = new Array(vectorSize);
    const vectorUp = new Array(vectorSize);
    ctx.states.vectorDown = vectorDown;
    ctx.states.vectorUp = vectorUp;
    const diffs = await diffCore(leftTokens, 0, leftTokens.length, rightTokens, 0, rightTokens.length, ctx, findMiddleSnake);
    return postProcess(ctx, diffs, leftText, leftTokens, rightText, rightTokens);
}
function findBestHistogramAnchor(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, ctx) {
    const useLengthBias = !!ctx.options.useLengthBias;
    const maxGram = ctx.options.maxGram || 1;
    const useMatchPrefix = ctx.options.whitespace === "ignore";
    const maxLen = useMatchPrefix ? Math.floor(maxGram * 1.5) : maxGram;
    const delimiter = ctx.options.whitespace === "ignore" ? "" : "\u0000";
    const UNIQUE_BONUS = 0.5;
    const LINE_START_BONUS = 0.9;
    const LINE_END_BONUS = 0.95;
    const FULL_LINE_BONUS = 0.75;
    const freq = {};
    for (let n = 1; n <= maxGram; n++) {
        for (let i = lhsLower; i <= lhsUpper - n; i++) {
            let key = "";
            for (let k = 0; k < n; k++) {
                key += lhsTokens[i + k].text;
            }
            freq[key] = (freq[key] || 0) + 1;
        }
        for (let i = rhsLower; i <= rhsUpper - n; i++) {
            let key = "";
            for (let k = 0; k < n; k++) {
                key += rhsTokens[i + k].text;
            }
            freq[key] = (freq[key] || 0) + 1;
        }
    }
    let best = null;
    for (let i = lhsLower; i < lhsUpper; i++) {
        const ltext1 = lhsTokens[i].text;
        // 특수 케이스
        // 강제로 문서의 특정 지점끼리 매칭시킴. 문서 구조가 항상 내 맘 같은 것이 아니야. ㅠ
        if (ltext1 === MANUAL_ANCHOR1 || ltext1 === MANUAL_ANCHOR2) {
            for (let j = rhsLower; j < rhsUpper; j++) {
                if (rhsTokens[j].text === ltext1) {
                    return {
                        lhsIndex: i,
                        lhsLength: 1,
                        rhsIndex: j,
                        rhsLength: 1,
                    };
                }
            }
        }
        for (let j = rhsLower; j < rhsUpper; j++) {
            const rtext1 = rhsTokens[j].text;
            let li = i, ri = j;
            let lhsLen = 0, rhsLen = 0;
            while (li < lhsUpper && ri < rhsUpper && lhsLen < maxLen && rhsLen < maxLen) {
                const ltext = lhsTokens[li].text;
                const rtext = rhsTokens[ri].text;
                if (ltext === rtext) {
                    li++;
                    ri++;
                    lhsLen++;
                    rhsLen++;
                    continue;
                }
                if (useMatchPrefix && ltext1.length !== rtext1.length && ltext[0] === rtext[0]) {
                    const match = matchPrefixTokens(lhsTokens, li, lhsUpper, rhsTokens, ri, rhsUpper);
                    if (match) {
                        if (lhsLen + match[0] <= maxLen && rhsLen + match[1] <= maxLen) {
                            li += match[0];
                            ri += match[1];
                            lhsLen += match[0];
                            rhsLen += match[1];
                            continue;
                        }
                    }
                }
                break;
            }
            if (lhsLen > 0 && rhsLen > 0) {
                let score = 0;
                if (lhsLen === 1) {
                    score = freq[ltext1] || 1;
                    if (useLengthBias) {
                        score += 1 / (ltext1.length + 1);
                    }
                }
                else {
                    let key = lhsTokens[i].text;
                    let len = key.length;
                    for (let k = 1; k < lhsLen; k++) {
                        const text = lhsTokens[i + k].text;
                        key += delimiter + text;
                        len += text.length;
                    }
                    // score = (freq[key] || 1) / ((lhsLen + 1) * (len + 1));
                    // score = (freq[key] || 1) / (lhsLen * len + 1);
                    score = (freq[key] || 1) / (len + 1);
                    if (freq[key] === 1) {
                        score *= UNIQUE_BONUS;
                    }
                    if (lhsTokens[i].flags & FIRST_OF_LINE &&
                        rhsTokens[j].flags & FIRST_OF_LINE &&
                        lhsTokens[i + lhsLen - 1].flags & LAST_OF_LINE &&
                        rhsTokens[j + rhsLen - 1].flags & LAST_OF_LINE) {
                        score *= FULL_LINE_BONUS;
                    }
                    else {
                        if (lhsTokens[i].flags & FIRST_OF_LINE && rhsTokens[j].flags & FIRST_OF_LINE) {
                            score *= LINE_START_BONUS;
                        }
                        if (lhsTokens[i + lhsLen - 1].flags & LAST_OF_LINE && rhsTokens[j + rhsLen - 1].flags & LAST_OF_LINE) {
                            score *= LINE_END_BONUS;
                        }
                    }
                }
                if (!best || score < best.score) {
                    best = {
                        lhsIndex: i,
                        lhsLength: lhsLen,
                        rhsIndex: j,
                        rhsLength: rhsLen,
                        score,
                    };
                }
            }
        }
    }
    return best ?? null;
}
// 양쪽에서 공통된 토큰 1개의 쌍을 찾는게 아니라 n,m개의 쌍을 찾는 것을 생각해보자.
// 1개짜리 토큰 앵커보다 더 좋은 기준점이 될 수 있음.
function findBestHistogramAnchorz(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, ctx) {
    const useLengthBias = !!ctx.options.useLengthBias;
    const maxGram = 5; //ctx.options.maxGram || 1;
    const freq = {};
    for (let i = lhsLower; i < lhsUpper; i++) {
        const key = lhsTokens[i].text;
        freq[key] = (freq[key] || 0) + 1;
    }
    for (let i = rhsLower; i < rhsUpper; i++) {
        const key = rhsTokens[i].text;
        freq[key] = (freq[key] || 0) + 1;
    }
    let best = null;
    outer: for (let i = lhsLower; i < lhsUpper; i++) {
        const ltext1 = lhsTokens[i].text;
        for (let j = rhsLower; j < rhsUpper; j++) {
            const rtext1 = rhsTokens[j].text;
            let li = i, ri = j;
            let lhsLen = 0, rhsLen = 0;
            while (li < lhsUpper && ri < rhsUpper && Math.min(lhsLen, rhsLen) < maxGram) {
                const ltext = lhsTokens[li].text;
                const rtext = rhsTokens[ri].text;
                if (ltext === rtext) {
                    li++;
                    ri++;
                    lhsLen++;
                    rhsLen++;
                    continue;
                }
                const match = matchPrefixTokens(lhsTokens, li, lhsUpper, rhsTokens, ri, rhsUpper);
                if (match) {
                    const grow = Math.min(match[0], match[1]);
                    if (Math.min(lhsLen + grow, rhsLen + grow) <= maxGram) {
                        li += match[0];
                        ri += match[1];
                        lhsLen += match[0];
                        rhsLen += match[1];
                        continue;
                    }
                }
                break;
            }
            if (lhsLen > 0 && rhsLen > 0) {
                let score = 0;
                if (lhsLen === 1) {
                    score = freq[ltext1] || 1;
                    if (useLengthBias) {
                        score += 1 / (ltext1.length + 1);
                    }
                }
                else {
                    let len = 0;
                    let key = "";
                    for (let k = 0; k < lhsLen; k++) {
                        const text = lhsTokens[i + k].text;
                        key += (k > 0 ? "\u0000" : "") + text;
                        len += text.length;
                    }
                    score = freq[key] || 1;
                    if (useLengthBias) {
                        score += 1 / (len + 1);
                    }
                }
                if (!best || score < best.score) {
                    best = {
                        lhsIndex: i,
                        lhsLength: lhsLen,
                        rhsIndex: j,
                        rhsLength: rhsLen,
                        score,
                    };
                }
            }
        }
    }
    return best ?? null;
}
function zfindBestHistogramAnchor(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, ctx) {
    const useLengthBias = !!ctx.options.useLengthBias;
    const freq = {};
    for (let i = lhsLower; i < lhsUpper; i++) {
        const key = lhsTokens[i].text;
        freq[key] = (freq[key] || 0) + 1;
    }
    for (let i = rhsLower; i < rhsUpper; i++) {
        const key = rhsTokens[i].text;
        freq[key] = (freq[key] || 0) + 1;
    }
    const rhsMap = new Map();
    for (let i = rhsLower; i < rhsUpper; i++) {
        const key = rhsTokens[i].text;
        if (!rhsMap.has(key))
            rhsMap.set(key, []);
        rhsMap.get(key).push(i);
    }
    let best = null;
    for (let i = lhsLower; i < lhsUpper; i++) {
        const key = lhsTokens[i].text;
        if (!rhsMap.has(key))
            continue;
        let score = freq[key];
        if (useLengthBias) {
            score += 1 / (key.length + 1);
        }
        if (!best || score < best.score) {
            best = {
                lhsIndex: i,
                lhsLength: 1,
                rhsIndex: rhsMap.get(key)[0],
                rhsLength: 1,
                token: lhsTokens[i],
                score,
            };
        }
    }
    return best ?? null;
}
async function runHistogramDiff(ctx) {
    const leftText = ctx.leftText;
    const rightText = ctx.rightText;
    const leftTokens = tokenize(leftText, ctx.options.tokenization);
    const rightTokens = tokenize(rightText, ctx.options.tokenization);
    ctx.states.entries = [];
    let lhsLower = 0;
    let lhsUpper = leftTokens.length;
    let rhsLower = 0;
    let rhsUpper = rightTokens.length;
    const entries = await diffCore(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx, findBestHistogramAnchor);
    return postProcess(ctx, entries, leftText, leftTokens, rightText, rightTokens);
}
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
async function diffCore(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx, findAnchor) {
    const results = ctx.entries;
    if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
        throw new Error("Invalid range");
    }
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
    let skippedHead;
    let skippedTail;
    console.log("BEFORE CONSUME", lhsLower, lhsUpper, rhsLower, rhsUpper);
    [lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(leftTokens, rightTokens, lhsLower, lhsUpper, rhsLower, rhsUpper, ctx.options.whitespace);
    results.push(...skippedHead);
    // 2. 종료 조건
    if (lhsLower === lhsUpper || rhsLower === rhsUpper) {
        if (lhsLower !== lhsUpper || rhsLower !== rhsUpper) {
            results.push({
                type: lhsLower === lhsUpper ? 2 : 1,
                left: {
                    pos: lhsLower,
                    len: lhsUpper - lhsLower,
                },
                right: {
                    pos: rhsLower,
                    len: rhsUpper - rhsLower,
                },
            });
            console.log(results[results.length - 1]);
        }
        results.push(...skippedTail);
        return results;
    }
    // TODO 리턴 시그니처 바꾸기
    // 단순의 왼쪽,오른쪽 토큰 배열의 위치가 아니라 위치와 함께 길이까지 리턴(여러개의 토큰 매치 허용)
    // 그렇게 할 경우 그 앵커 영역이 대해서는 consume되지 않게 직접 그 영역을 잘라내고 재귀호출을 해야함
    // 첫번째 재귀호출 이후에 앵커영역을을 entries에 추가한 뒤 두번째 재귀호출 해야할 듯? 그래야 순서대로 딱딱 붙는다.
    const anchor = findAnchor(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx);
    console.log("anchor:", anchor, lhsLower, lhsUpper, rhsLower, rhsUpper);
    // 무한루프 위험.
    // 조건을 제대로 생각해보자.
    if (!anchor ||
        anchor.lhsIndex < lhsLower ||
        anchor.lhsIndex + anchor.lhsLength > lhsUpper ||
        anchor.rhsIndex < rhsLower ||
        anchor.rhsIndex + anchor.rhsLength > rhsUpper) {
        let type = 0;
        if (lhsUpper > lhsLower)
            type |= 1;
        if (rhsUpper > rhsLower)
            type |= 2;
        console.assert(type !== 0, "anchor not found", type, lhsLower, lhsUpper, rhsLower, rhsUpper, anchor);
        results.push({
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
        results.push(...skippedTail);
        return results;
    }
    await diffCore(leftTokens, lhsLower, anchor.lhsIndex, rightTokens, rhsLower, anchor.rhsIndex, ctx, findAnchor);
    // add anchor as common
    results.push({
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
    await diffCore(leftTokens, anchor.lhsIndex + anchor.lhsLength, lhsUpper, rightTokens, anchor.rhsIndex + anchor.rhsLength, rhsUpper, ctx, findAnchor);
    results.push(...skippedTail);
    return results;
}
//# sourceMappingURL=worker.js.map