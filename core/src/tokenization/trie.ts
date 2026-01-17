/**
 * Trie node for pattern matching
 * Used for matching law articles, regulations, etc.
 */
export interface TrieNode {
    next: Record<number, TrieNode>;   // 정수 키는 객체가 Map보다 빠름
    allowSpace?: boolean;
    word?: {
        text: string;
        flags: number;
    };
}

/**
 * Marker character for optional spaces in Trie words
 */
export const OPTIONAL_SPACE_MARKER = '§';

import { WS_TABLE } from '../constants';
import { TokenFlags } from '../TokenFlags';

/**
 * Create a Trie root node
 */
export function createTrie(): TrieNode {
    return { next: {} };
}

/**
 * Insert a word into the trie
 * word: normalized text with OPTIONAL_SPACE_MARKER (§) indicating optional space positions
 * text: display text
 * flags: token flags to apply when matched
 * 
 * Example: insertIntoTrie(trie, "제§1§조", "제1조", flags)
 */
export function insertIntoTrie(
    trie: TrieNode,
    word: string,
    text: string,
    flags: number
): void {
    let node = trie;
    for (const char of word) {
        // If marker, mark allowSpace on current node
        if (char === OPTIONAL_SPACE_MARKER) {
            node.allowSpace = true;
            continue;
        }

        const cp = char.codePointAt(0)!;
        if (!node.next[cp]) {
            node.next[cp] = { next: {} };
        }
        node = node.next[cp]!;
    }
    node.word = { text, flags };
}

/**
 * Build wildcard trie
 * Matches: (현행과같음), <현행과같음>, [현행과같음] etc. with optional spaces
 */
export function buildWildcardTrie(): TrieNode {
    const trie = createTrie();

    const wildcards = [
        { text: '추가' },
        { text: '삭제' },
        { text: '신설' },
        { text: '생략' },
        { text: '현행과같음' },
        { text: '현행과동일' },
    ];

    const brackets = [
        { open: '(', close: ')' },
        { open: '<', close: '>' },
        { open: '[', close: ']' },
    ];

    for (const wildcard of wildcards) {
        // 각 글자 사이에 선택적 공백 마커 추가
        const charArray = Array.from(wildcard.text);
        const withSpaces = charArray.join('§');

        for (const bracket of brackets) {
            // 패턴: (현행과같음) → '(§현§행§과§같§음§)'
            const pattern = `${bracket.open}§${withSpaces}§${bracket.close}`;
            const display = `${bracket.open}${wildcard.text}${bracket.close}`;
            insertIntoTrie(trie, pattern, display, TokenFlags.WILDCARD);
        }
    }

    return trie;
}

/**
 * Match result when trie matches multiple segments
 */
export interface TrieMatch {
    count: number;      // 몇 개의 segment가 매칭되었는가
    word: string;       // 매칭된 단어
    flags: number;      // 플래그
    segmentEndIdx?: number;  // 마지막 segment index
    charEndIdx?: number;     // segment 내 마지막 character index
}

/**
 * Match trie against segment array starting at given index
 * Efficiently matches across multiple segments
 * 
 * @param trie Root trie node
 * @param segments Array of segment objects with 'text' property
 * @param segmentIndex Starting segment index
 * @returns TrieMatch with count if matched, null otherwise
 */
export function matchTrie(
    trie: TrieNode,
    segments: Array<{ text: string }>,
    segmentIndex: number
): TrieMatch | null {
    let node: TrieNode | null = trie;
    let segIdx = segmentIndex;
    let charIdx = 0;

    // 가장 최근에 찾은 완전한 단어 기록
    let matchedNode: TrieNode | null = null;
    let matchedSegIdx = segmentIndex;

    while (segIdx < segments.length && node) {
        const segmentText = segments[segIdx].text;

        while (charIdx < segmentText.length && node) {
            const cp = segmentText.charCodeAt(charIdx)!;
            const isSpace = WS_TABLE[cp];

            // 현재 노드에 word가 있으면 기록 (longest match)
            if (node.word) {
                matchedNode = node;
                matchedSegIdx = segIdx;
            }

            // allowSpace인 경우 공백 건너뛰기 (노드 유지)
            if (isSpace && node.allowSpace) {
                charIdx++;
                continue;
            }

            // 다음 codepoint가 있으면 진행
            if (node.next[cp]) {
                node = node.next[cp];
                charIdx++;
            } else {
                // 매칭 실패 - 루프 종료
                break;
            }
        }

        // segment 끝에 도달했으면 다음 segment로 이동
        if (charIdx >= segmentText.length && node) {
            // segment 경계를 allowSpace로 취급
            // node.allowSpace가 true면, 다음 segment로 계속 진행 가능
            if (node.allowSpace && segIdx + 1 < segments.length) {
                segIdx++;
                charIdx = 0;
                // allowSpace 상태를 유지하면서 다음 segment 처리
            } else if (!node.allowSpace && segIdx + 1 < segments.length) {
                // allowSpace가 아니면 다음 segment로 진행하지만, 노드 상태는 유지
                segIdx++;
                charIdx = 0;
            } else if (segIdx + 1 >= segments.length) {
                // 마지막 segment 도달
                break;
            }
        } else if (charIdx < segmentText.length) {
            // segment 중간에 매칭 실패
            break;
        }
    }

    // 마지막 노드 확인
    if (node?.word) {
        matchedNode = node;
        matchedSegIdx = segIdx;
    }

    if (!matchedNode) {
        return null;
    }

    // matchedSegIdx는 마지막 매칭된 segment의 인덱스
    // count는 segmentIndex부터 matchedSegIdx까지의 segment 개수
    const count = matchedSegIdx - segmentIndex + 1;

    return {
        count,
        word: matchedNode.word!.text,
        flags: matchedNode.word!.flags,
    };
}

export const wildcardTrie = buildWildcardTrie();