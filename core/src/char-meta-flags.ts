export const CM_WS = 1 as const;
export const CM_WS_COLLAPSABLE = 2 as const;
export const CM_LETTER = 4 as const;
export const CM_NUMBER = 8 as const;
export const CM_NEWLINE = 16 as const;
export const CM_NEEDS_NORM = 32 as const;
export const CM_SURROGATE = 64 as const;
export const CM_RESERVED7 = 128 as const;

export const CM_TRIE_SHIFT = 8 as const;
export const CM_TRIE_MASK = 65280 as const;

export type CharMeta = number;
