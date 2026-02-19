// buildFlatTrie.ts
// Edge-list(flat) trie builder (BUILD ONLY).
// - UTF-16 charCode(16-bit) 기반
// - OPTIONAL_SPACE_MARKER '§'는 "현재 노드에서 공백 허용" 플래그로만 처리
// - 정규화는 빌드에서 절대 고려하지 않음 (matching 단계에서만 처리)
// - startChars: 희소 리스트(Uint16Array unique+sorted)로 반환 (CHAR_META 주입용)
// - nodeOutId: 0=없음, 1..N=출력(1-based)

import { CHAR_META } from "../shared/charMeta";
import { CM_WS } from "../shared/charMetaFlags";
import type { TextNodeCursor, TextPos } from "./TextNodeCursor";

export const OPTIONAL_SPACE_MARKER_CU = 0x00a7; // '§'
const NF_ALLOW_SPACE = 1 << 0;

export interface BuildTrieWord {
    pattern: string; // includes '§' markers for optional spaces
    text: string;
    flags: number;
}

export interface FlatTrie {
    // nodes
    nodeEdgeStart: Uint32Array;
    nodeEdgeCount: Uint16Array;
    nodeFlags: Uint8Array;
    nodeOutId: Uint16Array; // 0 none, 1..N output id (1-based)

    // edges
    edgeChar: Uint16Array;  // raw charCode (NOT normalized)
    edgeNext: Uint32Array;  // next node index

    // outputs
    outText: string[];
    outFlags: Uint32Array;

    // compact unique sorted start chars (raw charCode)
    startChars: Uint16Array;
}

export interface TrieMatch {
    word: string;
    flags: number;
}

export interface BuildFlatTrieOptions {
    // if multiple patterns end at same node:
    terminalPolicy?: "last" | "first";
}

type TmpNode = {
    edges: Map<number, number>; // charCode -> next node index
    flags: number;             // NF_ALLOW_SPACE
    outId: number;             // 0 or 1-based
};

export function buildFlatTrie(words: BuildTrieWord[], opts: BuildFlatTrieOptions = {}): FlatTrie {
    const terminalPolicy = opts.terminalPolicy ?? "last";

    const nodes: TmpNode[] = [];
    const outText: string[] = [];
    const outFlags: number[] = [];
    const startSet = new Set<number>();

    function newNode(): number {
        nodes.push({ edges: new Map(), flags: 0, outId: 0 });
        return nodes.length - 1;
    }

    function addOut(text: string, flags: number): number {
        outText.push(text);
        outFlags.push(flags >>> 0);
        return outText.length; // 1-based
    }

    const root = newNode();

    for (const w of words) {
        const outId = addOut(w.text, w.flags);

        // start char (first non-marker charCode)
        for (let i = 0; i < w.pattern.length; i++) {
            const cu = w.pattern.charCodeAt(i);
            if (cu === OPTIONAL_SPACE_MARKER_CU) continue;
            startSet.add(cu);
            break;
        }

        let node = root;

        for (let i = 0; i < w.pattern.length; i++) {
            const cu = w.pattern.charCodeAt(i);

            if (cu === OPTIONAL_SPACE_MARKER_CU) {
                nodes[node].flags |= NF_ALLOW_SPACE;
                continue;
            }

            const edges = nodes[node].edges;
            let nxt = edges.get(cu);
            if (nxt === undefined) {
                nxt = newNode();
                edges.set(cu, nxt);
            }
            node = nxt;
        }

        // terminal assign
        if (terminalPolicy === "last" || nodes[node].outId === 0) {
            nodes[node].outId = outId;
        }
    }

    // ---- flatten to typed arrays ----
    const nodeCount = nodes.length;

    // count edges
    let edgeCount = 0;
    for (let i = 0; i < nodeCount; i++) edgeCount += nodes[i].edges.size;

    const nodeEdgeStart = new Uint32Array(nodeCount);
    const nodeEdgeCount = new Uint16Array(nodeCount);
    const nodeFlags = new Uint8Array(nodeCount);
    const nodeOutId = new Uint16Array(nodeCount);

    const edgeChar = new Uint16Array(edgeCount);
    const edgeNext = new Uint32Array(edgeCount);

    let e = 0;
    for (let ni = 0; ni < nodeCount; ni++) {
        const n = nodes[ni];

        nodeEdgeStart[ni] = e;
        nodeEdgeCount[ni] = n.edges.size;
        nodeFlags[ni] = n.flags;
        nodeOutId[ni] = n.outId;

        if (n.edges.size) {
            const entries = Array.from(n.edges.entries());
            entries.sort((a, b) => a[0] - b[0]); // deterministic order

            for (let k = 0; k < entries.length; k++) {
                const [ch, nxt] = entries[k];
                edgeChar[e] = ch;
                edgeNext[e] = nxt;
                e++;
            }
        }
    }

    const startArr = Array.from(startSet);
    startArr.sort((a, b) => a - b);

    return {
        nodeEdgeStart,
        nodeEdgeCount,
        nodeFlags,
        nodeOutId,
        edgeChar,
        edgeNext,
        outText,
        outFlags: Uint32Array.from(outFlags),
        startChars: Uint16Array.from(startArr),
    };
}

export function matchFlatTrieAtCursor(
    trie: FlatTrie,
    cursor: TextNodeCursor,
    normalizeLut?: Uint16Array,
): TrieMatch | null {

    const start = cursor.getPos();

    let node = 0;
    let bestOutId = 0;
    const bestEnd: TextPos = { nodeIndex: start.nodeIndex, charIndex: start.charIndex };

    while (!cursor.eof()) {

        // consume 전 terminal 기록
        const outId = trie.nodeOutId[node];
        if (outId) {
            bestOutId = outId;
            cursor.getPosInto(bestEnd);
        }

        let cu = cursor.current;
        // console.log("Trie matching at cursor.", { char: String.fromCharCode(cu), code: cu, pos: cursor.getPos() });

        // allowSpace
        if ((trie.nodeFlags[node] & NF_ALLOW_SPACE) &&
            (CHAR_META[cu] & CM_WS)) {

            if (!cursor.moveNext()) break;
            continue;
        }

        if (normalizeLut) {
            cu = normalizeLut[cu];
        }

        // transition
        const startEdge = trie.nodeEdgeStart[node];
        const cnt = trie.nodeEdgeCount[node];

        let nextNode = -1;
        for (let i = 0; i < cnt; i++) {
            const ei = startEdge + i;
            if (trie.edgeChar[ei] === cu) {
                nextNode = trie.edgeNext[ei];
                break;
            }
        }

        if (nextNode < 0) {
            // mismatch
            if (!bestOutId) {
                cursor.moveTo(start);
                return null;
            }

            const outIndex0 = bestOutId - 1;
            cursor.moveTo(bestEnd);

            return {
                word: trie.outText[outIndex0],
                flags: trie.outFlags[outIndex0],
            };
        }

        node = nextNode;

        if (!cursor.moveNext()) break;
    }

    // EOF 이후 terminal 체크
    const outId = trie.nodeOutId[node];
    if (outId) {
        bestOutId = outId;
        cursor.getPosInto(bestEnd);
    }

    if (!bestOutId) {
        cursor.moveTo(start);
        return null;
    }

    const outIndex0 = bestOutId - 1;
    cursor.moveTo(bestEnd);

    return {
        word: trie.outText[outIndex0],
        flags: trie.outFlags[outIndex0],
    };
}
