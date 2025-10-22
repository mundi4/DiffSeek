import { ABORT_REASON_CANCELLED } from "../constants";
import type { DiffWorkerResponse, DiffWorkerRequest, DiffWorkerResult } from "./diff-worker";
import DiffWorker from "./diff-worker?worker&inline";

export type DiffWorkerArgs = {
	leftTokens: Token[];
	rightTokens: Token[];
	options: DiffOptions;
	transfer?: Transferable[];
	abortSignal?: AbortSignal;
	onProgress?: (progress: number) => void;
}

export function initializeDiffWorker() {

	type _Ctx = {
		onProgress?: (progress: number) => void;
		resolve: (result: DiffWorkerResult) => void;
		reject: (err: any) => void;
	}

	let worker = new DiffWorker();
	let currentReqId = 0;
	let currentCtx: _Ctx | null = null;

	worker.onmessage = (e: MessageEvent<DiffWorkerResponse>) => {
		const data = e.data;
		if (data.type === "done" && data.reqId === currentReqId) {
			// console.log("worker done", data.reqId);
			if (currentCtx) {
				currentCtx.resolve({
					diffs: data.diffs,
					options: data.options,
					processTime: data.processTime,
					imageComparisons: data.imageComparisons,
				});
				currentCtx = null;
			}
		} else if (data.type === "progress" && data.reqId === currentReqId) {
			currentCtx?.onProgress?.(data.progress);
		} else if (data.type === "cancelled" && data.reqId === currentReqId) {
			currentCtx?.reject(ABORT_REASON_CANCELLED);
			currentCtx = null;
		} else if (data.type === "error" && data.reqId === currentReqId) {
			console.error(`Error in diff worker (reqId: ${data.reqId}):`, data.error);
			currentCtx?.reject(data.error);
			currentCtx = null;
		}
	};

	return {
		run: async (
			{ leftTokens,
				rightTokens,
				options,
				transfer,
				abortSignal,
				onProgress }: DiffWorkerArgs
		): Promise<DiffWorkerResult> => {
			// 이전 요청 취소
			if (currentCtx) {
				currentCtx.reject(ABORT_REASON_CANCELLED);
				currentCtx = null;
			}

			const reqId = ++currentReqId;
			const request: DiffWorkerRequest = {
				type: "diff",
				reqId,
				leftTokens,
				rightTokens,
				options,
			};

			if (abortSignal) {
				abortSignal.addEventListener("abort", () => {
					if (currentCtx) {
						console.log("posting cancel to worker", reqId);
						worker.postMessage({
							type: "cancel",
							reqId: reqId,
						} satisfies DiffWorkerRequest);
						currentCtx.reject(ABORT_REASON_CANCELLED);
						currentCtx = null;
					}
				}, { once: true });
			}

			return new Promise<DiffWorkerResult>((resolve, reject) => {
				currentCtx = {
					onProgress,
					resolve,
					reject,
				}
				worker.postMessage(request, {
					transfer
				});
			});
		},
		terminate: () => {
			if (worker) {
				worker.terminate();
				worker = null!;
			}
			if (currentCtx) {
				currentCtx.reject(new Error("Worker terminated"));
				currentCtx = null;
			}
		},
	};
}