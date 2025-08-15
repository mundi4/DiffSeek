import { globalStyle, keyframes, style, styleVariants } from "@vanilla-extract/css";
import type { ComplexStyleRule } from "@vanilla-extract/css";
import { vars } from "@/styles/vars.css";

/* ========== Animations ========== */
const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const fadeOut = keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });
const zoomIn = keyframes({ from: { transform: "scale(0.98)" }, to: { transform: "scale(1)" } });
const zoomOut = keyframes({ from: { transform: "scale(1)" }, to: { transform: "scale(0.98)" } });
const slideInFromTop = keyframes({ from: { transform: "translateY(-8px)" }, to: { transform: "translateY(0)" } });
const slideInFromBottom = keyframes({ from: { transform: "translateY(8px)" }, to: { transform: "translateY(0)" } });
const slideInFromLeft = keyframes({ from: { transform: "translateX(-8px)" }, to: { transform: "translateX(0)" } });
const slideInFromRight = keyframes({ from: { transform: "translateX(8px)" }, to: { transform: "translateX(0)" } });

/* ========== Content / SubContent ========== */
export const content = style({
	display: "block",
	position: "relative",
	background: vars.color.surface.base,
	color: vars.color.text.base,
	zIndex: vars.zIndex.popover,
	maxHeight: "var(--radix-dropdown-menu-content-available-height, 80vh)",
	minWidth: "8rem",
	overflowX: "hidden",
	overflowY: "auto",
	border: `1px solid ${vars.color.neutral.border}`,
	borderRadius: vars.radius.md,
	boxShadow: vars.elevation[2], // 이전 md ≈ 2
	padding: vars.spacing.xs,
	transformOrigin: "var(--radix-dropdown-menu-content-transform-origin, center)",
});

export const subContent = style({
	display: "block",
	position: "relative",
	background: vars.color.surface.base,
	color: vars.color.text.base,
	zIndex: vars.zIndex.popover,
	minWidth: "8rem",
	overflow: "hidden",
	border: `1px solid ${vars.color.neutral.border}`,
	borderRadius: vars.radius.md,
	boxShadow: vars.elevation[3], // 이전 lg ≈ 3
	padding: vars.spacing.xs,
	transformOrigin: "var(--radix-dropdown-menu-content-transform-origin, center)",
});

/* 상태/방향 애니메이션 (대상은 항상 &) */
export const contentState = style({
	selectors: {
		'&[data-state="open"]': {
			animation: `${fadeIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${zoomIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}`,
		},
		'&[data-state="closed"]': {
			animation: `${fadeOut} 100ms ${vars.motion.easing.standard}, ${zoomOut} 100ms ${vars.motion.easing.standard}`,
		},
		'&[data-state="open"][data-side="top"]': {
			animation: `${fadeIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${zoomIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${slideInFromBottom} ${vars.motion.duration.fast} ${vars.motion.easing.standard}`,
		},
		'&[data-state="open"][data-side="bottom"]': {
			animation: `${fadeIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${zoomIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${slideInFromTop} ${vars.motion.duration.fast} ${vars.motion.easing.standard}`,
		},
		'&[data-state="open"][data-side="left"]': {
			animation: `${fadeIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${zoomIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${slideInFromRight} ${vars.motion.duration.fast} ${vars.motion.easing.standard}`,
		},
		'&[data-state="open"][data-side="right"]': {
			animation: `${fadeIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${zoomIn} ${vars.motion.duration.fast} ${vars.motion.easing.standard}, ${slideInFromLeft} ${vars.motion.duration.fast} ${vars.motion.easing.standard}`,
		},
	},
});

/* ========== Items (base + variants) ========== */
const baseItem: ComplexStyleRule = {
	position: "relative",
	display: "flex",
	alignItems: "center",
	gap: vars.spacing.sm, // 6px
	userSelect: "none",
	outline: "none",
	cursor: "default",
	fontSize: vars.typography.size.sm,
	lineHeight: vars.typography.line.normal,
	borderRadius: vars.radius.sm,
	paddingBlock: vars.spacing.sm, // 6px
	paddingInline: vars.spacing.md, // 8px
	color: vars.color.text.base,
	background: "transparent",
	selectors: {
		"&[data-disabled]": { opacity: vars.opacity.disabled, pointerEvents: "none" },
		"&:focus": { backgroundColor: vars.color.brand.subtle, color: vars.color.text.base },
	},
};

export const itemInset = style({ paddingLeft: "32px" });

export const itemKind = styleVariants({
	action: [baseItem],
	checkbox: [baseItem],
	radio: [baseItem],
});

export const itemVariant = styleVariants({
	default: {},
	destructive: {
		color: vars.color.intent.danger,
		selectors: {
			"&:focus": {
				backgroundColor: `color-mix(in oklab, ${vars.color.intent.danger} 12%, ${vars.color.surface.base})`,
			},
		},
	},
});

/* 체크/라디오 인디케이터 (플로우 참여) */
export const indicator = style({
	position: "static",
	display: "flex",
	width: "14px",
	height: "14px",
	alignItems: "center",
	justifyContent: "center",
	marginRight: vars.spacing.md, // 8px
	pointerEvents: "none",
	flexShrink: 0,
});

/* ========== Label / Separator / Shortcut ========== */
export const label = style({
	fontSize: vars.typography.size.sm,
	fontWeight: vars.typography.weight.semibold,
	paddingBlock: vars.spacing.sm, // 6px
	paddingInline: vars.spacing.md, // 8px
	selectors: { "&[data-inset]": { paddingLeft: "32px" } },
});

export const separator = style({
	height: "1px",
	backgroundColor: vars.color.neutral.border,
	marginBlock: vars.spacing.xs,
});

export const shortcut = style({
	marginLeft: "auto",
	fontSize: vars.typography.size.xs,
	letterSpacing: "0.08em",
	color: vars.color.text.subtle,
});

/* ========== SubTrigger ========== */
export const subTrigger = style({
	display: "flex",
	alignItems: "center",
	borderRadius: vars.radius.sm,
	paddingInline: vars.spacing.md,
	paddingBlock: vars.spacing.sm,
	fontSize: vars.typography.size.sm,
	cursor: "default",
	userSelect: "none",
	outline: "none",
	background: "transparent",
	selectors: {
		"&:focus": { backgroundColor: vars.color.brand.subtle, color: vars.color.text.base },
		'&[data-state="open"]': { backgroundColor: vars.color.brand.subtle, color: vars.color.text.base },
		"&[data-inset]": { paddingLeft: "32px" },
	},
});

/* ========== Icon sizing (descendant globals) ========== */
export const chevron = style({ marginLeft: "auto", width: "1rem", height: "1rem" });

globalStyle(`${itemKind.checkbox} ${indicator} svg`, {
	width: "1rem",
	height: "1rem",
	flexShrink: 0,
});

globalStyle(`${itemKind.radio} ${indicator} svg`, {
	width: "0.5rem",
	height: "0.5rem",
	flexShrink: 0,
	fill: "currentColor",
});
