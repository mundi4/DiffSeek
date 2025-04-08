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
	empty?: boolean;
};

declare type DiffType = 0 | 1 | 2 | 3;

declare type DiffEntry = {
	type: DiffType;
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

