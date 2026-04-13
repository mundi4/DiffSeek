import { describe, it, expect, vi } from "vitest";
import { createJobScheduler } from "../src/diff-worker/job-scheduler";

function createTestScheduler(options?: {
	coalesceMs?: number;
	execute?: (item: string, signal: AbortSignal) => Promise<void>;
	onCancelled?: (item: string) => void;
}) {
	const timers: Array<{ id: number; fn: () => void; ms: number }> = [];
	let nextId = 1;

	const fakeSetTimeout = (fn: () => void, ms: number) => {
		const id = nextId++;
		timers.push({ id, fn, ms });
		return id;
	};
	const fakeClearTimeout = (id: number) => {
		const idx = timers.findIndex((t) => t.id === id);
		if (idx >= 0) timers.splice(idx, 1);
	};

	const executed: Array<{ item: string; aborted: boolean }> = [];
	const cancelled: string[] = [];

	let resolveCurrentJob: (() => void) | null = null;

	const scheduler = createJobScheduler<string>({
		coalesceMs: options?.coalesceMs ?? 100,
		abortReason: "CANCELLED",
		setTimeout: fakeSetTimeout,
		clearTimeout: fakeClearTimeout,
		execute:
			options?.execute ??
			(async (item, signal) => {
				const aborted = signal.aborted;
				executed.push({ item, aborted });
				await new Promise<void>((resolve) => {
					resolveCurrentJob = resolve;
					signal.addEventListener("abort", () => resolve());
				});
			}),
		onCancelled:
			options?.onCancelled ??
			((item) => {
				cancelled.push(item);
			}),
	});

	function flushTimers() {
		// Execute all pending timers
		const pending = [...timers];
		timers.length = 0;
		for (const t of pending) t.fn();
	}

	function resolveJob() {
		resolveCurrentJob?.();
		resolveCurrentJob = null;
	}

	return { scheduler, timers, flushTimers, resolveJob, executed, cancelled };
}

describe("createJobScheduler", () => {
	it("schedules a job after coalesce delay", () => {
		const { scheduler, timers, flushTimers, executed } = createTestScheduler();

		scheduler.run("job1");

		// Timer should be scheduled but job not yet executed
		expect(timers.length).toBe(1);
		expect(timers[0].ms).toBe(100);
		expect(executed.length).toBe(0);

		// Flush timer to start the job
		flushTimers();
		expect(executed.length).toBe(1);
		expect(executed[0].item).toBe("job1");
	});

	it("replaces pending job with newer one", () => {
		const { scheduler, flushTimers, executed } = createTestScheduler();

		scheduler.run("job1");
		scheduler.run("job2");

		flushTimers();
		expect(executed.length).toBe(1);
		expect(executed[0].item).toBe("job2");
	});

	it("aborts running job when new job submitted", async () => {
		const { scheduler, flushTimers, executed } = createTestScheduler();

		scheduler.run("job1");
		flushTimers();
		expect(executed.length).toBe(1);

		// Submit new job while job1 is still running
		scheduler.run("job2");

		// job1 should be aborted (signal triggers resolve), need to flush microtasks
		for (let i = 0; i < 10; i++) await Promise.resolve();

		// After abort, scheduler should schedule the next
		flushTimers();
		for (let i = 0; i < 10; i++) await Promise.resolve();

		expect(executed.length).toBe(2);
		expect(executed[1].item).toBe("job2");
	});

	it("cancel() cancels pending job", () => {
		const { scheduler, cancelled, timers } = createTestScheduler();

		scheduler.run("job1");
		expect(timers.length).toBe(1);

		scheduler.cancel();
		expect(cancelled).toEqual(["job1"]);
		expect(timers.length).toBe(0); // timer cleared
	});

	it("cancel() aborts running job", () => {
		const { scheduler, flushTimers, executed } = createTestScheduler();
		const abortEvents: string[] = [];

		const scheduler2 = createJobScheduler<string>({
			coalesceMs: 0,
			abortReason: "CANCELLED",
			setTimeout: (fn, ms) => {
				fn();
				return 0;
			},
			clearTimeout: () => {},
			async execute(item, signal) {
				signal.addEventListener("abort", () => abortEvents.push(item));
				await new Promise<void>((resolve) => {
					signal.addEventListener("abort", () => resolve());
				});
			},
		});

		scheduler2.run("job1");
		expect(scheduler2.isRunning).toBe(true);
		scheduler2.cancel();
		expect(abortEvents).toEqual(["job1"]);
	});

	it("isRunning reflects current state", () => {
		const { scheduler, flushTimers, resolveJob } = createTestScheduler();

		expect(scheduler.isRunning).toBe(false);
		scheduler.run("job1");
		expect(scheduler.isRunning).toBe(false); // only pending, not started
		flushTimers();
		expect(scheduler.isRunning).toBe(true); // now running
	});

	it("runs next job after current completes", async () => {
		const completions: string[] = [];
		let resolvers: Array<() => void> = [];
		const deferredTimers: Array<() => void> = [];

		const scheduler = createJobScheduler<string>({
			coalesceMs: 0,
			abortReason: "CANCELLED",
			setTimeout: (fn) => {
				deferredTimers.push(fn);
				return deferredTimers.length;
			},
			clearTimeout: () => {},
			async execute(item, signal) {
				await new Promise<void>((resolve) => {
					resolvers.push(resolve);
					signal.addEventListener("abort", () => resolve());
				});
				completions.push(item);
			},
		});

		// Start job1
		scheduler.run("job1");
		deferredTimers.shift()!();
		expect(resolvers.length).toBe(1);

		// Submit job2 while job1 runs → aborts job1
		scheduler.run("job2");

		// job1 is aborted, resolve it
		for (let i = 0; i < 10; i++) await Promise.resolve();

		// Schedule next
		if (deferredTimers.length > 0) deferredTimers.shift()!();
		for (let i = 0; i < 10; i++) await Promise.resolve();

		// job2 should start
		expect(resolvers.length).toBe(2);
		resolvers[1]();
		for (let i = 0; i < 10; i++) await Promise.resolve();
		expect(completions).toContain("job2");
	});
});
