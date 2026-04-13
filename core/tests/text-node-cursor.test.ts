import { describe, it, expect } from "vitest";
import { TextNodeCursor } from "../src/tokenization/text-node-cursor";

function makeTextNodes(...texts: string[]): Text[] {
	return texts.map((t) => document.createTextNode(t));
}

describe("TextNodeCursor", () => {
	describe("basic iteration", () => {
		it("iterates through characters of a single text node", () => {
			const nodes = makeTextNodes("abc");
			const cursor = new TextNodeCursor(nodes);
			const chars: string[] = [];
			while (cursor.moveNext()) {
				chars.push(String.fromCharCode(cursor.current));
			}
			expect(chars).toEqual(["a", "b", "c"]);
		});

		it("iterates across multiple text nodes", () => {
			const nodes = makeTextNodes("ab", "cd");
			const cursor = new TextNodeCursor(nodes);
			const chars: string[] = [];
			while (cursor.moveNext()) {
				chars.push(String.fromCharCode(cursor.current));
			}
			expect(chars).toEqual(["a", "b", "c", "d"]);
		});

		it("handles single-character text nodes", () => {
			const nodes = makeTextNodes("a", "b", "c");
			const cursor = new TextNodeCursor(nodes);
			const chars: string[] = [];
			while (cursor.moveNext()) {
				chars.push(String.fromCharCode(cursor.current));
			}
			expect(chars).toEqual(["a", "b", "c"]);
		});

		it("skips empty text nodes in the middle", () => {
			const nodes = makeTextNodes("a", "", "b");
			const cursor = new TextNodeCursor(nodes);
			const chars: string[] = [];
			while (cursor.moveNext()) {
				chars.push(String.fromCharCode(cursor.current));
			}
			expect(chars).toEqual(["a", "b"]);
		});
	});

	describe("eof", () => {
		it("current is -1 after exhausting all nodes", () => {
			const nodes = makeTextNodes("a");
			const cursor = new TextNodeCursor(nodes);
			cursor.moveNext(); // 'a'
			expect(cursor.eof()).toBe(false);
			cursor.moveNext(); // past end
			expect(cursor.eof()).toBe(true);
			expect(cursor.current).toBe(-1);
		});
	});

	describe("peek", () => {
		it("peeks next character without advancing", () => {
			const nodes = makeTextNodes("ab");
			const cursor = new TextNodeCursor(nodes);
			cursor.moveNext(); // 'a'
			expect(cursor.peek()).toBe("b".charCodeAt(0));
			// cursor should still be at 'a'
			expect(cursor.current).toBe("a".charCodeAt(0));
		});

		it("peeks across text node boundary", () => {
			const nodes = makeTextNodes("a", "b");
			const cursor = new TextNodeCursor(nodes);
			cursor.moveNext(); // 'a'
			expect(cursor.peek()).toBe("b".charCodeAt(0));
		});

		it("returns -1 at end of all nodes", () => {
			const nodes = makeTextNodes("a");
			const cursor = new TextNodeCursor(nodes);
			cursor.moveNext(); // 'a'
			// 'a' is last char, peek should be -1
			expect(cursor.peek()).toBe(-1);
		});
	});

	describe("getPos / moveTo", () => {
		it("getPos returns current position", () => {
			const nodes = makeTextNodes("abc");
			const cursor = new TextNodeCursor(nodes);
			cursor.moveNext(); // 'a'
			cursor.moveNext(); // 'b'
			const pos = cursor.getPos();
			expect(pos).toEqual({ nodeIndex: 0, charIndex: 1 });
		});

		it("moveTo restores position", () => {
			const nodes = makeTextNodes("abc", "def");
			const cursor = new TextNodeCursor(nodes);
			cursor.moveNext(); // 'a'
			cursor.moveNext(); // 'b'
			const saved = cursor.getPos();
			cursor.moveNext(); // 'c'
			cursor.moveNext(); // 'd'

			cursor.moveTo(saved);
			expect(cursor.current).toBe("b".charCodeAt(0));
			expect(cursor.nodeIndex).toBe(0);
			expect(cursor.charIndex).toBe(1);
		});

		it("moveTo returns false at end of node", () => {
			const nodes = makeTextNodes("ab");
			const cursor = new TextNodeCursor(nodes);
			const result = cursor.moveTo({ nodeIndex: 0, charIndex: 2 });
			expect(result).toBe(false);
			expect(cursor.current).toBe(-1);
		});

		it("moveTo throws on invalid nodeIndex", () => {
			const nodes = makeTextNodes("a");
			const cursor = new TextNodeCursor(nodes);
			expect(() => cursor.moveTo({ nodeIndex: 5, charIndex: 0 })).toThrow();
		});
	});

	describe("getPosInto", () => {
		it("writes position into provided object", () => {
			const nodes = makeTextNodes("abc");
			const cursor = new TextNodeCursor(nodes);
			cursor.moveNext();
			cursor.moveNext();
			const pos = { nodeIndex: 0, charIndex: 0 };
			cursor.getPosInto(pos);
			expect(pos).toEqual({ nodeIndex: 0, charIndex: 1 });
		});
	});

	describe("skipWS", () => {
		it("skips whitespace and returns count", () => {
			const nodes = makeTextNodes("  a");
			const cursor = new TextNodeCursor(nodes);
			const skipped = cursor.skipWS();
			expect(skipped).toBe(2);
			expect(cursor.current).toBe("a".charCodeAt(0));
		});

		it("returns 0 when no whitespace", () => {
			const nodes = makeTextNodes("abc");
			const cursor = new TextNodeCursor(nodes);
			const skipped = cursor.skipWS();
			expect(skipped).toBe(0);
			expect(cursor.current).toBe("a".charCodeAt(0));
		});

		it("skips whitespace across node boundaries", () => {
			const nodes = makeTextNodes(" ", " ", "x");
			const cursor = new TextNodeCursor(nodes);
			const skipped = cursor.skipWS();
			expect(skipped).toBe(2);
			expect(cursor.current).toBe("x".charCodeAt(0));
		});

		it("returns total count if all whitespace", () => {
			const nodes = makeTextNodes("   ");
			const cursor = new TextNodeCursor(nodes);
			const skipped = cursor.skipWS();
			expect(skipped).toBe(3);
			expect(cursor.eof()).toBe(true);
		});
	});

	describe("unicode", () => {
		it("iterates Korean characters", () => {
			const nodes = makeTextNodes("가나다");
			const cursor = new TextNodeCursor(nodes);
			const chars: string[] = [];
			while (cursor.moveNext()) {
				chars.push(String.fromCharCode(cursor.current));
			}
			expect(chars).toEqual(["가", "나", "다"]);
		});
	});
});
