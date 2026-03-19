import { useDiffseekActions } from "@/bridge/DiffseekProvider";
import { diffsAtom, hoveredDiffIndexAtom, visibleDiffIndexesAtom } from "@/states/coreAtoms";
import { extractTextFromRange } from "@/utils/extractTextFromRange";
import { ActionIcon, Box, Stack } from "@mantine/core";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { useCallback, useRef, type MouseEvent } from "react";

export function DiffList() {
    const _diffs = useAtomValue(diffsAtom);
    const { left: leftVisibleDiffsIndices, right: rightVisibleDiffsIndices } = useAtomValue(visibleDiffIndexesAtom);
    const lastDiffs = useRef<(Omit<DiffListItemProps, "leftVisible" | "rightVisible" | "highlighted">)[]>([]);
    const { setHoveredDiff, scrollToDiff } = useDiffseekActions();
    const hoveredDiffIndex = useAtomValue(hoveredDiffIndexAtom);

    const onClick = useCallback((e: MouseEvent, diffIndex: number, side?: "left" | "right") => {
        e.stopPropagation();
        scrollToDiff(diffIndex, side ?? "both", {
            behavior: "smooth",
            block: "center",
        });
    }, [scrollToDiff]);

    const onMouseEnter = useCallback((diffIndex: number) => {
        setHoveredDiff(diffIndex);
    }, [setHoveredDiff]);

    const onMouseLeave = useCallback(() => {
        setHoveredDiff(null);
    }, [setHoveredDiff]);


    let diffs: (Omit<DiffListItemProps, "leftVisible" | "rightVisible" | "highlighted">)[];
    if (_diffs === null) {
        diffs = lastDiffs.current;
    } else {
        diffs = _diffs.map((diff) => ({
            diffIndex: diff.diffIndex,
            hue: diff.hue,
            leftText: extractTextFromRange(diff.leftRange, { maxLength: 50 })[0],
            rightText: extractTextFromRange(diff.rightRange, { maxLength: 50 })[0],
            // leftVisible: leftVisibleDiffsIndices.includes(diff.diffIndex),
            // rightVisible: rightVisibleDiffsIndices.includes(diff.diffIndex),
            onClick,
            onMouseEnter: onMouseEnter,
            onMouseLeave: onMouseLeave,
        }));
        lastDiffs.current = diffs;
    }

    return (
        <div className={`diff-list ${_diffs === null ? "diff-list--disabled" : ""}`}>
            <Stack gap={2}>
                {diffs.map((diff) => (
                    <DiffListItem key={diff.diffIndex} {...diff}
                        leftVisible={leftVisibleDiffsIndices.includes(diff.diffIndex)}
                        rightVisible={rightVisibleDiffsIndices.includes(diff.diffIndex)}
                        highlighted={hoveredDiffIndex === diff.diffIndex}
                    />
                ))}
            </Stack>
        </div>
    );
}

type DiffListItemProps = {
    diffIndex: number;
    hue: number;
    leftText: string;
    rightText: string;
    leftVisible: boolean;
    rightVisible: boolean;
    highlighted: boolean;
    onClick: (e: MouseEvent, diffIndex: number, side?: "left" | "right") => void;
    onMouseEnter: (diffIndex: number) => void;
    onMouseLeave: (diffIndex: number) => void;
};

function DiffListItem({ diffIndex, hue, leftText, rightText, leftVisible, rightVisible, highlighted, onClick, onMouseEnter, onMouseLeave }: DiffListItemProps) {

    const handleClick = (e: MouseEvent) => {
        const side = (e.target as HTMLElement).dataset.side;
        onClick(e, diffIndex, side === "left" || side === "right" ? side : undefined);
    };

    return (
        <Box
            className={clsx("diff-list-item", highlighted && "diff-list-item--highlighted")}
            style={{ "--diff-hue": hue } as React.CSSProperties}
            onClick={handleClick}
            onMouseEnter={() => onMouseEnter(diffIndex)}
            onMouseLeave={() => onMouseLeave(diffIndex)}
        >
            {/* <SideTagButton
                side="left"
                visible={leftVisible}
                onClick={(e) => onClick(e, diffIndex, "left")}
            />
            <div className="text">{leftText}</div>

            <SideTagButton
                side="right"
                visible={rightVisible}
                onClick={(e) => onClick(e, diffIndex, "right")}
            /> */}
            <SideTagButton
                side="left"
                visible={leftVisible}
            />
            <div className="text">{leftText}</div>

            <SideTagButton
                side="right"
                visible={rightVisible}
            />
            <div className="text">{rightText}</div>
        </Box>
    );
}

export type SideTagButtonProps = {
    side: "left" | "right";
    visible: boolean;
    // background?: string;           // e.g. "220 60% 55%"
    // foreground?: string;           // e.g. "0 0% 100%"
    // border?: string;               // e.g. "0 0% 35%"
};

export function SideTagButton({
    side,
    visible,
    // background,
    // foreground,
    // border,
}: SideTagButtonProps) {

    return (
        <ActionIcon
            variant="filled"
            size="xs"
            // onClick={onClick}
            fz="xs"
            data-side={side}
            className={`side-tag-button side-tag-button--${side} ${visible ? 'side-tag-button--visible' : 'side-tag-button--hidden'}`}
        >
            {side === "left" ? <span>L</span> : <span>R</span>}
        </ActionIcon>
    );
}