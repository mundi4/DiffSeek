import { CHAR_META } from "../char-meta";
import { CM_TRIE_SHIFT } from "../char-meta-flags";
import { TOKEN_FLAGS_WILDCARD } from "./token-flags";
import { type BuildTrieWord, buildFlatTrie } from "./trie";

function buildWildcardFlatTrie() {
    const wildcards = ["추가", "삭제", "신설", "생략", "현행과같음", "현행과동일"];
    const brackets: Array<[string, string]> = [
        ["(", ")"],
        ["<", ">"],
        ["[", "]"],
    ];

    const words: BuildTrieWord[] = [];

    for (const w of wildcards) {
        // build-time only, Array.from OK
        const withSpaces = Array.from(w).join("§");

        for (const [op, cl] of brackets) {
            words.push({
                pattern: `${op}§${withSpaces}§${cl}`,
                text: `${op}${w}${cl}`,
                flags: TOKEN_FLAGS_WILDCARD,
            });
        }
    }

    return buildFlatTrie(words, { terminalPolicy: "last" });
}

export const CM_WILDCARD_START = 1 << CM_TRIE_SHIFT;

export const wildcardFlatTrie = buildWildcardFlatTrie();

for (const ch of wildcardFlatTrie.startChars) {
    CHAR_META[ch] |= CM_WILDCARD_START;
}