import { ABORT_REASON_CANCELLED } from "../constants";
import { getDefaultDiffOptions } from "./getDefaultDiffOptions";
import type { DiffOptions, SerializedToken } from "../types";
import type { DiffWorkerResponse, DiffWorkerRequest, DiffWorkerResult } from "./worker";
import DiffWorker from "./worker.ts?worker&inline";

export type DiffWorkerArgs = {
    leftWholeText: string;
    rightWholeText: string;
    leftTokens: SerializedToken[];
    rightTokens: SerializedToken[];
    options?: Partial<DiffOptions>;
    transfer?: Transferable[];
    abortSignal?: AbortSignal;
    onStatus?: (e: DiffWorkerStatusEvent) => void;
}

export type DiffWorkerStatusEvent = {
    type: "start" | "progress" | "done" | "aborted" | "error";
    progress?: number;
    error?: string;
}

const DEFAULT_DIFF_OPTIONS = getDefaultDiffOptions();

export function initializeDiffWorker() {
    type _Ctx = {
        onStatus?: (e: DiffWorkerStatusEvent) => void;
        resolve: (result: DiffWorkerResult) => void;
        reject: (err: any) => void;
    }

    let worker = new DiffWorker();
    let currentReqId = 0;
    let currentCtx: _Ctx | null = null;

    worker.onmessage = (e: MessageEvent<DiffWorkerResponse>) => {
        const data = e.data;
        if (data.reqId === currentReqId) {
            if (data.type === "done") {
                // console.log("worker done", data.reqId);
                currentCtx?.onStatus?.({ type: "done" });
                if (currentCtx) {
                    currentCtx.resolve({
                        diffs: data.diffs,
                        options: data.options,
                        elapsedTime: data.elapsedTime,
                        //imageComparisons: data.imageComparisons,
                    });
                    currentCtx = null;
                }
            } else if (data.type === "progress") {
                currentCtx?.onStatus?.({ type: "progress", progress: data.progress });
            } else if (data.type === "start") {
                currentCtx?.onStatus?.({ type: "start" });
            } else if (data.type === "cancelled") {
                currentCtx?.onStatus?.({ type: "aborted" });
                currentCtx?.reject(ABORT_REASON_CANCELLED);
                currentCtx = null;
            } else if (data.type === "error") {
                console.error(`Error in diff worker (reqId: ${data.reqId}):`, data.error);
                currentCtx?.onStatus?.({ type: "error", error: data.error });
                currentCtx?.reject(data.error);
                currentCtx = null;
            }
        }
    };

    return {
        run: async (
            {
                leftWholeText,
                leftTokens,
                rightWholeText,
                rightTokens,
                options = {},
                transfer,
                abortSignal,
                onStatus }: DiffWorkerArgs
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
                leftWholeText,
                rightWholeText,
                leftTokens,
                rightTokens,
                options: { ...DEFAULT_DIFF_OPTIONS, ...options }
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
                    onStatus,
                    resolve,
                    reject,
                }
                worker.postMessage(request, {
                    transfer
                });
            });
        },
        cancel: () => {
            worker.postMessage({
                type: "cancel",
            } satisfies DiffWorkerRequest);
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