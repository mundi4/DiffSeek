
import { Editor } from "../editor/editor";
import { extractRectsFromRange } from "./extract-rects-from-range";
import { mergeRects } from "./merge-rects";
import { Renderer } from "./renderer";
import { DIRTY_DIFF_HIGHLIGHT, DIRTY_GEOMETRY, DIRTY_RESIZE, DIRTY_SCROLL, DIRTY_SELECTION, RENDER_DIFF_LAYER, RENDER_HIGHLIGHT_LAYER, RENDER_MINIMAP, type DiffRenderItem, type Rect, type RectSet } from "./types";

export class EditorRegion {
    readonly renderer: Renderer;
    readonly editor: Editor;
    #diffs: DiffRenderItem[] = [];
    diffGeometries: RectSet[] = [];
    #diffLineRects: Rect[] = [];
    #selectionHighlight: Range | null = null;
    #selectionHighlightRects: RectSet | null = null;
    #visibleDiffIndices: Set<number> = new Set();
    #visibleDiffIndicesArr: number[] = [];
    #sortedDiffIndices: number[] = [];
    regionX: number = 0;
    regionY: number = 0;
    regionWidth: number = 0;
    regionHeight: number = 0;
    highlightedDiffIndex: number | null = null;
    #scrollTop: number = 0;

    constructor(renderer: Renderer, editor: Editor) {
        this.renderer = renderer;
        this.editor = editor;
    }

    updateLayout(): number {
        let { x, y, width, height } = this.editor.rootElement.getBoundingClientRect();
        const scrollTop = this.editor.rootElement.scrollTop;

        const renderer = this.renderer;
        x -= renderer.x;
        y -= renderer.y;

        let ret: number = 0;
        if (this.regionX !== x || this.regionY !== y || this.regionWidth !== width || this.regionHeight !== height) {
            renderer.invalidateGeometries(this.editor.name);
            ret = DIRTY_RESIZE;
        } else if (this.#scrollTop !== scrollTop) {
            renderer.invalidateScroll(this.editor.name);
            ret = DIRTY_SCROLL;
        }

        this.regionX = x;
        this.regionY = y;
        this.regionWidth = width;
        this.regionHeight = height;
        this.#scrollTop = scrollTop;

        return ret;
    }

    get name() {
        return this.editor.name;
    }

    get diffs() {
        return this.#diffs;
    }

    get diffLineRects() {
        return this.#diffLineRects;
    }

    get selectionHighlight() {
        return this.#selectionHighlight;
    }

    get selectionHighlightRects() {
        return this.#selectionHighlightRects;
    }

    get visibleDiffIndices() {
        return this.#visibleDiffIndices;
    }

    // markDirty(flags: RenderFlags) {
    // 	this.dirtyFlags |= flags;
    // }

    setDiffs(diffs: DiffRenderItem[]) {
        this.#diffs = diffs;
        this.diffGeometries.length = 0;
        this.#sortedDiffIndices.length = 0;
        this.#visibleDiffIndices.clear();
        this.#selectionHighlight = null;
        this.#selectionHighlightRects = null;
    }

    setHighlightedDiffIndex(diffIndex: number | null) {
        if (this.highlightedDiffIndex === diffIndex) {
            //return 0;
        }

        let wasShown = this.highlightedDiffIndex !== null && this.visibleDiffIndices.has(this.highlightedDiffIndex);
        let shouldShow = diffIndex !== null && (!this.diffGeometries[diffIndex] || this.visibleDiffIndices.has(diffIndex));
        this.highlightedDiffIndex = diffIndex;

        if (wasShown || shouldShow) {
            this.renderer.invalidateRegion(DIRTY_DIFF_HIGHLIGHT, this.editor.name);
            return DIRTY_DIFF_HIGHLIGHT;
        }

        return 0;
    }

    ensureGeometries() { }

    setSelectionHighlight(range: Range | null) {
        const current = this.#selectionHighlight;
        if (current === range) {
            return false; // No change
        }
        if (
            current &&
            range &&
            current.startContainer === range.startContainer &&
            current.endContainer === range.endContainer &&
            current.startOffset === range.startOffset &&
            current.endOffset === range.endOffset
        ) {
            return false; // No change in selection
        }

        this.#selectionHighlight = range;
        this.#selectionHighlightRects = null;
        this.renderer.invalidateRegion(DIRTY_SELECTION, this.editor.name);
    }

    prepare(dirtyFlags: number) {
        const scrollTop = this.#scrollTop = this.editor.rootElement.scrollTop;
        const scrollLeft = 0;

        const diffGeometries = this.diffGeometries;
        const visibleDiffIndices = this.#visibleDiffIndices;
        const diffs = this.#diffs;
        const newGeometryRects: Rect[] = [];

        visibleDiffIndices.clear();

        if (dirtyFlags & DIRTY_GEOMETRY) {
            diffGeometries.length = 0;
            this.#diffLineRects.length = 0;
            this.#sortedDiffIndices.length = 0;
        }

        const canvasX = this.renderer.x;
        const canvasY = this.renderer.y;
        const offsetTop = -this.regionY - canvasY + scrollTop;
        const offsetLeft = -this.regionX - canvasX + scrollLeft;
        const regionHeight = this.regionHeight;
        const { diffExpandX, diffExpandY } = this.renderer.options;

        for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
            let geometry = diffGeometries[diffIndex];
            if (!geometry) {
                // geometry 정보가 전혀 없음.
                // rough한 rect만 추출. 어차피 이 rect가 렌더 조건을 통과하게되면 더 정밀한 rect들을 추출하고 다시 테스트를 해봐야되므로 rough한 rect추출은 의미 없어보일 수 있지만
                // 문서가 크고 diff가 많은 경우은 확실히 이득이 있을 것이다. extractRects()는 정말 무거운 작업임.
                const diff = diffs[diffIndex];
                const wholeRect = diff.range.getBoundingClientRect();
                const x = wholeRect.x + offsetLeft - diffExpandX,
                    y = wholeRect.y + offsetTop - diffExpandY,
                    width = wholeRect.width + diffExpandX * 2,
                    height = wholeRect.height + diffExpandY * 2;
                diffGeometries[diffIndex] = geometry = {
                    minX: x,
                    minY: y,
                    maxX: x + width,
                    maxY: y + height,
                    rects: null,
                    // fillStyle: null,
                    // strokeStyle: null,
                };
            }
        }

        if (this.#sortedDiffIndices.length !== diffs.length) {
            const sorted = this.#sortedDiffIndices;
            sorted.length = diffs.length;
            for (let i = 0; i < diffs.length; i++) {
                sorted[i] = i;
            }
            sorted.sort((a, b) => {
                const ga = diffGeometries[a]!;
                const gb = diffGeometries[b]!;
                if (ga.minY !== gb.minY) return ga.minY - gb.minY;
                if (ga.maxY !== gb.maxY) return ga.maxY - gb.maxY;
                return a - b;
            });
        }

        for (const diffIndex of this.#sortedDiffIndices) {
            let geometry = diffGeometries[diffIndex]!;

            // minY 정렬 순회이므로, 뷰포트 하단을 넘어가면 이후는 전부 스킵 가능.
            if (geometry.minY - scrollTop > regionHeight) {
                break;
            }

            if (
                geometry.maxY - scrollTop < 0 ||
                geometry.maxX - scrollLeft < 0 ||
                geometry.minX - scrollLeft > this.regionWidth
            ) {
                // if (visibleDiffIndices.delete(diffIndex)) {
                // 	diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: false });
                // }
                continue;
            }

            // rough test를 통과했으므로 이제 완벽한 rects 필요.
            if (geometry.rects === null) {
                const rangeRects = extractRectsFromRange(
                    diffs[diffIndex].range,
                    offsetLeft,
                    offsetTop,
                    diffExpandX,
                    diffExpandY,
                    diffs[diffIndex].empty,
                );

                if (rangeRects.length > 0) {
                    for (const rect of rangeRects) {
                        newGeometryRects.push(rect);
                    }
                    diffGeometries[diffIndex] = mergeRects(rangeRects, 1, 1) as RectSet;
                    geometry = diffGeometries[diffIndex]!;
                } else {
                    // extractRectsFromRange가 빈 결과를 반환함 (range가 detach되었거나 일시적 렌더링 이슈).
                    // rects를 null로 유지하여 다음 prepare에서 재시도하도록 함.
                    // mergeRects([])는 minY: MAX_SAFE_INTEGER를 반환하여 정렬 순서를 오염시키므로 교체하면 안 됨.
                    if (import.meta.env.DEV) {
                        console.warn(`[EditorRegion:${this.editor.name}] extractRectsFromRange returned empty for diff ${diffIndex}`);
                    }
                }
            }

            for (const rect of geometry.rects!) {
                if (rect.y + rect.height - scrollTop < 0) continue;
                if (rect.y - scrollTop > regionHeight) break; // rect들은 y좌표로 정렬되어 있으므로 조기 탈출 가능.
                visibleDiffIndices.add(diffIndex);
                break;
            }
        }

        // 새로 만들어진 rect들에 대해서 line rect들을 만들어야함.
        if (newGeometryRects.length > 0) {
            this.#mergeIntoDiffLineRects(newGeometryRects);
        }

        // hittest용 visibleDiffIndices 배열인데... 의미가 있을까 싶지만(set에 대해 for of 루프를 돌려도되니까) 일단 그냥 냅둠.
        // 배열이 더 빠르지 않겠어? 특히 hittest는 마우스 움직이는 동안 매 프레임 발생해야하므로...
        const arr = this.#visibleDiffIndicesArr;
        arr.length = 0;
        let i = 0;
        for (const index of visibleDiffIndices) {
            arr[i++] = index;
        }
    }

    render(dirtyFlags: number) {
        if (dirtyFlags & RENDER_DIFF_LAYER) {
            this.renderDiffLayer(dirtyFlags);
        }

        if (dirtyFlags & RENDER_HIGHLIGHT_LAYER) {
            this.renderHighlightLayer(dirtyFlags);
        }
    }

    renderDiffLayer(dirtyFlags: number) {
        const options = this.renderer.options;
        const ctx = this.renderer.ctx;
        ctx.save();
        ctx.translate(this.regionX, this.regionY);
        if (dirtyFlags & RENDER_MINIMAP) {
            ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);
        } else {
            ctx.clearRect(0, 0, this.regionWidth - this.renderer.options.minimapWidth, this.regionHeight);
        }
        ctx.beginPath();
        ctx.rect(0, 0, this.regionWidth, this.regionHeight);
        ctx.clip();

        const diffGeometries = this.diffGeometries;
        const diffsToRender = this.#visibleDiffIndicesArr;
        // const diffVisibilityChangeEntries = this.diffVisibilityChangeEntries;
        // const visibleDiffIndices = this.#visibleDiffIndices;
        const diffs = this.#diffs;
        const scrollTop = this.#scrollTop;
        const scrollLeft = 0;//this.#scrollLeft + this.#renderer.workspaceEl.scrollLeft;
        const regionHeight = this.regionHeight;
        ctx.fillStyle = options.palette.diffLineColor;

        for (const diffLineRect of this.#diffLineRects) {
            const x = Math.floor(diffLineRect.x - scrollLeft),
                y = Math.floor(diffLineRect.y - scrollTop),
                width = Math.ceil(diffLineRect.width),
                height = Math.ceil(diffLineRect.height);

            if (y + height < 0) continue;
            if (y > regionHeight) break;
            ctx.fillRect(x, y, width, height);
        }

        for (const diffIndex of diffsToRender) {
            const geometry = diffGeometries[diffIndex]!;
            if (this.highlightedDiffIndex === diffIndex) {
                ctx.fillStyle = options.palette.highlightedDiffColor;
            } else {
                const item = diffs[diffIndex];
                ctx.fillStyle = item.color;
            }

            // let rendered = false;
            for (const rect of geometry.rects!) {
                const x = Math.floor(rect.x - scrollLeft),
                    y = Math.floor(rect.y - scrollTop),
                    width = Math.ceil(rect.width),
                    height = Math.ceil(rect.height);

                if (y + height < 0) continue;
                if (y > regionHeight) break;

                // ctx.strokeRect(x, y, width, height);
                ctx.fillRect(x, y, width, height);
                // rendered = true;
            }
        }

        if (dirtyFlags & RENDER_MINIMAP && this.diffGeometries.length > 0) {
            this.#renderMinimap(ctx);
        }

        ctx.restore();
    }

    #renderMinimap(ctx: CanvasRenderingContext2D) {
        const minimapWidth = this.renderer.options.minimapWidth;
        const scale = this.regionHeight / this.editor.rootElement.scrollHeight;

        type MiniSpan = {
            y: number;
            h: number;
        }

        //         const diff = diffs[diffIndex];
        // const wholeRect = diff.range.getBoundingClientRect();
        // const x = wholeRect.x + offsetLeft - diffExpandX,
        //     y = wholeRect.y + offsetTop - diffExpandY,
        //     width = wholeRect.width + diffExpandX * 2,
        //     height = wholeRect.height + diffExpandY * 2;
        // diffGeometries[diffIndex] = geometry = {
        //     minX: x,
        //     minY: y,
        //     maxX: x + width,
        //     maxY: y + height,
        //     rects: null,
        //     // fillStyle: null,
        //     // strokeStyle: null,
        // };
        const diffExpandY = this.renderer.options.diffExpandY;
        const roughSpans: MiniSpan[] = [];
        for (const geometry of this.diffGeometries) {
            const h = (geometry.maxY - geometry.minY - diffExpandY * 2) * scale;
            roughSpans.push({
                y: (geometry.minY + diffExpandY) * scale,
                h: h > 1 ? h : 1,
            });
        }
        roughSpans.sort((a, b) => a.y - b.y);

        const TOLERANCE = 1;
        ctx.fillStyle = this.renderer.options.palette.minimapDiffColor;

        let y0 = -Infinity;
        let h0 = 0;
        const x = this.regionWidth - minimapWidth;

        for (let i = 0; i < roughSpans.length; i++) {
            const { y, h } = roughSpans[i];
            if (y <= y0 + h0 + TOLERANCE) {
                const bottom = Math.max(y0 + h0, y + h);
                h0 = bottom - y0;
            } else {
                if (h0 > 0) {
                    ctx.fillRect(x, y0, minimapWidth, h0);
                }
                y0 = y;
                h0 = h;
            }
        }

        if (h0 > 0) {
            ctx.fillRect(x, y0, minimapWidth, h0);
        }
    }

    renderHighlightLayer(dirtyFlags: number) {
        const ctx = this.renderer.highlightCtx;
        ctx.save();
        ctx.translate(this.regionX, this.regionY);
        ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);
        ctx.beginPath();
        ctx.rect(0, 0, this.regionWidth, this.regionHeight);
        ctx.clip();

        const regionWidth = this.regionWidth;
        const regionHeight = this.regionHeight;
        const scrollTop = this.#scrollTop;
        const scrollLeft = 0;

        if (this.#selectionHighlight) {
            if (!this.#selectionHighlightRects || dirtyFlags & DIRTY_GEOMETRY) {
                const offsetX = -this.renderer.x - this.regionX + scrollLeft;
                const offsetY = -this.renderer.y - this.regionY + scrollTop;
                const rawRects = extractRectsFromRange(this.#selectionHighlight, offsetX, offsetY, 0, 0, false);
                const mergedRect = mergeRects(rawRects, 1, 1) as RectSet;
                this.#selectionHighlightRects = mergedRect;
            }

            let geometry = this.#selectionHighlightRects!;
            let isVisible =
                !(geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > regionHeight) &&
                !(geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > regionWidth);
            if (isVisible) {
                ctx.fillStyle = this.renderer.options.palette.selectionHighlightColor;
                for (const rect of geometry.rects!) {
                    const x = Math.floor(rect.x - scrollLeft),
                        y = Math.floor(rect.y - scrollTop),
                        width = Math.ceil(rect.width),
                        height = Math.ceil(rect.height);

                    if (y + height < 0) continue;
                    if (y > regionHeight) break;

                    ctx.fillRect(x, y, width, height);
                }
            }
        }

        ctx.restore();
    }

    #mergeIntoDiffLineRects(incoming: Rect[]): void {
        const TOLERANCE = 1;
        const regionWidth = this.regionWidth;
        const allRects: Rect[] = [];

        for (const rect of this.#diffLineRects) {
            allRects.push(rect);
        }

        const { diffLineHeightMultiplier, diffLineExpandY } = this.renderer.options;
        for (const rect of incoming) {
            const height = rect.height * diffLineHeightMultiplier + diffLineExpandY * 2;
            const heightDelta = height - rect.height;
            const y = rect.y - heightDelta / 2;

            allRects.push({
                x: 0,
                y,
                width: regionWidth - 16,
                height,
            });
        }

        allRects.sort((a, b) => a.y - b.y);
        this.#diffLineRects.length = 0;

        let current = allRects[0];
        for (let i = 1; i < allRects.length; i++) {
            const next = allRects[i];
            const gap = next.y - (current.y + current.height);

            if (gap <= TOLERANCE) {
                const newBottom = Math.max(current.y + current.height, next.y + next.height);
                current = {
                    x: 0,
                    y: current.y,
                    width: current.width,
                    height: newBottom - current.y,
                };
            } else {
                this.#diffLineRects.push(current);
                current = next;
            }
        }
        this.#diffLineRects.push(current);
    }

    hitTest(x: number, y: number) {
        x += 0;
        y += this.#scrollTop;

        for (const diffIndex of this.#visibleDiffIndicesArr) {
            const geometry = this.diffGeometries[diffIndex];
            if (geometry && geometry.rects) {
                for (const rect of geometry.rects) {
                    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
                        return diffIndex;
                    }
                }
            }
        }
        return null;
    }

    getDiffRect(diffIndex: number): Rect | null {
        const geometry = this.diffGeometries[diffIndex];
        if (geometry) {
            return {
                x: geometry.minX,
                y: geometry.minY,
                width: geometry.maxX - geometry.minX,
                height: geometry.maxY - geometry.minY,
            };
        }
        return null;
    }

    // private extractRectsFromRange(range: Range, offsetLeft: number, offsetTop: number, expandX = 0, expandY = 0, emptyDiff = false): Rect[] {
    //     const result: Rect[] = [];
    //     const tempRange = document.createRange();
    //     let startNode: Node | null;

    //     if (
    //         emptyDiff &&
    //         range.startContainer.nodeType === 1 &&
    //         range.startContainer === range.endContainer && range.startOffset + 1 === range.endOffset) {
    //         const diffEl = range.startContainer.childNodes[range.startOffset] as HTMLElement;

    //         // diffEl.classList.add("extracting");
    //         // void diffEl.offsetWidth; // force reflow
    //         const tempText = diffEl.firstChild!;
    //         tempRange.selectNodeContents(tempText);

    //         for (const rect of tempRange.getClientRects()) {
    //             result.push({
    //                 x: rect.x + offsetLeft - expandX,
    //                 y: rect.y + offsetTop - expandY,
    //                 width: rect.width + expandX * 2,
    //                 height: rect.height + expandY * 2,
    //             });
    //         }
    //         // diffEl.classList.remove("extracting");

    //         return result;
    //     }

    //     if (range.startContainer.nodeType === 3) {
    //         tempRange.setStart(range.startContainer, range.startOffset);
    //         if (emptyDiff) {
    //             tempRange.collapse(true);
    //         } else {
    //             if (range.startContainer === range.endContainer) {
    //                 tempRange.setEnd(range.startContainer, range.endOffset);
    //             } else {
    //                 tempRange.setEnd(range.startContainer, range.startContainer.nodeValue!.length);
    //             }
    //         }
    //         for (const rect of tempRange.getClientRects()) {
    //             result.push({
    //                 x: rect.x + offsetLeft - expandX,
    //                 y: rect.y + offsetTop - expandY,
    //                 width: rect.width + expandX * 2,
    //                 height: rect.height + expandY * 2,
    //             });
    //             if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
    //         }
    //         startNode = advanceNode(range.startContainer)!;
    //     } else {
    //         startNode = range.startContainer.childNodes[range.startOffset] ?? advanceNode(range.startContainer, null, true);

    //         if (!startNode) return result;
    //     }

    //     const endContainer = range.endContainer;
    //     let endOffset: number;
    //     let endNode: Node;
    //     if (endContainer.nodeType === 3) {
    //         endNode = endContainer;
    //         endOffset = range.endOffset;
    //     } else {
    //         endNode = endContainer.childNodes[range.endOffset] ?? advanceNode(endContainer, null, true)!;
    //         endOffset = -1;
    //     }

    //     if (!startNode || !endNode || endNode.compareDocumentPosition(startNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
    //         return result;
    //     }

    //     const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
    //     walker.currentNode = startNode;

    //     do {
    //         const node = walker.currentNode;
    //         if (!node) break;

    //         if (node === endNode) {
    //             if (node.nodeType === 3 && endOffset >= 0) {
    //                 tempRange.setStart(endNode, 0);
    //                 if (emptyDiff) {
    //                     tempRange.collapse(true);
    //                 } else {
    //                     tempRange.setEnd(endNode, endOffset);
    //                 }
    //                 for (const rect of tempRange.getClientRects()) {
    //                     result.push({
    //                         x: rect.x + offsetLeft - expandX,
    //                         y: rect.y + offsetTop - expandY,
    //                         width: rect.width + expandX * 2,
    //                         height: rect.height + expandY * 2,
    //                     });
    //                     if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
    //                 }
    //             }
    //             break;
    //         }

    //         if (node.nodeType === 3) {
    //             tempRange.selectNodeContents(node);
    //             for (const rect of tempRange.getClientRects()) {
    //                 result.push({
    //                     x: rect.x + offsetLeft - expandX,
    //                     y: rect.y + offsetTop - expandY,
    //                     width: rect.width + expandX * 2,
    //                     height: rect.height + expandY * 2,
    //                 });
    //             }
    //         } else if (node.nodeName === "BR") {
    //             // no-op
    //         } else if (node.nodeName === DIFF_TAG_NAME) {
    //             if (emptyDiff) {
    //                 const tempText = document.createTextNode("\u200B");
    //                 node.appendChild(tempText);
    //                 tempRange.selectNodeContents(tempText);
    //                 for (const rect of tempRange.getClientRects()) {
    //                     result.push({
    //                         x: rect.x + offsetLeft - expandX,
    //                         y: rect.y + offsetTop - expandY,
    //                         width: rect.width + expandX * 2,
    //                         height: rect.height + expandY * 2,
    //                     });
    //                 }
    //                 tempText.remove();
    //             } else {
    //                 // if ((node as HTMLElement).classList.contains(MANUAL_ANCHOR_CLASS_NAME)) {
    //                 //     tempRange.selectNode(node as HTMLElement);
    //                 //     for (const rect of (node as HTMLElement).getClientRects()) {
    //                 //         result.push({
    //                 //             x: rect.x + offsetLeft - expandX,
    //                 //             y: rect.y + offsetTop - expandY,
    //                 //             width: rect.width + expandX * 2,
    //                 //             height: rect.height + expandY * 2,
    //                 //         });
    //                 //     }
    //                 // }
    //             }
    //         } else if (node.nodeName === "IMG") {
    //             tempRange.selectNode(node);
    //             for (const rect of tempRange.getClientRects()) {
    //                 result.push({
    //                     x: rect.x + offsetLeft - expandX,
    //                     y: rect.y + offsetTop - expandY,
    //                     width: rect.width + expandX * 2,
    //                     height: rect.height + expandY * 2,
    //                 });
    //             }
    //         }
    //     } while (walker.nextNode());

    //     return result;
    // }
}