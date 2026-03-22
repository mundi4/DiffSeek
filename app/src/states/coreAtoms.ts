import { getDefaultDiffOptions, type CommonOutlineHeading, type DiffWorkflowStatus, type DiffEntry, type Palette } from "@core";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const syncModeAtom = atom<boolean>(false);

export const editableInSyncModeAtom = atomWithStorage<boolean>("diffseek_editableInSyncMode", false);

export const diffOptionsAtom = atomWithStorage("diffseek_diffOptions", getDefaultDiffOptions());

export const whitespaceHandlingAtom = atom((get) => get(diffOptionsAtom).whitespace);

export const hoveredDiffIndexAtom = atom<number | null>(null);

export const diffWorkflowStatusAtom = atom<DiffWorkflowStatus>({ phase: "idle" });
export const paletteAtom = atom<Readonly<Palette> | null>(null);

type DiffContextState = {
    diffs: DiffEntry[];
    commonOutline: CommonOutlineHeading[];
    leftTokenCount: number;
    rightTokenCount: number;
    timingTokenizingMs: number;
    timingDiffingMs: number;
    timingProcessingMs: number;
    timingTotalMs: number;
} | null;

export const diffContextAtom = atom<DiffContextState>(null);

export const diffsAtom = atom<DiffEntry[] | null>((get) => {
    return get(diffContextAtom)?.diffs ?? null;
});

export const commonOutlineAtom = atom<CommonOutlineHeading[]>((get) => {
    return get(diffContextAtom)?.commonOutline ?? [];
});

export const visibleDiffIndexesAtom = atom<{ left: number[], right: number[] }>({ left: [], right: [] });
