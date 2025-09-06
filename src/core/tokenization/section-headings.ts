import { createTrie, extractStartCharsFromTrie } from "./trie";
import { HANGUL_ORDER } from "@/core/constants/index";
import { TokenFlags } from "./TokenFlags";

const sectionHeadingTrie = createTrie(false);
for (let i = 1; i < 40; i++) {
    sectionHeadingTrie.insert(`${i}. `, TokenFlags.SECTION_HEADING_TYPE1);
    sectionHeadingTrie.insert(`(${i}) `, TokenFlags.SECTION_HEADING_TYPE3);
    sectionHeadingTrie.insert(`${i}) `, TokenFlags.SECTION_HEADING_TYPE5);
}

for (let i = 0; i < HANGUL_ORDER.length; i++) {
    sectionHeadingTrie.insert(`${HANGUL_ORDER[i]}. `, TokenFlags.SECTION_HEADING_TYPE2);
    sectionHeadingTrie.insert(`(${HANGUL_ORDER[i]}) `, TokenFlags.SECTION_HEADING_TYPE4);
    sectionHeadingTrie.insert(`${HANGUL_ORDER[i]}) `, TokenFlags.SECTION_HEADING_TYPE6);
}

export const SectionHeadingTrieNode = sectionHeadingTrie.root;

export const sectionHeadingStartChars = extractStartCharsFromTrie(SectionHeadingTrieNode);