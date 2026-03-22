/**
 * Tokenization types
 * Used in text tokenization and line boundary detection
 */

import type { SectionHeadingMatch } from "./try-match-section-heading";

export type SectionHeadingInfo = SectionHeadingMatch & { tokenIndex: number };

export type Token = {
    index: number;
    flags: number;
    textOffset: number;
    textLength: number;
    startNode: Node;
    startOffset: number;
    endNode: Node;
    endOffset: number;
    lineNumber: number;
};

export type LineBoundaryInfo = {
    startWhich: Node;
    startWhere: InsertPosition;
    endWhich: Node | null;
    endWhere: InsertPosition | null;
}

export type TokenizerOptions = {
    mergeNonWordLikeTokens?: boolean;
    enableStructuralTokens?: boolean;
    mergeLetterNumberBoundary?: boolean;
};

export type TokenizeResult = {
    wholeText: string;
    tokens: Token[];
    lineBoundaries: LineBoundaryInfo[];
    sectionHeadings: SectionHeadingInfo[];
    elapsed: number;
}

export * from "./token-flags";