import { forwardRef, useRef, type HTMLAttributes } from "react";
import React from "react";
import clsx from "clsx";
import * as styles from "./SidebarPanel.css";

// ===== Root =====
export type SidebarPanelRootProps = HTMLAttributes<HTMLDivElement> &
{
    ariaLabel?: string;
};

export const SidebarPanelRoot = forwardRef<HTMLDivElement, SidebarPanelRootProps>(function SidebarPanelRoot(
    { className, ariaLabel, children, ...props },
    ref
) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    React.useImperativeHandle(ref, () => hostRef.current as HTMLDivElement, []);

    return (
        <div
            ref={hostRef}
            aria-label={ariaLabel}
            className={clsx(styles.root, className)}
            {...props}
        // className={[
        //     // 기본 그리드: 헤더(auto) + 바디(1fr)
        //     "grid grid-rows-[auto_minmax(0,1fr)] min-h-0 w-full overflow-hidden",
        //     className,
        // ]
        //     .filter(Boolean)
        //     .join(" ")}
        >
            {children}
        </div>
    );
});

// ===== Header =====
export type SidebarPanelHeaderProps = HTMLAttributes<HTMLDivElement> & {
    leading?: React.ReactNode;
    actions?: React.ReactNode;
};
export const SidebarPanelHeader = forwardRef<HTMLDivElement, SidebarPanelHeaderProps>(function SidebarPanelHeader(
    { className, leading, actions, children, ...props },
    ref
) {
    return (
        <div
            ref={ref}
            className={clsx(styles.header, className)}
            {...props}
        >
            <div className={styles.headerRow}>
                {leading ? <div className={styles.headerContentLeading}>{leading}</div> : null}
                {children}
            </div>
            {actions ? <div className={styles.headerContentActions}>{actions}</div> : null}
        </div>
    );
});

// ===== Body =====
export type SidebarPanelBodyProps = HTMLAttributes<HTMLDivElement> & {
    scroll?: boolean;
};
export const SidebarPanelBody = forwardRef<HTMLDivElement, SidebarPanelBodyProps>(function SidebarPanelBody(
    { className, children, scroll = true, ...props },
    ref
) {
    return (
        <div ref={ref as any} className={clsx(styles.body({ scroll }))} {...props}>
            {children}
        </div>
    );
});

export const SidebarPanel = Object.assign(SidebarPanelRoot, {
    Root: SidebarPanelRoot,
    Header: SidebarPanelHeader,
    Body: SidebarPanelBody,
});
