// die. just die.

type CharMap = Record<string, string>;
const DINGBAT_CHAR_MAP: Record<string, CharMap> = {
    wingdings: {
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
    },
    ["wingdings 2"]: {
        "\x3F": "🖙",
        "\x9F": "⬝",
        "\xA0": "▪",
        "\xA1": "■",
        "\xF8": "※",
    },
    ["wingdings 3"]: {
        "\x33": "→", "\x34": "←", "\x35": "↑", "\x36": "↓",
        "\x39": "↔", "\x3A": "↕",
        "\x41": "▶", "\x42": "◀", "\x43": "▲", "\x44": "▼",
    },
    symbol: {
        "\xAB": "↔",
        "\xAC": "←",
        "\xAD": "↑",
        "\xAE": "→",
        "\xAF": "↓",
    },
};

export type DingbatFont = keyof typeof DINGBAT_CHAR_MAP;

export function resolveFont(el: HTMLElement): DingbatFont | "NORMAL" | null {
    const raw = el.style?.fontFamily || (el.nodeName === "FONT" ? el.getAttribute("face") || "" : "");
    if (!raw || raw === "inherit") return null;
    const fam = normalizeFont(raw);
    return DINGBAT_CHAR_MAP[fam] ? fam : "NORMAL";
}

export function transformDingbatText(input: string, font: DingbatFont): string {
    const charMap = DINGBAT_CHAR_MAP[font];
    let result = "";
    for (const ch of input) {
        result += charMap[ch] || ch;
    }
    return result;
}

function normalizeFont(raw: string) {
    let s = raw.split(",")[0].trim();
    s = s.replace(/^['"]+|['"]+$/g, "").toLowerCase();
    return s;
}
