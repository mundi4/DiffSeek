import { COMPUTE_DIFF_TIMEOUT, DIFF_COLOR_HUES, NUM_DIFF_COLORS } from "../constants";
import type { EditorPairer } from "./EditorPairer";
import { TokenFlags, type RichToken } from "./tokenization/TokenizeContext";
import { DiffContext } from "./DiffContext";
import { clampRange } from "@/utils/clampRange";
import { findClosestContainer } from "@/utils/findClosestContainer";
import { getHeadingLevelFromFlag } from "@/utils/getHeadingLevelFromFlag";
import { parseOrdinalNumber } from "@/utils/parseOrdinalNumber";
import type { Editor } from "./Editor";
import type { EditorName } from "./types";

// 1회용
export class DiffProcessor {
	#leftEditor: Editor;
	#rightEditor: Editor;
	#editorPairer: EditorPairer;
	#cancelled = false;
	#ricCancelId: number | null = null;
	#leftTokens: readonly RichToken[];
	#rightTokens: readonly RichToken[];
	#diffOptions: DiffOptions;
	#rawDiffs: RawDiff[];
	#diffs: DiffItem[] = [];
	#entries: RawDiff[] | null = null;
	#leftEntries: RawDiff[] | null = null;
	#rightEntries: RawDiff[] | null = null;
	#leftSectionHeadings: SectionHeading[] | null = null;
	#rightSectionHeadings: SectionHeading[] | null = null;

	constructor(leftEditor: Editor, rightEditor: Editor, editorPairer: EditorPairer, rawDiffs: RawDiff[], diffOptions: DiffOptions) {
		// this.#ctx = ctx;
		this.#leftEditor = leftEditor;
		this.#rightEditor = rightEditor;
		this.#editorPairer = editorPairer;
		this.#rawDiffs = rawDiffs;
		this.#diffOptions = diffOptions;

		this.#leftTokens = leftEditor.tokens;
		this.#rightTokens = rightEditor.tokens;
	}

	cancel() {
		this.#cancelled = true;
		if (this.#ricCancelId) {
			cancelIdleCallback(this.#ricCancelId);
			this.#ricCancelId = null;
		}
	}

	process(onComplete?: (diffContext: DiffContext) => void) {
		let generator: Generator<void, void, IdleDeadline> | null = null;
		// const generator = this.#diffFinalizer(diffContext, idleDeadline);
		const step = (idleDeadline: IdleDeadline) => {
			if (this.#cancelled) {
				return;
			}

			if (generator === null) {
				generator = this.#processGenerator(idleDeadline);
			}

			const { done } = generator.next(idleDeadline);
			if (this.#cancelled) {
				return;
			}

			if (done) {
				const diffContext = new DiffContext(
					this.#leftTokens,
					this.#rightTokens,
					this.#diffOptions,
					this.#rawDiffs,
					this.#entries!,
					this.#leftEntries!,
					this.#rightEntries!,
					this.#diffs,
					this.#leftSectionHeadings!,
					this.#rightSectionHeadings!
				);

				onComplete?.(diffContext);
			} else {
				this.#ricCancelId = requestIdleCallback(step, {
					timeout: COMPUTE_DIFF_TIMEOUT,
				});
			}
		};

		this.#ricCancelId = requestIdleCallback(step, {
			timeout: COMPUTE_DIFF_TIMEOUT,
		});
	}

	*#processGenerator(idleDeadline: IdleDeadline): Generator<void, void, IdleDeadline> {
		this.#buildDiffEntries();

		if (idleDeadline.timeRemaining() <= 0) {
			idleDeadline = yield;
		}

		const entries = this.#entries!;

		this.#editorPairer.beginUpdate();

		this.#leftSectionHeadings = this.#buildSectionHeadingTree(this.#leftEditor, this.#leftTokens);
		this.#rightSectionHeadings = this.#buildSectionHeadingTree(this.#rightEditor, this.#rightTokens);

		for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
			if ((entryIndex & 0x1f) === 0) {
				if (idleDeadline.timeRemaining() < 3) {
					idleDeadline = yield;
				}
			}

			if (entries[entryIndex].type === 0) {
				this.#handleCommonEntry(entryIndex);
			} else {
				this.#handleDiffEntry(entryIndex);
			}
		}

		this.#editorPairer.endUpdate();
		console.debug("section headings built:", this.#leftSectionHeadings, this.#rightSectionHeadings);

	}

	#handleCommonEntry(entryIndex: number) {
		const { left, right } = this.#entries![entryIndex];
		const leftTokens = this.#leftTokens;
		const rightTokens = this.#rightTokens;
		const leftToken = leftTokens[left.start];
		const rightToken = rightTokens[right.start];
		const commonFlags = leftToken.flags & rightToken.flags;

		if (commonFlags & TokenFlags.LINE_START) {
			// const leftAnchorFlags = translateTokenFlagsToAnchorFlags(leftToken.flags, leftTokens[left.end - 1].flags);
			// const rightAnchorFlags = translateTokenFlagsToAnchorFlags(rightToken.flags, rightTokens[right.end - 1].flags);
			this.#editorPairer.addAnchorPair(left.start, null, right.start, null, null);
		}
	}

	getAnchorInsertableRange(side: EditorName, tokenIndex: number) {
		const editor = side === "left" ? this.#leftEditor : this.#rightEditor;
		const range = editor.getTokenRange(tokenIndex, 0);
		return range;
	}

	#handleDiffEntry(entryIndex: number) {
		const leftTokens = this.#leftTokens;
		const rightTokens = this.#rightTokens;
		const entries = this.#entries!;
		const diffs = this.#diffs!;
		const diffIndex = diffs.length;
		const entry = entries[entryIndex];
		const { left, right } = entry;
		const { start: leftStart, end: leftEnd } = left;
		const { start: rightStart, end: rightEnd } = right;
		const leftTokenCount = leftEnd - leftStart;
		const rightTokenCount = rightEnd - rightStart;

		const leftToken = leftTokens[leftStart];
		const rightToken = rightTokens[rightStart];
		const hue = DIFF_COLOR_HUES[diffIndex % NUM_DIFF_COLORS];

		let leftRange = this.#leftEditor.getTokenRange(leftStart, leftEnd);
		let rightRange = this.#rightEditor.getTokenRange(rightStart, rightEnd);
		let anchorsEligible = false;
		let leftMarkerEl: HTMLElement | null = null;
		let rightMarkerEl: HTMLElement | null = null;

		if (leftTokenCount > 0 && rightTokenCount > 0) {
			const commonFlags = leftToken.flags & rightToken.flags;
			if (commonFlags & TokenFlags.LINE_START) {
				anchorsEligible = true;
			}
		} else {
			let emptySide: EditorName;
			let emptyRange: Range;
			let filledTokens;
			let filledSpan: Span;
			let markerEl: HTMLElement | null = null;

			if (leftTokenCount > 0) {
				emptySide = "right";
				emptyRange = rightRange;
				filledTokens = this.#leftEditor.tokens;
				filledSpan = left;
			} else {
				emptySide = "left";
				emptyRange = leftRange;
				filledTokens = this.#rightEditor.tokens;
				filledSpan = right;
			}

			const filledStartToken = filledTokens[filledSpan.start];
			let prevCommonFlags = 0,
				nextCommonFlags = 0;

			if (entryIndex > 0) {
				const prevEntry = entries[entryIndex - 1];
				if (prevEntry.type === 0) {
					prevCommonFlags = leftTokens[prevEntry.left.end - 1].flags & rightTokens[prevEntry.right.end - 1].flags;
				}
			}

			if (entryIndex < entries.length - 1) {
				const nextEntry = entries[entryIndex + 1];
				if (nextEntry.type === 0) {
					nextCommonFlags = leftTokens[nextEntry.left.start].flags & rightTokens[nextEntry.right.start].flags;
				}
			}

			const filledStartFlags = filledStartToken.flags;
			if (filledStartFlags & (TokenFlags.TABLE_START | TokenFlags.TABLEROW_START | TokenFlags.TABLECELL_START)) {
				let clampedEmptyRange = this.#clampRangeByStructure(emptyRange, filledStartFlags, prevCommonFlags, nextCommonFlags);
				markerEl = this.#editorPairer.insertDiffMarker(emptySide, clampedEmptyRange, filledStartFlags, diffIndex);
				anchorsEligible = !!markerEl;
			}
			if (!markerEl && filledStartFlags & TokenFlags.LINE_START) {
				markerEl = this.#editorPairer.insertDiffMarker(emptySide, emptyRange, TokenFlags.LINE_START, diffIndex);
				anchorsEligible = !!markerEl;
			}

			if (!markerEl) {
				markerEl = this.#editorPairer.insertDiffMarker(emptySide, emptyRange, 0, diffIndex);
			}

			if (markerEl) {
				emptyRange = document.createRange();
				emptyRange.selectNode(markerEl);
			}

			if (leftTokenCount > 0) {
				rightMarkerEl = markerEl;
				rightRange = emptyRange;
			} else {
				leftMarkerEl = markerEl;
				leftRange = emptyRange;
			}
		}

		diffs.push({
			diffIndex,
			hue,
			leftRange,
			rightRange,
			leftSpan: { start: leftStart, end: leftEnd },
			rightSpan: { start: rightStart, end: rightEnd },
			leftMarkerEl,
			rightMarkerEl,
		});

		if (anchorsEligible) {
			this.#editorPairer.addAnchorPair(left.start, leftMarkerEl, right.start, rightMarkerEl, diffIndex);
		}
	}

	#clampRangeByStructure(range: Range, hintFlags: TokenFlags, prevCommonFlags: TokenFlags, nextCommonFlags: TokenFlags): Range {
		let clampAfter: HTMLElement | null = null;
		let clampBefore: HTMLElement | null = null;

		if (hintFlags & TokenFlags.TABLE_START && prevCommonFlags & TokenFlags.TABLE_END) {
			clampAfter = findClosestContainer(range.endContainer, "table");
		} else if (hintFlags & TokenFlags.TABLEROW_START && prevCommonFlags & TokenFlags.TABLEROW_END) {
			clampAfter = findClosestContainer(range.endContainer, "tr");
		} else if (hintFlags & TokenFlags.TABLECELL_START && prevCommonFlags & TokenFlags.TABLECELL_END) {
			clampAfter = findClosestContainer(range.endContainer, "td");
		}

		if (hintFlags & TokenFlags.TABLE_START && nextCommonFlags & TokenFlags.TABLE_START) {
			clampBefore = findClosestContainer(range.startContainer, "table");
		} else if (hintFlags & TokenFlags.TABLEROW_START && nextCommonFlags & TokenFlags.TABLEROW_START) {
			clampBefore = findClosestContainer(range.startContainer, "tr");
		} else if (hintFlags & TokenFlags.TABLECELL_START && nextCommonFlags & TokenFlags.TABLECELL_START) {
			clampBefore = findClosestContainer(range.startContainer, "td");
		}

		if (clampAfter || clampBefore) {
			const cloned = range.cloneRange();
			return clampRange(cloned, clampAfter, clampBefore);
		} else {
			return range;
		}
	}

	#buildDiffEntries() {
		const entries: RawDiff[] = [];
		const leftEntries: RawDiff[] = new Array(this.#leftTokens.length);
		const rightEntries: RawDiff[] = new Array(this.#rightTokens.length);

		const rawDiffs = this.#rawDiffs;
		let currentDiff: RawDiff | null = null;
		for (let i = 0; i < rawDiffs.length; i++) {
			const rawEntry = rawDiffs[i];
			const { left, right, type } = rawEntry;
			if (type) {
				if (currentDiff) {
					console.assert(currentDiff.left.end === left.start, currentDiff, rawEntry);
					console.assert(currentDiff.right.end === right.start, currentDiff, rawEntry);
					currentDiff.type |= type;
					currentDiff.left.end = left.end;
					currentDiff.right.end = right.end;
				} else {
					currentDiff = { left: { ...left }, right: { ...right }, type };
				}
			} else {
				if (currentDiff) {
					entries.push(currentDiff);
					for (let j = currentDiff.left.start; j < currentDiff.left.end; j++) {
						leftEntries[j] = currentDiff;
					}
					for (let j = currentDiff.right.start; j < currentDiff.right.end; j++) {
						rightEntries[j] = currentDiff;
					}
					currentDiff = null;
				}

				// type=0인 entry는 클론 없이 그냥 사용해도 된다. 바뀔 일이 전혀 없다.
				entries.push(rawEntry);
				for (let j = left.start; j < left.end; j++) {
					leftEntries[j] = rawEntry;
				}
				for (let j = right.start; j < right.end; j++) {
					rightEntries[j] = rawEntry;
				}
			}
		}
		if (currentDiff) {
			entries.push(currentDiff);
			for (let j = currentDiff.left.start; j < currentDiff.left.end; j++) {
				leftEntries[j] = currentDiff;
			}
			for (let j = currentDiff.right.start; j < currentDiff.right.end; j++) {
				rightEntries[j] = currentDiff;
			}
		}

		this.#entries = entries;
		this.#leftEntries = leftEntries;
		this.#rightEntries = rightEntries;
	}

	#buildSectionHeadingTree(editor: Editor, tokens: readonly RichToken[]): SectionHeading[] {
		const rootHeadings: SectionHeading[] = [];
		const stack: SectionHeading[] = [];

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const headingFlag = token.flags & TokenFlags.SECTION_HEADING_MASK;
			if (!headingFlag) continue;

			const level = getHeadingLevelFromFlag(headingFlag);
			const ordinalText = token.text;
			const ordinalNum = parseOrdinalNumber(ordinalText);

			let titleEndTokenIndex = i;
			while (titleEndTokenIndex < tokens.length && (tokens[titleEndTokenIndex++].flags & TokenFlags.LINE_END) === 0);

			const tokenRange = editor.getTokenRange(i + 1, titleEndTokenIndex);
			const title = tokenRange.toString();

			const heading: SectionHeading = {
				type: headingFlag,
				level,
				ordinalText,
				ordinalNum,
				title,
				parent: null,
				firstChild: null,
				nextSibling: null,
				startTokenIndex: i,
				endTokenIndex: Number.MAX_SAFE_INTEGER, // temp
			};

			while (stack.length > 0 && heading.level <= stack[stack.length - 1].level) {
				const closed = stack.pop()!;
				closed.endTokenIndex = heading.startTokenIndex;
			}

			if (stack.length === 0) {
				rootHeadings.push(heading);
			} else {
				const parent = stack[stack.length - 1];
				heading.parent = parent;
				if (!parent.firstChild) {
					parent.firstChild = heading;
				} else {
					let sibling = parent.firstChild;
					while (sibling.nextSibling) sibling = sibling.nextSibling;
					sibling.nextSibling = heading;
				}
			}

			stack.push(heading);
		}

		// 아직 닫히지 않은 것들은 문서 끝까지 범위로 간주
		for (const remaining of stack) {
			remaining.endTokenIndex = tokens.length;
		}

		return rootHeadings;
	}
}
