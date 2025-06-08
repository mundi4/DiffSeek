// computeDiffAsync는 queue 방식으로 동작하지 않음!
// 현재 진행 중인 작업이 있다면 무조건 reject/cancel하고 새 작업을 시작함
const computeDiffAsync = (() => {
	const worker = (() => {
		let workerURL;
		const scriptElement = document.getElementById("worker.js") as HTMLScriptElement;
		const workerCode = scriptElement.textContent;
		if (workerCode!.length < 10) {
			workerURL = scriptElement.src; // "./dist/worker.js";
		} else {
			const blob = new Blob([workerCode!], { type: "application/javascript" });
			workerURL = URL.createObjectURL(blob);
		}
		return new Worker(workerURL);
	})();

	type WorkerContext = {
		resolve: (response: DiffResult) => void;
		reject: (error: Error) => void;
		request: DiffRequest;
	};

	let _reqId = 0;
	let _current: WorkerContext | null = null;
	worker.onmessage = (e: MessageEvent) => {
		const data = e.data;
		if (data.type === "diff") {
			if (_current && data.reqId === _current.request.reqId) {
				if (data.reqId === _current.request.reqId) {
					const result: DiffResult = {
						diffs: data.diffs,
						processTime: data.processTime,
					};
					_current.resolve(result);
				} else {
                    // 이 경우는 worker가 이전 요청을 처리하는 도중 새 요청이 들어온 경우임
                    _current.reject(new Error("cancelled"));
				}
			}
		}
	};

	worker.onerror = (e) => {
		//
	};

	function computeDiffAsync(leftTokens: Token[] | null, rightTokens: Token[] | null, options: DiffOptions): Promise<DiffResult> {
		if (_current) {
			// 현재 컨텍스트가 있다면 일단 reject.
			// 작업 중인 worker는 새 작업을 받으면 알아서 취소하게 되어있음
			_current.reject(new Error("cancelled"));
		}

		return new Promise((resolve, reject) => {
			const request: DiffRequest = {
				type: "diff",
				reqId: ++_reqId,
				options: { ...options },
				leftTokens: leftTokens,
				rightTokens: rightTokens,
			};
			_current = {
				resolve,
				reject,
				request,
			};
			worker.postMessage(request);
		});
	}

	return computeDiffAsync;
})();
