
export function resolveLineHeight(el: Element): number | null {
    const style = getComputedStyle(el);
    const lh = style.lineHeight;

    if (lh !== "normal") {
        const v = parseFloat(lh);
        if (!Number.isNaN(v)) return v;
    }

    return null;
}