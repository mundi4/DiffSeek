import { DiffController, Editor, Renderer } from "@/core/index";
import { APP_MESSAGES } from "@/constants/appConstants";
import { createContext, useContext } from "react";
import { diffOptionsAtom } from "@/states/diffOptionsAtom";
import { getDefaultStore } from "jotai";

/**
 * DiffController와 관련 인스턴스들을 제공하는 컨텍스트
 */
type DiffControllerContextType = {
    diffController: DiffController;
    leftEditor: Editor;
    rightEditor: Editor;
    renderer: Renderer;
}

// const defaultStore = getDefaultStore();
// const diffOptions = defaultStore.get(diffOptionsAtom);
// const leftEditor = new Editor("left");
// const rightEditor = new Editor("right");
// const renderer = new Renderer(leftEditor, rightEditor);
// const diffController = new DiffController(leftEditor, rightEditor, renderer, diffOptions);

export const DiffControllerContext = createContext<DiffControllerContextType|null>(null);

export function useDiffControllerContext() {
    const context = useContext(DiffControllerContext);
    if (!context) {
        throw new Error(APP_MESSAGES.CONTEXT_ERROR);
    }
    return context;
}
