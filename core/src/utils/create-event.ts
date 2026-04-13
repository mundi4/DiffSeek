export function createEvent<T>() {
	const handlers: ((data: T) => void)[] = [];

	return {
		on: (h: (data: T) => void) => {
			handlers.push(h);
		},
		off: (h: (data: T) => void) => {
			const i = handlers.indexOf(h);
			if (i !== -1) handlers.splice(i, 1);
		},
		emit: (data: T) => {
			for (let i = 0; i < handlers.length; i++) {
				handlers[i](data);
			}
		},
	};
}
