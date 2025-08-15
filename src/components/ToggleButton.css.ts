// import { globalStyle } from "@vanilla-extract/css";
// import { recipe } from "@vanilla-extract/recipes";
// import { vars } from "@/styles/vars.css";

// export const toggleButton = recipe({
// 	base: {
// 		display: "inline-flex",
// 		alignItems: "center",
// 		justifyContent: "center",
// 		gap: vars.spacing.xs,
// 		cursor: "pointer",
// 		userSelect: "none",
// 		borderRadius: vars.radius.sm,

// 		fontWeight: vars.typography.weight.medium,
// 		lineHeight: vars.typography.line.tight,

// 		transition: [
// 			`background-color ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
// 			`border-color ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
// 			`box-shadow ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
// 			`color ${vars.motion.duration.normal} ${vars.motion.easing.standard}`,
// 		].join(", "),

// 		// 기본(미체크) 중립 베이스
// 		backgroundColor: vars.color.surface.base,
// 		color: vars.color.text.base,
// 		border: `1px solid ${vars.color.neutral.border}`,

// 		selectors: {
// 			"&:focus-visible": {
// 				boxShadow: `0 0 0 ${vars.ring.width} ${vars.color.ring.focus}`,
// 			},
// 		},
// 	},

// 	variants: {
// 		tone: {
// 			primary: {}, // brand 계열
// 			secondary: {}, // neutral 계열
// 		},
// 		checked: {
// 			true: {},
// 			false: {},
// 		},
// 		disabled: {
// 			true: { opacity: vars.opacity.disabled, cursor: "not-allowed", pointerEvents: "none" },
// 			false: {},
// 		},
// 		size: {
// 			sm: {
// 				fontSize: vars.typography.size.sm,
// 				height: vars.size.control.xs, // 24px
// 				padding: `${vars.spacing.xs} ${vars.spacing.xs}`,
// 			},
// 			md: {
// 				fontSize: vars.typography.size.md,
// 				height: vars.size.control.md, // 32px
// 				padding: `${vars.spacing.sm} ${vars.spacing.md}`,
// 			},
// 		},
// 	},

// 	// 상태 × 톤 조합별 색/호버 정의
// 	compoundVariants: [
// 		// --- PRIMARY 톤 ---
// 		{
// 			tone: "primary",
// 			checked: false,
// 			style: {
// 				backgroundColor: vars.color.surface.base,
// 				color: vars.color.text.base,
// 				border: `1px solid ${vars.color.neutral.border}`,
// 				selectors: {
// 					"&:hover": {
// 						// 표면 기준의 은은한 브랜드 틴트
// 						backgroundColor: vars.color.brand.subtle,
// 					},
// 					"&:active": {
// 						backgroundColor: `color-mix(in oklab, ${vars.color.brand.base} ${vars.mix.brand.subtle}, ${vars.color.surface.base})`,
// 					},
// 				},
// 			},
// 		},
// 		{
// 			tone: "primary",
// 			checked: true,
// 			style: {
// 				backgroundColor: vars.color.action.primary.bg,
// 				color: vars.color.action.primary.fg,
// 				border: `1px solid ${vars.color.action.primary.border}`,
// 				selectors: {
// 					"&:hover": { backgroundColor: vars.color.action.primary.hover },
// 					"&:active": { backgroundColor: vars.color.action.primary.active },
// 				},
// 			},
// 		},

// 		// --- SECONDARY 톤 (뉴트럴) ---
// 		{
// 			tone: "secondary",
// 			checked: false,
// 			style: {
// 				backgroundColor: vars.color.action.secondary.bg, // surface.subtle
// 				color: vars.color.text.base,
// 				border: `1px solid ${vars.color.action.secondary.border}`,
// 				selectors: {
// 					"&:hover": { backgroundColor: vars.color.action.secondary.hover },
// 					"&:active": { backgroundColor: vars.color.action.secondary.active },
// 				},
// 			},
// 		},
// 		{
// 			tone: "secondary",
// 			checked: true,
// 			style: {
// 				// 체크 시 살짝 더 진한 뉴트럴
// 				backgroundColor: vars.color.action.secondary.active,
// 				color: vars.color.text.base,
// 				border: `1px solid ${vars.color.action.secondary.border}`,
// 				selectors: {
// 					"&:hover": {
// 						backgroundColor: `color-mix(in oklab, ${vars.color.text.base} ${vars.mix.secondary.border}, ${vars.color.action.secondary.active})`,
// 					},
// 				},
// 			},
// 		},
// 	],

// 	defaultVariants: {
// 		tone: "primary",
// 		checked: false,
// 		size: "md",
// 		disabled: false,
// 	},
// });

// // ===== SVG 아이콘 정리 =====

// // 아이콘은 currentColor를 상속받게
// globalStyle(`${toggleButton.classNames.base} svg`, {
// 	flexShrink: 0,
// 	pointerEvents: "none",
// 	verticalAlign: "middle",
// 	fill: "currentColor",
// 	stroke: "currentColor",
// });

// // 사이즈별 아이콘 크기
// globalStyle(`${toggleButton.classNames.variants.size.sm} svg`, {
// 	width: vars.size.icon.sm,
// 	height: vars.size.icon.sm,
// });

// globalStyle(`${toggleButton.classNames.variants.size.md} svg`, {
// 	width: vars.size.icon.md,
// 	height: vars.size.icon.md,
// });
