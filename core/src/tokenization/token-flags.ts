export const TOKEN_FLAGS_NONE = 0x0 as const;

// ── Token type (bits 0-1, 2-bit value) ───────────────────────────────────────
export const TOKEN_TYPE_MASK = 0x7 as const; // 0x7
export const TOKEN_FLAGS_TYPE_TEXT = 0x1 as const; //
export const TOKEN_FLAGS_TYPE_IMAGE = 0x2 as const; //
export const TOKEN_FLAGS_TYPE_STRUCTURAL = 0x4 as const; //

// ── Common flags (bits 2-13) ──────────────────────────────────────────────────
export const TOKEN_FLAGS_LINE_START = 0x008 as const; // bit  3
export const TOKEN_FLAGS_LINE_END = 0x010 as const; // bit  4
export const TOKEN_FLAGS_WORD_LIKE = 0x020 as const; // bit  5
export const TOKEN_FLAGS_PUNCTUATION = 0x040 as const; // bit  6
export const TOKEN_FLAGS_IS_HEADING = 0x080 as const; // bit  7  ← hot-path
export const TOKEN_FLAGS_MANUAL_ANCHOR = 0x100 as const; // bit  8
export const TOKEN_FLAGS_WILDCARD = 0x200 as const; // bit  9
export const TOKEN_FLAGS_NO_JOIN_NEXT = 0x400 as const; // bit  10
export const TOKEN_FLAGS_NO_JOIN_PREV = 0x800 as const; // bit  11
export const TOKEN_FLAGS_HAS_PRECEDING_SPACE = 0x1000 as const; // bit 12
export const TOKEN_FLAGS_HAS_FOLLOWING_SPACE = 0x2000 as const; // bit 13
// bits 14-23: available

// ── Type payload (bits 24-31) — extract with: flags >>> 24 ───────────────────
//
//   text token:       bits 24-26 = heading type (1-7 = SECTION_HEADING_TYPE_*; 0 = none)
//                     bits 27-31 = 0  (flags always ≥ 0 for text tokens)
//
//   structural token: bits 24-26 = element type (1=td/th, 2=tr, 3=table; 0 = unused)
//                     bits 27-30 = spare
//                     bit  31    = OPEN(1) / CLOSE(0)  — sign-bit convention:
//                                  flags < 0  → structural OPEN
//                                  flags ≥ 0  → structural CLOSE  (when type bits = 0b11)
//
export const PAYLOAD_SHIFT = 24 as const;

// Structural element type values (bits 24-26 of structural tokens)
export const STRUCTURAL_ELEMENT_TD = 1 as const; // <td>, <th>
export const STRUCTURAL_ELEMENT_TR = 2 as const; // <tr>
export const STRUCTURAL_ELEMENT_TABLE = 3 as const; // <table>

// Structural open indicator (bit 31)
// OPEN  check: flags & TOKEN_FLAGS_STRUCTURAL_OPEN  (truthy when bit 31 set)
// CLOSE check: isStructuralClose(flags)
export const TOKEN_FLAGS_STRUCTURAL_OPEN = 0x80000000 as const; // bit 31 (appears as -2147483648 in signed arithmetic — truthy)

/** Returns true if `flags` describes a structural CLOSE token. */
export function isStructuralClose(flags: number): boolean {
	return !!(flags & TOKEN_FLAGS_TYPE_STRUCTURAL) && flags >= 0;
}

/** Returns true if `flags` describes a structural OPEN token. */
export function isStructuralOpen(flags: number): boolean {
	return !!(flags & TOKEN_FLAGS_TYPE_STRUCTURAL) && flags < 0;
}

export function getStructuralElementType(flags: number): number {
	if (!(flags & TOKEN_FLAGS_TYPE_STRUCTURAL)) return 0;
	return (flags >>> PAYLOAD_SHIFT) & 0x7;
}

// ── Derived masks ─────────────────────────────────────────────────────────────
// HEADING_MASK covers IS_HEADING (bit 6) + payload heading-type bits (24-26).
//   Fast "is heading?":  flags & TOKEN_FLAGS_IS_HEADING
//   Extract type value:  (flags >>> 24) & 7
//   Compare same type:   (a & HEADING_MASK) === (b & HEADING_MASK)
export const HEADING_MASK = 0x07000040 as const; // TOKEN_FLAGS_IS_HEADING | (0x7 << 24)
