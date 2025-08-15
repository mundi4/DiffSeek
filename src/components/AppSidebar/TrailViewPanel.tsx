import * as React from "react";
import { useAtomValue } from "jotai";
import { ListTree } from "lucide-react";
import { useDiffContext } from "@/hooks/useDiffContext";
import { editorTextSelectionAtom } from "@/states/atoms";
import { SidebarPanel, type SidebarPanelRootProps } from "./SidebarPanel";
import clsx from "clsx";
import * as styles from "./TrailViewPanel.css";
import { descMessage, messageContainer } from "./SidebarPanel.css";
import { SideTagCopyButton } from "./SideTagButton";
import { useDiffControllerContext } from "@/hooks/useDiffController";

type TrailViewProps = SidebarPanelRootProps & {}

interface EditorTextSelection {
    leftTokenRange?: Range;
    rightTokenRange?: Range;
    leftTokenSpan: { start: number; end: number };
    rightTokenSpan: { start: number; end: number };
    sourceEditor: "left" | "right";
    sourceSpan: { start: number; end: number };
}

export function TrailViewPanel({ className, ...props }: TrailViewProps) {
    const fallbackSelection = React.useRef<EditorTextSelection | null>(null);
    let editorTextSelection = useAtomValue(editorTextSelectionAtom) as EditorTextSelection | null;
    if (!editorTextSelection) editorTextSelection = fallbackSelection.current;
    else fallbackSelection.current = editorTextSelection;

    const diffContext = useDiffContext();

    let leftHeadings: SectionHeading[] = [];
    let rightHeadings: SectionHeading[] = [];

    if (diffContext && editorTextSelection) {
        const { leftTokenSpan, rightTokenSpan, sourceEditor, sourceSpan } = editorTextSelection;
        leftHeadings = diffContext.getSelectionTrailFromTokenIndex(
            "left",
            (sourceEditor === "left" ? sourceSpan : leftTokenSpan).start
        );
        rightHeadings = diffContext.getSelectionTrailFromTokenIndex(
            "right",
            (sourceEditor === "right" ? sourceSpan : rightTokenSpan).start
        );
    }

    return (
        <SidebarPanel.Root
            ariaLabel="Breadcrumbs"
            className={clsx(className)}
            {...props}

        >
            <SidebarPanel.Header
                // 타이틀 없이 leading 아이콘 하나만 (드롭다운 트리거)
                leading={
                    <ListTree size={14} />
                    // <SidebarPanel.HeaderMenu
                    //     trigger={
                    //         <button
                    //             aria-label="보기 옵션"
                    //             className="grid place-items-center size-6 rounded hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    //         >
                    //             <ListTree size={14} />
                    //         </button>
                    //     }
                    // >
                    //     <DropdownMenuLabel>보기 방식</DropdownMenuLabel>
                    //     {/* 여기에 라디오/토글 등 옵션 */}
                    // </SidebarPanel.HeaderMenu>
                }
            >Breadcrumbs</SidebarPanel.Header>
            <SidebarPanel.Body>
                {!editorTextSelection && <div className={messageContainer}>
                    <p className={descMessage}>선택된 위치 없음</p>
                </div>}
                {(leftHeadings.length > 0 || rightHeadings.length > 0) && (
                    <>
                        <Trail trail={leftHeadings} side="left" />
                        <Trail trail={rightHeadings} side="right" />
                    </>
                )}
            </SidebarPanel.Body>
        </SidebarPanel.Root>
    );
}

interface TrailProps {
    side: "left" | "right";
    trail: SectionHeading[];
}

function getTrailText(trail: SectionHeading[]) {
    return trail.map((h) => `${h.ordinalText} ${h.title}`).join(" › ");
}

function Trail({ side, trail }: TrailProps) {
    const { diffController } = useDiffControllerContext();
    const getValue = () => getTrailText(trail);
    const onHeadingClick = (heading: SectionHeading) => {
        //console.log("heading clicked", heading)
        diffController.scrollToTokenIndex(side, heading.startTokenIndex);
    };
    return (
        <div className={clsx(styles.trail)}>
            <SideTagCopyButton getValue={getValue} side={side} />
            <div>
                {trail.map((h, i) => (
                    <React.Fragment key={i}>
                        <a className={styles.trailLink} onClick={() => onHeadingClick(h)}>
                            <span className={clsx(styles.ordinalText)}>{h.ordinalText}</span>{" "}
                            <span className={clsx(styles.headingTitle)}>{h.title}</span>
                        </a>
                        {i < trail.length - 1 && <span className={clsx(styles.separator)}> › </span>}
                    </React.Fragment>
                ))}

            </div>
        </div>
    );
}

