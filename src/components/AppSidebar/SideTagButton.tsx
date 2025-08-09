import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import React from "react";

export type SideTagButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    side: "left" | "right";
    visible?: boolean;
    background?: string;           // e.g. "220 60% 55%"
    foreground?: string;           // e.g. "0 0% 100%"
    border?: string;               // e.g. "0 0% 35%"
    "aria-label"?: string;
};

export function SideTagButton({
    side,
    visible = true,
    background,
    foreground,
    border,
    className,
    "aria-label": ariaLabel,
    onClick,
    ...props
}: SideTagButtonProps) {
    const style = {
        ...(background ? ({ ["--primary" as any]: background } as React.CSSProperties) : null),
        ...(foreground ? ({ ["--primary-foreground" as any]: foreground } as React.CSSProperties) : null),
        ...(border ? ({ ["--border" as any]: border } as React.CSSProperties) : null),
    };

    return (
        <Button
            onClick={onClick}
            variant="default"
            aria-label={ariaLabel}
            size="icon"
            style={style}
            className={cn(
                "size-5 inline-flex items-center justify-center font-bold font-mono text-sm rounded-[25%] border",
                visible ? "opacity-100" : "opacity-20",
                className
            )}
            {...props}
        >
            {side === "left" ? <span className="text-left">L</span> : <span className="text-right">R</span>}
        </Button>
    );
}

//"border text-primary-foreground bg-[hsl(var(--diff-hue)_100%_40%)] border-[hsl(var(--diff-hue)_100%_20%)]",