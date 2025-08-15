import { vars } from "@/styles/vars.css";
import { style } from "@vanilla-extract/css";

export const body = style({});

export const trail = style({
	display: "flex",
	alignItems: "flex-start",
	gap: vars.spacing.xs,
	//padding: vars.spacing.xs,
	fontSize: vars.typography.size.sm,
	selectors: {
		"&:not(:first-child)": {
			marginTop: vars.spacing.sm,
		},
	},
});

export const trailLink = style({
	cursor: "pointer",
});

export const ordinalText = style({
	fontWeight: vars.typography.weight.bold,
	color: vars.color.brand.base,
});

export const headingTitle = style({
	color: vars.color.brand.base,
});

export const separator = style({
	marginInline: vars.spacing.xs,
	color: vars.color.text.muted,
});
