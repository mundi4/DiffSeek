
export type TrieNode = {
	next: (char: string) => TrieNode | null;
	addChild: (char: string) => TrieNode;
	word: string | null;
	flags: number;
	children: Record<string, TrieNode>;
};

export function createTrie(ignoreSpaces = false) {
	const root = createTrieNode(ignoreSpaces);

	function insert(word: string, flags = 0) {
		let node = root;
		for (let i = 0; i < word.length; i++) {
			node = node.addChild(word[i]);
		}
		node.word = word;
		node.flags = flags;
	}

	return { insert, root };
}

function createTrieNode(ignoreSpaces: boolean): TrieNode {
	const children: Record<string, TrieNode> = {};

	const node: TrieNode = {
		children,
		word: null,
		flags: 0,
		next(char: string) {
			if (ignoreSpaces && char === " ") return node;
			return children[char] || null;
		},
		addChild(char: string) {
			return children[char] ?? (children[char] = createTrieNode(ignoreSpaces));
		},
	};

	return node;
}

export function extractStartCharsFromTrie(trie: TrieNode): Record<string, 1> {
	const table: Record<string, 1> = {};
	for (const ch in trie.children) {
		table[ch] = 1;
	}
	return table;
}
