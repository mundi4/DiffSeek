/**
 * Tokenization types
 * Used in text tokenization and line boundary detection
 */

import type { SchedulerOptions } from "../scheduler";

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

export type TokenizerOptions = SchedulerOptions & {
    mergeNonWordLikeTokens?: boolean;
    enableStructuralTokens?: boolean;
};

export type TokenizeResult = {
    wholeText: string;
    tokens: Token[];
    lineBoundaries: LineBoundaryInfo[];
    elapsed: number;
}

export * from "./TokenFlags";