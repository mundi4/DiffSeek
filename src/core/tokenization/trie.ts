
export type TrieNode = {
	next: (charCode: number) => TrieNode | null;
	addChild: (charCode: number) => TrieNode;
	word: string | null;
	flags: number;
	children: Record<number, TrieNode>;
};

export function createTrie(ignoreSpaces = false) {
	const root = createTrieNode(ignoreSpaces);

	function insert(word: string, flags = 0) {
		let node = root;
		for (let i = 0; i < word.length; i++) {
			const charCode = word.codePointAt(i)!;
			node = node.addChild(charCode);
			// Handle 4-byte unicode characters (surrogate pairs)
			if (charCode > 0xFFFF) {
				i++; // Skip the next surrogate pair
			}
		}
		node.word = word;
		node.flags = flags;
	}

	return { insert, root };
}

function createTrieNode(ignoreSpaces: boolean): TrieNode {
	const children: Record<number, TrieNode> = {};

	const node: TrieNode = {
		children,
		word: null,
		flags: 0,
		next(charCode: number) {
			if (ignoreSpaces && charCode === 32) return node; // 32 = ' '.charCodeAt(0)
			return children[charCode] || null;
		},
		addChild(charCode: number) {
			return children[charCode] ?? (children[charCode] = createTrieNode(ignoreSpaces));
		},
	};

	return node;
}

export function extractStartCharsFromTrie(trie: TrieNode): Record<string, 1> {
	const table: Record<string, 1> = {};
	for (const charCode in trie.children) {
		const char = String.fromCodePoint(Number(charCode));
		table[char] = 1;
	}
	return table;
}
