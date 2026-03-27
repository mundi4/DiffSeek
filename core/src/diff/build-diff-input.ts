import { TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_LINE_END, TOKEN_FLAGS_LINE_START } from "../tokenization";
import type { DiffInput, DiffOptions } from "./types";

const DATA_STRIDE = 5;

export function buildDiffInput(wholeText: string, data: Int32Array, _diffOptions: DiffOptions): { input: DiffInput; lineCount: number } {
    const tokenCount = data.length / DATA_STRIDE;

    // 공백을 넣어줘야 자연스럽게 공백을 포함한 텍스트로 sa가 만들어짐.
    const insertSpace = _diffOptions.whitespace === "collapse";

    const flagsArray = new Uint32Array(tokenCount);
    const offsetArray = new Uint32Array(tokenCount + 1);

    let totalBufLen = 0;
    let lineCount = 0;
    for (let i = 0; i < tokenCount; i++) {
        const textLength = data[i * DATA_STRIDE + 1];
        const flags = data[i * DATA_STRIDE + 2];
        if (flags & TOKEN_FLAGS_LINE_START) {
            lineCount++;
        }

        flagsArray[i] = flags;
        offsetArray[i] = totalBufLen;

        totalBufLen += textLength;

        if (insertSpace && ((flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE) || (flags & TOKEN_FLAGS_LINE_END))) {
            totalBufLen++;
        }
    }
    offsetArray[tokenCount] = totalBufLen;

    const textBuffer = new Uint16Array(totalBufLen);

    let currentPos = 0;
    for (let i = 0; i < tokenCount; i++) {
        const ofs = data[i * DATA_STRIDE + 0];
        const len = data[i * DATA_STRIDE + 1];
        const flags = flagsArray[i];
        for (let j = 0; j < len; j++) {
            textBuffer[currentPos++] = wholeText.charCodeAt(ofs + j);
        }
        if (insertSpace && ((flags & TOKEN_FLAGS_HAS_FOLLOWING_SPACE) || (flags & TOKEN_FLAGS_LINE_END))) {
            textBuffer[currentPos++] = 32;
        }
    }

    data.fill(0);

    return {
        input: {
            buffer: textBuffer,
            offsets: offsetArray,
            flags: flagsArray,
            resultBuffer: data,
            tokenCount
        },
        lineCount
    };
}
