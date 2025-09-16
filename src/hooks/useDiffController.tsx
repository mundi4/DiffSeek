import { DiffController, Editor, Renderer } from "@/core/index";
import { APP_MESSAGES } from "@/constants/appConstants";
import { createContext, useContext } from "react";

/**
 * DiffController와 관련 인스턴스들을 제공하는 컨텍스트
 */
type DiffControllerContextType = {
    diffController: DiffController;
    leftEditor: Editor;
    rightEditor: Editor;
    renderer: Renderer;
}

export const DiffControllerContext = createContext<DiffControllerContextType | null>(null);

export function useDiffControllerContext() {
    const context = useContext(DiffControllerContext);
    if (!context) {
        throw new Error(APP_MESSAGES.CONTEXT_ERROR);
    }
    return context;
}
