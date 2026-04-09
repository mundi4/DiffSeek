import { useT } from "@/i18n";
import { diffContextAtom, diffWorkflowStatusAtom } from "@/states/core-atoms";
import { CheckIcon } from "./icons";
import { useAtomValue, useStore } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import css from "./diff-status-indicator.module.css";

const MIN_VISIBLE_MS = 500;
const POPOVER_FADE_DELAY_MS = 1000;

const PHASE_KEYS = ["tokenizing", "diffing", "processing"] as const;

type TimingSnapshot = {
    tokenizingMs?: number;
    diffingMs?: number;
    processingMs?: number;
    totalMs?: number;
    leftTokenCount?: number;
    rightTokenCount?: number;
};

export function DiffStatusIndicator() {
    const t = useT();
    const status = useAtomValue(diffWorkflowStatusAtom);
    const diffContext = useAtomValue(diffContextAtom);
    const store = useStore();

    const PHASE_LABELS: Record<typeof PHASE_KEYS[number], string> = {
        tokenizing: t.phaseTokenizing,
        diffing: t.phaseDiffing,
        processing: t.phaseProcessing,
    };

    function formatMs(ms: number) {
        return ms < 1000 ? `${ms.toFixed(0)}${t.unitMs}` : `${(ms / 1000).toFixed(1)}${t.unitS}`;
    }

    const busy = status.phase !== "idle";

    // --- loader visibility (min display time) ---
    const [visible, setVisible] = useState(false);
    const visibleRef = useRef(false);
    const visibleSinceRef = useRef(0);
    const hideTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (busy) {
            if (hideTimerRef.current !== null) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
            if (!visibleRef.current) {
                visibleSinceRef.current = performance.now();
                visibleRef.current = true;
                setVisible(true);
            }
            return;
        }

        if (!visibleRef.current) return;

        const elapsed = performance.now() - visibleSinceRef.current;
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

        hideTimerRef.current = window.setTimeout(() => {
            visibleRef.current = false;
            setVisible(false);
            hideTimerRef.current = null;
        }, remaining);

        return () => {
            if (hideTimerRef.current !== null) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };
    }, [busy]);

    // --- live clock for elapsed display ---
    const [now, setNow] = useState(() => performance.now());
    useEffect(() => {
        if (!busy) return;
        const id = setInterval(() => setNow(performance.now()), 100);
        return () => clearInterval(id);
    }, [busy]);

    // --- popover auto open/close ---
    const [popoverFading, setPopoverFading] = useState(false);
    const popoverTimerRef = useRef<number | null>(null);

    const popoverOpen = busy || popoverFading;

    useEffect(() => {
        if (busy) {
            if (popoverTimerRef.current !== null) {
                clearTimeout(popoverTimerRef.current);
                popoverTimerRef.current = null;
            }
            setPopoverFading(true);
        } else if (popoverFading) {
            popoverTimerRef.current = window.setTimeout(() => {
                setPopoverFading(false);
                popoverTimerRef.current = null;
            }, POPOVER_FADE_DELAY_MS);
        }
        return () => {
            if (popoverTimerRef.current !== null) {
                clearTimeout(popoverTimerRef.current);
                popoverTimerRef.current = null;
            }
        };
    }, [busy]);

    // --- hover ---
    const [hovered, setHovered] = useState(false);

    // --- phase timing ---
    const phaseStartsRef = useRef<Record<string, number>>({});
    const [snapshot, setSnapshot] = useState<TimingSnapshot>({});

    useEffect(() => {
        const unsub = store.sub(diffWorkflowStatusAtom, () => {
            const s = store.get(diffWorkflowStatusAtom);
            const phase = s.phase;
            const starts = phaseStartsRef.current;

            const newStart = s.startedAtMs ?? performance.now();

            if (phase === "tokenizing" && (!starts.tokenizing || starts.tokenizing !== newStart)) {
                phaseStartsRef.current = { tokenizing: newStart };
                setSnapshot({
                    leftTokenCount: s.leftTokenCount,
                    rightTokenCount: s.rightTokenCount,
                });
            } else if (phase === "tokenizing") {
                setSnapshot(prev => ({
                    ...prev,
                    leftTokenCount: s.leftTokenCount ?? prev.leftTokenCount,
                    rightTokenCount: s.rightTokenCount ?? prev.rightTokenCount,
                }));
            } else if (phase === "diffing" && !starts.diffing) {
                const t = s.startedAtMs ?? performance.now();
                starts.diffing = t;
                setSnapshot(prev => ({
                    ...prev,
                    tokenizingMs: t - (starts.tokenizing ?? t),
                    leftTokenCount: s.leftTokenCount ?? prev.leftTokenCount,
                    rightTokenCount: s.rightTokenCount ?? prev.rightTokenCount,
                }));
            } else if (phase === "processing" && !starts.processing) {
                const t = s.startedAtMs ?? performance.now();
                starts.processing = t;
                setSnapshot(prev => ({
                    ...prev,
                    diffingMs: t - (starts.diffing ?? t),
                }));
            } else if (phase === "idle" && starts.tokenizing) {
                const t = performance.now();
                setSnapshot(prev => ({
                    ...prev,
                    processingMs: starts.processing ? t - starts.processing : undefined,
                    totalMs: t - starts.tokenizing,
                }));
                phaseStartsRef.current = {};
            }
        });
        return unsub;
    }, [store]);

    const leftTokenCount = snapshot.leftTokenCount;
    const rightTokenCount = snapshot.rightTokenCount;
    const diffEntryCount = !busy ? diffContext?.diffs.length : undefined;

    const tokensKnown = leftTokenCount != null && rightTokenCount != null;
    const diffsKnown = diffEntryCount != null;

    const currentPhaseIndex = busy ? PHASE_KEYS.indexOf(status.phase as typeof PHASE_KEYS[number]) : -1;

    // --- popover positioning ---
    const triggerRef = useRef<HTMLDivElement>(null);
    const hasContent = busy || diffContext != null;
    const showPopover = (popoverOpen || hovered) && hasContent;

    const getPopoverStyle = useCallback((): React.CSSProperties => {
        if (!triggerRef.current) return {};
        const rect = triggerRef.current.getBoundingClientRect();
        return {
            bottom: window.innerHeight - rect.top + 12,
            right: window.innerWidth - rect.right,
        };
    }, []);

    return (
        <div
            ref={triggerRef}
            className={css.trigger}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {visible && (
                <span className={css.loaderDots}>
                    <span /><span /><span />
                </span>
            )}
            {!visible && (
                <span className={css.checkIcon}>
                    <CheckIcon size={16} />
                </span>
            )}
            {hasContent && (
                <div className={`${css.popover} ${showPopover ? "" : css.popoverHidden}`} style={getPopoverStyle()}>
                    <div className={css.stack}>
                        {PHASE_KEYS.map((key, phaseIndex) => {
                            const isCurrent = phaseIndex === currentPhaseIndex;
                            const isPast = busy ? phaseIndex < currentPhaseIndex : true;
                            const isFuture = busy ? phaseIndex > currentPhaseIndex : false;

                            let elapsedMs: number | null = null;
                            if (isPast) {
                                if (key === "tokenizing") elapsedMs = snapshot.tokenizingMs ?? null;
                                else if (key === "diffing") elapsedMs = snapshot.diffingMs ?? null;
                                else if (key === "processing") elapsedMs = snapshot.processingMs ?? null;
                            } else if (isCurrent && status.startedAtMs != null) {
                                elapsedMs = Math.max(0, now - status.startedAtMs);
                            }

                            const labelColor = isFuture ? css.dimmed : isCurrent ? css.blue : css.green;
                            const valueColor = isPast ? css.green : css.dimmed;

                            return (
                                <div key={key} className={css.row}>
                                    <span className={`${css.label} ${labelColor} ${isCurrent ? css.bold : ""}`}>
                                        {PHASE_LABELS[key]}
                                    </span>
                                    <span className={`${css.mono} ${valueColor}`}>
                                        {isFuture ? "" : elapsedMs != null ? formatMs(elapsedMs) : ""}
                                    </span>
                                </div>
                            );
                        })}

                        <div className={css.row}>
                            <span className={`${css.label} ${busy ? css.dimmed : css.green}`}>{t.total}</span>
                            <span className={`${css.mono} ${busy ? css.dimmed : css.green}`}>
                                {!busy && snapshot.totalMs != null ? formatMs(snapshot.totalMs) : ""}
                            </span>
                        </div>
                        <hr className={css.divider} />
                        <div className={css.row}>
                            <span className={`${css.label} ${tokensKnown ? "" : css.dimmed}`}>{t.tokens}</span>
                            <span className={css.mono}>
                                {leftTokenCount != null ? leftTokenCount.toLocaleString() : <span className={css.dimmed}>...</span>}
                                <span className={css.dimmed}> | </span>
                                {rightTokenCount != null ? rightTokenCount.toLocaleString() : <span className={css.dimmed}>...</span>}
                            </span>
                        </div>
                        <div className={css.row}>
                            <span className={`${css.label} ${diffsKnown ? "" : css.dimmed}`}>{t.diffs}</span>
                            <span className={css.mono}>
                                {diffsKnown ? `${diffEntryCount.toLocaleString()} (${((1 - diffContext!.similarity) * 100).toFixed(1)}%)` : ""}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
