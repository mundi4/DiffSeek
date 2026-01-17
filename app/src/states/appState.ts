// import { signal } from "@preact/signals";
// import { DiffseekEngine, type DiffPipelineState } from "@core/DiffseekEngine";
// import { getDefaultDiffOptions } from "@core/renderer/DiffOptions";
// import type { DiffContext, DiffOptions } from "@core/types";


// export const appState = {
//     diffseekEngine: null! as DiffseekEngine,
//     diffContext: signal<DiffContext | null>(null),
//     diffOptions: signal<DiffOptions>(getDefaultDiffOptions()),
//     optionsModalOpen: signal(false),
//     visibleDiffs: signal<{
//         left: ReadonlySet<number>;
//         right: ReadonlySet<number>;
//     }>({ left: new Set(), right: new Set() }),
//     diffState: signal<DiffPipelineState | null>(null),
// }