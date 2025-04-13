declare type Token = {
	pos: number;
	len: number;
	text: string;
	lineNum: number;
	flags: number;
};

declare type DiffEntrySide = {
	pos: number;
	len: number;
	empty?: boolean;
};

declare type DiffType = 0 | 1 | 2 | 3;

declare type DiffEntry = {
	type: DiffType;
	left: DiffEntrySide;
	right: DiffEntrySide;
};

declare type AnchorType = "before" | "after";

declare type Anchor = {
	type: AnchorType;
	left: number;
	right: number;
	diffIndex: number | null;
};

declare type WhitespaceHandling = "ignore" | "normalize";

declare type DiffAlgorithm = "lcs" | "myers" | "histogram";

// declare const TOKENIZE_BY_CHAR: 1;
// declare const TOKENIZE_BY_WORD: 2;
// declare const TOKENIZE_BY_LINE: 3;
declare type TokenizationMode = "char" | "word" | "line";

declare type DiffOptions = {
	algorithm: DiffAlgorithm;
	tokenization: TokenizationMode;
	whitespace: WhitespaceHandling;

	greedyMatch?: boolean;
	useLengthBias?: boolean;
	maxGram: number;
};

declare type DiffRequest = {
	type: "diff";
	reqId: number;
	leftText: string;
	rightText: string;
	// leftTokens: Token[];
	// rightTokens: Token[];
	options: DiffOptions;
};

declare type DiffResponse = {
	type: "diff";
	reqId: number;
	diffs: DiffEntry[];
	anchors: Anchor[];
};

declare type TokenMatchEntry = {
	leftIndex: number;
	leftCount: number;
	rightIndex: number;
	rightCount: number;
};

declare type TextProperties = {
	pos: number;
	color: string | null;
	supsub: "SUP" | "SUB" | null; // not implemented yet
};

type TextRun = {
	type: "CHARS" | "MODIFIER" | "DIFF" | "DIFF_END" | "ANCHOR" | "LINEBREAK" | "END_OF_STRING";
	pos: number;
	len: number;
	diffIndex: number | null;
	anchorIndex: number | null;
	props: TextProperties | null;
};