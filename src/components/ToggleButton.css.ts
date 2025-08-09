import { globalStyle } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "@/styles/vars.css";

export const toggleButton = recipe({
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: vars.spacing.xs,
		fontWeight: 500,
		border: `1px solid ${vars.color.border.base}`,
		borderRadius: vars.radius.sm,
		cursor: "pointer",
		transition: vars.transition.normal,
		backgroundColor: vars.color.background.base,
		color: vars.color.foreground.base,
		lineHeight: "1.2",
	},
	variants: {
		checked: {
			true: {
				backgroundColor: vars.color.accent.primary,
				color: vars.color.control.handle,
				borderColor: vars.color.border.base,
			},
			secondary: {
				backgroundColor: vars.color.accent.secondary,
				color: vars.color.control.handle,
				borderColor: vars.color.border.base,
			},
			false: {},
		},
		disabled: {
			true: {
				opacity: vars.opacity.disabled,
				cursor: "not-allowed",
			},
		},
		size: {
			sm: {
				fontSize: vars.fontSize.sm,
				padding: `${vars.spacing.xs} ${vars.spacing.sm}`,
				height: "28px",
			},
			md: {
				fontSize: vars.fontSize.base,
				padding: `${vars.spacing.sm} ${vars.spacing.md}`,
				height: "36px",
			},
		},
	},
	defaultVariants: {
		size: "md",
	},
});

globalStyle(`${toggleButton.classNames.base} svg`, {
	flexShrink: 0,
	pointerEvents: "none",
	verticalAlign: "middle",
});

globalStyle(`${toggleButton.classNames.variants.size.sm} svg`, {
	width: vars.size.icon.sm,
	height: vars.size.icon.sm,
});

globalStyle(`${toggleButton.classNames.variants.size.md} svg`, {
	width: vars.size.icon.md,
	height: vars.size.icon.md,
});

globalStyle(`${toggleButton.classNames.variants.checked.true} svg`, {
	filter: "brightness(0) invert(1)",
	
});
