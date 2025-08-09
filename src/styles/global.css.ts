import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./vars.css";
import { LINE_HEIGHT } from "@/constants";

globalStyle("*, *::before, *::after", {
	boxSizing: "border-box",
});

globalStyle("html, body", {
	margin: 0,
	padding: 0,
	fontFamily: vars.font.body,
	backgroundColor: vars.color.background.base,
	color: vars.color.foreground.base,
	lineHeight: LINE_HEIGHT ?? "1.5",
	WebkitFontSmoothing: "antialiased",
	MozOsxFontSmoothing: "grayscale",
	height: "100%",
});

// Global icon style for semantic consistency
globalStyle("svg[data-icon]", {
	width: vars.size.icon.md,
	height: vars.size.icon.md,
	fill: "currentColor",
	flexShrink: 0,
	pointerEvents: "none",
	verticalAlign: "middle",
});

globalStyle("[data-invert] svg[data-icon], svg[data-icon][data-invert]", {
	filter: "brightness(0) invert(1)",
});
