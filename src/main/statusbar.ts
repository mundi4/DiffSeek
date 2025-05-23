type Option<TValue> = {
	label: string;
	value: TValue;
};

type StatusItem<TValue> = {
	side: "left" | "right" | "center";
	key: string;
	label: string;
	get: () => TValue;
	set?: (value: TValue) => void;
	toggle?: () => void;
	visible?: () => boolean;
	options?: Option<TValue>[];
};

type OptionsMap = {
	[key: string]: OptionDef<any>;
};

type OptionDef<TValue> = {
	label: string;
	options: Option<TValue>[];
	get: () => TValue;
	set: (value: TValue) => void;
};

// 어설프고 엉성하고 못생김.
// 나도 ui라이브러리 쓸 수 있으면면 이쁘게 잘 만들 수 있다!
function InitializeStatusBar(items: StatusItem<any>[]) {
	const statusBarElement = document.getElementById("statusbar")!;
	const popup = document.getElementById("settingsPopup")!;
	const leftContainer = document.createElement("div");
	leftContainer.classList.add("status-bar-left");
	statusBarElement.appendChild(leftContainer);

	const centerContainer = document.createElement("div");
	centerContainer.classList.add("status-bar-center");
	statusBarElement.appendChild(centerContainer);
	
	const rightContainer = document.createElement("div");
	rightContainer.classList.add("status-bar-right");
	statusBarElement.appendChild(rightContainer);

	function init() {
		items.forEach(createStatusItem);
	}

	function createStatusItem<TValue>(item: StatusItem<TValue>) {
		const statusItem = document.createElement("div");
		statusItem.classList.add("status-item");
		statusItem.setAttribute("data-popup", item.key);
		if (item.options) {
			statusItem.classList.add("clickable");
			statusItem.innerHTML = `${item.label} <span></span> ▼`;
			statusItem.addEventListener("click", () => {
				togglePopup(item.key, statusItem, item);
			});
		} else if (item.toggle) {
			statusItem.classList.add("clickable");
			statusItem.innerHTML = `${item.label} <span></span>`;
			statusItem.addEventListener("click", () => {
				item.toggle!();
			});
		} else {
			statusItem.innerHTML = `${item.label} <span></span>`;
		}

		if (item.side === "left") {
			leftContainer.appendChild(statusItem);
		} else if (item.side === "right") {
			rightContainer.appendChild(statusItem);
		} else if (item.side === "center") {
			centerContainer.appendChild(statusItem);
		} else {
			console.error(`Unknown side: ${item.side}`);
			return;
		}
	}

	function togglePopup<TValue>(key: string, targetElement: HTMLElement, item: StatusItem<TValue>) {
		const currentOpenPopup = document.querySelector("[data-popup].open") as HTMLElement;

		if (currentOpenPopup && currentOpenPopup !== targetElement) {
			currentOpenPopup.classList.remove("open");
			currentOpenPopup.style.display = "none";
		}

		const isOpen = targetElement.classList.contains("open");
		if (!isOpen && item.options) {
			showPopup(key, targetElement, item);
		} else {
			closePopup();
		}
	}

	function showPopup(key: string, targetElement: HTMLElement, item: StatusItem<any>) {
		if (item.visible && !item.visible()) {
			return;
		}
		popup.innerHTML = "";
		const options = item.options;
		const value = item.get();
		options!.forEach((option) => {
			const div = document.createElement("div");
			div.textContent = option.label;
			if (option.value === value) {
				div.classList.add("selected");
			}
			div.onclick = () => {
				item.set!(option.value);
				updateItem(item);
				closePopup();
			};
			popup.appendChild(div);
		});

		popup.style.display = "block";
		targetElement.classList.add("open");
		requestAnimationFrame(() => setPopupPosition(key, targetElement));
	}

	function setPopupPosition(key: string, targetElement: HTMLElement) {
		const rect = targetElement.getBoundingClientRect();
		const popupHeight = popup.offsetHeight;
		const popupWidth = popup.offsetWidth;
		const offset = 5;

		let topPosition = rect.top - popupHeight - offset;
		if (topPosition < 0) {
			topPosition = rect.bottom + offset;
		}

		let leftPosition = rect.left;
		if (leftPosition + popupWidth > window.innerWidth) {
			leftPosition = window.innerWidth - popupWidth - offset;
		}

		if (leftPosition < 0) {
			leftPosition = offset;
		}

		popup.style.top = `${topPosition}px`;
		popup.style.left = `${leftPosition}px`;
	}

	function updateItem(item: StatusItem<any>) {
		const element = statusBarElement.querySelector(`[data-popup="${item.key}"] span`) as HTMLElement;
		if (!element) return;

		if (item.visible && !item.visible()) {
			// element.parentElement!.classList.toggle("disabled", true);
			element.parentElement!.style.display = "none";
		} else {
			// element.parentElement!.classList.toggle("disabled", false);
			element.parentElement!.style.removeProperty("display");
			const value = item.get();
			const text = (item.options && item.options.find((opt) => opt.value === value)) || value || "";
			element.textContent = text?.label || value.toString();
		}
	}

	function closePopup() {
		popup.style.display = "none";
		const openElements = document.querySelectorAll("[data-popup].open");
		openElements.forEach((el) => el.classList.remove("open"));
	}

	function update() {
		for (const item of items) {
			updateItem(item);
			// const value = item.get();
			// if (item.visible && !item.visible()) {
			// 	const element = statusBarElement.querySelector(`[data-popup="${item.key}"] span`) as HTMLElement;
			// 	if (element) {
			// 		element.style.display = "none";
			// 	}
			// }
			// updateOption(item.key, value);
		}
	}

	init();

	document.addEventListener("click", (event) => {
		if (!popup.contains(event.target as Node) && !statusBarElement.contains(event.target as Node)) {
			closePopup();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closePopup();
		}
	});

	return {
		update,
		closePopup,
	};
}
