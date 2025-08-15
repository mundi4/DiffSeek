"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { toggle } from "./Toggle.css";
import clsx from "clsx";

type ToggleProps = React.ComponentProps<typeof TogglePrimitive.Root> & {
    variant?: "default" | "outline";
    size?: "xs" | "sm" | "default" | "lg";
};

export function Toggle({
    className,
    variant = "default",
    size = "default",
    ...props
}: ToggleProps) {
    return (
        <TogglePrimitive.Root
            data-slot="toggle"
            className={clsx(toggle({ variant, size }), className)}
            {...props}
        />
    );
}
