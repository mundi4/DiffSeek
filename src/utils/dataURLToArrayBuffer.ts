export function dataURLToArrayBuffer(dataURL: string): ArrayBuffer {
    const comma = dataURL.indexOf(",");
    if (comma === -1) throw new Error("Invalid dataURL");
    const base64 = dataURL.slice(comma + 1); // 헤더 스킵
    const binary = atob(base64);             // base64 → binary
    const len = binary.length;
    const buf = new ArrayBuffer(len);
    const view = new Uint8Array(buf);
    for (let i = 0; i < len; i++) {
        view[i] = binary.charCodeAt(i);
    }
    return buf;
}
