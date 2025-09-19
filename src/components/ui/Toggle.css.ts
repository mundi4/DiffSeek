// Toggle.css.ts
import { recipe, type RecipeVariants } from "@vanilla-extract/recipes";
import { globalStyle } from "@vanilla-extract/css";
import { vars } from "@/styles/vars.css";

export const toggle = recipe({
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: vars.spacing.md, // 기본 gap (variant에서 override 가능)
		borderRadius: vars.radius.md,
		whiteSpace: "nowrap",
		fontSize: vars.typography.size.sm,
		fontWeight: vars.typography.weight.medium,
		transition: `color ${vars.motion.duration.normal} ${vars.motion.easing.standard},
                 background-color ${vars.motion.duration.normal} ${vars.motion.easing.standard},
                 border-color ${vars.motion.duration.normal} ${vars.motion.easing.standard},
                 box-shadow ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
		selectors: {
			"&[disabled]": { opacity: vars.opacity.disabled, pointerEvents: "none" },
			"&[data-state='on']": {
				background: vars.color.brand.subtle,
				color: vars.color.text.base,
				borderColor: vars.color.brand.border,
			},
			"&:focus-visible": {
				outline: "none",
				boxShadow: `0 0 0 ${vars.ring.width} ${vars.color.ring.focus}`,
			},
		},
	},
	variants: {
		variant: {
			default: {
				background: "transparent",
				border: "1px solid transparent",
				selectors: { "&:hover": { background: vars.color.neutral.bgSubtle } },
			},
			outline: {
				background: "transparent",
				border: `1px solid ${vars.color.neutral.border}`,
				selectors: { "&:hover": { background: vars.color.neutral.bgSubtle } },
			},
			primary: {
				background: vars.color.action.primary.bg,
				color: vars.color.action.primary.fg,
				border: `1px solid ${vars.color.action.primary.border}`,
				selectors: {
					"&:hover": { background: vars.color.action.primary.hover },
					"&:active": { background: vars.color.action.primary.active },
					"&[data-state='on']": {
						background: vars.color.action.primary.active,
						color: vars.color.action.primary.fg,
					},
				},
			},
		},
		size: {
			/** 새로 추가된 xs (24px 컨트롤) */
			xs: {
				height: vars.size.control.xs, // 24px
				minWidth: vars.size.control.xxs,
				paddingInline: vars.spacing.xs, // 4px
				gap: vars.spacing.xxs, // 4px (아이콘/텍스트 간격도 축소)
			},
			sm: {
				height: vars.size.control.md, // 32px
				minWidth: vars.size.control.md,
				paddingInline: vars.spacing.sm, // 6px
				gap: vars.spacing.sm, // 6px
			},
			default: {
				height: vars.size.control.lg, // 36px
				minWidth: vars.size.control.lg,
				paddingInline: vars.spacing.md, // 8px
				// gap은 base의 md(8px) 그대로
			},
			lg: {
				height: vars.size.control.lg, // 36px
				minWidth: vars.size.control.lg,
				paddingInline: vars.spacing.lg, // 12px
				// gap은 base의 md(8px) 그대로 두거나, 필요시 vars.spacing.lg로 확대 가능
			},
		},
	},
	defaultVariants: { variant: "default", size: "default" },
});

export type ToggleVariants = RecipeVariants<typeof toggle>;

/** 아이콘 기본 크기 (size prop 없을 때) — base는 md로, size별로 override */
globalStyle(`${toggle.classNames.base} svg:not([class*="size-"])`, {
	width: vars.size.icon.md, // 기본값(md: 20px)
	height: vars.size.icon.md,
	flexShrink: 0,
	pointerEvents: "none",
});

/** size별 아이콘 크기 오버라이드 */
globalStyle(`${toggle.classNames.variants.size.xs} svg:not([class*="size-"])`, {
	width: vars.size.icon.sm, // 16px
	height: vars.size.icon.sm,
});
globalStyle(`${toggle.classNames.variants.size.sm} svg:not([class*="size-"])`, {
	width: vars.size.icon.md, // 20px
	height: vars.size.icon.md,
});
globalStyle(`${toggle.classNames.variants.size.default} svg:not([class*="size-"])`, {
	width: vars.size.icon.md, // 20px (명시적)
	height: vars.size.icon.md,
});
globalStyle(`${toggle.classNames.variants.size.lg} svg:not([class*="size-"])`, {
	width: vars.size.icon.lg, // 24px
	height: vars.size.icon.lg,
});
