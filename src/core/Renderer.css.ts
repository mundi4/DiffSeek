import { globalStyle, style } from "@vanilla-extract/css";

export const wrapper = style({
	position: "absolute",
	top: 0,
	left: 0,
	width: "100%",
	height: "100%",
	pointerEvents: "none",
	zIndex: 0,
	overflow: "hidden",
});

export const diffLayer = style({
	zIndex: 20,
});
export const highlightLayer = style({
	zIndex: 50,
});

globalStyle(`${wrapper} canvas`, {
	position: "absolute",
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	willChange: "transform",
});
