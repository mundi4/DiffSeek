import type { DiffWorkerResponse, DiffWorkerRequest, DiffWorkerResult } from "./diff-worker";
import DiffWorker from "./diff-worker?worker&inline";

export type OnDiffCompleteCallback = (result: DiffWorkerResult) => void;

export type DiffWorkerAPI = ReturnType<typeof initializeDiffWorker>;

export function initializeDiffWorker(onComplete: OnDiffCompleteCallback) {
	let worker = new DiffWorker();
	let currentReqId = 0;

	worker.onmessage = (e: MessageEvent<DiffWorkerResponse>) => {
		const data = e.data;
		if (data.type === "diff") {
			if (data.reqId !== currentReqId) {
				// we are only interested in the latest request!
				return;
			}
			const result: DiffWorkerResult = {
				diffs: data.diffs,
				options: data.options,
				processTime: data.processTime,
				imageComparisons: data.imageComparisons,
			};
			onComplete(result);
		} else if (data.type === "error") {
			console.error(`Error in diff worker (reqId: ${data.reqId}):`, data.error);
		}
	};

	// 왜 토큰배열이 nullable인가?
	// worker에서는 마지막 요청의 토큰 배열을 보관함. 왜 그렇게 만들었냐고?
	// 에디터의 내용이 변경되면 거의 즉시 diff 요청을 보내게 되는데 양쪽의 에디터가 동시에 변경되는 일은 극히 드물기 때문에
	// 한쪽만 변경되었을 경우에도 양쪽의 토큰을 모두 보내는 건 비효율적이다.
	return {
		run: (leftTokens: Token[], rightTokens: Token[], options: DiffOptions, transfer: Transferable[]) => {
			const request: DiffWorkerRequest = {
				type: "diff",
				reqId: ++currentReqId,
				leftTokens,
				rightTokens,
				options,
			};

			// for (let i = 0; i < transfer.length; i++) {
			// 	console.log("transferable", i, transfer[i]);
			// }

			worker!.postMessage(request, transfer);
		},
		terminate: () => {
			if (worker) {
				worker.terminate();
				worker = null!;
			}
		},
	};
}
