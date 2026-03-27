import { ABORT_REASON_CANCELLED } from "../constants";

export async function nextAnimationFrame(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
            if (signal?.aborted) {
                reject(ABORT_REASON_CANCELLED);
                return;
            }
            resolve();
        });
    });
}
