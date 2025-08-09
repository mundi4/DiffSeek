export function createSettingStore<T>(key: string, defaultValue: T) {
	return {
		load(): T {
			try {
				const raw = localStorage.getItem(key);
				return raw ? JSON.parse(raw) : defaultValue;
			} catch {
				console.warn(`Failed to load setting: ${key}`);
				return defaultValue;
			}
		},
		save(value: T) {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch {
				console.warn(`Failed to save setting: ${key}`);
			}
		},
		clear() {
			localStorage.removeItem(key);
		},
	};
}
