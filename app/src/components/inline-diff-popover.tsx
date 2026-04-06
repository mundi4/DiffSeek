import { useT } from "@/i18n";
import type { DiffseekEngine } from "@core";
import { FloatingWindow } from "@mantine/core";
import { useQuickDiff } from "@/hooks/use-quick-diff";
import { QuickDiffType, type QuickDiffEntry } from "@/quick-diff";
import { useAtom } from "jotai";
import { quickDiffViewModeAtom, type QuickDiffViewMode } from "@/states/core-atoms";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const RESULT_MIN_WIDTH = 200;
const RESULT_MIN_HEIGHT = 100;
const RESULT_MAX_WIDTH = 420;
const RESULT_MAX_HEIGHT = 320;
const RESULT_FONT_SIZES = [14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];
const MARGIN = 8;
const MENU_GAP = 20;

type ViewMode = QuickDiffViewMode;

// ── 공통 렌더 유틸 ──

function renderSpecialChars(text: string): (string | React.ReactNode)[] {
    const parts: (string | React.ReactNode)[] = [];
    let buf = "";
    let key = 0;
    for (const ch of text) {
        if (ch === "\n") {
            if (buf) { parts.push(buf); buf = ""; }
            parts.push(<span key={key++} className="qdiff-special">{"↵"}</span>);
            parts.push(<br key={key++} />);
        } else if (ch === "\t") {
            if (buf) { parts.push(buf); buf = ""; }
            parts.push(<span key={key++} className="qdiff-special">{"→"}</span>);
        } else {
            buf += ch;
        }
    }
    if (buf) parts.push(buf);
    return parts;
}

function renderInline(entries: QuickDiffEntry[]) {
    return entries.map((entry, i) => {
        const className =
            entry.type === QuickDiffType.Removed ? "qdiff-removed" :
            entry.type === QuickDiffType.Added ? "qdiff-added" :
            "qdiff-unchanged";
        return (
            <span key={i} className={className}>
                {renderSpecialChars(entry.text)}
            </span>
        );
    });
}

function renderSplit(entries: QuickDiffEntry[], layout: "side-by-side" | "stacked") {
    const leftParts: React.ReactNode[] = [];
    const rightParts: React.ReactNode[] = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const rendered = <span key={i}>{renderSpecialChars(entry.text)}</span>;
        if (entry.type === QuickDiffType.Unchanged) {
            leftParts.push(rendered);
            rightParts.push(rendered);
        } else if (entry.type === QuickDiffType.Removed) {
            leftParts.push(<span key={i} className="qdiff-removed">{renderSpecialChars(entry.text)}</span>);
        } else {
            rightParts.push(<span key={i} className="qdiff-added">{renderSpecialChars(entry.text)}</span>);
        }
    }
    const cls = layout === "side-by-side" ? "qdiff-split-h" : "qdiff-split-v";
    return (
        <div className={cls}>
            <div className="qdiff-split-left">{leftParts}</div>
            <div className="qdiff-split-right">{rightParts}</div>
        </div>
    );
}

function renderContent(entries: QuickDiffEntry[], viewMode: ViewMode) {
    if (viewMode === "inline") return renderInline(entries);
    return renderSplit(entries, viewMode);
}

// ── SelectionMenu ──

function SelectionMenu({ x, y, opacity, workspace, onClickDiff }: { x: number; y: number; opacity: number; workspace: HTMLElement; onClickDiff: () => void }) {
    const t = useT();
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        const w = ref.current.offsetWidth;
        const h = ref.current.offsetHeight;
        const vh = window.innerHeight;

        const wsRect = workspace.getBoundingClientRect();
        const left = Math.max(wsRect.left + MARGIN, Math.min(x, wsRect.right - w - MARGIN));
        const above = y - MENU_GAP - h >= 0;

        setPos(above
            ? { left, bottom: vh - y + MENU_GAP }
            : { left, top: y + MENU_GAP }
        );
    }, [x, y, workspace]);

    return (
        <div
            ref={ref}
            className="qdiff-menu"
            style={{
                position: "fixed",
                left: pos?.left ?? x,
                top: pos?.top,
                bottom: pos?.bottom,
                opacity,
                visibility: pos ? "visible" : "hidden",
            }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <button className="qdiff-menu-btn" onClick={onClickDiff}>
                {t.diffButton}
            </button>
        </div>
    );
}

// ── ResultPopover (FloatingWindow) ──

function ResultPopover({ result, anchorX, anchorY, workspace, lastPositionRef, onDismiss }: {
    result: { entries: QuickDiffEntry[] };
    anchorX: number;
    anchorY: number;
    workspace: HTMLElement;
    lastPositionRef: React.MutableRefObject<{ top: number; left: number } | null>;
    onDismiss: (popoverEl?: HTMLElement | null) => void;
}) {
    const t = useT();
    const rootRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [viewMode, changeViewMode] = useAtom(quickDiffViewModeAtom);
    const contentCallbackRef = useCallback((node: HTMLDivElement | null) => {
        if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
        }
        contentRef.current = node;
        if (!node) return;

        if (viewMode === "inline") {
            fitFont(node);

            const container = node.parentElement;
            if (container) {
                let rafId: number | null = null;
                const observer = new ResizeObserver(() => {
                    if (rafId !== null) return;
                    rafId = requestAnimationFrame(() => {
                        rafId = null;
                        if (contentRef.current) fitFont(contentRef.current);
                    });
                });
                observer.observe(container);
                resizeObserverRef.current = observer;
            }
        } else {
            node.style.fontSize = "";
        }
    }, [result, viewMode]);
    const setPositionRef = useRef<((pos: { top?: number; left?: number; right?: number; bottom?: number }) => void) | null>(null);
    const [ready, setReady] = useState(false);
    const [wsSize, setWsSize] = useState({ width: workspace.offsetWidth, height: workspace.offsetHeight });

    // workspace 리사이즈 추적 + 팝업 위치 viewport clamp + cleanup
    useEffect(() => {
        const handleResize = () => {
            setWsSize({ width: workspace.offsetWidth, height: workspace.offsetHeight });

            // 팝업이 viewport 밖으로 밀려났으면 보정
            const root = rootRef.current;
            const setPos = setPositionRef.current;
            if (root && setPos) {
                const rect = root.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                let left = rect.left;
                let top = rect.top;
                let needsUpdate = false;

                if (rect.right > vw) { left = vw - rect.width; needsUpdate = true; }
                if (rect.bottom > vh) { top = vh - rect.height; needsUpdate = true; }
                if (left < 0) { left = 0; needsUpdate = true; }
                if (top < 0) { top = 0; needsUpdate = true; }

                if (needsUpdate) setPos({ left, top });
            }
        };

        const wsObserver = new ResizeObserver(handleResize);
        wsObserver.observe(workspace);
        window.addEventListener("resize", handleResize);
        return () => {
            wsObserver.disconnect();
            window.removeEventListener("resize", handleResize);
            resizeObserverRef.current?.disconnect();
        };
    }, []);

    // 초기 위치: 저장된 위치가 있으면 사용, 없으면 워크스페이스 기준 계산
    const initialPosition = useMemo(() => {
        if (lastPositionRef.current) return lastPositionRef.current;
        const wsRect = workspace.getBoundingClientRect();
        const left = Math.max(wsRect.left + MARGIN, Math.min(anchorX, wsRect.right - RESULT_MAX_WIDTH - MARGIN));
        const top = anchorY + MENU_GAP;
        return { top, left };
    }, [anchorX, anchorY, workspace]);

    // 마운트 후 실제 크기로 위치 보정
    useEffect(() => {
        if (!rootRef.current || !setPositionRef.current) return;
        const w = rootRef.current.offsetWidth;
        const h = rootRef.current.offsetHeight;
        const wsRect = workspace.getBoundingClientRect();

        const left = Math.max(wsRect.left + MARGIN, Math.min(anchorX, wsRect.right - w - MARGIN));
        let top: number;
        if (anchorY + MENU_GAP + h <= wsRect.bottom) {
            top = anchorY + MENU_GAP;
        } else if (anchorY - MENU_GAP - h >= wsRect.top) {
            top = anchorY - MENU_GAP - h;
        } else {
            top = Math.max(wsRect.top + MARGIN, wsRect.bottom - h - MARGIN);
        }

        setPositionRef.current({ top, left });
        setReady(true);
    }, [anchorX, anchorY, workspace]);

    // 미리 지정된 폰트 크기 중 스크롤바가 안 생기는 최대 크기 탐색 (큰 것부터)
    function fitFont(el: HTMLElement) {
        for (let i = RESULT_FONT_SIZES.length - 1; i >= 0; i--) {
            el.style.fontSize = RESULT_FONT_SIZES[i] + "px";
            if (el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth) return;
        }
        // 최소 크기에서도 넘치면 최소로 고정 (스크롤 허용)
        el.style.fontSize = RESULT_FONT_SIZES[0] + "px";
    }

    // ESC로 닫기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onDismiss(rootRef.current);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onDismiss]);

    const handleClose = useCallback(() => {
        onDismiss(rootRef.current);
    }, [onDismiss]);

    const handlePositionChange = useCallback((pos: { x: number; y: number }) => {
        lastPositionRef.current = { top: pos.y, left: pos.x };
    }, []);

    return (
        <FloatingWindow
            ref={rootRef}
            onPositionChange={handlePositionChange}
            setPositionRef={setPositionRef}
            className="qdiff-result"
            enabled
            constrainToViewport
            constrainOffset={MARGIN}
            dragHandleSelector=".qdiff-result-grip"
            excludeDragHandleSelector=".qdiff-result-close, .qdiff-viewmode-btn"
            initialPosition={initialPosition}
            zIndex={9999}
            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
            style={{
                width: RESULT_MAX_WIDTH,
                height: RESULT_MAX_HEIGHT,
                minWidth: RESULT_MIN_WIDTH,
                minHeight: RESULT_MIN_HEIGHT,
                maxWidth: wsSize.width,
                maxHeight: wsSize.height,
            }}
        >
            <div className="qdiff-result-titlebar qdiff-result-grip">
                <span className="qdiff-result-title">{t.selectionDiffTitle}</span>
                <div className="qdiff-viewmode-btns">
                    <button className={`qdiff-viewmode-btn${viewMode === "inline" ? " active" : ""}`} onClick={() => changeViewMode("inline")} title={t.viewModeInline}>
                        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="1" fill="currentColor" /></svg>
                    </button>
                    <button className={`qdiff-viewmode-btn${viewMode === "side-by-side" ? " active" : ""}`} onClick={() => changeViewMode("side-by-side")} title={t.viewModeSideBySide}>
                        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="4" height="10" rx="1" fill="currentColor" /><rect x="7" y="1" width="4" height="10" rx="1" fill="currentColor" /></svg>
                    </button>
                    <button className={`qdiff-viewmode-btn${viewMode === "stacked" ? " active" : ""}`} onClick={() => changeViewMode("stacked")} title={t.viewModeStacked}>
                        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="4" rx="1" fill="currentColor" /><rect x="1" y="7" width="10" height="4" rx="1" fill="currentColor" /></svg>
                    </button>
                </div>
                <button className="qdiff-result-close" onClick={handleClose}>
                    <svg width="10" height="10" viewBox="0 0 10 10">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>
            <div ref={contentCallbackRef} className="qdiff-result-content">
                {renderContent(result.entries, viewMode)}
            </div>
        </FloatingWindow>
    );
}

// ── Root ──

export function InlineDiffPopover({ engine }: { engine: DiffseekEngine }) {
    const { available, menu, menuOpacity, result, resultPosition, requestDiff, dismissResult } = useQuickDiff(engine);
    const lastPositionRef = useRef<{ top: number; left: number } | null>(null);

    // Alt+Q 단축키
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.code === "KeyQ") {
                e.preventDefault();
                if (available) requestDiff();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [available, requestDiff]);

    return (
        <>
            {menu && (
                <SelectionMenu x={menu.x} y={menu.y} opacity={menuOpacity} workspace={engine.workspaceEl} onClickDiff={requestDiff} />
            )}
            {result && resultPosition && (
                <ResultPopover
                    result={result}
                    anchorX={resultPosition.x}
                    anchorY={resultPosition.y}
                    workspace={engine.workspaceEl}
                    lastPositionRef={lastPositionRef}
                    onDismiss={dismissResult}
                />
            )}
        </>
    );
}
