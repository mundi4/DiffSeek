import { style } from "@vanilla-extract/css";

export const rendererShell = style({
	position: "absolute",
	top: 0,
	left: 0,
	width: "100%",
	height: "100%",
	pointerEvents: "none",
});
