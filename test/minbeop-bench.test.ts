// import { readFile } from "node:fs/promises";
// import path from "node:path";
// import { describe, expect, it } from "vitest";
// import { TOKEN_BUFFER_STRIDE } from "../core/src/constants";
// import { buildDiffInput } from "../core/src/diff/build-diff-input";
// import { buildDiffScoreSystem } from "../core/src/diff/build-diff-score-system";
// import { getDefaultDiffOptions } from "../core/src/diff/get-default-diff-options";
// import { runHistogramDiff } from "../core/src/diff/run-histogram-diff";
// import { tokenize } from "../core/src/tokenization";

// function toTokenBuffer(tokens: Array<{ textOffset: number; textLength: number; flags: number; lineNumber: number }>): Int32Array {
//     const arr = new Int32Array(tokens.length * TOKEN_BUFFER_STRIDE);
//     for (let i = 0; i < tokens.length; i++) {
//         const t = tokens[i];
//         const base = i * TOKEN_BUFFER_STRIDE;
//         arr[base + 0] = t.textOffset;
//         arr[base + 1] = t.textLength;
//         arr[base + 2] = t.flags;
//         arr[base + 3] = t.lineNumber;
//         arr[base + 4] = 0;
//     }
//     return arr;
// }

// describe("minbeop benchmark", () => {
//     it("runs current histogram path benchmark", async () => {
//         const leftPath = path.resolve(process.cwd(), "test/bench/minbeop16-A.txt");
//         const rightPath = path.resolve(process.cwd(), "test/bench/minbeop16-B.txt");

//         const [leftText, rightText] = await Promise.all([
//             readFile(leftPath, "utf8"),
//             readFile(rightPath, "utf8"),
//         ]);

//         const leftRoot = document.createElement("div");
//         leftRoot.textContent = leftText;
//         const rightRoot = document.createElement("div");
//         rightRoot.textContent = rightText;

//         const [leftTokenized, rightTokenized] = await Promise.all([
//             tokenize(leftRoot, {
//                 mergeNonWordLikeTokens: getDefaultDiffOptions().mergeNonWordTokens,
//             }),
//             tokenize(rightRoot, {
//                 mergeNonWordLikeTokens: getDefaultDiffOptions().mergeNonWordTokens,
//             }),
//         ]);

//         type RunResult = {
//             elapsedMs: number;
//             totalTokens: number;
//         };

//         async function runOnce(reqId: number): Promise<RunResult> {
//             const diffOptions = getDefaultDiffOptions();
//             diffOptions.usePatience = false;

//             const leftData = toTokenBuffer(leftTokenized.tokens);
//             const rightData = toTokenBuffer(rightTokenized.tokens);

//             const { input: lhsInput } = buildDiffInput(leftTokenized.wholeText, leftData, diffOptions);
//             const { input: rhsInput } = buildDiffInput(rightTokenized.wholeText, rightData, diffOptions);

//             const ctx = {
//                 reqId,
//                 diffOptions,
//                 score: buildDiffScoreSystem({ lenMax: 20 }),
//                 signal: new AbortController().signal,
//             };

//             const t0 = performance.now();
//             await runHistogramDiff(ctx, lhsInput, rhsInput, 0, 0);
//             const elapsedMs = performance.now() - t0;

//             return {
//                 elapsedMs,
//                 totalTokens: lhsInput.tokenCount + rhsInput.tokenCount,
//             };
//         }

//         function median(values: number[]): number {
//             const sorted = [...values].sort((a, b) => a - b);
//             const mid = Math.floor(sorted.length / 2);
//             return (sorted.length % 2 === 0)
//                 ? (sorted[mid - 1] + sorted[mid]) / 2
//                 : sorted[mid];
//         }

//         const WARMUP_CYCLES = 2;
//         const MEASURE_CYCLES = 10;
//         const elapsed: number[] = [];

//         let totalTokensChecked = 0;

//         for (let cycle = 0; cycle < WARMUP_CYCLES + MEASURE_CYCLES; cycle++) {
//             const r = await runOnce(10000 + cycle);
//             if (cycle < WARMUP_CYCLES) {
//                 continue;
//             }

//             elapsed.push(r.elapsedMs);
//             totalTokensChecked = r.totalTokens;
//         }

//         const avg = elapsed.reduce((a, b) => a + b, 0) / elapsed.length;
//         const med = median(elapsed);

//         console.log(
//             `[Histogram 32] runs:${elapsed.length} tokens:${totalTokensChecked} | avg:${avg.toFixed(1)}ms median:${med.toFixed(1)}ms min:${Math.min(...elapsed).toFixed(1)} max:${Math.max(...elapsed).toFixed(1)}`
//         );

//         expect(totalTokensChecked).toBeGreaterThan(0);
//     }, 120000);
// });
