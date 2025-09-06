import { createTrie } from "./trie";
import { TokenFlags } from "./TokenFlags";

// wildcards.
// 이걸 어떻게 구현해야할지 감이 안오지만 지금으로써는 얘네들을 atomic하게 취급(사이에 공백이 있어도 하나의 토큰으로 만듬. '(현행과 같음)'에서 일부분만 매치되는 것을 방지)
// 글자단위로 토큰화하는 경우에도 얘네들은 (...) 통채로 하나의 토큰으로 취급.
// 와일드카드diff인 경우 다른 diff와 병합되지 않으면 좋지만 와일드카드가 얼마나 greedy하게 반대쪽 텍스트를 잡아먹어야 할지
// 양쪽에 wildcard가 동시에 나오는 경우 경계를 어디서 어떻게 짤라야할지 쉽지 않음.
// 또한 wildcard를 강제로 다른 diff와 분리하는 경우 diff가 같은 위치에 두 개 이상 생기게 되는 수가 있다. (wildcard와 wildcard가 아닌 것)
// 이 경우 정확히 같은 위치에 두개의 diff를 렌더링해야하고 결국 두개가 겹쳐보이게 되는데 분간이 잘 안된다.
export const wildcardTrie = createTrie(true);

wildcardTrie.insert("(추가)", TokenFlags.WILD_CARD);
wildcardTrie.insert("(삭제)", TokenFlags.WILD_CARD);
wildcardTrie.insert("(신설)", TokenFlags.WILD_CARD);
wildcardTrie.insert("(생략)", TokenFlags.WILD_CARD);
wildcardTrie.insert("(현행과같음)", TokenFlags.WILD_CARD);

export const wildcardTrieNode = wildcardTrie.root.next("(".codePointAt(0)!)!;