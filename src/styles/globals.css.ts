import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./vars.css";

// 혼색 비율을 토큰으로 빼두면 더 유연(2번에서 정의)
// 기존 brand용 퍼센트 그대로 유지
const hoverPct = vars.mix.brand.hover;
const activePct = vars.mix.brand.active;
const borderPct = vars.mix.brand.border;
const subtlePct = vars.mix.brand.subtle;

// ✅ secondary용 퍼센트
const sHover = vars.mix.secondary.hover;
const sActive = vars.mix.secondary.active;
const sBorder = vars.mix.secondary.border;
const sSubtle = vars.mix.secondary.subtle;

globalStyle(":root", {
	vars: {
		// 1) brand.base = oklch(L C h)
		[vars.color.brand.base]: `oklch(${vars.seed.brand.L} ${vars.seed.brand.C} ${vars.seed.brand.h})`,

		// 2) 파생은 전부 surface.base와 혼색 (transparent 금지)
		[vars.color.brand.hover]: `color-mix(in oklab, ${vars.color.brand.base} ${hoverPct}, ${vars.color.surface.base})`,
		[vars.color.brand.active]: `color-mix(in oklab, ${vars.color.brand.base} ${activePct}, ${vars.color.surface.base})`,
		[vars.color.brand.border]: `color-mix(in oklab, ${vars.color.brand.base} ${borderPct}, ${vars.color.surface.base})`,
		[vars.color.brand.subtle]: `color-mix(in oklab, ${vars.color.brand.base} ${subtlePct}, ${vars.color.surface.base})`,

		// 3) focus ring도 brand 기준
		[vars.color.ring.focus]: `color-mix(in oklab, ${vars.color.brand.base} 40%, transparent)`,

		// 4) action.primary = brand 별칭 (나중에 분리하면 여기만 수정)
		[vars.color.action.primary.bg]: vars.color.brand.base,
		[vars.color.action.primary.fg]: vars.color.text.onBrand,
		[vars.color.action.primary.hover]: vars.color.brand.hover,
		[vars.color.action.primary.active]: vars.color.brand.active,
		[vars.color.action.primary.border]: vars.color.brand.border,
		[vars.color.action.primary.subtle]: vars.color.brand.subtle,

		// --- ✅ secondary: 뉴트럴(무채) 혼색 ---
		// 배경: 기본은 surface.subtle 자체
		[vars.color.action.secondary.bg]: vars.color.surface.subtle,
		[vars.color.action.secondary.fg]: vars.color.text.base,

		// hover/active: 표면(surf.subtle)에 "텍스트 베이스"를 소량 섞어 어둡게
		[vars.color.action.secondary.hover]: `color-mix(in oklab, ${vars.color.text.base} ${sHover}, ${vars.color.surface.subtle})`,
		[vars.color.action.secondary.active]: `color-mix(in oklab, ${vars.color.text.base} ${sActive}, ${vars.color.surface.subtle})`,

		// border: 표면(base)을 기준으로 살짝 어둡게
		[vars.color.action.secondary.border]: `color-mix(in oklab, ${vars.color.text.base} ${sBorder}, ${vars.color.surface.base})`,

		// subtle: 표면(base)에 더 옅게 (칩/토글 같은 배경)
		[vars.color.action.secondary.subtle]: `color-mix(in oklab, ${vars.color.text.base} ${sSubtle}, ${vars.color.surface.base})`,

		// Elevations
		// 레벨을 내부 변수로 노출 (별칭이 가리킬 수 있게)
		["--elev-0" as any]: vars.elevation[0],
		["--elev-1" as any]: vars.elevation[1],
		["--elev-2" as any]: vars.elevation[2],
		["--elev-3" as any]: vars.elevation[3],
		["--elev-4" as any]: vars.elevation[4],
		["--elev-5" as any]: vars.elevation[5],

		// 별칭 → 레벨 매핑
		[vars.elevation.flat as any]: "var(--elev-0)",
		[vars.elevation.raised as any]: "var(--elev-1)",
		[vars.elevation.raisedHover as any]: "var(--elev-2)",
		[vars.elevation.overlay as any]: "var(--elev-3)",
		[vars.elevation.modal as any]: "var(--elev-4)",
		[vars.elevation.toast as any]: "var(--elev-5)",

		// Links
		[vars.color.link.fg]: vars.color.text.base,
		[vars.color.link.underline]: vars.color.text.base,
		[vars.color.link.visited]: `color-mix(in oklab, ${vars.color.text.base} 65%, ${vars.color.surface.base})`, // 살짝 옅게
		[vars.color.link.hover]: vars.color.text.base,
		[vars.color.link.active]: vars.color.text.base,
	},
});

globalStyle("*, *::before, *::after", {
	boxSizing: "border-box",
});

globalStyle("html, body", {
	fontFamily: vars.typography.family.body,
	fontSize: vars.typography.size.md,
	lineHeight: vars.typography.line.normal,
	WebkitFontSmoothing: "antialiased",
	MozOsxFontSmoothing: "grayscale",
});

globalStyle("body", {
	margin: 0,
});

globalStyle("h1, h2, h3, h4, h5, h6, p", {
	margin: 0,
});

globalStyle("ul, ol", {
	padding: 0,
	margin: 0,
	listStyle: "none",
});

globalStyle("button", {
	all: "unset",
});

globalStyle("a", {
	color: vars.color.link.fg,
	textDecoration: "underline",
	textDecorationColor: vars.color.link.underline,
	textUnderlineOffset: "2px",
	textDecorationThickness: "from-font",
});
globalStyle("a:visited", {
	color: vars.color.link.visited,
	textDecorationColor: vars.color.link.visited,
});
globalStyle("a:hover", {
	// 색은 그대로, 밑줄만 강조 (B/W 유지)
	textDecorationThickness: "2px",
	textUnderlineOffset: "3px",
});
globalStyle("a:active", {
	color: vars.color.link.active,
});
globalStyle("a:focus-visible", {
	outline: "none",
	boxShadow: `0 0 0 ${vars.ring.width} ${vars.color.ring.focus}`,
	borderRadius: vars.radius.sm,
});
