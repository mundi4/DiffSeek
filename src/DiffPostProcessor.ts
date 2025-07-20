
declare type DiffContext = {
    reqId: number;
    leftTokens: readonly RichToken[];
    rightTokens: readonly RichToken[];
    diffOptions: DiffOptions;
    rawDiffs: RawDiff[];
    processTime: number;
    entries: RawDiff[];
    leftEntries: RawDiff[];
    rightEntries: RawDiff[];
    diffs: DiffItem[];
    ready: boolean;
    leftSectionHeadings: SectionHeading[];
    rightSectionHeadings: SectionHeading[];
};


class DiffPostProcessor {
    // #ctx: DiffContext;
    #leftEditor: Editor;
    #rightEditor: Editor;
    #editorPairer: EditorPairer;
    #cancelled = false;
    #ricCancelId: number | null = null;

    #entries: RawDiff[] | null = null;
    #leftEntries: RawDiff[] | null = null;
    #rightEntries: RawDiff[] | null = null;
    #leftSectionHeadings: SectionHeading[] | null = null;
    #rightSectionHeadings: SectionHeading[] | null = null;

    #diffs: DiffItem[] = [];

    #leftTokens: readonly RichToken[];
    #rightTokens: readonly RichToken[];
    #diffOptions: DiffOptions;
    #rawDiffs: RawDiff[];

    constructor(leftEditor: Editor, rightEditor: Editor, editorPairer: EditorPairer, diffOptions: DiffOptions, rawDiffs: RawDiff[]) {
        // this.#ctx = ctx;
        this.#leftEditor = leftEditor;
        this.#rightEditor = rightEditor;
        this.#editorPairer = editorPairer;
        this.#diffOptions = diffOptions;
        this.#rawDiffs = rawDiffs;

        this.#leftTokens = leftEditor.tokens;
        this.#rightTokens = rightEditor.tokens;
    }

    cancel() {
        this.#cancelled = true;
        if (this.#ricCancelId) {
            cancelIdleCallback(this.#ricCancelId);
            this.#ricCancelId = null;
        }
    }

    process(onComplete?: (diffContext: DiffContext) => void) {
        let generator: Generator<void, void, IdleDeadline> | null = null;
        // const generator = this.#diffFinalizer(diffContext, idleDeadline);
        const step = (idleDeadline: IdleDeadline) => {
            if (this.#cancelled) {
                return;
            }

            if (generator === null) {
                generator = this.applyGenerator(idleDeadline);
            }

            const { done } = generator.next(idleDeadline);
            if (this.#cancelled) {
                return;
            }

            if (done) {
                const diffContext: DiffContext = {
                    reqId: 0,//this.#diffOptions.reqId,
                    leftTokens: this.#leftTokens,
                    rightTokens: this.#rightTokens,
                    diffOptions: this.#diffOptions,
                    rawDiffs: this.#rawDiffs,
                    processTime: 0, // TODO: calculate process time
                    entries: this.#entries!,
                    leftEntries: this.#leftEntries!,
                    rightEntries: this.#rightEntries!,
                    diffs: this.#diffs,
                    leftSectionHeadings: this.#leftSectionHeadings!,
                    rightSectionHeadings: this.#rightSectionHeadings!,
                    ready: true,
                }
                onComplete?.(diffContext);
            } else {
                this.#ricCancelId = requestIdleCallback(step, {
                    timeout: COMPUTE_DIFF_TIMEOUT,
                });
            }
        };

        this.#ricCancelId = requestIdleCallback(step, {
            timeout: COMPUTE_DIFF_TIMEOUT,
        });
    }

    *applyGenerator(idleDeadline: IdleDeadline): Generator<void, void, IdleDeadline> {
        this.#buildDiffEntries();

        if (idleDeadline.timeRemaining() <= 0) {
            idleDeadline = yield;
        }

        const entries = this.#entries!;

        this.#editorPairer.beginUpdate();

        this.#leftSectionHeadings = this.#buildSectionHeadingTree(this.#leftEditor, this.#leftTokens);
        this.#rightSectionHeadings = this.#buildSectionHeadingTree(this.#rightEditor, this.#rightTokens);

        for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
            if ((entryIndex & 0x1f) === 0) {
                if (idleDeadline.timeRemaining() < 3) {
                    idleDeadline = yield;
                }
            }

            if (entries[entryIndex].type === 0) {
                this.#handleCommonEntry(entryIndex);
            } else {
                this.#handleDiffEntry(entryIndex);
            }
        }

        this.#editorPairer.endUpdate();
    }

    #handleCommonEntry(entryIndex: number) {
        const { left, right } = this.#entries![entryIndex];
        const leftTokens = this.#leftTokens;
        const rightTokens = this.#rightTokens;
        const leftToken = leftTokens[left.index];
        const rightToken = rightTokens[right.index];
        const commonFlags = leftToken.flags & rightToken.flags;

        if (commonFlags & TokenFlags.LINE_START) {
            const leftAnchorFlags = translateTokenFlagsToAnchorFlags(leftToken.flags, leftTokens[left.index + left.count - 1].flags);
            const rightAnchorFlags = translateTokenFlagsToAnchorFlags(rightToken.flags, rightTokens[right.index + right.count - 1].flags);
            this.#editorPairer.addAnchorPair(leftToken.range, leftAnchorFlags, null, rightToken.range, rightAnchorFlags, null, null);

            if (commonFlags & TokenFlags.SECTION_HEADING_MASK) {
            }
        }
    }

    #handleDiffEntry(entryIndex: number) {
        const leftTokens = this.#leftTokens;
        const rightTokens = this.#rightTokens;
        const entries = this.#entries!;
        const diffs = this.#diffs!;

        const diffIndex = diffs.length;

        const entry = entries[entryIndex];
        const { left, right } = entry;
        const { index: leftIndex, count: leftTokenCount } = left;
        const { index: rightIndex, count: rightTokenCount } = right;
        const leftToken = leftTokens[leftIndex];
        const rightToken = rightTokens[rightIndex];
        const hue = DIFF_COLOR_HUES[diffIndex % NUM_DIFF_COLORS];

        let leftRange = this.#leftEditor.getTokenRange(leftIndex, leftTokenCount);
        let rightRange = this.#rightEditor.getTokenRange(rightIndex, rightTokenCount);
        let leftMarkerEl: HTMLElement | null = null;
        let rightMarkerEl: HTMLElement | null = null;
        let leftAnchorFlags: AnchorFlags = 0;
        let rightAnchorFlags: AnchorFlags = 0;

        if (leftTokenCount > 0 && rightTokenCount > 0) {
            const commonFlags = leftToken.flags & rightToken.flags;
            if (commonFlags & TokenFlags.LINE_START) {
                leftAnchorFlags = translateTokenFlagsToAnchorFlags(leftToken.flags, leftTokens[leftIndex + leftTokenCount - 1].flags);
                rightAnchorFlags = translateTokenFlagsToAnchorFlags(rightToken.flags, rightTokens[rightIndex + rightTokenCount - 1].flags);
                //this.#editorPairer.addAnchorPair(leftRange, leftAnchorFlags, null, rightRange, rightAnchorFlags, null, diffIndex);
            }
        } else {
            let filledTokens, emptyTokens;
            let filledRange: Range | null = null;
            let emptyRange: Range | null = null;
            let filledEditor: Editor | null = null;
            let emptyEditor: Editor | null = null;
            let filledSpan: Span;
            let emptySpan: Span;
            let markerEl: HTMLElement | null = null;

            if (leftTokenCount > 0) {
                filledEditor = this.#leftEditor;
                filledSpan = left;
                filledTokens = this.#leftEditor.tokens;
                filledRange = leftRange;
                emptyEditor = this.#rightEditor;
                emptySpan = right;
                emptyTokens = this.#rightEditor.tokens;
                emptyRange = rightRange;
            } else {
                filledEditor = this.#rightEditor;
                filledSpan = right;
                filledTokens = this.#rightEditor.tokens;
                filledRange = rightRange;
                emptyEditor = this.#leftEditor;
                emptySpan = left;
                emptyTokens = this.#leftEditor.tokens;
                emptyRange = leftRange;
            }

            const filledTokenIndex = filledSpan.index;
            const filledTokenCount = filledSpan.count;
            const emptyTokenIndex = emptySpan.index;

            const filledStartToken = filledTokens[filledTokenIndex];
            const filledEndToken = filledTokens[filledTokenIndex + filledTokenCount - 1];

            let emptyFlags: TokenFlags = 0;

            let insertionPoint: [HTMLElement, number, TokenFlags] | null = null;
            if (filledStartToken.flags & TokenFlags.TABLE_START) {
                const targetRange = this.#clampToSafeBoundary(emptyRange, "table", entryIndex, filledTokens, filledSpan, emptyTokens, emptySpan);
                if (targetRange) {
                    insertionPoint = this.#getInsertionPoint(targetRange, TokenFlags.TABLE_START);
                }
            }
            if (!insertionPoint && filledStartToken.flags & TokenFlags.TABLEROW_START) {
                const targetRange = this.#clampToSafeBoundary(emptyRange, "tr", entryIndex, filledTokens, filledSpan, emptyTokens, emptySpan);
                if (targetRange) {
                    insertionPoint = this.#getInsertionPoint(targetRange, TokenFlags.TABLEROW_START);
                }
            }
            if (!insertionPoint && filledStartToken.flags & TokenFlags.TABLECELL_START) {
                const targetRange = this.#clampToSafeBoundary(emptyRange, "td", entryIndex, filledTokens, filledSpan, emptyTokens, emptySpan);
                if (targetRange) {
                    insertionPoint = this.#getInsertionPoint(targetRange, TokenFlags.TABLECELL_START);
                }
            }
            if (!insertionPoint && filledStartToken.flags & TokenFlags.LINE_START) {
                insertionPoint = this.#getInsertionPoint(emptyRange, TokenFlags.LINE_START);
            }

            if (insertionPoint) {
                markerEl = this.#editorPairer.insertDiffMarker(insertionPoint[0], insertionPoint[1]);
                if (markerEl) {
                    markerEl.classList.add("diff");
                    markerEl.classList.toggle("block", !!(filledStartToken.flags & TokenFlags.LINE_START && filledEndToken.flags & TokenFlags.LINE_END));
                    markerEl.dataset.diffIndex = diffIndex.toString();
                    emptyFlags = insertionPoint[2];
                    emptyRange.selectNode(markerEl);
                    if (leftTokenCount > 0) {
                        rightMarkerEl = markerEl;
                    } else {
                        leftMarkerEl = markerEl;
                    }
                }
            }

            if (markerEl) {
                const commonFlags = filledStartToken.flags & emptyFlags;
                if (commonFlags & TokenFlags.LINE_START) {
                    leftAnchorFlags = translateTokenFlagsToAnchorFlags(filledStartToken.flags, filledEndToken.flags);
                    rightAnchorFlags = translateTokenFlagsToAnchorFlags(emptyFlags, emptyFlags);
                }
            }
        }

        diffs.push({
            diffIndex,
            hue,
            leftRange,
            rightRange,
            leftSpan: { index: leftIndex, count: leftTokenCount },
            rightSpan: { index: rightIndex, count: rightTokenCount },
            leftMarkerEl,
            rightMarkerEl,
        });

        if (leftAnchorFlags & rightAnchorFlags) {
            this.#editorPairer.addAnchorPair(leftRange, leftAnchorFlags, leftMarkerEl, rightRange, rightAnchorFlags, rightMarkerEl, diffIndex);
        }
    }

    #getInsertionPoint(targetRange: Range, desiredFlag: TokenFlags): [HTMLElement, number, TokenFlags] | null {
        let container: Node;
        let childIndex: number;
        let endContainer: Node;
        let endOffset: number;

        container = targetRange.startContainer
        childIndex = targetRange.startOffset;
        endContainer = targetRange.endContainer;
        endOffset = targetRange.endOffset;

        if (container.nodeType === 3) {
            childIndex = Array.prototype.indexOf.call(container.parentNode!.childNodes, container) + 1;
            container = container.parentNode!;
        }
        if (endContainer.nodeType === 3) {
            endOffset = Array.prototype.indexOf.call(endContainer.parentNode!.childNodes, endContainer);
            endContainer = endContainer.parentNode!;
        }

        const indexStack: number[] = [];
        let isTextlessContainer = TEXTLESS_ELEMENTS[container.nodeName] || false;
        while (container) {
            let current: Node = container.childNodes[childIndex];
            if (!isTextlessContainer) {
                if (desiredFlag & TokenFlags.TABLE_START) {
                    if (container.nodeName === "TD" && childIndex === 0) {
                        const rowcol = getTableCellPosition(container as HTMLElement);
                        if (rowcol && rowcol[0] === 0 && rowcol[1] === 0) {
                            return [container as HTMLElement, childIndex, TokenFlags.TABLE_START | TokenFlags.TABLEROW_START | TokenFlags.TABLECELL_START | TokenFlags.LINE_START];
                        }
                    }
                } else if (desiredFlag & TokenFlags.TABLEROW_START) {
                    if (container.nodeName === "TD" && childIndex === 0) {
                        const rowcol = getTableCellPosition(container as HTMLElement);
                        if (rowcol && rowcol[1] === 0) {
                            return [container as HTMLElement, childIndex, TokenFlags.TABLEROW_START | TokenFlags.TABLECELL_START | TokenFlags.LINE_START];
                        }
                    }
                } else if (desiredFlag & TokenFlags.TABLECELL_START) {
                    if (container.nodeName === "TD" && childIndex === 0) {
                        return [container as HTMLElement, childIndex, TokenFlags.TABLECELL_START | TokenFlags.LINE_START];
                    }
                } else if (desiredFlag & TokenFlags.LINE_START) {
                    if (childIndex === 0) {
                        if (BLOCK_ELEMENTS[container.nodeName]) {
                            return [container as HTMLElement, childIndex, TokenFlags.LINE_START];
                        }
                    } else {
                        const prev = container.childNodes[childIndex - 1];
                        if (prev.nodeName === "BR" || prev.nodeName === "HR" || BLOCK_ELEMENTS[prev.nodeName]) {
                            return [container as HTMLElement, childIndex, TokenFlags.LINE_START];
                        }
                    }
                }
            }

            if (container === endContainer && childIndex >= endOffset) {
                break;
            }

            if (!current) {
                current = container;
                container = container.parentNode!;
                isTextlessContainer = TEXTLESS_ELEMENTS[container.nodeName] || false;
                if (indexStack.length > 0) {
                    childIndex = indexStack.pop()!;
                } else {
                    childIndex = Array.prototype.indexOf.call(container.childNodes, current);
                }
                childIndex++;
                continue;
            }

            if (current.nodeType === 1 && !VOID_ELEMENTS[current.nodeName]) {
                // current의 자식 방향으로 탐색.
                indexStack.push(childIndex);
                container = current;
                isTextlessContainer = TEXTLESS_ELEMENTS[container.nodeName] || false;
                childIndex = 0;
                continue;
            }

            childIndex++;
        }

        return null;
    }

    #clampToSafeBoundary(
        range: Range,
        level: "table" | "tr" | "td" | "line",
        entryIndex: number,
        filledTokens: readonly RichToken[],
        filledSpan: { index: number; count: number },
        emptyTokens: readonly RichToken[],
        emptySpan: { index: number; count: number }
    ): Range | null {

        const entries = this.#entries!;
        let commonPrevFlags = 0;
        let commonNextFlags = 0;
        let emptyLast: RichToken;
        let emptyNext: RichToken;
        if (entryIndex > 0) {
            const prevEntry = entries[entryIndex - 1];
            if (prevEntry.type === 0) {
                const filledLast = filledTokens[filledSpan.index + filledSpan.count - 1];
                emptyLast = emptyTokens[emptySpan.index + emptySpan.count - 1];
                commonPrevFlags = (filledLast?.flags ?? 0) & (emptyLast?.flags ?? 0);
            }
        }
        if (entryIndex < entries.length) {
            const filledNext = filledTokens[filledSpan.index + filledSpan.count];
            emptyNext = emptyTokens[emptySpan.index];
            commonNextFlags = (filledNext?.flags ?? 0) & (emptyNext?.flags ?? 0);
        }

        let clampAfter: HTMLElement | null = null;
        let clampBefore: HTMLElement | null = null;

        if (level === "table") {
            if (commonPrevFlags & TokenFlags.TABLE_END) {
                const endNode = emptyLast!.range.endContainer;
                clampAfter = findClosestContainer(endNode, "table");
            }

            if (commonNextFlags & TokenFlags.TABLE_START) {
                const startNode = emptyNext!.range.startContainer;
                clampBefore = findClosestContainer(startNode, "table");
            }
        } else if (level === "tr") {
            if (commonPrevFlags & TokenFlags.TABLEROW_END) {
                const endNode = emptyLast!.range.endContainer;
                clampAfter = findClosestContainer(endNode, "tr");
            }
            if (commonNextFlags & TokenFlags.TABLEROW_START) {
                const startNode = emptyNext!.range.startContainer;
                clampBefore = findClosestContainer(startNode, "tr");
            }
        } else if (level === "td") {
            if (commonPrevFlags & TokenFlags.TABLECELL_END) {
                const endNode = emptyLast!.range.endContainer;
                clampAfter = findClosestContainer(endNode, "td");
            }
            if (commonNextFlags & TokenFlags.TABLECELL_START) {
                const startNode = emptyNext!.range.startContainer;
                clampBefore = findClosestContainer(startNode, "td");
            }
        } else if (level === "line") {

        }

        if (clampAfter || clampBefore) {
            const cloned = range.cloneRange();
            return clampRange(cloned, clampAfter, clampBefore);
        } else {
            return range;
        }
    }

    #buildDiffEntries() {
        const entries: RawDiff[] = [];
        const leftEntries: RawDiff[] = new Array(this.#leftTokens.length);
        const rightEntries: RawDiff[] = new Array(this.#rightTokens.length);

        const rawDiffs = this.#rawDiffs;
        let currentDiff: RawDiff | null = null;
        for (let i = 0; i < rawDiffs.length; i++) {
            const rawEntry = rawDiffs[i];
            const { left, right, type } = rawEntry;
            if (type) {
                if (currentDiff) {
                    console.assert(currentDiff.left.index + currentDiff.left.count === left.index, currentDiff, rawEntry);
                    console.assert(currentDiff.right.index + currentDiff.right.count === right.index, currentDiff, rawEntry);
                    currentDiff.type |= type;
                    currentDiff.left.count += left.count;
                    currentDiff.right.count += right.count;
                } else {
                    currentDiff = { left: { ...left }, right: { ...right }, type };
                }
            } else {
                if (currentDiff) {
                    entries.push(currentDiff);
                    for (let j = currentDiff.left.index; j < currentDiff.left.index + currentDiff.left.count; j++) {
                        leftEntries[j] = currentDiff;
                    }
                    for (let j = currentDiff.right.index; j < currentDiff.right.index + currentDiff.right.count; j++) {
                        rightEntries[j] = currentDiff;
                    }
                    currentDiff = null;
                }

                // type=0인 entry는 클론 없이 그냥 사용해도 된다. 바뀔 일이 전혀 없다.
                entries.push(rawEntry);
                for (let j = left.index; j < left.index + left.count; j++) {
                    leftEntries[j] = rawEntry;
                }
                for (let j = right.index; j < right.index + right.count; j++) {
                    rightEntries[j] = rawEntry;
                }
            }
        }
        if (currentDiff) {
            entries.push(currentDiff);
            for (let j = currentDiff.left.index; j < currentDiff.left.index + currentDiff.left.count; j++) {
                leftEntries[j] = currentDiff;
            }
            for (let j = currentDiff.right.index; j < currentDiff.right.index + currentDiff.right.count; j++) {
                rightEntries[j] = currentDiff;
            }
        }

        this.#entries = entries;
        this.#leftEntries = leftEntries;
        this.#rightEntries = rightEntries;
    }

    #buildSectionHeadingTree(editor: Editor, tokens: readonly RichToken[]): SectionHeading[] {
        const rootHeadings: SectionHeading[] = [];
        const stack: SectionHeading[] = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const headingFlag = token.flags & TokenFlags.SECTION_HEADING_MASK;
            if (!headingFlag) continue;

            const level = getHeadingLevelFromFlag(headingFlag);
            const ordinalText = token.text;
            const ordinalNum = parseOrdinalNumber(ordinalText);

            let titleEndTokenIndex = i;
            while (titleEndTokenIndex < tokens.length && (tokens[titleEndTokenIndex++].flags & TokenFlags.LINE_END) === 0);

            const tokenRange = editor.getTokenRange(i + 1, titleEndTokenIndex - i - 1);
            const title = tokenRange.toString();

            const heading: SectionHeading = {
                type: headingFlag,
                level,
                ordinalText,
                ordinalNum,
                title,
                parent: null,
                firstChild: null,
                nextSibling: null,
                startTokenIndex: i,
                endTokenIndex: Number.MAX_SAFE_INTEGER, // temp
            };

            while (stack.length > 0 && heading.level <= stack[stack.length - 1].level) {
                const closed = stack.pop()!;
                closed.endTokenIndex = heading.startTokenIndex;
            }

            if (stack.length === 0) {
                rootHeadings.push(heading);
            } else {
                const parent = stack[stack.length - 1];
                heading.parent = parent;
                if (!parent.firstChild) {
                    parent.firstChild = heading;
                } else {
                    let sibling = parent.firstChild;
                    while (sibling.nextSibling) sibling = sibling.nextSibling;
                    sibling.nextSibling = heading;
                }
            }

            stack.push(heading);
        }

        // 아직 닫히지 않은 것들은 문서 끝까지 범위로 간주
        for (const remaining of stack) {
            remaining.endTokenIndex = tokens.length;
        }

        return rootHeadings;
    }
}