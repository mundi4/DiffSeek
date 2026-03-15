// plaintext를 복붙할 때...

export function paragraphizePlainText(plaintext: string, trimLines: boolean = false): DocumentFragment {
    const lines = plaintext.split(/\r?\n/);
    const fragment = document.createDocumentFragment();
    if (lines.length === 1) {
        fragment.appendChild(document.createTextNode(lines[0]));
    } else if (lines.length > 1) {
        for (const line of lines) {
            const p = document.createElement("DIV");
            const trimmedLine = trimLines ? line.trim() : line;
            if (trimmedLine === "") {
                p.appendChild(document.createElement("BR"));
            } else {
                p.textContent = trimmedLine;
            }
            fragment.appendChild(p);
        }
    }
    return fragment;
}