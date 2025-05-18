const editor = document.getElementById("ce1") as HTMLElement;

const mutationObserver = new MutationObserver((mutations) => {
	console.log("Mutation detected", mutations);
	unobserveEditor();
	const selection = window.getSelection();
	let currentRange: Range | null = null;
	if (selection && selection.rangeCount > 0) {
		currentRange = selection.getRangeAt(0);
	}
	console.log("currentRange", {
		range: currentRange,
		startContainer: currentRange?.startContainer,
		startOffset: currentRange?.startOffset,
		endContainer: currentRange?.endContainer,
		endOffset: currentRange?.endOffset,
	});

	function findLineNode(node: Node) {
		let child: Node = node;
		while (child && child.parentNode !== editor) {
			child = child.parentNode!;
		}
		return child;
	}

	const modified = new Set<Node>();
	for (let mi = 0; mi < mutations.length; mi++) {
		const mutation = mutations[mi];
		console.log(`mutation-${mi}`, mutation);
		if (mutation.type === "childList") {
			if (mutation.target === editor) {
				if (mutation.previousSibling) {
					modified.add(mutation.previousSibling);
				}
				if (mutation.nextSibling) {
					modified.add(mutation.nextSibling);
				}
			} else if (mutation.target) {
				modified.add(findLineNode(mutation.target));
			}
			for (const node of mutation.addedNodes) {
				modified.add(findLineNode(node));
				// if (node.nodeType === 3) {
				// 	console.log("added text node", node.nodeValue);
				// 	const lineNode = findLineNode(node);
				// 	if (lineNode === node) {
				// 		// 루트에 텍스트노드가 바로 추가된 경우
				// 		const div = document.createElement("div");
				// 		editor.insertBefore(div, node);
				// 		if (node.nodeValue === "\n") {
				// 			div.appendChild(document.createElement("br"));
				// 			(node as ChildNode).remove();
				// 		} else {
				// 			div.appendChild(node);
				// 		}
				// 		continue;
				// 	} else if (node.nodeValue ==="\n") {
				// 		// 앞에다 추가하고 현재 노드는 냅두기
				// 		if (mutation.previousSibling) {
				// 			console.log("mutation.previousSibling");
				// 			//editor.insertBefore(div, node.previousSibling);
				// 			const div = document.createElement("div");
				// 			const parent = mutation.previousSibling.parentNode;
				// 			if (parent) {
				// 				for (const child of parent!.childNodes) {
				// 					if (child === node || child === mutation.nextSibling) {
				// 						console.log("breaking...")
				// 						break;
				// 					}
				// 					div.appendChild(child);
				// 					console.log("append", child)
				// 				}
				// 				const lineNode = findLineNode(node);
				// 				editor.insertBefore(div, lineNode);
				// 				(node as ChildNode).remove();
				// 			} else {
				// 				console.log("parent is null");
				// 			}
				// 			console.log("div", div);
				// 		}
				// 		// editor.insertBefore(div, lineNode.nextSibling);
				// 		// div.appendChild(node);
				// 		// (node as ChildNode).remove();
				// 	}

				// 	// if (currentRange && currentRange.startContainer === node) {
				// 	// 	const lineNode = findLineNode(node);
				// 	// 	if (lineNode.nodeType === 1) {
				// 	// 		lineNode.appendChild(node);
				// 	// 	} else if (lineNode.nodeType === 3) {
				// 	// 		const newLineNode = document.createElement("div");
				// 	// 		editor.insertBefore(newLineNode, lineNode);
				// 	// 		newLineNode.appendChild(node);
				// 	// 	}
				// 	// 	//editor.insertBefore(newLineNode, lineNode);
				// 	// 	console.log("currentRange startContainer is a text node");
				// 	// 	continue;
				// 	// }
				// 	// if (currentRange && currentRange.endContainer === node) {
				// 	// 	console.log("currentRange endContainer is a text node");
				// 	// 	continue;
				// 	// }

				// 	// if (node.parentNode) {
				// 	// }
				// }
			}
		} else if (mutation.type === "characterData") {
			modified.add(findLineNode(mutation.target));
		}
	}

	let unchanged = true;
	for (const node of editor.childNodes) {
		if (unchanged) {
			if (modified.has(node)) {
				unchanged = false;
			} else {
				continue;
			}
		}
		if (node.nodeType === 3) {
			const lines = node.nodeValue!.split("\n");
			for (const line of lines) {
				const div = document.createElement("div");
				div.textContent = line;
				editor.insertBefore(div, node);
			}
			node.remove();
		} else {

		}
	}

	console.log("========editor", {
		modified,
		textContent: editor.textContent,
		innerText: editor.innerText,
		innerHTML: editor.innerHTML,
		childNodes: Array.from(editor.childNodes).map((node) => {
			return {
				nodeName: node.nodeName,
				nodeType: node.nodeType,
				nodeValue: node.nodeValue,
				textContent: node.textContent,
			};
		}),
	});

	observeEditor();
});

function observeEditor() {
	mutationObserver.observe(editor, {
		childList: true,
		subtree: true,
		attributes: true,
		characterData: true,
		attributeOldValue: true,
		characterDataOldValue: true,
	});
}

function unobserveEditor() {
	mutationObserver.disconnect();
}

//  observeEditor();


