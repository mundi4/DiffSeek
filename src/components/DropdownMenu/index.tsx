import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import * as styles from "./DropdownMenu.css" // ★ VE 스타일
import clsx from "clsx"

function DropdownMenu({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
    return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
    return (
        <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
    )
}

function DropdownMenuTrigger({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
    return (
        <DropdownMenuPrimitive.Trigger
            data-slot="dropdown-menu-trigger"
            {...props}
        />
    )
}

function DropdownMenuContent({ className, sideOffset = 4, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                sideOffset={sideOffset}
                className={clsx(styles.content, styles.contentState, className)}
                {...props}
            />
        </DropdownMenuPrimitive.Portal>
    );
}

function DropdownMenuGroup({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
    return (
        <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
    )
}

/* Item */
function DropdownMenuItem({
    className, inset, variant = "default", ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean; variant?: "default" | "destructive";
}) {
    return (
        <DropdownMenuPrimitive.Item
            className={clsx(
                styles.itemKind.action,
                inset && styles.itemInset,
                variant === "destructive" ? styles.itemVariant.destructive : styles.itemVariant.default,
                className
            )}
            {...props}
        />
    );
}

/* CheckboxItem */
function DropdownMenuCheckboxItem({
    className, children, checked, ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
    return (
        <DropdownMenuPrimitive.CheckboxItem
            className={clsx(styles.itemKind.checkbox, styles.itemVariant.default, className)}
            checked={checked}
            {...props}
        >
            <span className={styles.indicator}>
                <DropdownMenuPrimitive.ItemIndicator>
                    <CheckIcon />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.CheckboxItem>
    );
}

function DropdownMenuRadioGroup({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
    return (
        <DropdownMenuPrimitive.RadioGroup
            data-slot="dropdown-menu-radio-group"
            {...props}
        />
    )
}

/* RadioItem */
function DropdownMenuRadioItem({
    className, children, ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
    return (
        <DropdownMenuPrimitive.RadioItem
            className={clsx(styles.itemKind.radio, styles.itemVariant.default, className)}
            {...props}
        >
            <span className={styles.indicator}>
                <DropdownMenuPrimitive.ItemIndicator>
                    <CircleIcon />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.RadioItem>
    );
}

function DropdownMenuLabel({
    className,
    inset,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
}) {
    return (
        <DropdownMenuPrimitive.Label
            data-slot="dropdown-menu-label"
            data-inset={inset}
            className={clsx(styles.label, className)}
            {...props}
        />
    )
}

function DropdownMenuSeparator({
    className,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
    return (
        <DropdownMenuPrimitive.Separator
            data-slot="dropdown-menu-separator"
            className={clsx(styles.separator, className)}
            {...props}
        />
    )
}

function DropdownMenuShortcut({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="dropdown-menu-shortcut"
            className={clsx(styles.shortcut, className)}
            {...props}
        />
    )
}

function DropdownMenuSub({
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
    return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

/* SubTrigger */
function DropdownMenuSubTrigger({ className, inset, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }) {
    return (
        <DropdownMenuPrimitive.SubTrigger
            data-inset={inset}
            className={clsx(styles.subTrigger, className)}
            {...props}
        >
            {children}
            <ChevronRightIcon className={styles.chevron} />
        </DropdownMenuPrimitive.SubTrigger>
    );
}

function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
    return (
        <DropdownMenuPrimitive.SubContent
            className={clsx(styles.subContent, styles.contentState, className)}
            {...props}
        />
    );
}

export {
    DropdownMenu,
    DropdownMenuPortal,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
}
