import { getParentElement } from "./getParentElement";

export function findClosestContainer(node: Node, selector: string): HTMLElement | null {
	return getParentElement(node).closest(selector);
}
