
type NextIdleOptions = {
    timeout?: number;
    abortSignal?: AbortSignal;
}

export async function nextIdle(options: NextIdleOptions = {}): Promise<IdleDeadline> {
    return new Promise((resolve, reject) => {
        if (options.abortSignal?.aborted) {
            return reject(options.abortSignal.reason);
        }

        const id = requestIdleCallback((idleDeadline) => {
            resolve(idleDeadline);
        }, { timeout: options.timeout });

        options.abortSignal?.addEventListener("abort", () => {
            cancelIdleCallback(id);
            reject(options.abortSignal!.reason);
        }, { once: true });
    });
}