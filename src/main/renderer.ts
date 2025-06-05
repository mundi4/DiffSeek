const enum RenderFlags {
	DIFF = 1 << 0,
	SELECTION_HIGHLIGHT = 1 << 1,
	DIFF_GEOMETRY = 1 << 2,
	ALL = DIFF | SELECTION_HIGHLIGHT | DIFF_GEOMETRY,
	LEFT_EDITOR = 1 << 3,
	RIGHT_EDITOR = 1 << 4,
	EDITOR_MASK = LEFT_EDITOR | RIGHT_EDITOR,
}

type EditorRenderRegion = {
	editor: Editor2;
	x: number;
	y: number;
	width: number;
	height: number;
	scrollTop: number;
	scrollLeft: number;
	dirtyFlags: number;
	diffRanges: Range[][] | null;
	diffRenderItems: DiffRenderItem2[] | null;
	diffLineRects: Rect[];
	visibleDiffIndices: Set<number>;
	diffRectsDirty: boolean;
};

type RendererCallbacks = {
	onDiffVisibilityChanged: (editor: EditorName, shown: number[], hidden: number[]) => void;
};

function createRenderer(_container: HTMLElement, _leftEditor: Editor2, _rightEditor: Editor2, callbacks: RendererCallbacks) {
	const DIFF_EXPAND_X = 2;
	const DIFF_EXPAND_Y = 0;
	const DIFF_LINE_EXPAND_Y = 1;
	const DIFF_LINE_FILL_STYLE = "hsl(0 100% 95%)";
	const DIFF_LINE_HEIGHT_MULTIPLIER = 1.1;

	const onDiffVisibilityChanged: (editor: EditorName, shown: number[], hidden: number[]) => void = callbacks.onDiffVisibilityChanged || (() => {});

	const _leftRegion: EditorRenderRegion = {
		editor: _leftEditor,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		scrollTop: 0,
		scrollLeft: 0,
		dirtyFlags: 0,
		diffRanges: null,
		diffRenderItems: null,
		diffLineRects: [],
		diffRectsDirty: false,
		visibleDiffIndices: new Set(),
	};
	const _rightRegion: EditorRenderRegion = {
		editor: _rightEditor,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		scrollTop: 0,
		scrollLeft: 0,
		dirtyFlags: 0,
		diffRanges: null,
		diffRenderItems: null,
		diffLineRects: [],
		diffRectsDirty: false,
		visibleDiffIndices: new Set(),
	};

	let _canvasX: number = 0;
	let _canvasY: number = 0;
	let _canvasWidth: number = 0;
	let _canvasHeight: number = 0;
	let _renderPending: boolean = false;

	let _diffs: DiffRenderItem2[] = [];
	let _selectionHighlight: Range | null = null;
	let _selectionHighlightRects: RectSet | null = null;

	const diffCanvas = document.createElement("canvas");
	const diffCanvasCtx = diffCanvas.getContext("2d")!;
	_container.appendChild(diffCanvas);

	const highlightCanvas = document.createElement("canvas");
	const highlightCanvasCtx = highlightCanvas.getContext("2d")!;
	_container.appendChild(highlightCanvas);

	const resizeObserver = new ResizeObserver((entries) => {
		// updateLayout();
		// render();
	});
	resizeObserver.observe(_container);
	resizeObserver.observe(_leftEditor.wrapper);
	resizeObserver.observe(_rightEditor.wrapper);

	function onEditorScroll(e: Event) {
		// const editor = e.target === _leftEditor.wrapper ? _leftEditor : _rightEditor;
		// const editorName = editor.name;
		// const scrollTop = editor.wrapper.scrollTop;
		// const scrollLeft = editor.wrapper.scrollLeft;
		// const region = editorName === "left" ? _leftRegion : _rightRegion;
		// if (region.scrollTop !== scrollTop || region.scrollLeft !== scrollLeft) {
		// 	region.scrollTop = scrollTop;
		// 	region.scrollLeft = scrollLeft;
		// 	region.dirtyFlags |= RenderFlags.ALL;
		// 	render();
		// }
	}
	_leftEditor.wrapper.addEventListener("scroll", onEditorScroll);
	_rightEditor.wrapper.addEventListener("scroll", onEditorScroll);

	function updateLayout() {
		const { x, y, width, height } = _container.getBoundingClientRect();
		if (_canvasWidth === width && _canvasHeight === height && _canvasX === x && _canvasY === y) {
			return;
		}
		_canvasX = x;
		_canvasY = y;
		_canvasWidth = width;
		_canvasHeight = height;
		diffCanvas.width = width;
		diffCanvas.height = height;
		highlightCanvas.width = width;
		highlightCanvas.height = height;

		for (const editor of [_leftEditor, _rightEditor]) {
			const editorName = editor.name;
			const region = editorName === "left" ? _leftRegion : _rightRegion;
			const { x, y, width, height } = editor.wrapper.getBoundingClientRect();
			region.x = x - _canvasX;
			region.y = y - _canvasY;
			region.width = width;
			region.height = height;
			region.scrollTop = editor.wrapper.scrollTop;
			region.scrollLeft = editor.wrapper.scrollLeft;
			// region.diffRenderItems = null;
			region.dirtyFlags |= RenderFlags.ALL;
		}

		markDirty(RenderFlags.DIFF | RenderFlags.DIFF_GEOMETRY | RenderFlags.LEFT_EDITOR | RenderFlags.RIGHT_EDITOR);
		render();
	}

	let _renderCounter = 0;
	function render() {
		renderEditorRegion("left");
		renderEditorRegion("right");
		renderSelectionHighlight();
	}

	function renderEditorRegion(editorName: EditorName) {
		const region = editorName === "left" ? _leftRegion : _rightRegion;
		if (region.dirtyFlags & RenderFlags.DIFF) {
			let renderItems = region.diffRenderItems;
			if (!renderItems) {
				console.warn("No diff render items found for editor:", editorName);
				return;
			}

			if (region.dirtyFlags & RenderFlags.DIFF_GEOMETRY) {
				buildDiffGeometries(region);
			}

			const ctx = diffCanvasCtx;
			const { scrollLeft, scrollTop } = region.editor;
			console.log("rendering editor region:", editorName, "scrollLeft:", scrollLeft, "scrollTop:", scrollTop);
			ctx.clearRect(region.x, region.y, region.width, region.height);

			let visibleDiffIndices = region.visibleDiffIndices;
			ctx.fillStyle = DIFF_LINE_FILL_STYLE;
			console.log("diffLineRects:", region.diffLineRects);
			for (const rect of region.diffLineRects!) {
				const x = Math.floor(rect.x - scrollLeft),
					y = Math.floor(rect.y - scrollTop),
					width = Math.ceil(rect.width),
					height = Math.ceil(rect.height);

				if (y + height < 0 || y > _canvasHeight) continue;
				if (x + width < 0 || x > _canvasWidth) continue;
				ctx.fillRect(x, y, width, height);
			}

			let shown: number[] = [];
			let hidden: number[] = [];

			for (let diffIndex = 0; diffIndex < renderItems.length; ++diffIndex) {
				const item = renderItems[diffIndex];
				if (!item) {
					continue;
				}

				const geometry = item.geometry!;

				let isVisible =
					!(geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > _canvasHeight) &&
					!(geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > _canvasWidth);

				if (isVisible) {
					if (!visibleDiffIndices.has(diffIndex)) {
						visibleDiffIndices.add(diffIndex);
						shown.push(diffIndex);
					}
				} else {
					if (visibleDiffIndices.has(diffIndex)) {
						visibleDiffIndices.delete(diffIndex);
						hidden.push(diffIndex);
					}
					continue;
				}

				ctx.fillStyle = item.fill;
				ctx.strokeStyle = item.stroke;

				for (const rect of geometry.rects) {
					const x = Math.floor(rect.x - scrollLeft),
						y = Math.floor(rect.y - scrollTop),
						width = Math.ceil(rect.width),
						height = Math.ceil(rect.height);

					if (y + height < 0 || y > _canvasHeight) continue;
					if (x + width < 0 || x > _canvasWidth) continue;
					// console.log("rendering rect:", x, y, width, height, "isVisible:", isVisible);
					ctx.fillRect(x, y, width, height);
					ctx.strokeRect(x, y, width, height);
					// item.renderedRect.push(rect);
				}
			}

			if (shown.length > 0 || hidden.length > 0) {
				onDiffVisibilityChanged(editorName, shown, hidden);
			}
		}
	}

	function renderSelectionHighlight() {
		console.log("Rendering selection highlight:", _selectionHighlight?.toString(), _selectionHighlight);
		const ctx = highlightCanvasCtx;
		ctx.clearRect(0, 0, _canvasWidth, _canvasHeight);

		if (_selectionHighlight) {
			if (!_selectionHighlightRects) {
				const rawRects = extractRects(_selectionHighlight);
				console.log("Raw selection highlight rects:", rawRects);
				_selectionHighlightRects = mergeRects(rawRects, 1, 1);
			}
			console.log("Selection highlight rects:", _selectionHighlightRects);
			ctx.fillStyle = "rgba(128, 128, 128, 0.5)";
			for (const rect of _selectionHighlightRects.rects) {
				const x = Math.floor(rect.x - _canvasX),
					y = Math.floor(rect.y - _canvasY),
					width = Math.ceil(rect.width),
					height = Math.ceil(rect.height);
				ctx.fillRect(x, y, width, height);
			}
		}
	}

	function buildDiffGeometries(region: EditorRenderRegion) {
		const wrapper = region.editor.wrapper;
		const _canvasOffsetX = _canvasX; // + region.x;
		const _canvasOffsetY = _canvasY; // + region.y;

		const scrollTop = wrapper.scrollTop;
		const scrollLeft = wrapper.scrollLeft;
		const offsetX = -_canvasOffsetX + scrollLeft;
		const offsetY = -_canvasOffsetY + scrollTop;

		void region.editor.wrapper.offsetWidth; // force reflow

		const allDiffRects: Rect[] = [];
		if (region.diffRenderItems) {
			for (let diffIndex = 0; diffIndex < region.diffRenderItems.length; diffIndex++) {
				const item = region.diffRenderItems[diffIndex];
				const range = item.range;
				const rawRects = extractRects(range);
				for (const rect of rawRects) {
					rect.x += offsetX - DIFF_EXPAND_X;
					rect.y += offsetY - DIFF_EXPAND_Y;
					rect.width += DIFF_EXPAND_X * 2;
					rect.height += DIFF_EXPAND_Y * 2;
					allDiffRects.push(rect);
				}
				item.geometry = mergeRects(rawRects, 1, 1);
			}
		}

		buildDiffLineRects(region, allDiffRects);
	}

	function buildDiffLineRects(region: EditorRenderRegion, diffRects: Rect[]) {
		const TOLERANCE = 1;

		const _diffLineRects = region.diffLineRects;
		_diffLineRects.length = 0;

		diffRects.sort((a, b) => a.y - b.y);
		const rects: Rect[] = [];

		let lineRect: Rect | null = null;
		for (const rect of diffRects) {
			const y = rect.y - DIFF_LINE_EXPAND_Y;
			const height = rect.height * DIFF_LINE_HEIGHT_MULTIPLIER + DIFF_LINE_EXPAND_Y * 2;
			//const height = rect.height + lineExpand * 2;
			if (lineRect === null || y > lineRect.y + lineRect.height) {
				lineRect = {
					x: region.x,
					y: y,
					width: region.width - 2,
					height: height,
				};
				rects.push(lineRect);
			} else {
				lineRect.height = y + height - lineRect.y;
			}
		}

		if (rects.length > 0) {
			let current = rects[0];

			for (let i = 1; i < rects.length; i++) {
				const next = rects[i];

				const currentBottom = current.y + current.height;
				const nextTop = next.y;
				const gap = nextTop - currentBottom;

				if (gap <= TOLERANCE) {
					const newBottom = Math.max(currentBottom, next.y + next.height);
					current = {
						x: current.x,
						y: current.y,
						width: current.width,
						height: newBottom - current.y,
					};
				} else {
					// 병합 불가: 현재까지 병합된 것 push
					_diffLineRects.push(current);
					current = next;
				}
			}
			_diffLineRects.push(current);
		}

		console.log("Built diff line rects:", _diffLineRects, "for editor:", region.editor.name);
	}

	updateLayout();

	function markDirty(flags: number) {
		const editorFlags = flags & RenderFlags.EDITOR_MASK;
		if (editorFlags & RenderFlags.LEFT_EDITOR) {
			_leftRegion.dirtyFlags |= flags & ~RenderFlags.EDITOR_MASK;
		}
		if (editorFlags & RenderFlags.RIGHT_EDITOR) {
			_rightRegion.dirtyFlags |= flags & ~RenderFlags.EDITOR_MASK;
		}
		render();
	}

	function setDiffs(editorName: EditorName, diffs: DiffRenderItem2[]) {
		const region = editorName === "left" ? _leftRegion : _rightRegion;
		if (region.diffRenderItems !== diffs) {
			region.diffRenderItems = diffs;
			region.diffRectsDirty = true;
			region.dirtyFlags |= RenderFlags.DIFF | RenderFlags.DIFF_GEOMETRY;
		}
	}

	function setSelectionHighlight(range: Range | null) {
		_selectionHighlight = range;
		_selectionHighlightRects = null; // reset cached rects
		markDirty(RenderFlags.SELECTION_HIGHLIGHT);
	}

	function clearSelectionHighlight() {}

	return {
		updateLayout,
		markDirty,
		render,
		setDiffs,
		setSelectionHighlight,
		clearSelectionHighlight,
	};
}
