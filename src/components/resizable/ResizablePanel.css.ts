import { recipe } from "@vanilla-extract/recipes";

export const panel = recipe({
	base: {
		minHeight: 0,
		minWidth: 0,
		overflow: "hidden",
	},
	variants: {
		direction: {
			horizontal: {
				// minWidth: 0,
				// width: "100%",
			},
			vertical: {
				// minHeight: 0,
				// height: "100%",
			},
		},
	},
});