import { TokenFlags } from "./TokenFlags";

export const enum TokenType {
    TEXT = 'text',
    IMAGE = 'image',
}

export type Token = {
    index: number;
    type: "text" | "image";
    flags: number;
    textOffset: number;
    textLength: number;
    // text: string;
    startNode: Node;
    startOffset: number;
    endNode: Node;
    endOffset: number;
    // containerId: number;
    lineNumber: number;
};

export type LineStartPoint = {
    which: Node | null;
    where: InsertPosition | null;
}

export type NumberingInfo = {
    wholeText: string;
    number: string;
    length: number; // 전체 길이
    type: TokenFlags;// "조" | "1." | "가." | "(1)" | "(가)" | "1)" | "가)";//| "①";]
}

export type Span = {
    start: number;
    end: number;
};

export type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type EditorName = "left" | "right";

export interface EditorContext {
    get name(): EditorName;
    contentElement: HTMLElement;
    tokens: readonly Token[];
    getTokenRange(index: number, end?: number): Range;
    getTokenSpanForRange(range: Range): Span | null;
}

export type EditorSettings = {
    lineHeight: number;
    altArrowScrollLines: number;
}


export type SerializedToken = {
    // text: string;
    textOffset: number;
    textLength: number;
    flags: TokenFlags;
}

export type DiffType = 0 | 1 | 2 | 3;

export type DiffEntry = {
    type: DiffType;
    left: Span;
    right: Span;
};

export type WhitespaceHandling = "collapse" | "ignore" | "ignoreAtEdge";

export type DiffOptions = {
    whitespace: WhitespaceHandling;

    // 그램 설정
    useGrams: boolean;                    // 그램 기반 매칭 사용
    maxGram: number;                      // 최대 그램 개수

    // 길이 보너스 설정
    useLengthBonus: boolean;              // 길이 보너스 활성화
    lengthBonusMultiplier: number;        // 보너스 강도 배수 (1.0 = 기본값)
    maxLengthPerGramForBonus: number;     // 그램당 최대 길이

    // 줄 시작 보너스 설정
    useLineStartBonus: boolean;           // 줄 시작 보너스 활성화
    lineStartBonusMultiplier: number;     // 보너스 강도 배수 (1.0 = 기본값)

    // 고유성 보너스 설정
    useUniqueBonus: boolean;              // 고유성 보너스 활성화
    uniqueBonusMultiplier: number;        // 보너스 강도 배수 (1.0 = 기본값)

    //
    // 성능이 후달릴 때 살펴볼 옵션들...
    //
    useCoarseSplit: boolean;
    coarseAnchorMode: "line" | "linePrefix" | "fixedWindow";
    coarseAnchorMinTokens: number;
    coarseAnchorTokenWindow: number;
    coarseAnchorMinWordLikeTokens: number;
    coarseAnchorMinEffectiveChars: number;
    coarseSplitMinTokens: number;
    coarseSplitMinSideTokens: number;
    coarseSplitMinGainRatio: number;
    coarseSplitMaxUniqueAnchors: number;
};

export type DiffVisibilityChangeEntry = {
    item: number;
    isVisible: boolean;
};

export type RenderedDiff = {
    diffIndex: number;
    hue: number;
    leftRange: Range;
    rightRange: Range;
    leftSpan: Span;
    rightSpan: Span;
    leftMarkerEl: HTMLElement | null;
    rightMarkerEl: HTMLElement | null;
};

export type AnchorPair = {
    index: number;
    leftEl: HTMLElement;
    rightEl: HTMLElement;
    diffIndex: number | null;
    aligned: boolean;
    delta: number;
}


export interface DiffseekEventMap {
    "mount": { el: HTMLElement };
    "unmount": void;
    "syncModeChanged": { syncMode: boolean };
    "statusChanged": { phase: 'idle' | 'tokenizing' | 'diffing' | 'processing'; progress?: number };
    "diffVisibilityChanged": { left: DiffVisibilityChangeEntry[], right: DiffVisibilityChangeEntry[] };
    "diffContextChanged": DiffContext | null;
    "diffOptionsChanged": Readonly<DiffOptions>;
    "hoveredDiffIndexChanged": number | null;
}


export interface DiffseekInterface {
    on<K extends keyof DiffseekEventMap>(event: K, handler: (data: DiffseekEventMap[K]) => void): void;
    off<K extends keyof DiffseekEventMap>(event: K, handler: (data: DiffseekEventMap[K]) => void): void;
    scrollToDiff(diffIndex: number, side: EditorName, options?: ScrollIntoViewOptions): void;

}

export type DiffContext = {
    readonly leftTokens: readonly Token[];
    readonly rightTokens: readonly Token[];
    readonly diffOptions: DiffOptions;
    readonly entries: DiffEntry[];
    readonly leftEntries: DiffEntry[];
    readonly rightEntries: DiffEntry[];
    readonly diffs: RenderedDiff[];
    readonly anchorPairs: AnchorPair[];
    isValid: boolean;
}