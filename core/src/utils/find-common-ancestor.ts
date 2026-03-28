export function findCommonAncestor(a: Node, b: Node): Node | null {
    let cur: Node | null = a;

    while (cur) {
        if (cur.contains(b)) return cur;
        cur = cur.parentNode;
    }

    return null;
}
