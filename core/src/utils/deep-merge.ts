export function deepMerge<T>(target: T, source: Partial<T>): T {
	for (const key in source) {
		const value = source[key];
		if (value && typeof value === "object" && !Array.isArray(value)) {
			// @ts-expect-error – we’re merging recursively
			target[key] = deepMerge({ ...(target[key] || {}) }, value);
		} else {
			// @ts-expect-error – assignment okay
			target[key] = value;
		}
	}
	return target;
}
