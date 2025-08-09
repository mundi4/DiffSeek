import * as React from "react";
import type { HTMLAttributes, MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LayoutList } from "lucide-react";
import { useDiffContext } from "@/hooks/useDiffContext";
import { useDiffControllerContext } from "@/hooks/useDiffController";
import { extractTextFromRange } from "@/utils/extractTextFromRange";
import { SideTagButton } from "./SideTagButton";
import { SidebarPanel } from "./SidebarPanel";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import type { EditorName } from "@/core/types";

export type DiffListPanelProps = HTMLAttributes<HTMLDivElement>;

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
        <SidebarPanel.Root ariaLabel="Diff 목록" divided className={cn("shadow-none rounded-none", className)} {...props}>
            <SidebarPanel.Header
                leading={
                    <LayoutList size={14} />
                    // <SidebarPanel.HeaderMenu trigger={<button aria-label="Diff 목록 옵션"><LayoutList size={14} /></button>}>
                    //     <DropdownMenuLabel>표시 옵션</DropdownMenuLabel>
                    // </SidebarPanel.HeaderMenu>
                }
            />
            <SidebarPanel.Body>
                <ScrollArea className="h-full min-h-0 pr-2" type="always">
                    <ul className={cn("px-1", "min-w-0")}>
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
                </ScrollArea>
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

    return (
        <li className={cn("py-1 block", className)} {...liProps}>
            <div
                className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)] grid-rows-2 gap-x-1 gap-y-1 p-1 items-center",
                    "relative cursor-pointer text-xs font-mono rounded-sm",
                    "bg-[hsl(var(--diff-hue)_100%_80%)] text-[hsl(var(--diff-hue)_100%_20%)] outline-1 outline-[hsl(var(--diff-hue)_100%_40%)]",
                    "hover:bg-[hsl(0_100%_80%)] hover:text-[hsl(0_100%_20%)] hover:outline-[hsl(0_100%_50%/.5)]",
                    diffHovered && "bg-[hsl(0_100%_80%)] text-[hsl(0_100%_20%)] outline-[hsl(0_100%_50%/.5)]"
                )}
                style={{ "--diff-hue": hue } as React.CSSProperties}
                onClick={(e) => onDiffClick(e, diff.diffIndex)}
                onMouseEnter={() => onDiffEnter(diff.diffIndex)}
                onMouseLeave={onDiffLeave}
            >
                <SideTagButton
                    side="left"
                    background="hsl(var(--diff-hue) 100% 40%)"
                    border="hsl(var(--diff-hue) 100% 20%)"
                    visible={leftVisible}
                    onClick={(e) => onDiffClick(e, diff.diffIndex, "left")}
                />
                <div className={cn("truncate",
                    // "empty:after:content-['💭'] empty:after:select-none"
                )}>{leftText}</div>
                <SideTagButton
                    side="right"
                    background="hsl(var(--diff-hue) 100% 40%)"
                    border="hsl(var(--diff-hue) 100% 20%)"
                    visible={rightVisible}
                    onClick={(e) => onDiffClick(e, diff.diffIndex, "right")}
                />
                <div className={cn("truncate align-middle",
                    //"empty:after:content-['💭'] empty:after:select-none"
                )}>{rightText}</div>
            </div>
        </li>
    );
}
