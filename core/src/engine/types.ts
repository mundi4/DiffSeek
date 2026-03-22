/**
 * Engine types
 * Core diff engine and workflow types
 */

import type { Token } from "../tokenization";
import type { DiffOptions } from "../diff";
import type { DiffVisibilityChangeEntry } from "../renderer";
import type { DiffEntry, Palette } from "..";

export type CommonOutlineHeading = {
    index: number;
    leftTokenIndex: number;
    rightTokenIndex: number;
    leftLineNumber: number;
    rightLineNumber: number;
    leftHeadingFlags: number;
    rightHeadingFlags: number;
    leftSpan: { start: number; end: number };
    rightSpan: { start: number; end: number };
    leftLabel: string;
    rightLabel: string;
};

export type DiffPhaseTiming = {
    readonly tokenizingMs: number;
    readonly diffingMs: number;
    readonly processingMs: number;
    readonly totalMs: number;
};

export type DiffContext = {
    readonly leftTokens: readonly Token[];
    readonly rightTokens: readonly Token[];
    readonly commonOutline: readonly CommonOutlineHeading[];
    readonly diffOptions: DiffOptions;
    readonly diffs: DiffEntry[];
    readonly anchorPairs: AnchorPair[];
    readonly leftTokenBuffer: Readonly<Int32Array>;
    readonly rightTokenBuffer: Readonly<Int32Array>;
    readonly timing: DiffPhaseTiming;
    isValid: boolean;
}

export type DiffWorkflowStatus = {
    phase: "idle" | "tokenizing" | "diffing" | "processing";
    startedAtMs?: number;
    tokenizingMs?: number;
    diffingMs?: number;
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
    "editableInSyncModeChanged": { editableInSyncMode: boolean };
    "statusChanged": DiffWorkflowStatus;
    "diffVisibilityChanged": { left: DiffVisibilityChangeEntry[], right: DiffVisibilityChangeEntry[] };
    "diffContextChanged": DiffContext | null;
    "diffOptionsChanged": Readonly<DiffOptions>;
    "paletteChanged": Readonly<Palette>;
    "hoveredDiffIndexChanged": number | null;
    "progress": { progress: number; }
}

export type {
    DiffVisibilityChangeEntry
}