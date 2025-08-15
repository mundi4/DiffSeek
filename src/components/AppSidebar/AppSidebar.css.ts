import { vars } from "@/styles/vars.css";
import { style } from "@vanilla-extract/css";

export const root = style({
    display:"grid",
    gridTemplateRows: "1fr auto",
    height: "100%",
    minHeight: 0,
    backgroundColor: vars.color.surface.subtle,
    borderLeft: `1px solid ${vars.color.neutral.border}`
});