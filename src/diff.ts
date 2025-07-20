type WorkerMessage =
	| { type: "diff"; reqId: number; diffs: RawDiff[]; options: DiffOptions; processTime: number }
	| { type: "slice"; reqId: number; accepted: true; diffs: RawDiff[]; options: DiffOptions; processTime: number }
	| { type: "slice"; reqId: number; accepted: false }
	| { type: "error"; reqId: number; error: string };

function initializeWorker(onMessage: (msg: WorkerMessage) => void) {
	let _currentReqId = 0;

	const worker = (() => {
		const scriptEl = document.getElementById("worker.js") as HTMLScriptElement;
		const code = scriptEl.textContent!;
		const workerURL = code.length < 10
			? scriptEl.src
			: URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
		return new Worker(workerURL);
	})();

	worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
		onMessage(e.data);
	};

	function fullDiff(leftTokens: Token[] | null, rightTokens: Token[] | null, options: DiffOptions) {
		const reqId = ++_currentReqId;
		worker.postMessage({
			type: "diff",
			reqId,
			leftTokens,
			rightTokens,
			options,
		});
		return reqId;
	}

	function sliceDiff(leftText: string, rightText: string, options: DiffOptions) {
		const reqId = ++_currentReqId;
		worker.postMessage({
			type: "slice",
			reqId,
			leftText,
			rightText,
			options,
		});
		return reqId;
	}

	return {
		fullDiff,
		sliceDiff,
		worker,
	};
}