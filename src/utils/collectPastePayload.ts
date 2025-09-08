// type PastePayload = {
//     html?: string;
//     text?: string;
//     files: File[];
// };

// export async function collectPastePayload(
//     opts:
//         | { fromEvent: ClipboardEvent }
//         | { fromSystem: true; plaintextOnly?: boolean }
// ): Promise<PastePayload> {
//     const files: File[] = [];
//     let html = "";
//     let text = "";

//     if ("fromEvent" in opts) {
//         const dt = opts.fromEvent.clipboardData!;
//         html = dt.getData("text/html");
//         text = dt.getData("text/plain");
//         for (const it of dt.items) {
//             if (it.kind === "file") {
//                 const f = it.getAsFile();
//                 if (f) files.push(f);
//             }
//         }
//     } else {
//         // navigator.clipboard.read()
//         const items = await navigator.clipboard.read();
//         // 1) html 우선 (옵션)
//         if (!opts.plaintextOnly) {
//             for (const it of items) {
//                 if (it.types.includes("text/html")) {
//                     html = await (await it.getType("text/html")).text();
//                     break;
//                 }
//             }
//         }
//         // 2) plain fallback
//         if (!html) {
//             for (const it of items) {
//                 if (it.types.includes("text/plain")) {
//                     text = await (await it.getType("text/plain")).text();
//                     break;
//                 }
//             }
//         }
//         // 3) 파일 수집
//         for (const it of items) {
//             for (const t of it.types) {
//                 if (t.startsWith("image/")) {
//                     const blob = await it.getType(t);
//                     // ClipboardItem→Blob엔 name이 없을 수 있으니 가짜 이름 부여
//                     const f = new File([blob], `clip-${crypto.randomUUID()}.${t.split("/")[1]}`, { type: t });
//                     files.push(f);
//                 }
//             }
//         }
//     }

//     return { html: html || undefined, text: text || undefined, files };
// }
