declare type Token = {
	pos: number;
	len: number;
	text: string;
	lineNum: number;
	flags: number;
};

declare type DiffEntrySide = {
	pos: number;
	len: number;
	line?: number;
	empty?: boolean;
	text?: string;
};

declare type DiffType = "insert" | "delete" | "replace" | "equal";

declare type DiffEntry = {
	type: 0 | 1 | 2 | 3;
	left: DiffEntrySide;
	right: DiffEntrySide;
};

declare type AnchorType = "before" | "after";

declare type Anchor = {
	type: AnchorType;
	left: number;
	right: number;
	diffIndex: number | null;
};

