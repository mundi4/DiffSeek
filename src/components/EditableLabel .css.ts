import { style } from "@vanilla-extract/css";

export const label = style({
	display: "inline-block",
	cursor: "text",
	padding: "0.125rem 0.25rem", // py-0.5 px-1
});

export const input = style({
	padding: "0.125rem 0.25rem", // py-0.5 px-1
	fontSize: "0.875rem", // text-sm
	border: "1px solid #ccc",
	borderRadius: "0.25rem", // rounded
});

export const placeholder = style({
	fontStyle: "italic",
	color: "#9ca3af", // gray-400
});
