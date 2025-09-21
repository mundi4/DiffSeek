import { TokenFlags } from "@/core/tokenization/TokenFlags";
import { makeImageKey } from "@/core/worker/diff-worker";
import { useDiffContext } from "@/hooks/useDiffContext";
import { vars } from "@/styles/vars.css";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ImageTooltipLayer() {
    const [target, setTarget] = useState<HTMLElement | null>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const diffContext = useDiffContext();

    // hover 이벤트 위임
    useEffect(() => {
        const handleOver = (e: MouseEvent) => {
            const el = e.target as HTMLElement;
            if (el.matches(".editor img[data-token-index]")) {
                setTarget(el);
            }
        };
        const handleOut = (e: MouseEvent) => {
            const el = e.target as HTMLElement;
            if (el.matches(".editor img[data-token-index]")) {
                setTarget(null);
            }
        };
        document.body.addEventListener("mouseover", handleOver);
        document.body.addEventListener("mouseout", handleOut);
        return () => {
            document.body.removeEventListener("mouseover", handleOver);
            document.body.removeEventListener("mouseout", handleOut);
        };
    }, []);

    // 위치 갱신 루프
    useEffect(() => {
        let rafId: number;
        const update = () => {
            if (target) {
                setRect(target.getBoundingClientRect());
                rafId = requestAnimationFrame(update);
            }
        };
        if (target) {
            update();
        }
        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [target]);

    if (!target || !rect || !diffContext) return null;

    const tokenIndex = Number(target.dataset.tokenIndex);
    const side = (target.closest(".editor") as HTMLElement)!.dataset.editorName;
    const sideEntries = side === "left" ? diffContext.leftEntries : diffContext.rightEntries;
    const entry = sideEntries[tokenIndex];
    if (!entry) return null;
    if (entry.left.end - entry.left.start !== 1) return null;
    if (entry.right.end - entry.right.start !== 1) return null;

    const thisToken = diffContext[side === "left" ? "leftTokens" : "rightTokens"][tokenIndex];
    const otherSide = side === "left" ? entry.right : entry.left;
    const otherToken = diffContext[side === "left" ? "rightTokens" : "leftTokens"][otherSide.start];

    if (!(thisToken.flags & otherToken.flags & TokenFlags.IMAGE)) {
        return null;
    }

    const key = makeImageKey(thisToken.text, otherToken.text);
    const compareResult = diffContext.imageComparisons[key];
    if (!compareResult || compareResult.similarity === undefined) return null;

    let text: string;
    switch (compareResult.similarity) {
        case undefined:
            text = `비교 실패`;
            break;
        // case 1:
        //     text = "완-벽";
        //     break
        default:
            text = `유사도: ${(compareResult.similarity * 100).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
            })}%`;
            break;
    }

    return createPortal(
        <div
            role="tooltip"
            style={{
                position: "fixed",
                top: rect.top - 32,
                left: rect.left + rect.width / 2,
                transform: "translateX(-50%)",
                background: vars.color.surface.overlay,
                color: vars.color.text.base,
                padding: `${vars.spacing.xs} ${vars.spacing.sm}`,
                borderRadius: vars.radius.sm,
                border: `${vars.borderWidth.thin} solid ${vars.color.neutral.border}`,
                boxShadow: vars.elevation[2],
                fontSize: vars.typography.size.sm,
                fontWeight: vars.typography.weight.medium,
                zIndex: 10000,
                pointerEvents: "none",
            }}
        >
            {text}
        </div>,
        document.body
    );
}
