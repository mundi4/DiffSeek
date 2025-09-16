import { EditorShell } from "../EditorShell";
import { RendererShell } from "../RendererShell";
import { editorPanelLayoutAtom, syncModeAtom } from "../../states/atoms";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import * as styles from "./EditorPanel.css";
import { useDiffControllerContext } from "@/hooks/useDiffController";

function EditorPanel() {
    const { leftEditor, rightEditor, renderer } = useDiffControllerContext();
    const syncMode = useAtomValue(syncModeAtom);
    const layout = useAtomValue(editorPanelLayoutAtom);

    // Memoize shells to prevent unnecessary re-mounting
    // NOTE: These memo calls are critical! Re-rendering these components causes
    // existing DOM ranges to become invalid, which breaks diff highlighting.
    // If these shells need additional state that causes re-renders, 
    // extract them into separate components with their own state management.
    const leftEditorShell = useMemo(() => <EditorShell editor={leftEditor} />, [leftEditor]);
    const rightEditorShell = useMemo(() => <EditorShell editor={rightEditor} />, [rightEditor]);
    const rendererShell = useMemo(() => <RendererShell renderer={renderer} />, [renderer]);

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
