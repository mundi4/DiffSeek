import { getDefaultDiffseekOptions, type CommonOutlineHeading, type DiffWorkflowStatus, type DiffEntry, type DiffseekOptions, type Palette } from "@core";
import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

// ──────────────────────────────────────────────
// DiffseekOptions: safe localStorage storage
// ──────────────────────────────────────────────

const STORAGE_KEY = "diffseek_options";

/**
 * defaults를 기반��로 stored 값을 per-field 타입 ���증하며 merge.
 * - 새 필드 → default 값 사용
 * - 삭제된 필드 → 무시
 * - 타입 불일치 → default 값 사용
 */
function safeMerge<T>(defaults: T, stored: unknown): T {
    if (stored === null || stored === undefined || typeof stored !== typeof defaults) {
        return defaults;
    }
    if (typeof defaults !== "object" || defaults === null) {
        // primitive — typeof 이미 일치 확인됨
        return stored as T;
    }
    if (Array.isArray(defaults)) {
        // 배열: stored도 배열이면 그대로 사용, 아니면 default
        return (Array.isArray(stored) ? stored : defaults) as T;
    }
    // object: per-key recursive merge
    const result = { ...defaults };
    const s = stored as Record<string, unknown>;
    for (const key of Object.keys(defaults) as (keyof T & string)[]) {
        if (key in s) {
            (result as any)[key] = safeMerge(defaults[key], s[key]);
        }
    }
    return result;
}

function createDiffseekOptionsStorage() {
    const backend = createJSONStorage<DiffseekOptions>(() => localStorage);
    return {
        ...backend,
        getItem(key: string, initialValue: DiffseekOptions): DiffseekOptions {
            try {
                const raw = localStorage.getItem(key);
                if (raw === null) return initialValue;
                const parsed = JSON.parse(raw);
                return safeMerge(initialValue, parsed);
            } catch {
                // 파싱 실패 → LS 날리고 default
                localStorage.removeItem(key);
                return initialValue;
            }
        },
    };
}

export const diffseekOptionsAtom = atomWithStorage<DiffseekOptions>(
    STORAGE_KEY,
    getDefaultDiffseekOptions(),
    createDiffseekOptionsStorage(),
);

// ──────────────────────────────────────────────
// Derived atoms (read-only convenience)
// ──────────────────────────────────────────────

export const diffOptionsAtom = atom((get) => get(diffseekOptionsAtom).diff);
export const editableInSyncModeAtom = atom((get) => get(diffseekOptionsAtom).editableInSyncMode);
export const whitespaceHandlingAtom = atom((get) => get(diffseekOptionsAtom).diff.whitespace);

// ──────────────────────────────────────────────
// Non-persisted state
// ──────────────────────────────────────────────

export const syncModeAtom = atom<boolean>(false);
export const extensionEnabledAtom = atom<boolean>(false);
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

// ──────────────────────────────────────────────
// Quick Diff
// ──────────────────────────────────────────────

export type QuickDiffViewMode = "inline" | "side-by-side" | "stacked";

export const quickDiffViewModeAtom = atomWithStorage<QuickDiffViewMode>(
    "diffseek_quickdiff_viewmode",
    "inline",
);
