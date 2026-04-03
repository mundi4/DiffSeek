import { HEADING_MASK, PAYLOAD_SHIFT, TOKEN_FLAGS_IS_HEADING } from "../tokenization/token-flags";

export const SECTION_HEADING_TYPE_NONE          = 0 as const;
export const SECTION_HEADING_TYPE_NUMERIC_DOT   = 1 as const;      // 1.  2.
export const SECTION_HEADING_TYPE_HANGUL_DOT    = 2 as const;       // 가. 나.
export const SECTION_HEADING_TYPE_PAREN_NUMERIC = 3 as const;    // (1) (2)
export const SECTION_HEADING_TYPE_PAREN_HANGUL  = 4 as const;     // (가) (나)
export const SECTION_HEADING_TYPE_NUMERIC_PAREN = 5 as const;     // 1)  2)
export const SECTION_HEADING_TYPE_HANGUL_PAREN  = 6 as const;      // 가) 나)
export const SECTION_HEADING_TYPE_LAW_ARTICLE   = 7 as const;       // 제1조 제2조

export type SectionHeadingType =
    | typeof SECTION_HEADING_TYPE_NONE
    | typeof SECTION_HEADING_TYPE_NUMERIC_DOT
    | typeof SECTION_HEADING_TYPE_HANGUL_DOT
    | typeof SECTION_HEADING_TYPE_PAREN_NUMERIC
    | typeof SECTION_HEADING_TYPE_PAREN_HANGUL
    | typeof SECTION_HEADING_TYPE_NUMERIC_PAREN
    | typeof SECTION_HEADING_TYPE_HANGUL_PAREN
    | typeof SECTION_HEADING_TYPE_LAW_ARTICLE;

/** token flags → SectionHeadingType (0 if not a heading) */
export function headingFlagsToType(flags: number): SectionHeadingType {
    return ((flags >>> PAYLOAD_SHIFT) & 0x7) as SectionHeadingType;
}

/** SectionHeadingType → token flags (0 for NONE) */
export function headingTypeToFlags(type: SectionHeadingType): number {
    if (type === SECTION_HEADING_TYPE_NONE) return 0;
    return (type << PAYLOAD_SHIFT) | TOKEN_FLAGS_IS_HEADING;
}

// Re-export HEADING_MASK for consumers that compare heading types via flags
export { HEADING_MASK };
