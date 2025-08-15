import { recipe } from "@vanilla-extract/recipes";
import { style, globalStyle } from "@vanilla-extract/css";
import { vars } from "@/styles/vars.css";

/** 그룹 컨테이너 */
export const group = recipe({
	base: {
		display: "flex",
		alignItems: "center",
		width: "fit-content",
		borderRadius: vars.radius.md,
		position: "relative",
	},
	variants: {
		variant: {
			default: {
				// 평평하게
				boxShadow: vars.elevation.flat,
			},
			outline: {
				// 원본의 shadow-xs 느낌: 살짝만 띄움
				boxShadow: vars.elevation.raised,
			},
			primary: {
				boxShadow: vars.elevation.flat,
			},
		},
		size: {
			xs: {},
			sm: {},
			default: {},
			lg: {},
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

/** 개별 아이템: 그룹 내에서의 보정 (rounded-none, first/last radius, focus z-index 등) */
export const itemAdjust = style({
	flex: "1 0 auto",
	minWidth: 0,
	borderRadius: 0,
	boxShadow: "none",
	selectors: {
		"&:focus, &:focus-visible": {
			zIndex: 10,
		},
		"&:first-child": {
			borderTopLeftRadius: vars.radius.md,
			borderBottomLeftRadius: vars.radius.md,
		},
		"&:last-child": {
			borderTopRightRadius: vars.radius.md,
			borderBottomRightRadius: vars.radius.md,
		},
	},
});

/**
 * Outline 변형일 때: 가운데 경계선 보더 겹침 제거
 * - 첫 아이템만 왼쪽 보더 유지
 * - 나머지 아이템은 왼쪽 보더 제거
 * 주의: ve는 후손 셀렉터를 style 내부에서 못 쓰므로 globalStyle로 처리
 */
globalStyle(`${itemAdjust}[data-variant="outline"]:not(:first-child)`, {
	borderLeft: "0",
});

globalStyle(`${itemAdjust}[data-variant="outline"]:first-child`, {
	borderLeft: `1px solid ${vars.color.neutral.border}`,
});
