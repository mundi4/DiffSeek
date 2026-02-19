// normalizedCharMap LUT (BMP 1:1 only)
// encoding: lut[srcCode] = dstCode
export const NormalizeCharTable = new Uint16Array(0x10000);

for (let i = 0; i < NormalizeCharTable.length; i++) {
    NormalizeCharTable[i] = i;
}

// hyphen/minus variants -> '-'
NormalizeCharTable[0x2010] = 0x002D; // '‐' -> '-'
NormalizeCharTable[0x2012] = 0x002D; // '‒' -> '-'
NormalizeCharTable[0x2013] = 0x002D; // '–' -> '-'
NormalizeCharTable[0x2014] = 0x002D; // '—' -> '-'
NormalizeCharTable[0x2015] = 0x002D; // '―' -> '-'
NormalizeCharTable[0xFE58] = 0x002D; // '﹘' -> '-'
NormalizeCharTable[0xFF0D] = 0x002D; // '－' -> '-'
NormalizeCharTable[0xFE63] = 0x002D; // '﹣' -> '-'
NormalizeCharTable[0x2500] = 0x002D; // '─' -> '-'
NormalizeCharTable[0x2E3A] = 0x002D; // '⸺' -> '-'

// dot variants -> '.'
NormalizeCharTable[0x2024] = 0x002E; // '․' -> '.'
NormalizeCharTable[0xFF0E] = 0x002E; // '．' -> '.'

// comma variants -> ','
NormalizeCharTable[0xFF0C] = 0x002C; // '，' -> ','
NormalizeCharTable[0xFF64] = 0x002C; // '､' -> ','

// middle dot variants -> '·'
NormalizeCharTable[0x22C5] = 0x00B7; // '⋅' -> '·'
NormalizeCharTable[0x2219] = 0x00B7; // '∙' -> '·'
NormalizeCharTable[0x318D] = 0x00B7; // 'ㆍ' -> '·'
NormalizeCharTable[0x2027] = 0x00B7; // '‧' -> '·'
NormalizeCharTable[0x2022] = 0x00B7; // '•' -> '·'
NormalizeCharTable[0x25CF] = 0x00B7; // '●' -> '·'

// circled dot variants -> '⊙'
NormalizeCharTable[0x25C9] = 0x2299; // '◉' -> '⊙'
NormalizeCharTable[0x25CE] = 0x2299; // '◎' -> '⊙'
NormalizeCharTable[0x29BF] = 0x2299; // '⦿' -> '⊙'

// small circle variants -> '∘'
NormalizeCharTable[0x25E6] = 0x2218; // '◦' -> '∘'
NormalizeCharTable[0x25CB] = 0x2218; // '○' -> '∘'
NormalizeCharTable[0x3147] = 0x2218; // 'ㅇ' -> '∘'

// square bullet variants -> '■'
NormalizeCharTable[0x25AA] = 0x25A0; // '▪' -> '■'
NormalizeCharTable[0x25FC] = 0x25A0; // '◼' -> '■'

// empty square variants -> '□'
NormalizeCharTable[0x25AB] = 0x25A1; // '▫' -> '□'
NormalizeCharTable[0x25FB] = 0x25A1; // '◻' -> '□'
NormalizeCharTable[0x2610] = 0x25A1; // '☐' -> '□'

// ellipsis variants -> '…'
NormalizeCharTable[0x22EF] = 0x2026; // '⋯' -> '…'

// fullwidth parens -> ascii parens
NormalizeCharTable[0xFF08] = 0x0028; // '（' -> '('
NormalizeCharTable[0xFF09] = 0x0029; // '）' -> ')'

// fullwidth brackets -> ascii brackets
NormalizeCharTable[0xFF3B] = 0x005B; // '［' -> '['
NormalizeCharTable[0xFF3D] = 0x005D; // '］' -> ']'

// fullwidth braces -> ascii braces
NormalizeCharTable[0xFF5B] = 0x007B; // '｛' -> '{'
NormalizeCharTable[0xFF5D] = 0x007D; // '｝' -> '}'

// fullwidth angle brackets -> ascii
NormalizeCharTable[0xFF1C] = 0x003C; // '＜' -> '<'
NormalizeCharTable[0xFF1E] = 0x003E; // '＞' -> '>'

// equals variants -> '='
NormalizeCharTable[0xFF1D] = 0x003D; // '＝' -> '='
NormalizeCharTable[0xFE66] = 0x003D; // '﹦' -> '='
NormalizeCharTable[0x2261] = 0x003D; // '≡' -> '='
NormalizeCharTable[0x2248] = 0x003D; // '≈' -> '='

// plus variants -> '+'
NormalizeCharTable[0xFF0B] = 0x002B; // '＋' -> '+'
NormalizeCharTable[0xFE62] = 0x002B; // '﹢' -> '+'

// asterisk/multiply variants -> '*'
NormalizeCharTable[0xFF0A] = 0x002A; // '＊' -> '*'
NormalizeCharTable[0x2731] = 0x002A; // '✱' -> '*'
NormalizeCharTable[0x00D7] = 0x002A; // '×' -> '*'
NormalizeCharTable[0x2217] = 0x002A; // '∗' -> '*'
NormalizeCharTable[0x2715] = 0x002A; // '✕' -> '*'
NormalizeCharTable[0x2716] = 0x002A; // '✖' -> '*'

// slash/division variants -> '/'
NormalizeCharTable[0xFF0F] = 0x002F; // '／' -> '/'
NormalizeCharTable[0x00F7] = 0x002F; // '÷' -> '/'
NormalizeCharTable[0x2215] = 0x002F; // '∕' -> '/'

// won/backslash variants -> '\\'
NormalizeCharTable[0x20A9] = 0x005C; // '₩' -> '\'
NormalizeCharTable[0x2216] = 0x005C; // '∖' -> '\'

// fullwidth symbols -> ascii
NormalizeCharTable[0xFF06] = 0x0026; // '＆' -> '&'
NormalizeCharTable[0xFF03] = 0x0023; // '＃' -> '#'
NormalizeCharTable[0xFF20] = 0x0040; // '＠' -> '@'
NormalizeCharTable[0xFF04] = 0x0024; // '＄' -> '$'
NormalizeCharTable[0xFF05] = 0x0025; // '％' -> '%'
NormalizeCharTable[0xFF3E] = 0x005E; // '＾' -> '^'

// tilde variants -> '~'
NormalizeCharTable[0xFF5E] = 0x007E; // '～' -> '~'
NormalizeCharTable[0x223C] = 0x007E; // '∼' -> '~'
NormalizeCharTable[0x301C] = 0x007E; // '〜' -> '~'
NormalizeCharTable[0x3030] = 0x007E; // '〰' -> '~'

// backtick variants -> '`'
NormalizeCharTable[0xFF40] = 0x0060; // '｀' -> '`'

// vertical bar variants -> '|'
NormalizeCharTable[0xFF5C] = 0x007C; // '｜' -> '|'
NormalizeCharTable[0x00A6] = 0x007C; // '¦' -> '|'

// colon/semicolon/question/exclamation/underscore fullwidth -> ascii
NormalizeCharTable[0xFF1A] = 0x003A; // '：' -> ':'
NormalizeCharTable[0xFF1B] = 0x003B; // '；' -> ';'
NormalizeCharTable[0xFF1F] = 0x003F; // '？' -> '?'
NormalizeCharTable[0xFF01] = 0x0021; // '！' -> '!'
NormalizeCharTable[0xFF3F] = 0x005F; // '＿' -> '_'

// right arrow variants -> '→'
NormalizeCharTable[0x21D2] = 0x2192; // '⇒' -> '→'
NormalizeCharTable[0x27A1] = 0x2192; // '➡' -> '→'
NormalizeCharTable[0x2794] = 0x2192; // '➔' -> '→'
NormalizeCharTable[0x279D] = 0x2192; // '➝' -> '→'
NormalizeCharTable[0x279E] = 0x2192; // '➞' -> '→'
NormalizeCharTable[0x279F] = 0x2192; // '➟' -> '→'
NormalizeCharTable[0x27F6] = 0x2192; // '⟶' -> '→'
NormalizeCharTable[0x21E2] = 0x2192; // '⇢' -> '→'
NormalizeCharTable[0x21E8] = 0x2192; // '⇨' -> '→'
NormalizeCharTable[0x2B95] = 0x2192; // '⮕' -> '→'
NormalizeCharTable[0x2B62] = 0x2192; // '⭢' -> '→'

// left arrow variants -> '←'
NormalizeCharTable[0x21D0] = 0x2190; // '⇐' -> '←'
NormalizeCharTable[0x2B05] = 0x2190; // '⬅' -> '←'
NormalizeCharTable[0x27F5] = 0x2190; // '⟵' -> '←'
NormalizeCharTable[0x27F8] = 0x2190; // '⟸' -> '←'
NormalizeCharTable[0x21C7] = 0x2190; // '⇇' -> '←'
NormalizeCharTable[0x21E4] = 0x2190; // '⇤' -> '←'
NormalizeCharTable[0x2B60] = 0x2190; // '⭠' -> '←'

// up arrow variants -> '↑'
NormalizeCharTable[0x21D1] = 0x2191; // '⇑' -> '↑'
NormalizeCharTable[0x2B06] = 0x2191; // '⬆' -> '↑'
NormalizeCharTable[0x21E7] = 0x2191; // '⇧' -> '↑'
NormalizeCharTable[0x2B99] = 0x2191; // '⮙' -> '↑'
NormalizeCharTable[0x2B61] = 0x2191; // '⭡' -> '↑'

// down arrow variants -> '↓'
NormalizeCharTable[0x21D3] = 0x2193; // '⇓' -> '↓'
NormalizeCharTable[0x2B07] = 0x2193; // '⬇' -> '↓'
NormalizeCharTable[0x21E9] = 0x2193; // '⇩' -> '↓'
NormalizeCharTable[0x2B9B] = 0x2193; // '⮛' -> '↓'
NormalizeCharTable[0x2B63] = 0x2193; // '⭣' -> '↓'

// left-right arrow variants -> '↔'
NormalizeCharTable[0x21D4] = 0x2194; // '⇔' -> '↔'
NormalizeCharTable[0x27F7] = 0x2194; // '⟷' -> '↔'
NormalizeCharTable[0x21C4] = 0x2194; // '⇄' -> '↔'
NormalizeCharTable[0x21C6] = 0x2194; // '⇆' -> '↔'
NormalizeCharTable[0x27FA] = 0x2194; // '⟺' -> '↔'
NormalizeCharTable[0x2B80] = 0x2194; // '⮀' -> '↔'
NormalizeCharTable[0x2B82] = 0x2194; // '⮂' -> '↔'

// up-down arrow variants -> '↕'
NormalizeCharTable[0x21D5] = 0x2195; // '⇕' -> '↕'
NormalizeCharTable[0x21A8] = 0x2195; // '↨' -> '↕'

// spaces -> normal space
NormalizeCharTable[0x00A0] = 0x0020; // '\u00A0' (NBSP) -> ' '
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
NormalizeCharTable[0x200A] = 0x0020; // '\u200A' -> ' '

// brackets quotes -> corner brackets
NormalizeCharTable[0x300E] = 0x300C; // '『' -> '「'
NormalizeCharTable[0x300A] = 0x300C; // '《' -> '「'
NormalizeCharTable[0x3008] = 0x300C; // '〈' -> '「'

NormalizeCharTable[0x300F] = 0x300D; // '』' -> '」'
NormalizeCharTable[0x300B] = 0x300D; // '》' -> '」'
NormalizeCharTable[0x3009] = 0x300D; // '〉' -> '」'

// double quotes -> '"'
NormalizeCharTable[0x201C] = 0x0022; // '"' -> '"'
NormalizeCharTable[0x201D] = 0x0022; // '"' -> '"'
NormalizeCharTable[0x301D] = 0x0022; // '〝' -> '"'
NormalizeCharTable[0x301E] = 0x0022; // '〞' -> '"'
NormalizeCharTable[0x201F] = 0x0022; // '‟' -> '"'
NormalizeCharTable[0x2033] = 0x0022; // '″' -> '"'
NormalizeCharTable[0x275D] = 0x0022; // '❝' -> '"'
NormalizeCharTable[0x275E] = 0x0022; // '❞' -> '"'
NormalizeCharTable[0x2E42] = 0x0022; // '⹂' -> '"'

// single quotes -> '\''
NormalizeCharTable[0x2018] = 0x0027; // ''' -> '''
NormalizeCharTable[0x2019] = 0x0027; // ''' -> '''
NormalizeCharTable[0x201A] = 0x0027; // '‚' -> '''
NormalizeCharTable[0x201B] = 0x0027; // '‛' -> '''
NormalizeCharTable[0x2032] = 0x0027; // '′' -> '''
NormalizeCharTable[0x275B] = 0x0027; // '❛' -> '''
NormalizeCharTable[0x275C] = 0x0027; // '❜' -> '''
NormalizeCharTable[0xA78B] = 0x0027; // 'Ꞌ' -> '''
NormalizeCharTable[0xA78C] = 0x0027; // 'ꞌ' -> '''

export const NormalizeCharTableExt: Readonly<Record<string, string>> = Object.freeze({
    // 필요할까?
});
