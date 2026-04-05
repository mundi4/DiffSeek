import type { DiffseekEngine } from "@core";
import { useCallback, useEffect, useRef, useState } from "react";
import { computeCharDiff, type QuickDiffEntry, type QuickDiffResult } from "@/quick-diff";

const CHAR_THRESHOLD = 10000;
const MENU_FADE_START = 40;
const MENU_FADE_END = 120;

type Span = { start: number; end: number };

type SelectionMenuState = {
    x: number;
    y: number;
    anchorX: number;
    anchorY: number;
    leftSpan: Span;
    rightSpan: Span;
};

export type QuickDiffState = {
    available: boolean;
    menu: SelectionMenuState | null;
    menuOpacity: number;
    result: QuickDiffResult | null;
    resultPosition: { x: number; y: number } | null;
    requestDiff: () => void;
    dismissResult: (popoverEl?: HTMLElement | null) => void;
};

export function useQuickDiff(engine: DiffseekEngine): QuickDiffState {
    const [available, setAvailable] = useState(false);
    const [menu, setMenu] = useState<SelectionMenuState | null>(null);
    const [menuOpacity, setMenuOpacity] = useState(1);
    const [result, setResult] = useState<QuickDiffResult | null>(null);
    const [resultPosition, setResultPosition] = useState<{ x: number; y: number } | null>(null);
    const savedSelectionRef = useRef<Range | null>(null);
    const lastSpanRef = useRef<{ left: Span; right: Span } | null>(null);

    const menuRef = useRef(menu);
    menuRef.current = menu;
    const resultPositionRef = useRef(resultPosition);
    resultPositionRef.current = resultPosition;
    const hasResultRef = useRef(false);
    hasResultRef.current = result !== null;

    useEffect(() => {
        const updateLastSpan = (span: { left: Span; right: Span } | null) => {
            lastSpanRef.current = span;
            setAvailable(span !== null);
        };
        let isDragging = false;

        const workspace = engine.workspaceEl;

        const handleMouseDown = (e: MouseEvent) => {
            if (!workspace.contains(e.target as Node)) return;
            isDragging = true;
            closeMenu();
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!isDragging) return;
            isDragging = false;

            if (lastSpanRef.current) {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
                    setMenu({
                        x: e.clientX,
                        y: e.clientY,
                        anchorX: e.clientX,
                        anchorY: e.clientY,
                        leftSpan: lastSpanRef.current.left,
                        rightSpan: lastSpanRef.current.right,
                    });
                }
            }
        };

        const closeMenu = () => {
            setMenu(null);
            setMenuOpacity(1);
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (menuRef.current) {
                const dx = e.clientX - menuRef.current.anchorX;
                const dy = e.clientY - menuRef.current.anchorY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist >= MENU_FADE_END) {
                    closeMenu();
                } else if (dist > MENU_FADE_START) {
                    setMenuOpacity(1 - (dist - MENU_FADE_START) / (MENU_FADE_END - MENU_FADE_START));
                } else {
                    setMenuOpacity(1);
                }
            }
        };

        const handleScroll = () => {
            if (menuRef.current) {
                closeMenu();
            }
        };

        const handleSelectionChange = (data: { left: Span | null; right: Span | null }) => {
            if (data.left && data.right) {
                updateLastSpan({ left: data.left, right: data.right });
            } else {
                updateLastSpan(null);
                closeMenu();
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("scroll", handleScroll, true);
        const unsub = engine.on("selectionChanged", handleSelectionChange);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("scroll", handleScroll, true);
            unsub();
        };
    }, [engine]);

    const requestDiff = useCallback(() => {
        const span = lastSpanRef.current;
        if (!span) return;

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
        } else {
            savedSelectionRef.current = null;
        }

        const alreadyOpen = hasResultRef.current && resultPositionRef.current !== null;
        const m = menuRef.current;
        const posX = alreadyOpen ? resultPositionRef.current!.x : (m?.x ?? window.innerWidth / 2);
        const posY = alreadyOpen ? resultPositionRef.current!.y : (m?.y ?? window.innerHeight / 2);
        setMenu(null);

        const segments = engine.segmentSpanPair(span.left, span.right);
        if (segments.length === 0) {
            setResult(null);
            setResultPosition(null);
            return;
        }

        const allEntries: QuickDiffEntry[] = [];
        let totalChars = 0;

        for (let si = 0; si < segments.length; si++) {
            const seg = segments[si];
            let leftText = seg.left ? (engine.getTextForTokenSpan("left", seg.left) ?? "") : "";
            let rightText = seg.right ? (engine.getTextForTokenSpan("right", seg.right) ?? "") : "";

            if (si === segments.length - 1) {
                leftText = leftText.trimEnd();
                rightText = rightText.trimEnd();
            }

            totalChars += leftText.length + rightText.length;
            if (totalChars > CHAR_THRESHOLD * 2) {
                setResult(null);
                setResultPosition(null);
                return;
            }

            const segResult = computeCharDiff(leftText, rightText);

            for (const entry of segResult.entries) {
                const last = allEntries[allEntries.length - 1];
                if (last && last.type === entry.type) {
                    last.text += entry.text;
                } else {
                    allEntries.push({ ...entry });
                }
            }
        }

        setResult({
            leftText: "",
            rightText: "",
            entries: allEntries,
        });
        setResultPosition({ x: posX, y: posY });
    }, [engine]);

    const dismissResult = useCallback((popoverEl?: HTMLElement | null) => {
        const saved = savedSelectionRef.current;
        if (popoverEl && saved) {
            const sel = window.getSelection();
            const currentRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
            const selectionInsidePopover = currentRange
                && popoverEl.contains(currentRange.startContainer)
                && popoverEl.contains(currentRange.endContainer);

            if (selectionInsidePopover
                && saved.startContainer.isConnected
                && saved.endContainer.isConnected) {
                sel!.removeAllRanges();
                sel!.addRange(saved);
            }
        }
        savedSelectionRef.current = null;

        setResult(null);
        setResultPosition(null);
    }, []);

    return { available, menu, menuOpacity, result, resultPosition, requestDiff, dismissResult };
}
