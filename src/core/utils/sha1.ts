
export async function sha1Hash(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);

    const digest = await crypto.subtle.digest("SHA-1", data);

    // ArrayBuffer → base64
    const bytes = new Uint8Array(digest);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    let b64 = btoa(binary);

    return b64;
}
