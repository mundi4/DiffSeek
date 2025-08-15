import { useEffect, useRef } from "react";
import { Renderer } from "@/core/Renderer";
import clsx from "clsx";
import * as styles from "./RendererShell.css";

type RendererShellProps = React.HTMLAttributes<HTMLDivElement> & {
    renderer: Renderer;
};

export function RendererShell({ renderer, className }: RendererShellProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        renderer.mount(containerRef.current);
        return () => {
            renderer.unmount();
        };
    }, [

    ]);

    return (
        <div className={clsx(styles.root, className)} ref={containerRef}></div>
    )
}
