import type { DiffOptions } from "../diff";

export type DiffWorkerRequest = {
    type: "diff";
    reqId: number;
    leftWholeText: string;
    leftTokenBuffer: Int32Array;
    leftTokenCount: number;
    rightWholeText: string;
    rightTokenBuffer: Int32Array;
    rightTokenCount: number;
    options: DiffOptions;
} | {
    type: "cancel";
};

export type DiffWorkerResponse =
    | { type: "done"; reqId: number; } & DiffWorkerResult
    | { type: "error"; reqId: number; error: string }
    | { type: "aborted"; reqId: number; }
    | { type: "start"; reqId: number; start: number; }

export type DiffWorkerResult = {
    leftResultBuffer: Int32Array;
    rightResultBuffer: Int32Array;
    elapsedTime: number;
};

export * from "../diff/types";