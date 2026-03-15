import { ABORT_REASON_CANCELLED } from "../constants";
import type { DiffOptions } from "../diff/types";
import type { DiffWorkerResult, DiffWorkerResponse, DiffWorkerRequest } from "./types";
// import DiffWorker from "./worker.ts?worker&inline";
import DiffWorker from "./worker.ts?worker";

export type DiffWorkerArgs = {
    leftWholeText: string;
    rightWholeText: string;
    leftTokenBuffer: Int32Array;
    rightTokenBuffer: Int32Array;
    leftTokenCount: number;
    rightTokenCount: number;
    options: DiffOptions;
    abortSignal?: AbortSignal;
    onStatus?: (e: DiffWorkerStatusEvent) => void;
}

export type DiffWorkerStatusEvent = {
    type: "start" | "progress" | "done" | "aborted" | "error";
    progress?: number;
    error?: string;
}

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

                    // for (let i = 0; i < data.leftTokenBuffer.length / 5; i++) {
                    //     console.log("LHSBUF: #", i, data.leftTokenBuffer[i * 5 + 0], data.leftTokenBuffer[i * 5 + 1], data.leftTokenBuffer[i * 5 + 2], data.leftTokenBuffer[i * 5 + 3], data.leftTokenBuffer[i * 5 + 4]);
                    // }

                    currentCtx.resolve({
                        //diffs: data.diffs,
                        leftResultBuffer: data.leftResultBuffer,
                        rightResultBuffer: data.rightResultBuffer,
                        elapsedTime: data.elapsedTime,
                    });
                    currentCtx = null;
                }
                // } else if (data.type === "progress") {
                //     currentCtx?.onStatus?.({ type: "progress", progress: data.progress });
            } else if (data.type === "start") {
                currentCtx?.onStatus?.({ type: "start" });
            } else if (data.type === "aborted") {
                if (import.meta.env.DEV) {
                    console.log("diff request aborted (reqId: " + data.reqId + ")");
                }
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
                leftTokenBuffer,
                rightWholeText,
                rightTokenBuffer,
                leftTokenCount,
                rightTokenCount,
                options,
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
                leftTokenBuffer,
                rightTokenBuffer,
                leftTokenCount,
                rightTokenCount,
                options: { ...options }
            };

            const onAbort = () => {
                if (currentCtx) {
                    worker.postMessage({
                        type: "cancel",
                    } satisfies DiffWorkerRequest);
                    currentCtx.reject(ABORT_REASON_CANCELLED);
                    currentCtx = null;
                }
            };

            if (abortSignal) {
                abortSignal.addEventListener("abort", onAbort, { once: true });
            }

            return new Promise<DiffWorkerResult>((resolve, reject) => {
                currentCtx = {
                    onStatus,
                    resolve,
                    reject,
                };
                worker.postMessage(request, [leftTokenBuffer.buffer, rightTokenBuffer.buffer]);
            }).finally(() => {
                if (abortSignal) {
                    abortSignal.removeEventListener("abort", onAbort);
                }
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