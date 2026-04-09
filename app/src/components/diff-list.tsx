import { useDiffseekActions } from "@/bridge/diffseek-provider";
import { diffsAtom, hoveredDiffIndexAtom, paletteAtom, visibleDiffIndexesAtom } from "@/states/core-atoms";
import { ActionIcon, Box, Stack } from "@mantine/core";
import { getDiffHue } from "@core";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { memo, useCallback, useMemo, useRef, type MouseEvent } from "react";

export function DiffList() {
    const _diffs = useAtomValue(diffsAtom);
    const { left: leftVisibleDiffsIndices, right: rightVisibleDiffsIndices } = useAtomValue(visibleDiffIndexesAtom);
    const palette = useAtomValue(paletteAtom);
    const leftVisibleSet = useMemo(() => new Set(leftVisibleDiffsIndices), [leftVisibleDiffsIndices]);
    const rightVisibleSet = useMemo(() => new Set(rightVisibleDiffsIndices), [rightVisibleDiffsIndices]);
    const lastDiffs = useRef<(Omit<DiffListItemProps, "leftVisible" | "rightVisible" | "highlighted">)[]>([]);
    const { setHoveredDiff, scrollToDiff, getTextForTokenSpan } = useDiffseekActions();
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


    const diffs = useMemo<(Omit<DiffListItemProps, "leftVisible" | "rightVisible" | "highlighted">)[]>(() => {
        if (_diffs === null) {
            return lastDiffs.current;
        }

        const mapped = _diffs.map((diff) => ({
            diffIndex: diff.diffIndex,
            hue: getDiffHue(diff.diffIndex, palette?.diffHues ?? []),
            leftText: getTextForTokenSpan("left", diff.leftSpan, { maxLength: 25, image: "🖼️" }) ?? "",
            rightText: getTextForTokenSpan("right", diff.rightSpan, { maxLength: 25, image: "🖼️" }) ?? "",
            onClick,
            onMouseEnter,
            onMouseLeave,
        }));
        lastDiffs.current = mapped;
        return mapped;
    }, [_diffs, onClick, onMouseEnter, onMouseLeave, palette, getTextForTokenSpan]);

    return (
        <div className={`diff-list ${_diffs === null ? "diff-list--disabled" : ""}`}>
            <Stack gap={2}>
                {diffs.map((diff) => (
                    <DiffListItem key={diff.diffIndex} {...diff}
                        leftVisible={leftVisibleSet.has(diff.diffIndex)}
                        rightVisible={rightVisibleSet.has(diff.diffIndex)}
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

const DiffListItem = memo(function DiffListItem({ diffIndex, hue, leftText, rightText, leftVisible, rightVisible, highlighted, onClick, onMouseEnter, onMouseLeave }: DiffListItemProps) {

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
            <div className="text"><DiffListText text={leftText} /></div>

            <SideTagButton
                side="right"
                visible={rightVisible}
            />
            <div className="text"><DiffListText text={rightText} /></div>
        </Box>
    );
}, (prev, next) => {
    return prev.diffIndex === next.diffIndex
        && prev.hue === next.hue
        && prev.leftText === next.leftText
        && prev.rightText === next.rightText
        && prev.leftVisible === next.leftVisible
        && prev.rightVisible === next.rightVisible
        && prev.highlighted === next.highlighted;
});

function DiffListText({ text }: { text: string }) {
    const parts = text.split("\n");
    if (parts.length === 1) return <>{text}</>;
    return <>
        {parts.map((part, i) => (
            i === 0
                ? <span key={i}>{part}</span>
                : <span key={i}><span className="diff-list-newline">↵</span>{part}</span>
        ))}
    </>;
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