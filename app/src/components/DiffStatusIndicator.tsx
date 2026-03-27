import { diffContextAtom, diffWorkflowStatusAtom } from "@/states/coreAtoms";
import { Box, Divider, Group, Loader, Popover, Stack, Text, ThemeIcon } from "@mantine/core";
import { useHover } from "@mantine/hooks";
import { IconCheck } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";

const MIN_VISIBLE_MS = 500;

const PHASES = [
    { key: "tokenizing", label: "Tokenizing" },
    { key: "diffing", label: "Diffing" },
    { key: "processing", label: "Processing" },
] as const;

function formatMs(ms: number) {
    return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function DiffStatusIndicator() {
    const status = useAtomValue(diffWorkflowStatusAtom);
    const diffContext = useAtomValue(diffContextAtom);

    const busy = status.phase !== "idle";
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

    const [now, setNow] = useState(() => performance.now());
    useEffect(() => {
        if (!busy) return;
        const id = setInterval(() => setNow(performance.now()), 100);
        return () => clearInterval(id);
    }, [busy]);

    const color = busy ? undefined : "gray";
    const { hovered, ref } = useHover();

    const currentPhaseIndex = busy ? PHASES.findIndex(p => p.key === status.phase) : -1;

    const doneColor = "green.8";

    return (
        <Popover opened={hovered && (busy || diffContext != null)} position="top-end" withArrow offset={6}>
            <Popover.Target>
                <Group ref={ref} style={{ cursor: "default" }}>
                    {visible && <Loader type="dots" size="xs" color={color} />}
                    {!visible && <ThemeIcon style={{ display: "inline" }} variant="transparent" size="xs" color={color}><IconCheck size={16} /></ThemeIcon>}
                </Group>
            </Popover.Target>
            <Popover.Dropdown p="xs">
                <Stack gap={3}>
                    {PHASES.map(({ key, label }, phaseIndex) => {
                        const isCurrent = phaseIndex === currentPhaseIndex;
                        const isPast = busy ? phaseIndex < currentPhaseIndex : true;
                        const isFuture = busy && phaseIndex > currentPhaseIndex;

                        let elapsedMs: number | null = null;
                        if (isPast) {
                            if (key === "tokenizing") elapsedMs = busy ? (status.tokenizingMs ?? null) : (diffContext?.timingTokenizingMs ?? null);
                            else if (key === "diffing") elapsedMs = busy ? (status.diffingMs ?? null) : (diffContext?.timingDiffingMs ?? null);
                            else if (key === "processing") elapsedMs = !busy ? (diffContext?.timingProcessingMs ?? null) : null;
                        } else if (isCurrent && status.startedAtMs != null) {
                            elapsedMs = Math.max(0, now - status.startedAtMs);
                        }

                        return (
                            <Group key={key} gap={16} wrap="nowrap" justify="space-between">
                                <Text size="xs" c={isFuture ? "dimmed" : isCurrent ? "blue" : doneColor} fw={isCurrent ? 500 : undefined}>
                                    {label}
                                </Text>
                                <Text ff="monospace" size="xs" c={isPast ? doneColor : "dimmed"} style={{ minWidth: 36, textAlign: "right" }}>
                                    {isFuture ? "" : elapsedMs != null ? formatMs(elapsedMs) : ""}
                                </Text>
                            </Group>
                        );
                    })}

                    {!busy && (
                        <>
                            <Group gap={16} wrap="nowrap" justify="space-between">
                                <Text size="xs" c={doneColor}>Total</Text>
                                <Text ff="monospace" c={doneColor} size="xs" style={{ minWidth: 36, textAlign: "right" }}>{diffContext ? formatMs(diffContext.timingTotalMs) : ""}</Text>
                            </Group>
                            <Divider my={4} />
                            <Group gap={16} wrap="nowrap" justify="space-between">
                                <Text size="xs" c="dimmed">Tokens</Text>
                                <Text ff="monospace" size="xs">{(diffContext?.leftTokenCount ?? 0).toLocaleString()} | {(diffContext?.rightTokenCount ?? 0).toLocaleString()}</Text>
                            </Group>

                            <Group gap={16} wrap="nowrap" justify="space-between">
                                <Text size="xs" c="dimmed">Diffs</Text>
                                <Text ff="monospace" size="xs">{(diffContext?.diffs.length ?? 0).toLocaleString()}</Text>
                            </Group>
                        </>
                    )}

                </Stack>
            </Popover.Dropdown>
        </Popover>
    );
}
