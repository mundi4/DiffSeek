import type React from "react";
import { EditorShell } from "../EditorShell";
import { RendererShell } from "../RendererShell";
import { editorPanelLayoutAtom, syncModeAtom } from "../../states/atoms";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef } from "react";
import * as styles from "./EditorPanel.css";
import { useDiffControllerContext } from "@/hooks/useDiffController";

type EditorPanelProps = React.HTMLAttributes<HTMLDivElement> & {

}

function EditorPanel({ }: EditorPanelProps) {

    const { leftEditor, rightEditor, renderer } = useDiffControllerContext();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {


    });

    useEffect(() => {
        if (!containerRef.current) return;
        const leftEditorContainer = document.createElement("div");
        const rightEditorContainer = document.createElement("div");
        const rendererContainer = document.createElement("div");
        containerRef.current.appendChild(leftEditorContainer);

        leftEditor.mount(leftEditorContainer);
        rightEditor.mount(rightEditorContainer);
        renderer.mount(rendererContainer);

        return () => {
            leftEditor.unmount();
            rightEditor.unmount();
            renderer.unmount();
            containerRef.current?.removeChild(leftEditorContainer);
            containerRef.current?.removeChild(rightEditorContainer);
            containerRef.current?.removeChild(rendererContainer);
        }

    }, [leftEditor, rightEditor, renderer, containerRef.current]);




    const syncMode = useAtomValue(syncModeAtom);
    const layout = useAtomValue(editorPanelLayoutAtom);
    // ㅋㅋㅋ 
    // 아래 컴포넌트들은 새로 렌더될 때마다 새로운 요소에 mount된다.
    // 그 자체로는 큰 문제가 아닌데 editor 내부에 존재하던 이미 만들어진 range들이 완전히 빈 값을 가지게 되어버린다. 
    // 이건 특급 nono임. diff range들을 다시 추출하는건 가벼운 작업이 아님.
    // 만약 editorshell, renderershell에 상태가 필요한 다른 요소가 추가된다면(그래서 다시 렌더링을 해야하는 경우가 생긴다면) 이 memo들을 각각의 컴포넌트로 끌어내려서 거기서 생성, 관리해야함.

    const leftEditorShell = useMemo(() => <EditorShell editor={leftEditor} />, [leftEditor]);
    const rightEditorShell = useMemo(() => <EditorShell editor={rightEditor} />, [rightEditor]);
    const rendererShell = useMemo(() => <RendererShell renderer={renderer} />, [renderer]);
    // /className="absolute top-0 left-0 w-full h-full pointer-events-none z-[0]"
    return (
        <div className={styles.container({
            layout,
            syncMode: syncMode ? 'on' : 'off',
        })}>
            {rendererShell}

            <div
                aria-hidden
                className={styles.divider({
                    layout,
                })}
            />

            {leftEditorShell}
            {rightEditorShell}
        </div>
    )
}

export default EditorPanel
