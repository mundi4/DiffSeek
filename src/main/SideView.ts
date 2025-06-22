class SideView {
	#root: HTMLElement;
	#diffListElement: HTMLElement;
	#diffListItems: DiffListItem[] = [];
	#highlightedDiffIndex: number | null = null;

	constructor(container: HTMLElement) {
		this.#root = document.createElement("DIV");

		this.#diffListElement = document.createElement("UL");
		this.#diffListElement.id = "diffList";
		this.#root.appendChild(this.#diffListElement);

		container.appendChild(this.#root);

		highlightedDiffIndexAtom.subscribe((diffIndex) => this.onHighlightedDiffIndexChange());
		diffItemClickedEvent.subscribe((diffIndex) => {
			const item = this.#diffListItems[diffIndex];
			if (item) {
				item.scrollIntoView();
			}	
		});
	}

	setDiffs(diffs: DiffItem[]) {
		for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
			const diff = diffs[diffIndex];
			let item = this.#diffListItems[diffIndex];
			if (!item) {
				item = new DiffListItem(
					this.#diffListElement,
					diffIndex,
					this.onDiffItemClick.bind(this),
					this.onDiffItemMouseOver.bind(this),
					this.onDiffItemMouseOut.bind(this)
				);
				this.#diffListItems[diffIndex] = item;
			}
			item.update(diff);
		}

		for (let i = this.#diffListItems.length - 1; i >= diffs.length; i--) {
			const item = this.#diffListItems[i];
			item.update(null);
		}
		this.#diffListItems.length = diffs.length;
	}

	onDiffItemClick(diffIndex: number) {
		diffItemClickedEvent.emit(diffIndex);
	}

	onDiffItemMouseOver(diffIndex: number) {
		highlightedDiffIndexAtom.set(diffIndex);
	}

	onDiffItemMouseOut(diffIndex: number) {
		if (highlightedDiffIndexAtom.get() === diffIndex) {
			highlightedDiffIndexAtom.set(null);
		}
	}

	onDiffVisibilityChange(editorName: string, entries: VisibilityChangeEntry[]) {
		for (const entry of entries) {
			const item = this.#diffListItems[entry.item as number];
			if (item) {
				item.onDiffVisibilityChange(editorName, entry.isVisible);
			}
		}
	}

	onHighlightedDiffIndexChange() {
		const diffIndex = highlightedDiffIndexAtom.get();
		if (this.#highlightedDiffIndex !== diffIndex) {
			if (this.#highlightedDiffIndex !== null) {
				const prevItem = this.#diffListItems[this.#highlightedDiffIndex];
				if (prevItem) {
					prevItem.highlighted = false;
				}
			}
			this.#highlightedDiffIndex = diffIndex;
			if (diffIndex !== null) {
				const item = this.#diffListItems[diffIndex];
				if (item) {
					item.highlighted = true;
				}
			}
		}
	}
}

class DiffListItem {
	#element: HTMLElement;
	#leftEl: HTMLElement;
	#rightEl: HTMLElement;
	#diff: DiffItem | null = null;
	#highlighted: boolean = false;

	constructor(
		listElement: HTMLElement,
		diffIndex: number,
		onClick: (diffIndex: number) => void,
		onMouseOver: (diffIndex: number) => void,
		onMouseOut: (diffIndex: number) => void
	) {
		this.#element = document.createElement("LI");

		this.#leftEl = document.createElement("SPAN");
		this.#leftEl.className = "left";

		this.#rightEl = document.createElement("SPAN");
		this.#rightEl.className = "right";

		this.#element.appendChild(this.#leftEl);
		this.#element.appendChild(this.#rightEl);
		listElement.appendChild(this.#element);

		this.#element.addEventListener("click", () => onClick(diffIndex));
		this.#element.addEventListener("mouseover", () => onMouseOver(diffIndex));
		this.#element.addEventListener("mouseout", () => onMouseOut(diffIndex));
	}

	get highlighted(): boolean {
		return this.#highlighted;
	}

	set highlighted(value: boolean) {
		value = !!value;
		if (this.#highlighted === value) {
			return;
		}
		this.#highlighted = value;
		if (value) {
			this.#element.classList.add("highlighted");
		} else {
			this.#element.classList.remove("highlighted");
		}
	}

	update(diff: DiffItem | null) {
		this.#diff = diff;
		if (diff) {
			this.#element.style.removeProperty("display");
			this.#element.style.setProperty("--diff-hue", diff.hue.toString());

			this.#leftEl.textContent = this.#getString(diff.leftRange);
			this.#rightEl.textContent = this.#getString(diff.rightRange);
		} else {
			this.#element.style.display = "none";
		}
	}

	onDiffVisibilityChange(editorName: string, visible: boolean) {
		this.#element.classList.toggle(`${editorName}-visible`, visible);
	}

	#getString(range: Range, maxLength: number = 40): string {
		if (range.startContainer.nodeType === 3 && range.startContainer === range.endContainer) {
			return range.startContainer.nodeValue!.slice(range.startOffset, range.endOffset);
		}

		let text = "";
		function append(s: string) {
			s = s.replace(/\u00A0/g, " ").replace(/\s+/g, " ");
			if (text === "") {
				s = s.trimStart();
			}
			text += s;
		}

		const root = range.commonAncestorContainer;
		const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);

		let startNode: Node;
		let endNode: Node;
		let currentNode: Node | null;

		if (range.startContainer.nodeType === 3) {
			append(range.startContainer.nodeValue!.slice(range.startOffset));
			if (text.length >= maxLength) {
				return text;
			}
			walker.currentNode = range.startContainer;
			currentNode = walker.nextNode();
		} else if (range.startContainer.nodeType === 1) {
			startNode = range.startContainer.childNodes[range.startOffset]! || range.startContainer;
			walker.currentNode = currentNode = startNode;
		} else {
			throw new Error("Invalid start container");
		}

		if (range.endContainer.nodeType === 3) {
			endNode = range.endContainer;
		} else if (range.endContainer.nodeType === 1) {
			if (range.endOffset < range.endContainer.childNodes.length) {
				endNode = range.endContainer.childNodes[range.endOffset];
			} else {
				endNode = advanceNode(range.endContainer, root, true)!;
			}
		} else {
			throw new Error("Invalid end container");
		}

		while (currentNode && currentNode !== endNode) {
			if (currentNode.nodeType === 3) {
				append(currentNode.nodeValue!);
				if (text.length >= maxLength) {
					return text;
				}
			} else {
				if (currentNode.nodeName === "BR") {
					append(" ");
					if (text.length >= maxLength) {
						return text;
					}
				} else if (currentNode.nodeName === "IMG") {
					append("🖼️");
					if (text.length >= maxLength) {
						return text;
					}
				}
			}
			currentNode = walker.nextNode();
		}

		if (range.endContainer.nodeType === 3) {
			append(range.endContainer.nodeValue!.slice(0, range.endOffset));
		}

		return text.trimEnd();
	}

	scrollIntoView() {
		this.#element.classList.remove("flash-once");
		this.#element.scrollIntoView(
			// { block: "nearest", inline: "nearest" }
		);
		this.#element.classList.add("flash-once");
	}
}
