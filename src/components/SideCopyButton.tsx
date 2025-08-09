import { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type SideCopyButtonProps = {
    side: "left" | "right";
    "aria-label"?: string;
    getValue?: () => string;
    onCopied?: () => void;
    background?: string;           // e.g. "220 60% 55%"
    foreground?: string;           // e.g. "0 0% 100%"
    border?: string;               // e.g. "0 0% 35%"
    className?: string;
}

export function SideCopyButton({
    side,
    getValue,
    onCopied,
    background,
    foreground,
    border,
    className,
    "aria-label": ariaLabel,
    ...props
}: SideCopyButtonProps) {
    const style = {
        ...(background ? ({ ["--primary" as any]: background } as React.CSSProperties) : null),
        ...(foreground ? ({ ["--primary-foreground" as any]: foreground } as React.CSSProperties) : null),
        ...(border ? ({ ["--border" as any]: border } as React.CSSProperties) : null),
    };

    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            const content = getValue?.();
            if (content) {
                await navigator.clipboard.writeText(content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1000);
                onCopied?.();
            }
        } catch {
        }
    };

    return (
        <Button
            variant="default"
            aria-label={ariaLabel}
            size="icon"
            onClick={copy}
            className={cn(
                "size-5 inline-flex items-center justify-center font-bold font-mono text-sm rounded-[25%] border",
                className
            )}
            style={style}
            {...props}
        >
            {copied ? <Check className={cn("size-2")} /> : side === "left" ? <span className="text-left">L</span> : <span className="text-right">R</span>}
        </Button>
    );
}