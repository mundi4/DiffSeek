import { vars } from "@/styles/vars.css";
import { style } from "@vanilla-extract/css";

export const root = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: vars.spacing.xs,
	gap: vars.spacing.xs,
	//backgroundColor: "var(--background-muted)",
});

export const buttons = style({
	display: "flex",
	alignItems: "center",
	gap: vars.spacing.xs,
});

export const rightButtons = style([
	buttons,
	{
		marginLeft: "auto",
	},
]);
