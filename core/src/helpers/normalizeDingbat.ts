
const DINGBAT_TRANSFORM: Record<string, Record<string, string>> = {
    ["wingdings"]: {
        "\u00DF": "🡠",
        "\u00E0": "🡢",
        "\u00E1": "🡡",
        "\u00E2": "🡣",
        "\u00E3": "🡤",
        "\u00E4": "🡥",
        "\u00E5": "🡧",
        "\u00E6": "🡦",
        "\u00E7": "🡠",
        "\u00E8": "🡢",
        "\u00E9": "🡡",
        "\u00EA": "🡣",
        "\u00EB": "🡤",
        "\u00EC": "🡥",
        "\u00ED": "🡧",
        "\u00EE": "🡦",
        "\u0080": "⓪",
        "\u0081": "①",
        "\u0082": "②",
        "\u0083": "③",
        "\u0084": "④",
        "\u0085": "⑤",
        "\u0086": "⑥",
        "\u0087": "⑦",
        "\u0088": "⑧",
        "\u0089": "⑨",
        "\u008A": "⑩",
        "\u008B": "⓿",
        "\u008C": "❶",
        "\u008D": "❷",
        "\u008E": "❸",
        "\u008F": "❹",
        "\u0090": "❺",
        "\u0091": "❻",
        "\u0092": "❼",
        "\u0093": "❽",
        "\u0094": "❾",
        "\u0095": "❿",
        "\x9E": "·",
        "\x9F": "•",
        "\xA0": "▪",
        "\xA2": "🞆",
        "\xA4": "◉",
        "\xA5": "◎",
    } as const,
    ["wingdings 2"]: {
        "\x3F": "🖙",
        "\x9F": "⬝",
        "\xA0": "▪",
        "\xA1": "■",
        "\xF8": "※",
    } as const,
    ["wingdings 3"]: {
        "\x33": "→", "\x34": "←", "\x35": "↑", "\x36": "↓",
        "\x39": "↔", "\x3A": "↕",
        "\x41": "▶", "\x42": "◀", "\x43": "▲", "\x44": "▼",
    } as const,
    ["symbol"]: {
        "\xAB": "↔",
        "\xAC": "←",
        "\xAD": "↑",
        "\xAE": "→",
        "\xAF": "↓",
    } as const,
} as const;

function extractFontFamilyName(raw: string | null | undefined): string | null {
    if (!raw) return null;

    let s = raw;
    const comma = s.indexOf(",");
    if (comma >= 0) s = s.slice(0, comma);

    s = s.trim();
    const n = s.length;
    if (n >= 2) {
        const a = s.charCodeAt(0);
        const b = s.charCodeAt(n - 1);
        if ((a === 34 && b === 34) || (a === 39 && b === 39)) {
            s = s.slice(1, n - 1).trim();
        }
    }

    s = s.toLowerCase();
    return s.length ? s : null;
}

export function resolveDingbatFontName(node: HTMLElement, prev: string | null): string | null {
    const el = node as HTMLElement;

    const raw = el.style?.fontFamily || (node.nodeName === "FONT" ? el.getAttribute("face") || "" : "");
    const fam = extractFontFamilyName(raw);

    if (!fam || fam === "inherit") return prev;
    return DINGBAT_TRANSFORM[fam] ? fam : null;
}

export function normalizeDingbatChar(input: string, font: keyof typeof DINGBAT_TRANSFORM): string {
    // 대부분의 경우이 이 특수문자는 한번에 한개씩... 즉 input 자체가 짧음.
    const charMap = DINGBAT_TRANSFORM[font];
    let result = "";
    for (let i = 0; i < input.length; i++) {
        const ch = input[i]!;
        result += charMap[ch] || ch;
    }
    return result;
}