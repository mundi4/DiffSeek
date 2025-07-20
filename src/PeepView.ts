class PeepView {
	#el: HTMLElement;
	#workerHost: ReturnType<typeof createSliceDiffWorker>;
	#currentReqId = 0;
	#leftText = "";
	#rightText = "";
	#visible = false;
	#hasMoved = false;
	#darkMode = false;

	constructor() {
		this.#el = this.#createUI();
		this.#workerHost = createSliceDiffWorker((response) => this.#onWorkerMessage(response));
		document.body.appendChild(this.#el);
		this.#attachDragBehavior(this.#el);
		window.addEventListener("resize", () => this.#ensureInViewport());
		this.hide();

		peepviewEnabledAtom.subscribe((enabled) => {
			if (enabled) {
			} else {
				this.hide();
			}
		});
	}

	show(leftText: string, rightText: string, leftTrail: SectionHeading[], rightTrail: SectionHeading[]) {
		if (peepviewEnabledAtom.get() === false) {
			this.hide();
			return;
		}
		leftText = normalizeMultiline(leftText);
		rightText = normalizeMultiline(rightText);

		this.#leftText = leftText;
		this.#rightText = rightText;
		this.#renderTrail(leftTrail, rightTrail);

		const MAX_TEXT_LENGTH = 500;
		if (leftText.length > MAX_TEXT_LENGTH || rightText.length > MAX_TEXT_LENGTH) {
			this.#renderTooLongMessage();
			return;
		}

		if (!this.#hasMoved) {
			this.#moveToCenter();
		}

		this.#el.style.display = "block";
		this.#visible = true;

		this.#currentReqId++;
		this.#setLoadingState(true);
		this.#workerHost.requestSliceDiff(leftText, rightText, {});
	}

	hide() {
		this.#el.style.display = "none";
		this.#visible = false;
	}

	toggle() {
		this.#visible ? this.hide() : this.show(this.#leftText, this.#rightText, [], []);
	}

	get isVisible() {
		return this.#visible;
	}

	destroy() {
		this.#el.remove();
		this.#workerHost.terminate();
	}

	#renderTooLongMessage() {
		const container = this.#el.querySelector(".peep-diff-body");
		if (!container) return;

		container.innerHTML = "";
		const msg = document.createElement("div");
		msg.className = "peep-too-long-msg";
		msg.innerHTML = "<em>🛑 내용이 너무 길어 비교하지 않습니다.</em>";
		container.appendChild(msg);
	}

	#onWorkerMessage(result: SliceDiffResponse) {
		if (result.reqId !== this.#currentReqId) return;
		this.#setLoadingState(false);
		this.#render(result.diffs, this.#leftText, this.#rightText);
	}

	#render(entries: SliceDiffEntry[], leftText: string, rightText: string) {
		const container = this.#el.querySelector(".peep-diff-body");
		if (!container) return;

		container.innerHTML = "";

		for (const entry of entries) {
			const span = document.createElement("span");
			let text = "";

			if (entry.type === 0 && entry.left) {
				text = leftText.slice(entry.left.index, entry.left.index + entry.left.count);
				span.className = "diff-equal";
			} else if (entry.type === 1 && entry.left) {
				text = leftText.slice(entry.left.index, entry.left.index + entry.left.count);
				span.className = "diff-delete";
			} else if (entry.type === 2 && entry.right) {
				text = rightText.slice(entry.right.index, entry.right.index + entry.right.count);
				span.className = "diff-insert";
			}

			span.textContent = text;
			container.appendChild(span);
		}
	}

	#renderTrail(leftTrail: SectionHeading[], rightTrail: SectionHeading[]) {
		const trailEl = this.#el.querySelector(".peep-trail");
		if (!trailEl) return;

		trailEl.innerHTML = "";
		const renderTrailList = (trail: SectionHeading[], className: "left" | "right") => {
			const wrapper = document.createElement("div");
			wrapper.className = `trail-wrapper ${className}`;

			const button = document.createElement("button");
			button.textContent = className === "left" ? "L" : "R";
			button.className = "trail-copy-button";
			button.addEventListener("click", () => {
				const text = trail.map((h) => `${h.ordinalText} ${h.title}`).join(" › ");
				navigator.clipboard.writeText(text).then(() => {
					button.textContent = "✓";
					setTimeout(() => {
						button.textContent = className === "left" ? "L" : "R";
					}, 1000);
				});
			});

			const dl = document.createElement("dl");
			dl.className = "trail";

			for (let i = 0; i < trail.length; i++) {
				const h = trail[i];

				const dt = document.createElement("dt");
				dt.textContent = h.ordinalText;

				const dd = document.createElement("dd");
				dd.textContent = h.title;
				if (i < trail.length - 1) dd.classList.add("trail-segment");

				dl.appendChild(dt);
				dl.appendChild(dd);
			}

			wrapper.appendChild(button);
			wrapper.appendChild(dl);
			return wrapper;
		};

		if (leftTrail.length === 0 && rightTrail.length === 0) {
			(trailEl as HTMLElement).style.display = "none";
		} else {
			(trailEl as HTMLElement).style.removeProperty("display");
			trailEl.appendChild(renderTrailList(leftTrail, "left"));
			trailEl.appendChild(renderTrailList(rightTrail, "right"));
		}
	}

	#setLoadingState(loading: boolean) {
		const body = this.#el.querySelector(".peep-diff-body");
		if (body) body.textContent = loading ? "loading..." : "";
	}

	#toggleTheme() {
		this.#darkMode = !this.#darkMode;
		this.#el.classList.toggle("dark", this.#darkMode);
	}

	#createUI(): HTMLElement {
		const root = document.createElement("div");
		root.className = "peep-view";

		const header = document.createElement("div");
		header.className = "peep-header";

		const title = document.createElement("span");
		title.className = "peep-title";
		title.textContent = "👀";
		title.addEventListener("click", () => this.#toggleTheme());

		const closeBtn = document.createElement("button");
		closeBtn.className = "peep-close";
		closeBtn.textContent = "×";
		closeBtn.addEventListener("click", () => peepviewEnabledAtom.set(false));

		header.appendChild(title);
		header.appendChild(closeBtn);

		const trail = document.createElement("div");
		trail.className = "peep-trail";

		const body = document.createElement("div");
		body.className = "peep-diff-body";
		body.textContent = "loading...";

		root.appendChild(header);
		root.appendChild(trail);
		root.appendChild(body);

		return root;
	}

	#attachDragBehavior(el: HTMLElement) {
		const header = el.querySelector(".peep-header") as HTMLElement;
		if (!header) return;

		let offsetX = 0;
		let offsetY = 0;
		let isDragging = false;

		header.addEventListener("mousedown", (e) => {
			isDragging = true;
			const rect = el.getBoundingClientRect();
			offsetX = e.clientX - rect.left;
			offsetY = e.clientY - rect.top;
			document.body.style.userSelect = "none";
		});

		window.addEventListener("mousemove", (e) => {
			if (!isDragging) return;

			let x = e.clientX - offsetX;
			let y = e.clientY - offsetY;

			// 화면 밖으로 못 나가게 제한
			const maxX = window.innerWidth - el.offsetWidth;
			const maxY = window.innerHeight - el.offsetHeight;
			x = Math.max(0, Math.min(x, maxX));
			y = Math.max(0, Math.min(y, maxY));

			el.style.left = x + "px";
			el.style.top = y + "px";
			el.style.right = "auto"; // 왼쪽 고정
			el.style.bottom = "auto";
			el.style.position = "fixed";
			this.#hasMoved = true;
		});

		window.addEventListener("mouseup", () => {
			isDragging = false;
			document.body.style.userSelect = "";
		});
	}

	#ensureInViewport() {
		const rect = this.#el.getBoundingClientRect();
		const maxX = window.innerWidth - this.#el.offsetWidth;
		const maxY = window.innerHeight - this.#el.offsetHeight;

		let moved = false;
		let x = rect.left;
		let y = rect.top;

		if (x < 0) {
			x = 0;
			moved = true;
		} else if (x > maxX) {
			x = maxX;
			moved = true;
		}

		if (y < 0) {
			y = 0;
			moved = true;
		} else if (y > maxY) {
			y = maxY;
			moved = true;
		}

		if (moved) {
			this.#el.style.left = x + "px";
			this.#el.style.top = y + "px";
			this.#el.style.position = "fixed";
		}
	}

	#moveToCenter() {
		const el = this.#el;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		// 임시로 보이게 하여 측정
		el.style.visibility = "hidden";
		el.style.display = "block";

		const width = el.offsetWidth;
		const height = el.offsetHeight;

		el.style.left = (vw - width) / 2 + "px";
		el.style.top = ((vh - height) / 3) * 2 + "px";
		el.style.position = "fixed";

		el.style.display = "none";
		el.style.visibility = "visible";
	}
}
