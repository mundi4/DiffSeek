import { TokenRangeType, type RichToken, type TokenRange } from "../tokenization/TokenizeContext";

export function SetStartEndFromTokenRange(range: Range, tokenRange: TokenRange, ensureConnected = true) {
	if (tokenRange.type === TokenRangeType.TEXT) {
		if (ensureConnected && (!tokenRange.node.isConnected || !tokenRange.endNode.isConnected)) {
			throw new Error("Token nodes are not connected to the document");
		}
		range.setStart(tokenRange.node, tokenRange.offset);
		range.setEnd(tokenRange.endNode, tokenRange.endOffset);
	} else if (tokenRange.type === TokenRangeType.ELEMENT) {
		if (ensureConnected && !tokenRange.node.isConnected) {
			throw new Error("Token element is not connected to the document");
		}
		range.selectNode(tokenRange.node);
	} else {
		throw new Error("Unknown token range type");
	}
}

export function createRangeFromTokenRange(tokenRange: TokenRange, ensureConnected = true): Range {
	const range = document.createRange();
	SetStartEndFromTokenRange(range, tokenRange, ensureConnected);
	return range;
}

export function setStartFromTokenRange(range: Range, tokenRange: TokenRange, ensureConnected = true) {
	if (tokenRange.type === TokenRangeType.TEXT) {
		if (ensureConnected && !tokenRange.node.isConnected) {
			throw new Error("Token start node is not connected to the document");
		}
		range.setStart(tokenRange.node, tokenRange.offset);
	} else if (tokenRange.type === TokenRangeType.ELEMENT) {
		if (ensureConnected && !tokenRange.node.isConnected) {
			throw new Error("Token element is not connected to the document");
		}
		range.setStartBefore(tokenRange.node);
	} else {
		throw new Error("Unknown token range type");
	}
}

export function setEndFromTokenRange(range: Range, tokenRange: TokenRange, ensureConnected = true) {
	if (tokenRange.type === TokenRangeType.TEXT) {
		if (ensureConnected && !tokenRange.endNode.isConnected) {
			throw new Error("Token end node is not connected to the document");
		}
		range.setEnd(tokenRange.endNode, tokenRange.endOffset);
	} else if (tokenRange.type === TokenRangeType.ELEMENT) {
		if (ensureConnected && !tokenRange.node.isConnected) {
			throw new Error("Token element is not connected to the document");
		}
		range.setEndAfter(tokenRange.node);
	} else {
		throw new Error("Unknown token range type");
	}
}

export function createRangeFromTwoTokens(startToken: RichToken, endToken: RichToken): Range {
	const range = document.createRange();
	setStartFromTokenRange(range, startToken.range);
	setEndFromTokenRange(range, endToken.range);
	return range;
}

function setRangeBoundary(
	range: Range,
	tokenRange: TokenRange,
	boundary: "start" | "end",
	position: "before" | "after",
	ensureConnected = true
) {
	if (tokenRange.type === TokenRangeType.TEXT) {
		const node = position === "before" ? tokenRange.node : tokenRange.endNode;
		const offset = position === "before" ? tokenRange.offset : tokenRange.endOffset;
		if (ensureConnected && !node.isConnected) {
			throw new Error(`Token ${boundary} node is not connected to the document`);
		}
		if (boundary === "start") {
			range.setStart(node, offset);
		} else {
			range.setEnd(node, offset);
		}
	} else if (tokenRange.type === TokenRangeType.ELEMENT) {
		if (ensureConnected && !tokenRange.node.isConnected) {
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
		fn.call(range, tokenRange.node);
	} else {
		throw new Error("Unknown token range type");
	}
}

// 기존 함수 대체
export function setStartBeforeToken(range: Range, tokenRange: TokenRange, ensureConnected = true) {
	setRangeBoundary(range, tokenRange, "start", "before", ensureConnected);
}
export function setStartAfterToken(range: Range, tokenRange: TokenRange, ensureConnected = true) {
	setRangeBoundary(range, tokenRange, "start", "after", ensureConnected);
}
export function setEndBeforeToken(range: Range, tokenRange: TokenRange, ensureConnected = true) {
	setRangeBoundary(range, tokenRange, "end", "before", ensureConnected);
}
export function setEndAfterToken(range: Range, tokenRange: TokenRange, ensureConnected = true) {
	setRangeBoundary(range, tokenRange, "end", "after", ensureConnected);
}