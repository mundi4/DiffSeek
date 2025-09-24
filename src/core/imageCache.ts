
import { quickHash53 } from "@/utils/quickHash53ToString";
import { fetchImageDataUsingExtension } from "./ext-helper";
import { ABORT_REASON_CANCELLED } from "./constants";

const IMAGE_SIZE = 400;

export type ImageLoadResult = {
    src: string;
    hash?: string;
    dataUrl?: string;
    data?: ImageDataArray;
    width?: number;
    height?: number;
    promise?: Promise<void>;
}

const globalHashMap = new Map<string, ImageLoadResult>();

async function scaleAndExtract(source: string | HTMLImageElement, width: number, height: number, cancellable: AbortSignal) {
    let img: HTMLImageElement;
    if (typeof source === "string") {
        img = new Image();
        img.crossOrigin = "anonymous";
        img.src = source;
    } else {
        img = source;
    }

    if (!img.complete) {
        // console.log("Waiting for image to load...", img.src.slice(0, 20));
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
        });
    }

    cancellable.throwIfAborted();

    const canvas = new OffscreenCanvas(IMAGE_SIZE, IMAGE_SIZE);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Failed to create OffscreenCanvasRenderingContext2D");
    }

    ctx.drawImage(img, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    return ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
}


async function doLoad(result: ImageLoadResult, img: HTMLImageElement, src: string, cancellable: AbortSignal) {
    const srcIsDataUrl = src.startsWith("data:");

    if (!result.hash || !result.dataUrl) {
        let dataUrl: string;

        if (srcIsDataUrl) {
            dataUrl = src;
        } else {
            dataUrl = await fetchImageDataUsingExtension(src);
            cancellable.throwIfAborted();
        }

        const hash = quickHash53(dataUrl);
        // if (cancellable.cancelled) {
        //     return;
        // }

        result.hash = hash;
        result.dataUrl = dataUrl;
    }

    if (!srcIsDataUrl) {
        img.dataset.hash = result.hash;
        img.src = result.dataUrl;
        img.crossOrigin = "anonymous";
    }

    const imageData = await scaleAndExtract(img, IMAGE_SIZE, IMAGE_SIZE, cancellable);
    result.data = imageData.data;
    result.width = imageData.width;
    result.height = imageData.height;

    // 성공한 경우에만 저장
    globalHashMap.set(result.hash, result);
}


function load(img: HTMLImageElement, cancellable: AbortSignal, srcCache: Record<string, ImageLoadResult>): ImageLoadResult {
    // srcCache는 session, context 단위임.

    const src = img.src;
    let result: ImageLoadResult | undefined = srcCache[src];

    // 이번 세션에서 해당 src로 시도한 적이 있다면 실패든 성공이든 무시하고 리턴함.
    if (result) {
        return result;
    }

    let hash = img.dataset.hash;
    result = hash ? globalHashMap.get(hash) : undefined;
    if (result) {
        return result;
    }

    result = {
        src,
    };

    if (!result.promise || !result.data || !result.hash) {
        result.promise = doLoad(result, img, src, cancellable).catch((err) => {
            if (err !== ABORT_REASON_CANCELLED) {
                console.warn("Image load failed:", err, src.slice(0, 40));
            }
        });
    }

    srcCache[src] = result;
    return result;
}

export function clearImageCache(using: Set<string>) {
    for (const key of globalHashMap.keys()) {
        if (!using.has(key)) {
            globalHashMap.delete(key);
        }
    }
}

export function createImageLoader() {
    const srcCache: Record<string, ImageLoadResult> = {};
    return {
        load: (img: HTMLImageElement, cancellable: AbortSignal) => load(img, cancellable, srcCache),
        clear: (using: Set<string>) => clearImageCache(using),
    }
}

export function dumpImageCache() {
    // console.log("Image cache dump:");
    // for (const [key, value] of hashMap.entries()) {
    //     console.log(key, value);
    // }
}
