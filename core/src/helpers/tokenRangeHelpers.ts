import { type Token, TokenType } from "../types";

export function SetStartEndFromTokenRange(range: Range, tokenRange: Token, ensureConnected = true) {
    if (tokenRange.type === TokenType.TEXT) {
        if (ensureConnected && (!tokenRange.startNode?.isConnected || !tokenRange.endNode?.isConnected)) {
            throw new Error("Token nodes are not connected to the document");
        }
        range.setStart(tokenRange.startNode!, tokenRange.startOffset);
        range.setEnd(tokenRange.endNode!, tokenRange.endOffset);
    } else {//if (tokenRange.type === TokenType.IMAGE) {
        if (ensureConnected && !tokenRange.startNode?.isConnected) {
            throw new Error("Token element is not connected to the document");
        }
        range.selectNode(tokenRange.startNode!);
        // } else {
        //     throw new Error("Unknown token range type");
    }
}

export function createRangeFromTokenRange(tokenRange: Token, ensureConnected = true): Range {
    const range = document.createRange();
    SetStartEndFromTokenRange(range, tokenRange, ensureConnected);
    return range;
}

export function setStartFromTokenRange(range: Range, tokenRange: Token, ensureConnected = true) {
    if (tokenRange.type === TokenType.TEXT) {
        if (ensureConnected && !tokenRange.startNode?.isConnected) {
            throw new Error("Token start node is not connected to the document");
        }
        range.setStart(tokenRange.startNode!, tokenRange.startOffset);
    } else {//if (tokenRange.type === TokenType.IMAGE) {
        if (ensureConnected && !tokenRange.startNode?.isConnected) {
            throw new Error("Token element is not connected to the document");
        }
        range.setStartBefore(tokenRange.startNode!);
        // } else {
        //     throw new Error("Unknown token range type");
    }
}

export function setEndFromTokenRange(range: Range, tokenRange: Token, ensureConnected = true) {
    if (tokenRange.type === TokenType.TEXT) {
        if (ensureConnected && !tokenRange.endNode?.isConnected) {
            throw new Error("Token end node is not connected to the document");
        }
        range.setEnd(tokenRange.endNode!, tokenRange.endOffset);
    } else {//if (tokenRange.type === TokenType.IMAGE) {
        if (ensureConnected && !tokenRange.startNode?.isConnected) {
            throw new Error("Token element is not connected to the document");
        }
        range.setEndAfter(tokenRange.startNode!);
        // } else {
        //     throw new Error("Unknown token range type");
    }
}

export function createRangeFromTwoTokens(startToken: Token, endToken: Token): Range {
    const range = document.createRange();
    setStartFromTokenRange(range, startToken);
    setEndFromTokenRange(range, endToken);
    return range;
}

function setRangeBoundary(
    range: Range,
    tokenRange: Token,
    boundary: "start" | "end",
    position: "before" | "after",
    ensureConnected = true
) {
    if (tokenRange.type === TokenType.TEXT) {
        const node = position === "before" ? tokenRange.startNode : tokenRange.endNode;
        const offset = position === "before" ? tokenRange.startOffset : tokenRange.endOffset;
        if (ensureConnected && !node?.isConnected) {
            throw new Error(`Token ${boundary} node is not connected to the document`);
        }
        if (boundary === "start") {
            range.setStart(node!, offset);
        } else {
            range.setEnd(node!, offset);
        }
    } else {//if (tokenRange.type === TokenType.IMAGE) {
        if (ensureConnected && !tokenRange.startNode?.isConnected) {
            throw new Error("Token element is not connected to the document");
        }
        const fn =
            boundary === "start"
                ? position === "before"
                    ? range.setStartBefore
                    : range.setStartAfter
                : position === "before"
                    ? range.setEndBefore
                    : range.setEndAfter;
        fn.call(range, tokenRange.startNode!);
        // } else {
        //     throw new Error(`Unknown token range type: '${tokenRange.type}'`);
    }
}

// 기존 함수 대체
export function setStartBeforeToken(range: Range, tokenRange: Token, ensureConnected = true) {
    setRangeBoundary(range, tokenRange, "start", "before", ensureConnected);
}
export function setStartAfterToken(range: Range, tokenRange: Token, ensureConnected = true) {
    setRangeBoundary(range, tokenRange, "start", "after", ensureConnected);
}
export function setEndBeforeToken(range: Range, tokenRange: Token, ensureConnected = true) {
    setRangeBoundary(range, tokenRange, "end", "before", ensureConnected);
}
export function setEndAfterToken(range: Range, tokenRange: Token, ensureConnected = true) {
    setRangeBoundary(range, tokenRange, "end", "after", ensureConnected);
}