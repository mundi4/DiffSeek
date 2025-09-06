import { Button, type ButtonProps } from "@/components/ui/button";
import { useState } from "react";
import * as styles from "./SideTagButton.css";
import clsx from "clsx";
import { Check } from "lucide-react";

export type SideTagButtonProps = ButtonProps & {
    side: "left" | "right";
    visible?: boolean;
    // background?: string;           // e.g. "220 60% 55%"
    // foreground?: string;           // e.g. "0 0% 100%"
    // border?: string;               // e.g. "0 0% 35%"
    "aria-label"?: string;
};

export function SideTagButton({
    side,
    visible = true,
    // background,
    // foreground,
    // border,
    children,
    className,
    "aria-label": ariaLabel,
    onClick,
    ...props
}: SideTagButtonProps) {

    return (
        <Button
            onClick={onClick}
            variant="default"
            aria-label={ariaLabel}
            size="xxs"
            //style={style}
            className={clsx(
                styles.root({ visible }),
                className
            )}
            {...props}
        >
            {children ?? (side === "left" ? <span>L</span> : <span>R</span>)}
        </Button>
    );
}

export type SideTagCopyButtonProps = Omit<SideTagButtonProps, "onClick"> & {
    getValue?: () => string;
    onCopied?: () => void;
}

export function SideTagCopyButton({
    getValue,
    onCopied,
    ...props
}: SideTagCopyButtonProps) {
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
        <SideTagButton onClick={copy} {...props} children={copied ? (<Check size={8} className={clsx()} />) : null} />
    )
}