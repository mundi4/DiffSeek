import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "@/styles/vars.css";

export const overlay = style({
    position: "fixed",
    inset: 0,
    background: vars.color.surface.scrim,
    zIndex: 40,                  // Content 바로 밑
});

export const drawerContent = style({
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "400px",
    background: vars.color.surface.base,
    padding: vars.spacing.md,
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    boxShadow: vars.elevation[4],
});

export const contentBody = style({
    flex: 1,
    overflowY: "auto",
    paddingBottom: vars.spacing.lg,
});


export const optionsGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: vars.spacing.md,
    alignItems: "start", // 🔹 모든 카드가 자기 높이만큼만
});

export const optionCard = style({
    background: vars.color.surface.base,
    border: `${vars.borderWidth.thin} solid ${vars.color.neutral.borderMuted}`,
    borderRadius: vars.radius.sm,
    padding: vars.spacing.md,          // 🔹 MD 패딩
    display: "flex",
    flexDirection: "column",
    gap: vars.spacing.sm,
});

export const optionLabel = style({
    fontSize: vars.typography.size.sm,
    fontWeight: vars.typography.weight.medium,
    color: vars.color.text.muted,
});

export const footer = style({
    position: "sticky",
    bottom: 0,
    background: vars.color.surface.base,
    borderTop: `1px solid ${vars.color.neutral.border}`,
    paddingTop: vars.spacing.md,
    display: "flex",
    justifyContent: "flex-end",
});



export const closeButton = style({
    padding: `${vars.spacing.xs} ${vars.spacing.md}`,
    background: vars.color.action.secondary.bg,
    border: `1px solid ${vars.color.action.secondary.border}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.typography.size.sm,
    cursor: "pointer",
    ":hover": {
        background: vars.color.action.secondary.hover,
    },
});
export const triggerButton = style({
    width: vars.size.control.sm,
    height: vars.size.control.sm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: vars.radius.sm,
    border: `${vars.borderWidth.thin} solid ${vars.color.neutral.border}`,
    background: vars.color.surface.base,
    cursor: "pointer",
    fontSize: vars.typography.size.md,
    lineHeight: 1,
    transition: `background ${vars.motion.duration.fast} ${vars.motion.easing.standard}`,
    selectors: {
        "&:hover": { background: vars.color.action.secondary.hover },
        "&:active": { background: vars.color.action.secondary.active },
    },
});

globalStyle(`${triggerButton} svg:not([class*="size-"])`, {
    width: vars.size.icon.md, // 기본값(md: 20px)
    height: vars.size.icon.md,
    flexShrink: 0,
    pointerEvents: "none",
});


export const optionGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.spacing.md,
    padding: `${vars.spacing.md} 0`,
    borderTop: `1px solid ${vars.color.neutral.borderMuted}`,
});

export const groupTitle = style({
    fontSize: vars.typography.size.sm,
    fontWeight: vars.typography.weight.semibold,
    color: vars.color.text.muted,
    marginBottom: vars.spacing.sm,
});

export const experimentalGroup = style({
    display: "grid",
    gridTemplateColumns: "1fr", // 한 행 = 한 옵션
    gap: vars.spacing.md,
    marginTop: vars.spacing.xl,
    paddingTop: vars.spacing.md,
    borderTop: `1px solid ${vars.color.neutral.borderMuted}`,
});

export const optionRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
});