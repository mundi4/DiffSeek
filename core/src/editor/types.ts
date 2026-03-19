/**
 * Editor types
 * Editor interface and configuration
 */

import type { Span } from "../types";
import type { Token } from "../tokenization";

export type EditorName = "left" | "right";

export interface EditorContext {
    get name(): EditorName;
    contentElement: HTMLElement;
    tokens: readonly Token[];
    getTokenRange(index: number, end?: number): Range;
    getTokenSpanForRange(range: Range): Span | null;
}

export type EditorOptions = {
    lineHeight: number;
    altArrowScrollLines: number;
}
