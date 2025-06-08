type SideViewCallbacks = {
	onDiffItemMouseOver: (diffIndex: number) => void;
	onDiffItemMouseOut: (diffIndex: number) => void;
};

class SideView {
	#callbacks: SideViewCallbacks;
	#root: HTMLElement;
	#diffListElement: HTMLElement;
	#diffListItems: DiffListItem[] = [];

	constructor(container: HTMLElement, callbacks: SideViewCallbacks) {
		this.#callbacks = callbacks;
		this.#root = document.createElement("DIV");

		this.#diffListElement = document.createElement("UL");
		this.#diffListElement.id = "diffList";
		this.#root.appendChild(this.#diffListElement);

		container.appendChild(this.#root);
	}

	setDiffs(diffs: DiffItem[]) {
		for (const diff of diffs) {
		}

		for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
			const diff = diffs[diffIndex];
			let item = this.#diffListItems[diffIndex];
			if (!item) {
				item = new DiffListItem(this.#diffListElement);
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

	onDiffItemMouseOver(diffIndex: number) {
		//this.#callbacks.onDiffItemMouseOver(diffIndex);
		highlightedDiffIndexAtom.set(diffIndex);
	}

	onDiffItemMouseOut(diffIndex: number) {
		highlightedDiffIndexAtom.set(null);
		this.#callbacks.onDiffItemMouseOut(diffIndex);
	}

	onDiffVisibilityChange(editorName: string, entries: VisibilityChangeEntry[]) {
		for (const entry of entries) {
			const item = this.#diffListItems[entry.item as number];
			if (item) {
				item.onDiffVisibilityChange(editorName, entry.isVisible);
			}
		}
	}
}

type DiffItemCallbacks = {
	onMouseOver: (diffIndex: number) => void;
	onMouseOut: (diffIndex: number) => void;
};

class DiffListItem {
	#element: HTMLElement;
	#leftEl: HTMLElement;
	#rightEl: HTMLElement;
	#diff: DiffItem | null = null;

	constructor(listElement: HTMLElement) {
		this.#element = document.createElement("LI");

		this.#leftEl = document.createElement("SPAN");
		this.#leftEl.className = "left";

		this.#rightEl = document.createElement("SPAN");
		this.#rightEl.className = "right";

		this.#element.appendChild(this.#leftEl);
		this.#element.appendChild(this.#rightEl);
		listElement.appendChild(this.#element);

		// event listeners
		this.#element.addEventListener("mouseover", () => {
			highlightedDiffIndexAtom.set(this.#diff!.diffIndex);
		});

		this.#element.addEventListener("mouseout", () => {
			highlightedDiffIndexAtom.set(null);
		});

		this.#element.addEventListener("click", () => {
            diffItemClickedEvent.emit(this.#diff!.diffIndex);
		});
	}

	update(diff: DiffItem | null) {
		this.#diff = diff;
		if (diff) {
			this.#element.style.removeProperty("display");
			this.#element.style.setProperty("--diff-hue", diff.hue.toString());

			this.#leftEl.textContent = diff.leftRange.toString();
			this.#rightEl.textContent = diff.rightRange.toString();
		} else {
			this.#element.style.display = "none";
		}
	}

	onDiffVisibilityChange(editorName: string, visible: boolean) {
		this.#element.classList.toggle(`${editorName}-visible`, visible);
	}
}
