import { getDefaultDiffOptions } from "@core/diff/getDefaultDiffOptions";
import type { DiffWorkflowStatus } from "@core/DiffseekEngine";
import type { RenderedDiff } from "@core";
import { atom } from "jotai";

export const syncModeAtom = atom<boolean>(false);

export const diffOptionsAtom = atom(getDefaultDiffOptions());

export const whitespaceHandlingAtom = atom((get) => get(diffOptionsAtom).whitespace);

export const hoveredDiffIndexAtom = atom<number | null>(null);

export const diffWorkflowStatusAtom = atom<DiffWorkflowStatus>({ phase: "idle" });

export const diffsAtom = atom<RenderedDiff[] | null>([]);

export const visibleDiffIndexesAtom = atom<{ left: number[], right: number[] }>({ left: [], right: [] });
