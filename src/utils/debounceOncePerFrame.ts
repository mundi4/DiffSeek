export function debounceOncePerFrame<T extends any[]>(callback: (...args: T) => void) {
	let pending = false;
	let latestArgs: T;

	return (...args: T) => {
		latestArgs = args;
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			callback(...latestArgs);
		});
	};
}
