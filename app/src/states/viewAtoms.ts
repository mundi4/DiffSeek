import type { WhitespaceHandling } from "@core/types";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const syncModeAtom = atom<boolean>(false);

export const whitespaceHandlingAtom = atomWithStorage<WhitespaceHandling>("whitespaceHandling", "collapse");

export const hoveredDiffIndexAtom = atom<number | null>(null);