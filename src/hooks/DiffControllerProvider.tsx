import { DiffController, Editor, Renderer } from "@/core";
import { diffOptionsAtom } from "@/states/diffOptionsAtom";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { DiffControllerContext } from "./useDiffController";

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
