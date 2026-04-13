import { describe, it, expect } from "vitest";
import { WorkflowScheduler } from "../src/engine/workflow-scheduler";

describe("WorkflowScheduler", () => {
	it("executes the workflow after microtask", async () => {
		let executed = 0;
		const microtasks: Array<() => void> = [];

		const scheduler = new WorkflowScheduler(
			async () => {
				executed++;
			},
			(fn) => microtasks.push(fn),
		);

		scheduler.request();
		expect(executed).toBe(0);

		// Flush microtask
		microtasks[0]();
		await Promise.resolve();
		expect(executed).toBe(1);
	});

	it("coalesces multiple requests within same microtask", async () => {
		let executed = 0;
		const microtasks: Array<() => void> = [];

		const scheduler = new WorkflowScheduler(
			async () => {
				executed++;
			},
			(fn) => microtasks.push(fn),
		);

		scheduler.request();
		scheduler.request();
		scheduler.request();

		expect(microtasks.length).toBe(1); // Only one microtask queued
		microtasks[0]();
		await Promise.resolve();
		expect(executed).toBe(1); // Only one execution
	});

	it("re-runs if request comes during execution", async () => {
		let executed = 0;
		const microtasks: Array<() => void> = [];
		let resolveExecution: (() => void) | null = null;

		const scheduler = new WorkflowScheduler(
			async () => {
				executed++;
				if (executed === 1) {
					// Simulate a re-run request during first execution
					scheduler.request();
				}
				await new Promise<void>((r) => {
					resolveExecution = r;
				});
			},
			(fn) => microtasks.push(fn),
		);

		scheduler.request();
		microtasks[0]();

		// Wait for first execution to start
		await Promise.resolve();
		expect(executed).toBe(1);
		expect(scheduler.isRunning).toBe(true);
		expect(scheduler.isRerunRequested).toBe(true);

		// Complete first execution
		resolveExecution!();
		for (let i = 0; i < 10; i++) await Promise.resolve();

		// Second execution should start automatically
		expect(executed).toBe(2);
		resolveExecution!();
		for (let i = 0; i < 10; i++) await Promise.resolve();
		expect(scheduler.isRunning).toBe(false);
	});

	it("does not queue duplicate microtask if already scheduled", () => {
		const microtasks: Array<() => void> = [];

		const scheduler = new WorkflowScheduler(
			async () => {},
			(fn) => microtasks.push(fn),
		);

		scheduler.request();
		scheduler.request();
		expect(microtasks.length).toBe(1);
	});

	it("isRunning is false initially", () => {
		const scheduler = new WorkflowScheduler(
			async () => {},
			() => {},
		);
		expect(scheduler.isRunning).toBe(false);
	});

	it("prevents concurrent drain calls", async () => {
		let concurrentCount = 0;
		let maxConcurrent = 0;
		const microtasks: Array<() => void> = [];

		const scheduler = new WorkflowScheduler(
			async () => {
				concurrentCount++;
				maxConcurrent = Math.max(maxConcurrent, concurrentCount);
				await Promise.resolve();
				concurrentCount--;
			},
			(fn) => microtasks.push(fn),
		);

		scheduler.request();
		microtasks[0]();

		// Try to trigger drain again while running
		scheduler.request();
		if (microtasks.length > 1) {
			microtasks[1]();
		}

		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(maxConcurrent).toBe(1);
	});
});
