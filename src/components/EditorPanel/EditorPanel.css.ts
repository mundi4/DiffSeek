import { recipe } from "@vanilla-extract/recipes";

export const container = recipe({
	base: {
		display: "grid",
		height: "100%",
		minHeight: 0,
		position: "relative",
	},
	variants: {
		layout: {
			vertical: {
				gridTemplateRows: "repeat(2, 1fr)",
			},
			horizontal: {
				gridTemplateColumns: "repeat(2, 1fr)",
			},
		},
		syncMode: {
			on: {
				backgroundColor: "var(--bg-sync-mode)",
				color: "var(--text-sync-mode)",
			},
			off: {
				backgroundColor: "transparent",
				color: "inherit",
			},
		},
	},
	defaultVariants: {
		syncMode: "off",
	},
});
