import { createGlobalTheme } from "@vanilla-extract/css";

export const vars = createGlobalTheme(":root", {
	color: {
		background: {
			base: "#fdfbff", // slightly tinted white
			muted: "#f4f1f9", // muted lavender gray
		},
		foreground: {
			base: "#2c2b30", // dark with a hint of violet
			muted: "#6c6b72", // soft slate
			subtle: "#9e9ea5", // desaturated blue-gray
		},
		border: {
			base: "#d8d4e0", // gray-purple border
			muted: "#e9e7ef",
		},
		control: {
			active: "#3f3f46",
			inactive: "#e5e5e5",
			handle: "#ffffff",
		},
		feedback: {
			danger: "#ef4444",
			warning: "#facc15",
			success: "#10b981",
			info: "#3f3f46",
		},
		accent: {
 primary: "#7928ca",
  secondary: "#3b82f6",
  subtle: "#cbb5e2"
		},
	},
	font: {
		body: "system-ui, sans-serif",
		mono: "'Nanum Gothic Coding', '돋움체', monospace",
	},
	fontSize: {
		sm: "12px",
		base: "14px",
		md: "16px",
		lg: "20px",
	},
	spacing: {
		none: "0",
		xs: "4px",
		sm: "8px",
		md: "12px",
		lg: "16px",
		xl: "24px",
	},
	radius: {
		sm: "4px",
		md: "8px",
		lg: "12px",
		pill: "9999px",
	},
	shadow: {
		sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
		md: "0 2px 4px rgba(0, 0, 0, 0.08)",
		lg: "0 4px 8px rgba(0, 0, 0, 0.08)",
	},
	opacity: {
		disabled: "0.5",
		subtle: "0.75",
	},
	zIndex: {
		base: "0",
		dropdown: "1000",
		modal: "1100",
		overlay: "1200",
		popover: "1300",
		tooltip: "1400",
	},
	transition: {
		fast: "all 0.15s ease",
		normal: "all 0.25s ease",
		slow: "all 0.4s ease",
	},
	transform: {
		slideX: "translateX(16px)",
		reset: "translateX(0)",
	},
	size: {
		toggle: {
			width: "40px",
			height: "24px",
			handle: "20px",
			padding: "2px",
		},
		icon: {
			sm: "16px",
			md: "20px",
			lg: "24px",
		},
	},
});
