import { useCallback, useEffect, useRef } from "react";

export type FloatingPosition = { top: number; left: number };

export type UseFloatingWindowOptions = {
	enabled?: boolean;
	constrainToViewport?: boolean;
	constrainOffset?: number;
	dragHandleSelector?: string;
	excludeDragHandleSelector?: string;
	initialPosition?: { top: number; left: number };
	onPositionChange?: (pos: { x: number; y: number }) => void;
};

export function useFloatingWindow<T extends HTMLElement>(options: UseFloatingWindowOptions) {
	const {
		enabled = true,
		constrainToViewport = false,
		constrainOffset = 0,
		dragHandleSelector,
		excludeDragHandleSelector,
		initialPosition,
		onPositionChange,
	} = options;

	const elRef = useRef<T | null>(null);
	const draggingRef = useRef(false);
	const offsetRef = useRef({ x: 0, y: 0 });
	const sizeRef = useRef({ w: 0, h: 0 });
	const onPositionChangeRef = useRef(onPositionChange);
	onPositionChangeRef.current = onPositionChange;

	const clamp = useCallback(
		(left: number, top: number, el: T): { left: number; top: number } => {
			if (!constrainToViewport) return { left, top };
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const w = el.offsetWidth;
			const h = el.offsetHeight;
			return {
				left: Math.max(constrainOffset, Math.min(left, vw - w - constrainOffset)),
				top: Math.max(constrainOffset, Math.min(top, vh - h - constrainOffset)),
			};
		},
		[constrainToViewport, constrainOffset],
	);

	const setPosition = useCallback(
		(pos: { top?: number; left?: number }) => {
			const el = elRef.current;
			if (!el) return;
			const left = pos.left ?? el.offsetLeft;
			const top = pos.top ?? el.offsetTop;
			const clamped = clamp(left, top, el);
			el.style.left = clamped.left + "px";
			el.style.top = clamped.top + "px";
			onPositionChangeRef.current?.({ x: clamped.left, y: clamped.top });
		},
		[clamp],
	);

	// Apply initial position
	useEffect(() => {
		if (!initialPosition || !elRef.current) return;
		const clamped = clamp(initialPosition.left, initialPosition.top, elRef.current);
		elRef.current.style.left = clamped.left + "px";
		elRef.current.style.top = clamped.top + "px";
	}, []);

	// Drag logic
	useEffect(() => {
		const el = elRef.current;
		if (!el || !enabled) return;

		const onPointerDown = (e: PointerEvent) => {
			if (!dragHandleSelector) return;
			const handle = (e.target as Element).closest(dragHandleSelector);
			if (!handle) return;
			if (excludeDragHandleSelector && (e.target as Element).closest(excludeDragHandleSelector)) return;

			e.preventDefault();
			draggingRef.current = true;
			const rect = el.getBoundingClientRect();
			offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
			sizeRef.current = { w: el.offsetWidth, h: el.offsetHeight };
			el.setPointerCapture(e.pointerId);
		};

		const onPointerMove = (e: PointerEvent) => {
			if (!draggingRef.current) return;
			const left = e.clientX - offsetRef.current.x;
			const top = e.clientY - offsetRef.current.y;
			const { w, h } = sizeRef.current;
			const clamped = constrainToViewport
				? {
						left: Math.max(constrainOffset, Math.min(left, window.innerWidth - w - constrainOffset)),
						top: Math.max(constrainOffset, Math.min(top, window.innerHeight - h - constrainOffset)),
					}
				: { left, top };
			el.style.left = clamped.left + "px";
			el.style.top = clamped.top + "px";
			onPositionChangeRef.current?.({ x: clamped.left, y: clamped.top });
		};

		const onPointerUp = () => {
			draggingRef.current = false;
		};

		el.addEventListener("pointerdown", onPointerDown);
		el.addEventListener("pointermove", onPointerMove);
		el.addEventListener("pointerup", onPointerUp);
		return () => {
			el.removeEventListener("pointerdown", onPointerDown);
			el.removeEventListener("pointermove", onPointerMove);
			el.removeEventListener("pointerup", onPointerUp);
		};
	}, [enabled, dragHandleSelector, excludeDragHandleSelector, clamp]);

	return { ref: elRef, setPosition };
}
