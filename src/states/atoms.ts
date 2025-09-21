import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { EditorName } from "../core/types";
import type { EditorTextSelection } from "@/core/DiffController";

export const diffItemsAtom = atom<DiffItem[]>([]);

export const syncModeAtom = atom<boolean>(false);

export const visibleDiffsAtom = atom<Record<EditorName, ReadonlySet<number>>>({
	left: new Set<number>(),
	right: new Set<number>(),
});

export const hoveredDiffIndexAtom = atom<number | null>(null);

export const editorPanelLayoutAtom = atomWithStorage<"horizontal" | "vertical">("editorPanelLayout", "horizontal");

export const magnifierEnabledAtom = atomWithStorage<boolean>("magnifierEnabled", true);

export const appSidebarCollapsedAtom = atom(false);

let lastKnownSelection: EditorTextSelection | null = null;
const baseEditorSelectionAtom = atom<EditorTextSelection | null>(null);

export const editorTextSelectionAtom = atom(
	(get) => get(baseEditorSelectionAtom),
	(_, set, newVal: EditorTextSelection | null) => {
		set(baseEditorSelectionAtom, newVal);
		lastKnownSelection = newVal ?? lastKnownSelection;
	}
);

export const editorSelectionFallbackAtom = atom((get) => get(baseEditorSelectionAtom) ?? lastKnownSelection);

export const settingsPanelOpenAtom = atom<boolean>(false);