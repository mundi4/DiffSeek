import type { DiffOptions } from "@core";

export type DiffseekActions = {

    setSyncMode(enable: boolean): void;

    setWhitespaceMode(mode: DiffOptions["whitespace"]): void;

    scrollToDiff(diffIndex: number, side: "left" | "right" | "both", options?: ScrollIntoViewOptions): void;

    setHoveredDiff(diffIndex: number | null): void;
};