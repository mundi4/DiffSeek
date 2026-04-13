const _EMPTY_LINE = document.createElement("P");
_EMPTY_LINE.appendChild(document.createElement("BR"));

export function appendEmptyLine(parent: ParentNode) {
	parent.appendChild(_EMPTY_LINE.cloneNode(true));
}
