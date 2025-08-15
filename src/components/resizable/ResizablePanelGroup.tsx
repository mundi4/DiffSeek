// ResizablePanelGroup.tsx
import {
    type HTMLAttributes,
    useRef,
    useState,
    useCallback,
    useMemo,
    useEffect,
    type ReactElement,
    Children,
    isValidElement,
    type ReactNode,
    cloneElement,
    createContext,
    useContext,
    type MutableRefObject,
} from "react";
import type { RegistryAPI } from "./types";
import * as styles from "./ResizablePanelGroup.css";
import clsx from "clsx";

/** Group-wide context (for children that need direction info, etc.) */
export const ResizablePanelGroupContext = createContext<{ direction: "vertical" | "horizontal" }>({
    direction: "vertical",
});

export const ResizablePanelRegistryContext = createContext<RegistryAPI | null>(null);
export function useResizablePanelRegistry() {
    return useContext(ResizablePanelRegistryContext);
}

export type ResizablePanelGroupProps = HTMLAttributes<HTMLDivElement> & {
    direction?: "vertical" | "horizontal";           // default 'vertical'
    handlePx?: number;                                // default 6
    heightPx?: number;                                // if omitted (vertical), uses ResizeObserver
    handleClassName?: string;                         // custom handle visuals
    disabledHandleClassName?: string;                 // handle when all-at-min
};

type PanelNode = {
    id: number;
    node: HTMLElement;
    policy: {
        minSize: number | string;         // px | %
        initialSize?: number | string;    // px | %
        growWeight: number;
        shrinkPriority: number;
        shrinkWeight: number;
        lockAtMin: boolean;
        participatesInResize: boolean;
    };
};

const toPx = (value: number | string | undefined, available: number): number | undefined => {
    if (value == null) return undefined;
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
    const s = String(value).trim();
    if (s.endsWith("px")) return Math.max(0, parseFloat(s));
    if (s.endsWith("%")) {
        const ratio = parseFloat(s) / 100;
        return Math.max(0, available * ratio);
    }
    // any other unit (e.g., fr) → ignore (treat as undefined)
    if (/fr$/i.test(s)) return undefined;
    // bare number string → px
    const n = Number(s);
    return Number.isFinite(n) ? Math.max(0, n) : undefined;
};

export function ResizablePanelGroup({
    className,
    children,
    direction = "vertical",
    handlePx = 4,
    heightPx,
    handleClassName,
    disabledHandleClassName,
    ...rest
}: ResizablePanelGroupProps) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [panels, setPanels] = useState<PanelNode[]>([]);
    const idCounter = useRef(0);

    // ---- Registry (children register/unregister/update) ----
    const register = useCallback<RegistryAPI["register"]>((node, policy) => {
        // NOTE: policy.minSize / policy.initialSize는 px|% 문자열 또는 number(px)로 온다고 가정
        const full: PanelNode["policy"] = {
            minSize: (policy as any).minSize ?? (policy as any).minHeight ?? 0,
            initialSize: (policy as any).initialSize,
            growWeight: policy.growWeight ?? 1,
            shrinkPriority: policy.shrinkPriority ?? 1,
            shrinkWeight: policy.shrinkWeight ?? 1,
            lockAtMin: policy.lockAtMin ?? false,
            participatesInResize: policy.participatesInResize ?? true,
        };
        const id = ++idCounter.current;
        setPanels((prev) => [...prev, { id, node, policy: full }]);
        return id;
    }, []);

    const update = useCallback<RegistryAPI["update"]>((_key, policy) => {
        setPanels((prev) =>
            prev.map((p) => {
                if (p.id !== _key) return p;
                return {
                    ...p,
                    policy: {
                        ...p.policy,
                        ...(policy as any),
                        minSize: (policy as any).minSize ?? (policy as any).minHeight ?? p.policy.minSize,
                        initialSize: (policy as any).initialSize ?? p.policy.initialSize,
                        growWeight: policy.growWeight ?? p.policy.growWeight,
                        shrinkPriority: policy.shrinkPriority ?? p.policy.shrinkPriority,
                        shrinkWeight: policy.shrinkWeight ?? p.policy.shrinkWeight,
                        lockAtMin: policy.lockAtMin ?? p.policy.lockAtMin,
                        participatesInResize: policy.participatesInResize ?? p.policy.participatesInResize,
                    },
                };
            })
        );
    }, []);

    const unregister = useCallback<RegistryAPI["unregister"]>((_key) => {
        setPanels((prev) => prev.filter((p) => p.id !== _key));
    }, []);

    const registryApi = useMemo<RegistryAPI>(() => ({ register, update, unregister }), [register, update, unregister]);

    // Keep DOM order
    const orderedPanels = useMemo(() => {
        const host = hostRef.current;
        if (!host || panels.length === 0) return panels;
        const grid = host.firstElementChild as HTMLElement | null;
        const order = grid
            ? Array.from(grid.children).filter((el) => (el as HTMLElement).dataset?.resizablePanel === "true")
            : [];
        const byNode = new Map(panels.map((p) => [p.node, p] as const));
        const out: PanelNode[] = [];
        for (const el of order) {
            const p = byNode.get(el as HTMLElement);
            if (p) out.push(p);
        }
        return out;
    }, [panels]);

    // ---- State derived from policies ----
    const isVertical = direction === "vertical";
    const handleCount = Math.max(0, orderedPanels.length - 1);
    const handlesTotal = handleCount * handlePx;

    // raw policies
    const participates = orderedPanels.map((p) => p.policy.participatesInResize);
    const growWeights = orderedPanels.map((p) => p.policy.growWeight);
    const shrinkPriority = orderedPanels.map((p) => p.policy.shrinkPriority);
    const shrinkWeights = orderedPanels.map((p) => p.policy.shrinkWeight);
    const lockAtMin = orderedPanels.map((p) => p.policy.lockAtMin);

    // ---- Helpers: container main size & unit parsing (px/% only) ----
    const getContainerMainSize = () => {
        const el = hostRef.current;
        if (isVertical) return heightPx ?? (el ? el.clientHeight : 0);
        return el ? el.clientWidth : 0;
    };

    const getMinsPx = useCallback((A: number) => {
        return orderedPanels.map((p) => toPx(p.policy.minSize as any, A) ?? 0);
    }, [orderedPanels]);

    // ---- Sizes state (px) ----
    const [sizes, setSizes] = useState<number[]>([]);
    const lastAvailableRef = useRef<number | null>(null);

    const ensureInit = useCallback(() => {
        if (sizes.length === orderedPanels.length && sizes.every((v) => v > 0)) return sizes;

        const total = getContainerMainSize();
        if (total <= 0) return sizes;

        const A = Math.max(0, total - handlesTotal);
        const minsPx = getMinsPx(A);

        // 1) initialSize(px/% → px)
        const initialPxArr: Array<number | undefined> =
            orderedPanels.map((p) => toPx(p.policy.initialSize, A));

        // 2) 확정합 + 남는 공간
        const knownSum = initialPxArr.reduce<number>((acc, v) => acc + (v ?? 0), 0);
        let remain = Math.max(0, A - knownSum);

        // 3) initial 누락 패널에 growWeight 비례 분배
        const unknownIdx = initialPxArr.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
        if (unknownIdx.length) {
            const W = unknownIdx.reduce((acc, i) => acc + (growWeights[i] ?? 1), 0) || 1;
            for (const i of unknownIdx) {
                initialPxArr[i] = ((growWeights[i] ?? 1) / W) * remain;
            }
        } else if (remain > 0 && knownSum > 0) {
            // 모두 initial인데 합이 A보다 작으면 비율대로 남는 공간 분배
            const base = knownSum || 1;
            for (let i = 0; i < initialPxArr.length; i++) {
                initialPxArr[i] = (initialPxArr[i] ?? 0) + ((initialPxArr[i] ?? 0) / base) * remain;
            }
        }

        // 4) min으로 클램프 후 총합 맞추기
        const seeded = initialPxArr.map((v, i) => Math.max(v ?? 0, minsPx[i]));
        return fitToTotal(seeded, minsPx, A);
    }, [sizes, orderedPanels, handlesTotal, growWeights, getContainerMainSize, getMinsPx]);

    const minsRawSig = orderedPanels.map((p) => String(p.policy.minSize)).join("|");
    const initRawSig = orderedPanels.map((p) => String(p.policy.initialSize ?? "")).join("|");

    // ---- React to container main-size changes ----
    useEffect(() => {
        if (orderedPanels.length === 0) return;
        const A = Math.max(0, getContainerMainSize() - handlesTotal);
        const minsPx = getMinsPx(A);
        setSizes((prev) =>
            resizeByPolicy(prev.length ? prev : ensureInit(), minsPx, A, lastAvailableRef, {
                growWeights, participates, shrinkPriority, shrinkWeights, lockAtMin,
            })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        orderedPanels,           // 순서/DOM 재배열 반응
        handlesTotal,
        growWeights.join(","),
        participates.join(","),
        shrinkPriority.join(","),
        shrinkWeights.join(","),
        lockAtMin.join(","),
        minsRawSig,
        initRawSig,
        heightPx,
        direction,
    ]);

    // Observe host (vertical: height; horizontal: width)
    useEffect(() => {
        if (isVertical && heightPx != null) return; // controlled height
        const el = hostRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const main = Math.floor(isVertical ? entry.contentRect.height : entry.contentRect.width);
                const A = Math.max(0, main - handlesTotal);
                const minsPx = getMinsPx(A);
                setSizes((prev) =>
                    resizeByPolicy(prev.length ? prev : ensureInit(), minsPx, A, lastAvailableRef, {
                        growWeights, participates, shrinkPriority, shrinkWeights, lockAtMin,
                    })
                );
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [
        isVertical,
        heightPx,
        handlesTotal,
        ensureInit,
        growWeights.join(","),
        participates.join(","),
        shrinkPriority.join(","),
        shrinkWeights.join(","),
        lockAtMin.join(","),
        minsRawSig,
        initRawSig,
    ]);

    // ---- Drag logic (between i and i+1) ----
    const dragInfo = useRef<{ index: number; startPos: number; startSizes: number[] } | null>(null);
    const onHandleDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const inited = ensureInit();
        setSizes(inited);

        const handleEl = e.currentTarget as HTMLElement;
        const grid = handleEl.parentElement as HTMLElement | null;
        if (!grid) return;

        let prev: HTMLElement | null = handleEl.previousElementSibling as HTMLElement | null;
        while (prev && prev.dataset?.resizablePanel !== "true") {
            prev = prev.previousElementSibling as HTMLElement | null;
        }
        if (!prev) return;

        const panelEls = Array.from(grid.children).filter(
            (el) => (el as HTMLElement).dataset?.resizablePanel === "true"
        ) as HTMLElement[];
        const i = panelEls.indexOf(prev);
        if (i < 0) return;

        const startPos = isVertical ? (e.clientY ?? 0) : (e.clientX ?? 0);
        dragInfo.current = { index: i, startPos, startSizes: [...inited] };

        const onMove = (ev: MouseEvent) => {
            const info = dragInfo.current;
            if (!info) return;
            const curr = isVertical ? ev.clientY : ev.clientX;
            const d = curr - info.startPos;
            const idx = info.index;

            // Recompute mins for the current available space (so % mins stay correct)
            const A = Math.max(0, getContainerMainSize() - handlesTotal);
            const minsPx = getMinsPx(A);

            const aboveMin = minsPx[idx];
            const belowMin = minsPx[idx + 1];
            const startAbove = info.startSizes[idx];
            const startBelow = info.startSizes[idx + 1];

            const newAbove = Math.max(aboveMin, startAbove + d);
            const deltaApplied = newAbove - startAbove;
            const newBelow = Math.max(belowMin, startBelow - deltaApplied);

            const sumPair = startAbove + startBelow;
            const finalBelow = Math.max(belowMin, newBelow);
            const finalAbove = Math.max(aboveMin, sumPair - finalBelow);

            setSizes((prev) => {
                const next = [...prev];
                next[idx] = finalAbove;
                next[idx + 1] = finalBelow;
                return next;
            });
        };

        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            dragInfo.current = null;
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // ---- Build grid template ----
    const templateStyle = useMemo(() => {
        const s = ensureInit();
        const parts: string[] = [];
        const total = getContainerMainSize();
        const A = Math.max(0, total - handlesTotal);
        const minsPx = getMinsPx(A);
        const sumMins = minsPx.reduce((a, b) => a + b, 0);
        const undersized = total > 0 && sumMins + handlesTotal > total;
        const base = undersized ? minsPx : s.map((px, i) => Math.max(px, minsPx[i]));

        base.forEach((px, idx) => {
            parts.push(`${Math.max(px, minsPx[idx])}px`);
            if (idx < orderedPanels.length - 1) parts.push(`${handlePx}px`);
        });

        return isVertical ? { gridTemplateRows: parts.join(" ") } : { gridTemplateColumns: parts.join(" ") };
        // deps에 minsRawSig, initRawSig 추가
    }, [sizes, orderedPanels.length, handlePx, heightPx, direction, getContainerMainSize, getMinsPx, minsRawSig, initRawSig]);

    const allAtMin = useMemo(() => {
        const s = ensureInit();
        const A = Math.max(0, getContainerMainSize() - handlesTotal);
        const minsPx = getMinsPx(A);
        return s.every((v, i) => Math.abs(v - minsPx[i]) < 0.5);
    }, [sizes, direction, heightPx, orderedPanels.length, getContainerMainSize, getMinsPx, minsRawSig]);

    const handleStyle = { "--handle-size": handlePx + "px" };
    const gridOverflow = isVertical ? { overflowY: "auto" } : { overflowX: "auto" };

    return (
        <ResizablePanelGroupContext.Provider value={{ direction }}>
            <ResizablePanelRegistryContext.Provider value={registryApi}>
                <div ref={hostRef} className={clsx(styles.container, className)} {...rest}>
                    <div className={styles.container} style={{ display: "grid", ...templateStyle, ...gridOverflow } as any}>
                        {(() => {
                            // Interleave panels and handles in DOM order (no explicit index props)
                            const valid: ReactElement[] = [];
                            Children.forEach(children, (child) => {
                                if (isValidElement(child)) valid.push(child as ReactElement);
                            });
                            const out: ReactNode[] = [];
                            valid.forEach((child, idx) => {
                                out.push(
                                    cloneElement(child as any, {
                                        key: (child as any).key ?? `panel-${idx}`,
                                        "data-resizable-panel": "true",
                                        // NOTE: visual styles for panel items should be provided by the child component itself.
                                    })
                                );
                                if (idx < valid.length - 1) {
                                    out.push(
                                        <div
                                            key={`handle-${idx}`}
                                            role="separator"
                                            aria-orientation={isVertical ? "horizontal" : "vertical"}
                                            onMouseDown={onHandleDown}
                                            className={clsx(styles.resizeHandle({ direction }), allAtMin ? disabledHandleClassName : handleClassName)}
                                            style={handleStyle as any}
                                        />
                                    );
                                }
                            });
                            return out;
                        })()}
                    </div>
                </div>
            </ResizablePanelRegistryContext.Provider>
        </ResizablePanelGroupContext.Provider>
    );
}

// ====== Resize policies (unchanged from before, operate in px) ======
function resizeByPolicy(
    current: number[],
    mins: number[],
    targetTotal: number,
    lastAvailableRef: MutableRefObject<number | null>,
    opts: {
        growWeights: number[];
        participates: boolean[];
        shrinkPriority: number[];
        shrinkWeights: number[];
        lockAtMin: boolean[];
    }
) {
    const prev = lastAvailableRef.current;
    lastAvailableRef.current = targetTotal;
    if (!current.length) return current;
    if (prev == null || prev <= 0) return fitToTotal(current, mins, targetTotal);
    const delta = targetTotal - prev;
    if (Math.abs(delta) < 0.5) return fitToTotal(current, mins, targetTotal);
    if (delta > 0) return grow(current, mins, delta, opts);
    return shrink(current, mins, -delta, opts);
}

function grow(
    cur: number[],
    mins: number[],
    extra: number,
    { growWeights, participates }: { growWeights: number[]; participates: boolean[] }
) {
    const n = cur.length;
    const next = [...cur];
    const elig = Array.from({ length: n }, (_, i) => (participates[i] && (growWeights[i] ?? 1) > 0 ? i : -1)).filter((i) => i >= 0);
    if (!elig.length) return fitToTotal(next, mins, cur.reduce((a, b) => a + b, 0) + extra);
    const W = elig.reduce((a, i) => a + (growWeights[i] ?? 1), 0) || 1;
    for (const i of elig) {
        const give = ((growWeights[i] ?? 1) / W) * extra;
        next[i] = Math.max(mins[i], next[i] + give);
    }
    return fitToTotal(next, mins, cur.reduce((a, b) => a + b, 0) + extra);
}

function shrink(
    cur: number[],
    mins: number[],
    lack: number,
    { shrinkPriority, shrinkWeights, lockAtMin }: { shrinkPriority: number[]; shrinkWeights: number[]; lockAtMin: boolean[] }
) {
    const n = cur.length;
    let next = [...cur];
    let need = lack;
    const entries = Array.from({ length: n }, (_, i) => ({ i, prio: shrinkPriority[i] ?? 1 }));
    entries.sort((a, b) => a.prio - b.prio);
    for (let g = 0; g < entries.length && need > 0.5;) {
        const pr = entries[g].prio;
        const group: number[] = [];
        while (g < entries.length && entries[g].prio === pr) {
            group.push(entries[g].i);
            g++;
        }
        const cand = group
            .filter((i) => (lockAtMin[i] ? next[i] - mins[i] > 0.5 : true))
            .filter((i) => next[i] - mins[i] > 0.5);
        if (!cand.length) continue;
        const totalSlack = cand.reduce((a, i) => a + Math.max(0, next[i] - mins[i]), 0);
        const W = cand.reduce((a, i) => a + (shrinkWeights[i] ?? 1), 0) || 1;
        const take = Math.min(need, totalSlack);
        for (const i of cand) {
            const ratio = (shrinkWeights[i] ?? 1) / W;
            const cut = Math.min(next[i] - mins[i], take * ratio);
            next[i] -= cut;
            need -= cut;
        }
    }
    const target = Math.max(0, next.reduce((a, b) => a + b, 0) - need);
    return fitToTotal(next, mins, target);
}

function fitToTotal(h: number[], mins: number[], target: number): number[] {
    const n = h.length;
    if (!n) return h;
    let out = h.map((v, i) => Math.max(v || mins[i], mins[i]));
    const sum = out.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - target) < 0.5) return out;
    if (sum > target) {
        const surplusArr = out.map((v, i) => Math.max(0, v - mins[i]));
        const surplus = surplusArr.reduce((a, b) => a + b, 0);
        if (surplus <= 0.5) return out; // undersized → let container scroll
        const need = sum - target;
        const ratio = Math.min(1, need / surplus);
        out = out.map((v, i) => Math.max(mins[i], v - surplusArr[i] * ratio));
        return out;
    } else {
        const need = target - sum;
        const totalNow = sum || 1;
        out = out.map((v) => v + (v / totalNow) * need);
        return out;
    }
}
