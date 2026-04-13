import { describe, it, expect } from "vitest";
import { hashString } from "../src/utils/hash-string";
import { deepMerge } from "../src/utils/deep-merge";
import { createEvent } from "../src/utils/create-event";
import { getDiffHue } from "../src/utils/get-diff-hue";
import { advanceNode } from "../src/utils/advance-node";
import { findCommonAncestor } from "../src/utils/find-common-ancestor";
import { findAdjacentTextNode } from "../src/utils/find-adjacent-text-node";

// ── hashString ──────────────────────────────────────────────────

describe("hashString", () => {
	it("returns a string for any input", () => {
		expect(typeof hashString("hello")).toBe("string");
		expect(typeof hashString("")).toBe("string");
	});

	it("is deterministic", () => {
		expect(hashString("abc")).toBe(hashString("abc"));
		expect(hashString("")).toBe(hashString(""));
	});

	it("produces different results for different inputs", () => {
		const a = hashString("hello");
		const b = hashString("world");
		const c = hashString("hello!");
		expect(a).not.toBe(b);
		expect(a).not.toBe(c);
	});

	it("returns base64url-safe characters only", () => {
		const result = hashString("test string 한글 日本語");
		expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it("handles unicode", () => {
		const a = hashString("한글");
		const b = hashString("한글");
		expect(a).toBe(b);
		expect(hashString("가")).not.toBe(hashString("나"));
	});
});

// ── deepMerge ───────────────────────────────────────────────────

describe("deepMerge", () => {
	it("merges flat properties", () => {
		const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 } as any);
		expect(result).toEqual({ a: 1, b: 3, c: 4 });
	});

	it("merges nested objects", () => {
		const result = deepMerge({ nested: { x: 1, y: 2 } }, { nested: { y: 3 } });
		expect(result.nested.x).toBe(1);
		expect(result.nested.y).toBe(3);
	});

	it("overwrites arrays (does not merge them)", () => {
		const result = deepMerge({ arr: [1, 2, 3] }, { arr: [4, 5] });
		expect(result.arr).toEqual([4, 5]);
	});

	it("returns the target object (mutates in-place)", () => {
		const target = { a: 1 };
		const result = deepMerge(target, { b: 2 } as any);
		expect(result).toBe(target);
	});

	it("handles undefined source values", () => {
		const result = deepMerge({ a: 1, b: 2 }, { a: undefined } as any);
		expect(result.a).toBeUndefined();
	});
});

// ── createEvent ─────────────────────────────────────────────────

describe("createEvent", () => {
	it("emits to registered handlers", () => {
		const event = createEvent<number>();
		const received: number[] = [];
		event.on((n) => received.push(n));
		event.emit(42);
		expect(received).toEqual([42]);
	});

	it("supports multiple handlers in order", () => {
		const event = createEvent<string>();
		const order: number[] = [];
		event.on(() => order.push(1));
		event.on(() => order.push(2));
		event.on(() => order.push(3));
		event.emit("test");
		expect(order).toEqual([1, 2, 3]);
	});

	it("removes handlers with off()", () => {
		const event = createEvent<number>();
		const received: number[] = [];
		const handler = (n: number) => received.push(n);
		event.on(handler);
		event.emit(1);
		event.off(handler);
		event.emit(2);
		expect(received).toEqual([1]);
	});

	it("off() is a no-op for unregistered handlers", () => {
		const event = createEvent<number>();
		const handler = (_n: number) => {};
		event.off(handler); // should not throw
	});

	it("emits nothing when no handlers registered", () => {
		const event = createEvent<void>();
		event.emit(undefined as any); // should not throw
	});
});

// ── getDiffHue ──────────────────────────────────────────────────

describe("getDiffHue", () => {
	it("returns hue at matching index", () => {
		const hues = [10, 20, 30];
		expect(getDiffHue(0, hues)).toBe(10);
		expect(getDiffHue(1, hues)).toBe(20);
		expect(getDiffHue(2, hues)).toBe(30);
	});

	it("wraps around with modulo", () => {
		const hues = [10, 20, 30];
		expect(getDiffHue(3, hues)).toBe(10);
		expect(getDiffHue(5, hues)).toBe(30);
	});

	it("returns fallback (30) for empty array", () => {
		expect(getDiffHue(0, [])).toBe(30);
		expect(getDiffHue(5, [])).toBe(30);
	});
});

// ── advanceNode ─────────────────────────────────────────────────

describe("advanceNode", () => {
	it("walks into first child", () => {
		const parent = document.createElement("div");
		const child = document.createElement("span");
		parent.appendChild(child);
		expect(advanceNode(parent)).toBe(child);
	});

	it("walks to next sibling when skipChildren is true", () => {
		const parent = document.createElement("div");
		const a = document.createElement("span");
		const b = document.createElement("span");
		parent.appendChild(a);
		parent.appendChild(b);
		expect(advanceNode(a, parent, true)).toBe(b);
	});

	it("walks up to parent's sibling", () => {
		const root = document.createElement("div");
		const a = document.createElement("p");
		const b = document.createElement("p");
		root.appendChild(a);
		root.appendChild(b);
		const text = document.createTextNode("hi");
		a.appendChild(text);
		// From text node, skip children → should go to b (parent's next sibling)
		expect(advanceNode(text, root, true)).toBe(b);
	});

	it("returns null when at rootNode boundary", () => {
		const root = document.createElement("div");
		const child = document.createElement("span");
		root.appendChild(child);
		expect(advanceNode(child, root, true)).toBe(null);
	});

	it("returns null for single node with no children", () => {
		const node = document.createElement("div");
		expect(advanceNode(node, node)).toBe(null);
	});
});

// ── findCommonAncestor ──────────────────────────────────────────

describe("findCommonAncestor", () => {
	it("finds common ancestor of siblings", () => {
		const parent = document.createElement("div");
		const a = document.createElement("span");
		const b = document.createElement("span");
		parent.appendChild(a);
		parent.appendChild(b);
		expect(findCommonAncestor(a, b)).toBe(parent);
	});

	it("returns the node itself if it contains the other", () => {
		const parent = document.createElement("div");
		const child = document.createElement("span");
		parent.appendChild(child);
		expect(findCommonAncestor(parent, child)).toBe(parent);
	});

	it("finds ancestor for deeply nested nodes", () => {
		const root = document.createElement("div");
		const left = document.createElement("div");
		const right = document.createElement("div");
		root.appendChild(left);
		root.appendChild(right);
		const deepLeft = document.createElement("span");
		left.appendChild(deepLeft);
		const deepRight = document.createElement("span");
		right.appendChild(deepRight);
		expect(findCommonAncestor(deepLeft, deepRight)).toBe(root);
	});
});

// ── findAdjacentTextNode ────────────────────────────────────────

describe("findAdjacentTextNode", () => {
	it("finds adjacent text node in same block", () => {
		const block = document.createElement("p");
		const marker = document.createElement("span");
		const text = document.createTextNode("hello");
		block.appendChild(marker);
		block.appendChild(text);
		document.body.appendChild(block);
		try {
			// Starting from marker, find next text sibling
			const result = findAdjacentTextNode(marker);
			expect(result).toBe(text);
		} finally {
			document.body.removeChild(block);
		}
	});

	it("returns null when no adjacent text node exists", () => {
		const block = document.createElement("p");
		const span = document.createElement("span");
		block.appendChild(span);
		document.body.appendChild(block);
		try {
			expect(findAdjacentTextNode(span)).toBe(null);
		} finally {
			document.body.removeChild(block);
		}
	});

	it("skips empty text nodes when skipEmpty is true", () => {
		const block = document.createElement("p");
		const empty = document.createTextNode("");
		const real = document.createTextNode("content");
		block.appendChild(empty);
		block.appendChild(real);
		document.body.appendChild(block);
		try {
			const result = findAdjacentTextNode(empty, true);
			expect(result).toBe(real);
		} finally {
			document.body.removeChild(block);
		}
	});
});
