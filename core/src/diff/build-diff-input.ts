import { HEADING_MASK, TOKEN_FLAGS_HAS_FOLLOWING_SPACE, TOKEN_FLAGS_LINE_END, TOKEN_FLAGS_LINE_START, TOKEN_FLAGS_WORD_LIKE } from "../tokenization";
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
    let headingIdx = -1;
    for (let i = 0; i < tokenCount; i++) {
        const textLength = data[i * DATA_STRIDE + 1];
        let flags = data[i * DATA_STRIDE + 2];
        if (flags & TOKEN_FLAGS_LINE_START) {
            lineCount++;
        }

        // 단순히 "1." 같은 텍스트는 섹션 헤딩으로 간주하지 않음.
        // 반드시 같은 줄에 유효한 단어가 존재해야 함.
        // "제1조" 이건 좀 애매하다. 뒤에 단어 없이도 헤딩으로 간주해도 되지 않을까? 고려해 볼 문제...
        // TODO: 애당초 이건 토큰화 단계에서 확인한 후 조건에 맞는 경우에만 flag를 부여해야 하지 않을까?
        if (flags & HEADING_MASK) {
            headingIdx = i;
        } else if (headingIdx >= 0) {
            if (flags & TOKEN_FLAGS_WORD_LIKE) {
                headingIdx = -1;
            }
            if (headingIdx >= 0 && (flags & TOKEN_FLAGS_LINE_END)) {
                // 단어를 만나지 못했음. headingIndex의 섹션 헤딩 플래그를 제거.
                flagsArray[headingIdx] &= ~HEADING_MASK;
                headingIdx = -1;
            }
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
