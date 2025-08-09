import { vars } from "@/styles/vars.css";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const bar = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: `${vars.spacing.xs} ${vars.spacing.xs}`,
	borderBottom: `1px solid ${vars.color.border.muted}`,
	backgroundColor: vars.color.background.muted,
	gap: vars.spacing.xs,
});

export const leftGroup = style({
	display: "flex",
	alignItems: "center",
	gap: vars.spacing.xs,
});

export const rightGroup = style({
	display: "flex",
	alignItems: "center",
	gap: vars.spacing.xs,
	marginLeft: "auto", // ✅ 확실하게 오른쪽으로 밀어붙임
});

// ⋯ 버튼 (DropdownMenu.Trigger)
export const overflowMenuTrigger = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "28px",
	height: "28px",
	borderRadius: vars.radius.sm,
	backgroundColor: vars.color.background.base,
	color: vars.color.foreground.muted,
	border: `1px solid ${vars.color.border.muted}`, // ✅ 연한 테두리
	fontSize: "18px",
	lineHeight: "1",
	padding: 0,
	cursor: "pointer",
	transition: vars.transition.fast,

	selectors: {
		"&:hover": {
			backgroundColor: vars.color.background.muted,
			color: vars.color.foreground.base,
			borderColor: vars.color.border.base, // hover 시 강조
		},
		"&:focus": {
			outline: "none",
			boxShadow: `0 0 0 2px ${vars.color.control.active}`, // subtle focus ring
		},
	},
});

// 메뉴 박스 (DropdownMenu.Content)
export const overflowMenuContent = style({
	backgroundColor: vars.color.background.base,
	borderRadius: vars.radius.sm,
	boxShadow: vars.shadow.md,
	padding: vars.spacing.xs,
	zIndex: vars.zIndex.dropdown,
	overflow: "hidden",
});

// 각 항목 (DropdownMenu.Item)
export const overflowMenuItem = recipe({
	base: {
		padding: vars.spacing.xs,
		borderRadius: vars.radius.sm,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: vars.color.foreground.base,
		cursor: "pointer",
		transition: vars.transition.fast,

		selectors: {
			"&:hover": {
				backgroundColor: vars.color.background.muted,
			},
		},
	},

	variants: {
		active: {
			true: {
				backgroundColor: vars.color.control.active,
				color: "#ffffff",
			},
			false: {},
		},
	},
});
