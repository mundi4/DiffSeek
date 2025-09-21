import { MANUAL_ANCHOR_ELEMENT_NAME } from "../constants";

export function isManualAnchorElement(elem: Element): boolean {
    return elem.nodeName === MANUAL_ANCHOR_ELEMENT_NAME && (elem as HTMLAnchorElement).classList.contains("manual-anchor");
}