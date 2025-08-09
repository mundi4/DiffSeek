export function retreatNode(currentNode: Node): Node | null {
	if (!currentNode) return null;

	const prev = currentNode.previousSibling;
	if (prev) {
		let node = prev;
		while (node.lastChild) node = node.lastChild;
		return node;
	}

	return currentNode.parentNode;
}
