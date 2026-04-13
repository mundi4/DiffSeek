// normalizedCharMap LUT (BMP 1:1 only)
// encoding: lut[srcCode] = dstCode
export const NormalizeCharTable = new Uint16Array(0x10000);

for (let i = 0; i < NormalizeCharTable.length; i++) {
	NormalizeCharTable[i] = i;
}

// fullwidth digits -> ascii digits
for (let i = 0; i <= 9; i++) {
	NormalizeCharTable[0xff10 + i] = 0x0030 + i; // '０'~'９' -> '0'~'9'
}

// hyphen/minus variants -> '-'
NormalizeCharTable[0x2010] = 0x002d; // '‐' -> '-'
NormalizeCharTable[0x2012] = 0x002d; // '‒' -> '-'
NormalizeCharTable[0x2013] = 0x002d; // '–' -> '-'
NormalizeCharTable[0x2014] = 0x002d; // '—' -> '-'
NormalizeCharTable[0x2015] = 0x002d; // '―' -> '-'
NormalizeCharTable[0xfe58] = 0x002d; // '﹘' -> '-'
NormalizeCharTable[0xff0d] = 0x002d; // '－' -> '-'
NormalizeCharTable[0xfe63] = 0x002d; // '﹣' -> '-'
NormalizeCharTable[0x2500] = 0x002d; // '─' -> '-'
NormalizeCharTable[0x2e3a] = 0x002d; // '⸺' -> '-'

// dot variants -> '.'
NormalizeCharTable[0x2024] = 0x002e; // '․' -> '.'
NormalizeCharTable[0xff0e] = 0x002e; // '．' -> '.'

// comma variants -> ','
NormalizeCharTable[0xff0c] = 0x002c; // '，' -> ','
NormalizeCharTable[0xff64] = 0x002c; // '､' -> ','

// middle dot variants -> '·'
NormalizeCharTable[0x22c5] = 0x00b7; // '⋅' -> '·'
NormalizeCharTable[0x2219] = 0x00b7; // '∙' -> '·'
NormalizeCharTable[0x318d] = 0x00b7; // 'ㆍ' -> '·'
NormalizeCharTable[0x2027] = 0x00b7; // '‧' -> '·'
NormalizeCharTable[0x2022] = 0x00b7; // '•' -> '·'
NormalizeCharTable[0x25cf] = 0x00b7; // '●' -> '·'

// circled dot variants -> '⊙'
NormalizeCharTable[0x25c9] = 0x2299; // '◉' -> '⊙'
NormalizeCharTable[0x25ce] = 0x2299; // '◎' -> '⊙'
NormalizeCharTable[0x29bf] = 0x2299; // '⦿' -> '⊙'

// small circle variants -> '∘'
NormalizeCharTable[0x25e6] = 0x2218; // '◦' -> '∘'
NormalizeCharTable[0x25cb] = 0x2218; // '○' -> '∘'
NormalizeCharTable[0x3147] = 0x2218; // 'ㅇ' -> '∘'

// square bullet variants -> '■'
NormalizeCharTable[0x25aa] = 0x25a0; // '▪' -> '■'
NormalizeCharTable[0x25fc] = 0x25a0; // '◼' -> '■'

// empty square variants -> '□'
NormalizeCharTable[0x25ab] = 0x25a1; // '▫' -> '□'
NormalizeCharTable[0x25fb] = 0x25a1; // '◻' -> '□'
NormalizeCharTable[0x2610] = 0x25a1; // '☐' -> '□'

// ellipsis variants -> '…'
NormalizeCharTable[0x22ef] = 0x2026; // '⋯' -> '…'

// fullwidth parens -> ascii parens
NormalizeCharTable[0xff08] = 0x0028; // '（' -> '('
NormalizeCharTable[0xff09] = 0x0029; // '）' -> ')'

// fullwidth brackets -> ascii brackets
NormalizeCharTable[0xff3b] = 0x005b; // '［' -> '['
NormalizeCharTable[0xff3d] = 0x005d; // '］' -> ']'

// fullwidth braces -> ascii braces
NormalizeCharTable[0xff5b] = 0x007b; // '｛' -> '{'
NormalizeCharTable[0xff5d] = 0x007d; // '｝' -> '}'

// fullwidth angle brackets -> ascii
NormalizeCharTable[0xff1c] = 0x003c; // '＜' -> '<'
NormalizeCharTable[0xff1e] = 0x003e; // '＞' -> '>'

// equals variants -> '='
NormalizeCharTable[0xff1d] = 0x003d; // '＝' -> '='
NormalizeCharTable[0xfe66] = 0x003d; // '﹦' -> '='
NormalizeCharTable[0x2261] = 0x003d; // '≡' -> '='
NormalizeCharTable[0x2248] = 0x003d; // '≈' -> '='

// plus variants -> '+'
NormalizeCharTable[0xff0b] = 0x002b; // '＋' -> '+'
NormalizeCharTable[0xfe62] = 0x002b; // '﹢' -> '+'
NormalizeCharTable[0x2722] = 0x002b; // '✢' (FOUR TEARDROP-SPOKED ASTERISK) -> '*'
NormalizeCharTable[0x2723] = 0x002b; // '✣' (FOUR BALLOON-SPOKED ASTERISK) -> '*'

// asterisk/multiply variants -> '*'
NormalizeCharTable[0xff0a] = 0x002a; // '＊' -> '*'
NormalizeCharTable[0x2731] = 0x002a; // '✱' -> '*'
NormalizeCharTable[0x00d7] = 0x002a; // '×' -> '*'
NormalizeCharTable[0x2217] = 0x002a; // '∗' -> '*'
NormalizeCharTable[0x2715] = 0x002a; // '✕' -> '*'
NormalizeCharTable[0x2716] = 0x002a; // '✖' -> '*'
NormalizeCharTable[0x204e] = 0x002a; // '⁎' (LOW ASTERISK) -> '*'
NormalizeCharTable[0x2051] = 0x002a; // '⁑' (TWO ASTERISKS ALIGNED VERTICALLY) -> '*'
NormalizeCharTable[0x2219] = 0x002a; // '∙' (BULLET OPERATOR, sometimes used as asterisk) -> '*'
NormalizeCharTable[0x2724] = 0x002a; // '✤' (HEAVY FOUR BALLOON-SPOKED ASTERISK) -> '*'
NormalizeCharTable[0x2725] = 0x002a; // '✥' (FOUR CLUB-SPOKED ASTERISK) -> '*'
NormalizeCharTable[0x2732] = 0x002a; // '✲' (OPEN CENTRE ASTERISK) -> '*'
NormalizeCharTable[0x2733] = 0x002a; // '✳' (EIGHT SPOKED ASTERISK) -> '*'
NormalizeCharTable[0x273a] = 0x002a; // '✺' (SIXTEEN POINTED ASTERISK) -> '*'
NormalizeCharTable[0x273b] = 0x002a; // '✻' (TEARDROP-SPOKED ASTERISK) -> '*'
NormalizeCharTable[0x273c] = 0x002a; // '✼' (OPEN CENTRE TEARDROP-SPOKED ASTERISK) -> '*'
NormalizeCharTable[0x273d] = 0x002a; // '✽' (HEAVY TEARDROP-SPOKED ASTERISK) -> '*'
NormalizeCharTable[0x2743] = 0x002a; // '❃' (HEAVY TEARDROP-SPOKED PINWHEEL ASTERISK) -> '*'
NormalizeCharTable[0x2749] = 0x002a; // '❉' (BALLOON-SPOKED ASTERISK) -> '*'
NormalizeCharTable[0x274a] = 0x002a; // '❊' (EIGHT TEARDROP-SPOKED PROPELLER ASTERISK) -> '*'
NormalizeCharTable[0x274b] = 0x002a; // '❋' (HEAVY EIGHT TEARDROP-SPOKED PROPELLER ASTERISK) -> '*'
NormalizeCharTable[0x29c6] = 0x002a; // '⧆' (SQUARED ASTERISK) -> '*'
NormalizeCharTable[0x2a6e] = 0x002a; // '⩮' (EQUALS WITH ASTERISK) -> '*'
NormalizeCharTable[0xa673] = 0x002a; // '꙳' (SLAVONIC ASTERISK) -> '*'
NormalizeCharTable[0xfe61] = 0x002a; // '﹡' (SMALL ASTERISK) -> '*'
// Note: U+066D (ARABIC FIVE POINTED STAR) and U+203B (REFERENCE MARK) are visually similar but not used as asterisk/multiply in most contexts, so not mapped here.

// slash/division variants -> '/'
NormalizeCharTable[0xff0f] = 0x002f; // '／' -> '/'
NormalizeCharTable[0x00f7] = 0x002f; // '÷' -> '/'
NormalizeCharTable[0x2215] = 0x002f; // '∕' -> '/'

// won/backslash variants -> '\\'
NormalizeCharTable[0x20a9] = 0x005c; // '₩' -> '\'
NormalizeCharTable[0x2216] = 0x005c; // '∖' -> '\'

// fullwidth symbols -> ascii
NormalizeCharTable[0xff06] = 0x0026; // '＆' -> '&'
NormalizeCharTable[0xff03] = 0x0023; // '＃' -> '#'
NormalizeCharTable[0xff20] = 0x0040; // '＠' -> '@'
NormalizeCharTable[0xff04] = 0x0024; // '＄' -> '$'
NormalizeCharTable[0xff05] = 0x0025; // '％' -> '%'
NormalizeCharTable[0xff3e] = 0x005e; // '＾' -> '^'

// tilde variants -> '~'
NormalizeCharTable[0xff5e] = 0x007e; // '～' -> '~'
NormalizeCharTable[0x223c] = 0x007e; // '∼' -> '~'
NormalizeCharTable[0x301c] = 0x007e; // '〜' -> '~'
NormalizeCharTable[0x3030] = 0x007e; // '〰' -> '~'

// backtick variants -> '`'
NormalizeCharTable[0xff40] = 0x0060; // '｀' -> '`'

// vertical bar variants -> '|'
NormalizeCharTable[0xff5c] = 0x007c; // '｜' -> '|'
NormalizeCharTable[0x00a6] = 0x007c; // '¦' -> '|'

// colon/semicolon/question/exclamation/underscore fullwidth -> ascii
NormalizeCharTable[0xff1a] = 0x003a; // '：' -> ':'
NormalizeCharTable[0xff1b] = 0x003b; // '；' -> ';'
NormalizeCharTable[0xff1f] = 0x003f; // '？' -> '?'
NormalizeCharTable[0xff01] = 0x0021; // '！' -> '!'
NormalizeCharTable[0xff3f] = 0x005f; // '＿' -> '_'

// right arrow variants -> '→'
NormalizeCharTable[0x21d2] = 0x2192; // '⇒' -> '→'
NormalizeCharTable[0x27a1] = 0x2192; // '➡' -> '→'
NormalizeCharTable[0x2794] = 0x2192; // '➔' -> '→'
NormalizeCharTable[0x279d] = 0x2192; // '➝' -> '→'
NormalizeCharTable[0x279e] = 0x2192; // '➞' -> '→'
NormalizeCharTable[0x279f] = 0x2192; // '➟' -> '→'
NormalizeCharTable[0x27f6] = 0x2192; // '⟶' -> '→'
NormalizeCharTable[0x21e2] = 0x2192; // '⇢' -> '→'
NormalizeCharTable[0x21e8] = 0x2192; // '⇨' -> '→'
NormalizeCharTable[0x2b95] = 0x2192; // '⮕' -> '→'
NormalizeCharTable[0x2b62] = 0x2192; // '⭢' -> '→'

// left arrow variants -> '←'
NormalizeCharTable[0x21d0] = 0x2190; // '⇐' -> '←'
NormalizeCharTable[0x2b05] = 0x2190; // '⬅' -> '←'
NormalizeCharTable[0x27f5] = 0x2190; // '⟵' -> '←'
NormalizeCharTable[0x27f8] = 0x2190; // '⟸' -> '←'
NormalizeCharTable[0x21c7] = 0x2190; // '⇇' -> '←'
NormalizeCharTable[0x21e4] = 0x2190; // '⇤' -> '←'
NormalizeCharTable[0x2b60] = 0x2190; // '⭠' -> '←'

// up arrow variants -> '↑'
NormalizeCharTable[0x21d1] = 0x2191; // '⇑' -> '↑'
NormalizeCharTable[0x2b06] = 0x2191; // '⬆' -> '↑'
NormalizeCharTable[0x21e7] = 0x2191; // '⇧' -> '↑'
NormalizeCharTable[0x2b99] = 0x2191; // '⮙' -> '↑'
NormalizeCharTable[0x2b61] = 0x2191; // '⭡' -> '↑'

// down arrow variants -> '↓'
NormalizeCharTable[0x21d3] = 0x2193; // '⇓' -> '↓'
NormalizeCharTable[0x2b07] = 0x2193; // '⬇' -> '↓'
NormalizeCharTable[0x21e9] = 0x2193; // '⇩' -> '↓'
NormalizeCharTable[0x2b9b] = 0x2193; // '⮛' -> '↓'
NormalizeCharTable[0x2b63] = 0x2193; // '⭣' -> '↓'

// left-right arrow variants -> '↔'
NormalizeCharTable[0x21d4] = 0x2194; // '⇔' -> '↔'
NormalizeCharTable[0x27f7] = 0x2194; // '⟷' -> '↔'
NormalizeCharTable[0x21c4] = 0x2194; // '⇄' -> '↔'
NormalizeCharTable[0x21c6] = 0x2194; // '⇆' -> '↔'
NormalizeCharTable[0x27fa] = 0x2194; // '⟺' -> '↔'
NormalizeCharTable[0x2b80] = 0x2194; // '⮀' -> '↔'
NormalizeCharTable[0x2b82] = 0x2194; // '⮂' -> '↔'

// up-down arrow variants -> '↕'
NormalizeCharTable[0x21d5] = 0x2195; // '⇕' -> '↕'
NormalizeCharTable[0x21a8] = 0x2195; // '↨' -> '↕'

// spaces -> normal space
NormalizeCharTable[0x00a0] = 0x0020; // '\u00A0' (NBSP) -> ' '
NormalizeCharTable[0x2000] = 0x0020; // '\u2000' -> ' '
NormalizeCharTable[0x2001] = 0x0020; // '\u2001' -> ' '
NormalizeCharTable[0x2002] = 0x0020; // '\u2002' -> ' '
NormalizeCharTable[0x2003] = 0x0020; // '\u2003' -> ' '
NormalizeCharTable[0x2004] = 0x0020; // '\u2004' -> ' '
NormalizeCharTable[0x2005] = 0x0020; // '\u2005' -> ' '
NormalizeCharTable[0x2006] = 0x0020; // '\u2006' -> ' '
NormalizeCharTable[0x2007] = 0x0020; // '\u2007' -> ' '
NormalizeCharTable[0x2008] = 0x0020; // '\u2008' -> ' '
NormalizeCharTable[0x2009] = 0x0020; // '\u2009' -> ' '
NormalizeCharTable[0x200a] = 0x0020; // '\u200A' -> ' '

// brackets quotes -> corner brackets
NormalizeCharTable[0x300e] = 0x300c; // '『' -> '「'
NormalizeCharTable[0x300a] = 0x300c; // '《' -> '「'
NormalizeCharTable[0x3008] = 0x300c; // '〈' -> '「'

NormalizeCharTable[0x300f] = 0x300d; // '』' -> '」'
NormalizeCharTable[0x300b] = 0x300d; // '》' -> '」'
NormalizeCharTable[0x3009] = 0x300d; // '〉' -> '」'

// left/right single quotes -> '
NormalizeCharTable[0x2018] = 0x0027; // ‘ -> '
NormalizeCharTable[0x2019] = 0x0027; // ’ -> '
NormalizeCharTable[0x201a] = 0x0027; // ‚ -> '
NormalizeCharTable[0x201b] = 0x0027; // ‛ -> '
NormalizeCharTable[0x2032] = 0x0027; // ′ -> '
NormalizeCharTable[0x2035] = 0x0027; // ‵ -> '
NormalizeCharTable[0x275b] = 0x0027; // ❛ -> '
NormalizeCharTable[0x275c] = 0x0027; // ❜ -> '
NormalizeCharTable[0xa78b] = 0x0027; // Ꞌ -> '
NormalizeCharTable[0xa78c] = 0x0027; // ꞌ -> '

// left/right double quotes -> "
NormalizeCharTable[0x201c] = 0x0022; // “ -> "
NormalizeCharTable[0x201d] = 0x0022; // ” -> "
NormalizeCharTable[0x201e] = 0x0022; // „ -> "
NormalizeCharTable[0x201f] = 0x0022; // ‟ -> "
NormalizeCharTable[0x2033] = 0x0022; // ″ -> "
NormalizeCharTable[0x2036] = 0x0022; // ‶ -> "
NormalizeCharTable[0x275d] = 0x0022; // ❝ -> "
NormalizeCharTable[0x275e] = 0x0022; // ❞ -> "
NormalizeCharTable[0x301d] = 0x0022; // 〝 -> "
NormalizeCharTable[0x301e] = 0x0022; // 〞 -> "
NormalizeCharTable[0x2e42] = 0x0022; // ⹂ -> "

export const NormalizeCharTableExt: Readonly<Record<string, string>> = Object.freeze({
	// 필요할까?
});
