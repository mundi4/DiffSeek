import { useEffect, useRef, useState } from "react";

export function useMinimumBusy(busy: boolean, minDuration = 500) {
	const [visible, setVisible] = useState(false);
	const startRef = useRef<number>(0);
	const timeoutRef = useRef<number | null>(null);

	useEffect(() => {
		if (busy) {
			startRef.current = performance.now();
			setVisible(true);
			return;
		}

		const elapsed = performance.now() - startRef.current;
		const remaining = minDuration - elapsed;

		if (remaining > 0) {
			timeoutRef.current = window.setTimeout(() => {
				setVisible(false);
				timeoutRef.current = null;
			}, remaining);
		} else {
			setVisible(false);
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, [busy, minDuration]);

	return visible;
}
