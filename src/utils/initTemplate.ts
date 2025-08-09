export function initTemplate<T extends Record<string, string>>(
	input: string,
	selectors: T
): [root: DocumentFragment, elements: { [K in keyof T]: HTMLElement }] {
	const fragment = document.createDocumentFragment();

	if (input.startsWith("#")) {
		const tpl = document.querySelector(input);
		if (!(tpl instanceof HTMLTemplateElement)) {
			throw new Error(`Template not found: ${input}`);
		}
		fragment.appendChild(tpl.content.cloneNode(true));
	} else {
		const temp = document.createElement("template");
		temp.innerHTML = input;
		fragment.appendChild(temp.content.cloneNode(true));
	}

	const mounts = {} as { [K in keyof T]: HTMLElement };

	for (const key in selectors) {
		const selector = selectors[key];
		const matches = fragment.querySelectorAll<HTMLElement>(selector);

		if (matches.length !== 1) {
			throw new Error(`Selector "${selector}" matched ${matches.length} elements`);
		}

		mounts[key] = matches[0];
	}

	return [fragment, mounts];
}
