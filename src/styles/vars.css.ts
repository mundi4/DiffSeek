import { createGlobalTheme } from "@vanilla-extract/css";

export const vars = createGlobalTheme(":root", {
	seed: {
		brand: {
			L: "0.35",
			C: "0",
			h: "0deg",
		},
	},

	color: {
		surface: {
			base: "#ffffff",
			raised: "#ffffff",
			overlay: "#ffffff",
			subtle: "#f5f6f7",
			scrim: "color-mix(in oklab, #000 30%, transparent)",
		},
		
		text: {
			base: "#121316",
			muted: "#6c6b72",
			subtle: "#9e9ea5",
			inverse: "#ffffff",
			onBrand: "#ffffff",
		},

		brand: {
			base: "oklch(0.62 0.16 270deg)",
			hover: "color-mix(in oklab, oklch(0.62 0.16 270deg) 90%, #fff)",
			active: "color-mix(in oklab, oklch(0.62 0.16 270deg) 80%, #fff)",
			border: "color-mix(in oklab, oklch(0.62 0.16 270deg) 30%, #fff)",
			subtle: "color-mix(in oklab, oklch(0.62 0.16 270deg) 12%, #fff)",
		},

		action: {
			primary: {
				bg: "oklch(0.62 0.16 270deg)",
				fg: "#ffffff",
				hover: "color-mix(in oklab, oklch(0.62 0.16 270deg) 90%, #fff)",
				active: "color-mix(in oklab, oklch(0.62 0.16 270deg) 80%, #fff)",
				border: "color-mix(in oklab, oklch(0.62 0.16 270deg) 30%, #fff)",
				subtle: "color-mix(in oklab, oklch(0.62 0.16 270deg) 12%, #fff)",
			},
			secondary: {
				bg: "#f5f6f7",
				fg: "#121316",
				hover: "#eceef3",
				active: "#e5e6ea",
				border: "#dcdde3",
				subtle: "#f7f8f9",
			},
		},

		neutral: {
			border: "#dcdde3",
			borderMuted: "#eceef3",
			bgSubtle: "#f5f6f7",
		},

		intent: {
			info: "#3f3f46",
			success: "#10b981",
			warning: "#facc15",
			danger: "#ef4444",
		},

		ring: {
			focus: "color-mix(in oklab, oklch(0.62 0.16 270deg) 40%, transparent)",
		},

		link: {
			fg: "#121316",
			visited: "#5a5b60",
			hover: "#121316",
			active: "#121316",
			underline: "#121316",
		},
	},

	spacing: {
		xxs: "2px",
		xs: "4px",
		sm: "6px",
		md: "8px",
		lg: "12px",
		xl: "16px",
		"2xl": "24px",
	},

	size: {
		control: {
			xxs: "20px",
			xs: "24px",
			sm: "28px",
			md: "32px",
			lg: "36px",
		},
		icon: {
			sm: "16px",
			md: "20px",
			lg: "24px",
		},
	},

	radius: {
		xs: "2px",
		sm: "4px",
		md: "8px",
		lg: "12px",
		xl: "16px",
		pill: "9999px",
	},

	borderWidth: {
		hairline: "0.5px",
		thin: "1px",
		thick: "2px",
	},

	ring: {
		width: "3px",
		offset: "0px",
	},

	typography: {
		family: {
			body: `system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR",
             "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
			mono: `'Nanum Gothic Coding', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`,
		},
		weight: { extralight: "200", light: "300", regular: "400", medium: "500", semibold: "600", bold: "700", extrabold: "800" },
		size: { 
			xs: "12px", 
			sm: "14px", 
			md: "16px", 
			lg: "18px", 
			xl: "20px" 
		},
		line: { tight: "1.2", normal: "1.5", loose: "1.7" },
		letter: { tight: "-0.005em", normal: "0", wide: "0.02em" },
	},

	elevation: {
		0: "none",
		1: "0 1px 2px rgba(17, 23, 41, 0.06), 0 1px 1px rgba(17, 23, 41, 0.03)",
		2: "0 2px 6px rgba(17, 23, 41, 0.10), 0 1px 2px rgba(17, 23, 41, 0.04)",
		3: "0 6px 12px rgba(17, 23, 41, 0.12), 0 2px 4px rgba(17, 23, 41, 0.06)",
		4: "0 10px 20px rgba(17, 23, 41, 0.14), 0 4px 8px rgba(17, 23, 41, 0.07)",
		5: "0 16px 32px rgba(17, 23, 41, 0.16), 0 6px 12px rgba(17, 23, 41, 0.08)",

		flat: "none",
		raised: "var(--elev-1)",
		raisedHover: "var(--elev-2)",
		overlay: "var(--elev-3)",
		modal: "var(--elev-4)",
		toast: "var(--elev-5)",
	},

	opacity: {
		disabled: "0.5",
		subtle: "0.75",
		invisible: "0.25",
	},

	zIndex: {
		base: "0",
		dropdown: "1000",
		popover: "1300",
		modal: "1500",
		overlay: "1600",
		tooltip: "1700",
	},

	motion: {
		duration: {
			fast: "150ms",
			normal: "250ms",
			slow: "400ms",
		},
		easing: {
			standard: "cubic-bezier(.2,.8,.2,1)",
			emphasized: "cubic-bezier(.2,.0,.0,1)",
			decel: "cubic-bezier(0,0,.2,1)",
			accel: "cubic-bezier(.4,0,1,1)",
		},
	},

	mix: {
		brand: {
			hover: "90%",
			active: "80%",
			border: "30%",
			subtle: "12%",
		},
		secondary: {
			hover: "10%",
			active: "14%",
			border: "22%",
			subtle: "6%",
		},
	},
});
