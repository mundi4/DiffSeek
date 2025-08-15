// Button.css.ts
import { createVar, style, styleVariants } from "@vanilla-extract/css";
import { vars } from "@/styles/vars.css";

/* ====== Instance-overridable variables ====== */
export const buttonColor = createVar();
export const buttonSurface = createVar();
export const buttonPaddingInline = createVar();
export const buttonBorderStrength = createVar();
export const buttonHeight = createVar();

/** Base */
export const button = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: vars.spacing.xs,
	whiteSpace: "nowrap",

	borderRadius: vars.radius.md,
	fontSize: vars.typography.size.sm,
	fontWeight: vars.typography.weight.semibold,
	userSelect: "none",
	outline: "none",
	flexShrink: 0,

	transition: [
		`background-color ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
		`border-color ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
		`box-shadow ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
		`color ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
	].join(", "),

	// use vars → fallback값을 여기서 세팅
	height: buttonHeight,
	padding: `0 ${buttonPaddingInline}`,

	vars: {
		[buttonColor]: vars.color.action.primary.bg, // 기본 본색
		[buttonSurface]: vars.color.surface.base, // 버튼이 얹히는 표면
		[buttonBorderStrength]: vars.mix.brand.border, // "30%"
		[buttonPaddingInline]: vars.spacing.md, // 기본 X padding
		[buttonHeight]: vars.size.control.md, // 기본 높이
	},

	// 공통 보더 공식: (버튼색 × 비율) + (표면색)
	border: `1px solid color-mix(in oklab, ${buttonColor} ${buttonBorderStrength}, ${buttonSurface})`,

	selectors: {
		"&:disabled": { pointerEvents: "none", opacity: vars.opacity.disabled },
		"&:focus-visible": {
			boxShadow: `0 0 0 ${vars.ring.width} ${vars.color.ring.focus}`,
		},
	},
});

/** Sizes */
export const size = styleVariants({
	xxs: { vars: { [buttonHeight]: vars.size.control.xxs, [buttonPaddingInline]: vars.spacing.xs } },
	xs: { vars: { [buttonHeight]: vars.size.control.xs, [buttonPaddingInline]: vars.spacing.xs } },
	sm: { vars: { [buttonHeight]: vars.size.control.sm, [buttonPaddingInline]: vars.spacing.sm } },
	md: { vars: { [buttonHeight]: vars.size.control.md, [buttonPaddingInline]: vars.spacing.md } },
	lg: { vars: { [buttonHeight]: vars.size.control.lg, [buttonPaddingInline]: vars.spacing.lg } },
	icon: { vars: { [buttonHeight]: vars.size.control.md, [buttonPaddingInline]: "0px" }, width: buttonHeight, padding: 0 },
});

/** Variants */
export const variant = styleVariants({
	/** Solid / Primary */
	default: {
		backgroundColor: buttonColor,
		color: vars.color.action.primary.fg,
		boxShadow: vars.elevation[1],
		selectors: {
			"&:hover": {
				backgroundColor: `color-mix(in oklab, ${buttonColor} ${vars.mix.brand.hover}, ${buttonSurface})`,
				boxShadow: vars.elevation[2],
			},
			"&:active": {
				backgroundColor: `color-mix(in oklab, ${buttonColor} ${vars.mix.brand.active}, ${buttonSurface})`,
				boxShadow: vars.elevation[1],
			},
		},
	},

	/** Outline */
	outline: {
		backgroundColor: buttonSurface,
		color: buttonColor,
		vars: { [buttonBorderStrength]: "45%" },
		boxShadow: vars.elevation[0],
		selectors: {
			"&:hover": {
				backgroundColor: `color-mix(in oklab, ${buttonColor} ${vars.mix.brand.subtle}, ${buttonSurface})`,
			},
		},
	},

	/** Ghost */
	ghost: {
		backgroundColor: "transparent",
		color: buttonColor,
		vars: { [buttonBorderStrength]: "15%" },
		boxShadow: vars.elevation[0],
		selectors: {
			"&:hover": {
				backgroundColor: `color-mix(in oklab, ${buttonColor} 10%, ${buttonSurface})`,
			},
		},
	},

	/** Secondary (neutral palette) */
	secondary: {
		backgroundColor: vars.color.action.secondary.bg,
		color: vars.color.action.secondary.fg,
		border: `1px solid ${vars.color.action.secondary.border}`,
		boxShadow: vars.elevation[0],
		selectors: {
			"&:hover": { backgroundColor: vars.color.action.secondary.hover },
			"&:active": { backgroundColor: vars.color.action.secondary.active },
		},
	},

	/** Destructive */
	destructive: {
		vars: { [buttonColor]: vars.color.intent.danger },
		backgroundColor: buttonColor,
		color: vars.color.text.inverse,
		boxShadow: vars.elevation[1],
		selectors: {
			"&:hover": {
				backgroundColor: `color-mix(in oklab, ${buttonColor} ${vars.mix.brand.hover}, ${buttonSurface})`,
				boxShadow: vars.elevation[2],
			},
			"&:active": {
				backgroundColor: `color-mix(in oklab, ${buttonColor} ${vars.mix.brand.active}, ${buttonSurface})`,
				boxShadow: vars.elevation[1],
			},
			"&:focus-visible": {
				boxShadow: `0 0 0 ${vars.ring.width} color-mix(in oklab, ${buttonColor} 40%, transparent)`,
			},
		},
	},

	/** Link */
	link: {
		backgroundColor: "transparent",
		color: buttonColor,
		border: "1px solid transparent",
		textDecoration: "underline transparent",
		textUnderlineOffset: 4,
		boxShadow: vars.elevation[0],
		selectors: {
			"&:hover": { textDecorationColor: buttonColor },
		},
	},
});
