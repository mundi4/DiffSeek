import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "@/styles/vars.css";

export const root = style({
	display: "grid",
	gridTemplateRows: "auto 1fr",
	height: "100%",
	minHeight: 0,
	overflow: "hidden",
	color: vars.color.text.base,
	backgroundColor: vars.color.surface.base,
	border: `1px solid ${vars.color.neutral.border}`,
	borderTop: `1px solid ${vars.color.neutral.borderMuted}`,
});

export const header = style({
	paddingBlock: vars.spacing.xxs,
	paddingInline: vars.spacing.sm,
	userSelect: "none",
	fontSize: vars.typography.size.sm,
	fontWeight: vars.typography.weight.medium,
	lineHeight: vars.typography.line.tight,
	backgroundColor: vars.color.surface.subtle,
	borderBottom: `1px solid ${vars.color.neutral.border}`,
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: vars.spacing.sm,
});

export const headerRow = style({
	display: "flex",
	alignItems: "center",
	gap: vars.spacing.sm,
	minWidth: 0,
});

export const headerContentLeading = style({
	display: "grid",
	placeItems: "center",
	gap: vars.spacing.xs,
	width: vars.size.icon.md,
	height: vars.size.icon.md,
});

export const headerContentActions = style({
	display: "flex",
	alignItems: "center",
	gap: vars.spacing.sm,
	minWidth: 0,
	flexShrink: 0,
});

export const body = recipe({
	base: {
		height: "100%",
		minHeight: 0,
		paddingInline: vars.spacing.xs,
		paddingBlock: vars.spacing.xxs,
	},
	variants: {
		scroll: {
			true: { overflow: "auto" },
			false: { overflow: "hidden" },
		},
	},
	defaultVariants: { scroll: true },
});

export const messageContainer = style({
	padding: vars.spacing.md,
	textAlign: "center",
});

export const errorMessage = style({
	color: vars.color.intent.danger,
	fontSize: vars.typography.size.md,
	fontWeight: vars.typography.weight.semibold,
});

export const descMessage = style({
	color: vars.color.text.muted,
	fontSize: vars.typography.size.sm,
	fontStyle: "italic",
});
