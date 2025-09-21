import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/vars.css";

/* ====== Grid / Card ====== */
export const optionGrid = style({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: vars.spacing.lg,
	marginBottom: vars.spacing.xl,
});

export const optionCard = style({
	display: "flex",
	flexDirection: "column",
	gap: vars.spacing.sm,
	padding: vars.spacing.md,
	border: `1px solid ${vars.color.neutral.borderMuted}`,
	borderRadius: vars.radius.md,
	background: vars.color.surface.subtle,
});

export const optionLabel = style({
	fontSize: vars.typography.size.sm,
	fontWeight: vars.typography.weight.medium,
});

/* ====== Experimental Group ====== */
export const experimentalGroup = style({
	display: "flex",
	flexDirection: "column",
	gap: vars.spacing.lg,
	paddingTop: vars.spacing.lg,
	borderTop: `1px solid ${vars.color.neutral.borderMuted}`,
});

export const optionGroup = style({
	display: "flex",
	flexDirection: "column",
	gap: vars.spacing.md,
	background: vars.color.surface.overlay,
	borderRadius: vars.radius.md,
	padding: vars.spacing.md,
});

export const optionRow = style({
	display: "grid",
	gridTemplateColumns: "120px 1fr 60px", // 라벨 / 슬라이더 / 값
	alignItems: "center",
	gap: vars.spacing.md,
});

/* ====== Slider ====== */
export const sliderRoot = style({
	position: "relative",
	display: "flex",
	alignItems: "center",
	userSelect: "none",
	touchAction: "none",
	height: "20px",
	// 기본 색상
	selectors: {
		'&[data-disabled]': {
			opacity: 0.5, // 전체 투명도 줄임
			pointerEvents: "none",
		},
	},
});

export const sliderTrack = style({
	backgroundColor: vars.color.neutral.borderMuted,
	position: "relative",
	flexGrow: 1,
	borderRadius: vars.radius.sm,
	height: "4px",
});

export const sliderRange = style({
	position: "absolute",
	backgroundColor: vars.color.brand.base,
	borderRadius: vars.radius.sm,
	height: "100%",
});

export const sliderThumb = style({
	display: "block",
	width: "12px",
	height: "12px",
	backgroundColor: vars.color.brand.base,
	borderRadius: vars.radius.pill,
	cursor: "grab",
	selectors: {
		'&:hover': { backgroundColor: vars.color.brand.hover },
		'&:active': { backgroundColor: vars.color.brand.active },
		'[data-disabled] &': {
			backgroundColor: vars.color.neutral.border, // disabled thumb 색
			cursor: "default",
		},
	},
});

/* ====== Switch ====== */
export const switchRoot = style({
	width: "36px",
	height: "20px",
	background: vars.color.neutral.borderMuted,
	borderRadius: vars.radius.pill,
	position: "relative",
	cursor: "pointer",
	selectors: {
		'&[data-state="checked"]': {
			background: vars.color.brand.base,
		},
	},
});

export const switchThumb = style({
	display: "block",
	width: "16px",
	height: "16px",
	background: vars.color.surface.base,
	borderRadius: "50%",
	transition: "transform 150ms",
	transform: "translateX(2px)",
	selectors: {
		'&[data-state="checked"]': {
			transform: "translateX(18px)",
		},
	},
});

/* ====== Radio ====== */
export const radioRoot = style({
	display: "flex",
	flexDirection: "column",
	gap: vars.spacing.xs,
});

export const radioItem = style({
	all: "unset",
	width: "16px",
	height: "16px",
	borderRadius: "50%",
	border: `1px solid ${vars.color.neutral.border}`,
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	cursor: "pointer",
	background: vars.color.surface.base,
	selectors: {
		'&[data-state="checked"]': {
			borderColor: vars.color.brand.base,
		},
	},
});

export const radioIndicator = style({
	width: "8px",
	height: "8px",
	borderRadius: "50%",
	background: vars.color.brand.base,
});

export const descriptionText = style({
	fontSize: vars.typography.size.xs,
	color: vars.color.text.muted,
});