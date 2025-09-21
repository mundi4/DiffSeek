import { BLOCK_ELEMENTS } from "@/core/constants";

export function findBlockParent(node: Node, until?: Element ): HTMLElement | null {
    let current = node.nodeType === 3 ? node.parentElement : node as Element;

    while (current && current !== until) {
        if (BLOCK_ELEMENTS[current.nodeName]) {
            return current as HTMLElement;
        }
        current = current.parentElement;
    }

    return null;
}