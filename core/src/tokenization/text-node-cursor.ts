import { CHAR_META } from "../char-meta";
import { CM_WS } from "../char-meta-flags";

export interface TextPos {
	nodeIndex: number;
	charIndex: number;
}

export class TextNodeCursor {
	private readonly nodes: ArrayLike<Text>;
	private readonly nodeCount: number;

	public nodeIndex: number = 0;
	public charIndex: number = -1; // -1이면 아직 시작 안 함
	public current: number = -1; // 현재 code unit

	private text: string = "";
	private len: number = 0;

	constructor(nodes: ArrayLike<Text>) {
		if (import.meta.env.DEV) {
			if (nodes.length === 0) {
				throw new Error("TextNodeCursor requires at least one text node");
			}
			for (let i = 0; i < nodes.length; i++) {
				const n = nodes[i];
				if (n?.nodeType !== Node.TEXT_NODE) {
					throw new Error(`Invalid node at index ${i}: expected TEXT_NODE, got ${n.nodeType}`);
				}
			}
		}
		this.nodes = nodes;
		this.nodeCount = nodes.length;
		this.loadNode(0);
	}

	// -----------------------------
	// iteration
	// -----------------------------

	public moveNext(): boolean {
		let ni = this.nodeIndex;
		let ci = this.charIndex + 1;

		while (ni < this.nodeCount) {
			let text: string;
			let len: number;

			if (ni === this.nodeIndex) {
				text = this.text;
				len = this.len;
			} else {
				const n = this.nodes[ni];
				text = n.data;
				len = n.length;
			}

			if (ci < len) {
				this.nodeIndex = ni;
				this.charIndex = ci;
				this.text = text;
				this.len = len;
				this.current = text.charCodeAt(ci);
				return true;
			}

			ni++;
			ci = 0;
		}

		// EOF: 마지막 노드의 끝 좌표
		const last = this.nodeCount - 1;
		this.nodeIndex = last;
		this.charIndex = this.nodes[last].length;
		this.current = -1;
		return false;
	}

	public moveTo({ nodeIndex, charIndex }: TextPos): boolean {
		if (nodeIndex < 0 || nodeIndex >= this.nodeCount) {
			throw new RangeError("Invalid nodeIndex");
		}

		const n = this.nodes[nodeIndex];
		const len = n.length;

		this.nodeIndex = nodeIndex;
		this.charIndex = charIndex;
		this.text = n.data;
		this.len = len;

		if (charIndex < len) {
			this.current = this.text.charCodeAt(charIndex);
			return true;
		}

		// EOF 위치라면
		this.current = -1;
		return false;
	}

	public peek(): number {
		let ni = this.nodeIndex;
		let ci = this.charIndex + 1;

		while (ni < this.nodeCount) {
			const text = ni === this.nodeIndex ? this.text : (this.nodes[ni].nodeValue ?? "");

			const len = ni === this.nodeIndex ? this.len : text.length;

			if (ci < len) {
				return text.charCodeAt(ci);
			}

			ni++;
			ci = 0;
		}

		return -1; // EOF
	}

	public eof(): boolean {
		return this.current < 0;
	}

	public skipWS(): number {
		let n = 0;
		while (this.moveNext()) {
			if (!(CHAR_META[this.current] & CM_WS)) {
				return n;
			}
			n++;
		}
		return n;
	}

	public getPos(): TextPos {
		return { nodeIndex: this.nodeIndex, charIndex: this.charIndex };
	}

	public getPosInto(out: TextPos): void {
		out.nodeIndex = this.nodeIndex;
		out.charIndex = this.charIndex;
	}

	// -----------------------------
	// internals
	// -----------------------------

	private loadNode(index: number): void {
		const n = this.nodes[index];
		this.text = n.data;
		this.len = n.length;
	}
}
