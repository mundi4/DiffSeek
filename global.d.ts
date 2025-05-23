declare type Token = {
	pos: number;
	len: number;
	text: string;
	lineNum: number;
	flags: number;
};

declare type EntrySide = {
	pos: number;
	len: number;
};

declare type DiffType = 0 | 1 | 2 | 3;

declare type DiffEntry = {
	type: DiffType;
	left: EntrySide;
	right: EntrySide;
	asBlock?: boolean;
};

declare type AnchorType = "before" | "after";

declare type Anchor = {
	type: AnchorType;
	left: number;
	right: number;
	diffIndex: number | null;
	leftLine: number;
	rightLine: number;
};

declare type WhitespaceHandling = "ignore" | "normalize";

declare type DiffAlgorithm = "lcs" | "histogram";

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

	lengthBiasFactor: number;
	sectionHeadingMultiplier: number;
	lineStartMultiplier: number;
	lineEndMultiplier: number;
	uniqueMultiplier: number;
};

declare type DiffRequest = {
	type: "diff";
	reqId: number;
	// leftText: string;
	// rightText: string;
	leftTokens: Token[];
	rightTokens: Token[];
	options: DiffOptions;
};

declare type DiffResponse = {
	type: "diff";
	reqId: number;
	diffs: DiffEntry[];
	// anchors: Anchor[];
	// leftTokenCount: number;
	// rightTokenCount: number;
	processTime: number;
};

declare type TokenMatchEntry = {
	leftIndex: number;
	leftCount: number;
	rightIndex: number;
	rightCount: number;
};

type TextRun = {
	type: "CHARS" | "DIFF" | "DIFF_END" | "ANCHOR" | "HEADING" | "HEADING_END" | "LINEBREAK" | "END_OF_STRING";
	pos: number;
	len: number;
	dataIndex: number | null;
};

declare type DiffContext = {
	reqId: number;
	leftText: string;
	rightText: string;
	diffOptions: DiffOptions;
	leftTokens?: Token[];
	rightTokens?: Token[];
	rawEntries?: DiffEntry[];
	diffs?: DiffEntry[];
	anchors?: Anchor[];
	headings?: SectionHeading[];
	done: boolean;
	processTime?: number;
};

type LineHint = {
	pos: number;
	len: number;
	empty: boolean;
	numConsecutiveBlankLines: number;
};

type OutputOptions = {
	leftLabel?: string;
	rightLabel?: string;
	htmlFormat?: "div" | "table" | "dl";
	textFormat?: 0 | 1 | 2 | 3;
	htmlPre?: boolean;
};

type CopyMode = "raw" | "formatted" | "compare";

type OutlineEntry = {
	level: 1 | 2 | 3 | 4 | 5 | 6;
	title: string;
	leftPos: number;
	leftLen: number;
	rightPos: number;
	rightLen: number;
};

type SectionHeading = {
	ordinalText: string;
	title: string;
	left: EntrySide;
	right: EntrySide;
	parent: SectionHeading | null;
	firstChild: SectionHeading | null;
	nextSibling: SectionHeading | null;
	level: number;
	// ordinal: number; // 1,2,3,4,5,...
	// depth: number; //
	// type: number; //
};
