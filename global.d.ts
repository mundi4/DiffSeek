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
	options: DiffOptions;
};

declare type DiffResult = {
	diffs: DiffEntry[];
	anchors: Anchor[];
};
