import { getDefaultDiffOptions } from "./diff/get-default-diff-options";
import type { DiffseekOptions } from "./types";

export function getDefaultDiffseekOptions(): DiffseekOptions {
    return {
        diff: getDefaultDiffOptions(),
        editableInSyncMode: false,
    };
}
