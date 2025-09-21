import type { createImageLoader, ImageLoadResult } from "../imageCache";
import type { RichToken } from "./TokenizeContext";

export class TokenizerState {
    tokens: RichToken[];
    imageMap: Map<RichToken, ImageLoadResult>;
    loader: ReturnType<typeof createImageLoader>;
    cancellable: { cancelled: boolean };

    currentToken: RichToken | null = null;
    tokenIndex = 0;
    lineNum = 1;
    shouldNormalize = false;
    lastLineBreakElem: HTMLElement | null = null;

    constructor(
        readonly root: HTMLElement,
        tokens: RichToken[],
        imageMap: Map<RichToken, ImageLoadResult>,
        loader: ReturnType<typeof createImageLoader>,
        cancellable: { cancelled: boolean }
    ) {
        this.tokens = tokens;
        this.imageMap = imageMap;
        this.loader = loader;
        this.cancellable = cancellable;
    }

    processToken(node: Text, start: number, end: number, flags = 0) { /* ... */ }
    finalizeToken(flags = 0) { /* ... */ }
    doTokenizeText(buf: Text[]) { /* ... */ }
    handleImage(elem: HTMLImageElement) { /* ... */ }

    async *traverse(node: Node, deadline: IdleDeadline): AsyncGenerator<void, void, IdleDeadline> {
        // DOM 순회 로직 (child loop, yield deadline 등)
        yield this.finalizeToken(0);
    }

    finalizeLineBreaks() { /* lineBreakerElement 설정 */ }

    async awaitImages() {
        const pending: Promise<void>[] = [];
        for (const [token, props] of this.imageMap) {
            if (!props.hash && props.promise) {
                pending.push(props.promise.then(() => {
                    if (props.hash) token.text = `$img:${props.hash}`;
                }));
            }
        }
        if (pending.length) await Promise.allSettled(pending);
    }
}
