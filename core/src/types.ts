// /**
//  * Core type definitions and re-exports
//  * This file centralizes type exports from across the codebase
//  */

// // Re-export tokenization types
// export type { Token, LineBoundaryInfo } from "./tokenization/types";

// // Re-export editor types
// export type { EditorContext, EditorName, EditorSettings, Span } from "./editor/types";

// // Re-export diff types
// export type { WhitespaceHandling, DiffOptions } from "./diff-worker/types";
// export { DiffType } from "./diff-worker/types"; // enum needs value export

// // Re-export renderer types
// export type { Rect, DiffVisibilityChangeEntry, RenderedDiff } from "./renderer/types";

// // Re-export engine types
// export type { DiffContext, DiffWorkflowStatus } from "./engine/types";


// // ============================================================================
// // Public Event Map (defined here as it's part of the public API)
// // ============================================================================

// import type { DiffWorkflowStatus } from "./engine/types";
// import type { DiffVisibilityChangeEntry } from "./renderer/types";
// import type { DiffOptions } from "./diff-worker/types";
// import type { DiffContext } from "./engine/types";

// export interface DiffseekEventMap {
//     "mount": { el: HTMLElement };
//     "unmount": void;
//     "syncModeChanged": { syncMode: boolean };
//     "statusChanged": DiffWorkflowStatus;
//     "diffVisibilityChanged": { left: DiffVisibilityChangeEntry[], right: DiffVisibilityChangeEntry[] };
//     "diffContextChanged": DiffContext | null;
//     "diffOptionsChanged": Readonly<DiffOptions>;
//     "hoveredDiffIndexChanged": number | null;
//     "progress": { progress: number; }
// }

export type { DiffOptions } from "./diff";

import type { DiffOptions } from "./diff";

export type DiffseekOptions = {
    diff: DiffOptions;
    editableInSyncMode: boolean;
};


export type Span = {
    start: number;
    end: number;
};

export type Palette = {
    diffHues: number[];
    diffSaturation: number;
    diffLightness: number;
    diffAlpha: number;
    diffLineColor: string;
    highlightedDiffColor: string;
    guidelineColor: string;
    selectionHighlightColor: string;
    minimapDiffColor: string;
};

export type DiffEntry = {
    diffIndex: number;
    leftRange: Range;
    rightRange: Range;
    leftSpan: Span;
    rightSpan: Span;
    leftMarkerEl: HTMLElement | null;
    rightMarkerEl: HTMLElement | null;
};

