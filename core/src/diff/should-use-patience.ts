import type { DiffInput, DiffOptions } from "./types";

export function shouldUsePatience(
    lhs: DiffInput,
    rhs: DiffInput,
    options: DiffOptions,
    lhsLineCount: number,
    rhsLineCount: number
): boolean {

    if (!options.usePatience) return false;

    const minLines = options.patienceMinLines || 50;
    const minTokens = options.patienceMinTokens || 2000;

    const totalTokens = lhs.tokenCount + rhs.tokenCount;

    if (totalTokens < minTokens) return false;
    if (Math.min(lhsLineCount, rhsLineCount) < minLines) return false;

    return true;
}
