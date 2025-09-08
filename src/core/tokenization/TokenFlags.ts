
export const enum TokenFlags {
    None = 0,
    LINE_START = 1 << 0, // 1
    LINE_END = 1 << 1, // 2
    BLOCK_START = 1 << 2, // 4
    BLOCK_END = 1 << 3, // 8
    CONTAINER_START = 1 << 4, // 16
    CONTAINER_END = 1 << 5, // 32
    TABLE_START = 1 << 6, // 64
    TABLE_END = 1 << 7, // 128
    TABLEROW_START = 1 << 8, // 256
    TABLEROW_END = 1 << 9, // 512
    TABLECELL_START = 1 << 10, // 1024
    TABLECELL_END = 1 << 11, // 2048
    NO_JOIN_PREV = 1 << 12, // 4096 @@@, ### 등등
    NO_JOIN_NEXT = 1 << 13, // 8192 @@@, ### 등등
    WILD_CARD = 1 << 14, // 16384
    MANUAL_ANCHOR = 1 << 15, // 32768  @@@, ### 등등
    IMAGE = 1 << 16, // 65536
    HTML_SUP = 1 << 17, // 131072
    HTML_SUB = 1 << 18, // 262144

    // SUP/SUB flags
    HTML_SUPSUB = HTML_SUP | HTML_SUB, // 393216

    // Section Headings
    SECTION_HEADING_TYPE1 = 1 << 19, // 1.
    SECTION_HEADING_TYPE2 = 1 << 20, // 가.
    SECTION_HEADING_TYPE3 = 1 << 21, // (1)
    SECTION_HEADING_TYPE4 = 1 << 22, // (가)
    SECTION_HEADING_TYPE5 = 1 << 23, // 1)
    SECTION_HEADING_TYPE6 = 1 << 24, // 가)
    SECTION_HEADING_MASK = SECTION_HEADING_TYPE1 |
        SECTION_HEADING_TYPE2 |
        SECTION_HEADING_TYPE3 |
        SECTION_HEADING_TYPE4 |
        SECTION_HEADING_TYPE5 |
        SECTION_HEADING_TYPE6,
}
