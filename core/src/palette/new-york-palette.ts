import type { Palette } from "../types";

/**
 * New York preset — monochromatic, minimal tones inspired by shadcn/ui's New York theme.
 * Single neutral hue; calm and understated.
 */
export const NEW_YORK_PALETTE: Readonly<Palette> = {
    diffHues: [30, 180, 300, 120, 240, 60, 270],
    diffSaturation: 25,
    diffLightness: 78,
    diffAlpha: 1,
    diffLineColor: "hsl(220 13% 88% / 0.5)",
    highlightedDiffColor: "hsl(220 13% 75%)",
    selectionHighlightColor: "hsl(220 9% 46% / 0.2)",
    minimapDiffColor: "hsl(220 18% 55% / 0.4)",
};
