export { DEFAULT_PALETTE } from "./default-palette";
export { NEW_YORK_PALETTE } from "./new-york-palette";

export { DEFAULT_PALETTE as default } from "./default-palette";

import { DEFAULT_PALETTE } from "./default-palette";
import { NEW_YORK_PALETTE } from "./new-york-palette";
import type { Palette } from "../types";

export type PalettePresetKey = "default" | "new-york";

export const PALETTE_PRESETS: Record<PalettePresetKey, { label: string; palette: Readonly<Palette> }> = {
	default: { label: "Default", palette: DEFAULT_PALETTE },
	"new-york": { label: "New York", palette: NEW_YORK_PALETTE },
};
