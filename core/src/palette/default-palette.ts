import type { Palette } from "../types";

export const DEFAULT_PALETTE: Readonly<Palette> = {
	diffHues: [30, 180, 300, 120, 240, 60, 270],
	diffSaturation: 100,
	diffLightness: 85,
	diffAlpha: 1,
	diffLineColor: "hsl(0 100% 90% / 0.4)",
	highlightedDiffColor: "hsl(0 100% 80%)",
	selectionHighlightColor: "hsl(0 0% 50% / 0.3)",
	minimapDiffColor: "hsl(0 100% 50% / 0.3)",
	minimapHighlightColor: "hsl(0 100% 50% / 0.8)",
};
