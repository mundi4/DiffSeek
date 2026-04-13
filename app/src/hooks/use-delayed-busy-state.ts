import { useEffect, useRef, useState } from "react";

export type DelayedBusyStateOptions = {
	showDelayMs?: number;
	stillAfterMs?: number;
	minVisibleMs?: number;
	hideDelayMs?: number;
};

export type DelayedBusyState = {
	visible: boolean;
	status: "hidden" | "running" | "still" | "completed";
};

export function useDelayedBusyState(
	busy: boolean,
	{ showDelayMs = 500, stillAfterMs = 3000, minVisibleMs = 400, hideDelayMs = 250 }: DelayedBusyStateOptions = {},
): DelayedBusyState {
	const [visible, setVisible] = useState(false);
	const [status, setStatus] = useState<DelayedBusyState["status"]>("hidden");

	const busyRef = useRef(busy);
	const sessionStartRef = useRef(0);
	const visibleSinceRef = useRef(0);

	const showTimerRef = useRef<number | null>(null);
	const hideTimerRef = useRef<number | null>(null);
	const stillTimerRef = useRef<number | null>(null);
	const visibleRef = useRef(false);

	const setVisibleState = (nextVisible: boolean) => {
		visibleRef.current = nextVisible;
		setVisible(nextVisible);
	};

	const clearTimer = (timerRef: { current: number | null }) => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	};

	const clearBusyTimers = () => {
		clearTimer(showTimerRef);
		clearTimer(stillTimerRef);
	};

	const endSession = () => {
		sessionStartRef.current = 0;
		setVisibleState(false);
		setStatus("hidden");
	};

	useEffect(() => {
		busyRef.current = busy;
	}, [busy]);

	useEffect(() => {
		const now = performance.now();

		if (busy) {
			clearTimer(hideTimerRef);
			if (sessionStartRef.current === 0) {
				sessionStartRef.current = now;
			}

			const elapsed = now - sessionStartRef.current;
			const nextStatus: DelayedBusyState["status"] = elapsed >= stillAfterMs ? "still" : "running";
			setStatus(nextStatus);

			if (!visibleRef.current) {
				const remainingToShow = Math.max(0, showDelayMs - elapsed);
				if (remainingToShow === 0) {
					visibleSinceRef.current = now;
					setVisibleState(true);
				} else {
					clearTimer(showTimerRef);
					showTimerRef.current = window.setTimeout(() => {
						if (!busyRef.current) return;
						visibleSinceRef.current = performance.now();
						setVisibleState(true);
					}, remainingToShow);
				}
			} else {
				clearTimer(showTimerRef);
			}

			if (nextStatus !== "still") {
				const remainingToStill = Math.max(0, stillAfterMs - elapsed);
				clearTimer(stillTimerRef);
				stillTimerRef.current = window.setTimeout(() => {
					if (!busyRef.current) return;
					setStatus("still");
				}, remainingToStill);
			} else {
				clearTimer(stillTimerRef);
			}

			return () => {
				clearBusyTimers();
			};
		}

		clearBusyTimers();

		if (!visibleRef.current) {
			if (sessionStartRef.current === 0) {
				setStatus("hidden");
				return () => {
					clearTimer(hideTimerRef);
				};
			}

			hideTimerRef.current = window.setTimeout(() => {
				endSession();
				hideTimerRef.current = null;
			}, hideDelayMs);
			return () => {
				clearTimer(hideTimerRef);
			};
		}

		setStatus("completed");

		const elapsedVisible = performance.now() - visibleSinceRef.current;
		const remainingForMinVisible = Math.max(0, minVisibleMs - elapsedVisible);
		const hideAfterMs = Math.max(hideDelayMs, remainingForMinVisible);

		hideTimerRef.current = window.setTimeout(() => {
			endSession();
			hideTimerRef.current = null;
		}, hideAfterMs);

		return () => {
			clearTimer(hideTimerRef);
		};
	}, [busy, hideDelayMs, minVisibleMs, showDelayMs, stillAfterMs]);

	return { visible, status };
}
