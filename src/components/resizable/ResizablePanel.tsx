import {
    forwardRef,
    useRef,
    useEffect,
    type HTMLAttributes,
} from "react";
import React from "react";
import { useResizablePanelRegistry } from "../resizable/ResizablePanelGroup";
import type { PanelPolicy } from "./types";
import * as styles from "./ResizablePanelGroup.css.ts";
import clsx from "clsx";

// ===== Root =====
export type ResizablePanelRootProps = HTMLAttributes<HTMLDivElement> &
    PanelPolicy;

const ResizablePanelRoot = forwardRef<HTMLDivElement, ResizablePanelRootProps>(function ResizablePanelRoot(
    {
        className,
        children,
        // PanelPolicy (px | % 지원, number는 px 간주)
        minSize,
        initialSize,
        growWeight = 1,
        shrinkPriority = 1,
        shrinkWeight = 1,
        lockAtMin = false,
        participatesInResize = true,
        ...props
    },
    ref
) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    React.useImperativeHandle(ref, () => hostRef.current as HTMLDivElement, []);

    const registry = useResizablePanelRegistry();
    const regKeyRef = useRef<number | null>(null);

    // mount → register / unmount → unregister
    useEffect(() => {
        if (!registry || !hostRef.current) return;
        const key = registry.register(hostRef.current, {
            minSize,
            initialSize,
            growWeight,
            shrinkPriority,
            shrinkWeight,
            lockAtMin,
            participatesInResize,
        });
        regKeyRef.current = key;
        return () => {
            if (regKeyRef.current != null) registry.unregister(regKeyRef.current);
            regKeyRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // policy 변경 시 업데이트 (px/% 문자열 변경도 반영)
    useEffect(() => {
        if (!registry || regKeyRef.current == null) return;
        registry.update(regKeyRef.current, {
            minSize,
            initialSize,
            growWeight,
            shrinkPriority,
            shrinkWeight,
            lockAtMin,
            participatesInResize,
        });
    }, [
        registry,
        minSize,
        initialSize,
        growWeight,
        shrinkPriority,
        shrinkWeight,
        lockAtMin,
        participatesInResize,
    ]);

    return (
        <div
            ref={hostRef}
            role="region"
            className={clsx(styles.panel, className)}
            {...props}
        >
            {children}
        </div>
    );
});

export const ResizablePanel = ResizablePanelRoot;
