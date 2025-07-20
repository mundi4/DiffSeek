type SliceDiffCallbacks = {
	onComplete: (result: SliceDiffResponse) => void;
	onReject: (reqId: number) => void;
};

function createSliceDiffWorker(onComplete: (result: SliceDiffResponse) => void) {
	let reqIdCounter = 0;
	let currentReqId: number | null = null;

	const worker = (() => {
		const scriptElement = document.getElementById("slice.worker.js") as HTMLScriptElement;
		const workerCode = scriptElement.textContent;
		let workerURL: string;
		if (workerCode && workerCode.length > 10) {
			const blob = new Blob([workerCode], { type: "application/javascript" });
			workerURL = URL.createObjectURL(blob);
		} else {
			workerURL = scriptElement.src;
		}
		return new Worker(workerURL);
	})();

	worker.onmessage = (e: MessageEvent) => {
		const data = e.data;
		if (data.type === "slice" && data.reqId === currentReqId) {
			onComplete(data);
		}
	};

	function getNormalizedCharMap(): Record<number, number> {
		return normalizedCharMap;
	}

	worker.postMessage({
		type: "init",
		normalizedCharMap: getNormalizedCharMap(),
	});

	function requestSliceDiff(leftText: string, rightText: string, options: SliceDiffOptions): number {
		const reqId = ++reqIdCounter;
		currentReqId = reqId;

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
		requestSliceDiff,
		terminate: () => worker.terminate(),
	};
}
