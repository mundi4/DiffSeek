import { useEffect, useRef } from "react";
import { Renderer } from "@/core/Renderer";
import { cn } from "@/lib/utils";

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
        <div className={cn("absolute top-0 left-0 w-full h-full pointer-events-none", className)} ref={containerRef}></div>
    )
}
