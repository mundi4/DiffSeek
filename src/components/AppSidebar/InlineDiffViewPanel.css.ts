import { vars } from "@/styles/vars.css";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const content = style({
	fontSize: vars.typography.size.sm,
	fontFamily: vars.typography.family.mono,
	whiteSpace: "pre-wrap",
	overflowWrap: "anywhere",
});

export const diff = recipe({
	base: {},
	variants: {
		type: {
			0: {
				color: "hsl(var(--diff-equal-text))",
				backgroundColor: "hsl(var(--diff-equal-bg))",
			},
			1: {
				color: "hsl(var(--diff-delete-text))",
				backgroundColor: "hsl(var(--diff-delete-bg))",
			},
			2: {
				color: "hsl(var(--diff-insert-text))",
				backgroundColor: "hsl(var(--diff-insert-bg))",
			},
		},
	},
});

export const splitWrapper = recipe({
	base: {
		display: "grid",
		gap: vars.spacing.xs,
		//position:"relative",
	},
	variants: {
		dir: {
			col: {
				gridTemplateRows: "1fr auto 1fr",
			},
			row: {
				gridTemplateColumns: "1fr auto 1fr",
			},
		},
	},
});

export const splitter = recipe({
    variants: {
        dir: {
            col: {
                height:"1px",
                borderTop: `1px solid ${vars.color.neutral.borderMuted}`,
            },
            row: {
                width: "1px",
                borderLeft: `1px solid ${vars.color.neutral.borderMuted}`,
            }
        }
    }
});
