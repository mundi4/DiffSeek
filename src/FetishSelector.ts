class FetishSelector {
	#el: HTMLElement;
	#btnSync: HTMLButtonElement;
	#btnWhitespace: HTMLButtonElement;
	#btnSidebarExpand: HTMLButtonElement;
	#btnPeepViewToggle: HTMLButtonElement;

	constructor(container: HTMLElement) {
		this.#el = container;
		this.#btnSync = container.querySelector("#syncToggleBtn")!;
		this.#btnWhitespace = container.querySelector("#whitespaceToggleBtn")!;
		this.#btnSidebarExpand = container.querySelector("#sidebarExpandBtn")!;
		this.#btnPeepViewToggle = container.querySelector("#peepviewToggleBtn")!;

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

		this.#btnPeepViewToggle.title = "F3";
		this.#btnPeepViewToggle.addEventListener("click", () => {
			const enabled = !peepviewEnabledAtom.get();
			peepviewEnabledAtom.set(enabled);
		});

		// Subscribe to atom changes
		const update = this.#update.bind(this);
		syncModeAtom.subscribe(update);

		whitespaceHandlingAtom.subscribe(update);

		sidebarExpandedAtom.subscribe(update);

		peepviewEnabledAtom.subscribe(update);

		this.#update();
	}

    #update() {
		this.#btnSync.classList.toggle("active", syncModeAtom.get());
		this.#btnWhitespace.className = `mode-${whitespaceHandlingAtom.get()}`;
		this.#btnSidebarExpand.classList.toggle("active", sidebarExpandedAtom.get());
		this.#btnPeepViewToggle.classList.toggle("active", peepviewEnabledAtom.get());
	}
}
