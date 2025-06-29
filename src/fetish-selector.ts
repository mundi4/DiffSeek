class FetishSelector {
	#el: HTMLElement;
	#btnSync: HTMLButtonElement;
	#btnWhitespace: HTMLButtonElement;
	#btnSidebarExpand: HTMLButtonElement;

	constructor(container: HTMLElement) {
		this.#el = container;
		this.#btnSync = container.querySelector("#syncToggleBtn")!;
		this.#btnWhitespace = container.querySelector("#whitespaceToggleBtn")!;
		this.#btnSidebarExpand = container.querySelector("#sidebarExpandBtn")!;


		this.#btnSync.title = "F2";
		this.#btnSync.addEventListener("click", () => {
			syncModeAtom.set(!syncModeAtom.get());
		});

        this.#btnWhitespace.title = "F8";
		this.#btnWhitespace.addEventListener("click", () => {
			const next = cycleWhitespace(whitespaceHandlingAtom.get());
			whitespaceHandlingAtom.set(next);
		});

        this.#btnSidebarExpand.title = "F9";
		this.#btnSidebarExpand.addEventListener("click", () => {
			const expanded = !sidebarExpandedAtom.get();
			sidebarExpandedAtom.set(expanded);
		});

		// Subscribe to atom changes
		const update = this.#update.bind(this);
		syncModeAtom.subscribe(update);

		whitespaceHandlingAtom.subscribe(update);

		sidebarExpandedAtom.subscribe(update);

		this.#update();
	}

    #update() {
		this.#btnSync.classList.toggle("active", syncModeAtom.get());
		this.#btnWhitespace.className = `mode-${whitespaceHandlingAtom.get()}`;
		this.#btnSidebarExpand.classList.toggle("active", sidebarExpandedAtom.get());
	}
}
