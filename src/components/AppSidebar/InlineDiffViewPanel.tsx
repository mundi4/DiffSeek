import React, { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { SearchCode } from "lucide-react";
import { createQuickDiff, type QuickDiffOptions } from "@/utils/quick-diff";
import type { EditorTextSelection } from "@/core/DiffController";
import { editorTextSelectionAtom } from "@/states/atoms";
import { extractTextFromRange } from "@/utils/extractTextFromRange";
//import { SideCopyButton } from "../SideCopyButton";
import { atomWithStorage } from "jotai/utils";
import { SidebarPanel, type SidebarPanelRootProps } from "./SidebarPanel";
import * as styles from "./InlineDiffViewPanel.css";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "../DropdownMenu";
import { descMessage, errorMessage, messageContainer } from "./SidebarPanel.css";
import clsx from "clsx";
import { SideTagCopyButton } from "./SideTagButton";
import { useDiffContext } from "@/hooks/useDiffContext";
import { useDiffControllerContext } from "@/hooks/useDiffController";

const diffOptions: QuickDiffOptions = {};
export const MaxTextLength = 300;

type RenderMode = "inline" | "side-by-side" | "stacked";
const renderModeAtom = atomWithStorage<RenderMode>("inlineDiffRenderMode", "stacked");

type InlineDiffViewProps = SidebarPanelRootProps & {}

export function InlineDiffViewPanel({ ...props }: InlineDiffViewProps) {
    const diffContext = useDiffContext();
    const fallbackSelection = useRef<EditorTextSelection | null>(null);
    let editorTextSelection = useAtomValue(editorTextSelectionAtom);
    if (!editorTextSelection) {
        editorTextSelection = fallbackSelection.current;
    } else {
        fallbackSelection.current = editorTextSelection;
    }

    const [renderMode, setRenderMode] = useAtom(renderModeAtom);

    const lastInputOutput = useRef<{ left: string; right: string; options: QuickDiffOptions; diffs: DiffEntry[] | null }>({
        left: "",
        right: "",
        options: diffOptions,
        diffs: [],
    });
    const [entries, setEntries] = useState<DiffEntry[] | null>(null);

    const leftRange = editorTextSelection?.leftTokenRange;
    const rightRange = editorTextSelection?.rightTokenRange;

    const [textPair, setTextPair] = useState<{ left: string; right: string }>({ left: "", right: "" });
    const { left: leftText, right: rightText } = textPair;
    const tooLong = leftText.length > MaxTextLength || rightText.length > MaxTextLength;

    // Create a quickDiff instance (one per component instance)
    const quickDiffInstanceRef = useRef<ReturnType<typeof createQuickDiff> | null>(null);
    if (!quickDiffInstanceRef.current) {
        quickDiffInstanceRef.current = createQuickDiff();
    }
    const quickDiffInstance = quickDiffInstanceRef.current;

    useEffect(() => {
        if (leftRange && rightRange) {
            const leftText = extractTextFromRange(leftRange, { maxLength: MaxTextLength + 1 })[0];
            const rightText = extractTextFromRange(rightRange, { maxLength: MaxTextLength + 1 })[0];
            setTextPair((prev) => {
                if (prev.left === leftText && prev.right === rightText) return prev;
                setEntries(null);
                if (leftText.length <= MaxTextLength && rightText.length <= MaxTextLength) {
                    quickDiffInstance.requestQuickDiff(leftText, rightText, diffOptions, (result) => setEntries(result));
                }
                return { left: leftText, right: rightText };
            });
        } else {
            lastInputOutput.current.left = "";
            lastInputOutput.current.right = "";
        }
        // Clean up: cancel any pending diff if unmounting or changing selection
        return () => {
            // 
            //quickDiffInstance.cancel();
        };
    }, [leftRange, rightRange, quickDiffInstance, diffContext]);

    return (
        <SidebarPanel.Root ariaLabel="Inline Diff 패널" {...props}>
            <SidebarPanel.Header
                leading={
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <button
                                aria-label="보기 옵션"
                            >
                                <SearchCode size={14} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                            <DropdownMenuLabel>보기 방식</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={renderMode} onValueChange={(v) => setRenderMode(v as RenderMode)}>
                                <DropdownMenuRadioItem value="stacked">위/아래</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="side-by-side">나란히</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="inline">합쳐서 보기</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                }
            >Inline Diff</SidebarPanel.Header>
            <SidebarPanel.Body>
                {tooLong ? (
                    <div className={messageContainer}>
                        <p className={errorMessage}>욕심이 과하세요.</p>
                        <p className={descMessage}>{MaxTextLength}글자까지만...</p>
                    </div>
                ) : !leftText && !rightText ? (
                    <div className={messageContainer}>
                        <p className={descMessage}>선택된 텍스트 없음</p>
                    </div>
                ) : entries === null ? (
                    <div className={messageContainer}>
                        <p className={descMessage}>아, 잠깐만요...</p>
                    </div>
                ) : (
                    <RenderContents leftText={leftText} rightText={rightText} entries={entries} renderMode={renderMode} className="p-1" />
                )}
            </SidebarPanel.Body>
        </SidebarPanel.Root>
    );
}

/* ---------- renderers ---------- */

export type RenderContentsProps = React.HTMLAttributes<HTMLDivElement> & {
    entries: DiffEntry[];
    leftText: string;
    rightText: string;
    renderMode: RenderMode;
};

function RenderContents({ leftText, rightText, entries, className, renderMode }: RenderContentsProps) {
    //const renderMode = useAtomValue(renderModeAtom);
    return (
        <div className={clsx(styles.content, className)}>
            {renderMode === "inline"
                ? renderInlineDiff(entries, leftText, rightText)
                : RenderSplitDiff(entries, leftText, rightText, renderMode === "side-by-side" ? "row" : "col")}
        </div>
    );
}

function renderInlineDiff(entries: DiffEntry[], leftText: string, rightText: string) {
    return entries.map((entry, i) => {
        let text = "";
        if ((entry.type === 0 || entry.type === 1) && entry.left) {
            text = leftText.slice(entry.left.start, entry.left.end);
        } else if (entry.type === 2 && entry.right) {
            text = rightText.slice(entry.right.start, entry.right.end);
        }

        const displayText =
            entry.type === 0 ? text : text === "\n" ? "↵\n" : text === "\t" ? "→" : text;

        return (
            <span key={i} className={styles.diff({ type: entry.type as any })}>
                {displayText}
            </span>
        );
    });
}

function RenderSplitDiff(
    entries: DiffEntry[],
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
            const htmlContent = buffer.join("");
            out.push(
                <span
                    key={++spanIndex}
                    className={styles.diff({ type: currentType as any })}
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
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

            if (segText) {
                // HTML 문자열로 특수 문자 처리
                if (entry.type !== 0 && segText === "\n") {
                    buffer.push(`<span class="${styles.specialChar}">↵</span>\n`);
                } else if (entry.type !== 0 && segText === "\t") {
                    buffer.push(`<span class="${styles.specialChar}">→</span>`);
                } else {
                    // HTML 이스케이프 처리
                    const escaped = segText
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    buffer.push(escaped);
                }
            }
        }

        flush();
        return out;
    }

    // className="min-w-0 whitespace-pre-wrap break-words"
    return (
        <div className={clsx(styles.splitWrapper({ dir }))}>
            <div>
                <SideTagCopyButton side="left" getValue={() => leftText} />{" "}
                {build(leftText, "left", 1)}
            </div>

            <div className={styles.splitter({ dir })} />

            <div >
                <SideTagCopyButton side="right" getValue={() => rightText} />{" "}
                {build(rightText, "right", 2)}
            </div>
        </div>
    );
}
