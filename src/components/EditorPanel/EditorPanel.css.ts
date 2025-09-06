import { vars } from "@/styles/vars.css";
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
				backgroundColor: "var(--bg-normal)",
				color: "inherit",
			},
		},
	},
	defaultVariants: {
		syncMode: "off",
	},
});

export const divider = recipe({
	base: {
		position: "absolute",
		pointerEvents: "none",
	},
	variants: {
		layout: {
			horizontal: {
				top: 0,
				bottom: 0,
				left: "50%",
				borderLeft: `${vars.borderWidth.thick} solid ${vars.color.neutral.border}`,
				transform: `translateX(calc(-1 * ${vars.borderWidth.thick} / 2))`,
			},
			vertical: {
				left: 0,
				right: 0,
				top: "50%",
				borderTop: `${vars.borderWidth.thick} solid ${vars.color.neutral.border}`,
				transform: `translateY(calc(-1 * ${vars.borderWidth.thick} / 2))`,
			},
		},
	},
	defaultVariants: {
		layout: "vertical",
	},
});
