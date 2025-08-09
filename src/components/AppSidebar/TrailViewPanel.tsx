import * as React from "react";
import { cn } from "@/lib/utils";
import { useAtomValue } from "jotai";
import { ListTree } from "lucide-react";
import { DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useDiffContext } from "@/hooks/useDiffContext";
import { editorTextSelectionAtom } from "@/states/atoms";
import { SectionTrail } from "@/components/AppSidebar/SectionTrail";
import { SidebarPanel } from "./SidebarPanel";

interface TrailViewProps { className?: string }
interface EditorTextSelection {
    leftTokenRange?: Range;
    rightTokenRange?: Range;
    leftTokenSpan: { start: number; end: number };
    rightTokenSpan: { start: number; end: number };
    sourceEditor: "left" | "right";
    sourceSpan: { start: number; end: number };
}

export function TrailViewPanel({ className }: TrailViewProps) {
    // selection fallback 유지
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
            ariaLabel="Trail 패널"
            divided
            className={cn("shadow-none rounded-none", className)}
        >
            <SidebarPanel.Header
                // 타이틀 없이 leading 아이콘 하나만 (드롭다운 트리거)
                leading={
                    <SidebarPanel.HeaderMenu
                        trigger={
                            <button
                                aria-label="보기 옵션"
                                className="grid place-items-center size-6 rounded hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <ListTree size={14} />
                            </button>
                        }
                    >
                        <DropdownMenuLabel>보기 방식</DropdownMenuLabel>
                        {/* 여기에 라디오/토글 등 옵션 */}
                    </SidebarPanel.HeaderMenu>
                }
            />
            <SidebarPanel.Body>
                {/* 컨텐츠만 스크롤: Body가 ScrollArea를 감싸줌 */}
                <div className="h-full min-h-0 overflow-x-hidden [scrollbar-gutter:stable] pr-2">
                    <SectionTrail leftTrail={leftHeadings} rightTrail={rightHeadings} />
                </div>
            </SidebarPanel.Body>
        </SidebarPanel.Root>
    );
}
