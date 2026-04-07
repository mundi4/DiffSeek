/**
 * Engine types
 * Core diff engine and workflow types
 */

import type { Token } from "../tokenization";
import type { DiffOptions } from "../diff";
import type { DiffVisibilityChangeEntry } from "../renderer";
import type { DiffEntry, Palette, Span } from "..";
import type { EditorName } from "../editor";
import type { SectionHeadingType } from "../constants/section-heading";

export type CommonOutlineHeading = {
    index: number;
    leftTokenIndex: number;
    rightTokenIndex: number;
    headingType: SectionHeadingType;
    leftLabel: string;
    rightLabel: string;
};

export type DiffContext = {
    readonly leftTokens: readonly Token[];
    readonly rightTokens: readonly Token[];
    // readonly commonOutline: readonly CommonOutlineHeading[];
    readonly diffOptions: DiffOptions;
    readonly diffs: DiffEntry[];
    readonly anchorPairs: AnchorPair[];
    readonly leftTokenBuffer: Readonly<Int32Array>;
    readonly rightTokenBuffer: Readonly<Int32Array>;
    readonly similarity: number;
    isValid: boolean;
}

export type DiffWorkflowStatus = {
    phase: "idle" | "tokenizing" | "diffing" | "processing";
    startedAtMs?: number;
    leftTokenCount?: number;
    rightTokenCount?: number;
}

export type MarkerInfo = {
    adjust: number;
}

export type MarkerElementsMap = Map<HTMLElement, MarkerInfo>;

export type AnchorPair = {
    index: number;
    leftEl: HTMLElement;
    rightEl: HTMLElement;
    diffIndex: number | null;
    leftContainerIndex: number;
    rightContainerIndex: number;
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
    "selectionChanged": SelectionChangeData;
}

export type {
    DiffVisibilityChangeEntry
}

export type SelectionChangeData = {
    left: Span | null;
    right: Span | null;
    selectedEditor: EditorName | null;
}