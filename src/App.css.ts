import { style } from "@vanilla-extract/css";

export const appLayout = style({
	width: "100vw", // w-screen
	height: "100vh", // h-screen
	display: "grid",
	gridTemplateColumns: "1fr auto", // grid-cols-[...]
});

export const main = style( {
	minWidth: 0,
	minHeight: 0,
	height: "100%",
	overflow: "hidden",
});


// .sync-mode .striped::before {
// 	background: transparent repeating-linear-gradient(135deg, hsl(0 0% 88% / 0.95) 0px, hsl(0 0% 88% / 0.95) 3px, transparent 3px, transparent 6px);
// 	opacity: 0.75;
// }
