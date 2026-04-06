/**
 * Generic coalescing job scheduler.
 *
 * - Only one job runs at a time.
 * - New submissions replace any pending job.
 * - Start is delayed by `coalesceMs` to absorb rapid-fire submissions.
 * - A running job is aborted (via AbortSignal) when a new job arrives.
 */

export type JobSchedulerOptions<T> = {
    /** Coalesce delay in milliseconds before starting a pending job. */
    coalesceMs: number;
    /** Abort reason passed to AbortController.abort() */
    abortReason: unknown;
    /** Execute the job. Must respect the AbortSignal. */
    execute: (item: T, signal: AbortSignal) => Promise<void>;
    /** Called when a pending job is cancelled before it started. */
    onCancelled?: (item: T) => void;
    /** setTimeout implementation (injectable for testing). */
    setTimeout?: (fn: () => void, ms: number) => number;
    /** clearTimeout implementation (injectable for testing). */
    clearTimeout?: (id: number) => void;
};

export type JobScheduler<T> = {
    run: (item: T) => void;
    cancel: () => void;
    readonly isRunning: boolean;
};

export function createJobScheduler<T>(options: JobSchedulerOptions<T>): JobScheduler<T> {
    const _setTimeout = options.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number);
    const _clearTimeout = options.clearTimeout ?? ((id: number) => clearTimeout(id));

    type RunningSlot = {
        controller: AbortController;
        promise: Promise<void>;
    };

    let running: RunningSlot | null = null;
    let pending: T | null = null;
    let startTimer: number | null = null;

    function clearStartTimer() {
        if (startTimer !== null) {
            _clearTimeout(startTimer);
            startTimer = null;
        }
    }

    function scheduleTryStartNext() {
        if (running || pending === null) {
            return;
        }
        if (startTimer !== null) {
            return;
        }
        const pendingTimer = -1;
        startTimer = pendingTimer;
        const timerId = _setTimeout(() => {
            startTimer = null;
            tryStartNext();
        }, options.coalesceMs);
        if (startTimer === pendingTimer) {
            startTimer = timerId;
        }
    }

    function run(item: T) {
        pending = item;

        if (running) {
            running.controller.abort(options.abortReason);
            return;
        }

        scheduleTryStartNext();
    }

    function cancel() {
        clearStartTimer();

        if (pending !== null) {
            options.onCancelled?.(pending);
            pending = null;
        }
        if (running) {
            running.controller.abort(options.abortReason);
        }
    }

    function tryStartNext() {
        if (running || pending === null) return;

        const item = pending;
        pending = null;

        const controller = new AbortController();
        const slot: RunningSlot = { controller, promise: Promise.resolve() };

        running = slot;

        slot.promise = (async () => {
            try {
                await options.execute(item, controller.signal);
            } finally {
                if (running === slot) {
                    running = null;
                }
                scheduleTryStartNext();
            }
        })();
    }

    return {
        run,
        cancel,
        get isRunning() { return running !== null; },
    };
}
