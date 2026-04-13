const FALSE_PROMISE = Promise.resolve(false);

export function createYieldIfNeeded(signal?: AbortSignal, yieldIntervalMs = 50): () => Promise<boolean> {
	let lastYieldTime = 0;
	return async function yieldIfNeeded(): Promise<boolean> {
		const now = performance.now();
		if (now - lastYieldTime < yieldIntervalMs) {
			return FALSE_PROMISE;
		}

		lastYieldTime = now;
		await scheduler.yield();
		signal?.throwIfAborted();
		return true;
	};
}
