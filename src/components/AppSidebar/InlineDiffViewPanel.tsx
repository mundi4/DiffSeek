import React, { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { SearchCode } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { requestQuickDiff, type QuickDiffOptions } from "@/lib/quick-diff";
import type { EditorTextSelection } from "@/core/DiffController";
import { editorTextSelectionAtom } from "@/states/atoms";
import { extractTextFromRange } from "@/utils/extractTextFromRange";
import { SidebarPanel } from "./SidebarPanel";
import { SideCopyButton } from "../SideCopyButton";
import { atomWithStorage } from "jotai/utils";

const diffOptions: QuickDiffOptions = {};
export const MagnifierMaxTextLength = 500;

type RenderMode = "inline" | "side-by-side" | "stacked";
const renderModeAtom = atomWithStorage<RenderMode>("inlineDiffRenderMode", "stacked");

interface InlineDiffViewProps { }


export function InlineDiffViewPanel({ }: InlineDiffViewProps) {
    const fallbackSelection = useRef<EditorTextSelection | null>(null);
    let editorTextSelection = useAtomValue(editorTextSelectionAtom);
    if (!editorTextSelection) {
        editorTextSelection = fallbackSelection.current;
    } else {
        fallbackSelection.current = editorTextSelection;
    }

    const [renderMode, setRenderMode] = useAtom(renderModeAtom);

    const lastInputOutput = useRef<{ left: string; right: string; options: QuickDiffOptions; diffs: RawDiff[] | null }>({
        left: "",
        right: "",
        options: diffOptions,
        diffs: [],
    });
    const [entries, setEntries] = useState<RawDiff[] | null>(null);

    const leftRange = editorTextSelection?.leftTokenRange;
    const rightRange = editorTextSelection?.rightTokenRange;

    const [textPair, setTextPair] = useState<{ left: string; right: string }>({ left: "", right: "" });
    const { left: leftText, right: rightText } = textPair;
    const tooLong = leftText.length > MagnifierMaxTextLength || rightText.length > MagnifierMaxTextLength;

    useEffect(() => {
        if (leftRange && rightRange) {
            const leftText = extractTextFromRange(leftRange, { maxLength: MagnifierMaxTextLength + 1 })[0];
            const rightText = extractTextFromRange(rightRange, { maxLength: MagnifierMaxTextLength + 1 })[0];
            setTextPair((prev) => {
                if (prev.left === leftText && prev.right === rightText) return prev;
                setEntries(null);
                if (leftText.length <= MagnifierMaxTextLength && rightText.length <= MagnifierMaxTextLength) {
                    requestQuickDiff(leftText, rightText, diffOptions, (result) => setEntries(result));
                }
                return { left: leftText, right: rightText };
            });
        } else {
            lastInputOutput.current.left = "";
            lastInputOutput.current.right = "";
        }
    }, [leftRange, rightRange, diffOptions]);

    return (
        <SidebarPanel.Root ariaLabel="Inline Diff 패널" divided className="shadow-none rounded-none">
            <SidebarPanel.Header
                leading={
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <button
                                aria-label="보기 옵션"
                                className="grid place-items-center size-6 rounded hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <SearchCode size={14} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
                            <DropdownMenuLabel>보기 방식</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={renderMode} onValueChange={(v) => setRenderMode(v as RenderMode)}>
                                <DropdownMenuRadioItem value="stacked">위/아래</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="side-by-side">나란히</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="inline">합쳐서 보기</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                }
            />
            <SidebarPanel.Body>
                <div className="h-full min-h-0">
                    {tooLong ? (
                        <div className="p-4 text-center">
                            <p className="text-destructive text-md font-semibold">욕심이 과하세요.</p>
                            <p className="text-muted-foreground text-sm italic">{MagnifierMaxTextLength}글자까지만...</p>
                        </div>
                    ) : !leftText && !rightText ? (
                        <div className="p-4 text-center">
                            <p className="text-muted-foreground text-sm italic">선택된 텍스트 없음</p>
                        </div>
                    ) : entries === null ? (
                        <div className="p-4 text-center text-sm italic text-muted-foreground">아, 잠깐만요...</div>
                    ) : (
                        <RenderContents leftText={leftText} rightText={rightText} entries={entries} renderMode={renderMode} className="p-1" />
                    )}
                </div>
            </SidebarPanel.Body>
        </SidebarPanel.Root>
    );
}

/* ---------- renderers ---------- */

export type RenderContentsProps = React.HTMLAttributes<HTMLDivElement> & {
    entries: RawDiff[];
    leftText: string;
    rightText: string;
    renderMode: RenderMode;
};

function RenderContents({ leftText, rightText, entries, className, renderMode }: RenderContentsProps) {
    //const renderMode = useAtomValue(renderModeAtom);
    return (
        <div className={cn("text-sm font-mono whitespace-pre-wrap break-words", className)}>
            {renderMode === "inline"
                ? renderInlineDiff(entries, leftText, rightText)
                : RenderSplitDiff(entries, leftText, rightText, renderMode === "side-by-side" ? "row" : "col")}
        </div>
    );
}

function renderInlineDiff(entries: RawDiff[], leftText: string, rightText: string) {
    return entries.map((entry, i) => {
        let text = "";
        if ((entry.type === 0 || entry.type === 1) && entry.left) {
            text = leftText.slice(entry.left.start, entry.left.end);
        } else if (entry.type === 2 && entry.right) {
            text = rightText.slice(entry.right.start, entry.right.end);
        }

        const styleClass =
            entry.type === 0
                ? "bg-[hsl(var(--diff-equal-bg))] text-[hsl(var(--diff-equal-text))]"
                : entry.type === 1
                    ? "bg-[hsl(var(--diff-delete-bg))] text-[hsl(var(--diff-delete-text))]"
                    : "bg-[hsl(var(--diff-insert-bg))] text-[hsl(var(--diff-insert-text))]";

        const displayText =
            entry.type === 0 ? text : text === "\n" ? "↵\n" : text === "\t" ? "→" : text;

        return (
            <span key={i} className={styleClass}>
                {displayText}
            </span>
        );
    });
}

function RenderSplitDiff(
    entries: RawDiff[],
    leftText: string,
    rightText: string,
    dir: "row" | "col" = "row"
) {
    function build(text: string, key: "left" | "right", typeFlags: 1 | 2): React.ReactNode[] {
        const out: React.ReactNode[] = [];
        let buffer: string[] = [];
        let currentType: number | null = null;
        let spanIndex = 0;

        const flush = () => {
            if (buffer.length === 0) return;
            const className =
                currentType === 0
                    ? "bg-[hsl(var(--diff-equal-bg))] text-[hsl(var(--diff-equal-text))]"
                    : currentType === 1
                        ? "bg-[hsl(var(--diff-delete-bg))] text-[hsl(var(--diff-delete-text))]"
                        : "bg-[hsl(var(--diff-insert-bg))] text-[hsl(var(--diff-insert-text))]";

            out.push(
                <span key={++spanIndex} className={className}>
                    {buffer.join("")}
                </span>
            );
            buffer = [];
        };

        for (const entry of entries) {
            if (entry.type !== 0 && !(entry.type & typeFlags)) continue;
            const seg = entry[key];
            if (!seg) continue;
            const segText = text.slice(seg.start, seg.end);
            const type = entry.type;

            if (currentType === null) currentType = type;
            if (type !== currentType) {
                flush();
                currentType = type;
            }

            buffer.push(entry.type !== 0 && segText === "\n" ? "↵\n" : entry.type !== 0 && segText === "\t" ? "→" : segText);
        }

        flush();
        return out;
    }

    return (
        <div className={cn("grid gap-1 relative text-sm font-mono", dir === "col" ? "grid-rows-[1fr_auto_1fr]" : "grid-cols-[1fr_auto_1fr]")}>
            <div className="min-w-0 whitespace-pre-wrap break-words">
                <SideCopyButton side="left" getValue={() => leftText} />{" "}
                {build(leftText, "left", 1)}
            </div>

            <div className={dir === "col" ? "h-px border-t border-t-muted" : "w-px border-l border-l-muted"} />

            <div className="min-w-0 whitespace-pre-wrap break-words">
                <SideCopyButton side="right" getValue={() => rightText} />{" "}
                {build(rightText, "right", 2)}
            </div>
        </div>
    );
}
