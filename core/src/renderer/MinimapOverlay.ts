// import { Rect } from "../types";


// export type MinimapViewport = {
//     getScrollTop(): number;
//     getScrollHeight(): number;
//     getClientHeight(): number;
// };

// export type MinimapInputs = {
//     enabled: boolean;
//     minimapEl: HTMLElement | null;
//     rendererEl: HTMLElement;
//     rendererWidth: number;
//     rendererHeight: number;

//     deck: MinimapViewport;

//     leftDiffGeometries: Array<{ minY: number; maxY: number }>;
//     rightDiffGeometries: Array<{ minY: number; maxY: number }>;
// };

// export type MinimapPaint = {
//     rect: Rect;
//     scale: number;
//     mergedMarkers: Rect[];
//     viewportWindow: Rect;
// };

// export class MinimapOverlay {
//     #paint: MinimapPaint | null = null;

//     get paint() {
//         return this.#paint;
//     }

//     compute(inputs: MinimapInputs): MinimapPaint | null {
//         if (!inputs.enabled) return (this.#paint = null);
//         const minimapEl = inputs.minimapEl;
//         if (!minimapEl) return (this.#paint = null);

//         const mmRectAbs = minimapEl.getBoundingClientRect();
//         const rRectAbs = inputs.rendererEl.getBoundingClientRect();

//         const mmRect: Rect = {
//             x: mmRectAbs.x - rRectAbs.x,
//             y: mmRectAbs.y - rRectAbs.y,
//             width: mmRectAbs.width,
//             height: mmRectAbs.height,
//         };

//         const scrollHeight = inputs.deck.getScrollHeight();
//         const clientHeight = inputs.deck.getClientHeight();
//         const scrollTop = inputs.deck.getScrollTop();

//         if (scrollHeight <= 0 || mmRect.height <= 0) return (this.#paint = null);

//         const scale = mmRect.height / scrollHeight;

//         const allRects: Rect[] = [];
//         const pushGeom = (g: { minY: number; maxY: number }) => {
//             const y = g.minY * scale;
//             const h = Math.max(1, (g.maxY - g.minY) * scale);
//             allRects.push({
//                 x: mmRect.x,
//                 y: mmRect.y + y,
//                 width: mmRect.width,
//                 height: h,
//             });
//         };

//         for (const g of inputs.leftDiffGeometries) pushGeom(g);
//         for (const g of inputs.rightDiffGeometries) pushGeom(g);

//         const mergedMarkers = this.#mergeVertical(allRects, 0, 2);

//         const viewportWindow: Rect = {
//             x: mmRect.x,
//             y: mmRect.y + scrollTop * scale,
//             width: mmRect.width,
//             height: Math.max(2, clientHeight * scale),
//         };

//         const paint: MinimapPaint = {
//             rect: mmRect,
//             scale,
//             mergedMarkers,
//             viewportWindow,
//         };

//         this.#paint = paint;
//         return paint;
//     }

//     render(ctx: CanvasRenderingContext2D, paint: MinimapPaint | null) {
//         if (!paint) return;

//         const { rect, mergedMarkers, viewportWindow } = paint;

//         ctx.save();

//         ctx.clearRect(rect.x, rect.y, rect.width, rect.height);

//         ctx.fillStyle = "rgba(0,0,0,0.06)";
//         ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

//         ctx.fillStyle = "rgba(255,0,0,0.6)";
//         for (const r of mergedMarkers) {
//             ctx.fillRect(r.x, r.y, r.width, r.height);
//         }

//         ctx.strokeStyle = "rgba(0,0,0,0.35)";
//         ctx.lineWidth = 1;
//         ctx.strokeRect(
//             Math.floor(viewportWindow.x) + 0.5,
//             Math.floor(viewportWindow.y) + 0.5,
//             Math.floor(viewportWindow.width),
//             Math.floor(viewportWindow.height)
//         );

//         ctx.restore();
//     }

//     #mergeVertical(rects: Rect[], tolX: number, tolY: number): Rect[] {
//         if (rects.length === 0) return [];

//         rects.sort((a, b) => a.y - b.y);

//         const out: Rect[] = [];
//         let cur = rects[0];

//         for (let i = 1; i < rects.length; i++) {
//             const next = rects[i];
//             const gapY = next.y - (cur.y + cur.height);

//             if (gapY <= tolY) {
//                 const bottom = Math.max(cur.y + cur.height, next.y + next.height);
//                 cur = {
//                     x: cur.x,
//                     y: cur.y,
//                     width: Math.max(cur.width, next.width),
//                     height: bottom - cur.y,
//                 };
//             } else {
//                 out.push(cur);
//                 cur = next;
//             }
//         }

//         out.push(cur);
//         return out;
//     }
// }
