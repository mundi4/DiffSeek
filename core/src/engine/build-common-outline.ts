import { TOKEN_BUFFER_STRIDE } from "../constants";
import { headingFlagsToType } from "../constants/section-heading";
import { HEADING_MASK, TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_LINE_END, type Token } from "../tokenization";
import type { CommonOutlineHeading } from "./types";

type BuildCommonOutlineParams = {
	leftWholeText: string;
	rightWholeText: string;
	leftTokens: readonly Token[];
	rightTokens: readonly Token[];
	leftResultBuffer: Readonly<Int32Array>;
};

type HeadingPair = {
	leftIndex: number;
	rightIndex: number;
};

function getTokenText(wholeText: string, token: Token): string {
	return wholeText.slice(token.textOffset, token.textOffset + token.textLength);
}

function collectHeadingLineText(wholeText: string, tokens: readonly Token[], headingTokenIndex: number): string {
	let result = "";
	for (let i = headingTokenIndex; i < tokens.length; i++) {
		const token = tokens[i];
		result += getTokenText(wholeText, token);

		const flags = token.flags;
		if ((flags & TOKEN_FLAGS_LINE_END) !== 0) {
			break;
		}
		if ((flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE) !== 0) {
			result += " ";
		}
	}
	return result.trim();
}

export function buildCommonOutline(params: BuildCommonOutlineParams): CommonOutlineHeading[] {
	const { leftWholeText, rightWholeText, leftTokens, rightTokens, leftResultBuffer } = params;

	const headings: CommonOutlineHeading[] = [];

	for (let i = 0; i < leftTokens.length; i++) {
		const headingFlags = leftTokens[i].flags & HEADING_MASK;
		if (headingFlags !== 0) {
			const base = i * TOKEN_BUFFER_STRIDE;
			if (leftResultBuffer[base + 4] === 0) {
				const rightStart = leftResultBuffer[base + 2];
				if ((rightTokens[rightStart].flags & HEADING_MASK) === headingFlags) {
					headings.push({
						index: headings.length,
						leftTokenIndex: i,
						rightTokenIndex: rightStart,
						headingType: headingFlagsToType(headingFlags),
						leftLabel: collectHeadingLineText(leftWholeText, leftTokens, i),
						rightLabel: collectHeadingLineText(rightWholeText, rightTokens, rightStart),
					});
				}
			}
		}
	}

	return headings;
}
