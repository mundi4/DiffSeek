import { useDelayedBusyState } from "@/hooks/use-delayed-busy-state";
import { Box, Notification, Portal, Transition } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

export function BusyIndicator({ busy }: { busy: boolean }) {
    const { visible, status } = useDelayedBusyState(busy, {
        showDelayMs: 300,
        stillAfterMs: 2000,
        minVisibleMs: 400,
        hideDelayMs: 700,
    });

    const startTimeRef = useRef<number>(0);
    const [completedElapsedMs, setCompletedElapsedMs] = useState(0);
    const lastVisibleStatusRef = useRef<typeof status>("running");

    useEffect(() => {
        if (status === "running") {
            startTimeRef.current = performance.now();
            setCompletedElapsedMs(0);
        }
        if (status === "completed") {
            setCompletedElapsedMs(performance.now() - startTimeRef.current);
        }
        if (status !== "hidden") {
            lastVisibleStatusRef.current = status;
        }
    }, [status]);

    const displayStatus = status === "hidden" ? lastVisibleStatusRef.current : status;

    const message = displayStatus === "still"
        ? "조금만 더... 🔥🔥🔥"
        : displayStatus === "completed"
            ? `완료! (${(completedElapsedMs / 1000).toFixed(1)}초)`
            : "조금 시간이 걸리네요.";

    const slideFromTop = {
        in: { opacity: 1, transform: "translateY(0)" },
        out: { opacity: 0, transform: "translateY(-120%)" },
        common: { transformOrigin: "top right" },
        transitionProperty: "transform, opacity",
    };

    return (
        <Portal>
            <Transition mounted={visible} transition={slideFromTop} duration={220} timingFunction="ease">
                {(styles) => (
                    <Box style={{ position: "fixed", top: 8, right: 18, zIndex: 260, ...styles }}>
                        <Notification withCloseButton={false} color={displayStatus === "completed" ? "teal" : "orange"} title={message} />
                    </Box>
                )}
            </Transition>
        </Portal>
    );
}