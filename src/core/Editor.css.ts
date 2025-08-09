import { globalStyle, style } from "@vanilla-extract/css";

	// --td-border-color: #666;
	// --text-container-padding-block: 4px;
	// --editor-font-size: 14px;
	// --editor-padding: 4px;
	// --editor-line-height: 1.5;
	// --editor-scroll-margin: 3em;

export const wrapper = style({
	overflowY: "scroll",
	height: "100%",
	minHeight: 0,
	selectors: {
		"&:has(:focus)": {
			outline: "1px solid var(--editor-focus-outline-color, #007bff)",
		}
	}
});

export const editor = style({
    position: "relative",
	border: 0,
	minWidth: 0,
	width: "100%",
    minHeight: "100%",
    overflowY: "visible",
    fontSize: "14px",
    padding: "4px",
    lineHeight: "1.5",
    scrollPaddingTop: "3em",
    wordBreak: "break-all",
    overflowWrap: "anywhere",
    outline: "none",
    backgroundColor:"transparent",
	zIndex: 30,
});

globalStyle(`${editor} table`, {
	borderCollapse: "collapse",
	borderSpacing: 0,
	tableLayout: "auto",
});

	// vertical-align: top;
	// border: 1px solid var(--td-border-color, #666);
	// padding: var(--text-container-padding-block, 0px) var(--text-container-padding-inline, 0px);
	// min-height: 1.5rem;
	// position: relative;
globalStyle(`${editor} td`, {
    // position: "relative",
	// verticalAlign: "top",
    // border: "1px solid var(--td-border-color, #666)",
    // padding: "0px 0px",
    // minHeight: "1.5rem",
});

export const heightBoost = style({
	display: "none",
});

