
export function createRangeFromElement(el: HTMLElement | null): Range | null {
    if (!el) return null;
    const range = document.createRange();
    range.selectNode(el);
    return range;
}
