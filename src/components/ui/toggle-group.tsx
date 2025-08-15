"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { group, itemAdjust } from "./ToggleGroup.css";
import { toggle, type ToggleVariants } from "./Toggle.css"; // 기존 Toggle recipe 재사용
import clsx from "clsx";

type Ctx = {
    variant?: "default" | "outline" | "primary";
    size?: "xs" | "sm" | "default" | "lg";
};

const ToggleGroupContext = React.createContext<Ctx>({
    size: "default",
    variant: "default",
});

type RootProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
    ToggleVariants;

export function ToggleGroup({
    className,
    variant = "default",
    size = "default",
    children,
    ...props
}: RootProps) {
    return (
        <ToggleGroupPrimitive.Root
            data-slot="toggle-group"
            data-variant={variant}
            data-size={size}
            className={clsx(group({ variant, size }), className)}
            {...props}
        >
            <ToggleGroupContext.Provider value={{ variant, size }}>
                {children}
            </ToggleGroupContext.Provider>
        </ToggleGroupPrimitive.Root>
    );
}

type ItemProps = React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
    ToggleVariants;

export function ToggleGroupItem({
    className,
    children,
    variant,
    size,
    ...props
}: ItemProps) {
    const ctx = React.useContext(ToggleGroupContext);
    const v = ctx.variant ?? variant ?? "default";
    const s = ctx.size ?? size ?? "default";

    return (
        <ToggleGroupPrimitive.Item
            data-slot="toggle-group-item"
            data-variant={v}
            data-size={s}
            className={clsx(
                // 개별 토글의 시각(색/상태/크기)은 Toggle recipe 재사용
                toggle({ variant: v, size: s }),
                // 그룹 안에서만 필요한 보정(rounded-none, focus z, border join)
                itemAdjust,
                className
            )}
            {...props}
        >
            {children}
        </ToggleGroupPrimitive.Item>
    );
}
