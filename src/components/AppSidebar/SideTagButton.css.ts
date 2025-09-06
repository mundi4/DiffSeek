import { vars } from "@/styles/vars.css";
import { recipe } from "@vanilla-extract/recipes";

export const root = recipe({
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		fontFamily: "Consolas, monospace",
		fontWeight: vars.typography.weight.bold,
		fontSize: vars.typography.size.xs,
		borderRadius: vars.radius.sm,
		transition: "background 0.2s ease, border-color 0.2s ease",
		width: vars.size.icon.md,
		height: vars.size.icon.md,
		paddingInline: 0,
		lineHeight: 1,
	},
	variants: {
		visible: {
			true: {
				opacity: 1,
			},
			false: {
				opacity: vars.opacity.invisible,
			},
		},
	},
	// selectors: {
	//     "&:hover": {
	//         background: "rgba(255, 255, 255, 0.1)",
	//     },
	//     "&:focus-visible": {
	//         outline: "2px solid rgba(255, 255, 255, 0.5)",
	//     },
	// },
});
