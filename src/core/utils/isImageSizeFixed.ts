
export function isImageSizeFixed(elem: HTMLImageElement): boolean {
    if (elem.hasAttribute("width") && elem.hasAttribute("height")) {
        return true;
    }

    const style = getComputedStyle(elem);
    return (style.width !== "auto" && style.height !== "auto");
}