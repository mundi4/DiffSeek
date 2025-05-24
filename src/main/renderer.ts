const enum RenderFlags {
	DIFF = 1 << 0,
	HIGHLIGHT = 1 << 1,
	ALL = DIFF | HIGHLIGHT,
}

type EditorRenderRegion = {
	editor: Editor;
	x: number;
	y: number;
	width: number;
	height: number;
	scrollTop: number;
	scrollLeft: number;
	dirtyFlags: number;
	diffRanges: Range[][] | null;
	diffRenderItems: DiffRenderItem[] | null;
	diffLineRects: Rect[] | null;
	visibleDiffIndices: Set<number>;
};

type DiffRenderItem = {
	editor: EditorName;
	diffIndex: number;
	fill: string;
	stroke: string;
	rects: Rect[];
	renderedRect: Rect[];
} & RenderBounds;

type RendererCallbacks = {
	onDiffVisibilityChanged: (editor: EditorName, shown: number[], hidden: number[]) => void;
};

type EditorContext = {};

function createRenderer(_container: HTMLElement, _leftEditor: Editor, _rightEditor: Editor, callbacks: RendererCallbacks) {
	// diff index to rect array(하나의 diff가 여러개의 rect를 가질 수 있음)

	const DIFF_LINE_HEIGHT_MULTIPLIER = 1.1;
	const DIFF_LINE_EXPAND_Y = 4;
	const DIFF_LINE_FILL_STYLE = "hsl(0 100% 95%)";

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
		diffLineRects: null,
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
		diffLineRects: null,
		visibleDiffIndices: new Set(),
	};

	let _canvasX: number = 0;
	let _canvasY: number = 0;
	let _canvasWidth: number = 0;
	let _canvasHeight: number = 0;
	let _textHighlights: Range[] | null = null;
	let _renderPending: boolean = false;

	const diffCanvas = document.createElement("canvas");
	const diffCanvasCtx = diffCanvas.getContext("2d")!;
	_container.appendChild(diffCanvas);

	const highlightCanvas = document.createElement("canvas");
	const highlightCanvasCtx = highlightCanvas.getContext("2d")!;
	_container.appendChild(highlightCanvas);

	const resizeObserver = new ResizeObserver((entries) => {
		updateLayout();
		render();
	});
	resizeObserver.observe(_container);
	resizeObserver.observe(_leftEditor.wrapper);
	resizeObserver.observe(_rightEditor.wrapper);

	function onEditorScroll(e: Event) {
		const editor = e.target === _leftEditor.wrapper ? _leftEditor : _rightEditor;
		const editorName = editor.name;
		const scrollTop = editor.wrapper.scrollTop;
		const scrollLeft = editor.wrapper.scrollLeft;
		const region = editorName === "left" ? _leftRegion : _rightRegion;
		if (region.scrollTop !== scrollTop || region.scrollLeft !== scrollLeft) {
			region.scrollTop = scrollTop;
			region.scrollLeft = scrollLeft;
			region.dirtyFlags |= RenderFlags.ALL;
			render();
		}
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
			region.diffRenderItems = null;
			region.dirtyFlags |= RenderFlags.ALL;
		}
		render();
	}

	function setTextHighlight(region: EditorName, ranges: Range[]) {}

	function setDiffRanges(editor: EditorName, ranges: Range[][]) {
		const region = editor === "left" ? _leftRegion : _rightRegion;
		region.diffRanges = ranges;
		region.diffRenderItems = null;
		region.dirtyFlags |= RenderFlags.DIFF;
		render();
	}

	let _renderCounter = 0;
	function render() {
		if (_renderPending) {
			return;
		}
		_renderPending = true;
		requestAnimationFrame(() => {
			++_renderCounter;
			if (_leftRegion.dirtyFlags !== 0) {
				renderEditorRegion("left");
				_leftRegion.dirtyFlags = 0;
			}
			if (_rightRegion.dirtyFlags !== 0) {
				renderEditorRegion("right");
				_rightRegion.dirtyFlags = 0;
			}
			_renderPending = false;
		});
	}

	function renderEditorRegion(editorName: EditorName) {
		const region = editorName === "left" ? _leftRegion : _rightRegion;
		if (region.dirtyFlags & RenderFlags.DIFF) {
			const ctx = diffCanvasCtx;
			const { scrollLeft, scrollTop } = region;
			ctx.clearRect(region.x, region.y, region.width, region.height);

			let visibleDiffIndices = region.visibleDiffIndices;
			let renderItems = region.diffRenderItems;

			if (!renderItems) {
				buildDiffRenderItems(region);
				console.log("buildDiffRenderItems!!:", region);
				renderItems = region.diffRenderItems!;
			}

			// render diff lines
			ctx.fillStyle = DIFF_LINE_FILL_STYLE;
			console.log("diffLineRects:",region.diffLineRects)
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
				item.renderedRect.length = 0;

				let isVisible =
					!(item.maxY - scrollTop < 0 || item.minY - scrollTop > _canvasHeight) &&
					!(item.maxX - scrollLeft < 0 || item.minX - scrollLeft > _canvasWidth);

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

				for (const rect of item.rects) {
					const x = Math.floor(rect.x - scrollLeft),
						y = Math.floor(rect.y - scrollTop),
						width = Math.ceil(rect.width),
						height = Math.ceil(rect.height);

					if (y + height < 0 || y > _canvasHeight) continue;
					if (x + width < 0 || x > _canvasWidth) continue;

					ctx.fillRect(x, y, width, height);
					ctx.strokeRect(x, y, width, height);
					item.renderedRect.push(rect);
				}
			}

			if (shown.length > 0 || hidden.length > 0) {
				onDiffVisibilityChanged(editorName, shown, hidden);
			}
		}
	}

	function buildDiffRenderItems(region: EditorRenderRegion) {
		const rangesMap = region.diffRanges;
		if (!rangesMap || rangesMap.length === 0) {
			region.diffRenderItems = [];
			region.diffLineRects = [];
			return [];
		}
		
		const expandX = 1;
		const expandY = 0;

		const { left: canvasLeft, right: canvasRight } = diffCanvas.getBoundingClientRect();
		const { x: regionX, y: regionY, width: regionWidth, height: regionHeight, scrollLeft, scrollTop } = region;
		const offsetX = scrollLeft;
		const offsetY = scrollTop;
		const result: DiffRenderItem[] = new Array(rangesMap.length);

		const allRects: Rect[] = [];
		for (let diffIndex = 0; diffIndex < rangesMap.length; ++diffIndex) {
			const ranges = rangesMap[diffIndex];
			const hue = DIFF_COLOR_HUES[diffIndex % NUM_DIFF_COLORS];
			const rawRects: Rect[] = [];
			for (const range of ranges) {
				const clientRects = range.getClientRects();
				for (let i = 0; i < clientRects.length; ++i) {
					const rect = {
						x: clientRects[i].x + offsetX - expandX,
						y: clientRects[i].y + offsetY - expandY,
						width: clientRects[i].width + expandX * 2,
						height: clientRects[i].height + expandY * 2,
					};
					rawRects.push(rect);
					allRects.push(rect);
				}
			}
			const merged = mergeRects(rawRects);
			result[diffIndex] = {
				diffIndex,
				editor: region.editor.name,
				minX: merged.minX,
				minY: merged.minY,
				maxX: merged.maxX,
				maxY: merged.maxY,
				rects: merged.rects,
				fill: `hsl(${hue} 100% 80%)`,
				stroke: `hsl(${hue} 100% 40% / 0.5)`,
				renderedRect: [],
			};
		}

		region.diffRenderItems = result;
		buildDiffLineRects(region, allRects);
		
		return result;
	}

	function buildDiffLineRects(region: EditorRenderRegion, diffRects: Rect[]) {
		diffRects.sort((a, b) => a.y - b.y);

		const result: Rect[] = [];
		let lineRect: Rect | null = null;

		for (const rect of diffRects) {
			const y = rect.y - DIFF_LINE_EXPAND_Y;
			const height = rect.height * DIFF_LINE_HEIGHT_MULTIPLIER + DIFF_LINE_EXPAND_Y * 2;
			//const height = rect.height + lineExpand * 2;
			if (lineRect === null || y > lineRect.y + lineRect.height) {
				lineRect = {
					x: region.x,
					y: y,
					width: region.width,
					height: height,
				};
				result.push(lineRect);
			} else {
				lineRect.height = y + height - lineRect.y;
			}
		}

		region.diffLineRects = result;
		console.log("diffLineRects:", result);
	}

	updateLayout();

	function markDirty(editor: EditorName, flags: number) {
		const region = editor === "left" ? _leftRegion : _rightRegion;
		region.dirtyFlags |= flags;
		if (region.dirtyFlags & RenderFlags.DIFF) {
			region.diffRenderItems = null;
		}
		render();
	}

	return {
		updateLayout,
		setDiffRanges,
		markDirty,
	};
}
