/// <reference lib="webworker" />

import { ABORT_REASON_CANCELLED } from "../constants";
import { DIFF_TYPE_ADDED, DIFF_TYPE_MODIFIED, DIFF_TYPE_REMOVED, DIFF_TYPE_UNCHANGED, type DiffOptions } from "./types";
import { buildDiffInput } from "../diff/build-diff-input";
import { buildDiffScoreSystem } from "../diff/build-diff-score-system";
import { writeToResultBuffer } from "../diff/helpers";
import { buildPatienceAnchors } from "../diff/patience-diff";
import { processSegmentsWithAnchors } from "../diff/process-segments-with-anchors";
import { runHistogramDiff } from "../diff/run-histogram-diff";
import { shouldUsePatience } from "../diff/should-use-patience";
import { createJobScheduler } from "./job-scheduler";
import type { DiffInput, DiffJobContext } from "../diff/types";
import type { DiffWorkerRequest, DiffWorkerResponse } from "./types";

const jobScheduler = createJobScheduler<WorkItem>({
    coalesceMs: 100,
    abortReason: ABORT_REASON_CANCELLED,
    setTimeout: self.setTimeout.bind(self),
    clearTimeout: self.clearTimeout.bind(self),
    async execute(item, signal) {
        try {
            let result = await runDiffJob(item, signal);
            handleDiffResult(item.reqId, result);
            result = null!;
        } catch (err) {
            if (err == ABORT_REASON_CANCELLED) {
                postAborted(item.reqId);
            } else {
                throw err;
            }
        }
    },
    onCancelled(item) {
        postAborted(item.reqId);
    },
});

type WorkItem = {
    reqId: number;
    leftWholeText: string;
    rightWholeText: string;
    leftTokenBuffer: Int32Array;
    rightTokenBuffer: Int32Array;
    leftTokenCount: number;
    rightTokenCount: number;
    diffOptions: DiffOptions;
};

self.onmessage = (e) => {
    const request = e.data as DiffWorkerRequest;
    if (request.type === "diff") {
        jobScheduler.run({
            reqId: request.reqId,
            leftWholeText: request.leftWholeText,
            rightWholeText: request.rightWholeText,
            leftTokenBuffer: request.leftTokenBuffer,
            rightTokenBuffer: request.rightTokenBuffer,
            leftTokenCount: request.leftTokenCount,
            rightTokenCount: request.rightTokenCount,
            diffOptions: request.options,
        });
    } else if (request.type === "cancel") {
        jobScheduler.cancel();
    }
}

function handleDiffResult(reqId: number, result: DiffResult) {
    self.postMessage({
        type: "done",
        reqId,
        leftResultBuffer: result.leftResultBuffer,
        rightResultBuffer: result.rightResultBuffer,
        elapsedTime: result.elapsedTime,
    } satisfies DiffWorkerResponse, [result.leftResultBuffer.buffer, result.rightResultBuffer.buffer]);
}

function postAborted(reqId: number) {
    self.postMessage({
        reqId,
        type: "aborted",
    } satisfies DiffWorkerResponse);
}

type DiffResult = {
    leftResultBuffer: Int32Array;
    rightResultBuffer: Int32Array;
    elapsedTime: number;
}

async function runDiffJob(workItem: WorkItem, abortSignal: AbortSignal): Promise<DiffResult> {
    const startTime = performance.now();

    self.postMessage({
        reqId: workItem.reqId,
        type: "start",
        start: startTime,
    } satisfies DiffWorkerResponse);

    const leftResultBuffer = workItem.leftTokenBuffer;
    const rightResultBuffer = workItem.rightTokenBuffer;
    const leftTokenCount = workItem.leftTokenCount;
    const rightTokenCount = workItem.rightTokenCount;

    if (leftTokenCount === 0 && rightTokenCount === 0) {
        // do nothing
    } else if (leftTokenCount === 0) {
        writeToResultBuffer(leftResultBuffer, rightResultBuffer, 0, 0, 0, rightTokenCount, DIFF_TYPE_ADDED);
    } else if (rightTokenCount === 0) {
        writeToResultBuffer(leftResultBuffer, rightResultBuffer, 0, leftTokenCount, 0, 0, DIFF_TYPE_REMOVED);
    } else if (leftTokenCount === 1 && rightTokenCount === 1) {
        let diffType: number;
        const lLen = leftResultBuffer[1];
        const rLen = rightResultBuffer[1];
        if (lLen === rLen) {
            const lText = workItem.leftWholeText.slice(leftResultBuffer[0], leftResultBuffer[0] + lLen);
            const rText = workItem.rightWholeText.slice(rightResultBuffer[0], rightResultBuffer[0] + rLen);
            diffType = lText === rText ? DIFF_TYPE_UNCHANGED : DIFF_TYPE_MODIFIED;
        } else {
            diffType = DIFF_TYPE_MODIFIED;
        }
        writeToResultBuffer(leftResultBuffer, rightResultBuffer, 0, leftTokenCount, 0, rightTokenCount, diffType);
    } else {
        const scoreSystem = buildDiffScoreSystem({
            lenMax: 20
        });

        const ctx: DiffJobContext = {
            reqId: workItem.reqId,
            score: scoreSystem,
            diffOptions: workItem.diffOptions,
            signal: abortSignal,
        };

        const { input: lhsInput, lineCount: lhsLineCount } = buildDiffInput(workItem.leftWholeText, workItem.leftTokenBuffer, workItem.diffOptions);
        const { input: rhsInput, lineCount: rhsLineCount } = buildDiffInput(workItem.rightWholeText, workItem.rightTokenBuffer, workItem.diffOptions);

        workItem.leftWholeText = undefined!;
        workItem.rightWholeText = undefined!;
        workItem.leftTokenBuffer = undefined!;
        workItem.rightTokenBuffer = undefined!;

        const usePatience = shouldUsePatience(
            lhsInput,
            rhsInput,
            workItem.diffOptions,
            lhsLineCount,
            rhsLineCount
        );

        if (usePatience) {
            const anchors = buildPatienceAnchors(
                lhsInput,
                rhsInput,
                lhsLineCount,
                rhsLineCount,
                workItem.diffOptions
            );

            await processSegmentsWithAnchors(
                ctx,
                lhsInput,
                rhsInput,
                anchors
            );

        } else {
            await runHistogramDiff(
                ctx,
                lhsInput,
                rhsInput,
                0,
                0
            );
        }

    }

    const elapsedTime = performance.now() - startTime;

    return {
        leftResultBuffer,
        rightResultBuffer,
        elapsedTime,
    };
}

