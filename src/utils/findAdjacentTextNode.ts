import { BLOCK_ELEMENTS } from "@/constants";
import { advanceNode } from "./advanceNode";

export function findAdjacentTextNode(node: Node, skipEmpty = false): Text | null {
	let root: Node = node;
	while (root && !BLOCK_ELEMENTS[root.nodeName]) {
		root = root.parentNode!;
	}

	let next: Node | null = advanceNode(node, root, true);
	while (next) {
		if (next.nodeType === 3) {
			if (!skipEmpty || next.nodeValue!.length > 0) {
				return next as Text;
			}
		} else {
			const nextName = next.nodeName;
			if (BLOCK_ELEMENTS[nextName]) {
				break;
			}
			if (nextName === "BR" || nextName === "IMG" || nextName === "HR") {
				break;
			}
		}
		next = advanceNode(next, root);
	}

	return null;
}
