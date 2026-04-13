/**
 * A microtask-based workflow scheduler that ensures:
 * 1. Only one workflow runs at a time.
 * 2. Multiple rapid requests are coalesced into a single microtask.
 * 3. If a re-run is requested during execution, it runs again after completion.
 */
export class WorkflowScheduler {
	private _scheduled = false;
	private _running = false;
	private _rerunRequested = false;

	constructor(
		private readonly _execute: () => Promise<void>,
		private readonly _queueMicrotask: (fn: () => void) => void = (fn) => queueMicrotask(fn),
	) {}

	/** Request a workflow run. Coalesces multiple calls within the same microtask. */
	request(): void {
		this._rerunRequested = true;
		if (this._scheduled) {
			return;
		}

		this._scheduled = true;
		this._queueMicrotask(() => {
			this._scheduled = false;
			void this._drain();
		});
	}

	/** Whether a workflow is currently executing. */
	get isRunning(): boolean {
		return this._running;
	}

	/** Whether a re-run has been requested. */
	get isRerunRequested(): boolean {
		return this._rerunRequested;
	}

	private async _drain(): Promise<void> {
		if (this._running) {
			return;
		}

		this._running = true;
		try {
			while (this._rerunRequested) {
				this._rerunRequested = false;
				await this._execute();
			}
		} finally {
			this._running = false;
		}
	}
}
