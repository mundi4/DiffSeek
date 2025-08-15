import * as React from "react";
import type { HTMLAttributes, MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { LayoutList } from "lucide-react";
import { useDiffContext } from "@/hooks/useDiffContext";
import { useDiffControllerContext } from "@/hooks/useDiffController";
import { extractTextFromRange } from "@/utils/extractTextFromRange";
import { SideTagButton } from "./SideTagButton";
import type { EditorName } from "@/core/types";
import { SidebarPanel, type SidebarPanelRootProps } from "./SidebarPanel";
import * as styles from "./DiffListPanel.css";
import clsx from "clsx";

export type DiffListPanelProps = SidebarPanelRootProps & HTMLAttributes<HTMLDivElement>;

export function DiffListPanel({ className, ...props }: DiffListPanelProps) {
    const { diffController } = useDiffControllerContext();
    const diffContext = useDiffContext();
    const [visibleDiffs, setVisibleDiffs] = useState(diffController.getVisibleDiffs());
    const [hoveredDiffIndex, setHoveredDiffIndex] = useState<number | null>(null);
    const items = diffContext?.diffs ?? [];

    useEffect(() => {
        const unsub: Array<() => void> = [];
        unsub.push(
            diffController.onDiffVisibilityChanged(() => {
                setVisibleDiffs(diffController.getVisibleDiffs());
            })
        );
        unsub.push(
            diffController.onHoveredDiffIndexChange((diffIndex) => {
                setHoveredDiffIndex(diffIndex);
            })
        );
        return () => unsub.forEach((fn) => fn());
    }, [diffController]);

    const onItemClick = useCallback(

        (e: MouseEvent, diffIndex: number, side?: EditorName) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Diff item clicked", diffIndex, side);
            const toEnd = (e as any).shiftKey as boolean;
            diffController.scrollToDiff(diffIndex, { primary: side, toEnd });
        },
        [diffController]
    );

    const onItemEnter = useCallback((diffIndex: number) => {
        diffController.setHoveredDiffIndex(diffIndex);
    }, [diffController]);

    const onItemLeave = useCallback(() => {
        diffController.setHoveredDiffIndex(null);
    }, [diffController]);

    return (
        <SidebarPanel.Root ariaLabel="Diff List" className={clsx(className)} {...props}>
            <SidebarPanel.Header
                leading={
                    <LayoutList size={16} />
                }
            >
                Diff List
            </SidebarPanel.Header>
            <SidebarPanel.Body>
                <ul className={clsx(styles.list)}>
                    {items.map((item: DiffItem) => (
                        <DiffListItem
                            key={item.diffIndex}
                            diff={item}
                            leftVisible={visibleDiffs.left.has(item.diffIndex)}
                            rightVisible={visibleDiffs.right.has(item.diffIndex)}
                            diffHovered={hoveredDiffIndex === item.diffIndex}
                            onDiffClick={onItemClick}
                            onDiffEnter={onItemEnter}
                            onDiffLeave={onItemLeave}
                        />
                    ))}
                </ul>
            </SidebarPanel.Body>
        </SidebarPanel.Root>
    );
}

type DiffListItemProps = React.HTMLAttributes<HTMLLIElement> & {
    diff: DiffItem;
    leftVisible: boolean;
    rightVisible: boolean;
    diffHovered: boolean;
    onDiffClick: (e: React.MouseEvent, diffIndex: number, side?: EditorName) => void;
    onDiffEnter: (diffIndex: number) => void;
    onDiffLeave: () => void;
};

function DiffListItem({
    diff,
    onDiffClick,
    onDiffEnter,
    onDiffLeave,
    leftVisible,
    rightVisible,
    diffHovered,
    className,
    ...liProps
}: DiffListItemProps) {
    const hue = diff.hue;
    const leftText = extractTextFromRange(diff.leftRange, { maxLength: 50 });
    const rightText = extractTextFromRange(diff.rightRange, { maxLength: 50 });
    const buttonColor = "hsl(var(--diff-hue) 100% 40%)";
    const buttonSurface = "hsl(var(--diff-hue) 100% 80%)";

    return (
        <li className={clsx(styles.listItem, diffHovered && styles.listItemVariants.hover, className)}
            style={{ "--diff-hue": hue } as React.CSSProperties}
            onClick={(e) => onDiffClick(e, diff.diffIndex)}
            onMouseEnter={() => onDiffEnter(diff.diffIndex)}
            onMouseLeave={onDiffLeave} {...liProps}
        >
            {/* <div
                className={clsx(
                    // "grid grid-cols-[auto_minmax(0,1fr)] grid-rows-2 gap-x-1 gap-y-1 p-1 items-center",
                    // "relative cursor-pointer text-xs font-mono rounded-sm",
                    // "bg-[hsl(var(--diff-hue)_100%_80%)] text-[hsl(var(--diff-hue)_100%_20%)] outline-1 outline-[hsl(var(--diff-hue)_100%_40%)]",
                    // "hover:bg-[hsl(0_100%_80%)] hover:text-[hsl(0_100%_20%)] hover:outline-[hsl(0_100%_50%/.5)]",
                    // diffHovered && "bg-[hsl(0_100%_80%)] text-[hsl(0_100%_20%)] outline-[hsl(0_100%_50%/.5)]"
                )}
            > */}
            <SideTagButton
                side="left"
                visible={leftVisible}
                onClick={(e) => onDiffClick(e, diff.diffIndex, "left")}
                className={styles.sideTag}
                color={buttonColor}
                surface={buttonSurface}
            ></SideTagButton>
            <div className={clsx(styles.text)}>{leftText}</div>
            <SideTagButton
                side="right"
                visible={rightVisible}
                onClick={(e) => onDiffClick(e, diff.diffIndex, "right")}
                color={buttonColor}
                surface={buttonSurface}
            />
            <div className={clsx(styles.text)}>{rightText}</div>
            {/* </div> */}
        </li>
    );
}
