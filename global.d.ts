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
	index: number;
	count: number;
};

declare type DiffType = 0 | 1 | 2 | 3;

declare type RawDiff = {
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
};

declare type DiffRequest = {
	type: "diff";
	reqId: number;
	// leftText: string;
	// rightText: string;
	leftTokens: Token[] | null;
	rightTokens: Token[] | null;
	options: DiffOptions;
};

declare type DiffResponse = {
	type: "diff";
	reqId: number;
	diffs: RawDiff[];
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
	leftTokens: readonly RichToken[];
	rightTokens: readonly RichToken[];
	diffOptions: DiffOptions;
	rawDiffs: RawDiff[];
	processTime: number;
	diffs: DiffItem[];
	ready: boolean;
	leftSectionHeadings: SectionHeading[];
	rightSectionHeadings: SectionHeading[];
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

type RenderItem = {
	type: "texthighlight" | "diffhighlight";
	x: number;
	y: number;
	w: number;
	h: number;
	fillStyle?: string;
	strokeStyle?: string;
};

type TextHighlightRenderItem = {
	rects: Rect[];
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

type RenderLayer = {
	index: 0 | 1;
	dirty: boolean;
};

type TextSelectionHighlight = {
	startOffset: number;
	endOffset: number;
	renderItem?: { rects: Rect[] } & RenderBounds;
};

type RectSet = {
	rects: Rect[] | null;
	// fillStyle: string | null;
	// strokeStyle: string | null;
} & RenderBounds;

type RenderBounds = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

// type RectsWithBoundsOptional = ({ rects: Rect[] } & RenderBounds) | ({ rects?: undefined } & RenderBoundsUndefined);
// type RenderBoundsUndefined ={ minX?: undefined, minY?: undefined, maxX?: undefined, maxY?: undefined };


type RichToken = {
	text: string;
	flags: number;
	range: LightRange | Range;
	lineNum: number;
	container: TextFlowContainer;
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

type DiffResult = {
	diffs: RawDiff[];
	processTime: number;
};

type DiffItem = {
	diffIndex: number;
	hue: number;
	leftRange: Range;
	rightRange: Range;
	leftSpan: Span;
	rightSpan: Span;
};

type VisibilityChangeEntry = {
	item: number | string | HTMLElement;
	isVisible: boolean;
};