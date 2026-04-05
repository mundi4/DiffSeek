export const enum QuickDiffType {
    Unchanged = 0,
    Removed = 1,
    Added = 2,
}

export type QuickDiffEntry = {
    type: QuickDiffType;
    text: string;
};

export type QuickDiffResult = {
    leftText: string;
    rightText: string;
    entries: QuickDiffEntry[];
};
