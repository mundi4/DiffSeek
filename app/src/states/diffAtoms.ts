import type { RenderedDiff } from "@core/types";
import { atom } from "jotai";

export const diffsAtom = atom<RenderedDiff[] | null>([]);

export const visibleDiffIndexesAtom = atom<{ left: number[], right: number[] }>({ left: [], right: [] });