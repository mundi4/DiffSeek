import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type SidebarPanelContextValue = {
    headerId: string;
    divided: boolean;
};

const SidebarPanelContext = React.createContext<SidebarPanelContextValue | null>(null);
function useSidebarPanelContext() {
    const ctx = React.useContext(SidebarPanelContext);
    if (!ctx) throw new Error("SidebarPanel components must be used inside <SidebarPanel.Root>");
    return ctx;
}

// Root
export type SidebarPanelRootProps = React.HTMLAttributes<HTMLDivElement> & {
    divided?: boolean;
    ariaLabel?: string;
};
export const SidebarPanelRoot = React.forwardRef<HTMLDivElement, SidebarPanelRootProps>(function SidebarPanelRoot(
    { className, divided = true, ariaLabel, ...props },
    ref
) {
    const headerId = React.useId();
    const ctx: SidebarPanelContextValue = { headerId, divided };

    return (
        <SidebarPanelContext.Provider value={ctx}>
            <div
                ref={ref}
                role="region"
                aria-labelledby={headerId}
                aria-label={ariaLabel}
                className={cn(
                    "grid grid-rows-[auto_minmax(0,1fr)] h-full min-h-0 w-full overflow-hidden",
                    "bg-background text-foreground",
                    divided && "border border-border",
                    "rounded-none shadow-none",
                    className
                )}
                {...props}
            />
        </SidebarPanelContext.Provider>
    );
});

// Header
export type SidebarPanelHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
    leading?: React.ReactNode;
    actions?: React.ReactNode;
};
export const SidebarPanelHeader = React.forwardRef<HTMLDivElement, SidebarPanelHeaderProps>(function SidebarPanelHeader(
    { className, leading, actions, children, ...props },
    ref
) {
    const ctx = useSidebarPanelContext();

    return (
        <div
            ref={ref}
            id={ctx.headerId}
            className={cn(
                "px-2 py-[2px] select-none text-sm font-medium leading-none",
                "bg-muted border-b border-border",
                "flex items-center justify-between gap-2",
                className
            )}
            {...props}
        >
            <div className="flex items-center gap-2 min-w-0">
                {leading ? <div className="grid place-items-center size-5 shrink-0">{leading}</div> : null}
                {children}
            </div>
            {actions ? <div className="flex items-center gap-1 shrink-0">{actions}</div> : null}
        </div>
    );
});

// Body
export type SidebarPanelBodyProps = React.HTMLAttributes<HTMLDivElement> & {
    scroll?: boolean;
};
export const SidebarPanelBody = React.forwardRef<HTMLDivElement, SidebarPanelBodyProps>(function SidebarPanelBody(
    { className, children, scroll = true, ...props },
    ref
) {
    const content = (
        <div ref={ref} className={cn("h-full min-h-0", className)} {...props}>
            {children}
        </div>
    );
    return scroll ? <ScrollArea className="h-full min-h-0">{content}</ScrollArea> : content;
});

export type HeaderMenuTriggerProps = React.HTMLAttributes<HTMLElement> & {
    className?: string;
    "aria-label"?: string;
};

// HeaderMenu Helper
export type SidebarPanelHeaderMenuProps = {
    trigger: React.ReactElement<HeaderMenuTriggerProps>;
    children: React.ReactNode;
    contentClassName?: string;
};
export function SidebarPanelHeaderMenu({ trigger, children, contentClassName }: SidebarPanelHeaderMenuProps) {
    const triggerClass = cn(
        "grid place-items-center size-6 rounded",
        "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        (trigger.props && (trigger.props as any).className) || ""
    );

    const safeTrigger = React.cloneElement(trigger, {
        className: triggerClass,
        "aria-label": (trigger.props && (trigger.props as any)["aria-label"]) ?? "패널 메뉴",
    });

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>{safeTrigger}</DropdownMenuTrigger>
            <DropdownMenuContent className={cn("w-48", contentClassName)} onCloseAutoFocus={(e) => e.preventDefault()}>
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export const SidebarPanel = Object.assign(SidebarPanelRoot, {
    Root: SidebarPanelRoot,
    Header: SidebarPanelHeader,
    Body: SidebarPanelBody,
    HeaderMenu: SidebarPanelHeaderMenu,
});
