export function advanceNode(currentNode: Node, rootNode: Node | null = null, skipChildren = false): Node | null {
	if (!skipChildren && currentNode.firstChild) {
		return currentNode.firstChild;
	}

	let node: Node | null = currentNode;

	while (node && node !== rootNode) {
		if (node.nextSibling) {
			return node.nextSibling;
		}
		node = node.parentNode;
	}

	return null;
}
