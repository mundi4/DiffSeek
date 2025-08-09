import { globalStyle } from "@vanilla-extract/css";

globalStyle("*, *::before, *::after", {
	boxSizing: "border-box",
});

globalStyle("body", {
	margin: 0,
	lineHeight: 1.5,
	WebkitFontSmoothing: "antialiased",
});

globalStyle("h1, h2, h3, h4, h5, h6, p", {
	margin: 0,
});

// globalStyle("ul, ol", {
// 	padding: 0,
// 	margin: 0,
// 	listStyle: "none",
// });
