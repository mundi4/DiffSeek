import type { WhitespaceHandling } from "@core/types";

export type DiffseekActions = {

    setSyncMode(enable: boolean): void;

    setWhitespaceMode(mode: WhitespaceHandling): void;

    scrollToDiff(diffIndex: number, side: "left" | "right" | "both", options?: ScrollIntoViewOptions): void;

    setHoveredDiff(diffIndex: number | null): void;
};