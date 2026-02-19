export function hashString(str: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }

    const n = h >>> 0;
    return btoa(
        String.fromCharCode(
            (n >>> 24) & 0xff,
            (n >>> 16) & 0xff,
            (n >>> 8) & 0xff,
            n & 0xff
        )
    ).replace(/=+/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
