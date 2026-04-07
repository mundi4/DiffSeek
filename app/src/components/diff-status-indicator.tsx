import { useT } from "@/i18n";
import { diffContextAtom, diffWorkflowStatusAtom } from "@/states/core-atoms";
import { Divider, Group, Loader, Popover, Stack, Text, ThemeIcon } from "@mantine/core";
import { useHover } from "@mantine/hooks";
import { IconCheck } from "@tabler/icons-react";
import { useAtomValue, useStore } from "jotai";
import { useEffect, useRef, useState } from "react";

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

    // --- phase timing: 동기적 store subscription으로 추적 (React 배치 우회) ---
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
                // progressive token count update
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

    const color = busy ? undefined : "gray";
    const { hovered, ref } = useHover();

    const currentPhaseIndex = busy ? PHASE_KEYS.indexOf(status.phase as typeof PHASE_KEYS[number]) : -1;
    const doneColor = "green.8";

    return (
        <Popover opened={(popoverOpen || hovered) && (busy || diffContext != null)} position="top-end" withArrow offset={6} transitionProps={{ duration: 0, exitDuration: 300 }}>
            <Popover.Target>
                <Group ref={ref} style={{ cursor: "default" }}>
                    {visible && <Loader type="dots" size="xs" color={color} />}
                    {!visible && <ThemeIcon style={{ display: "inline" }} variant="transparent" size="xs" color={color}><IconCheck size={16} /></ThemeIcon>}
                </Group>
            </Popover.Target>
            <Popover.Dropdown p="xs" bg="rgba(255,255,255,0.6)" miw={200} style={{ backdropFilter: "blur(8px)" }}>
                <Stack gap={3}>
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

                        return (
                            <Group key={key} gap={16} wrap="nowrap" justify="space-between">
                                <Text size="xs" c={isFuture ? "dimmed" : isCurrent ? "blue" : doneColor} fw={isCurrent ? 500 : undefined}>
                                    {PHASE_LABELS[key]}
                                </Text>
                                <Text ff="monospace" size="xs" c={isPast ? doneColor : "dimmed"} style={{ minWidth: 36, textAlign: "right" }}>
                                    {isFuture ? "" : elapsedMs != null ? formatMs(elapsedMs) : ""}
                                </Text>
                            </Group>
                        );
                    })}

                    <Group gap={16} wrap="nowrap" justify="space-between">
                        <Text size="xs" c={busy ? "dimmed" : doneColor}>{t.total}</Text>
                        <Text ff="monospace" c={busy ? "dimmed" : doneColor} size="xs" style={{ minWidth: 36, textAlign: "right" }}>{!busy && snapshot.totalMs != null ? formatMs(snapshot.totalMs) : ""}</Text>
                    </Group>
                    <Divider my={4} />
                    <Group gap={16} wrap="nowrap" justify="space-between">
                        <Text size="xs" c={tokensKnown ? undefined : "dimmed"}>{t.tokens}</Text>
                        <Text ff="monospace" size="xs">
                            {leftTokenCount != null ? leftTokenCount.toLocaleString() : <Text span c="dimmed">...</Text>}
                            {<Text span c="dimmed"> | </Text>}
                            {rightTokenCount != null ? rightTokenCount.toLocaleString() : <Text span c="dimmed">...</Text>}
                        </Text>
                    </Group>
                    <Group gap={16} wrap="nowrap" justify="space-between">
                        <Text size="xs" c={diffsKnown ? undefined : "dimmed"}>{t.diffs}</Text>
                        <Text ff="monospace" size="xs">
                            {diffsKnown ? `${diffEntryCount.toLocaleString()} (${((1 - diffContext!.similarity) * 100).toFixed(1)}%)` : ""}
                        </Text>
                    </Group>

                </Stack>
            </Popover.Dropdown>
        </Popover>
    );
}
