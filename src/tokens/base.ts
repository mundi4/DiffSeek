// // tokens/base.css.ts
// import { createGlobalTheme, globalStyle } from "@vanilla-extract/css";

// /**
//  * 설계 포인트
//  * - contract 없이 단일 createGlobalTheme 사용
//  * - OKLCH 시드(L/C/h)로 brand 파생 자동 계산 (color-mix in oklab)
//  * - 블랙&화이트 기반의 뉴트럴 표면/텍스트
//  * - action.primary는 기본적으로 brand alias
//  */

// export const t = createGlobalTheme(":root", {
// 	seed: {
// 		// 브랜드 시드 (원할 때 이 값만 갈아끼우면 전체 파생 재계산)
// 		brand: {
// 			L: "0.35", // 0~1 (기본: 짙은 버튼 느낌)
// 			C: "0.02", // 0~? (기본: 거의 모노톤)
// 			h: "0deg", // 각도 (기본: 중립, 나중에 270deg 등으로 교체)
// 		},
// 	},

// 	color: {
// 		surface: {
// 			base: "#ffffff",
// 			raised: "#ffffff",
// 			overlay: "#ffffff",
// 			subtle: "#f5f6f7", // 살짝만 톤
// 			scrim: "color-mix(in oklab, #000 30%, transparent)",
// 		},
// 		text: {
// 			base: "#121316",
// 			muted: "#6c6b72",
// 			subtle: "#9e9ea5",
// 			inverse: "#ffffff",
// 			onBrand: "#ffffff",
// 		},

// 		// brand 파생(초기값은 placeholder, 아래 globalStyle에서 시드 기반으로 덮음)
// 		brand: {
// 			base: "oklch(0.35 0.02 0deg)",
// 			hover: "oklch(0.38 0.02 0deg)",
// 			active: "oklch(0.32 0.02 0deg)",
// 			border: "#e5e6ea",
// 			subtle: "oklch(0.96 0.01 0deg)",
// 		},

// 		// primary 액션은 기본 brand alias (필요하면 나중에 분리)
// 		action: {
// 			primary: {
// 				bg: "oklch(0.35 0.02 0deg)",
// 				fg: "#ffffff",
// 				hover: "oklch(0.38 0.02 0deg)",
// 				active: "oklch(0.32 0.02 0deg)",
// 				border: "#e5e6ea",
// 				subtle: "oklch(0.96 0.01 0deg)",
// 			},
// 		},

// 		neutral: {
// 			border: "#dcdde3",
// 			borderMuted: "#eceef3",
// 			bgSubtle: "#f5f6f7",
// 		},

// 		intent: {
// 			info: "#3f3f46",
// 			success: "#10b981",
// 			warning: "#facc15",
// 			danger: "#ef4444",
// 		},

// 		ring: {
// 			focus: "color-mix(in oklab, oklch(0.35 0.02 0deg) 40%, transparent)",
// 		},
// 	},

// 	// 최소한의 스케일(컨트롤/아이콘/라운드/스페이싱만 유지)
// 	size: {
// 		control: { xxs: "20px", xs: "24px", sm: "28px", md: "32px", lg: "36px" },
// 		icon: { sm: "16px", md: "20px", lg: "24px" },
// 	},

// 	radius: { sm: "4px", md: "8px", lg: "12px", xl: "16px", pill: "9999px" },

// 	spacing: {
// 		xxs: "2px",
// 		xs: "4px",
// 		sm: "6px",
// 		md: "8px",
// 		lg: "12px",
// 		xl: "16px",
// 		"2xl": "24px",
// 	},

// 	typography: {
// 		family: { body: "system-ui, sans-serif", mono: "'Nanum Gothic Coding','돋움체',Consolas,monospace" },
// 		weight: { extralight: "200", light: "300", regular: "400", medium: "500", semibold: "600", bold: "700", extrabold: "800" },
// 		size: { xs: "12px", sm: "14px", md: "16px", lg: "18px", xl: "20px" },
// 		line: { none: "1", tight: "1.2", normal: "1.5", loose: "1.7" },
// 		letter: { tight: "-0.005em", normal: "0", wide: "0.02em" },
// 	},

// 	elevation: {
// 		0: "none",
// 		1: "0 1px 2px rgba(0,0,0,.05)",
// 		2: "0 2px 6px rgba(0,0,0,.08)",
// 		3: "0 6px 12px rgba(0,0,0,.10)",
// 		4: "0 10px 20px rgba(0,0,0,.12)",
// 		5: "0 16px 32px rgba(0,0,0,.14)",
// 	},

// 	opacity: { disabled: "0.5", subtle: "0.75" },

// 	zIndex: { base: "0", dropdown: "1000", popover: "1300", modal: "1500", overlay: "1600", tooltip: "1700" },

// 	motion: {
// 		duration: { fast: "150ms", normal: "250ms", slow: "400ms" },
// 		easing: { standard: "cubic-bezier(.2,.8,.2,1)" },
// 	},
// });

// /**
//  * 시드 → 파생 자동 계산 (OKLCH)
//  * - brand.base = oklch(L C h)
//  * - hover/active/border/subtle/ring은 surface.base를 기준으로 혼색
//  * - action.primary는 brand alias
//  */
// globalStyle(":root", {
// 	vars: {
// 		// 브랜드 본색
// 		[t.color.brand.base]: `oklch(${t.seed.brand.L} ${t.seed.brand.C} ${t.seed.brand.h})`,

// 		// 파생 (표면색 기준으로 섞음: 대비 안정)
// 		[t.color.brand.hover]: `color-mix(in oklab, ${t.color.brand.base} 90%, ${t.color.surface.base})`,
// 		[t.color.brand.active]: `color-mix(in oklab, ${t.color.brand.base} 80%, ${t.color.surface.base})`,
// 		[t.color.brand.border]: `color-mix(in oklab, ${t.color.brand.base} 30%, ${t.color.surface.base})`,
// 		[t.color.brand.subtle]: `color-mix(in oklab, ${t.color.brand.base} 12%, ${t.color.surface.base})`,

// 		// 포커스 링
// 		[t.color.ring.focus]: `color-mix(in oklab, ${t.color.brand.base} 40%, transparent)`,

// 		// action.primary ← brand alias (나중에 분리 원하면 여기만 바꾸면 됨)
// 		[t.color.action.primary.bg]: t.color.brand.base,
// 		[t.color.action.primary.fg]: t.color.text.onBrand,
// 		[t.color.action.primary.hover]: t.color.brand.hover,
// 		[t.color.action.primary.active]: t.color.brand.active,
// 		[t.color.action.primary.border]: t.color.brand.border,
// 		[t.color.action.primary.subtle]: t.color.brand.subtle,
// 	},
// });
