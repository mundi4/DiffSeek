export function getParentElement(node: Node): HTMLElement {
	const element = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
	return element as HTMLElement;
}