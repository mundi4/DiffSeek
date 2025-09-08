declare type Token = {
	text: string;
	pos?: number;
	len?: number;
	flags: number;
};

type Rect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

declare type Span = {
	start: number;
	end: number;
};

declare type DiffType = 0 | 1 | 2 | 3;

declare type DiffEntry = {
	type: DiffType;
	left: Span;
	right: Span;
};

declare type AnchorType = "before" | "after";

declare type DiffAlgorithm = "lcs" | "histogram";

// declare const TOKENIZE_BY_CHAR: 1;
// declare const TOKENIZE_BY_WORD: 2;
// declare const TOKENIZE_BY_LINE: 3;
declare type TokenizationMode = "char" | "word" | "line";

declare type WhitespaceHandling = "ignore" | "normalize" | "onlyAtEdge";
declare type DiffOptions = {
	algorithm: DiffAlgorithm;
	tokenization: TokenizationMode;
	ignoreWhitespace: WhitespaceHandling;
	greedyMatch?: boolean;
	useLengthBias?: boolean;
	maxGram: number;
	lengthBiasFactor: number;
	sectionHeadingMultiplier: number;
	containerStartMultiplier: number;
	containerEndMultiplier: number;
	lineStartMultiplier: number;
	lineEndMultiplier: number;
	uniqueMultiplier: number;
	compareSupSub: boolean; // SUB, SUP까지 비교하는 옵션
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

type SectionHeading = {
	type: number;
	level: number;
	ordinalText: string;
	ordinalNum: number;
	title: string;
	parent: SectionHeading | null;
	firstChild: SectionHeading | null;
	nextSibling: SectionHeading | null;
	startTokenIndex: number;
	endTokenIndex: number;
};

type TextFlowContainer = {
	element: HTMLElement;
	depth: number;
	startTokenIndex: number; // 시작 토큰 인덱스
	tokenCount: number; // 토큰 개수
	parent: TextFlowContainer | null; // 부모 컨테이너 정보
};

type LightRange = {
	startContainer: Node;
	startOffset: number;
	endContainer: Node;
	endOffset: number;
};

type DiffItem = {
	diffIndex: number;
	hue: number;
	leftRange: Range;
	rightRange: Range;
	leftSpan: Span;
	rightSpan: Span;
	leftMarkerEl: HTMLElement | null;
	rightMarkerEl: HTMLElement | null;
};

type VisibilityChangeEntry = {
	item: number | string | HTMLElement;
	isVisible: boolean;
};
