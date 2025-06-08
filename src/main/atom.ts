type Subscriber<T> = (value: T) => void;

type Atom<T> = {
	get(): T;
	set(newValue: T): void;
	subscribe(fn: Subscriber<T>): () => void;
};

const __ATOMS__: Record<string, Atom<any>> = {};

function createAtom<T>(name: string, initialValue?: T): Atom<T> {
	if (__ATOMS__[name]) {
		return __ATOMS__[name] as Atom<T>;
	}

	if (initialValue === undefined) {
		throw new Error(`Atom "${name}" is not initialized and no initial value provided.`);
	}

	let value = initialValue as T;
	const listeners = new Set<Subscriber<T>>();

	const atom: Atom<T> = {
		get() {
			return value;
		},
		set(newValue: T) {
			value = newValue;
			listeners.forEach((fn) => fn(value));
		},
		subscribe(fn: Subscriber<T>) {
			listeners.add(fn);
			fn(value);
			return () => listeners.delete(fn);
		},
	};

	__ATOMS__[name] = atom;
	return atom;
}

function createEventAtom<T>(name?: string) {
	// name은 그냥 디버깅 용도로...
	const listeners = new Set<Subscriber<T>>();

	return {
		emit(payload: T) {
			listeners.forEach((fn) => fn(payload));
		},
		subscribe(fn: Subscriber<T>) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	};
}
