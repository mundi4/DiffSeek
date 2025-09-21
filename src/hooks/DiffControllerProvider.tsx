import { DiffController, Editor, Renderer } from "@/core";
import { diffOptionsAtom } from "@/states/diffOptionsAtom";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef } from "react";
import { DiffControllerContext } from "./useDiffController";

type DiffControllerContextType = {
    diffController: DiffController;
    leftEditor: Editor;
    rightEditor: Editor;
    renderer: Renderer;
}

export function DiffControllerProvider({
    children
}: {
    children: React.ReactNode;
}) {
    const diffOptions = useAtomValue(diffOptionsAtom);

    const contextValueRef = useRef<DiffControllerContextType>(null);

    if (!contextValueRef.current) {
        const leftEditor = new Editor("left");
        const rightEditor = new Editor("right");
        const renderer = new Renderer(leftEditor, rightEditor);
        const diffController = new DiffController(leftEditor, rightEditor, renderer, diffOptions);
        contextValueRef.current = { diffController, leftEditor, rightEditor, renderer };
    }
    const contextValue = contextValueRef.current;
    // 인스턴스들을 한 번만 생성
    // const contextValue = useMemo(() => {
    //     console.log("Creating DiffController, Editors, Renderer with options:", diffOptions);
    //     const leftEditor = new Editor("left");
    //     const rightEditor = new Editor("right");
    //     const renderer = new Renderer(leftEditor, rightEditor);
    //     const diffController = new DiffController(leftEditor, rightEditor, renderer, diffOptions);

    //     return {
    //         diffController,
    //         leftEditor,
    //         rightEditor,
    //         renderer,
    //     };
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, []); // 빈 의존성 배열로 한 번만 생성

    // diffOptions가 변경될 때마다 DiffController 옵션 업데이트
    useEffect(() => {
        contextValue.diffController.updateDiffOptions(diffOptions);
        contextValue.diffController.computeDiff();
    }, [diffOptions, contextValue.diffController]);

    return (
        <DiffControllerContext.Provider value={contextValue}>
            {children}
        </DiffControllerContext.Provider>
    );
}
