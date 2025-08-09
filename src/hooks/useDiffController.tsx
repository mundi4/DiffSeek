import { DiffController } from "@/core/DiffController";
import { Editor } from "@/core/Editor";
import { Renderer } from "@/core/Renderer";
import { createContext, useContext } from "react";

type DiffControllerContextType = {
    diffController: DiffController;
    leftEditor: Editor;
    rightEditor: Editor;
    renderer: Renderer;
}

const DiffControllerContext = createContext<DiffControllerContextType | null>(null);

export function DiffControllerProvider({ value, children }: { children: React.ReactNode; value: DiffControllerContextType }) {
    return (
        <DiffControllerContext.Provider value={value}>
            {children}
        </DiffControllerContext.Provider>
    );
}

export function useDiffControllerContext() {
    const context = useContext(DiffControllerContext);
    if (!context) {
        throw new Error("useDiffControllerContext must be used within a DiffControllerProvider");
    }
    return context;
}