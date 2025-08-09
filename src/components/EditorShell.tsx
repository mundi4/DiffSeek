import { useRef, forwardRef, useEffect, useImperativeHandle } from "react";
import type { Editor } from "@/core/Editor";
import { cn } from "@/lib/utils";

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
    }, [editor, containerRef.current]);

    useImperativeHandle(ref, () => ({
        getEditor: () => editor,
        getRootElement: () => containerRef.current,
    }));

    return <div className={cn("h-full min-h-0 border-1 z-10", className)} ref={containerRef}></div>;
});
