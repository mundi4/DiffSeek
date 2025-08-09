export function mountHelper<T extends HTMLElement>(
	wrapper: T,
	options?: {
		onMount?: (target: HTMLElement) => void;
		onUnmount?: (target: HTMLElement) => void;
	}
) {
	let mountTarget: HTMLElement | null = null;

	function mount(target: HTMLElement) {
		if (mountTarget) {
			throw new Error(`Already mounted to ${mountTarget}. Unmount it first!`);
		}
		target.appendChild(wrapper);
		mountTarget = target;
		options?.onMount?.(target);
	}

	function unmount() {
		if (!mountTarget) {
			throw new Error(`Not mounted to any target.`);
		}
		if (wrapper.parentNode !== mountTarget) {
			throw new Error(`Mount mismatch. Expected: ${mountTarget}, Actual: ${wrapper.parentNode}`);
		}
		mountTarget.removeChild(wrapper);
		options?.onUnmount?.(mountTarget);
		mountTarget = null;
	}

	function getMountTarget(): HTMLElement | null {
		return mountTarget;
	}

	return { mount, unmount, getMountTarget };
}
