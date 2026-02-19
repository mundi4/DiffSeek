/**
 * Engine types
 * Core diff engine and workflow types
 */

import type { Token } from "../tokenization";
import type { DiffOptions } from "../diff";
import type { DiffVisibilityChangeEntry, RenderedDiff } from "../renderer";

export type DiffContext = {
    readonly leftTokens: readonly Token[];
    readonly rightTokens: readonly Token[];
    readonly diffOptions: DiffOptions;
    readonly diffs: RenderedDiff[];
    readonly anchorPairs: AnchorPair[];
    readonly leftTokenBuffer: Readonly<Int32Array>;
    readonly rightTokenBuffer: Readonly<Int32Array>;
    isValid: boolean;
}

export type DiffWorkflowStatus = {
    phase: "idle" | "tokenizing" | "diffing" | "processing";
    progress?: number;
}

export type AnchorPair = {
    index: number;
    leftEl: HTMLElement;
    rightEl: HTMLElement;
    diffIndex: number | null;
    delta: number;
}

export interface DiffseekEventMap {
    "mount": { el: HTMLElement };
    "unmount": void;
    "syncModeChanged": { syncMode: boolean };
    "statusChanged": DiffWorkflowStatus;
    "diffVisibilityChanged": { left: DiffVisibilityChangeEntry[], right: DiffVisibilityChangeEntry[] };
    "diffContextChanged": DiffContext | null;
    "diffOptionsChanged": Readonly<DiffOptions>;
    "hoveredDiffIndexChanged": number | null;
    "progress": { progress: number; }
}

export type {
    DiffVisibilityChangeEntry
}