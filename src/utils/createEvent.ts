export function createEvent<T>() {
	let handlers: ((arg: T) => void)[] = [];

	const on = (cb: (arg: T) => void): (() => void) => {
		handlers.push(cb);
		return () => {
			handlers = handlers.filter((h) => h !== cb);
		};
	};

	const emit = (arg: T) => {
		for (const cb of handlers) {
			try {
				cb(arg);
			} catch (e) {
				console.error("event error", e);
			}
		}
	};

	return { on, emit };
}
