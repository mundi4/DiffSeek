// sanitizeWordVMLPairs_safe.ts
// 목적: Word의 VML 도형 중 글상자(v:textbox)만 텍스트 추출.
//       다른 부분은 절대 건드리지 않음. 파싱 실패 시 원본 유지.

export function sanitizeWordVMLPairs(html: string): string {
    let i = 0;
    const len = html.length;
    const out: string[] = [];

    while (i < len) {
        const startIdx = html.indexOf("<!--[if gte vml 1]>", i);
        if (startIdx === -1) {
            out.push(html.slice(i));
            break;
        }

        // 이전 구간 그대로 복사
        out.push(html.slice(i, startIdx));
        const endIdx = html.indexOf("<![endif]-->", startIdx);
        if (endIdx === -1) {
            // 닫힘 없음 → 포기하고 그대로 둔다
            out.push(html.slice(startIdx));
            break;
        }

        const block = html.slice(startIdx, endIdx + 12);
        const safeResult = tryExtractTextbox(block);
        if (safeResult === null) {
            // 추출 실패 → 원본 유지
            out.push(block);
        } else {
            // 텍스트 + 폴백 이미지가 뒤에 붙는 경우를 위해 그대로 둔다
            out.push(`<div data-origin="word-textbox">${safeResult}</div>`);
        }

        i = endIdx + 12;
    }

    return out.join("");
}

// 내부 보조 함수: v:textbox 내부의 순수 텍스트 추출
function tryExtractTextbox(block: string): string | null {
    try {
        // mso 영역과 table 제거
        const clean = block
            .replace(/<!\[if\s*!mso\]>[\s\S]*?<!\[endif\]>/gi, "")
            .replace(/<!--\[if\s*!mso\]-->[\s\S]*?<!--\[endif\]-->/gi, "");

        const vtextboxStart = clean.search(/<v:textbox[^>]*>/i);
        const vtextboxEnd = clean.search(/<\/v:textbox>/i);
        if (vtextboxStart === -1 || vtextboxEnd === -1 || vtextboxEnd < vtextboxStart) {
            return null; // 불완전 → 포기
        }

        const inner = clean.slice(vtextboxStart, vtextboxEnd);
        const divMatch = inner.match(/<div[^>]*>([\s\S]*?)<\/div>/i);
        if (!divMatch) return null;

        // innerText 부분 추출, 태그 제거는 안 함 (sanitizeHTML에서 후처리)
        const extracted = divMatch[1].trim();
        if (!extracted) return null;

        return extracted;
    } catch {
        return null; // 예외 → 원본 유지
    }
}
