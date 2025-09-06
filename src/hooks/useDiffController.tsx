import { DiffController, Editor, Renderer } from "@/core/index";
import { diffOptionsAtom } from "@/states/diffOptionsAtom";
import { APP_MESSAGES } from "@/constants/appConstants";
import { createContext, useContext, useMemo, useEffect } from "react";
import { useAtomValue } from "jotai";

/**
 * DiffController와 관련 인스턴스들을 제공하는 컨텍스트
 */
type DiffControllerContextType = {
    diffController: DiffController;
    leftEditor: Editor;
    rightEditor: Editor;
    renderer: Renderer;
}

const DiffControllerContext = createContext<DiffControllerContextType | null>(null);

export function DiffControllerProvider({ 
    children 
}: { 
    children: React.ReactNode;
}) {
    const diffOptions = useAtomValue(diffOptionsAtom);
    
    // 인스턴스들을 한 번만 생성
    const contextValue = useMemo(() => {
        const leftEditor = new Editor("left");
        const rightEditor = new Editor("right");
        const renderer = new Renderer(leftEditor, rightEditor);
        const diffController = new DiffController(leftEditor, rightEditor, renderer, diffOptions);
        
        return {
            diffController,
            leftEditor,
            rightEditor,
            renderer,
        };
    }, []); // 빈 의존성 배열로 한 번만 생성

    // diffOptions가 변경될 때마다 DiffController 옵션 업데이트
    useEffect(() => {
        console.log(diffOptions)
        contextValue.diffController.updateDiffOptions(diffOptions);
        contextValue.diffController.computeDiff();
    }, [diffOptions, contextValue.diffController]);

    return (
        <DiffControllerContext.Provider value={contextValue}>
            {children}
        </DiffControllerContext.Provider>
    );
}

export function useDiffControllerContext() {
    const context = useContext(DiffControllerContext);
    if (!context) {
        throw new Error(APP_MESSAGES.CONTEXT_ERROR);
    }
    return context;
}
