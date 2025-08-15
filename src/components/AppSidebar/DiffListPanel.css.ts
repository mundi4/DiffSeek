import { vars } from "@/styles/vars.css";
import { style, styleVariants } from "@vanilla-extract/css";

const hoverStyles = {
	color: "hsl(0 100% 20%)",
	backgroundColor: "hsl(0 100% 80%)",
	outline: "1px solid hsl(0 100% 50%)",
};

export const list = style({
	//paddingInline: vars.spacing.xs,
});

export const listItem = style({
	marginBlock: vars.spacing.xs,
	display: "grid",
	gridTemplateColumns: "auto minmax(0, 1fr)",
	gridTemplateRows: "repeat(2, minmax(0, 1fr))",
	rowGap: vars.spacing.xs,
	columnGap: vars.spacing.xs,
	alignItems: "center",
	color: "hsl(var(--diff-hue) 100% 20%)",
	backgroundColor: "hsl(var(--diff-hue) 100% 80%)",
	outline: "1px solid hsl(var(--diff-hue) 100% 40%)",
	borderRadius: vars.radius.sm,
	padding: vars.spacing.xs,
	fontSize: vars.typography.size.sm,
	selectors: {
		"&:hover": hoverStyles,
		"&:first-child": {
			marginTop: vars.spacing.xxs,
		},
		"&:last-child": {
			marginBottom: vars.spacing.xxs,
		},
	},
});

export const listItemVariants = styleVariants({
	hover: hoverStyles,
});

export const sideTag = style({
	// backgroundColor: "hsl(var(--diff-hue) 100% 40%)",
	// borderColor: "hsl(var(--diff-hue) 100% 20%)",
	// selectors: {
	// 	"&:hover": {
	// 		backgroundColor: "hsl(var(--diff-hue) 100% 20%)",
	// 		borderColor: "hsl(var(--diff-hue) 100% 10%)",
	// 	},
	// },
});

export const text = style({
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	// selectors: {
	//     "&:empty::after": {
	//         content: "'💭'",
	//         userSelect: "none",
	//     }
	// }
});
