// Resizable Panel contexts
import { createContext, useContext } from "react";
import type { RegistryAPI } from "./types";

/** Group-wide context (for children that need direction info, etc.) */
export const ResizablePanelGroupContext = createContext<{ direction: "vertical" | "horizontal" }>({
    direction: "vertical",
});

export const ResizablePanelRegistryContext = createContext<RegistryAPI | null>(null);

export function useResizablePanelRegistry() {
    return useContext(ResizablePanelRegistryContext);
}
