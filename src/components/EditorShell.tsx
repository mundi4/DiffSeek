import { useRef, forwardRef, useEffect, useImperativeHandle } from "react";
import type { Editor } from "@/core/Editor";
import * as styles from "./EditorShell.css";
import clsx from "clsx";

type EditorShellProps = React.HTMLAttributes<HTMLDivElement> & {
    editor: Editor;
}

export type EditorShellHandle = {
    getEditor: () => Editor | null;
    getRootElement: () => HTMLElement | null;
};

export const EditorShell = forwardRef<EditorShellHandle, EditorShellProps>(({ editor, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!containerRef.current) return;
        editor.mount(containerRef.current);
        return () => {
            editor.unmount();
        };
    }, [editor]);

    useImperativeHandle(ref, () => ({
        getEditor: () => editor,
        getRootElement: () => containerRef.current,
    }));

    return <div className={clsx(styles.root, className)} ref={containerRef}></div>;
});
