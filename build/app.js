(function (jsxRuntime, client, React, clsx, jotai, utils, reactSlot, dynamic, DropdownMenuPrimitive, ToggleGroupPrimitive, TogglePrimitive) {
	'use strict';

	function _interopNamespaceDefault(e) {
		const n = Object.create(null, { [Symbol.toStringTag]: { value: 'Module' } });
		if (e) {
			for (const k in e) {
				if (k !== 'default') {
					const d = Object.getOwnPropertyDescriptor(e, k);
					Object.defineProperty(n, k, d.get ? d : {
						enumerable: true,
						get: () => e[k]
					});
				}
			}
		}
		n.default = e;
		return Object.freeze(n);
	}

	const React__namespace = /*#__PURE__*/_interopNamespaceDefault(React);
	const DropdownMenuPrimitive__namespace = /*#__PURE__*/_interopNamespaceDefault(DropdownMenuPrimitive);
	const ToggleGroupPrimitive__namespace = /*#__PURE__*/_interopNamespaceDefault(ToggleGroupPrimitive);
	const TogglePrimitive__namespace = /*#__PURE__*/_interopNamespaceDefault(TogglePrimitive);

	var root$5 = 'EditorShell_root__12kfwnu0';

	const EditorShell = React.forwardRef(({ editor, className }, ref) => {
	  const containerRef = React.useRef(null);
	  React.useEffect(() => {
	    if (!containerRef.current) return;
	    editor.mount(containerRef.current);
	    return () => {
	      editor.unmount();
	    };
	  }, [editor, containerRef.current]);
	  React.useImperativeHandle(ref, () => ({
	    getEditor: () => editor,
	    getRootElement: () => containerRef.current
	  }));
	  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: clsx(root$5, className), ref: containerRef });
	});

	function mergeRects(rects, toleranceX = 0, toleranceY = 0) {
	  rects.sort((a, b) => a.y - b.y || a.x - b.x);
	  const merged = [];
	  const used = new Array(rects.length).fill(false);
	  let minX = Number.MAX_SAFE_INTEGER;
	  let minY = Number.MAX_SAFE_INTEGER;
	  let maxX = 0;
	  let maxY = 0;
	  for (let i = 0; i < rects.length; i++) {
	    if (used[i]) continue;
	    let base = rects[i];
	    for (let j = i + 1; j < rects.length; j++) {
	      if (used[j]) continue;
	      const compare = rects[j];
	      const sameY = Math.abs(base.y - compare.y) <= toleranceY && Math.abs(base.height - compare.height) <= toleranceY;
	      if (!sameY) continue;
	      const baseRight = base.x + base.width;
	      const compareRight = compare.x + compare.width;
	      const xOverlapOrClose = baseRight >= compare.x - toleranceX && compareRight >= base.x - toleranceX;
	      if (xOverlapOrClose) {
	        const newX = Math.min(base.x, compare.x);
	        const newRight = Math.max(baseRight, compareRight);
	        base = {
	          x: newX,
	          y: Math.min(base.y, compare.y),
	          width: newRight - newX,
	          height: Math.max(base.height, compare.height)
	        };
	        used[j] = true;
	      }
	    }
	    merged.push(base);
	    used[i] = true;
	    minX = Math.min(minX, base.x);
	    minY = Math.min(minY, base.y);
	    maxX = Math.max(maxX, base.x + base.width);
	    maxY = Math.max(maxY, base.y + base.height);
	  }
	  return {
	    minX,
	    minY,
	    maxX,
	    maxY,
	    rects: merged
	  };
	}

	const COMPUTE_DIFF_TIMEOUT = 500;
	const DIFF_COLOR_HUES = [
	  30,
	  // 주황?
	  180,
	  // cyan
	  300,
	  // 핑크?
	  120,
	  // 초록
	  240,
	  // 파랑
	  60,
	  // 노랑
	  270
	  // 보라?
	];
	const NUM_DIFF_COLORS = DIFF_COLOR_HUES.length;
	const BASE_FONT_SIZE = 16;
	const LINE_HEIGHT = 1.5;
	const EDITOR_SCROLL_MARGIN = LINE_HEIGHT * 2 * BASE_FONT_SIZE;
	const HANGUL_ORDER = "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허";
	const VOID_ELEMENTS = {
	  AREA: true,
	  BASE: true,
	  BR: true,
	  COL: true,
	  COMMAND: true,
	  EMBED: true,
	  HR: true,
	  IMG: true,
	  INPUT: true,
	  LINK: true,
	  META: true,
	  PARAM: true,
	  SOURCE: true,
	  TRACK: true,
	  WBR: true
	};
	const TEXTLESS_ELEMENTS = {
	  ...VOID_ELEMENTS,
	  VIDEO: true,
	  AUDIO: true,
	  OBJECT: true,
	  CANVAS: true,
	  SVG: true,
	  TABLE: true,
	  THEAD: true,
	  TBODY: true,
	  TFOOT: true,
	  TR: true,
	  OL: true,
	  UL: true,
	  DL: true,
	  STYLE: true,
	  HEAD: true,
	  TITLE: true,
	  SCRIPT: true
	};
	const TEXT_FLOW_CONTAINERS = {
	  TD: true,
	  TH: true
	  // DIV: true,
	  // PRE: true,
	  // BLOCKQUOTE: true,
	  // LI: true,
	  // SECTION: true,
	  // ARTICLE: true,
	  // HEADER: true,
	  // FOOTER: true,
	  // ASIDE: true,
	  // MAIN: true,
	  // CAPTION: true,
	  // FIGURE: true,
	  // FIGCAPTION: true,
	};
	const BLOCK_ELEMENTS = {
	  DD: true,
	  DT: true,
	  DIV: true,
	  P: true,
	  H1: true,
	  H2: true,
	  H3: true,
	  H4: true,
	  H5: true,
	  H6: true,
	  UL: true,
	  OL: true,
	  LI: true,
	  BLOCKQUOTE: true,
	  FORM: true,
	  HEADER: true,
	  FOOTER: true,
	  ARTICLE: true,
	  SECTION: true,
	  ASIDE: true,
	  NAV: true,
	  ADDRESS: true,
	  FIGURE: true,
	  FIGCAPTION: true,
	  TABLE: true,
	  CAPTION: true,
	  TR: true,
	  //TD: true,
	  "#document-fragment": true
	};
	const FRAME_BUDGET_MS = 1e3 / 60;
	const ANCHOR_TAG_NAME = "A";
	const ANCHOR_CLASS_NAME = "anchor";
	const MANUAL_ANCHOR_ELEMENT_NAME = "HR";
	const DIFF_TAG_NAME = "DIFF-MARKER";
	const DIFF_CLASS_NAME = "diff";
	const MANUAL_ANCHOR_CLASS_NAME = "manual-anchor";

	function advanceNode(currentNode, rootNode = null, skipChildren = false) {
	  if (!skipChildren && currentNode.firstChild) {
	    return currentNode.firstChild;
	  }
	  let node = currentNode;
	  while (node && node !== rootNode) {
	    if (node.nextSibling) {
	      return node.nextSibling;
	    }
	    node = node.parentNode;
	  }
	  return null;
	}

	function mountHelper(wrapper, options) {
	  let mountTarget = null;
	  function mount(target) {
	    if (mountTarget) {
	      throw new Error(`Already mounted to ${mountTarget}. Unmount it first!`);
	    }
	    target.appendChild(wrapper);
	    mountTarget = target;
	    options?.onMount?.(target);
	  }
	  function unmount() {
	    if (!mountTarget) {
	      throw new Error(`Not mounted to any target.`);
	    }
	    if (wrapper.parentNode !== mountTarget) {
	      throw new Error(`Mount mismatch. Expected: ${mountTarget}, Actual: ${wrapper.parentNode}`);
	    }
	    mountTarget.removeChild(wrapper);
	    options?.onUnmount?.(mountTarget);
	    mountTarget = null;
	  }
	  function getMountTarget() {
	    return mountTarget;
	  }
	  return { mount, unmount, getMountTarget };
	}

	function deepMerge(target, source) {
	  for (const key in source) {
	    const value = source[key];
	    if (value && typeof value === "object" && !Array.isArray(value)) {
	      target[key] = deepMerge({ ...target[key] || {} }, value);
	    } else {
	      target[key] = value;
	    }
	  }
	  return target;
	}

	const _defaultRendererOptions = {
	  styles: {
	    diff: {
	      normal: {
	        fillSaturation: 100,
	        fillLightness: 80,
	        fillAlpha: 1,
	        strokeSaturation: 100,
	        strokeLightness: 40,
	        strokeAlpha: 1
	      },
	      highlight: {
	        fill: "hsl(0 100% 80%)",
	        stroke: "hsl(0 100% 50% / 0.5)"
	      },
	      line: {
	        fill: "hsl(0 100% 90% / 0.5)"
	      }
	    },
	    selection: {
	      fill: "hsl(0 0% 50% / 0.3)"
	    },
	    guideline: {
	      stroke: "hsl(0 0% 50% / 0.3)"
	    }
	  },
	  geometry: {
	    diffExpandX: 2,
	    diffExpandY: 2,
	    diffLineExpandY: 0,
	    diffLineHeightMultiplier: 1.2
	  }
	};
	function getDefaultRendererOptions() {
	  return structuredClone(_defaultRendererOptions);
	}
	const REGION_FLAGS_SHIFT = 10;
	class Renderer {
	  #wrapper = null;
	  #canvas;
	  #ctx;
	  #highlightCanvas;
	  #highlightCtx;
	  #resizeObserver = new ResizeObserver(this.#handleResize.bind(this));
	  #options = getDefaultRendererOptions();
	  #leftRegion;
	  #rightRegion;
	  #canvasX = 0;
	  #canvasY = 0;
	  #canvasWidth = 0;
	  #canvasHeight = 0;
	  #renderCallbackId = null;
	  #nextRenderFlags = 0 /* NONE */;
	  #mouseX = -1;
	  #mouseY = -1;
	  #guideLineEnabled = true;
	  #guideLineY = -1;
	  #stage = 0 /* Idle */;
	  #callbacks = {};
	  #hoveredDiffIndex = null;
	  #hoveredRegion = null;
	  #highlightedDiffIndex = null;
	  #mountHelper;
	  #visibleDiffIndices = {
	    left: /* @__PURE__ */ new Set(),
	    right: /* @__PURE__ */ new Set()
	  };
	  constructor(left, right) {
	    this.#canvas = document.createElement("canvas");
	    this.#canvas.className = "diff-layer";
	    this.#ctx = this.#canvas.getContext("2d");
	    this.#highlightCanvas = document.createElement("canvas");
	    this.#highlightCanvas.className = "highlight-layer";
	    this.#highlightCtx = this.#highlightCanvas.getContext("2d");
	    this.#leftRegion = new RenderRegion("left", this, left, this.#ctx, this.#highlightCtx);
	    this.#rightRegion = new RenderRegion("right", this, right, this.#ctx, this.#highlightCtx);
	    this.#wrapper = document.createElement("div");
	    this.#wrapper.className = "renderer";
	    this.#wrapper.appendChild(this.#canvas);
	    this.#wrapper.appendChild(this.#highlightCanvas);
	    this.#mountHelper = mountHelper(this.#wrapper, {
	      onMount: (target) => {
	        this.#resizeObserver.observe(target);
	      },
	      onUnmount: (target) => {
	        this.#resizeObserver.unobserve(target);
	      }
	    });
	  }
	  setOptions(newOptions) {
	    deepMerge(this.#options, newOptions);
	  }
	  getOptions() {
	    return this.#options;
	  }
	  setCallbacks(callbacks) {
	    Object.assign(this.#callbacks, callbacks);
	  }
	  mount(target) {
	    this.#mountHelper.mount(target);
	  }
	  unmount() {
	    this.#mountHelper.unmount();
	  }
	  get x() {
	    return this.#canvasX;
	  }
	  get y() {
	    return this.#canvasY;
	  }
	  get width() {
	    return this.#canvasWidth;
	  }
	  get height() {
	    return this.#canvasHeight;
	  }
	  get guideLineY() {
	    return this.#guideLineY;
	  }
	  #handleResize(_entries) {
	    this.#updateLayout();
	  }
	  setDiffHighlight(diffIndex) {
	    this.#highlightedDiffIndex = diffIndex;
	    this.#updateHighlightedDiffIndex();
	  }
	  setHoveredDiffIndex(diffIndex, region) {
	    this.#hoveredDiffIndex = diffIndex;
	    this.#hoveredRegion = region ?? null;
	    this.#updateHighlightedDiffIndex();
	    this.#callbacks.hoveredDiffIndexChanged?.(diffIndex);
	  }
	  #updateHighlightedDiffIndex() {
	    const actualDiffIndex = this.#hoveredDiffIndex ?? this.#highlightedDiffIndex ?? null;
	    this.#leftRegion.setHighlightedDiffIndex(actualDiffIndex);
	    this.#rightRegion.setHighlightedDiffIndex(actualDiffIndex);
	  }
	  get guideLineEnabled() {
	    return this.#guideLineEnabled;
	  }
	  set guideLineEnabled(enabled) {
	    enabled = !!enabled;
	    if (this.#guideLineEnabled === enabled) {
	      return;
	    }
	    this.#guideLineEnabled = enabled;
	    this.#guideLineY = -1;
	    if (enabled || this.#guideLineY !== null) {
	      this.invalidateHighlightLayer(void 0);
	    }
	  }
	  #updateLayout() {
	    if (!this.#wrapper) {
	      return;
	    }
	    const { x, y, width, height } = this.#wrapper.getBoundingClientRect();
	    this.#canvasX = x;
	    this.#canvasY = y;
	    if (this.#canvasWidth !== width || this.#canvasHeight !== height) {
	      this.#canvas.width = this.#canvasWidth = width;
	      this.#canvas.height = this.#canvasHeight = height;
	      this.#nextRenderFlags = 3 /* GENERAL_MASK */ | 224 /* REGION_MASK */ | 224 /* REGION_MASK */ << REGION_FLAGS_SHIFT;
	    }
	    this.#highlightCanvas.width = width;
	    this.#highlightCanvas.height = height;
	    this.#nextRenderFlags |= this.#leftRegion.updateLayout();
	    this.#nextRenderFlags |= this.#rightRegion.updateLayout() << REGION_FLAGS_SHIFT;
	  }
	  updateMousePosition(x, y) {
	    this.#mouseX = x - this.#canvasX;
	    this.#mouseY = y - this.#canvasY;
	    this.#invalidate(2 /* HIT_TEST */);
	  }
	  queueRender() {
	    if (this.#renderCallbackId !== null) {
	      return;
	    }
	    this.#renderCallbackId = requestAnimationFrame((ts) => {
	      this.#renderCallbackId = null;
	      this.#render(ts);
	    });
	  }
	  cancelRender() {
	    if (this.#renderCallbackId !== null) {
	      cancelAnimationFrame(this.#renderCallbackId);
	      this.#renderCallbackId = null;
	      this.#nextRenderFlags = 0 /* NONE */;
	      this.#stage = 0 /* Idle */;
	    }
	  }
	  #render(time) {
	    this.#stage = 1 /* Prepare */;
	    this.#callbacks.prepare?.(time);
	    if (this.#nextRenderFlags & 1 /* LAYOUT */) {
	      this.#updateLayout();
	    }
	    let leftRegionFlags = this.#nextRenderFlags & 224 /* REGION_MASK */;
	    let rightRegionFlags = this.#nextRenderFlags >> REGION_FLAGS_SHIFT & 224 /* REGION_MASK */;
	    let leftDiffVisibilityChangeEntries = null;
	    let rightDiffVisibilityChangeEntries = null;
	    if (leftRegionFlags) {
	      this.#leftRegion.prepare(leftRegionFlags);
	      if (leftRegionFlags & 32 /* DIFF_LAYER */) {
	        leftDiffVisibilityChangeEntries = this.#updateVisibleDiffIndices(this.#visibleDiffIndices.left, this.#leftRegion.visibleDiffIndices);
	      }
	    }
	    if (rightRegionFlags) {
	      this.#rightRegion.prepare(rightRegionFlags);
	      if (rightRegionFlags & 32 /* DIFF_LAYER */) {
	        rightDiffVisibilityChangeEntries = this.#updateVisibleDiffIndices(this.#visibleDiffIndices.right, this.#rightRegion.visibleDiffIndices);
	      }
	    }
	    if (this.#nextRenderFlags & 2 /* HIT_TEST */) {
	      this.hitTest(this.#mouseX, this.#mouseY);
	    }
	    this.#callbacks.draw?.(time);
	    this.#stage = 2 /* Draw */;
	    leftRegionFlags |= this.#nextRenderFlags & 224 /* REGION_MASK */;
	    rightRegionFlags |= this.#nextRenderFlags >> REGION_FLAGS_SHIFT & 224 /* REGION_MASK */;
	    this.#nextRenderFlags = 0 /* NONE */;
	    if (leftRegionFlags) {
	      this.#leftRegion.render(leftRegionFlags);
	    }
	    if (rightRegionFlags) {
	      this.#rightRegion.render(rightRegionFlags);
	    }
	    this.#stage = 0 /* Idle */;
	    if (this.#nextRenderFlags !== 0 /* NONE */) {
	      this.queueRender();
	    }
	    if (leftDiffVisibilityChangeEntries?.length || rightDiffVisibilityChangeEntries?.length) {
	      this.#callbacks.diffVisibilityChanged?.({
	        left: leftDiffVisibilityChangeEntries ?? [],
	        right: rightDiffVisibilityChangeEntries ?? []
	      });
	    }
	  }
	  #updateVisibleDiffIndices(set, newSet) {
	    const result = [];
	    for (const index of set) {
	      if (!newSet.has(index)) {
	        set.delete(index);
	        result.push({ item: index, isVisible: false });
	      }
	    }
	    let prevSize = set.size;
	    for (const index of newSet) {
	      set.add(index);
	      if (set.size > prevSize) {
	        result.push({ item: index, isVisible: true });
	        prevSize++;
	      }
	    }
	    return result;
	  }
	  invalidateAll() {
	    this.#invalidate(3 /* GENERAL_MASK */ | 224 /* REGION_MASK */ | 224 /* REGION_MASK */ << REGION_FLAGS_SHIFT);
	  }
	  invalidateLayout() {
	    this.#invalidate(1 /* LAYOUT */);
	  }
	  invalidateDiffLayer(which) {
	    return this.#invalidateRegion(32 /* DIFF_LAYER */, which);
	  }
	  invalidateHighlightLayer(which) {
	    return this.#invalidateRegion(64 /* HIGHLIGHT_LAYER */, which);
	  }
	  invalidateGeometries(which) {
	    return this.#invalidateRegion(128 /* GEOMETRY */ | 32 /* DIFF_LAYER */ | 64 /* HIGHLIGHT_LAYER */, which);
	  }
	  invalidateScroll(which) {
	    return this.#invalidateRegion(96 /* SCROLL */, which);
	  }
	  #invalidate(flags) {
	    this.#nextRenderFlags |= flags;
	    if (this.#stage === 0 /* Idle */) {
	      this.queueRender();
	    } else if (this.#stage === 1 /* Prepare */) ; else if (this.#stage === 2 /* Draw */) ;
	  }
	  #invalidateRegion(flags, which) {
	    if (which === "right") {
	      flags <<= REGION_FLAGS_SHIFT;
	    } else if (!which) {
	      flags |= flags << REGION_FLAGS_SHIFT;
	    }
	    this.#invalidate(flags);
	  }
	  setDiffs(diffs) {
	    const leftDiffs = new Array(diffs.length);
	    const rightDiffs = new Array(diffs.length);
	    for (let i = 0; i < diffs.length; i++) {
	      const diff = diffs[i];
	      const leftRange = diff.leftRange;
	      const rightRange = diff.rightRange;
	      leftDiffs[i] = {
	        diffIndex: i,
	        range: leftRange,
	        hue: diff.hue,
	        empty: diff.leftSpan.end === diff.leftSpan.start
	      };
	      rightDiffs[i] = {
	        diffIndex: i,
	        range: rightRange,
	        hue: diff.hue,
	        empty: diff.rightSpan.end === diff.rightSpan.start
	      };
	    }
	    this.#leftRegion.setDiffs(leftDiffs);
	    this.#rightRegion.setDiffs(rightDiffs);
	    this.invalidateGeometries();
	  }
	  setSelectionHighlight(which, range) {
	    let leftRange = null;
	    let rightRange = null;
	    if (which === "left") {
	      leftRange = range;
	    } else if (which === "right") {
	      rightRange = range;
	    }
	    this.#leftRegion.setSelectionHighlight(leftRange);
	    this.#rightRegion.setSelectionHighlight(rightRange);
	  }
	  hitTest(x, y) {
	    let diffIndex = null;
	    if (x < 0 || y < 0) ; else if (x > this.#canvasWidth || y > this.#canvasHeight) ; else {
	      let region = null;
	      if (x >= this.#leftRegion.regionX && x < this.#leftRegion.regionX + this.#leftRegion.regionWidth && y >= this.#leftRegion.regionY && y < this.#leftRegion.regionY + this.#leftRegion.regionHeight) {
	        region = this.#leftRegion;
	      } else if (this.#rightRegion && x >= this.#rightRegion.regionX) {
	        region = this.#rightRegion;
	      }
	      let diffIndex2 = null;
	      let guideLineY = -1;
	      if (region) {
	        diffIndex2 = region.hitTest(x - region.regionX, y - region.regionY);
	        guideLineY = y - region.regionY;
	      }
	      if (diffIndex2 !== this.#hoveredDiffIndex || region?.name !== this.#hoveredRegion) {
	        this.#hoveredDiffIndex = diffIndex2;
	        this.#hoveredRegion = region?.name ?? null;
	        this.setHoveredDiffIndex(diffIndex2, region?.name);
	      }
	      if (this.#guideLineEnabled && this.#guideLineY !== guideLineY) {
	        this.#guideLineY = guideLineY;
	        this.invalidateHighlightLayer();
	      }
	    }
	    return diffIndex;
	  }
	  getDiffRect(which, diffIndex) {
	    const region = which === "left" ? this.#leftRegion : this.#rightRegion;
	    return region?.getDiffRect(diffIndex) ?? null;
	  }
	  isDiffVisible(which, diffIndex) {
	    const region = which === "left" ? this.#leftRegion : this.#rightRegion;
	    return region.visibleDiffIndices.has(diffIndex);
	  }
	}
	class RenderRegion {
	  #name;
	  #renderer;
	  #viewport;
	  #diffs = [];
	  #diffGeometries = [];
	  #diffLineRects = [];
	  #selectionHighlight = null;
	  #selectionHighlightRects = null;
	  //dirtyFlags: RenderFlags = RenderFlags.NONE;
	  #visibleDiffIndices = /* @__PURE__ */ new Set();
	  #visibleDiffIndicesArr = [];
	  #ctx;
	  #highlightCtx;
	  regionX = 0;
	  regionY = 0;
	  regionWidth = 0;
	  regionHeight = 0;
	  highlightedDiffIndex = null;
	  #scrollTop = 0;
	  #scrollLeft = 0;
	  constructor(name, renderer, viewport, ctx, highlightCtx) {
	    this.#name = name;
	    this.#renderer = renderer;
	    this.#ctx = ctx;
	    this.#highlightCtx = highlightCtx;
	    this.#viewport = viewport;
	  }
	  updateLayout() {
	    let { x, y, width, height } = this.#viewport.getBoundingClientRect();
	    const [scrollLeft, scrollTop] = this.#viewport.getScroll();
	    const renderer = this.#renderer;
	    x -= renderer.x;
	    y -= renderer.y;
	    let ret = 0 /* NONE */;
	    if (this.regionX !== x || this.regionY !== y || this.regionWidth !== width || this.regionHeight !== height) {
	      renderer.invalidateGeometries(this.#name);
	      ret = 224 /* RESIZE */;
	    } else if (this.#scrollLeft !== scrollLeft || this.#scrollTop !== scrollTop) {
	      renderer.invalidateScroll(this.#name);
	      ret = 96 /* SCROLL */;
	    }
	    this.regionX = x;
	    this.regionY = y;
	    this.regionWidth = width;
	    this.regionHeight = height;
	    this.#scrollLeft = scrollLeft;
	    this.#scrollTop = scrollTop;
	    return ret;
	  }
	  updateScroll(scrollTop, scrollLeft) {
	    if (this.#scrollTop !== scrollTop || this.#scrollLeft !== scrollLeft) {
	      this.#scrollTop = scrollTop;
	      this.#scrollLeft = scrollLeft;
	      this.#renderer.invalidateScroll(this.#name);
	    }
	  }
	  get name() {
	    return this.#name;
	  }
	  get diffs() {
	    return this.#diffs;
	  }
	  get diffLineRects() {
	    return this.#diffLineRects;
	  }
	  get selectionHighlight() {
	    return this.#selectionHighlight;
	  }
	  get selectionHighlightRects() {
	    return this.#selectionHighlightRects;
	  }
	  get visibleDiffIndices() {
	    return this.#visibleDiffIndices;
	  }
	  // markDirty(flags: RenderFlags) {
	  // 	this.dirtyFlags |= flags;
	  // }
	  setDiffs(diffs) {
	    this.#diffs = diffs;
	    this.#diffGeometries.length = 0;
	    this.#visibleDiffIndices.clear();
	  }
	  setHighlightedDiffIndex(diffIndex) {
	    if (this.highlightedDiffIndex === diffIndex) {
	      return false;
	    }
	    let wasShown = this.highlightedDiffIndex !== null && this.visibleDiffIndices.has(this.highlightedDiffIndex);
	    let shouldShow = diffIndex !== null && (!this.#diffGeometries[diffIndex] || this.visibleDiffIndices.has(diffIndex));
	    this.highlightedDiffIndex = diffIndex;
	    if (wasShown || shouldShow) {
	      this.#renderer.invalidateDiffLayer(this.#name);
	      return true;
	    }
	    return false;
	  }
	  ensureGeometries() {
	  }
	  setSelectionHighlight(range) {
	    const current = this.#selectionHighlight;
	    if (current === range) {
	      return false;
	    }
	    if (current && range && current.startContainer === range.startContainer && current.endContainer === range.endContainer && current.startOffset === range.startOffset && current.endOffset === range.endOffset) {
	      return false;
	    }
	    this.#selectionHighlight = range;
	    this.#selectionHighlightRects = null;
	    this.#renderer.invalidateHighlightLayer(this.#name);
	  }
	  prepare(dirtyFlags) {
	    [this.#scrollLeft, this.#scrollTop] = this.#viewport.getScroll();
	    const diffGeometries = this.#diffGeometries;
	    const visibleDiffIndices = this.#visibleDiffIndices;
	    const diffs = this.#diffs;
	    const newGeometryRects = [];
	    visibleDiffIndices.clear();
	    if (dirtyFlags & 128 /* GEOMETRY */) {
	      diffGeometries.length = 0;
	      this.#diffLineRects.length = 0;
	    }
	    const scrollTop = this.#scrollTop;
	    const scrollLeft = this.#scrollLeft;
	    const canvasX = this.#renderer.x;
	    const canvasY = this.#renderer.y;
	    const offsetTop = -this.regionY - canvasY + scrollTop;
	    const offsetLeft = -this.regionX - canvasX + scrollLeft;
	    const regionHeight = this.regionHeight;
	    const { diffExpandX, diffExpandY } = this.#renderer.getOptions().geometry;
	    for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
	      let geometry = diffGeometries[diffIndex];
	      if (!geometry) {
	        const diff = diffs[diffIndex];
	        const wholeRect = diff.range.getBoundingClientRect();
	        const x = wholeRect.x + offsetLeft - diffExpandX, y = wholeRect.y + offsetTop - diffExpandY, width = wholeRect.width + diffExpandX * 2, height = wholeRect.height + diffExpandY * 2;
	        diffGeometries[diffIndex] = geometry = {
	          minX: x,
	          minY: y,
	          maxX: x + width,
	          maxY: y + height,
	          rects: null
	          // fillStyle: null,
	          // strokeStyle: null,
	        };
	      }
	      if (geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > regionHeight || geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > this.regionWidth) {
	        continue;
	      }
	      if (geometry.rects === null) {
	        const rangeRects = this.#extractRectsFromRange(
	          diffs[diffIndex].range,
	          offsetLeft,
	          offsetTop,
	          diffExpandX,
	          diffExpandY,
	          diffs[diffIndex].empty
	        );
	        for (const rect of rangeRects) {
	          newGeometryRects.push(rect);
	        }
	        diffGeometries[diffIndex] = geometry = mergeRects(rangeRects, 1, 1);
	      }
	      for (const rect of geometry.rects) {
	        if (rect.y + rect.height - scrollTop < 0) continue;
	        if (rect.y - scrollTop > regionHeight) break;
	        visibleDiffIndices.add(diffIndex);
	        break;
	      }
	    }
	    if (newGeometryRects.length > 0) {
	      this.#mergeIntoDiffLineRects(newGeometryRects);
	    }
	    const arr = this.#visibleDiffIndicesArr;
	    arr.length = 0;
	    let i = 0;
	    for (const index of visibleDiffIndices) {
	      arr[i++] = index;
	    }
	  }
	  render(dirtyFlags) {
	    if (dirtyFlags & 32 /* DIFF_LAYER */) {
	      this.renderDiffLayer();
	    }
	    if (dirtyFlags & 64 /* HIGHLIGHT_LAYER */) {
	      this.renderHighlightLayer(dirtyFlags);
	    }
	  }
	  renderDiffLayer() {
	    const ctx = this.#ctx;
	    ctx.save();
	    ctx.translate(this.regionX, this.regionY);
	    ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);
	    ctx.beginPath();
	    ctx.rect(0, 0, this.regionWidth, this.regionHeight);
	    ctx.clip();
	    const diffGeometries = this.#diffGeometries;
	    const diffsToRender = this.#visibleDiffIndicesArr;
	    const diffs = this.#diffs;
	    const scrollTop = this.#scrollTop;
	    const scrollLeft = this.#scrollLeft;
	    const regionHeight = this.regionHeight;
	    const diffStyles = this.#renderer.getOptions().styles.diff;
	    ctx.fillStyle = diffStyles.line.fill;
	    for (const diffLineRect of this.#diffLineRects) {
	      const x = Math.floor(diffLineRect.x - scrollLeft), y = Math.floor(diffLineRect.y - scrollTop), width = Math.ceil(diffLineRect.width), height = Math.ceil(diffLineRect.height);
	      if (y + height < 0) continue;
	      if (y > regionHeight) break;
	      ctx.fillRect(x, y, width, height);
	    }
	    const diffNormalStyles = diffStyles.normal;
	    for (const diffIndex of diffsToRender) {
	      const geometry = diffGeometries[diffIndex];
	      if (this.highlightedDiffIndex === diffIndex) {
	        const { fill, stroke } = diffStyles.highlight;
	        ctx.fillStyle = fill;
	        ctx.strokeStyle = stroke;
	      } else {
	        ctx.fillStyle = `hsl(${diffs[diffIndex].hue} ${diffNormalStyles.fillSaturation}% ${diffNormalStyles.fillLightness}% / ${diffNormalStyles.fillAlpha})`;
	        ctx.strokeStyle = `hsl(${diffs[diffIndex].hue} ${diffNormalStyles.strokeSaturation}% ${diffNormalStyles.strokeLightness}% / ${diffNormalStyles.strokeAlpha})`;
	      }
	      for (const rect of geometry.rects) {
	        const x = Math.floor(rect.x - scrollLeft), y = Math.floor(rect.y - scrollTop), width = Math.ceil(rect.width), height = Math.ceil(rect.height);
	        if (y + height < 0) continue;
	        if (y > regionHeight) break;
	        ctx.fillRect(x, y, width, height);
	      }
	    }
	    ctx.restore();
	  }
	  renderHighlightLayer(dirtyFlags) {
	    const ctx = this.#highlightCtx;
	    ctx.save();
	    ctx.translate(this.regionX, this.regionY);
	    ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);
	    ctx.beginPath();
	    ctx.rect(0, 0, this.regionWidth, this.regionHeight);
	    ctx.clip();
	    const regionWidth = this.regionWidth;
	    const regionHeight = this.regionHeight;
	    const scrollTop = this.#scrollTop;
	    const scrollLeft = this.#scrollLeft;
	    if (this.#selectionHighlight) {
	      if (!this.#selectionHighlightRects || dirtyFlags & 128 /* GEOMETRY */) {
	        const offsetX = -this.regionX + scrollLeft;
	        const offsetY = -this.regionY + scrollTop;
	        const rawRects = this.#extractRectsFromRange(this.#selectionHighlight, offsetX, offsetY, 0, 0, false);
	        const mergedRect = mergeRects(rawRects, 1, 1);
	        this.#selectionHighlightRects = mergedRect;
	      }
	      let geometry = this.#selectionHighlightRects;
	      let isVisible = !(geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > regionHeight) && !(geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > regionWidth);
	      if (isVisible) {
	        ctx.fillStyle = this.#renderer.getOptions().styles.selection.fill;
	        for (const rect of geometry.rects) {
	          const x = Math.floor(rect.x - scrollLeft), y = Math.floor(rect.y - scrollTop), width = Math.ceil(rect.width), height = Math.ceil(rect.height);
	          if (y + height < 0) continue;
	          if (y > regionHeight) break;
	          ctx.fillRect(x, y, width, height);
	        }
	      }
	    }
	    if (this.#renderer.guideLineEnabled && this.#renderer.guideLineY >= 0) {
	      const guideLineY = this.#renderer.guideLineY + 0.5;
	      ctx.beginPath();
	      ctx.moveTo(0, guideLineY);
	      ctx.lineTo(this.regionWidth, guideLineY);
	      ctx.strokeStyle = this.#renderer.getOptions().styles.guideline.stroke;
	      ctx.lineWidth = 1;
	      ctx.stroke();
	    }
	    ctx.restore();
	  }
	  #mergeIntoDiffLineRects(incoming) {
	    const TOLERANCE = 1;
	    const regionWidth = this.regionWidth;
	    const allRects = [];
	    for (const rect of this.#diffLineRects) {
	      allRects.push(rect);
	    }
	    const { diffLineHeightMultiplier, diffLineExpandY } = this.#renderer.getOptions().geometry;
	    for (const rect of incoming) {
	      const height = rect.height * diffLineHeightMultiplier + diffLineExpandY * 2;
	      const heightDelta = height - rect.height;
	      const y = rect.y - heightDelta / 2;
	      allRects.push({
	        x: 0,
	        y,
	        width: regionWidth,
	        height
	      });
	    }
	    allRects.sort((a, b) => a.y - b.y);
	    this.#diffLineRects.length = 0;
	    let current = allRects[0];
	    for (let i = 1; i < allRects.length; i++) {
	      const next = allRects[i];
	      const gap = next.y - (current.y + current.height);
	      if (gap <= TOLERANCE) {
	        const newBottom = Math.max(current.y + current.height, next.y + next.height);
	        current = {
	          x: 0,
	          y: current.y,
	          width: regionWidth,
	          height: newBottom - current.y
	        };
	      } else {
	        this.#diffLineRects.push(current);
	        current = next;
	      }
	    }
	    this.#diffLineRects.push(current);
	  }
	  hitTest(x, y) {
	    x += this.#scrollLeft;
	    y += this.#scrollTop;
	    for (const diffIndex of this.#visibleDiffIndicesArr) {
	      const geometry = this.#diffGeometries[diffIndex];
	      if (geometry && geometry.rects) {
	        for (const rect of geometry.rects) {
	          if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
	            return diffIndex;
	          }
	        }
	      }
	    }
	    return null;
	  }
	  getDiffRect(diffIndex) {
	    const geometry = this.#diffGeometries[diffIndex];
	    if (geometry) {
	      return {
	        x: geometry.minX,
	        y: geometry.minY,
	        width: geometry.maxX - geometry.minX,
	        height: geometry.maxY - geometry.minY
	      };
	    }
	    return null;
	  }
	  #extractRectsFromRange(range, offsetLeft, offsetTop, expandX = 0, expandY = 0, emptyDiff = false) {
	    const result = [];
	    const tempRange = document.createRange();
	    let startNode;
	    if (range.startContainer.nodeType === 3) {
	      tempRange.setStart(range.startContainer, range.startOffset);
	      if (emptyDiff) {
	        tempRange.collapse(true);
	      } else {
	        if (range.startContainer === range.endContainer) {
	          tempRange.setEnd(range.startContainer, range.endOffset);
	        } else {
	          tempRange.setEnd(range.startContainer, range.startContainer.nodeValue.length);
	        }
	      }
	      for (const rect of tempRange.getClientRects()) {
	        result.push({
	          x: rect.x + offsetLeft - expandX,
	          y: rect.y + offsetTop - expandY,
	          width: rect.width + expandX * 2,
	          height: rect.height + expandY * 2
	        });
	        if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
	      }
	      startNode = advanceNode(range.startContainer);
	    } else {
	      startNode = range.startContainer.childNodes[range.startOffset] ?? advanceNode(range.startContainer, null, true);
	      if (!startNode) return result;
	    }
	    const endContainer = range.endContainer;
	    let endOffset;
	    let endNode;
	    if (endContainer.nodeType === 3) {
	      endNode = endContainer;
	      endOffset = range.endOffset;
	    } else {
	      endNode = endContainer.childNodes[range.endOffset] ?? advanceNode(endContainer, null, true);
	      endOffset = -1;
	    }
	    if (!startNode || !endNode || endNode.compareDocumentPosition(startNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
	      return result;
	    }
	    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
	    walker.currentNode = startNode;
	    do {
	      const node = walker.currentNode;
	      if (!node) break;
	      if (node === endNode) {
	        if (node.nodeType === 3 && endOffset >= 0) {
	          tempRange.setStart(endNode, 0);
	          emptyDiff ? tempRange.collapse(true) : tempRange.setEnd(endNode, endOffset);
	          for (const rect of tempRange.getClientRects()) {
	            result.push({
	              x: rect.x + offsetLeft - expandX,
	              y: rect.y + offsetTop - expandY,
	              width: rect.width + expandX * 2,
	              height: rect.height + expandY * 2
	            });
	            if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) return result;
	          }
	        }
	        break;
	      }
	      if (node.nodeType === 3) {
	        tempRange.selectNodeContents(node);
	        for (const rect of tempRange.getClientRects()) {
	          result.push({
	            x: rect.x + offsetLeft - expandX,
	            y: rect.y + offsetTop - expandY,
	            width: rect.width + expandX * 2,
	            height: rect.height + expandY * 2
	          });
	        }
	      } else if (node.nodeName === "BR") ; else if (node.nodeName === DIFF_TAG_NAME) {
	        if (emptyDiff) {
	          const tempText = document.createTextNode("​");
	          node.appendChild(tempText);
	          tempRange.selectNodeContents(tempText);
	          for (const rect of tempRange.getClientRects()) {
	            result.push({
	              x: rect.x + offsetLeft - expandX,
	              y: rect.y + offsetTop - expandY,
	              width: rect.width + expandX * 2,
	              height: rect.height + expandY * 2
	            });
	          }
	          tempText.remove();
	        } else {
	          if (node.classList.contains(MANUAL_ANCHOR_CLASS_NAME)) {
	            tempRange.selectNode(node);
	            for (const rect of node.getClientRects()) {
	              result.push({
	                x: rect.x + offsetLeft - expandX,
	                y: rect.y + offsetTop - expandY,
	                width: rect.width + expandX * 2,
	                height: rect.height + expandY * 2
	              });
	            }
	          }
	        }
	      } else if (node.nodeName === "IMG") {
	        tempRange.selectNode(node);
	        for (const rect of tempRange.getClientRects()) {
	          result.push({
	            x: rect.x + offsetLeft - expandX,
	            y: rect.y + offsetTop - expandY,
	            width: rect.width + expandX * 2,
	            height: rect.height + expandY * 2
	          });
	        }
	      }
	    } while (walker.nextNode());
	    return result;
	  }
	}

	var root$4 = 'RendererShell_root__rh59wk0';

	function RendererShell({ renderer, className }) {
	  const containerRef = React.useRef(null);
	  React.useEffect(() => {
	    if (!containerRef.current) return;
	    renderer.mount(containerRef.current);
	    return () => {
	      renderer.unmount();
	    };
	  }, []);
	  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: clsx(root$4, className), ref: containerRef });
	}

	jotai.atom([]);
	const syncModeAtom = jotai.atom(false);
	const visibleDiffsAtom = jotai.atom({
	  left: /* @__PURE__ */ new Set(),
	  right: /* @__PURE__ */ new Set()
	});
	const hoveredDiffIndexAtom = jotai.atom(null);
	const editorPanelLayoutAtom = utils.atomWithStorage("editorPanelLayout", "horizontal");
	utils.atomWithStorage("magnifierEnabled", true);
	jotai.atom(false);
	let lastKnownSelection = null;
	const baseEditorSelectionAtom = jotai.atom(null);
	const editorTextSelectionAtom = jotai.atom(
	  (get) => get(baseEditorSelectionAtom),
	  (_, set, newVal) => {
	    set(baseEditorSelectionAtom, newVal);
	    lastKnownSelection = newVal ?? lastKnownSelection;
	  }
	);
	jotai.atom((get) => get(baseEditorSelectionAtom) ?? lastKnownSelection);

	function toPrimitive(t, r) {
	  if ("object" != typeof t || !t) return t;
	  var e = t[Symbol.toPrimitive];
	  if (void 0 !== e) {
	    var i = e.call(t, r);
	    if ("object" != typeof i) return i;
	    throw new TypeError("@@toPrimitive must return a primitive value.");
	  }
	  return ("string" === r ? String : Number)(t);
	}

	function toPropertyKey(t) {
	  var i = toPrimitive(t, "string");
	  return "symbol" == typeof i ? i : String(i);
	}

	function _defineProperty(obj, key, value) {
	  key = toPropertyKey(key);
	  if (key in obj) {
	    Object.defineProperty(obj, key, {
	      value: value,
	      enumerable: true,
	      configurable: true,
	      writable: true
	    });
	  } else {
	    obj[key] = value;
	  }
	  return obj;
	}

	function ownKeys(e, r) {
	  var t = Object.keys(e);
	  if (Object.getOwnPropertySymbols) {
	    var o = Object.getOwnPropertySymbols(e);
	    r && (o = o.filter(function (r) {
	      return Object.getOwnPropertyDescriptor(e, r).enumerable;
	    })), t.push.apply(t, o);
	  }
	  return t;
	}
	function _objectSpread2(e) {
	  for (var r = 1; r < arguments.length; r++) {
	    var t = null != arguments[r] ? arguments[r] : {};
	    r % 2 ? ownKeys(Object(t), true).forEach(function (r) {
	      _defineProperty(e, r, t[r]);
	    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
	      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
	    });
	  }
	  return e;
	}

	function mapValues(input, fn) {
	  var result = {};
	  for (var _key in input) {
	    result[_key] = fn(input[_key], _key);
	  }
	  return result;
	}

	var shouldApplyCompound = (compoundCheck, selections, defaultVariants) => {
	  for (var key of Object.keys(compoundCheck)) {
	    var _selections$key;
	    if (compoundCheck[key] !== ((_selections$key = selections[key]) !== null && _selections$key !== void 0 ? _selections$key : defaultVariants[key])) {
	      return false;
	    }
	  }
	  return true;
	};
	var createRuntimeFn = config => {
	  var runtimeFn = options => {
	    var className = config.defaultClassName;
	    var selections = _objectSpread2(_objectSpread2({}, config.defaultVariants), options);
	    for (var variantName in selections) {
	      var _selections$variantNa;
	      var variantSelection = (_selections$variantNa = selections[variantName]) !== null && _selections$variantNa !== void 0 ? _selections$variantNa : config.defaultVariants[variantName];
	      if (variantSelection != null) {
	        var selection = variantSelection;
	        if (typeof selection === 'boolean') {
	          // @ts-expect-error
	          selection = selection === true ? 'true' : 'false';
	        }
	        var selectionClassName =
	        // @ts-expect-error
	        config.variantClassNames[variantName][selection];
	        if (selectionClassName) {
	          className += ' ' + selectionClassName;
	        }
	      }
	    }
	    for (var [compoundCheck, compoundClassName] of config.compoundVariants) {
	      if (shouldApplyCompound(compoundCheck, selections, config.defaultVariants)) {
	        className += ' ' + compoundClassName;
	      }
	    }
	    return className;
	  };
	  runtimeFn.variants = () => Object.keys(config.variantClassNames);
	  runtimeFn.classNames = {
	    get base() {
	      return config.defaultClassName.split(' ')[0];
	    },
	    get variants() {
	      return mapValues(config.variantClassNames, classNames => mapValues(classNames, className => className.split(' ')[0]));
	    }
	  };
	  return runtimeFn;
	};

	var container$1 = createRuntimeFn({defaultClassName:'EditorPanel_container__183fy150',variantClassNames:{layout:{vertical:'EditorPanel_container_layout_vertical__183fy151',horizontal:'EditorPanel_container_layout_horizontal__183fy152'},syncMode:{on:'EditorPanel_container_syncMode_on__183fy153',off:'EditorPanel_container_syncMode_off__183fy154'}},defaultVariants:{syncMode:'off'},compoundVariants:[]});
	var divider = createRuntimeFn({defaultClassName:'EditorPanel_divider__183fy155',variantClassNames:{layout:{horizontal:'EditorPanel_divider_layout_horizontal__183fy156',vertical:'EditorPanel_divider_layout_vertical__183fy157'}},defaultVariants:{layout:'vertical'},compoundVariants:[]});

	function createTrie(ignoreSpaces = false) {
	  const root = createTrieNode(ignoreSpaces);
	  function insert(word, flags = 0) {
	    let node = root;
	    for (let i = 0; i < word.length; i++) {
	      const charCode = word.codePointAt(i);
	      node = node.addChild(charCode);
	      if (charCode > 65535) {
	        i++;
	      }
	    }
	    node.word = word;
	    node.flags = flags;
	  }
	  return { insert, root };
	}
	function createTrieNode(ignoreSpaces) {
	  const children = {};
	  const node = {
	    children,
	    word: null,
	    flags: 0,
	    next(charCode) {
	      if (ignoreSpaces && charCode === 32) return node;
	      return children[charCode] || null;
	    },
	    addChild(charCode) {
	      return children[charCode] ?? (children[charCode] = createTrieNode(ignoreSpaces));
	    }
	  };
	  return node;
	}
	function extractStartCharsFromTrie(trie) {
	  const table = {};
	  for (const charCode in trie.children) {
	    const char = String.fromCodePoint(Number(charCode));
	    table[char] = 1;
	  }
	  return table;
	}

	const normalizedCharMap = ((normChars) => {
	  const result = {};
	  function getCharCode(char) {
	    if (typeof char === "number") {
	      return char;
	    }
	    return char.codePointAt(0);
	  }
	  for (const entry of normChars) {
	    const [norm, ...variants] = entry;
	    const normCharCode = getCharCode(norm);
	    for (const variant of variants) {
	      const variantCharCode = getCharCode(variant);
	      result[variantCharCode] = normCharCode;
	    }
	  }
	  return result;
	})([
	  //['"', "“", "”", "'", "‘", "’"], // 비즈플랫폼 편집기에서 작은따옴표를 큰따옴표로 바꾸어버림. WHY?
	  ["-", "‐", "‑", "‒", "–", "﹘", "—", "－"],
	  [".", "․", "．"],
	  [",", "，"],
	  ["•", "●"],
	  // 이걸 중간점 용도로 쓰는 사람들은 정말 갈아마셔야된다. 도저히 용납해줄 수 없고 같은 문자로 인식하게 만들고 싶지 않다.
	  ["◦", "○", "ㅇ"],
	  // 자음 "이응"을 쓰는 사람들도 개인적으로 이해가 안되지만 많더라.
	  ["■", "▪", "◼"],
	  ["□", "▫", "◻", "ㅁ"],
	  ["·", "⋅", "∙", "ㆍ", "‧"],
	  // 유니코드를 만든 집단은 도대체 무슨 생각이었던걸까?...
	  ["…", "⋯"],
	  ["(", "（"],
	  [")", "）"],
	  ["[", "［"],
	  ["]", "］"],
	  ["{", "｛"],
	  ["}", "｝"],
	  ["<", "＜"],
	  [">", "＞"],
	  ["=", "＝"],
	  ["+", "＋"],
	  ["*", "＊", "✱", "×", "∗"],
	  ["/", "／", "÷"],
	  ["\\", "₩"],
	  // 아마도 원화 기호로 사용했겠지
	  ["&", "＆"],
	  ["#", "＃"],
	  ["@", "＠"],
	  ["$", "＄"],
	  ["%", "％"],
	  ["^", "＾"],
	  ["~", "～"],
	  ["`", "｀"],
	  ["|", "｜"],
	  [":", "："],
	  [";", "；"],
	  ["?", "？"],
	  ["!", "！"],
	  ["_", "＿"],
	  ["→", "⇒", "➡", "➔", "➞", "➟"],
	  ["←", "⇐", "⬅", "⟵", "⟸"],
	  ["↑", "⇑", "⬆"],
	  ["↓", "⇓", "⬇"],
	  ["↔", "⇔"],
	  ["↕", "⇕"],
	  [" ", " "]
	]);

	function quickHash53ToString(str) {
	  let hash = 0n;
	  const PRIME = 131n;
	  for (let i = 0; i < str.length; i++) {
	    hash = hash * PRIME + BigInt(str.charCodeAt(i));
	    hash &= 0x1fffffffffffffn;
	  }
	  return hash.toString(36);
	}

	var TokenFlags = /* @__PURE__ */ ((TokenFlags2) => {
	  TokenFlags2[TokenFlags2["None"] = 0] = "None";
	  TokenFlags2[TokenFlags2["LINE_START"] = 1] = "LINE_START";
	  TokenFlags2[TokenFlags2["LINE_END"] = 2] = "LINE_END";
	  TokenFlags2[TokenFlags2["BLOCK_START"] = 4] = "BLOCK_START";
	  TokenFlags2[TokenFlags2["BLOCK_END"] = 8] = "BLOCK_END";
	  TokenFlags2[TokenFlags2["CONTAINER_START"] = 16] = "CONTAINER_START";
	  TokenFlags2[TokenFlags2["CONTAINER_END"] = 32] = "CONTAINER_END";
	  TokenFlags2[TokenFlags2["TABLE_START"] = 64] = "TABLE_START";
	  TokenFlags2[TokenFlags2["TABLE_END"] = 128] = "TABLE_END";
	  TokenFlags2[TokenFlags2["TABLEROW_START"] = 256] = "TABLEROW_START";
	  TokenFlags2[TokenFlags2["TABLEROW_END"] = 512] = "TABLEROW_END";
	  TokenFlags2[TokenFlags2["TABLECELL_START"] = 1024] = "TABLECELL_START";
	  TokenFlags2[TokenFlags2["TABLECELL_END"] = 2048] = "TABLECELL_END";
	  TokenFlags2[TokenFlags2["NO_JOIN_PREV"] = 4096] = "NO_JOIN_PREV";
	  TokenFlags2[TokenFlags2["NO_JOIN_NEXT"] = 8192] = "NO_JOIN_NEXT";
	  TokenFlags2[TokenFlags2["WILD_CARD"] = 16384] = "WILD_CARD";
	  TokenFlags2[TokenFlags2["MANUAL_ANCHOR"] = 32768] = "MANUAL_ANCHOR";
	  TokenFlags2[TokenFlags2["IMAGE"] = 65536] = "IMAGE";
	  TokenFlags2[TokenFlags2["HTML_SUP"] = 131072] = "HTML_SUP";
	  TokenFlags2[TokenFlags2["HTML_SUB"] = 262144] = "HTML_SUB";
	  TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE1"] = 524288] = "SECTION_HEADING_TYPE1";
	  TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE2"] = 1048576] = "SECTION_HEADING_TYPE2";
	  TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE3"] = 2097152] = "SECTION_HEADING_TYPE3";
	  TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE4"] = 4194304] = "SECTION_HEADING_TYPE4";
	  TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE5"] = 8388608] = "SECTION_HEADING_TYPE5";
	  TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE6"] = 16777216] = "SECTION_HEADING_TYPE6";
	  TokenFlags2[TokenFlags2["SECTION_HEADING_MASK"] = 33030144] = "SECTION_HEADING_MASK";
	  return TokenFlags2;
	})(TokenFlags || {});

	const wildcardTrie = createTrie(true);
	wildcardTrie.insert("(추가)", TokenFlags.WILD_CARD);
	wildcardTrie.insert("(삭제)", TokenFlags.WILD_CARD);
	wildcardTrie.insert("(신설)", TokenFlags.WILD_CARD);
	wildcardTrie.insert("(생략)", TokenFlags.WILD_CARD);
	wildcardTrie.insert("(현행과같음)", TokenFlags.WILD_CARD);
	const wildcardTrieNode = wildcardTrie.root.next("(".codePointAt(0));

	const sectionHeadingTrie = createTrie(false);
	for (let i = 1; i < 40; i++) {
	  sectionHeadingTrie.insert(`${i}. `, TokenFlags.SECTION_HEADING_TYPE1);
	  sectionHeadingTrie.insert(`(${i}) `, TokenFlags.SECTION_HEADING_TYPE3);
	  sectionHeadingTrie.insert(`${i}) `, TokenFlags.SECTION_HEADING_TYPE5);
	}
	for (let i = 0; i < HANGUL_ORDER.length; i++) {
	  sectionHeadingTrie.insert(`${HANGUL_ORDER[i]}. `, TokenFlags.SECTION_HEADING_TYPE2);
	  sectionHeadingTrie.insert(`(${HANGUL_ORDER[i]}) `, TokenFlags.SECTION_HEADING_TYPE4);
	  sectionHeadingTrie.insert(`${HANGUL_ORDER[i]}) `, TokenFlags.SECTION_HEADING_TYPE6);
	}
	const SectionHeadingTrieNode = sectionHeadingTrie.root;
	const sectionHeadingStartChars = extractStartCharsFromTrie(SectionHeadingTrieNode);

	const MANUAL_ANCHOR1 = "🔗@";
	const MANUAL_ANCHOR2 = "🔗#";
	const spaceChars = {
	  " ": true,
	  "	": true,
	  "\n": true,
	  " ": true,
	  // &nbsp; ??
	  "\r": true,
	  // 글쎄...
	  "\f": true,
	  // 이것들은...
	  "\v": true
	  // 볼일이 없을것...
	};
	function normalize(text) {
	  let result = "";
	  for (const char of text) {
	    const charCode = char.codePointAt(0);
	    const normCharCode = normalizedCharMap[charCode];
	    if (normCharCode !== void 0) {
	      result += String.fromCodePoint(normCharCode);
	    } else {
	      result += char;
	    }
	  }
	  return result;
	}
	let imgSeen = 0;
	class TokenizeContext {
	  #rootContent;
	  #onDone;
	  #cancelled;
	  #generator = null;
	  #callbackId = null;
	  constructor(rootContent, onDone) {
	    this.#rootContent = rootContent;
	    this.#onDone = onDone;
	    this.#cancelled = false;
	  }
	  start() {
	    if (this.#cancelled) {
	      throw new Error("Cannot start a cancelled context");
	    }
	    if (this.#callbackId !== null) {
	      throw new Error("Cannot reuse context");
	    }
	    this.#queueNextStep();
	  }
	  cancel() {
	    this.#cancelled = true;
	    if (this.#callbackId !== null) {
	      cancelIdleCallback(this.#callbackId);
	      this.#callbackId = null;
	    }
	  }
	  #step(idleDeadline) {
	    if (this.#cancelled) {
	      return;
	    }
	    if (this.#generator === null) {
	      this.#generator = this.#generate(idleDeadline);
	    }
	    const { done, value } = this.#generator.next(idleDeadline);
	    if (this.#cancelled) {
	      return;
	    }
	    if (done) {
	      this.#onDone(value.tokens);
	    } else {
	      this.#queueNextStep();
	    }
	  }
	  #queueNextStep() {
	    this.#callbackId = requestIdleCallback((IdleDeadline) => this.#step(IdleDeadline), { timeout: 500 });
	  }
	  *#generate(idleDeadline) {
	    const tokens = [];
	    const containers = /* @__PURE__ */ new Map();
	    const root = this.#rootContent;
	    const textNodeBuf = [];
	    let tokenIndex = 0;
	    let currentToken = null;
	    let nextTokenFlags = 0;
	    let recursionCount = 0;
	    let lineNum = 1;
	    let shouldNormalize = false;
	    const blockStack = [];
	    let currentBlock = null;
	    const containerStack = [];
	    let currentContainer = {
	      element: root,
	      parent: null,
	      depth: 0,
	      startTokenIndex: 0,
	      tokenCount: 0
	    };
	    function processToken(textNode, startOffset, endOffset, flags = 0) {
	      let text = textNode.nodeValue.slice(startOffset, endOffset);
	      if (shouldNormalize) {
	        text = normalize(text);
	        shouldNormalize = false;
	      }
	      if (currentToken) {
	        currentToken.text += text;
	        currentToken.range.endContainer = textNode;
	        currentToken.range.endOffset = endOffset;
	      } else {
	        currentToken = {
	          text,
	          flags: nextTokenFlags | flags,
	          range: {
	            startContainer: textNode,
	            startOffset,
	            endContainer: textNode,
	            endOffset
	          },
	          container: currentContainer,
	          lineNum
	        };
	        nextTokenFlags = 0;
	      }
	    }
	    function finalizeToken(flags = 0) {
	      if (currentToken) {
	        currentToken.flags |= flags;
	        tokens[tokenIndex] = currentToken;
	        if (tokenIndex > 0 && currentToken.flags & TokenFlags.LINE_END) {
	          tokens[tokenIndex - 1].flags |= TokenFlags.LINE_END;
	        }
	        tokenIndex++;
	        currentToken = null;
	      }
	    }
	    function findInTrie(trie, bufferIndex, charIndex) {
	      let node = trie;
	      let i = bufferIndex;
	      let j = charIndex;
	      do {
	        const text = textNodeBuf[i].nodeValue;
	        for (; j < text.length; j++) {
	          const cp = text.codePointAt(j);
	          node = node.next(cp);
	          if (!node) {
	            return null;
	          }
	          if (node.word) {
	            return { bufferIndex: i, charIndex: j + (cp > 65535 ? 2 : 1), word: node.word, flags: node.flags };
	          }
	          if (cp > 65535) {
	            j++;
	          }
	        }
	        i++;
	        j = 0;
	      } while (i < textNodeBuf.length);
	      return null;
	    }
	    function doTokenizeText() {
	      console.assert(textNodeBuf.length > 0, "textNodes should not be empty at this point");
	      let nodeIndex = 0;
	      let charIndex = 0;
	      OUTER: do {
	        const textNode = textNodeBuf[nodeIndex];
	        const text = textNode.nodeValue;
	        const textLen = text.length;
	        let currentStart = -1;
	        while (charIndex < textLen) {
	          const cp = text.codePointAt(charIndex);
	          if (normalizedCharMap[cp] !== void 0) {
	            shouldNormalize = true;
	          }
	          let char = text[charIndex];
	          if (spaceChars[char]) {
	            if (currentStart !== -1) {
	              processToken(textNode, currentStart, charIndex);
	              currentStart = -1;
	            }
	            finalizeToken();
	          } else {
	            if (char === "(") {
	              const match = findInTrie(wildcardTrieNode, nodeIndex, charIndex + 1);
	              if (match) {
	                const startContainer = textNode;
	                const startOffset = charIndex;
	                if (currentStart !== -1) {
	                  processToken(textNode, currentStart, charIndex);
	                  currentStart = -1;
	                }
	                finalizeToken();
	                currentToken = {
	                  text: match.word,
	                  flags: nextTokenFlags | match.flags,
	                  range: {
	                    startContainer,
	                    startOffset,
	                    endContainer: textNodeBuf[match.bufferIndex],
	                    endOffset: match.charIndex
	                  },
	                  container: currentContainer,
	                  lineNum
	                };
	                nextTokenFlags = 0;
	                finalizeToken();
	                nodeIndex = match.bufferIndex;
	                charIndex = match.charIndex;
	                continue OUTER;
	              }
	            }
	            if (sectionHeadingStartChars[char] && nextTokenFlags & TokenFlags.LINE_START && !currentToken && currentStart === -1) {
	              const match = findInTrie(SectionHeadingTrieNode, nodeIndex, charIndex);
	              if (match) {
	                const startContainer = textNode;
	                const startOffset = charIndex;
	                if (currentStart !== -1) {
	                  processToken(textNode, currentStart, charIndex);
	                  currentStart = -1;
	                }
	                finalizeToken();
	                currentToken = {
	                  text: match.word,
	                  flags: nextTokenFlags | match.flags,
	                  range: {
	                    startContainer,
	                    startOffset,
	                    endContainer: textNodeBuf[match.bufferIndex],
	                    endOffset: match.charIndex
	                  },
	                  container: currentContainer,
	                  lineNum
	                };
	                nextTokenFlags = 0;
	                finalizeToken();
	                nodeIndex = match.bufferIndex;
	                charIndex = match.charIndex;
	                continue OUTER;
	              }
	            }
	            if (currentStart === -1) {
	              currentStart = charIndex;
	            }
	          }
	          charIndex++;
	          if (cp > 65535) {
	            charIndex++;
	          }
	        }
	        if (currentStart !== -1) {
	          processToken(textNode, currentStart, textLen);
	          currentStart = -1;
	        }
	        nodeIndex++;
	        charIndex = 0;
	      } while (nodeIndex < textNodeBuf.length);
	      finalizeToken();
	      textNodeBuf.length = 0;
	    }
	    function* traverse(node) {
	      const nodeName = node.nodeName;
	      const isTextFlowContainer = TEXT_FLOW_CONTAINERS[nodeName] || node === root;
	      const isBlockElement = BLOCK_ELEMENTS[nodeName];
	      if (isTextFlowContainer) {
	        containerStack.push(currentContainer);
	        currentContainer = {
	          element: node,
	          parent: currentContainer,
	          depth: currentContainer.depth + 1,
	          startTokenIndex: tokenIndex,
	          tokenCount: 0
	        };
	        nextTokenFlags |= TokenFlags.CONTAINER_START | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
	      }
	      if (isBlockElement) {
	        if (currentBlock) {
	          blockStack.push(currentBlock);
	        }
	        currentBlock = {
	          element: node,
	          container: currentContainer,
	          depth: (currentBlock?.depth ?? -1) + 1,
	          startTokenIndex: tokenIndex,
	          tokenCount: 0
	        };
	        nextTokenFlags |= TokenFlags.BLOCK_START | TokenFlags.LINE_START;
	      }
	      const isTokenBoundary = isTextFlowContainer || isBlockElement || nodeName === "TD";
	      if (isTokenBoundary && textNodeBuf.length > 0) {
	        doTokenizeText();
	      }
	      const childNodes = node.childNodes;
	      const tokenStartIndex = tokenIndex;
	      for (let i = 0; i < childNodes.length; i++) {
	        if ((++recursionCount & 31) === 0 && idleDeadline.timeRemaining() < 2) {
	          idleDeadline = yield;
	        }
	        const child = childNodes[i];
	        if (child.nodeType === 3) {
	          textNodeBuf.push(child);
	        } else if (child.nodeType === 1) {
	          const childNodeName = child.nodeName;
	          if (childNodeName === DIFF_TAG_NAME) {
	            continue;
	          }
	          if (childNodeName === "IMG") {
	            if (textNodeBuf.length > 0) {
	              doTokenizeText();
	            }
	            const range = document.createRange();
	            range.selectNode(child);
	            const src = child.src;
	            let tokenText;
	            if (src && src.startsWith("data:")) {
	              tokenText = quickHash53ToString(src);
	            } else {
	              tokenText = `(img${++imgSeen})`;
	            }
	            currentToken = {
	              text: tokenText,
	              flags: TokenFlags.IMAGE | TokenFlags.NO_JOIN_PREV | TokenFlags.NO_JOIN_NEXT | nextTokenFlags,
	              range,
	              container: currentContainer,
	              lineNum
	            };
	            nextTokenFlags = 0;
	            finalizeToken();
	            continue;
	          }
	          if (childNodeName === MANUAL_ANCHOR_ELEMENT_NAME && child.classList.contains("manual-anchor")) {
	            if (textNodeBuf.length > 0) {
	              doTokenizeText();
	            }
	            nextTokenFlags |= TokenFlags.LINE_START;
	            lineNum++;
	            if (textNodeBuf.length > 0) {
	              doTokenizeText();
	            }
	            const range = document.createRange();
	            range.selectNode(child);
	            currentToken = {
	              text: child.dataset.manualAnchor === "B" ? MANUAL_ANCHOR2 : MANUAL_ANCHOR1,
	              flags: TokenFlags.MANUAL_ANCHOR | TokenFlags.NO_JOIN_PREV | TokenFlags.NO_JOIN_NEXT | nextTokenFlags | TokenFlags.LINE_START | TokenFlags.LINE_END,
	              range,
	              container: currentContainer,
	              lineNum
	            };
	            nextTokenFlags = 0;
	            finalizeToken();
	            continue;
	          }
	          if (childNodeName === "BR" || childNodeName === "HR") {
	            if (textNodeBuf.length > 0) {
	              doTokenizeText();
	            }
	            nextTokenFlags |= TokenFlags.LINE_START;
	            lineNum++;
	            continue;
	          }
	          yield* traverse(child);
	        }
	      }
	      if (isTokenBoundary && textNodeBuf.length > 0) {
	        doTokenizeText();
	      }
	      const tokenEndIndex = tokenIndex;
	      const tokenCount = tokenEndIndex - tokenStartIndex;
	      if (tokenCount > 0) {
	        const firstToken = tokens[tokenStartIndex];
	        const lastToken = tokens[tokenIndex - 1];
	        if (nodeName === "SUP" || nodeName === "SUB") {
	          const commonFlags = nodeName === "SUP" ? TokenFlags.HTML_SUP : TokenFlags.HTML_SUB;
	          for (let i = tokenStartIndex; i < tokenIndex; i++) {
	            tokens[i].flags |= commonFlags;
	          }
	        } else if (nodeName === "TD" || nodeName === "TH") {
	          if (firstToken) {
	            firstToken.flags |= TokenFlags.TABLECELL_START | TokenFlags.NO_JOIN_PREV | TokenFlags.CONTAINER_START | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
	          }
	          if (lastToken) {
	            lastToken.flags |= TokenFlags.TABLECELL_END | TokenFlags.NO_JOIN_NEXT | TokenFlags.CONTAINER_END | TokenFlags.BLOCK_END | TokenFlags.LINE_END;
	          }
	          if (tokenCount > 0) {
	            lineNum++;
	          }
	        } else if (nodeName === "TR") {
	          if (firstToken) {
	            firstToken.flags |= TokenFlags.TABLEROW_START;
	          }
	          if (lastToken) {
	            lastToken.flags |= TokenFlags.TABLEROW_END;
	          }
	        } else if (nodeName === "TABLE") {
	          if (firstToken) {
	            firstToken.flags |= TokenFlags.TABLE_START;
	          }
	          if (lastToken) {
	            lastToken.flags |= TokenFlags.TABLE_END;
	          }
	        }
	        if (BLOCK_ELEMENTS[nodeName]) {
	          if (firstToken) {
	            firstToken.flags |= nextTokenFlags | TokenFlags.BLOCK_START | TokenFlags.LINE_START;
	          }
	          if (lastToken) {
	            lastToken.flags |= TokenFlags.BLOCK_END | TokenFlags.LINE_END;
	          }
	          nextTokenFlags |= TokenFlags.LINE_START;
	          if (tokenCount > 0) {
	            lineNum++;
	          }
	        }
	        if (node === root) {
	          firstToken.flags |= nextTokenFlags | TokenFlags.BLOCK_START | TokenFlags.CONTAINER_START | TokenFlags.LINE_START;
	          lastToken.flags |= TokenFlags.BLOCK_END | TokenFlags.CONTAINER_END | TokenFlags.LINE_END;
	        }
	      }
	      if (isBlockElement) {
	        if (tokenCount > 0) {
	          currentBlock.tokenCount = tokenEndIndex - currentBlock.startTokenIndex;
	          tokens[tokens.length - 1].flags |= TokenFlags.BLOCK_END | TokenFlags.LINE_END;
	        }
	        currentBlock = blockStack.pop() || null;
	      }
	      if (isTextFlowContainer) {
	        if (tokenCount > 0) {
	          currentContainer.tokenCount = tokenEndIndex - currentContainer.startTokenIndex;
	          tokens[tokens.length - 1].flags |= TokenFlags.CONTAINER_END | TokenFlags.BLOCK_END | TokenFlags.LINE_END;
	          containers.set(node, currentContainer);
	        }
	        currentContainer = containerStack.pop();
	      }
	    }
	    yield* traverse(root);
	    tokens.length = tokenIndex;
	    for (let i = 1; i < tokens.length; i++) {
	      if (tokens[i].flags & TokenFlags.LINE_START) {
	        tokens[i - 1].flags |= TokenFlags.LINE_END;
	      }
	    }
	    return { tokens, containers };
	  }
	}

	function getSectionHeadingTrail(sectionRoots, tokenIndex) {
	  const deepest = findDeepestSectionHeading(sectionRoots, tokenIndex);
	  if (!deepest) return [];
	  const trail = buildSectionTrail(deepest);
	  return trail;
	}
	function findDeepestSectionHeading(sectionRoots, tokenIndex) {
	  let result = null;
	  function search(node) {
	    if (tokenIndex < node.startTokenIndex || tokenIndex >= node.endTokenIndex) return;
	    result = node;
	    let child = node.firstChild;
	    while (child) {
	      search(child);
	      child = child.nextSibling;
	    }
	  }
	  for (const root of sectionRoots) {
	    search(root);
	  }
	  return result;
	}
	function buildSectionTrail(heading) {
	  const trail = [];
	  let current = heading;
	  while (current) {
	    trail.unshift(current);
	    current = current.parent;
	  }
	  return trail;
	}

	class DiffContext {
	  leftTokens;
	  rightTokens;
	  diffOptions;
	  rawEntries;
	  entries;
	  leftEntries;
	  rightEntries;
	  diffs;
	  leftSectionHeadings;
	  rightSectionHeadings;
	  constructor(leftTokens, rightTokens, diffOptions, rawEntries, entries, leftEntries, rightEntries, diffs, leftSectionHeadings = [], rightSectionHeadings = []) {
	    this.leftTokens = leftTokens;
	    this.rightTokens = rightTokens;
	    this.diffOptions = diffOptions;
	    this.rawEntries = rawEntries;
	    this.entries = entries;
	    this.leftEntries = leftEntries;
	    this.rightEntries = rightEntries;
	    this.diffs = diffs;
	    this.leftSectionHeadings = leftSectionHeadings;
	    this.rightSectionHeadings = rightSectionHeadings;
	  }
	  /**
	   * 주어진 `tokenIndex`의 토큰이 속한 섹션 헤딩을 찾고, 해당 헤딩부터 최상위 부모 헤딩까지의 계층적 trail을 반환함.
	   *
	   * 토큰이 속한 섹션 헤딩을 찾지 못하는 경우 빈 배열을 반환함.
	   *
	   * @param side - `"left"` or `"right"`.
	   * @param tokenIndex - trail을 구하려는 토큰의 인덱스.
	   * @returns {SectionHeading[]}
	   *          최하위 섹션 헤딩부터 상위 부모 헤딩까지 포함된 배열.
	   *          배열 순서는 [조상 > 부모 > 현재] 형태.
	   */
	  getSelectionTrailFromTokenIndex(side, tokenIndex) {
	    const headings = side === "left" ? this.leftSectionHeadings : this.rightSectionHeadings;
	    return getSectionHeadingTrail(headings, tokenIndex);
	  }
	  /**
	   * sourceSpan이 가리키는 토큰 구간을 기준으로 반대편 구간을 찾아낸다.
	   * 토큰이 항상 1대1로 매칭이 된다면 참으로 아름다운 세상이었겠지만 인생 그렇게 쉽지 않다...
	   *
	   * 예: 왼쪽은 ["가","나"](두개의 토큰), 오른쪽은 ["가나"](하나의 토큰)인 경우 왼쪽에서 "가"만 선택하더라도
	   * 오른쪽은 "가나"가 매칭이 되어야 한다. 그러면 오른쪽의 "가나"에 매칭되는 왼쪽은 토큰은? "가"와 "나"가 된다.
	   *
	   * source, dest, source, dest 확장이 안될때까지 무한 확장을 시도하는 방법을 쓰다가 잠들기 전 더 쉽고 빠른 방법이 생각나서 바꿈.
	   *
	   * 파라미터:
	   * @param side - `"left"` or `"right"`.
	   * @param sourceSpan { start, end } 형태. start와 end는 토큰 인덱스. end는 exclusive임.
	   *
	   * 반환값:
	   * @returns { left: Span, right: Span } left와 right는 start,end 토큰인덱스가 들어있는 span이고
	   * 										마찬가지로 end는 exclusive.
	   *
	   * 예외:
	   * @throws {Error} sourceSpan의 토큰인덱스가 out of bound인 경우. side 체크는 안한다. 그건 알아서 잘 하겠지.
	   *
	   * 예시:
	   * // 왼쪽 ["가","나"], 오른쪽 ["가나"]
	   * // side = "left", sourceSpan = "가"
	   * // 결과 => left=["가","나"], right=["가나"]
	   */
	  resolveMatchingSpanPair(side, sourceSpan) {
	    if (this.entries.length === 0) {
	      return { left: { start: 0, end: 0 }, right: { start: 0, end: 0 } };
	    }
	    const thisEntries = this[`${side}Entries`];
	    const n = thisEntries.length;
	    if (n === 0 || sourceSpan.start === 0 && sourceSpan.end === 0) {
	      return { left: { start: 0, end: 0 }, right: { start: 0, end: 0 } };
	    }
	    if (sourceSpan.start < 0 || sourceSpan.end < sourceSpan.start || sourceSpan.end > n) {
	      throw new Error(`Invalid span [${sourceSpan.start}, ${sourceSpan.end}) for side=${side}`);
	    }
	    const other = side === "left" ? "right" : "left";
	    const expandOnSide = (fromSide, span) => {
	      const entries = this[`${fromSide}Entries`];
	      let a = span.start;
	      let b = span.end;
	      let realStart, realEnd;
	      if (a >= entries.length) {
	        realStart = realEnd = entries.length;
	      } else if (a === b) {
	        realStart = entries[a][fromSide].start;
	        if (realStart < a) {
	          realEnd = entries[a][fromSide].end;
	        } else {
	          realEnd = a;
	        }
	      } else {
	        realStart = entries[a][fromSide].start;
	        realEnd = entries[b - 1][fromSide].end;
	      }
	      return { start: realStart, end: realEnd };
	    };
	    const expanded = expandOnSide(side, sourceSpan);
	    let otherSpan;
	    if (expanded.start === expanded.end) {
	      const k = expanded.start;
	      if (k >= thisEntries.length) {
	        const startAndEnd = thisEntries[thisEntries.length - 1]?.[other]?.end ?? 0;
	        otherSpan = {
	          start: startAndEnd,
	          end: startAndEnd
	        };
	      } else if (thisEntries[k] && thisEntries[k][other]) {
	        otherSpan = {
	          start: thisEntries[k][other].start,
	          end: thisEntries[k][other].start
	        };
	      } else {
	        otherSpan = { start: 0, end: 0 };
	      }
	    } else {
	      otherSpan = {
	        start: thisEntries[expanded.start][other].start,
	        end: thisEntries[expanded.end - 1][other].end
	      };
	    }
	    return side === "left" ? { left: expanded, right: otherSpan } : { left: otherSpan, right: expanded };
	  }
	  zresolveMatchingSpanPair(side, sourceSpan) {
	    console.log("resolveMatchingSpanPair:", side, sourceSpan);
	    const thisEntries = this[`${side}Entries`];
	    const entriesLen = thisEntries.length;
	    if (sourceSpan.start < 0 || sourceSpan.end < sourceSpan.start || sourceSpan.end > entriesLen) {
	      throw new Error(`Invalid span [${sourceSpan.start}, ${sourceSpan.end}) for side=${side}`);
	    }
	    const expand = (fromSide, span) => {
	      const entries = this[`${fromSide}Entries`];
	      console.log("expanding", entries, span);
	      let realStart = span.start;
	      let realEnd = span.end;
	      if (span.start === span.end) {
	        if (entries[realStart - 1].type !== 0) {
	          realStart = entries[realStart - 1][fromSide].start;
	          realEnd = entries[realStart - 1][fromSide].end;
	        }
	      } else {
	        while (realStart > 0 && entries[realStart - 1][fromSide].start <= span.start && entries[realStart - 1][fromSide].end > span.start) {
	          realStart--;
	        }
	        while (realEnd < entries.length && entries[realEnd][fromSide].start < span.end) {
	          realEnd++;
	        }
	      }
	      return { start: realStart, end: realEnd };
	    };
	    const expanded = expand(side, sourceSpan);
	    console.log("expanded:", expanded);
	    const otherSide = side === "left" ? "right" : "left";
	    const thisFirstEntry = thisEntries[expanded.start];
	    const thisLastEntry = thisEntries[Math.max(expanded.end - 1, expanded.start)];
	    console.log(
	      "ret:",
	      side === "left" ? {
	        left: expanded,
	        right: {
	          start: thisFirstEntry[otherSide].start,
	          end: thisLastEntry[otherSide].end
	        }
	      } : {
	        left: {
	          start: thisFirstEntry[otherSide].start,
	          end: thisLastEntry[otherSide].end
	        },
	        right: expanded
	      }
	    );
	    return side === "left" ? {
	      left: expanded,
	      right: {
	        start: thisFirstEntry[otherSide].start,
	        end: thisLastEntry[otherSide].end
	      }
	    } : {
	      left: {
	        start: thisFirstEntry[otherSide].start,
	        end: thisLastEntry[otherSide].end
	      },
	      right: expanded
	    };
	  }
	}

	function clampRange(range, startAfter, endBefore) {
	  try {
	    if (startAfter && range.comparePoint(startAfter, 0) >= 0) {
	      range.setStartAfter(startAfter);
	    }
	  } catch (e) {
	  }
	  try {
	    if (endBefore && range.comparePoint(endBefore, 0) <= 0) {
	      range.setEndBefore(endBefore);
	    }
	  } catch (e) {
	  }
	  return range;
	}

	function getParentElement(node) {
	  const element = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
	  return element;
	}

	function findClosestContainer(node, selector) {
	  return getParentElement(node).closest(selector);
	}

	function getHeadingLevelFromFlag(flag) {
	  switch (flag) {
	    case TokenFlags.SECTION_HEADING_TYPE1:
	      return 0;
	    // 1.
	    case TokenFlags.SECTION_HEADING_TYPE2:
	      return 1;
	    // 가.
	    case TokenFlags.SECTION_HEADING_TYPE3:
	      return 2;
	    // (1)
	    case TokenFlags.SECTION_HEADING_TYPE4:
	      return 3;
	    // (가)
	    case TokenFlags.SECTION_HEADING_TYPE5:
	      return 4;
	    // 1)
	    case TokenFlags.SECTION_HEADING_TYPE6:
	      return 5;
	    // 가)
	    default:
	      return -1;
	  }
	}

	function parseOrdinalNumber(ordinalText) {
	  const norm = ordinalText.replace(/[\(\)\.]/g, "");
	  if (/^\d+$/.test(norm)) {
	    return Number(norm);
	  }
	  const idx = HANGUL_ORDER.indexOf(norm);
	  if (idx !== -1) {
	    return idx + 1;
	  }
	  return NaN;
	}

	class DiffProcessor {
	  #leftEditor;
	  #rightEditor;
	  #editorPairer;
	  #cancelled = false;
	  #ricCancelId = null;
	  #leftTokens;
	  #rightTokens;
	  #diffOptions;
	  #rawEntries;
	  #diffs = [];
	  #entries = null;
	  #leftEntries = null;
	  #rightEntries = null;
	  #leftSectionHeadings = null;
	  #rightSectionHeadings = null;
	  constructor(leftEditor, rightEditor, editorPairer, rawEntries, diffOptions) {
	    this.#leftEditor = leftEditor;
	    this.#rightEditor = rightEditor;
	    this.#editorPairer = editorPairer;
	    this.#rawEntries = rawEntries;
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
	  process(onComplete) {
	    let generator = null;
	    const step = (idleDeadline) => {
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
	          this.#rawEntries,
	          this.#entries,
	          this.#leftEntries,
	          this.#rightEntries,
	          this.#diffs,
	          this.#leftSectionHeadings,
	          this.#rightSectionHeadings
	        );
	        onComplete?.(diffContext);
	      } else {
	        this.#ricCancelId = requestIdleCallback(step, {
	          timeout: COMPUTE_DIFF_TIMEOUT
	        });
	      }
	    };
	    this.#ricCancelId = requestIdleCallback(step, {
	      timeout: COMPUTE_DIFF_TIMEOUT
	    });
	  }
	  *#processGenerator(idleDeadline) {
	    this.#buildDiffEntries();
	    if (idleDeadline.timeRemaining() <= 0) {
	      idleDeadline = yield;
	    }
	    const entries = this.#entries;
	    this.#editorPairer.beginUpdate();
	    this.#leftSectionHeadings = this.#buildSectionHeadingTree(this.#leftEditor, this.#leftTokens);
	    this.#rightSectionHeadings = this.#buildSectionHeadingTree(this.#rightEditor, this.#rightTokens);
	    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
	      if ((entryIndex & 31) === 0) {
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
	  }
	  #handleCommonEntry(entryIndex) {
	    const { left, right } = this.#entries[entryIndex];
	    const leftTokens = this.#leftTokens;
	    const rightTokens = this.#rightTokens;
	    const leftToken = leftTokens[left.start];
	    const rightToken = rightTokens[right.start];
	    const commonFlags = leftToken.flags & rightToken.flags;
	    if (commonFlags & TokenFlags.LINE_START) {
	      this.#editorPairer.addAnchorPair(left.start, null, right.start, null, null);
	    }
	  }
	  getAnchorInsertableRange(side, tokenIndex) {
	    const editor = side === "left" ? this.#leftEditor : this.#rightEditor;
	    const range = editor.getTokenRange(tokenIndex, 0);
	    return range;
	  }
	  #handleDiffEntry(entryIndex) {
	    const leftTokens = this.#leftTokens;
	    const rightTokens = this.#rightTokens;
	    const entries = this.#entries;
	    const diffs = this.#diffs;
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
	    let leftMarkerEl = null;
	    let rightMarkerEl = null;
	    if (leftTokenCount > 0 && rightTokenCount > 0) {
	      const commonFlags = leftToken.flags & rightToken.flags;
	      if (commonFlags & TokenFlags.LINE_START) {
	        anchorsEligible = true;
	      }
	    } else {
	      let emptySide;
	      let emptyRange;
	      let filledTokens;
	      let filledSpan;
	      let markerEl = null;
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
	      let prevCommonFlags = 0, nextCommonFlags = 0;
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
	      rightMarkerEl
	    });
	    if (anchorsEligible) {
	      this.#editorPairer.addAnchorPair(left.start, leftMarkerEl, right.start, rightMarkerEl, diffIndex);
	    }
	  }
	  #clampRangeByStructure(range, hintFlags, prevCommonFlags, nextCommonFlags) {
	    let clampAfter = null;
	    let clampBefore = null;
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
	    const entries = [];
	    const leftEntries = new Array(this.#leftTokens.length);
	    const rightEntries = new Array(this.#rightTokens.length);
	    const rawEntries = this.#rawEntries;
	    let currentDiff = null;
	    for (let i = 0; i < rawEntries.length; i++) {
	      const rawEntry = rawEntries[i];
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
	  #buildSectionHeadingTree(editor, tokens) {
	    const rootHeadings = [];
	    const stack = [];
	    for (let i = 0; i < tokens.length; i++) {
	      const token = tokens[i];
	      const headingFlag = token.flags & TokenFlags.SECTION_HEADING_MASK;
	      if (!headingFlag) continue;
	      const level = getHeadingLevelFromFlag(headingFlag);
	      const ordinalText = token.text;
	      const ordinalNum = parseOrdinalNumber(ordinalText);
	      let titleEndTokenIndex = i;
	      while (titleEndTokenIndex < tokens.length && (tokens[titleEndTokenIndex++].flags & TokenFlags.LINE_END) === 0) ;
	      const tokenRange = editor.getTokenRange(i + 1, titleEndTokenIndex);
	      const title = tokenRange.toString();
	      const heading = {
	        type: headingFlag,
	        level,
	        ordinalText,
	        ordinalNum,
	        title,
	        parent: null,
	        firstChild: null,
	        nextSibling: null,
	        startTokenIndex: i,
	        endTokenIndex: Number.MAX_SAFE_INTEGER
	        // temp
	      };
	      while (stack.length > 0 && heading.level <= stack[stack.length - 1].level) {
	        const closed = stack.pop();
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
	    for (const remaining of stack) {
	      remaining.endTokenIndex = tokens.length;
	    }
	    return rootHeadings;
	  }
	}

	const jsContent = `(function () {
    'use strict';

    var TokenFlags = /* @__PURE__ */ ((TokenFlags2) => {
      TokenFlags2[TokenFlags2["None"] = 0] = "None";
      TokenFlags2[TokenFlags2["LINE_START"] = 1] = "LINE_START";
      TokenFlags2[TokenFlags2["LINE_END"] = 2] = "LINE_END";
      TokenFlags2[TokenFlags2["BLOCK_START"] = 4] = "BLOCK_START";
      TokenFlags2[TokenFlags2["BLOCK_END"] = 8] = "BLOCK_END";
      TokenFlags2[TokenFlags2["CONTAINER_START"] = 16] = "CONTAINER_START";
      TokenFlags2[TokenFlags2["CONTAINER_END"] = 32] = "CONTAINER_END";
      TokenFlags2[TokenFlags2["TABLE_START"] = 64] = "TABLE_START";
      TokenFlags2[TokenFlags2["TABLE_END"] = 128] = "TABLE_END";
      TokenFlags2[TokenFlags2["TABLEROW_START"] = 256] = "TABLEROW_START";
      TokenFlags2[TokenFlags2["TABLEROW_END"] = 512] = "TABLEROW_END";
      TokenFlags2[TokenFlags2["TABLECELL_START"] = 1024] = "TABLECELL_START";
      TokenFlags2[TokenFlags2["TABLECELL_END"] = 2048] = "TABLECELL_END";
      TokenFlags2[TokenFlags2["NO_JOIN_PREV"] = 4096] = "NO_JOIN_PREV";
      TokenFlags2[TokenFlags2["NO_JOIN_NEXT"] = 8192] = "NO_JOIN_NEXT";
      TokenFlags2[TokenFlags2["WILD_CARD"] = 16384] = "WILD_CARD";
      TokenFlags2[TokenFlags2["MANUAL_ANCHOR"] = 32768] = "MANUAL_ANCHOR";
      TokenFlags2[TokenFlags2["IMAGE"] = 65536] = "IMAGE";
      TokenFlags2[TokenFlags2["HTML_SUP"] = 131072] = "HTML_SUP";
      TokenFlags2[TokenFlags2["HTML_SUB"] = 262144] = "HTML_SUB";
      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE1"] = 524288] = "SECTION_HEADING_TYPE1";
      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE2"] = 1048576] = "SECTION_HEADING_TYPE2";
      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE3"] = 2097152] = "SECTION_HEADING_TYPE3";
      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE4"] = 4194304] = "SECTION_HEADING_TYPE4";
      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE5"] = 8388608] = "SECTION_HEADING_TYPE5";
      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE6"] = 16777216] = "SECTION_HEADING_TYPE6";
      TokenFlags2[TokenFlags2["SECTION_HEADING_MASK"] = 33030144] = "SECTION_HEADING_MASK";
      return TokenFlags2;
    })(TokenFlags || {});

    let _nextCtx = null;
    let _currentCtx = null;
    self.onmessage = (e) => {
      if (e.data.type === "diff") {
        const request = e.data;
        const ctx = {
          ...request,
          cancel: false,
          start: 0,
          finish: 0,
          lastYield: 0,
          entries: []
          //states: {},
        };
        if (_currentCtx) {
          _currentCtx.cancel = true;
          _nextCtx = ctx;
          return;
        }
        runDiff(ctx);
      } else if (e.data.type === "slice") {
        if (_currentCtx) {
          self.postMessage({
            reqId: e.data.reqId,
            type: "slice",
            accepted: false
          });
          return;
        }
        const ctx = {
          reqId: e.data.reqId,
          type: "slice",
          cancel: false,
          leftTokens: tokenizeSimple(e.data.leftText),
          rightTokens: tokenizeSimple(e.data.rightText),
          start: 0,
          finish: 0,
          lastYield: 0,
          options: e.data.options,
          entries: []
          //states: {},
        };
        runDiff(ctx);
      }
    };
    function tokenizeSimple(text) {
      const len = text.length;
      const result = new Array(len);
      for (let i = 0; i < len; i++) {
        result[i] = { text: text[i], flags: 0 };
      }
      return result;
    }
    async function runDiff(ctx) {
      _currentCtx = ctx;
      try {
        ctx.lastYield = ctx.start = performance.now();
        self.postMessage({
          reqId: ctx.reqId,
          type: "start",
          start: ctx.start
        });
        let result;
        if (ctx.options.algorithm === "histogram") {
          result = await runHistogramDiff(ctx);
        } else if (ctx.options.algorithm === "lcs") {
          result = await runLcsDiff(ctx);
        } else {
          throw new Error("Unknown algorithm: " + ctx.options.algorithm);
        }
        ctx.finish = performance.now();
        _currentCtx = null;
        if (ctx.type === "diff") {
          self.postMessage({
            reqId: ctx.reqId,
            type: ctx.type,
            processTime: ctx.finish - ctx.start,
            diffs: result,
            options: ctx.options
          });
        } else if (ctx.type === "slice") {
          self.postMessage({
            reqId: ctx.reqId,
            type: ctx.type,
            accepted: true,
            processTime: ctx.finish - ctx.start,
            diffs: result,
            options: ctx.options
          });
        }
      } catch (e) {
        if (e instanceof Error && e.message === "cancelled") ; else {
          console.error(e);
        }
      }
      [ctx, _nextCtx] = [_nextCtx, null];
      if (ctx) {
        return await runDiff(ctx);
      }
    }
    async function runLcsDiff(ctx) {
      const lhsTokens = ctx.leftTokens;
      const rhsTokens = ctx.rightTokens;
      const rawResult = await computeDiff(lhsTokens, rhsTokens, !!ctx.options.greedyMatch, ctx);
      return rawResult;
    }
    async function computeLCS(leftTokens, rightTokens, ctx) {
      const m = leftTokens.length;
      const n = rightTokens.length;
      const dp = new Array(m + 1);
      for (let i2 = 0; i2 <= m; i2++) {
        dp[i2] = new Array(n + 1).fill(0);
      }
      for (let i2 = 1; i2 <= m; i2++) {
        const leftText = leftTokens[i2 - 1].text;
        for (let j2 = 1; j2 <= n; j2++) {
          if (ctx && (i2 + j2 & 16383) === 0) {
            const now = performance.now();
            if (now - ctx.lastYield > 50) {
              ctx.lastYield = now;
              await new Promise((resolve) => setTimeout(resolve, 0));
              if (ctx.cancel) {
                throw new Error("cancelled");
              }
            }
          }
          if (leftText === rightTokens[j2 - 1].text) {
            dp[i2][j2] = dp[i2 - 1][j2 - 1] + 1;
          } else {
            dp[i2][j2] = Math.max(dp[i2 - 1][j2], dp[i2][j2 - 1]);
          }
        }
      }
      let i = m;
      let j = n;
      const lcsIndices = [];
      while (i > 0 && j > 0) {
        if (leftTokens[i - 1].text === rightTokens[j - 1].text) {
          lcsIndices.push({
            leftIndex: i - 1,
            rightIndex: j - 1
          });
          i--;
          j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
          i--;
        } else {
          j--;
        }
      }
      lcsIndices.reverse();
      return lcsIndices;
    }
    async function computeDiff(lhsTokens, rhsTokens, greedyMatch = false, ctx) {
      const entries = [];
      const lcs = await computeLCS(lhsTokens, rhsTokens, ctx);
      const lcsLength = lcs.length;
      const leftTokensLength = lhsTokens.length;
      const rightTokensLength = rhsTokens.length;
      if (leftTokensLength === 0 && rightTokensLength === 0) ; else if (leftTokensLength === 0) {
        entries.push({
          type: 2,
          left: {
            start: 0,
            end: leftTokensLength
            // empty: true,
          },
          right: {
            start: 0,
            end: rightTokensLength
          }
        });
      } else if (rightTokensLength === 0) {
        entries.push({
          type: 1,
          left: {
            start: 0,
            end: leftTokensLength
          },
          right: {
            start: 0,
            end: rightTokensLength
            // empty: true,
          }
        });
      } else {
        let i = 0;
        let j = 0;
        let lcsIndex = 0;
        let iteration = 0;
        while (lcsIndex < lcsLength || i < leftTokensLength || j < rightTokensLength) {
          if (ctx && (iteration & 1023) === 0) {
            const now = performance.now();
            if (now - ctx.lastYield > 100) {
              ctx.lastYield = now;
              await new Promise((resolve) => setTimeout(resolve, 0));
              if (ctx.cancel) {
                throw new Error("cancelled");
              }
            }
          }
          if (lcsIndex < lcsLength && (greedyMatch && lhsTokens[i].text === lhsTokens[lcs[lcsIndex].leftIndex].text && rhsTokens[j].text === rhsTokens[lcs[lcsIndex].rightIndex].text || i === lcs[lcsIndex].leftIndex && j === lcs[lcsIndex].rightIndex)) {
            entries.push({
              type: 0,
              left: {
                start: i,
                end: i + 1
              },
              right: {
                start: j,
                end: j + 1
              }
            });
            i++;
            j++;
            lcsIndex++;
            continue;
          }
          const lcsEntry = lcs[lcsIndex];
          while (i < leftTokensLength && // 유효한 토큰 index
          (!lcsEntry || // 공통 sequence가 없는 경우
          !greedyMatch && i < lcsEntry.leftIndex || // 정확한 lcsIndex에만 매칭시키는 경우
          lhsTokens[i].text !== lhsTokens[lcsEntry.leftIndex].text)) {
            entries.push({
              type: 1,
              left: {
                start: i,
                end: i + 1
              },
              right: {
                start: j,
                end: j
              }
            });
            i++;
          }
          while (j < rightTokensLength && // 유효한 토큰 index
          (!lcsEntry || // 공통 sequence가 없는 경우
          !greedyMatch && j < lcsEntry.rightIndex || // 정확한 lcsIndex에만 매칭시키는 경우
          rhsTokens[j].text !== rhsTokens[lcsEntry.rightIndex].text)) {
            entries.push({
              type: 2,
              left: {
                start: i,
                end: i
              },
              right: {
                start: j,
                end: j + 1
              }
            });
            j++;
          }
        }
      }
      return entries;
    }
    async function runHistogramDiff(ctx) {
      const lhsTokens = ctx.leftTokens;
      const rhsTokens = ctx.rightTokens;
      let leftAnchors = [];
      let rightAnchors = [];
      for (let i = 0; i < lhsTokens.length; i++) {
        if (lhsTokens[i].flags & TokenFlags.MANUAL_ANCHOR) {
          leftAnchors.push(i);
        }
      }
      if (leftAnchors.length > 0) {
        for (let i = 0; i < rhsTokens.length; i++) {
          if (rhsTokens[i].flags & TokenFlags.MANUAL_ANCHOR) {
            rightAnchors.push(i);
          }
        }
      }
      const matches = [];
      if (rightAnchors.length > 0) {
        let rightPos = 0;
        for (let l = 0; l < leftAnchors.length; l++) {
          const leftTokenIndex = leftAnchors[l];
          for (let r = rightPos; r < rightAnchors.length; r++) {
            const rightTokenIndex = rightAnchors[r];
            if (lhsTokens[leftTokenIndex].text === rhsTokens[rightTokenIndex].text) {
              matches.push({ lhsIndex: leftTokenIndex, rhsIndex: rightTokenIndex });
              rightPos = r + 1;
              break;
            }
          }
        }
      }
      let prevLhs = 0;
      let prevRhs = 0;
      for (const match of matches) {
        const lhsAnchor = match.lhsIndex;
        const rhsAnchor = match.rhsIndex;
        if (prevLhs < lhsAnchor || prevRhs < rhsAnchor) {
          await diffCore(ctx, lhsTokens, prevLhs, lhsAnchor, rhsTokens, prevRhs, rhsAnchor, findBestHistogramAnchor);
        }
        ctx.entries.push({
          type: 0,
          left: {
            start: lhsAnchor,
            end: lhsAnchor + 1
          },
          right: {
            start: rhsAnchor,
            end: rhsAnchor + 1
          }
        });
        prevLhs = lhsAnchor + 1;
        prevRhs = rhsAnchor + 1;
      }
      if (prevLhs < lhsTokens.length || prevRhs < rhsTokens.length) {
        await diffCore(ctx, lhsTokens, prevLhs, lhsTokens.length, rhsTokens, prevRhs, rhsTokens.length, findBestHistogramAnchor);
      }
      return ctx.entries;
    }
    const findBestHistogramAnchor = function(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, ctx) {
      const diffOptions = ctx.options;
      const LENGTH_BIAS_FACTOR = diffOptions.lengthBiasFactor || 0.7;
      const UNIQUE_BONUS = 1 / (diffOptions.uniqueMultiplier || 1 / 0.5);
      1 / (diffOptions.containerStartMultiplier || 1 / 0.85);
      1 / (diffOptions.containerEndMultiplier || 1 / 0.8);
      1 / (diffOptions.lineStartMultiplier || 1 / 0.85);
      1 / (diffOptions.lineEndMultiplier || 1 / 0.9);
      1 / (diffOptions.sectionHeadingMultiplier || 1 / 0.75);
      const useLengthBias = !!ctx.options.useLengthBias;
      const maxGram = ctx.options.maxGram || 1;
      const useMatchPrefix = ctx.options.ignoreWhitespace !== "normalize";
      const onlyAtEdge = ctx.options.ignoreWhitespace === "onlyAtEdge";
      const maxLen = useMatchPrefix ? Math.floor(maxGram * 1.5) : maxGram;
      const delimiter = useMatchPrefix ? "" : "\\0";
      const freq = {};
      for (let n = 1; n <= maxLen; n++) {
        for (let i = lhsLower; i <= lhsUpper - n; i++) {
          let key = lhsTokens[i].text;
          for (let k = 1; k < n; k++) {
            key += delimiter + lhsTokens[i + k].text;
          }
          freq[key] = (freq[key] || 0) + 1;
        }
        for (let i = rhsLower; i <= rhsUpper - n; i++) {
          let key = rhsTokens[i].text;
          for (let k = 1; k < n; k++) {
            key += delimiter + rhsTokens[i + k].text;
          }
          freq[key] = (freq[key] || 0) + 1;
        }
      }
      let best = null;
      for (let i = lhsLower; i < lhsUpper; i++) {
        const ltext1 = lhsTokens[i].text;
        for (let j = rhsLower; j < rhsUpper; j++) {
          let li = i, ri = j;
          let lhsLen = 0, rhsLen = 0;
          let nGrams = 0;
          while (li < lhsUpper && ri < rhsUpper && lhsLen < maxLen && rhsLen < maxLen && nGrams < maxGram) {
            const ltext = lhsTokens[li].text;
            const rtext = rhsTokens[ri].text;
            if (ltext === rtext) {
              li++;
              ri++;
              lhsLen++;
              rhsLen++;
              nGrams++;
              continue;
            }
            if (useMatchPrefix && ltext.length !== rtext.length && ltext[0] === rtext[0]) {
              const match = matchPrefixTokens(lhsTokens, li, lhsUpper, rhsTokens, ri, rhsUpper, onlyAtEdge);
              if (match) {
                const matchedGrams = Math.min(match[0], match[1]);
                if (lhsLen + match[0] <= maxLen && rhsLen + match[1] <= maxLen && nGrams + matchedGrams <= maxGram) {
                  li += match[0];
                  ri += match[1];
                  lhsLen += match[0];
                  rhsLen += match[1];
                  nGrams += matchedGrams;
                  continue;
                }
              }
            }
            break;
          }
          if (lhsLen > 0 && rhsLen > 0) {
            let frequency;
            let len;
            if (lhsLen === 1) {
              frequency = freq[ltext1] || 1;
              len = ltext1.length;
            } else {
              let key = lhsTokens[i].text;
              len = key.length;
              for (let k = 1; k < lhsLen; k++) {
                const text = lhsTokens[i + k].text;
                key += delimiter + text;
                len += text.length;
              }
              frequency = freq[key] || 1;
            }
            let score = 0;
            score = useLengthBias ? frequency / (1 + Math.log(len + 1) * LENGTH_BIAS_FACTOR) : frequency;
            if (frequency === 1) {
              score *= UNIQUE_BONUS;
            }
            let boundaryBonus = 1;
            score *= boundaryBonus;
            if (!best || score < best.score) {
              best = {
                lhsIndex: i,
                lhsLength: lhsLen,
                rhsIndex: j,
                rhsLength: rhsLen,
                score
                // anchorText,
              };
            }
          }
        }
      }
      return best ?? null;
    };
    async function diffCore(ctx, leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, findAnchor, consumeDirections = 3) {
      if (lhsLower > lhsUpper || rhsLower > rhsUpper) {
        throw new Error("Invalid range");
      }
      const entries = ctx.entries;
      const now = performance.now();
      if (now - ctx.lastYield > 100) {
        ctx.lastYield = now;
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (ctx.cancel) throw new Error("cancelled");
      }
      let skippedHead;
      let skippedTail;
      [lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(
        leftTokens,
        rightTokens,
        lhsLower,
        lhsUpper,
        rhsLower,
        rhsUpper,
        ctx.options.tokenization === "word" ? ctx.options.ignoreWhitespace : "normalize",
        consumeDirections
      );
      for (const item of skippedHead) {
        entries.push(item);
      }
      let anchor = null;
      if (lhsLower < lhsUpper && rhsLower < rhsUpper && (anchor = findAnchor(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx)) && (anchor.lhsLength > 0 || anchor.rhsLength > 0) && // for safety! 적어도 한쪽이라도 영역을 줄여야 무한루프 안 생길 듯?
      anchor.lhsIndex >= lhsLower && anchor.lhsIndex + anchor.lhsLength <= lhsUpper && anchor.rhsIndex >= rhsLower && anchor.rhsIndex + anchor.rhsLength <= rhsUpper) {
        await diffCore(ctx, leftTokens, lhsLower, anchor.lhsIndex, rightTokens, rhsLower, anchor.rhsIndex, findAnchor, 2);
        await diffCore(ctx, leftTokens, anchor.lhsIndex, lhsUpper, rightTokens, anchor.rhsIndex, rhsUpper, findAnchor, 1);
      } else {
        if (lhsLower < lhsUpper || rhsLower < rhsUpper) {
          let type = 0;
          if (lhsLower < lhsUpper) type |= 1;
          if (rhsLower < rhsUpper) type |= 2;
          entries.push({
            type,
            left: {
              start: lhsLower,
              end: lhsUpper
            },
            right: {
              start: rhsLower,
              end: rhsUpper
            }
          });
        }
      }
      for (const item of skippedTail) {
        entries.push(item);
      }
      return entries;
    }
    function consumeCommonEdges(lhsTokens, rhsTokens, lhsLower, lhsUpper, rhsLower, rhsUpper, whitespace = "onlyAtEdge", consumeDirections = 3) {
      const head = [];
      const tail = [];
      let matchedCount;
      if (consumeDirections & 1) {
        while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
          if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text) {
            head.push({
              type: 0,
              left: { start: lhsLower, end: lhsLower + 1 },
              right: { start: rhsLower, end: rhsLower + 1 }
            });
            lhsLower++;
            rhsLower++;
          } else if (whitespace !== "normalize" && lhsTokens[lhsLower].text.length !== rhsTokens[rhsLower].text.length && lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] && (matchedCount = matchPrefixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, whitespace === "onlyAtEdge"))) {
            head.push({
              type: 0,
              left: {
                start: lhsLower,
                end: lhsLower + matchedCount[0]
              },
              right: {
                start: rhsLower,
                end: rhsLower + matchedCount[1]
              }
            });
            lhsLower += matchedCount[0];
            rhsLower += matchedCount[1];
          } else {
            break;
          }
        }
      }
      if (consumeDirections & 2) {
        while (lhsUpper > lhsLower && rhsUpper > rhsLower) {
          if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {
            tail.push({
              type: 0,
              left: { start: lhsUpper - 1, end: lhsUpper },
              right: { start: rhsUpper - 1, end: rhsUpper }
            });
            lhsUpper--;
            rhsUpper--;
          } else if (whitespace !== "normalize" && lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length && lhsTokens[lhsUpper - 1].text.at(-1) === rhsTokens[rhsUpper - 1].text.at(-1) && (matchedCount = matchSuffixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, whitespace === "onlyAtEdge"))) {
            tail.push({
              type: 0,
              left: {
                start: lhsUpper - matchedCount[0],
                end: lhsUpper
              },
              right: {
                start: rhsUpper - matchedCount[1],
                end: rhsUpper
              }
            });
            lhsUpper -= matchedCount[0];
            rhsUpper -= matchedCount[1];
          } else {
            break;
          }
        }
        tail.reverse();
      }
      return [lhsLower, lhsUpper, rhsLower, rhsUpper, head, tail];
    }
    function matchPrefixTokens(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, allowJoinOnlyAtLineBoundary) {
      if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;
      let i = lhsLower, j = rhsLower;
      let ci = 0, cj = 0;
      let lhsToken = leftTokens[i++], ltext = lhsToken.text, lhsLen = ltext.length;
      let rhsToken = rightTokens[j++], rtext = rhsToken.text, rhsLen = rtext.length;
      while (true) {
        while (ci < lhsLen && cj < rhsLen) {
          if (ltext[ci++] !== rtext[cj++]) {
            return false;
          }
        }
        if (ci === lhsLen && cj === rhsLen) return [i - lhsLower, j - rhsLower];
        if (ci === lhsLen) {
          if (i === lhsUpper) return false;
          if (lhsToken.flags & TokenFlags.NO_JOIN_NEXT || allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) {
            return false;
          }
          lhsToken = leftTokens[i++];
          if (!lhsToken) return false;
          if (lhsToken.flags & TokenFlags.NO_JOIN_PREV || allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) {
            return false;
          }
          ltext = lhsToken.text;
          lhsLen = ltext.length;
          ci = 0;
        }
        if (cj === rhsLen) {
          if (j === rhsUpper) return false;
          if (rhsToken.flags & TokenFlags.NO_JOIN_NEXT || allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) {
            return false;
          }
          rhsToken = rightTokens[j++];
          if (!rhsToken) return false;
          if (rhsToken.flags & TokenFlags.NO_JOIN_PREV || allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) {
            return false;
          }
          rtext = rhsToken.text;
          rhsLen = rtext.length;
          cj = 0;
        }
      }
    }
    function matchSuffixTokens(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, allowJoinOnlyAtLineBoundary) {
      if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;
      let i = lhsUpper - 1, j = rhsUpper - 1;
      let lhsToken = leftTokens[i--], ltext = lhsToken.text, rhsToken = rightTokens[j--], rtext = rhsToken.text;
      let ci = ltext.length - 1, cj = rtext.length - 1;
      while (true) {
        while (ci >= 0 && cj >= 0) {
          if (ltext[ci--] !== rtext[cj--]) {
            return false;
          }
        }
        if (ci < 0 && cj < 0) return [lhsUpper - i - 1, rhsUpper - j - 1];
        if (ci < 0) {
          if (i < lhsLower) return false;
          if (lhsToken.flags & TokenFlags.NO_JOIN_PREV || allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) {
            return false;
          }
          lhsToken = leftTokens[i--];
          if (!lhsToken) return false;
          if (lhsToken.flags & TokenFlags.NO_JOIN_NEXT || allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) {
            return false;
          }
          ltext = lhsToken.text;
          ci = lhsToken.text.length - 1;
        }
        if (cj < 0) {
          if (j < rhsLower) return false;
          if (rhsToken.flags & TokenFlags.NO_JOIN_PREV || allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) {
            return false;
          }
          rhsToken = rightTokens[j--];
          if (!rhsToken) return false;
          if (rhsToken.flags & TokenFlags.NO_JOIN_NEXT || allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) {
            return false;
          }
          rtext = rhsToken.text;
          cj = rhsToken.text.length - 1;
        }
      }
    }

})();
`;
	const blob = typeof self !== "undefined" && self.Blob && new Blob(["(self.URL || self.webkitURL).revokeObjectURL(self.location.href);", jsContent], { type: "text/javascript;charset=utf-8" });
	function WorkerWrapper(options) {
	  let objURL;
	  try {
	    objURL = blob && (self.URL || self.webkitURL).createObjectURL(blob);
	    if (!objURL) throw "";
	    const worker = new Worker(objURL, {
	      name: options?.name
	    });
	    worker.addEventListener("error", () => {
	      (self.URL || self.webkitURL).revokeObjectURL(objURL);
	    });
	    return worker;
	  } catch (e) {
	    return new Worker(
	      "data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent),
	      {
	        name: options?.name
	      }
	    );
	  }
	}

	function initializeDiffWorker(onComplete) {
	  let worker = new WorkerWrapper();
	  let currentReqId = 0;
	  worker.onmessage = (e) => {
	    const data = e.data;
	    if (data.type === "diff") {
	      if (data.reqId !== currentReqId) {
	        return;
	      }
	      const result = {
	        diffs: data.diffs,
	        options: data.options,
	        processTime: data.processTime
	      };
	      onComplete(result);
	    } else if (data.type === "error") {
	      console.error(`Error in diff worker (reqId: ${data.reqId}):`, data.error);
	    }
	  };
	  return {
	    run: (leftTokens, rightTokens, options) => {
	      const request = {
	        type: "diff",
	        reqId: ++currentReqId,
	        leftTokens,
	        rightTokens,
	        options
	      };
	      worker.postMessage(request);
	    },
	    terminate: () => {
	      if (worker) {
	        worker.terminate();
	        worker = null;
	      }
	    }
	  };
	}

	function createEvent() {
	  let handlers = [];
	  const on = (cb) => {
	    handlers.push(cb);
	    return () => {
	      handlers = handlers.filter((h) => h !== cb);
	    };
	  };
	  const emit = (arg) => {
	    for (const cb of handlers) {
	      try {
	        cb(arg);
	      } catch (e) {
	        console.error("event error", e);
	      }
	    }
	  };
	  return { on, emit };
	}

	function getTableCellPosition(td) {
	  if (td.tagName !== "TD") return null;
	  const tr = td.parentElement;
	  if (!tr || tr.tagName !== "TR") return null;
	  const table = tr.parentElement;
	  if (!table || table.tagName !== "TABLE") return null;
	  const rowIndex = Array.prototype.indexOf.call(table.rows, tr);
	  const colIndex = Array.prototype.indexOf.call(tr.cells, td);
	  if (rowIndex === -1 || colIndex === -1) return null;
	  return [rowIndex, colIndex];
	}

	class EditorPairer {
	  static MIN_DELTA = 1;
	  static MIN_STRIPED_DELTA = 10;
	  static MIN_CHUNK_SIZE = 20;
	  #leftEditor;
	  #rightEditor;
	  #diffMarkers = /* @__PURE__ */ new Set();
	  #anchorPairs = [];
	  #anchorMap = /* @__PURE__ */ new Map();
	  #oldAnchorPairs = null;
	  #oldDiffMarkers = null;
	  #chunkCancellationToken = null;
	  #elapsedTotal = 0;
	  #unusedAnchors = /* @__PURE__ */ new Set();
	  constructor(leftEditor, rightEditor) {
	    this.#leftEditor = leftEditor;
	    this.#rightEditor = rightEditor;
	  }
	  cancelAnchorAligning() {
	    if (this.#chunkCancellationToken !== null) {
	      cancelAnimationFrame(this.#chunkCancellationToken);
	      this.#chunkCancellationToken = null;
	    }
	  }
	  beginUpdate() {
	    this.cancelAnchorAligning();
	    this.#anchorMap.clear();
	    if (this.#oldAnchorPairs || this.#oldDiffMarkers) {
	      this.endUpdate();
	    }
	    this.#oldAnchorPairs = this.#anchorPairs;
	    this.#oldDiffMarkers = this.#diffMarkers;
	    this.#anchorPairs = [];
	    this.#diffMarkers = /* @__PURE__ */ new Set();
	  }
	  endUpdate() {
	    if (this.#oldAnchorPairs) {
	      for (const anchorPair of this.#oldAnchorPairs) {
	        const { leftEl, rightEl } = anchorPair;
	        if (!this.#anchorMap.has(leftEl)) {
	          if (leftEl.nodeName === ANCHOR_TAG_NAME) {
	            leftEl.remove();
	          } else {
	            leftEl.classList.remove("anchor");
	            leftEl.style.removeProperty("--anchor-adjust");
	            delete leftEl.dataset.anchorIndex;
	            this.#unusedAnchors.add(leftEl);
	          }
	        }
	        if (!this.#anchorMap.has(rightEl)) {
	          if (rightEl.nodeName === ANCHOR_TAG_NAME) {
	            rightEl.remove();
	          } else {
	            rightEl.classList.remove("anchor");
	            rightEl.style.removeProperty("--anchor-adjust");
	            delete rightEl.dataset.anchorIndex;
	            this.#unusedAnchors.add(rightEl);
	          }
	        }
	      }
	    }
	    if (this.#oldDiffMarkers) {
	      for (const marker of this.#oldDiffMarkers) {
	        if (!this.#diffMarkers.has(marker)) {
	          marker.remove();
	        }
	      }
	    }
	    this.#oldAnchorPairs = null;
	    this.#oldDiffMarkers = null;
	  }
	  #createDiffMarker(container, offset, diffIndex) {
	    let markerEl = container.childNodes[offset];
	    if (markerEl) {
	      if (markerEl.nodeName === DIFF_TAG_NAME) {
	        if (this.#diffMarkers.has(markerEl)) {
	          markerEl = null;
	          offset++;
	        }
	      } else {
	        markerEl = null;
	      }
	    }
	    if (!markerEl) {
	      markerEl = document.createElement(DIFF_TAG_NAME);
	      container.insertBefore(markerEl, container.childNodes[offset] || null);
	    }
	    markerEl.contentEditable = "false";
	    markerEl.classList.add(DIFF_CLASS_NAME);
	    markerEl.dataset.diffIndex = diffIndex.toString();
	    this.#diffMarkers.add(markerEl);
	    return markerEl;
	  }
	  insertDiffMarker(_side, range, targetFlags, diffIndex) {
	    if (this.#anchorPairs.length > 0) ;
	    let container = range.startContainer;
	    let offset = range.startOffset;
	    const endContainer = range.endContainer;
	    let endOffset = range.endOffset;
	    if (container.nodeType === 3) {
	      offset = Array.prototype.indexOf.call(container.parentNode.childNodes, container) + 1;
	      container = container.parentNode;
	    }
	    if (endContainer.nodeType === 3) {
	      endOffset = Array.prototype.indexOf.call(endContainer.parentNode.childNodes, endContainer);
	    }
	    const indexStack = [];
	    let isTextlessContainer = TEXTLESS_ELEMENTS[container.nodeName] || false;
	    while (container) {
	      if (!isTextlessContainer) {
	        if (targetFlags & (TokenFlags.TABLE_START | TokenFlags.TABLEROW_START | TokenFlags.TABLECELL_START) && container.nodeName === "TD" && offset === 0) {
	          if (targetFlags & TokenFlags.TABLE_START) {
	            const rowcol = getTableCellPosition(container);
	            if (rowcol && rowcol[0] === 0 && rowcol[1] === 0) {
	              return this.#createDiffMarker(container, offset, diffIndex);
	            }
	          } else if (targetFlags & TokenFlags.TABLEROW_START) {
	            const rowcol = getTableCellPosition(container);
	            if (rowcol && rowcol[1] === 0) {
	              return this.#createDiffMarker(container, offset, diffIndex);
	            }
	          } else if (targetFlags & TokenFlags.TABLECELL_START) {
	            return this.#createDiffMarker(container, offset, diffIndex);
	          }
	        } else if (targetFlags & TokenFlags.LINE_START) {
	          if (offset === 0) {
	            if (BLOCK_ELEMENTS[container.nodeName]) {
	              return this.#createDiffMarker(container, offset, diffIndex);
	            }
	          } else {
	            const prev = container.childNodes[offset - 1];
	            if (prev.nodeName === "BR" || prev.nodeName === "HR" || BLOCK_ELEMENTS[prev.nodeName]) {
	              return this.#createDiffMarker(container, offset, diffIndex);
	            }
	          }
	        }
	      }
	      if (container === endContainer && offset >= endOffset) break;
	      const child = container.childNodes[offset];
	      if (!child) {
	        const parent = container.parentNode;
	        if (!parent) break;
	        isTextlessContainer = TEXTLESS_ELEMENTS[parent.nodeName] || false;
	        if (indexStack.length > 0) {
	          offset = indexStack.pop();
	        } else {
	          offset = Array.prototype.indexOf.call(parent.childNodes, container);
	        }
	        offset++;
	        container = parent;
	        continue;
	      }
	      if (child.nodeType === 1 && !VOID_ELEMENTS[child.nodeName]) {
	        indexStack.push(offset);
	        container = child;
	        isTextlessContainer = TEXTLESS_ELEMENTS[child.nodeName] || false;
	        offset = 0;
	        continue;
	      }
	      offset++;
	    }
	    return null;
	  }
	  zzinsertDiffMarker(container, offset) {
	    let markerEl = container.childNodes[offset];
	    if (markerEl && markerEl.nodeName === DIFF_TAG_NAME) {
	      console.warn("Existing diff marker found at offset", offset, "in", container, markerEl);
	      return null;
	    }
	    const insertBefore = markerEl;
	    markerEl = document.createElement(DIFF_TAG_NAME);
	    markerEl.contentEditable = "false";
	    container.insertBefore(markerEl, insertBefore);
	    this.#diffMarkers.add(markerEl);
	    return markerEl;
	  }
	  getAnchorInsertableRange(side, tokenIndex) {
	    const editor = side === "left" ? this.#leftEditor : this.#rightEditor;
	    let range = editor.getTokenRange(tokenIndex, 0);
	    if (this.#anchorPairs.length > 0) {
	      const prevPair = this.#anchorPairs[this.#anchorPairs.length - 1];
	      const prevAnchor = side === "left" ? prevPair.leftEl : prevPair.rightEl;
	      range = clampRange(range, prevAnchor, null);
	    }
	    return range;
	  }
	  addAnchorPair(leftTokenIndex, leftEl, rightTokenIndex, rightEl, diffIndex) {
	    if (!leftEl) {
	      let anchorRange = this.getAnchorInsertableRange("left", leftTokenIndex);
	      leftEl = this.getOrInsertAnchor(anchorRange.startContainer, anchorRange.startOffset, anchorRange.endContainer, anchorRange.endOffset);
	    }
	    if (!rightEl) {
	      let anchorRange = this.getAnchorInsertableRange("right", rightTokenIndex);
	      rightEl = this.getOrInsertAnchor(anchorRange.startContainer, anchorRange.startOffset, anchorRange.endContainer, anchorRange.endOffset);
	    }
	    if (leftEl && rightEl) {
	      const anchorIndex = this.#anchorPairs.length;
	      leftEl.classList.add("anchor");
	      rightEl.classList.add("anchor");
	      rightEl.dataset.anchorIndex = leftEl.dataset.anchorIndex = anchorIndex.toString();
	      if (diffIndex !== null) {
	        leftEl.dataset.diffIndex = rightEl.dataset.diffIndex = diffIndex.toString();
	      } else {
	        delete leftEl.dataset.diffIndex;
	        delete rightEl.dataset.diffIndex;
	      }
	      const pair = {
	        index: anchorIndex,
	        leftEl,
	        rightEl,
	        diffIndex,
	        flags: 0,
	        aligned: false,
	        delta: 0,
	        leftFlags: 0,
	        rightFlags: 0
	        /* None */
	      };
	      this.#anchorPairs.push(pair);
	      this.#anchorMap.set(leftEl, pair);
	      this.#anchorMap.set(rightEl, pair);
	    } else {
	      console.warn("EditorPairer: addAnchorPair2 failed to create anchors");
	    }
	  }
	  // addAnchorPair(
	  // 	leftRange: Range | LightRange,
	  // 	leftFlags: AnchorFlags,
	  // 	leftDiffEl: HTMLElement | null,
	  // 	rightRange: Range | LightRange,
	  // 	rightFlags: AnchorFlags,
	  // 	rightDiffEl: HTMLElement | null,
	  // 	diffIndex: number | null
	  // ) {
	  // 	const lastPair = this.#anchorPairs[this.#anchorPairs.length - 1];
	  // 	let leftEl = leftDiffEl ?? this.zzgetOrCreateAnchor(leftRange.startContainer, leftRange.startOffset, leftFlags, null); // this.#leftEditor.getAnchorTargetForToken(leftRange, leftFlags);
	  // 	if (!leftEl) {
	  // 		return;
	  // 	} else {
	  // 		const lastEl = lastPair?.leftEl;
	  // 		if (lastEl && !(lastEl.compareDocumentPosition(leftEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
	  // 			return;
	  // 		}
	  // 	}
	  // 	let rightEl = rightDiffEl ?? this.zzgetOrCreateAnchor(rightRange.startContainer, rightRange.startOffset, rightFlags, null); // this.#rightEditor.getAnchorTargetForToken(rightRange, rightFlags);
	  // 	if (!rightEl) {
	  // 		return;
	  // 	} else {
	  // 		const lastEl = lastPair?.rightEl;
	  // 		if (lastEl && !(lastEl.compareDocumentPosition(rightEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
	  // 			return;
	  // 		}
	  // 	}
	  // 	const pair: AnchorPair = {
	  // 		index: this.#anchorPairs.length,
	  // 		leftEl,
	  // 		rightEl,
	  // 		diffIndex,
	  // 		flags: leftFlags | rightFlags,
	  // 		aligned: false,
	  // 		delta: 0,
	  // 		leftFlags,
	  // 		rightFlags,
	  // 	};
	  // 	leftEl.classList.add("anchor");
	  // 	rightEl.classList.add("anchor");
	  // 	rightEl.dataset.anchorIndex = leftEl.dataset.anchorIndex = pair.index.toString();
	  // 	if (diffIndex !== null) {
	  // 		leftEl.dataset.diffIndex = diffIndex.toString();
	  // 		rightEl.dataset.diffIndex = diffIndex.toString();
	  // 	} else {
	  // 		delete leftEl.dataset.diffIndex;
	  // 		delete rightEl.dataset.diffIndex;
	  // 	}
	  // 	this.#anchorPairs.push(pair);
	  // 	this.#anchorMap.set(leftEl, pair);
	  // 	this.#anchorMap.set(rightEl, pair);
	  // 	const leftPadding = parseInt(leftEl.style.getPropertyValue("--anchor-adjust")) || 0;
	  // 	const rightPadding = parseInt(rightEl.style.getPropertyValue("--anchor-adjust")) || 0;
	  // 	leftEl.style.removeProperty("--anchor-adjust");
	  // 	rightEl.style.removeProperty("--anchor-adjust");
	  // 	// if (leftPadding && rightPadding) {
	  // 	// 	leftEl.style.removeProperty("--anchor-adjust");
	  // 	// 	rightEl.style.removeProperty("--anchor-adjust");
	  // 	// } else if (leftPadding) {
	  // 	// 	pair.delta = -leftPadding;
	  // 	// } else if (rightPadding) {
	  // 	// 	pair.delta = rightPadding;
	  // 	// }
	  // 	// if (diffIndex !== null) {
	  // 	// 	leftEl.dataset.diffIndex = diffIndex.toString();
	  // 	// 	rightEl.dataset.diffIndex = diffIndex.toString();
	  // 	// } else {
	  // 	// 	delete leftEl.dataset.diffIndex;
	  // 	// 	delete rightEl.dataset.diffIndex;
	  // 	// }
	  // 	return pair;
	  // }
	  getOrInsertAnchor(startContainer, startOffset, endContainer, endOffset) {
	    function getChildIndex(container2) {
	      const parent = container2.parentNode;
	      if (!parent) return -1;
	      const childNodes = parent.childNodes;
	      for (let i = 0; i < childNodes.length; i++) {
	        if (childNodes[i] === container2) return i;
	      }
	      return -1;
	    }
	    let container = endContainer;
	    let offset = endOffset;
	    if (container.nodeType === 3) {
	      if (container === startContainer) {
	        return null;
	      } else {
	        offset = getChildIndex(container);
	        container = container.parentNode;
	      }
	    }
	    if (startContainer.nodeType === 3) {
	      startOffset = getChildIndex(startContainer);
	      startContainer = startContainer.parentNode;
	    }
	    const offsetStack = [];
	    let insertContainer = null;
	    let insertBeforeMe = null;
	    offset--;
	    while (container) {
	      if (offset < 0) {
	        if (offsetStack.length > 0) {
	          offset = offsetStack.pop();
	        } else {
	          offset = getChildIndex(container);
	        }
	        container = container.parentNode;
	        continue;
	      }
	      const current = container.childNodes[offset--];
	      const currentNodeName = current.nodeName;
	      const isBlockElement = BLOCK_ELEMENTS[currentNodeName];
	      if (isBlockElement && !TEXTLESS_ELEMENTS[currentNodeName] && current.contains(endContainer)) {
	        insertContainer = current;
	        insertBeforeMe = current.firstChild;
	        break;
	      } else if (!TEXTLESS_ELEMENTS[container.nodeName] && (isBlockElement || currentNodeName === "BR" || currentNodeName === "HR")) {
	        insertContainer = container;
	        insertBeforeMe = current.nextSibling;
	        break;
	      }
	      if (container === startContainer && offset <= startOffset) {
	        break;
	      }
	      if (current.nodeType === 1 && current.childNodes.length > 0 && !current.contains(endContainer)) {
	        offsetStack.push(offset);
	        offset = current.childNodes.length - 1;
	        container = current;
	      }
	    }
	    if (!insertContainer) {
	      console.warn("No insert container found for", { startContainer, startOffset, endContainer, endOffset });
	      return null;
	    }
	    let anchor = insertBeforeMe;
	    if (anchor) {
	      if (anchor.nodeName === ANCHOR_TAG_NAME && anchor.classList.contains(ANCHOR_CLASS_NAME)) {
	        if (this.#anchorMap.has(anchor)) {
	          console.warn("Anchor already exists at", { startContainer, startOffset, endContainer, endOffset });
	          return null;
	        }
	      } else {
	        anchor = null;
	      }
	    }
	    if (!anchor) {
	      anchor = document.createElement(ANCHOR_TAG_NAME);
	      anchor.classList.add(ANCHOR_CLASS_NAME);
	      insertContainer.insertBefore(anchor, insertBeforeMe);
	    }
	    return anchor;
	  }
	  #processChunk(startIndex, onDone, deadline) {
	    const startTime = performance.now();
	    const leftEditor = this.#leftEditor;
	    const rightEditor = this.#rightEditor;
	    leftEditor.forceReflow();
	    rightEditor.forceReflow();
	    let leftScrollTop = leftEditor.scrollTop;
	    let rightScrollTop = rightEditor.scrollTop;
	    let leftEditorTop = leftEditor.getBoundingClientRect().y;
	    let rightEditorTop = rightEditor.getBoundingClientRect().y;
	    let i = startIndex;
	    const pairs = this.#anchorPairs;
	    let count = 0;
	    while (i < pairs.length) {
	      const pair = pairs[i];
	      const { leftEl, rightEl } = pair;
	      let leftY;
	      let rightY;
	      leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
	      rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
	      let delta = Math.round(leftY - rightY);
	      if (Math.abs(delta) > 1e3) {
	        console.warn("AnchorManager.processChunk: large delta detected", { pair, leftY, rightY, delta, leftScrollTop, rightScrollTop });
	      }
	      if (delta < -1 || delta > EditorPairer.MIN_DELTA) {
	        if (pair.delta > 0) {
	          rightEl.style.removeProperty("--anchor-adjust");
	          void rightEl.offsetHeight;
	          rightEditorTop = rightEditor.getBoundingClientRect().y;
	          rightScrollTop = rightEditor.scrollTop;
	        } else if (pair.delta < 0) {
	          leftEl.style.removeProperty("--anchor-adjust");
	          void leftEl.offsetHeight;
	          leftEditorTop = leftEditor.getBoundingClientRect().y;
	          leftScrollTop = leftEditor.scrollTop;
	        }
	        leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
	        rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
	        delta = Math.round(leftY - rightY);
	        if (delta < -1 || delta > EditorPairer.MIN_DELTA) {
	          if (this.#applyDeltaToPair(pair, delta, true)) {
	            leftScrollTop = leftEditor.scrollTop;
	            rightScrollTop = rightEditor.scrollTop;
	          }
	        }
	      }
	      i++;
	      count++;
	      if (count >= EditorPairer.MIN_CHUNK_SIZE && // 최소 요만큼 정도는 deadline 무시하고 처리
	      (i & 15) === 0 && // 16개마다 한번씩만 deadline 체크
	      performance.now() > deadline) {
	        break;
	      }
	    }
	    this.#elapsedTotal += performance.now() - startTime;
	    if (i < pairs.length) {
	      this.#queueProcessChunk(i, onDone);
	    } else {
	      this.#onAlignDone(onDone);
	    }
	  }
	  #queueProcessChunk(startIndex, onDone) {
	    this.#chunkCancellationToken = requestAnimationFrame((time) => {
	      this.#chunkCancellationToken = null;
	      const deadline = time + FRAME_BUDGET_MS;
	      this.#processChunk(startIndex, onDone, deadline);
	    });
	  }
	  alignAnchorsGently(onDone, reset = false) {
	    this.cancelAnchorAligning();
	    this.#elapsedTotal = 0;
	    const pairs = this.#anchorPairs;
	    if (pairs.length === 0) {
	      this.#onAlignDone(onDone);
	      return;
	    }
	    if (reset) {
	      for (const pair of pairs) {
	        pair.delta = 0;
	        pair.leftEl.style.removeProperty("--anchor-adjust");
	        pair.rightEl.style.removeProperty("--anchor-adjust");
	      }
	    }
	    this.#queueProcessChunk(0, onDone);
	  }
	  #onAlignDone(onDone) {
	    const leftEditor = this.#leftEditor;
	    const rightEditor = this.#rightEditor;
	    leftEditor.forceReflow();
	    rightEditor.forceReflow();
	    let editorHeight = Math.max(leftEditor.contentHeight, rightEditor.contentHeight);
	    leftEditor.height = editorHeight;
	    rightEditor.height = editorHeight;
	    onDone();
	  }
	  #applyDeltaToPair(pair, delta, reflow) {
	    let changed = false;
	    if (delta < -1 || delta > EditorPairer.MIN_DELTA) {
	      if (pair.delta !== delta) {
	        pair.delta = delta;
	        changed = true;
	      }
	      let theEl;
	      if (delta > 0) {
	        theEl = pair.rightEl;
	      } else {
	        delta = -delta;
	        theEl = pair.leftEl;
	      }
	      theEl.style.setProperty("--anchor-adjust", `${delta}px`);
	      if (theEl.nodeName !== DIFF_TAG_NAME) {
	        theEl.classList.toggle("striped", delta >= EditorPairer.MIN_STRIPED_DELTA);
	      }
	      if (reflow) {
	        void theEl.offsetHeight;
	      }
	    }
	    return changed;
	  }
	}

	const SCROLL_TIMEOUT = 100;
	class DiffController {
	  #diffWorker;
	  #leftEditor;
	  #rightEditor;
	  #renderer;
	  #editorPairer;
	  // #editorPairer: EditorPairer;
	  #postProcessor = null;
	  #diffOptions;
	  diffContext = null;
	  #syncMode = false;
	  // Event emitters
	  #syncModeChangeEvent = createEvent();
	  #hoveredDiffIndexChangeEvent = createEvent();
	  #diffVisibilityChangeEvent = createEvent();
	  #diffWorkflowStartEvent = createEvent();
	  #diffComputingEvent = createEvent();
	  #diffWorkflowDone = createEvent();
	  #textSelectionEvent = createEvent();
	  #editorContentsChanged = {
	    left: false,
	    right: false
	  };
	  #scrollingEditor = null;
	  #lastScrolledEditor = null;
	  // @ts-ignore
	  #focusedEditor = null;
	  #lastFocusedEditor = null;
	  #scrollTimeoutId = null;
	  #preventScrollEvent = false;
	  #alignEditorsRequestId = null;
	  #invalidateGeometriesRequestId = null;
	  #visibleDiffs = {
	    left: /* @__PURE__ */ new Set(),
	    right: /* @__PURE__ */ new Set()
	  };
	  #lastTextSelectionRange = null;
	  constructor(leftEditor, rightEditor, renderer, diffOptions) {
	    this.#leftEditor = leftEditor;
	    this.#rightEditor = rightEditor;
	    this.#renderer = renderer;
	    this.#diffOptions = diffOptions;
	    this.#editorPairer = new EditorPairer(leftEditor, rightEditor);
	    this.#setupEventListeners();
	    this.#diffWorker = initializeDiffWorker(this.#onDiffCompleted.bind(this));
	    this.#diffWorker.run([], [], this.#diffOptions);
	    renderer.guideLineEnabled = this.#syncMode;
	    const editorCallbacks = {
	      contentChanged: this.#handleEditorContentChanged.bind(this),
	      contentChanging: this.#handleEditorContentChanging.bind(this),
	      scroll: this.#handleEditorScroll.bind(this),
	      scrollEnd: this.#handleEditorScrollEnd.bind(this),
	      resize: this.#handleEditorResize.bind(this),
	      focus: this.#handleEditorFocus.bind(this),
	      blur: this.#handleEditorBlur.bind(this),
	      click: this.#handleEditorClick.bind(this),
	      copy: this.#handleEditorCopy.bind(this),
	      mouseMove: this.#handleEditorMouseMove.bind(this),
	      mouseLeave: this.#handleEditorMouseLeave.bind(this)
	    };
	    leftEditor.setCallbacks(editorCallbacks);
	    rightEditor.setCallbacks(editorCallbacks);
	    renderer.setCallbacks({
	      prepare: this.#handleRendererPrepare.bind(this),
	      draw: this.#handleRendererDraw.bind(this),
	      diffVisibilityChanged: this.#handleRendererDiffVisibilityChanged.bind(this),
	      hoveredDiffIndexChanged: this.#handleHoveredDiffIndexChanged.bind(this)
	    });
	  }
	  getDiffOptions() {
	    return { ...this.#diffOptions };
	  }
	  updateDiffOptions(newOptions) {
	    this.#diffOptions = { ...this.#diffOptions, ...newOptions };
	  }
	  get leftEditor() {
	    return this.#leftEditor;
	  }
	  get rightEditor() {
	    return this.#rightEditor;
	  }
	  get renderer() {
	    return this.#renderer;
	  }
	  get syncMode() {
	    return this.#syncMode;
	  }
	  set syncMode(value) {
	    value = !!value;
	    if (this.#syncMode === value) return;
	    this.#syncMode = value;
	    this.#leftEditor.readonly = value;
	    this.#rightEditor.readonly = value;
	    this.#renderer.guideLineEnabled = value;
	    if (value) {
	      document.body.classList.add("sync-mode");
	      this.alignEditors(true);
	    } else {
	      document.body.classList.remove("sync-mode");
	      this.#renderer.invalidateAll();
	      this.#restoreSelection();
	    }
	    this.#syncModeChangeEvent.emit(value);
	  }
	  #setupEventListeners() {
	    document.addEventListener("selectionchange", this.#handleSelectionChange.bind(this));
	  }
	  alignEditors(reset = false) {
	    this.#preventScrollEvent = true;
	    this.#editorPairer.alignAnchorsGently(() => {
	      this.#leftEditor.forceReflow();
	      this.#rightEditor.forceReflow();
	      const primaryEditor = this.#lastScrolledEditor ?? this.#lastFocusedEditor ?? this.#rightEditor;
	      this.#preventScrollEvent = false;
	      if (this.#scrollingEditor) {
	        this.#handleEditorScrollEnd(this.#scrollingEditor);
	      }
	      this.#handleEditorScroll(primaryEditor, true);
	      if (this.#invalidateGeometriesRequestId) {
	        cancelAnimationFrame(this.#invalidateGeometriesRequestId);
	        this.#invalidateGeometriesRequestId = null;
	      }
	      this.#invalidateGeometriesRequestId = requestAnimationFrame(() => {
	        this.#renderer.invalidateGeometries();
	      });
	    }, reset);
	  }
	  #handleSelectionChange() {
	    if (!this.diffContext) {
	      return;
	    }
	    const selection = this.resolveSelectionSpanPair();
	    let sourceRange = null;
	    let targetRange = null;
	    let leftSpan = void 0;
	    let rightSpan = void 0;
	    let selectedSpan = void 0;
	    let sourceEditor = null;
	    let targetEditor = null;
	    if (selection) {
	      ({ left: leftSpan, right: rightSpan, sourceRange } = selection);
	      if (selection.sourceEditor === "left") {
	        sourceEditor = this.#leftEditor;
	        targetEditor = this.#rightEditor;
	      } else {
	        sourceEditor = this.#rightEditor;
	        targetEditor = this.#leftEditor;
	      }
	      if (leftSpan && leftSpan.end >= leftSpan.start && rightSpan && rightSpan.end >= rightSpan.start) {
	        let otherStartTokenIndex;
	        let otherEndTokenIndex;
	        if (selection.sourceEditor === "left") {
	          selectedSpan = leftSpan;
	          targetEditor = this.#rightEditor;
	          otherStartTokenIndex = rightSpan.start;
	          otherEndTokenIndex = rightSpan.end;
	        } else {
	          selectedSpan = rightSpan;
	          targetEditor = this.#leftEditor;
	          otherStartTokenIndex = leftSpan.start;
	          otherEndTokenIndex = leftSpan.end;
	        }
	        sourceRange = sourceEditor.getTokenRange(selectedSpan.start, selectedSpan.end);
	        targetRange = targetEditor.getTokenRange(otherStartTokenIndex, otherEndTokenIndex);
	      }
	    }
	    this.#renderer.setSelectionHighlight(targetEditor === this.#leftEditor ? "left" : "right", targetRange);
	    if (selection) {
	      this.#textSelectionEvent.emit({
	        selection: {
	          sourceEditor: selection.sourceEditor,
	          sourceSpan: selection.sourceSpan,
	          sourceRange: selection.sourceEditor === "left" ? sourceRange : targetRange,
	          leftTokenSpan: leftSpan,
	          rightTokenSpan: rightSpan,
	          leftTokenRange: selection.sourceEditor === "left" ? sourceRange : targetRange,
	          rightTokenRange: selection.sourceEditor === "right" ? sourceRange : targetRange
	        }
	      });
	    } else {
	      this.#textSelectionEvent.emit({ selection: null });
	    }
	    this.#lastTextSelectionRange = selection?.sourceRange ?? null;
	  }
	  #restoreSelection() {
	    if (this.#lastTextSelectionRange && this.#lastTextSelectionRange.collapsed) {
	      const selection = window.getSelection();
	      if (selection) {
	        selection.removeAllRanges();
	        selection.addRange(this.#lastTextSelectionRange);
	      }
	    }
	  }
	  #onDiffCompleted(result) {
	    if (this.#postProcessor) {
	      this.#postProcessor.cancel();
	    }
	    this.#postProcessor = new DiffProcessor(this.#leftEditor, this.#rightEditor, this.#editorPairer, result.diffs, result.options);
	    this.#postProcessor.process(this.#handleDiffContextReady);
	  }
	  #handleEditorContentChanging() {
	    this.diffContext = null;
	    this.#postProcessor?.cancel();
	    this.#editorPairer.cancelAnchorAligning();
	    if (this.#alignEditorsRequestId) {
	      cancelAnimationFrame(this.#alignEditorsRequestId);
	      this.#alignEditorsRequestId = null;
	    }
	    if (this.#invalidateGeometriesRequestId) {
	      cancelAnimationFrame(this.#invalidateGeometriesRequestId);
	      this.#invalidateGeometriesRequestId = null;
	    }
	    this.#diffWorkflowStartEvent.emit({});
	  }
	  #handleEditorContentChanged(_editor) {
	    this.computeDiff();
	  }
	  computeDiff() {
	    let leftTokens = null;
	    let rightTokens = null;
	    {
	      leftTokens = buildTokenArray(this.#leftEditor.tokens);
	    }
	    {
	      rightTokens = buildTokenArray(this.#rightEditor.tokens);
	    }
	    this.#diffWorker.run(leftTokens, rightTokens, this.#diffOptions);
	    this.#diffComputingEvent.emit({
	      leftTokenCount: this.#leftEditor.tokens.length,
	      rightTokenCount: this.#rightEditor.tokens.length
	    });
	    this.#editorContentsChanged.left = false;
	    this.#editorContentsChanged.right = false;
	  }
	  #handleEditorScroll(editor, skipEndCheck = false) {
	    if (this.#preventScrollEvent) {
	      return;
	    }
	    this.#renderer.invalidateScroll(editor.name);
	    if (!this.#scrollingEditor) {
	      this.#lastScrolledEditor = this.#scrollingEditor = editor;
	    }
	    if (this.#scrollingEditor === editor) {
	      if (this.#scrollTimeoutId) {
	        clearTimeout(this.#scrollTimeoutId);
	        this.#scrollTimeoutId = null;
	      }
	      if (!skipEndCheck) {
	        this.#scrollTimeoutId = setTimeout(() => this.#handleEditorScrollEnd(editor), SCROLL_TIMEOUT);
	      }
	      if (this.#syncMode) {
	        const otherEditor = editor === this.#leftEditor ? this.#rightEditor : this.#leftEditor;
	        otherEditor.scrollTo(editor.scrollTop, { behavior: "instant" });
	      }
	    }
	  }
	  #handleEditorScrollEnd(_editor) {
	    if (this.#scrollTimeoutId) {
	      clearTimeout(this.#scrollTimeoutId);
	      this.#scrollTimeoutId = null;
	    }
	    this.#scrollingEditor = null;
	  }
	  #handleEditorResize(_editor) {
	    if (this.#syncMode) {
	      this.alignEditors(true);
	    }
	  }
	  #handleEditorFocus(_editor) {
	    this.#lastFocusedEditor = this.#focusedEditor = _editor;
	  }
	  #handleEditorBlur(_editor) {
	    this.#focusedEditor = null;
	  }
	  #handleEditorClick(_editor, _e) {
	    this.#lastFocusedEditor = this.#focusedEditor = _editor;
	  }
	  #handleEditorCopy(_editor, _e) {
	  }
	  #handleEditorMouseMove(_editor, e) {
	    this.#renderer.updateMousePosition(e.clientX, e.clientY);
	  }
	  #handleEditorMouseLeave(_editor, _e) {
	  }
	  #handleRendererPrepare(_time) {
	  }
	  #handleRendererDraw(_time) {
	  }
	  #handleRendererDiffVisibilityChanged(changes) {
	    for (const region of ["left", "right"]) {
	      for (const entry of changes[region]) {
	        const diffIndex = entry.item;
	        if (entry.isVisible) {
	          this.#visibleDiffs[region].add(diffIndex);
	        } else {
	          this.#visibleDiffs[region].delete(diffIndex);
	        }
	      }
	    }
	    this.#diffVisibilityChangeEvent.emit(changes);
	  }
	  #handleHoveredDiffIndexChanged(diffIndex) {
	    this.#hoveredDiffIndexChangeEvent.emit(diffIndex);
	  }
	  #handleDiffContextReady = (diffContext) => {
	    this.diffContext = diffContext;
	    this.#renderer.setDiffs(diffContext.diffs);
	    this.#diffWorkflowDone.emit(diffContext);
	    this.#handleSelectionChange();
	    if (this.#syncMode) {
	      if (this.#alignEditorsRequestId) {
	        cancelAnimationFrame(this.#alignEditorsRequestId);
	        this.#alignEditorsRequestId = null;
	      }
	      this.#alignEditorsRequestId = requestAnimationFrame(() => {
	        this.alignEditors(true);
	      });
	    }
	  };
	  setScrollingEditor(editor) {
	    this.#lastScrolledEditor = this.#scrollingEditor = editor;
	  }
	  clearScrollingEditor() {
	    if (this.#scrollTimeoutId) {
	      clearTimeout(this.#scrollTimeoutId);
	      this.#scrollTimeoutId = null;
	    }
	    this.#scrollingEditor = null;
	  }
	  onSyncModeChange(callback) {
	    return this.#syncModeChangeEvent.on(callback);
	  }
	  onHoveredDiffIndexChange(callback) {
	    return this.#hoveredDiffIndexChangeEvent.on(callback);
	  }
	  onDiffVisibilityChanged(callback) {
	    return this.#diffVisibilityChangeEvent.on(callback);
	  }
	  onDiffWorkflowStart(callback) {
	    return this.#diffWorkflowStartEvent.on(callback);
	  }
	  onDiffComputing(callback) {
	    return this.#diffComputingEvent.on(callback);
	  }
	  onDiffWorkflowDone(callback) {
	    return this.#diffWorkflowDone.on(callback);
	  }
	  onTextSelection(callback) {
	    return this.#textSelectionEvent.on(callback);
	  }
	  getVisibleDiffs() {
	    return {
	      left: this.#visibleDiffs.left,
	      right: this.#visibleDiffs.right
	    };
	  }
	  getEditorSelectionRange() {
	    const selection = window.getSelection();
	    let editor = null;
	    if (selection && selection.rangeCount > 0) {
	      const range = selection.getRangeAt(0);
	      if (this.#leftEditor.contains(range)) {
	        editor = this.#leftEditor;
	      } else if (this.#rightEditor.contains(range)) {
	        editor = this.#rightEditor;
	      }
	      if (editor) {
	        return { editor: editor.name, range };
	      }
	    }
	    return null;
	  }
	  resolveSelectionSpanPair() {
	    if (!this.diffContext) {
	      return null;
	    }
	    const selection = this.getEditorSelectionRange();
	    if (selection) {
	      const editor = selection.editor === "left" ? this.#leftEditor : this.#rightEditor;
	      let sourceSpan = editor.getTokenSpanForRange(selection.range);
	      if (sourceSpan) {
	        if (sourceSpan.end === sourceSpan.start) ;
	        const matchingPair = this.diffContext.resolveMatchingSpanPair(editor.name, sourceSpan);
	        if (matchingPair) {
	          return {
	            left: matchingPair.left,
	            right: matchingPair.right,
	            sourceEditor: editor.name,
	            sourceSpan,
	            sourceRange: selection.range
	          };
	        }
	      }
	    }
	    return null;
	  }
	  scrollToDiff(diffIndex, { primary, toEnd = false } = {}) {
	    const leftRect = this.#renderer.getDiffRect("left", diffIndex);
	    const rightRect = this.#renderer.getDiffRect("right", diffIndex);
	    if (!leftRect || !rightRect) {
	      return;
	    }
	    if (this.#syncMode) {
	      const primaryEditor = primary === "left" ? this.#leftEditor : this.#rightEditor;
	      const rect = primary === "left" ? leftRect : rightRect;
	      let scrollTop;
	      if (toEnd) {
	        scrollTop = rect.y + rect.height - EDITOR_SCROLL_MARGIN;
	      } else {
	        scrollTop = rect.y - EDITOR_SCROLL_MARGIN;
	      }
	      primaryEditor.scrollTo(scrollTop, { behavior: "smooth" });
	    } else {
	      const leftScrollTop = Math.min(leftRect.y - EDITOR_SCROLL_MARGIN);
	      const rightScrollTop = Math.min(rightRect.y - EDITOR_SCROLL_MARGIN);
	      this.#leftEditor.scrollTo(leftScrollTop, { behavior: "smooth" });
	      this.#rightEditor.scrollTo(rightScrollTop, { behavior: "smooth" });
	    }
	  }
	  scrollToTokenIndex(side, tokenIndex) {
	    if (!this.diffContext) {
	      return;
	    }
	    const tokens = side === "left" ? this.#leftEditor.tokens : this.#rightEditor.tokens;
	    const token = tokens[tokenIndex];
	    if (!token) {
	      return;
	    }
	    let raw = token.range;
	    let range;
	    if (raw instanceof Range) {
	      range = raw;
	    } else {
	      range = document.createRange();
	      range.setStart(raw.startContainer, raw.startOffset);
	      range.setEnd(raw.endContainer, raw.endOffset);
	    }
	    if (!range.startContainer.isConnected || !range.endContainer.isConnected) {
	      return;
	    }
	    const rect = range.getBoundingClientRect();
	    if (rect.y === 0 && rect.x === 0 && rect.height === 0 && rect.width === 0) {
	      return 0;
	    }
	    const editor = side === "left" ? this.#leftEditor : this.#rightEditor;
	    let top = rect.y - EDITOR_SCROLL_MARGIN + editor.scrollTop;
	    editor.scrollTo(top, { behavior: "smooth" });
	  }
	  setHoveredDiffIndex(diffIndex) {
	    this.#renderer.setHoveredDiffIndex(diffIndex);
	  }
	}
	function buildTokenArray(richTokens) {
	  const result = new Array(richTokens.length);
	  for (let i = 0; i < richTokens.length; i++) {
	    const richToken = richTokens[i];
	    result[i] = {
	      text: richToken.text,
	      flags: richToken.flags
	    };
	  }
	  return result;
	}

	function isLocalFilePath(src) {
	  return !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("data:") && !src.startsWith("blob:");
	}
	function fileUrlToPath(fileUrl) {
	  if (fileUrl.startsWith("file:///")) {
	    return fileUrl.substring(8);
	  } else if (fileUrl.startsWith("file://")) {
	    return fileUrl.substring(7);
	  }
	  return fileUrl;
	}
	async function convertFileToDataUrl(filePath) {
	  if (!window.electronAPI) {
	    console.warn("electronAPI not available, returning original path");
	    return filePath;
	  }
	  try {
	    const actualPath = fileUrlToPath(filePath);
	    const dataUrl = await window.electronAPI.fileToDataUrl(actualPath);
	    return dataUrl;
	  } catch (error) {
	    console.error("Failed to convert file to data URL:", error);
	    return filePath;
	  }
	}

	const EXCLUDED_TAG_OPTIONS = {
	  exclude: true
	};
	const COMMON_ALLOWED_STYLES = {
	  textAlign: true,
	  fontSize: true,
	  fontWeight: true,
	  fontStyle: true
	};
	const DefaultElementOptions = {
	  allowedStyles: COMMON_ALLOWED_STYLES
	};
	const AsDivElementOptions = {
	  replaceTag: "DIV",
	  allowedStyles: COMMON_ALLOWED_STYLES
	};
	const COMMON_INLINE_ELEMENT_OPTIONS = {
	  replaceTag: "SPAN",
	  allowedStyles: COMMON_ALLOWED_STYLES
	};
	const SMART_TAG_OPTIONS = COMMON_INLINE_ELEMENT_OPTIONS;
	const ELEMENT_POLICIES = {
	  SCRIPT: EXCLUDED_TAG_OPTIONS,
	  STYLE: EXCLUDED_TAG_OPTIONS,
	  IFRAME: EXCLUDED_TAG_OPTIONS,
	  OBJECT: EXCLUDED_TAG_OPTIONS,
	  EMBED: EXCLUDED_TAG_OPTIONS,
	  LINK: EXCLUDED_TAG_OPTIONS,
	  META: EXCLUDED_TAG_OPTIONS,
	  BASE: EXCLUDED_TAG_OPTIONS,
	  APPLET: EXCLUDED_TAG_OPTIONS,
	  FRAME: EXCLUDED_TAG_OPTIONS,
	  FRAMESET: EXCLUDED_TAG_OPTIONS,
	  NOSCRIPT: EXCLUDED_TAG_OPTIONS,
	  SVG: EXCLUDED_TAG_OPTIONS,
	  MATH: EXCLUDED_TAG_OPTIONS,
	  TEMPLATE: EXCLUDED_TAG_OPTIONS,
	  HEAD: EXCLUDED_TAG_OPTIONS,
	  TITLE: EXCLUDED_TAG_OPTIONS,
	  CANVAS: EXCLUDED_TAG_OPTIONS,
	  AUDIO: EXCLUDED_TAG_OPTIONS,
	  VIDEO: EXCLUDED_TAG_OPTIONS,
	  TRACK: EXCLUDED_TAG_OPTIONS,
	  SOURCE: EXCLUDED_TAG_OPTIONS,
	  BGSOUND: EXCLUDED_TAG_OPTIONS,
	  TABLE: DefaultElementOptions,
	  TBODY: { unwrap: true },
	  THEAD: { unwrap: true },
	  TFOOT: { unwrap: true },
	  CAPTION: DefaultElementOptions,
	  TR: DefaultElementOptions,
	  TD: { allowedAttrs: { colspan: true, rowspan: true, width: true }, allowedStyles: { ...COMMON_ALLOWED_STYLES, width: true } },
	  TH: { replaceTag: "TD", allowedAttrs: { colspan: true, rowspan: true }, allowedStyles: COMMON_ALLOWED_STYLES },
	  H1: DefaultElementOptions,
	  H2: DefaultElementOptions,
	  H3: DefaultElementOptions,
	  H4: DefaultElementOptions,
	  H5: DefaultElementOptions,
	  H6: DefaultElementOptions,
	  SUP: DefaultElementOptions,
	  SUB: DefaultElementOptions,
	  EM: DefaultElementOptions,
	  I: DefaultElementOptions,
	  S: DefaultElementOptions,
	  B: DefaultElementOptions,
	  STRONG: DefaultElementOptions,
	  U: DefaultElementOptions,
	  STRIKE: DefaultElementOptions,
	  P: DefaultElementOptions,
	  UL: DefaultElementOptions,
	  OL: DefaultElementOptions,
	  LI: DefaultElementOptions,
	  DL: DefaultElementOptions,
	  DT: DefaultElementOptions,
	  DD: DefaultElementOptions,
	  DIV: DefaultElementOptions,
	  BLOCKQUOTE: DefaultElementOptions,
	  ADDRESS: DefaultElementOptions,
	  FIELDSET: DefaultElementOptions,
	  LEGEND: DefaultElementOptions,
	  CODE: DefaultElementOptions,
	  PRE: DefaultElementOptions,
	  SMALL: DefaultElementOptions,
	  DEL: DefaultElementOptions,
	  INS: DefaultElementOptions,
	  IMG: { void: true, allowedAttrs: { src: true, width: true, height: true }, allowedStyles: { width: true, height: true } },
	  FONT: { replaceTag: "SPAN", allowedStyles: COMMON_ALLOWED_STYLES },
	  SPAN: DefaultElementOptions,
	  LABEL: DefaultElementOptions,
	  BR: { void: true },
	  HR: { void: true },
	  FORM: AsDivElementOptions,
	  NAV: AsDivElementOptions,
	  MAIN: AsDivElementOptions,
	  HEADER: AsDivElementOptions,
	  FOOTER: AsDivElementOptions,
	  SECTION: AsDivElementOptions,
	  ARTICLE: AsDivElementOptions,
	  ASIDE: AsDivElementOptions,
	  A: {
	    replaceTag: "SPAN",
	    allowedStyles: COMMON_ALLOWED_STYLES
	  },
	  MARK: {
	    replaceTag: "SPAN",
	    allowedStyles: COMMON_ALLOWED_STYLES
	  },
	  FIGURE: DefaultElementOptions,
	  FIGCAPTION: DefaultElementOptions,
	  "#document-fragment": DefaultElementOptions
	};
	const DINGBAT_TRANSFORM = {
	  wingdings: {
	    "ß": "🡠",
	    "à": "🡢",
	    "á": "🡡",
	    "â": "🡣",
	    "ã": "🡤",
	    "ä": "🡥",
	    "å": "🡧",
	    "æ": "🡦",
	    "ç": "🡠",
	    "è": "🡢",
	    "é": "🡡",
	    "ê": "🡣",
	    "ë": "🡤",
	    "ì": "🡥",
	    "í": "🡧",
	    "î": "🡦",
	    "": "⓪",
	    "": "①",
	    "": "②",
	    "": "③",
	    "": "④",
	    "": "⑤",
	    "": "⑥",
	    "": "⑦",
	    "": "⑧",
	    "": "⑨",
	    "": "⑩",
	    "": "⓿",
	    "": "❶",
	    "": "❷",
	    "": "❸",
	    "": "❹",
	    "": "❺",
	    "": "❻",
	    "": "❼",
	    "": "❽",
	    "": "❾",
	    "": "❿",
	    "": "·",
	    "": "•",
	    " ": "▪",
	    "¢": "🞆",
	    "¤": "◉",
	    "¥": "◎"
	  },
	  ["wingdings 2"]: {
	    "?": "🖙",
	    "": "⬝",
	    " ": "▪",
	    "¡": "■",
	    "ø": "※"
	  },
	  symbol: {
	    "«": "↔",
	    "¬": "←",
	    "­": "↑",
	    "®": "→",
	    "¯": "↓"
	  }
	};
	function transformText(input, font) {
	  const charMap = DINGBAT_TRANSFORM[font];
	  let result = "";
	  for (const ch of input) {
	    result += charMap[ch] || ch;
	  }
	  return result;
	}
	const START_TAG = "<!--StartFragment-->";
	const END_TAG = "<!--EndFragment-->";
	function sliceFragment(html) {
	  const s = html.indexOf(START_TAG);
	  if (s < 0) return html;
	  const e = html.lastIndexOf(END_TAG);
	  return e >= 0 ? html.slice(s + START_TAG.length, e) : html.slice(s + START_TAG.length);
	}
	const _EMPTY_LINE = (() => {
	  const p = document.createElement("P");
	  p.appendChild(document.createElement("BR"));
	  return p;
	})();
	function appendEmptyLine(parent) {
	  parent.appendChild(_EMPTY_LINE.cloneNode(true));
	}
	function getElementPolicy(node) {
	  const nodeName = node.nodeName;
	  const direct = ELEMENT_POLICIES[nodeName];
	  if (direct) return direct;
	  if (nodeName === "O:P" && (node.childNodes.length === 0 || node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE && node.firstChild.nodeValue === " ")) {
	    return ELEMENT_POLICIES["BR"];
	  }
	  if (nodeName.startsWith("ST1:")) {
	    return SMART_TAG_OPTIONS;
	  }
	  return COMMON_INLINE_ELEMENT_OPTIONS;
	}
	function copyAllowedAttributes(from, to, allowed) {
	  if (!allowed) return;
	  for (const attr of from.attributes) {
	    if (allowed[attr.name]) to.setAttribute(attr.name, attr.value);
	  }
	}
	function copyAllowedStyles(from, to, allowed) {
	  if (!allowed) return;
	  for (const k in allowed) {
	    const v = from[k];
	    if (v) to[k] = v;
	  }
	}
	function normalizeFont(raw) {
	  if (!raw) return null;
	  let s = raw.split(",")[0].trim();
	  s = s.replace(/^['"]+|['"]+$/g, "").toLowerCase();
	  return s || null;
	}
	function resolveDingbatFont(node, prev) {
	  const el = node;
	  let raw = el.style?.fontFamily || (node.nodeName === "FONT" ? el.getAttribute("face") || "" : "");
	  const fam = normalizeFont(raw);
	  if (!fam || fam === "inherit") return prev;
	  return DINGBAT_TRANSFORM[fam] ? fam : null;
	}
	function resolveColor(node, prev) {
	  let color = null;
	  if (node.classList.contains("color-red")) {
	    color = "red";
	  } else {
	    let colorValue = node.style?.color || "inherit";
	    console.log("Resolvecolor:", node.nodeName, colorValue, node.textContent);
	    {
	      if (colorValue === "inherit") {
	        color = prev;
	      } else {
	        if (isReddish(colorValue)) {
	          color = "red";
	        } else {
	          console.log("colorValue", colorValue);
	          color = "default";
	        }
	      }
	    }
	  }
	  return color;
	}
	async function sanitizeHTML(rawHTML) {
	  rawHTML = sliceFragment(rawHTML);
	  const tmpl = document.createElement("template");
	  tmpl.innerHTML = rawHTML;
	  const statesStack = [];
	  let states = {
	    font: null,
	    color: null
	  };
	  async function traverse(node) {
	    if (node.nodeType !== 1 && // element
	    node.nodeType !== 11) {
	      return null;
	    }
	    if (node.nodeType === 1) {
	      const el = node;
	      if (node.nodeName === "DIV") {
	        if (el.className === "aspNetHidden" || el.className === "pak_aside clear" || el.className === "pak_tab_menu" || el.className === "listBtn" || el.className === "ManualEvalWrap")
	          return null;
	      } else if (node.nodeName === "P") {
	        if (el.className === "pak_search") return null;
	      }
	    }
	    const policy = getElementPolicy(node);
	    if (policy.exclude) {
	      return null;
	    }
	    const nodeName = node.nodeName;
	    let container;
	    if (policy.unwrap || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
	      container = document.createDocumentFragment();
	    } else {
	      container = document.createElement(policy.replaceTag || nodeName);
	      copyAllowedAttributes(node, container, policy.allowedAttrs);
	      copyAllowedStyles(node.style, container.style, policy.allowedStyles);
	      if (nodeName === "IMG" && node.nodeType === Node.ELEMENT_NODE) {
	        const imgElement = node;
	        const src = imgElement.getAttribute("src");
	        if (src && isLocalFilePath(src)) {
	          try {
	            const dataUrl = await convertFileToDataUrl(src);
	            container.setAttribute("src", dataUrl);
	            console.log(`Converted image during sanitize: ${src} -> data URL`);
	          } catch (error) {
	            console.warn(`Failed to convert image during sanitize: ${src}`, error);
	          }
	        }
	      }
	    }
	    if (policy.void) {
	      return {
	        node: container,
	        hasText: false,
	        hasNonEmptyText: false,
	        caretReachable: false
	      };
	    }
	    statesStack.push(states);
	    states = { ...states };
	    const result2 = {
	      node: container,
	      hasText: false,
	      hasNonEmptyText: false,
	      caretReachable: false
	    };
	    if (container.nodeType === Node.ELEMENT_NODE && node.nodeType === Node.ELEMENT_NODE) {
	      states.color = resolveColor(node, states.color);
	      if (states.color) {
	        container.classList.add(`color-${states.color}`);
	      }
	      states.font = resolveDingbatFont(node, states.font);
	    }
	    const children = [];
	    let isTextless = TEXTLESS_ELEMENTS[nodeName];
	    for (const childNode of node.childNodes) {
	      let childResult = null;
	      if (childNode.nodeType === 3) {
	        if (!isTextless) {
	          let text = childNode.nodeValue;
	          if (states.font) {
	            text = transformText(text, states.font);
	          }
	          childResult = {
	            node: document.createTextNode(text),
	            hasText: false,
	            hasNonEmptyText: false,
	            caretReachable: false
	          };
	        }
	      } else {
	        childResult = await traverse(childNode);
	      }
	      if (childResult !== null) {
	        children.push(childResult);
	      }
	    }
	    states = statesStack.pop();
	    let prevCaretReachable = false;
	    for (let i = 0; i < children.length; i++) {
	      const childResult = children[i];
	      if (node === tmpl.content || nodeName === "TD") ;
	      if (childResult.node.nodeType === 3) {
	        result2.hasText = true;
	        result2.hasNonEmptyText ||= childResult.node.nodeValue.trim().length > 0;
	        if (!result2.caretReachable) {
	          result2.caretReachable = childResult.node.nodeValue.length > 0;
	        }
	      } else {
	        result2.hasText ||= childResult.hasText;
	        result2.hasNonEmptyText ||= childResult.hasNonEmptyText;
	        result2.caretReachable ||= childResult.caretReachable || childResult.node.nodeName === "BR";
	      }
	      if (node === tmpl.content || nodeName === "TD") {
	        if (childResult.node.nodeName === "TABLE") {
	          if (!prevCaretReachable) {
	            appendEmptyLine(container);
	          }
	          prevCaretReachable = false;
	        }
	      }
	      container.appendChild(childResult.node);
	      if (childResult.node.nodeName === "TABLE") {
	        prevCaretReachable = false;
	      } else {
	        prevCaretReachable ||= childResult.caretReachable;
	      }
	    }
	    if (!prevCaretReachable && (node === tmpl.content || nodeName === "TD")) {
	      appendEmptyLine(container);
	    }
	    if (container.nodeName === "TABLE") {
	      result2.caretReachable = false;
	      result2.hasText = false;
	      result2.hasNonEmptyText = false;
	    }
	    return result2;
	  }
	  const result = await traverse(tmpl.content);
	  if (!result) {
	    throw new Error("Failed to traverse template content");
	  }
	  return result.node;
	}
	const isReddish = /* @__PURE__ */ (() => {
	  let ctx = null;
	  const reddishCache = /* @__PURE__ */ new Map([
	    ["red", true],
	    ["#ff0000", true],
	    ["#e60000", true],
	    ["#c00000", true],
	    ["rgb(255,0,0)", true],
	    ["rgb(230,0,0)", true],
	    ["#000000", false],
	    ["#333333", false],
	    ["#ffffff", false],
	    ["black", false],
	    ["blue", false],
	    ["white", false],
	    ["window", false],
	    ["windowtext", false]
	  ]);
	  function getRGB(color) {
	    const hex6 = /^#([0-9a-f]{6})$/i.exec(color);
	    if (hex6) {
	      const n = parseInt(hex6[1], 16);
	      return [n >> 16 & 255, n >> 8 & 255, n & 255];
	    }
	    const hex3 = /^#([0-9a-f]{3})$/i.exec(color);
	    if (hex3) {
	      const [r, g, b] = hex3[1].split("").map((c) => parseInt(c + c, 16));
	      return [r, g, b];
	    }
	    const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
	    if (rgb) {
	      const parts = rgb[1].split(",").map((s) => parseInt(s.trim(), 10));
	      if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
	    }
	    if (!ctx) {
	      const canvas = new OffscreenCanvas(1, 1);
	      ctx = canvas.getContext("2d");
	    }
	    try {
	      ctx.clearRect(0, 0, 1, 1);
	      ctx.fillStyle = color;
	      ctx.fillRect(0, 0, 1, 1);
	      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	      return [r, g, b];
	    } catch {
	      return null;
	    }
	  }
	  return (color) => {
	    let isRed = reddishCache.get(color);
	    if (isRed !== void 0) return isRed;
	    const rgb = getRGB(color);
	    isRed = rgb ? rgb[0] >= 139 && rgb[0] - Math.max(rgb[1], rgb[2]) >= 65 : false;
	    reddishCache.set(color, isRed);
	    return isRed;
	  };
	})();

	function createParagraphsFromText(plaintext, trimLines = false) {
	  const lines = plaintext.split(/\r?\n/);
	  const fragment = document.createDocumentFragment();
	  if (lines.length === 1) {
	    fragment.appendChild(document.createTextNode(lines[0]));
	  } else if (lines.length > 1) {
	    for (const line of lines) {
	      const p = document.createElement("P");
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

	function findAdjacentTextNode(node, skipEmpty = false) {
	  let root = node;
	  while (root && !BLOCK_ELEMENTS[root.nodeName]) {
	    root = root.parentNode;
	  }
	  let next = advanceNode(node, root, true);
	  while (next) {
	    if (next.nodeType === 3) {
	      if (!skipEmpty || next.nodeValue.length > 0) {
	        return next;
	      }
	    } else {
	      const nextName = next.nodeName;
	      if (BLOCK_ELEMENTS[nextName]) {
	        break;
	      }
	      if (nextName === "BR" || nextName === "IMG" || nextName === "HR") {
	        break;
	      }
	    }
	    next = advanceNode(next, root);
	  }
	  return null;
	}

	const MAX_LENGTH_FOR_EXECCOMMAND_PASTE = 2e5;
	const INITIAL_EDITOR_HTML = document.createElement("P");
	INITIAL_EDITOR_HTML.appendChild(document.createElement("BR"));
	class Editor {
	  #wrapper;
	  #editorName;
	  #editor = document.createElement("div");
	  #heightBoost = document.createElement("div");
	  // #wrapper: HTMLElement; // = document.createElement("div");
	  #mutationObserver;
	  #tokens = [];
	  #tokenizeContext = null;
	  #callbacks = {};
	  #readonly = false;
	  #mountHelper;
	  #resizeObserver = new ResizeObserver(() => this.#onResize());
	  constructor(editorName) {
	    this.#editorName = editorName;
	    this.#editor.contentEditable = "true";
	    this.#editor.spellcheck = false;
	    this.#editor.id = `diffseek-editor-${editorName}`;
	    this.#editor.classList.add("editor", `editor-${editorName}`);
	    this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
	    this.#heightBoost.classList.add("editor-maybe-170cm-wasnt-enough");
	    this.#mutationObserver = new MutationObserver((mutations) => this.#onMutation(mutations));
	    this.observeMutation();
	    this.#editor.addEventListener("copy", (e) => this.#onCopy(e));
	    this.#editor.addEventListener("paste", (e) => this.#onPaste(e));
	    this.#editor.addEventListener("input", () => this.#handleContentChangedInternal());
	    this.#editor.addEventListener("click", (e) => {
	      this.#callbacks.click?.(this, e);
	    });
	    this.#editor.addEventListener("keydown", (e) => this.#onKeyDown(e));
	    this.#editor.addEventListener("focus", () => {
	      this.#callbacks.focus?.(this);
	    });
	    this.#editor.addEventListener("blur", () => {
	      this.#callbacks.blur?.(this);
	    });
	    this.#wrapper = document.createElement("div");
	    this.#wrapper.appendChild(this.#editor);
	    this.#wrapper.appendChild(this.#heightBoost);
	    this.#wrapper.classList.add("editor-wrapper", `editor-wrapper-${editorName}`);
	    this.#wrapper.addEventListener("scroll", this.#onContainerScroll);
	    this.#wrapper.addEventListener("scrollend", this.#onContainerScrollEnd);
	    this.#wrapper.addEventListener("mousemove", this.#onContainerMouseMove);
	    this.#wrapper.addEventListener("mouseleave", this.#onContainerMouseLeave);
	    this.#mountHelper = mountHelper(this.#wrapper);
	    this.#resizeObserver.observe(this.#wrapper);
	  }
	  /**
	   * 대상 노드에 편집기(정확히는 `wrapper` 엘러먼트)를 집어넣음.
	   * 넣었다 뺐다를 잘못하면 인생이 아작나는 수가 있으니 신중할 것.
	   *
	   * @param target 마운트 대상 노드
	   */
	  mount(target) {
	    this.#mountHelper.mount(target);
	  }
	  unmount() {
	    this.#mountHelper.unmount();
	  }
	  setCallbacks(callbacks) {
	    Object.assign(this.#callbacks, callbacks);
	  }
	  #onContainerScroll = () => {
	    this.#callbacks.scroll?.(this);
	  };
	  #onContainerScrollEnd = () => {
	    this.#callbacks.scrollEnd?.(this);
	  };
	  #onContainerMouseMove = (e) => {
	    this.#callbacks.mouseMove?.(this, e);
	  };
	  #onContainerMouseLeave = (e) => {
	    this.#callbacks.mouseLeave?.(this, e);
	  };
	  get name() {
	    return this.#editorName;
	  }
	  get readonly() {
	    return this.#readonly;
	  }
	  set readonly(value) {
	    if (this.#readonly === value) {
	      return;
	    }
	    this.#readonly = value;
	    this.#editor.contentEditable = value ? "false" : "true";
	  }
	  /**
	   * 절대 수정 금지. 읽기만.
	   */
	  get tokens() {
	    return this.#tokens;
	  }
	  get container() {
	    return this.#wrapper;
	  }
	  get contentEditableElement() {
	    return this.#editor;
	  }
	  get scrollTop() {
	    return this.#wrapper?.scrollTop ?? 0;
	  }
	  set scrollTop(value) {
	    if (this.#wrapper) {
	      this.#wrapper.scrollTop = value;
	    }
	  }
	  get scrollLeft() {
	    return this.#wrapper?.scrollLeft ?? 0;
	  }
	  set scrollLeft(value) {
	    if (this.#wrapper) {
	      this.#wrapper.scrollLeft = value;
	    }
	  }
	  #onResize() {
	    this.#callbacks.resize?.(this);
	  }
	  #onKeyDown(e) {
	    if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
	      if (this.#wrapper) {
	        e.preventDefault();
	        const fontSize = parseFloat(getComputedStyle(this.#editor).fontSize);
	        const delta = (e.key === "ArrowUp" ? -LINE_HEIGHT : LINE_HEIGHT) * 2 * fontSize;
	        this.#wrapper.scrollBy({
	          top: delta,
	          behavior: "instant"
	        });
	      }
	    }
	    if (e.altKey && (e.key === "2" || e.key === "3")) {
	      const selection = document.getSelection();
	      if (!selection || selection.rangeCount === 0) {
	        return;
	      }
	      const range = selection.getRangeAt(0);
	      if (!this.#editor.contains(range.commonAncestorContainer)) {
	        return;
	      }
	      if (!range.collapsed) {
	        return;
	      }
	      e.preventDefault();
	      const html = e.key === "2" ? `<hr data-manual-anchor='A' class="manual-anchor">` : `<hr data-manual-anchor='B' class="manual-anchor">`;
	      document.execCommand("insertHTML", false, html);
	    }
	  }
	  #handleContentChangedInternal() {
	    this.#callbacks.contentChanging?.(this);
	    this.#tokenize();
	  }
	  #onMutation(_mutations) {
	    if (this.#editor.childNodes.length === 0) {
	      this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
	    }
	  }
	  observeMutation() {
	    this.#mutationObserver.observe(this.#editor, {
	      childList: true,
	      subtree: true
	      //attributes: true,
	      //characterData: true,
	    });
	  }
	  unobserveMutation() {
	    this.#mutationObserver.disconnect();
	  }
	  #tokenize() {
	    if (this.#tokenizeContext) {
	      this.#tokenizeContext.cancel();
	    }
	    this.#tokenizeContext = new TokenizeContext(this.#editor, (tokens) => {
	      console.debug(this.#editorName, "Tokenization done", tokens);
	      this.#tokens = tokens;
	      this.#onTokenizeDone();
	    });
	    this.#tokenizeContext.start();
	  }
	  #onTokenizeDone() {
	    this.#tokenizeContext = null;
	    this.#callbacks.contentChanged?.(this);
	  }
	  #onCopy(e) {
	    this.#callbacks.copy?.(this, e);
	  }
	  async #onPaste(e) {
	    const startTime = performance.now();
	    const selection = document.getSelection();
	    if (!selection || selection.rangeCount === 0) {
	      return;
	    }
	    const range = selection.getRangeAt(0);
	    if (!this.#editor.contains(range.commonAncestorContainer)) {
	      return;
	    }
	    e.preventDefault();
	    let isHTML = true;
	    let data = e.clipboardData?.getData("text/html") ?? "";
	    if (!data) {
	      isHTML = false;
	      data = e.clipboardData?.getData("text/plain") ?? "";
	    }
	    await this.setContent({
	      text: data,
	      asHTML: isHTML,
	      targetRange: range,
	      allowLegacyExecCommand: data.length <= MAX_LENGTH_FOR_EXECCOMMAND_PASTE
	    });
	    const endTime = performance.now();
	    console.debug(this.#editorName, "Paste operation took", endTime - startTime, "ms");
	  }
	  getSelectionRange() {
	    const selection = document.getSelection();
	    if (!selection || selection.rangeCount === 0) {
	      return null;
	    }
	    const range = selection.getRangeAt(0);
	    if (this.#editor.contains(range.startContainer) && this.#editor.contains(range.endContainer)) {
	      return range;
	    }
	    return null;
	  }
	  /**
	   * 폭탄 붙여넣기! 왜 bomb인가? 되돌릴 수 없기 때문. ctrl-z 안먹힘.
	   * 전체 내용을 클립보드의 내용으로 교체함.
	   * 또한 클립보드 액세스를 가능하게 하는 사용자의 동작 없이 실행이 되므로 브라우저에서 "허용" 여부를 묻는 경고창이 뜰 수 있음.
	   */
	  async pasteBomb(plaintextOnly = false) {
	    const startTime = performance.now();
	    if (!navigator.clipboard || !navigator.clipboard.read) {
	      throw new Error("Clipboard API is not available in this browser");
	    }
	    this.#editor.classList.add("busy");
	    try {
	      const items = await navigator.clipboard.read();
	      let foundItem = null;
	      let foundType = null;
	      if (!plaintextOnly) {
	        for (const item of items) {
	          if (item.types.includes("text/html")) {
	            foundItem = item;
	            foundType = "text/html";
	            break;
	          }
	        }
	      }
	      if (!foundItem) {
	        for (const item of items) {
	          if (item.types.includes("text/plain")) {
	            foundItem = item;
	            foundType = "text/plain";
	            break;
	          }
	        }
	      }
	      if (!foundItem) {
	        return false;
	      }
	      const text = await (await foundItem.getType(foundType)).text();
	      await this.setContent({
	        text,
	        asHTML: foundType === "text/html",
	        targetRange: void 0,
	        // 전체 내용 교체
	        allowLegacyExecCommand: false
	        // bomb투하 이전으로 돌아가는건 허용 안함.
	      });
	      const endTime = performance.now();
	      console.debug(this.#editorName, "Paste bomb operation took", endTime - startTime, "ms");
	      return true;
	    } finally {
	      this.#editor.classList.remove("busy");
	    }
	  }
	  async setContent({
	    text,
	    asHTML = true,
	    targetRange = void 0,
	    allowLegacyExecCommand = true
	  }) {
	    let sanitized;
	    if (asHTML) {
	      sanitized = await sanitizeHTML(text);
	    } else {
	      sanitized = createParagraphsFromText(text);
	    }
	    try {
	      this.unobserveMutation();
	      if (targetRange === void 0) {
	        this.#editor.innerHTML = "";
	        this.#editor.appendChild(sanitized);
	        this.#handleContentChangedInternal();
	      } else if (this.#editor.contains(targetRange.startContainer) && this.#editor.contains(targetRange.endContainer)) {
	        if (allowLegacyExecCommand && text.length <= MAX_LENGTH_FOR_EXECCOMMAND_PASTE) {
	          const div = document.createElement("DIV");
	          div.appendChild(sanitized);
	          const sanitizedHTML = div.innerHTML;
	          document.execCommand("insertHTML", false, sanitizedHTML);
	        } else {
	          targetRange.deleteContents();
	          let hasBlockElements = false;
	          for (const child of sanitized.childNodes) {
	            if (BLOCK_ELEMENTS[child.nodeName]) {
	              hasBlockElements = true;
	              break;
	            }
	          }
	          if (hasBlockElements) {
	            targetRange = this.ensureInsertableRange(targetRange, true);
	          }
	          targetRange.insertNode(sanitized);
	          targetRange.collapse(false);
	          this.#handleContentChangedInternal();
	        }
	      } else {
	        throw new Error("Target range is not within the editor");
	      }
	    } finally {
	      this.observeMutation();
	    }
	  }
	  selectAll() {
	    const selection = window.getSelection();
	    if (selection) {
	      const range = document.createRange();
	      range.selectNodeContents(this.#editor);
	      selection.removeAllRanges();
	      selection.addRange(range);
	      return true;
	    }
	    return false;
	  }
	  /**
	   * 주어진 range에 해당하는 토큰 인덱스를 [start, end)로 반환.
	   * range가 collapsed인 경우 range와 오른쪽으로 붙어있는 토큰만 포함함.
	   *
	   * @param range DOM Range
	   * @returns 겹치는 구간이 있으면 [start, end)를 객체로 반환, 없으면 null 반환.
	   */
	  getTokenSpanForRange(range) {
	    const tokens = this.#tokens;
	    const n = tokens.length;
	    let r = range;
	    if (r.collapsed && r.endContainer.nodeType === 3 && r.endOffset === (r.endContainer.nodeValue?.length ?? 0)) {
	      const adj = findAdjacentTextNode(r.endContainer, true);
	      if (adj) {
	        const clone = r.cloneRange();
	        clone.setEnd(adj, 0);
	        r = clone;
	      }
	    }
	    const tr = document.createRange();
	    if (r.collapsed) {
	      let i = n;
	      {
	        let lo = 0, hi = n - 1;
	        while (lo <= hi) {
	          const mid = lo + hi >> 1;
	          const t2 = tokens[mid].range;
	          tr.setStart(t2.startContainer, t2.startOffset);
	          tr.setEnd(t2.endContainer, t2.endOffset);
	          const cmp = tr.compareBoundaryPoints(Range.START_TO_END, r);
	          if (cmp > 0) {
	            i = mid;
	            hi = mid - 1;
	          } else {
	            lo = mid + 1;
	          }
	        }
	      }
	      if (i === n) return { start: n, end: n };
	      const t = tokens[i].range;
	      tr.setStart(t.startContainer, t.startOffset);
	      tr.setEnd(t.endContainer, t.endOffset);
	      const cmpStart = tr.compareBoundaryPoints(Range.END_TO_START, r);
	      return cmpStart <= 0 ? { start: i, end: i + 1 } : { start: i, end: i };
	    }
	    let start = n;
	    {
	      let lo = 0, hi = n - 1;
	      while (lo <= hi) {
	        const mid = lo + hi >> 1;
	        const t = tokens[mid].range;
	        tr.setStart(t.startContainer, t.startOffset);
	        tr.setEnd(t.endContainer, t.endOffset);
	        const cmp = tr.compareBoundaryPoints(Range.START_TO_END, r);
	        if (cmp > 0) {
	          start = mid;
	          hi = mid - 1;
	        } else {
	          lo = mid + 1;
	        }
	      }
	    }
	    if (start === n) return null;
	    let end = n;
	    {
	      let lo = start, hi = n - 1;
	      while (lo <= hi) {
	        const mid = lo + hi >> 1;
	        const t = tokens[mid].range;
	        tr.setStart(t.startContainer, t.startOffset);
	        tr.setEnd(t.endContainer, t.endOffset);
	        const cmp = tr.compareBoundaryPoints(Range.END_TO_START, r);
	        if (cmp >= 0) {
	          end = mid;
	          hi = mid - 1;
	        } else {
	          lo = mid + 1;
	        }
	      }
	    }
	    if (end <= start) return null;
	    return { start, end };
	  }
	  getTokenRange(index, end = index + 1) {
	    const range = document.createRange();
	    const count = end - index;
	    if (count === 1 && index >= 0 && index < this.#tokens.length) {
	      const token = this.#tokens[index];
	      range.setStart(token.range.startContainer, token.range.startOffset);
	      range.setEnd(token.range.endContainer, token.range.endOffset);
	    } else if (count > 0) {
	      const startToken = this.#tokens[index];
	      const endToken = this.#tokens[index + count - 1];
	      if (startToken) {
	        range.setStart(startToken.range.startContainer, startToken.range.startOffset);
	      } else {
	        range.setStart(this.#editor, 0);
	      }
	      if (endToken) {
	        range.setEnd(endToken.range.endContainer, endToken.range.endOffset);
	      } else {
	        range.setEnd(this.#editor, this.#editor.childNodes.length);
	      }
	    } else {
	      const prevToken = this.#tokens[index - 1];
	      if (prevToken) {
	        range.setStart(prevToken.range.endContainer, prevToken.range.endOffset);
	      } else {
	        range.setStart(this.#editor, 0);
	      }
	      const nextToken = this.#tokens[index];
	      if (nextToken) {
	        range.setEnd(nextToken.range.startContainer, nextToken.range.startOffset);
	      } else {
	        range.setEnd(this.#editor, this.#editor.childNodes.length);
	      }
	    }
	    return range;
	  }
	  scrollTo(offset, options) {
	    if (!this.#wrapper) {
	      return;
	    }
	    if (this.#wrapper.scrollTop !== offset) {
	      this.#wrapper.scrollTo({
	        top: offset,
	        behavior: options?.behavior
	      });
	    }
	  }
	  get contentHeight() {
	    return this.#editor.offsetHeight;
	  }
	  focus() {
	    this.#editor.focus();
	  }
	  contains(range) {
	    if (!range || !this.#editor.contains(range.startContainer) || !this.#editor.contains(range.endContainer)) {
	      return false;
	    }
	    return true;
	  }
	  set height(value) {
	    const editorHeight = this.#editor.offsetHeight;
	    const delta = value - editorHeight;
	    if (delta < 0) {
	      console.warn("WTF? The taller the better", this.#editorName, value, editorHeight);
	      return;
	    }
	    if (delta > 0) {
	      this.#heightBoost.style.setProperty("--height-boost", delta + "px");
	    } else {
	      this.#heightBoost.style.removeProperty("--height-boost");
	    }
	  }
	  forceReflow() {
	    if (!this.#wrapper) {
	      return;
	    }
	    void this.#wrapper.offsetHeight;
	  }
	  getBoundingClientRect() {
	    if (!this.#wrapper) {
	      return { x: 0, y: 0, width: 0, height: 0 };
	    }
	    return this.#wrapper.getBoundingClientRect();
	  }
	  getScroll() {
	    if (!this.#wrapper) {
	      return [0, 0];
	    }
	    return [this.#wrapper.scrollLeft, this.#wrapper.scrollTop];
	  }
	  // 텍스트노드, 인라인노드, P태그 안에는 블럭요소를 집어넣으면 안되지만 contenteditable 안에서 브라우저는 그런걸 제어해주지 않음.
	  // 몇번 붙여넣기 하다보면 <SPAN> 태그 안에 <P>, <DIV>, <TABLE>들이 들어가 있는 광경을 보게 된다.
	  // 따라서 붙여넣기 하기 전에 insertion point를 확인하고 텍스트노드이거나 인라인요소 사이를 반으로 쪼개야 한다.
	  // 그리고 이 작업은 부모를 거슬러올라가면서 계속... 해야함.
	  ensureInsertableRange(range, forBlock) {
	    if (range.startContainer.nodeType !== 1 && range.startContainer.nodeType !== 3) {
	      throw new Error("Range start container is not a text node or an element");
	    }
	    if (!this.#editor.contains(range.startContainer)) {
	      throw new Error("Range start container is not within the editor");
	    }
	    if (forBlock) {
	      let container = range.startContainer;
	      let offset = range.startOffset;
	      if (container.nodeType === 3) {
	        if (offset === 0) {
	          offset = Array.prototype.indexOf.call(container.parentNode.childNodes, container);
	          range.setStartBefore(container);
	        } else if (offset === container.nodeValue.length) {
	          offset = Array.prototype.indexOf.call(container.parentNode.childNodes, container) + 1;
	          range.setStartAfter(container);
	        } else {
	          const prevText = document.createTextNode(container.nodeValue.slice(0, offset));
	          container.nodeValue = container.nodeValue.slice(offset);
	          container.parentNode.insertBefore(prevText, container);
	          offset = Array.prototype.indexOf.call(container.parentNode.childNodes, container);
	          range.setStartAfter(prevText);
	        }
	        container = range.startContainer;
	      }
	      let adjusted = false;
	      while (container !== this.#editor && !TEXT_FLOW_CONTAINERS[container.nodeName] && // editor루트나 TD, ...등은 더 이상 쪼개면 안됨
	      (container.nodeName === "P" || !BLOCK_ELEMENTS[container.nodeName])) {
	        const parentNode = container.parentNode;
	        if (offset === 0) {
	          offset = Array.prototype.indexOf.call(parentNode.childNodes, container);
	          container = parentNode;
	        } else if (offset === container.childNodes.length) {
	          offset = Array.prototype.indexOf.call(parentNode.childNodes, container) + 1;
	          container = parentNode;
	        } else {
	          const clone = container.cloneNode(false);
	          for (let i = 0; i < offset; i++) {
	            clone.appendChild(container.firstChild);
	          }
	          parentNode.insertBefore(clone, container);
	          offset = Array.prototype.indexOf.call(parentNode.childNodes, container);
	        }
	        container = parentNode;
	        adjusted = true;
	      }
	      if (adjusted) {
	        range = range.cloneRange();
	        range.setStart(container, offset);
	        range.collapse(true);
	      }
	    }
	    return range;
	  }
	}

	const diffOptionsAtom = jotai.atom({
	  algorithm: "histogram",
	  tokenization: "word",
	  ignoreWhitespace: "ignore",
	  greedyMatch: false,
	  useLengthBias: true,
	  maxGram: 4,
	  lengthBiasFactor: 0.7,
	  containerStartMultiplier: 1 / 0.85,
	  containerEndMultiplier: 1 / 0.9,
	  sectionHeadingMultiplier: 1 / 0.75,
	  lineStartMultiplier: 1 / 0.9,
	  lineEndMultiplier: 1 / 0.95,
	  uniqueMultiplier: 1 / 0.6667
	});
	const whitespaceHandlingAtom = jotai.atom(
	  (get) => get(diffOptionsAtom).ignoreWhitespace,
	  (get, set, value) => {
	    const currentOptions = get(diffOptionsAtom);
	    set(diffOptionsAtom, {
	      ...currentOptions,
	      ignoreWhitespace: value
	    });
	  }
	);

	const KEYBOARD_SHORTCUTS = {
	  TOGGLE_SYNC_MODE: "F2",
	  TOGGLE_LAYOUT: "F10",
	  PASTE_BOMB_LEFT: "Ctrl+1",
	  PASTE_BOMB_RIGHT: "Ctrl+2",
	  CLEAR_ALL_CONTENT: "Ctrl+r"
	};
	const UI_CONSTANTS = {
	  SIDEBAR_MIN_SIZE: 170,
	  MAIN_PANEL_MIN_SIZE: 400,
	  SIDEBAR_INITIAL_SIZE: "250px"
	};
	const APP_MESSAGES = {
	  INIT_SUCCESS: "DiffSeek app initialized",
	  INIT_ERROR: "Failed to initialize DiffSeek app:",
	  CONTEXT_ERROR: "useDiffControllerContext must be used within a DiffControllerProvider"
	};

	const DiffControllerContext = React.createContext(null);
	function DiffControllerProvider({
	  children
	}) {
	  const diffOptions = jotai.useAtomValue(diffOptionsAtom);
	  const contextValue = React.useMemo(() => {
	    const leftEditor = new Editor("left");
	    const rightEditor = new Editor("right");
	    const renderer = new Renderer(leftEditor, rightEditor);
	    const diffController = new DiffController(leftEditor, rightEditor, renderer, diffOptions);
	    return {
	      diffController,
	      leftEditor,
	      rightEditor,
	      renderer
	    };
	  }, []);
	  React.useEffect(() => {
	    console.log(diffOptions);
	    contextValue.diffController.updateDiffOptions(diffOptions);
	    contextValue.diffController.computeDiff();
	  }, [diffOptions, contextValue.diffController]);
	  return /* @__PURE__ */ jsxRuntime.jsx(DiffControllerContext.Provider, { value: contextValue, children });
	}
	function useDiffControllerContext() {
	  const context = React.useContext(DiffControllerContext);
	  if (!context) {
	    throw new Error(APP_MESSAGES.CONTEXT_ERROR);
	  }
	  return context;
	}

	function EditorPanel({}) {
	  const { leftEditor, rightEditor, renderer } = useDiffControllerContext();
	  const syncMode = jotai.useAtomValue(syncModeAtom);
	  const layout = jotai.useAtomValue(editorPanelLayoutAtom);
	  const leftEditorShell = React.useMemo(() => /* @__PURE__ */ jsxRuntime.jsx(EditorShell, { editor: leftEditor }), [leftEditor]);
	  const rightEditorShell = React.useMemo(() => /* @__PURE__ */ jsxRuntime.jsx(EditorShell, { editor: rightEditor }), [rightEditor]);
	  const rendererShell = React.useMemo(() => /* @__PURE__ */ jsxRuntime.jsx(RendererShell, { renderer }), [renderer]);
	  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: container$1({
	    layout,
	    syncMode: syncMode ? "on" : "off"
	  }), children: [
	    rendererShell,
	    /* @__PURE__ */ jsxRuntime.jsx(
	      "div",
	      {
	        "aria-hidden": true,
	        className: divider({
	          layout
	        })
	      }
	    ),
	    leftEditorShell,
	    rightEditorShell
	  ] });
	}

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */

	const toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
	const toCamelCase = (string) => string.replace(
	  /^([A-Z])|[\s-_]+(\w)/g,
	  (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
	);
	const toPascalCase = (string) => {
	  const camelCase = toCamelCase(string);
	  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
	};
	const mergeClasses = (...classes) => classes.filter((className, index, array) => {
	  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
	}).join(" ").trim();
	const hasA11yProp = (props) => {
	  for (const prop in props) {
	    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
	      return true;
	    }
	  }
	};

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */

	var defaultAttributes = {
	  xmlns: "http://www.w3.org/2000/svg",
	  width: 24,
	  height: 24,
	  viewBox: "0 0 24 24",
	  fill: "none",
	  stroke: "currentColor",
	  strokeWidth: 2,
	  strokeLinecap: "round",
	  strokeLinejoin: "round"
	};

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const Icon = React.forwardRef(
	  ({
	    color = "currentColor",
	    size = 24,
	    strokeWidth = 2,
	    absoluteStrokeWidth,
	    className = "",
	    children,
	    iconNode,
	    ...rest
	  }, ref) => React.createElement(
	    "svg",
	    {
	      ref,
	      ...defaultAttributes,
	      width: size,
	      height: size,
	      stroke: color,
	      strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
	      className: mergeClasses("lucide", className),
	      ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
	      ...rest
	    },
	    [
	      ...iconNode.map(([tag, attrs]) => React.createElement(tag, attrs)),
	      ...Array.isArray(children) ? children : [children]
	    ]
	  )
	);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const createLucideIcon = (iconName, iconNode) => {
	  const Component = React.forwardRef(
	    ({ className, ...props }, ref) => React.createElement(Icon, {
	      ref,
	      iconNode,
	      className: mergeClasses(
	        `lucide-${toKebabCase(toPascalCase(iconName))}`,
	        `lucide-${iconName}`,
	        className
	      ),
	      ...props
	    })
	  );
	  Component.displayName = toPascalCase(iconName);
	  return Component;
	};

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode$8 = [
	  ["path", { d: "M12 7v14", key: "1akyts" }],
	  [
	    "path",
	    {
	      d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
	      key: "ruj8y"
	    }
	  ]
	];
	const BookOpen = createLucideIcon("book-open", __iconNode$8);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode$7 = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]];
	const Check = createLucideIcon("check", __iconNode$7);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode$6 = [["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]];
	const Circle = createLucideIcon("circle", __iconNode$6);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode$5 = [
	  ["path", { d: "M5 15a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0", key: "yrdkhy" }],
	  ["path", { d: "M5 9a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0", key: "gzkvyz" }]
	];
	const EqualApproximately = createLucideIcon("equal-approximately", __iconNode$5);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode$4 = [
	  ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1", key: "1g98yp" }],
	  ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1", key: "1bb6yr" }],
	  ["path", { d: "M14 4h7", key: "3xa0d5" }],
	  ["path", { d: "M14 9h7", key: "1icrd9" }],
	  ["path", { d: "M14 15h7", key: "1mj8o2" }],
	  ["path", { d: "M14 20h7", key: "11slyb" }]
	];
	const LayoutList = createLucideIcon("layout-list", __iconNode$4);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode$3 = [
	  ["path", { d: "M21 12h-8", key: "1bmf0i" }],
	  ["path", { d: "M21 6H8", key: "1pqkrb" }],
	  ["path", { d: "M21 18h-8", key: "1tm79t" }],
	  ["path", { d: "M3 6v4c0 1.1.9 2 2 2h3", key: "1ywdgy" }],
	  ["path", { d: "M3 10v6c0 1.1.9 2 2 2h3", key: "2wc746" }]
	];
	const ListTree = createLucideIcon("list-tree", __iconNode$3);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode$2 = [
	  ["path", { d: "m13 13.5 2-2.5-2-2.5", key: "1rvxrh" }],
	  ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }],
	  ["path", { d: "M9 8.5 7 11l2 2.5", key: "6ffwbx" }],
	  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
	];
	const SearchCode = createLucideIcon("search-code", __iconNode$2);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode$1 = [
	  ["path", { d: "M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1", key: "lt2kga" }]
	];
	const Space = createLucideIcon("space", __iconNode$1);

	/**
	 * @license lucide-react v0.541.0 - ISC
	 *
	 * This source code is licensed under the ISC license.
	 * See the LICENSE file in the root directory of this source tree.
	 */


	const __iconNode = [
	  ["path", { d: "m16 16-2 2 2 2", key: "kkc6pm" }],
	  ["path", { d: "M3 12h15a3 3 0 1 1 0 6h-4", key: "1cl7v7" }],
	  ["path", { d: "M3 18h7", key: "sq21v6" }],
	  ["path", { d: "M3 6h18", key: "d0wm0j" }]
	];
	const WrapText = createLucideIcon("wrap-text", __iconNode);

	function useDiffContext() {
	  const { diffController } = useDiffControllerContext();
	  const [ctx, setCtx] = React.useState(diffController.diffContext);
	  React.useEffect(() => {
	    const off = diffController.onDiffWorkflowDone((diffContext) => {
	      setCtx(diffContext);
	    });
	    return off;
	  }, [diffController]);
	  return ctx;
	}

	const defaultOptions = {
	  maxLength: void 0,
	  // No limit by default
	  newLineChar: "\n"
	  // Default new line character
	};
	function extractTextFromRange(range, { maxLength, newLineChar } = defaultOptions) {
	  const blockStack = [];
	  let container = range.startContainer;
	  let childIndex = range.startOffset;
	  let endContainer = range.endContainer;
	  let endOffset = range.endOffset;
	  let hasVisibleContent = false;
	  let length = 0;
	  maxLength ??= 1e6;
	  newLineChar ??= "\n";
	  function normalizeText(str) {
	    return str.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ");
	  }
	  const lines = [""];
	  function append(str) {
	    let cleaned = normalizeText(str);
	    if (cleaned) {
	      const curr = lines[lines.length - 1];
	      if (curr === "") {
	        cleaned = cleaned.trimStart();
	      }
	      lines[lines.length - 1] += cleaned;
	      hasVisibleContent = true;
	    }
	  }
	  function newline() {
	    const curr = lines[lines.length - 1].trimEnd();
	    lines[lines.length - 1] = curr;
	    if (curr !== "") {
	      length += curr.length;
	      lines.push("");
	    }
	    return maxLength ? length > maxLength : false;
	  }
	  function finalize() {
	    let trimmed = false;
	    let result = lines.join(newLineChar).trimEnd();
	    if (maxLength && result.length > maxLength) {
	      result = result.slice(0, maxLength);
	      trimmed = true;
	    }
	    return [result, trimmed];
	  }
	  if (container.nodeType === 3) {
	    if (container === endContainer) {
	      append(container.nodeValue.slice(childIndex, endOffset));
	      return finalize();
	    }
	    append(container.nodeValue.slice(childIndex));
	    const parent = container.parentNode;
	    if (!parent) {
	      return finalize();
	    }
	    childIndex = Array.prototype.indexOf.call(parent.childNodes, container) + 1;
	    container = parent;
	  }
	  const indexStack = [];
	  while (container) {
	    if (container === endContainer) {
	      if (childIndex >= endOffset) break;
	    }
	    const current = container.childNodes[childIndex];
	    if (!current) {
	      const prev = container;
	      container = container.parentNode;
	      if (!container) break;
	      if (indexStack.length > 0) {
	        childIndex = indexStack.pop();
	      } else {
	        childIndex = Array.prototype.indexOf.call(container.childNodes, prev);
	      }
	      childIndex++;
	      if (BLOCK_ELEMENTS[prev.nodeName]) {
	        if (hasVisibleContent) {
	          if (newline()) break;
	        }
	        if (blockStack.length > 0) {
	          ({ hasVisibleContent } = blockStack.pop());
	        } else {
	          hasVisibleContent = false;
	        }
	      }
	      continue;
	    }
	    if (current.nodeType === 1) {
	      if (BLOCK_ELEMENTS[current.nodeName]) {
	        blockStack.push({ node: current, hasVisibleContent });
	        hasVisibleContent = false;
	      }
	      if (current.nodeName === "BR") {
	        if (newline()) break;
	        hasVisibleContent = false;
	      } else if (current.nodeName === "IMG") {
	        append("🖼️");
	      } else if (!VOID_ELEMENTS[current.nodeName]) {
	        indexStack.push(childIndex);
	        container = current;
	        childIndex = 0;
	        continue;
	      }
	    }
	    if (current.nodeType === 3) {
	      if (current === endContainer) {
	        append(current.nodeValue.slice(0, endOffset));
	        break;
	      }
	      append(current.nodeValue);
	    }
	    childIndex++;
	  }
	  return finalize();
	}

	var buttonColor = 'var(--buttonColor__g6tlaj0)';
	var buttonSurface = 'var(--buttonSurface__g6tlaj1)';
	var buttonPaddingInline = 'var(--buttonPaddingInline__g6tlaj2)';
	var buttonBorderStrength = 'var(--buttonBorderStrength__g6tlaj3)';
	var buttonHeight = 'var(--buttonHeight__g6tlaj4)';
	var button = 'Button_button__g6tlaj5';
	var size = {xxs:'Button_size_xxs__g6tlaj6',xs:'Button_size_xs__g6tlaj7',sm:'Button_size_sm__g6tlaj8',md:'Button_size_md__g6tlaj9',lg:'Button_size_lg__g6tlaja',icon:'Button_size_icon__g6tlajb'};
	var variant = {'default':'Button_variant_default__g6tlajc',outline:'Button_variant_outline__g6tlajd',ghost:'Button_variant_ghost__g6tlaje',secondary:'Button_variant_secondary__g6tlajf',destructive:'Button_variant_destructive__g6tlajg',link:'Button_variant_link__g6tlajh'};

	function Button({
	  className,
	  variant: variant$1 = "default",
	  size: size$1 = "md",
	  asChild = false,
	  color,
	  surface,
	  px,
	  borderStrength,
	  height,
	  style,
	  ...props
	}) {
	  const Comp = asChild ? reactSlot.Slot : "button";
	  const styleVars = dynamic.assignInlineVars({
	    [buttonColor]: color,
	    [buttonSurface]: surface,
	    [buttonPaddingInline]: typeof px === "number" ? `${px}px` : px,
	    [buttonBorderStrength]: typeof borderStrength === "number" ? `${borderStrength}%` : borderStrength,
	    [buttonHeight]: typeof height === "number" ? `${height}px` : height
	  });
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    Comp,
	    {
	      "data-slot": "button",
	      className: clsx(button, variant[variant$1], size[size$1], className),
	      style: styleVars ? { ...styleVars, ...style } : style,
	      ...props
	    }
	  );
	}

	var root$3 = createRuntimeFn({defaultClassName:'SideTagButton_root__iio7j30',variantClassNames:{visible:{true:'SideTagButton_root_visible_true__iio7j31',false:'SideTagButton_root_visible_false__iio7j32'}},defaultVariants:{},compoundVariants:[]});

	function SideTagButton({
	  side,
	  visible = true,
	  // background,
	  // foreground,
	  // border,
	  children,
	  className,
	  "aria-label": ariaLabel,
	  onClick,
	  ...props
	}) {
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    Button,
	    {
	      onClick,
	      variant: "default",
	      "aria-label": ariaLabel,
	      size: "xxs",
	      className: clsx(
	        root$3({ visible }),
	        className
	      ),
	      ...props,
	      children: children ?? (side === "left" ? /* @__PURE__ */ jsxRuntime.jsx("span", { children: "L" }) : /* @__PURE__ */ jsxRuntime.jsx("span", { children: "R" }))
	    }
	  );
	}
	function SideTagCopyButton({
	  getValue,
	  onCopied,
	  ...props
	}) {
	  const [copied, setCopied] = React.useState(false);
	  const copy = async () => {
	    try {
	      const content = getValue?.();
	      if (content) {
	        await navigator.clipboard.writeText(content);
	        setCopied(true);
	        setTimeout(() => setCopied(false), 1e3);
	        onCopied?.();
	      }
	    } catch {
	    }
	  };
	  return /* @__PURE__ */ jsxRuntime.jsx(SideTagButton, { onClick: copy, ...props, children: copied ? /* @__PURE__ */ jsxRuntime.jsx(Check, { size: 8, className: clsx() }) : null });
	}

	var root$2 = 'SidebarPanel_root__1atlfle0';
	var header = 'SidebarPanel_header__1atlfle1';
	var headerRow = 'SidebarPanel_headerRow__1atlfle2';
	var headerContentLeading = 'SidebarPanel_headerContentLeading__1atlfle3';
	var headerContentActions = 'SidebarPanel_headerContentActions__1atlfle4';
	var body = createRuntimeFn({defaultClassName:'SidebarPanel_body__1atlfle5',variantClassNames:{scroll:{true:'SidebarPanel_body_scroll_true__1atlfle6',false:'SidebarPanel_body_scroll_false__1atlfle7'}},defaultVariants:{scroll:true},compoundVariants:[]});
	var messageContainer = 'SidebarPanel_messageContainer__1atlfle8';
	var errorMessage = 'SidebarPanel_errorMessage__1atlfle9';
	var descMessage = 'SidebarPanel_descMessage__1atlflea';

	const SidebarPanelRoot = React.forwardRef(function SidebarPanelRoot2({ className, ariaLabel, children, ...props }, ref) {
	  const hostRef = React.useRef(null);
	  React.useImperativeHandle(ref, () => hostRef.current, []);
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    "div",
	    {
	      ref: hostRef,
	      "aria-label": ariaLabel,
	      className: clsx(root$2, className),
	      ...props,
	      children
	    }
	  );
	});
	const SidebarPanelHeader = React.forwardRef(function SidebarPanelHeader2({ className, leading, actions, children, ...props }, ref) {
	  return /* @__PURE__ */ jsxRuntime.jsxs(
	    "div",
	    {
	      ref,
	      className: clsx(header, className),
	      ...props,
	      children: [
	        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: headerRow, children: [
	          leading ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: headerContentLeading, children: leading }) : null,
	          children
	        ] }),
	        actions ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: headerContentActions, children: actions }) : null
	      ]
	    }
	  );
	});
	const SidebarPanelBody = React.forwardRef(function SidebarPanelBody2({ className, children, scroll = true, ...props }, ref) {
	  return /* @__PURE__ */ jsxRuntime.jsx("div", { ref, className: clsx(body({ scroll })), ...props, children });
	});
	const SidebarPanel = Object.assign(SidebarPanelRoot, {
	  Root: SidebarPanelRoot,
	  Header: SidebarPanelHeader,
	  Body: SidebarPanelBody
	});

	var list = 'DiffListPanel_list__4kafsq0';
	var listItem = 'DiffListPanel_listItem__4kafsq1';
	var listItemVariants = {hover:'DiffListPanel_listItemVariants_hover__4kafsq2'};
	var sideTag = 'DiffListPanel_sideTag__4kafsq3';
	var text = 'DiffListPanel_text__4kafsq4';

	function DiffListPanel({ className, ...props }) {
	  const { diffController } = useDiffControllerContext();
	  const diffContext = useDiffContext();
	  const [visibleDiffs, setVisibleDiffs] = React.useState(diffController.getVisibleDiffs());
	  const [hoveredDiffIndex, setHoveredDiffIndex] = React.useState(null);
	  const items = diffContext?.diffs ?? [];
	  React.useEffect(() => {
	    const unsub = [];
	    unsub.push(
	      diffController.onDiffVisibilityChanged(() => {
	        setVisibleDiffs(diffController.getVisibleDiffs());
	      })
	    );
	    unsub.push(
	      diffController.onHoveredDiffIndexChange((diffIndex) => {
	        setHoveredDiffIndex(diffIndex);
	      })
	    );
	    return () => unsub.forEach((fn) => fn());
	  }, [diffController]);
	  const onItemClick = React.useCallback(
	    (e, diffIndex, side) => {
	      e.preventDefault();
	      e.stopPropagation();
	      console.log("Diff item clicked", diffIndex, side);
	      const toEnd = e.shiftKey;
	      diffController.scrollToDiff(diffIndex, { primary: side, toEnd });
	    },
	    [diffController]
	  );
	  const onItemEnter = React.useCallback((diffIndex) => {
	    diffController.setHoveredDiffIndex(diffIndex);
	  }, [diffController]);
	  const onItemLeave = React.useCallback(() => {
	    diffController.setHoveredDiffIndex(null);
	  }, [diffController]);
	  return /* @__PURE__ */ jsxRuntime.jsxs(SidebarPanel.Root, { ariaLabel: "Diff List", className: clsx(className), ...props, children: [
	    /* @__PURE__ */ jsxRuntime.jsx(
	      SidebarPanel.Header,
	      {
	        leading: /* @__PURE__ */ jsxRuntime.jsx(LayoutList, { size: 16 }),
	        children: "Diff List"
	      }
	    ),
	    /* @__PURE__ */ jsxRuntime.jsx(SidebarPanel.Body, { children: /* @__PURE__ */ jsxRuntime.jsx("ul", { className: clsx(list), children: items.map((item) => /* @__PURE__ */ jsxRuntime.jsx(
	      DiffListItem,
	      {
	        diff: item,
	        leftVisible: visibleDiffs.left.has(item.diffIndex),
	        rightVisible: visibleDiffs.right.has(item.diffIndex),
	        diffHovered: hoveredDiffIndex === item.diffIndex,
	        onDiffClick: onItemClick,
	        onDiffEnter: onItemEnter,
	        onDiffLeave: onItemLeave
	      },
	      item.diffIndex
	    )) }) })
	  ] });
	}
	function DiffListItem({
	  diff,
	  onDiffClick,
	  onDiffEnter,
	  onDiffLeave,
	  leftVisible,
	  rightVisible,
	  diffHovered,
	  className,
	  ...liProps
	}) {
	  const hue = diff.hue;
	  const leftText = extractTextFromRange(diff.leftRange, { maxLength: 50 });
	  const rightText = extractTextFromRange(diff.rightRange, { maxLength: 50 });
	  const buttonColor = "hsl(var(--diff-hue) 100% 40%)";
	  const buttonSurface = "hsl(var(--diff-hue) 100% 80%)";
	  return /* @__PURE__ */ jsxRuntime.jsxs(
	    "li",
	    {
	      className: clsx(listItem, diffHovered && listItemVariants.hover, className),
	      style: { "--diff-hue": hue },
	      onClick: (e) => onDiffClick(e, diff.diffIndex),
	      onMouseEnter: () => onDiffEnter(diff.diffIndex),
	      onMouseLeave: onDiffLeave,
	      ...liProps,
	      children: [
	        /* @__PURE__ */ jsxRuntime.jsx(
	          SideTagButton,
	          {
	            side: "left",
	            visible: leftVisible,
	            onClick: (e) => onDiffClick(e, diff.diffIndex, "left"),
	            className: sideTag,
	            color: buttonColor,
	            surface: buttonSurface
	          }
	        ),
	        /* @__PURE__ */ jsxRuntime.jsx("div", { className: clsx(text), children: leftText }),
	        /* @__PURE__ */ jsxRuntime.jsx(
	          SideTagButton,
	          {
	            side: "right",
	            visible: rightVisible,
	            onClick: (e) => onDiffClick(e, diff.diffIndex, "right"),
	            color: buttonColor,
	            surface: buttonSurface
	          }
	        ),
	        /* @__PURE__ */ jsxRuntime.jsx("div", { className: clsx(text), children: rightText })
	      ]
	    }
	  );
	}

	var trail = 'TrailViewPanel_trail__am98h01';
	var trailLink = 'TrailViewPanel_trailLink__am98h02';
	var ordinalText = 'TrailViewPanel_ordinalText__am98h03';
	var headingTitle = 'TrailViewPanel_headingTitle__am98h04';
	var separator = 'TrailViewPanel_separator__am98h05';

	function TrailViewPanel({ className, ...props }) {
	  const fallbackSelection = React__namespace.useRef(null);
	  let editorTextSelection = jotai.useAtomValue(editorTextSelectionAtom);
	  if (!editorTextSelection) editorTextSelection = fallbackSelection.current;
	  else fallbackSelection.current = editorTextSelection;
	  const diffContext = useDiffContext();
	  let leftHeadings = [];
	  let rightHeadings = [];
	  if (diffContext && editorTextSelection) {
	    const { leftTokenSpan, rightTokenSpan, sourceEditor, sourceSpan } = editorTextSelection;
	    const leftSpan = sourceEditor === "left" ? sourceSpan : leftTokenSpan;
	    const rightSpan = sourceEditor === "right" ? sourceSpan : rightTokenSpan;
	    let leftIndex = leftSpan.start;
	    let rightIndex = rightSpan.start;
	    if (leftSpan.start === leftSpan.end) {
	      leftIndex--;
	    }
	    if (rightSpan.start === rightSpan.end) {
	      rightIndex--;
	    }
	    leftHeadings = diffContext.getSelectionTrailFromTokenIndex(
	      "left",
	      leftIndex
	    );
	    rightHeadings = diffContext.getSelectionTrailFromTokenIndex(
	      "right",
	      rightIndex
	    );
	  }
	  return /* @__PURE__ */ jsxRuntime.jsxs(
	    SidebarPanel.Root,
	    {
	      ariaLabel: "Breadcrumbs",
	      className: clsx(className),
	      ...props,
	      children: [
	        /* @__PURE__ */ jsxRuntime.jsx(
	          SidebarPanel.Header,
	          {
	            leading: /* @__PURE__ */ jsxRuntime.jsx(ListTree, { size: 14 }),
	            children: "Breadcrumbs"
	          }
	        ),
	        /* @__PURE__ */ jsxRuntime.jsxs(SidebarPanel.Body, { children: [
	          !editorTextSelection && /* @__PURE__ */ jsxRuntime.jsx("div", { className: messageContainer, children: /* @__PURE__ */ jsxRuntime.jsx("p", { className: descMessage, children: "선택된 위치 없음" }) }),
	          (leftHeadings.length > 0 || rightHeadings.length > 0) && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
	            /* @__PURE__ */ jsxRuntime.jsx(Trail, { trail: leftHeadings, side: "left" }),
	            /* @__PURE__ */ jsxRuntime.jsx(Trail, { trail: rightHeadings, side: "right" })
	          ] })
	        ] })
	      ]
	    }
	  );
	}
	function getTrailText(trail) {
	  return trail.map((h) => `${h.ordinalText} ${h.title}`).join(" › ");
	}
	function Trail({ side, trail: trail$1 }) {
	  const { diffController } = useDiffControllerContext();
	  const getValue = () => getTrailText(trail$1);
	  const onHeadingClick = (heading) => {
	    diffController.scrollToTokenIndex(side, heading.startTokenIndex);
	  };
	  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: clsx(trail), children: [
	    /* @__PURE__ */ jsxRuntime.jsx(SideTagCopyButton, { getValue, side }),
	    /* @__PURE__ */ jsxRuntime.jsx("div", { children: trail$1.map((h, i) => /* @__PURE__ */ jsxRuntime.jsxs(React__namespace.Fragment, { children: [
	      /* @__PURE__ */ jsxRuntime.jsxs("a", { className: trailLink, onClick: () => onHeadingClick(h), children: [
	        /* @__PURE__ */ jsxRuntime.jsx("span", { className: clsx(ordinalText), children: h.ordinalText }),
	        " ",
	        /* @__PURE__ */ jsxRuntime.jsx("span", { className: clsx(headingTitle), children: h.title })
	      ] }),
	      i < trail$1.length - 1 && /* @__PURE__ */ jsxRuntime.jsx("span", { className: clsx(separator), children: " › " })
	    ] }, i)) })
	  ] });
	}

	function tokenizeByChar(text, _options) {
	  const tokens = [];
	  let i = 0;
	  while (i < text.length) {
	    const charCode = text.codePointAt(i);
	    const count = charCode > 65535 ? 2 : 1;
	    const normCode = normalizedCharMap[charCode] ?? charCode;
	    tokens.push({
	      char: String.fromCodePoint(normCode),
	      count,
	      index: i
	    });
	    i += count;
	  }
	  return tokens;
	}

	function createQuickDiff() {
	  let ricId = null;
	  function quickDiff(leftText, rightText, options) {
	    const A = tokenizeByChar(leftText);
	    const B = tokenizeByChar(rightText);
	    const dp = Array(A.length + 1).fill(null).map(() => Array(B.length + 1).fill(0));
	    for (let i2 = A.length - 1; i2 >= 0; i2--) {
	      for (let j2 = B.length - 1; j2 >= 0; j2--) {
	        if (A[i2].char === B[j2].char) {
	          dp[i2][j2] = dp[i2 + 1][j2 + 1] + 1;
	        } else {
	          dp[i2][j2] = Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
	        }
	      }
	    }
	    let i = 0, j = 0;
	    const diffs = [];
	    while (i < A.length || j < B.length) {
	      if (i < A.length && j < B.length && A[i].char === B[j].char) {
	        diffs.push({
	          type: 0,
	          left: { start: A[i].index, end: A[i].index + A[i].count },
	          right: { start: B[j].index, end: B[j].index + B[j].count }
	        });
	        i++;
	        j++;
	      } else if (i < A.length && (j >= B.length || dp[i + 1][j] >= dp[i][j + 1])) {
	        diffs.push({
	          type: 1,
	          left: { start: A[i].index, end: A[i].index + A[i].count },
	          right: null
	        });
	        i++;
	      } else if (j < B.length) {
	        diffs.push({
	          type: 2,
	          left: null,
	          right: { start: B[j].index, end: B[j].index + B[j].count }
	        });
	        j++;
	      }
	    }
	    return diffs;
	  }
	  function requestQuickDiff(leftText, rightText, options = {}, onComplete) {
	    if (ricId !== null) {
	      cancelIdleCallback(ricId);
	    }
	    ricId = requestIdleCallback(() => {
	      const result = quickDiff(leftText, rightText);
	      onComplete(result);
	      ricId = null;
	    });
	  }
	  function cancel() {
	    if (ricId !== null) {
	      cancelIdleCallback(ricId);
	      ricId = null;
	    }
	  }
	  return {
	    quickDiff,
	    requestQuickDiff,
	    cancel
	  };
	}

	var content$1 = 'InlineDiffViewPanel_content__1vjk93w0';
	var diff = createRuntimeFn({defaultClassName:'InlineDiffViewPanel_diff__1vjk93w1',variantClassNames:{type:{'0':'InlineDiffViewPanel_diff_type_0__1vjk93w2','1':'InlineDiffViewPanel_diff_type_1__1vjk93w3','2':'InlineDiffViewPanel_diff_type_2__1vjk93w4'}},defaultVariants:{},compoundVariants:[]});
	var splitWrapper = createRuntimeFn({defaultClassName:'InlineDiffViewPanel_splitWrapper__1vjk93w5',variantClassNames:{dir:{col:'InlineDiffViewPanel_splitWrapper_dir_col__1vjk93w6',row:'InlineDiffViewPanel_splitWrapper_dir_row__1vjk93w7'}},defaultVariants:{},compoundVariants:[]});
	var splitter = createRuntimeFn({defaultClassName:'InlineDiffViewPanel__1vjk93w8',variantClassNames:{dir:{col:'InlineDiffViewPanel_splitter_dir_col__1vjk93w9',row:'InlineDiffViewPanel_splitter_dir_row__1vjk93wa'}},defaultVariants:{},compoundVariants:[]});
	var specialChar = 'InlineDiffViewPanel_specialChar__1vjk93wb';

	var content = 'DropdownMenu_content__14cip0y8';
	var contentState = 'DropdownMenu_contentState__14cip0ya';
	var itemKind = {radio:'DropdownMenu_itemKind_radio__14cip0ye'};
	var itemVariant = {'default':'DropdownMenu_itemVariant_default__14cip0yf'};
	var indicator = 'DropdownMenu_indicator__14cip0yh';
	var label = 'DropdownMenu_label__14cip0yi';

	function DropdownMenu({
	  ...props
	}) {
	  return /* @__PURE__ */ jsxRuntime.jsx(DropdownMenuPrimitive__namespace.Root, { "data-slot": "dropdown-menu", ...props });
	}
	function DropdownMenuTrigger({
	  ...props
	}) {
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    DropdownMenuPrimitive__namespace.Trigger,
	    {
	      "data-slot": "dropdown-menu-trigger",
	      ...props
	    }
	  );
	}
	function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
	  return /* @__PURE__ */ jsxRuntime.jsx(DropdownMenuPrimitive__namespace.Portal, { children: /* @__PURE__ */ jsxRuntime.jsx(
	    DropdownMenuPrimitive__namespace.Content,
	    {
	      sideOffset,
	      className: clsx(content, contentState, className),
	      ...props
	    }
	  ) });
	}
	function DropdownMenuRadioGroup({
	  ...props
	}) {
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    DropdownMenuPrimitive__namespace.RadioGroup,
	    {
	      "data-slot": "dropdown-menu-radio-group",
	      ...props
	    }
	  );
	}
	function DropdownMenuRadioItem({
	  className,
	  children,
	  ...props
	}) {
	  return /* @__PURE__ */ jsxRuntime.jsxs(
	    DropdownMenuPrimitive__namespace.RadioItem,
	    {
	      className: clsx(itemKind.radio, itemVariant.default, className),
	      ...props,
	      children: [
	        /* @__PURE__ */ jsxRuntime.jsx("span", { className: indicator, children: /* @__PURE__ */ jsxRuntime.jsx(DropdownMenuPrimitive__namespace.ItemIndicator, { children: /* @__PURE__ */ jsxRuntime.jsx(Circle, {}) }) }),
	        children
	      ]
	    }
	  );
	}
	function DropdownMenuLabel({
	  className,
	  inset,
	  ...props
	}) {
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    DropdownMenuPrimitive__namespace.Label,
	    {
	      "data-slot": "dropdown-menu-label",
	      "data-inset": inset,
	      className: clsx(label, className),
	      ...props
	    }
	  );
	}

	const diffOptions = {};
	const MaxTextLength = 300;
	const renderModeAtom = utils.atomWithStorage("inlineDiffRenderMode", "stacked");
	function InlineDiffViewPanel({ ...props }) {
	  const fallbackSelection = React.useRef(null);
	  let editorTextSelection = jotai.useAtomValue(editorTextSelectionAtom);
	  if (!editorTextSelection) {
	    editorTextSelection = fallbackSelection.current;
	  } else {
	    fallbackSelection.current = editorTextSelection;
	  }
	  const [renderMode, setRenderMode] = jotai.useAtom(renderModeAtom);
	  const lastInputOutput = React.useRef({
	    left: "",
	    right: "",
	    options: diffOptions,
	    diffs: []
	  });
	  const [entries, setEntries] = React.useState(null);
	  const leftRange = editorTextSelection?.leftTokenRange;
	  const rightRange = editorTextSelection?.rightTokenRange;
	  const [textPair, setTextPair] = React.useState({ left: "", right: "" });
	  const { left: leftText, right: rightText } = textPair;
	  const tooLong = leftText.length > MaxTextLength || rightText.length > MaxTextLength;
	  const quickDiffInstanceRef = React.useRef(null);
	  if (!quickDiffInstanceRef.current) {
	    quickDiffInstanceRef.current = createQuickDiff();
	  }
	  const quickDiffInstance = quickDiffInstanceRef.current;
	  React.useEffect(() => {
	    if (leftRange && rightRange) {
	      const leftText2 = extractTextFromRange(leftRange, { maxLength: MaxTextLength + 1 })[0];
	      const rightText2 = extractTextFromRange(rightRange, { maxLength: MaxTextLength + 1 })[0];
	      setTextPair((prev) => {
	        if (prev.left === leftText2 && prev.right === rightText2) return prev;
	        setEntries(null);
	        if (leftText2.length <= MaxTextLength && rightText2.length <= MaxTextLength) {
	          quickDiffInstance.requestQuickDiff(leftText2, rightText2, diffOptions, (result) => setEntries(result));
	        }
	        return { left: leftText2, right: rightText2 };
	      });
	    } else {
	      lastInputOutput.current.left = "";
	      lastInputOutput.current.right = "";
	    }
	    return () => {
	    };
	  }, [leftRange, rightRange, diffOptions, quickDiffInstance]);
	  return /* @__PURE__ */ jsxRuntime.jsxs(SidebarPanel.Root, { ariaLabel: "Inline Diff 패널", ...props, children: [
	    /* @__PURE__ */ jsxRuntime.jsx(
	      SidebarPanel.Header,
	      {
	        leading: /* @__PURE__ */ jsxRuntime.jsxs(DropdownMenu, { modal: false, children: [
	          /* @__PURE__ */ jsxRuntime.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(
	            "button",
	            {
	              "aria-label": "보기 옵션",
	              children: /* @__PURE__ */ jsxRuntime.jsx(SearchCode, { size: 14 })
	            }
	          ) }),
	          /* @__PURE__ */ jsxRuntime.jsxs(DropdownMenuContent, { onCloseAutoFocus: (e) => e.preventDefault(), children: [
	            /* @__PURE__ */ jsxRuntime.jsx(DropdownMenuLabel, { children: "보기 방식" }),
	            /* @__PURE__ */ jsxRuntime.jsxs(DropdownMenuRadioGroup, { value: renderMode, onValueChange: (v) => setRenderMode(v), children: [
	              /* @__PURE__ */ jsxRuntime.jsx(DropdownMenuRadioItem, { value: "stacked", children: "위/아래" }),
	              /* @__PURE__ */ jsxRuntime.jsx(DropdownMenuRadioItem, { value: "side-by-side", children: "나란히" }),
	              /* @__PURE__ */ jsxRuntime.jsx(DropdownMenuRadioItem, { value: "inline", children: "합쳐서 보기" })
	            ] })
	          ] })
	        ] }),
	        children: "Inline Diff"
	      }
	    ),
	    /* @__PURE__ */ jsxRuntime.jsx(SidebarPanel.Body, { children: tooLong ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: messageContainer, children: [
	      /* @__PURE__ */ jsxRuntime.jsx("p", { className: errorMessage, children: "욕심이 과하세요." }),
	      /* @__PURE__ */ jsxRuntime.jsxs("p", { className: descMessage, children: [
	        MaxTextLength,
	        "글자까지만..."
	      ] })
	    ] }) : !leftText && !rightText ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: messageContainer, children: /* @__PURE__ */ jsxRuntime.jsx("p", { className: descMessage, children: "선택된 텍스트 없음" }) }) : entries === null ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: messageContainer, children: /* @__PURE__ */ jsxRuntime.jsx("p", { className: descMessage, children: "아, 잠깐만요..." }) }) : /* @__PURE__ */ jsxRuntime.jsx(RenderContents, { leftText, rightText, entries, renderMode, className: "p-1" }) })
	  ] });
	}
	function RenderContents({ leftText, rightText, entries, className, renderMode }) {
	  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: clsx(content$1, className), children: renderMode === "inline" ? renderInlineDiff(entries, leftText, rightText) : RenderSplitDiff(entries, leftText, rightText, renderMode === "side-by-side" ? "row" : "col") });
	}
	function renderInlineDiff(entries, leftText, rightText) {
	  return entries.map((entry, i) => {
	    let text = "";
	    if ((entry.type === 0 || entry.type === 1) && entry.left) {
	      text = leftText.slice(entry.left.start, entry.left.end);
	    } else if (entry.type === 2 && entry.right) {
	      text = rightText.slice(entry.right.start, entry.right.end);
	    }
	    const displayText = entry.type === 0 ? text : text === "\n" ? "↵\n" : text === "	" ? "→" : text;
	    return /* @__PURE__ */ jsxRuntime.jsx("span", { className: diff({ type: entry.type }), children: displayText }, i);
	  });
	}
	function RenderSplitDiff(entries, leftText, rightText, dir = "row") {
	  function build(text, key, typeFlags) {
	    const out = [];
	    let buffer = [];
	    let currentType = null;
	    let spanIndex = 0;
	    const flush = () => {
	      if (buffer.length === 0) return;
	      const htmlContent = buffer.join("");
	      out.push(
	        /* @__PURE__ */ jsxRuntime.jsx(
	          "span",
	          {
	            className: diff({ type: currentType }),
	            dangerouslySetInnerHTML: { __html: htmlContent }
	          },
	          ++spanIndex
	        )
	      );
	      buffer = [];
	    };
	    for (const entry of entries) {
	      if (entry.type !== 0 && !(entry.type & typeFlags)) continue;
	      const seg = entry[key];
	      if (!seg) continue;
	      const segText = text.slice(seg.start, seg.end);
	      const type = entry.type;
	      if (currentType === null) currentType = type;
	      if (type !== currentType) {
	        flush();
	        currentType = type;
	      }
	      if (segText) {
	        if (entry.type !== 0 && segText === "\n") {
	          buffer.push(`<span class="${specialChar}">↵</span>
`);
	        } else if (entry.type !== 0 && segText === "	") {
	          buffer.push(`<span class="${specialChar}">→</span>`);
	        } else {
	          const escaped = segText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	          buffer.push(escaped);
	        }
	      }
	    }
	    flush();
	    return out;
	  }
	  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: clsx(splitWrapper({ dir })), children: [
	    /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
	      /* @__PURE__ */ jsxRuntime.jsx(SideTagCopyButton, { side: "left", getValue: () => leftText }),
	      " ",
	      build(leftText, "left", 1)
	    ] }),
	    /* @__PURE__ */ jsxRuntime.jsx("div", { className: splitter({ dir }) }),
	    /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
	      /* @__PURE__ */ jsxRuntime.jsx(SideTagCopyButton, { side: "right", getValue: () => rightText }),
	      " ",
	      build(rightText, "right", 2)
	    ] })
	  ] });
	}

	var container = 'ResizablePanelGroup_container__x94da50';
	var resizeHandle = createRuntimeFn({defaultClassName:'ResizablePanelGroup_resizeHandle__x94da52',variantClassNames:{direction:{horizontal:'ResizablePanelGroup_resizeHandle_direction_horizontal__x94da53',vertical:'ResizablePanelGroup_resizeHandle_direction_vertical__x94da54'},disabled:{true:'ResizablePanelGroup_resizeHandle_disabled_true__x94da55'}},defaultVariants:{},compoundVariants:[]});
	var panel = 'ResizablePanelGroup_panel__x94da56';

	const ResizablePanelGroupContext = React.createContext({
	  direction: "vertical"
	});
	const ResizablePanelRegistryContext = React.createContext(null);
	function useResizablePanelRegistry() {
	  return React.useContext(ResizablePanelRegistryContext);
	}
	const toPx = (value, available) => {
	  if (value == null) return void 0;
	  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
	  const s = String(value).trim();
	  if (s.endsWith("px")) return Math.max(0, parseFloat(s));
	  if (s.endsWith("%")) {
	    const ratio = parseFloat(s) / 100;
	    return Math.max(0, available * ratio);
	  }
	  if (/fr$/i.test(s)) return void 0;
	  const n = Number(s);
	  return Number.isFinite(n) ? Math.max(0, n) : void 0;
	};
	function ResizablePanelGroup({
	  className,
	  children,
	  direction = "vertical",
	  handlePx = 4,
	  heightPx,
	  handleClassName,
	  disabledHandleClassName,
	  ...rest
	}) {
	  const hostRef = React.useRef(null);
	  const [panels, setPanels] = React.useState([]);
	  const idCounter = React.useRef(0);
	  const register = React.useCallback((node, policy) => {
	    const full = {
	      minSize: policy.minSize ?? policy.minHeight ?? 0,
	      initialSize: policy.initialSize,
	      growWeight: policy.growWeight ?? 1,
	      shrinkPriority: policy.shrinkPriority ?? 1,
	      shrinkWeight: policy.shrinkWeight ?? 1,
	      lockAtMin: policy.lockAtMin ?? false,
	      participatesInResize: policy.participatesInResize ?? true
	    };
	    const id = ++idCounter.current;
	    setPanels((prev) => [...prev, { id, node, policy: full }]);
	    return id;
	  }, []);
	  const update = React.useCallback((_key, policy) => {
	    setPanels(
	      (prev) => prev.map((p) => {
	        if (p.id !== _key) return p;
	        return {
	          ...p,
	          policy: {
	            ...p.policy,
	            ...policy,
	            minSize: policy.minSize ?? policy.minHeight ?? p.policy.minSize,
	            initialSize: policy.initialSize ?? p.policy.initialSize,
	            growWeight: policy.growWeight ?? p.policy.growWeight,
	            shrinkPriority: policy.shrinkPriority ?? p.policy.shrinkPriority,
	            shrinkWeight: policy.shrinkWeight ?? p.policy.shrinkWeight,
	            lockAtMin: policy.lockAtMin ?? p.policy.lockAtMin,
	            participatesInResize: policy.participatesInResize ?? p.policy.participatesInResize
	          }
	        };
	      })
	    );
	  }, []);
	  const unregister = React.useCallback((_key) => {
	    setPanels((prev) => prev.filter((p) => p.id !== _key));
	  }, []);
	  const registryApi = React.useMemo(() => ({ register, update, unregister }), [register, update, unregister]);
	  const orderedPanels = React.useMemo(() => {
	    const host = hostRef.current;
	    if (!host || panels.length === 0) return panels;
	    const grid = host.firstElementChild;
	    const order = grid ? Array.from(grid.children).filter((el) => el.dataset?.resizablePanel === "true") : [];
	    const byNode = new Map(panels.map((p) => [p.node, p]));
	    const out = [];
	    for (const el of order) {
	      const p = byNode.get(el);
	      if (p) out.push(p);
	    }
	    return out;
	  }, [panels]);
	  const isVertical = direction === "vertical";
	  const handleCount = Math.max(0, orderedPanels.length - 1);
	  const handlesTotal = handleCount * handlePx;
	  const participates = orderedPanels.map((p) => p.policy.participatesInResize);
	  const growWeights = orderedPanels.map((p) => p.policy.growWeight);
	  const shrinkPriority = orderedPanels.map((p) => p.policy.shrinkPriority);
	  const shrinkWeights = orderedPanels.map((p) => p.policy.shrinkWeight);
	  const lockAtMin = orderedPanels.map((p) => p.policy.lockAtMin);
	  const getContainerMainSize = () => {
	    const el = hostRef.current;
	    if (isVertical) return heightPx ?? (el ? el.clientHeight : 0);
	    return el ? el.clientWidth : 0;
	  };
	  const getMinsPx = React.useCallback((A) => {
	    return orderedPanels.map((p) => toPx(p.policy.minSize, A) ?? 0);
	  }, [orderedPanels]);
	  const [sizes, setSizes] = React.useState([]);
	  const lastAvailableRef = React.useRef(null);
	  const ensureInit = React.useCallback(() => {
	    if (sizes.length === orderedPanels.length && sizes.every((v) => v > 0)) return sizes;
	    const total = getContainerMainSize();
	    if (total <= 0) return sizes;
	    const A = Math.max(0, total - handlesTotal);
	    const minsPx = getMinsPx(A);
	    const initialPxArr = orderedPanels.map((p) => toPx(p.policy.initialSize, A));
	    const knownSum = initialPxArr.reduce((acc, v) => acc + (v ?? 0), 0);
	    let remain = Math.max(0, A - knownSum);
	    const unknownIdx = initialPxArr.map((v, i) => v == null ? i : -1).filter((i) => i >= 0);
	    if (unknownIdx.length) {
	      const W = unknownIdx.reduce((acc, i) => acc + (growWeights[i] ?? 1), 0) || 1;
	      for (const i of unknownIdx) {
	        initialPxArr[i] = (growWeights[i] ?? 1) / W * remain;
	      }
	    } else if (remain > 0 && knownSum > 0) {
	      const base = knownSum || 1;
	      for (let i = 0; i < initialPxArr.length; i++) {
	        initialPxArr[i] = (initialPxArr[i] ?? 0) + (initialPxArr[i] ?? 0) / base * remain;
	      }
	    }
	    const seeded = initialPxArr.map((v, i) => Math.max(v ?? 0, minsPx[i]));
	    return fitToTotal(seeded, minsPx, A);
	  }, [sizes, orderedPanels, handlesTotal, growWeights, getContainerMainSize, getMinsPx]);
	  const minsRawSig = orderedPanels.map((p) => String(p.policy.minSize)).join("|");
	  const initRawSig = orderedPanels.map((p) => String(p.policy.initialSize ?? "")).join("|");
	  React.useEffect(() => {
	    if (orderedPanels.length === 0) return;
	    const A = Math.max(0, getContainerMainSize() - handlesTotal);
	    const minsPx = getMinsPx(A);
	    setSizes(
	      (prev) => resizeByPolicy(prev.length ? prev : ensureInit(), minsPx, A, lastAvailableRef, {
	        growWeights,
	        participates,
	        shrinkPriority,
	        shrinkWeights,
	        lockAtMin
	      })
	    );
	  }, [
	    orderedPanels,
	    // 순서/DOM 재배열 반응
	    handlesTotal,
	    growWeights.join(","),
	    participates.join(","),
	    shrinkPriority.join(","),
	    shrinkWeights.join(","),
	    lockAtMin.join(","),
	    minsRawSig,
	    initRawSig,
	    heightPx,
	    direction
	  ]);
	  React.useEffect(() => {
	    if (isVertical && heightPx != null) return;
	    const el = hostRef.current;
	    if (!el) return;
	    const ro = new ResizeObserver((entries) => {
	      for (const entry of entries) {
	        const main = Math.floor(isVertical ? entry.contentRect.height : entry.contentRect.width);
	        const A = Math.max(0, main - handlesTotal);
	        const minsPx = getMinsPx(A);
	        setSizes(
	          (prev) => resizeByPolicy(prev.length ? prev : ensureInit(), minsPx, A, lastAvailableRef, {
	            growWeights,
	            participates,
	            shrinkPriority,
	            shrinkWeights,
	            lockAtMin
	          })
	        );
	      }
	    });
	    ro.observe(el);
	    return () => ro.disconnect();
	  }, [
	    isVertical,
	    heightPx,
	    handlesTotal,
	    ensureInit,
	    growWeights.join(","),
	    participates.join(","),
	    shrinkPriority.join(","),
	    shrinkWeights.join(","),
	    lockAtMin.join(","),
	    minsRawSig,
	    initRawSig
	  ]);
	  const dragInfo = React.useRef(null);
	  const onHandleDown = (e) => {
	    e.preventDefault();
	    const inited = ensureInit();
	    setSizes(inited);
	    const handleEl = e.currentTarget;
	    const grid = handleEl.parentElement;
	    if (!grid) return;
	    let prev = handleEl.previousElementSibling;
	    while (prev && prev.dataset?.resizablePanel !== "true") {
	      prev = prev.previousElementSibling;
	    }
	    if (!prev) return;
	    const panelEls = Array.from(grid.children).filter(
	      (el) => el.dataset?.resizablePanel === "true"
	    );
	    const i = panelEls.indexOf(prev);
	    if (i < 0) return;
	    const startPos = isVertical ? e.clientY ?? 0 : e.clientX ?? 0;
	    dragInfo.current = { index: i, startPos, startSizes: [...inited] };
	    const onMove = (ev) => {
	      const info = dragInfo.current;
	      if (!info) return;
	      const curr = isVertical ? ev.clientY : ev.clientX;
	      const d = curr - info.startPos;
	      const idx = info.index;
	      const A = Math.max(0, getContainerMainSize() - handlesTotal);
	      const minsPx = getMinsPx(A);
	      const aboveMin = minsPx[idx];
	      const belowMin = minsPx[idx + 1];
	      const startAbove = info.startSizes[idx];
	      const startBelow = info.startSizes[idx + 1];
	      const newAbove = Math.max(aboveMin, startAbove + d);
	      const deltaApplied = newAbove - startAbove;
	      const newBelow = Math.max(belowMin, startBelow - deltaApplied);
	      const sumPair = startAbove + startBelow;
	      const finalBelow = Math.max(belowMin, newBelow);
	      const finalAbove = Math.max(aboveMin, sumPair - finalBelow);
	      setSizes((prev2) => {
	        const next = [...prev2];
	        next[idx] = finalAbove;
	        next[idx + 1] = finalBelow;
	        return next;
	      });
	    };
	    const onUp = () => {
	      window.removeEventListener("mousemove", onMove);
	      window.removeEventListener("mouseup", onUp);
	      dragInfo.current = null;
	    };
	    window.addEventListener("mousemove", onMove);
	    window.addEventListener("mouseup", onUp);
	  };
	  const templateStyle = React.useMemo(() => {
	    const s = ensureInit();
	    const parts = [];
	    const total = getContainerMainSize();
	    const A = Math.max(0, total - handlesTotal);
	    const minsPx = getMinsPx(A);
	    const sumMins = minsPx.reduce((a, b) => a + b, 0);
	    const undersized = total > 0 && sumMins + handlesTotal > total;
	    const base = undersized ? minsPx : s.map((px, i) => Math.max(px, minsPx[i]));
	    base.forEach((px, idx) => {
	      parts.push(`${Math.max(px, minsPx[idx])}px`);
	      if (idx < orderedPanels.length - 1) parts.push(`${handlePx}px`);
	    });
	    return isVertical ? { gridTemplateRows: parts.join(" ") } : { gridTemplateColumns: parts.join(" ") };
	  }, [sizes, orderedPanels.length, handlePx, heightPx, direction, getContainerMainSize, getMinsPx, minsRawSig, initRawSig]);
	  const allAtMin = React.useMemo(() => {
	    const s = ensureInit();
	    const A = Math.max(0, getContainerMainSize() - handlesTotal);
	    const minsPx = getMinsPx(A);
	    return s.every((v, i) => Math.abs(v - minsPx[i]) < 0.5);
	  }, [sizes, direction, heightPx, orderedPanels.length, getContainerMainSize, getMinsPx, minsRawSig]);
	  const handleStyle = { "--handle-size": handlePx + "px" };
	  const gridOverflow = isVertical ? { overflowY: "auto" } : { overflowX: "auto" };
	  return /* @__PURE__ */ jsxRuntime.jsx(ResizablePanelGroupContext.Provider, { value: { direction }, children: /* @__PURE__ */ jsxRuntime.jsx(ResizablePanelRegistryContext.Provider, { value: registryApi, children: /* @__PURE__ */ jsxRuntime.jsx("div", { ref: hostRef, className: clsx(container, className), ...rest, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: container, style: { display: "grid", ...templateStyle, ...gridOverflow }, children: (() => {
	    const valid = [];
	    React.Children.forEach(children, (child) => {
	      if (React.isValidElement(child)) valid.push(child);
	    });
	    const out = [];
	    valid.forEach((child, idx) => {
	      out.push(
	        React.cloneElement(child, {
	          key: child.key ?? `panel-${idx}`,
	          "data-resizable-panel": "true"
	          // NOTE: visual styles for panel items should be provided by the child component itself.
	        })
	      );
	      if (idx < valid.length - 1) {
	        out.push(
	          /* @__PURE__ */ jsxRuntime.jsx(
	            "div",
	            {
	              role: "separator",
	              "aria-orientation": isVertical ? "horizontal" : "vertical",
	              onMouseDown: onHandleDown,
	              className: clsx(resizeHandle({ direction }), allAtMin ? disabledHandleClassName : handleClassName),
	              style: handleStyle
	            },
	            `handle-${idx}`
	          )
	        );
	      }
	    });
	    return out;
	  })() }) }) }) });
	}
	function resizeByPolicy(current, mins, targetTotal, lastAvailableRef, opts) {
	  const prev = lastAvailableRef.current;
	  lastAvailableRef.current = targetTotal;
	  if (!current.length) return current;
	  if (prev == null || prev <= 0) return fitToTotal(current, mins, targetTotal);
	  const delta = targetTotal - prev;
	  if (Math.abs(delta) < 0.5) return fitToTotal(current, mins, targetTotal);
	  if (delta > 0) return grow(current, mins, delta, opts);
	  return shrink(current, mins, -delta, opts);
	}
	function grow(cur, mins, extra, { growWeights, participates }) {
	  const n = cur.length;
	  const next = [...cur];
	  const elig = Array.from({ length: n }, (_, i) => participates[i] && (growWeights[i] ?? 1) > 0 ? i : -1).filter((i) => i >= 0);
	  if (!elig.length) return fitToTotal(next, mins, cur.reduce((a, b) => a + b, 0) + extra);
	  const W = elig.reduce((a, i) => a + (growWeights[i] ?? 1), 0) || 1;
	  for (const i of elig) {
	    const give = (growWeights[i] ?? 1) / W * extra;
	    next[i] = Math.max(mins[i], next[i] + give);
	  }
	  return fitToTotal(next, mins, cur.reduce((a, b) => a + b, 0) + extra);
	}
	function shrink(cur, mins, lack, { shrinkPriority, shrinkWeights, lockAtMin }) {
	  const n = cur.length;
	  let next = [...cur];
	  let need = lack;
	  const entries = Array.from({ length: n }, (_, i) => ({ i, prio: shrinkPriority[i] ?? 1 }));
	  entries.sort((a, b) => a.prio - b.prio);
	  for (let g = 0; g < entries.length && need > 0.5; ) {
	    const pr = entries[g].prio;
	    const group = [];
	    while (g < entries.length && entries[g].prio === pr) {
	      group.push(entries[g].i);
	      g++;
	    }
	    const cand = group.filter((i) => lockAtMin[i] ? next[i] - mins[i] > 0.5 : true).filter((i) => next[i] - mins[i] > 0.5);
	    if (!cand.length) continue;
	    const totalSlack = cand.reduce((a, i) => a + Math.max(0, next[i] - mins[i]), 0);
	    const W = cand.reduce((a, i) => a + (shrinkWeights[i] ?? 1), 0) || 1;
	    const take = Math.min(need, totalSlack);
	    for (const i of cand) {
	      const ratio = (shrinkWeights[i] ?? 1) / W;
	      const cut = Math.min(next[i] - mins[i], take * ratio);
	      next[i] -= cut;
	      need -= cut;
	    }
	  }
	  const target = Math.max(0, next.reduce((a, b) => a + b, 0) - need);
	  return fitToTotal(next, mins, target);
	}
	function fitToTotal(h, mins, target) {
	  const n = h.length;
	  if (!n) return h;
	  let out = h.map((v, i) => Math.max(v || mins[i], mins[i]));
	  const sum = out.reduce((a, b) => a + b, 0);
	  if (Math.abs(sum - target) < 0.5) return out;
	  if (sum > target) {
	    const surplusArr = out.map((v, i) => Math.max(0, v - mins[i]));
	    const surplus = surplusArr.reduce((a, b) => a + b, 0);
	    if (surplus <= 0.5) return out;
	    const need = sum - target;
	    const ratio = Math.min(1, need / surplus);
	    out = out.map((v, i) => Math.max(mins[i], v - surplusArr[i] * ratio));
	    return out;
	  } else {
	    const need = target - sum;
	    const totalNow = sum || 1;
	    out = out.map((v) => v + v / totalNow * need);
	    return out;
	  }
	}

	const ResizablePanelRoot = React.forwardRef(function ResizablePanelRoot2({
	  className,
	  children,
	  // PanelPolicy (px | % 지원, number는 px 간주)
	  minSize,
	  initialSize,
	  growWeight = 1,
	  shrinkPriority = 1,
	  shrinkWeight = 1,
	  lockAtMin = false,
	  participatesInResize = true,
	  ...props
	}, ref) {
	  const hostRef = React.useRef(null);
	  React.useImperativeHandle(ref, () => hostRef.current, []);
	  const registry = useResizablePanelRegistry();
	  const regKeyRef = React.useRef(null);
	  React.useEffect(() => {
	    if (!registry || !hostRef.current) return;
	    const key = registry.register(hostRef.current, {
	      minSize,
	      initialSize,
	      growWeight,
	      shrinkPriority,
	      shrinkWeight,
	      lockAtMin,
	      participatesInResize
	    });
	    regKeyRef.current = key;
	    return () => {
	      if (regKeyRef.current != null) registry.unregister(regKeyRef.current);
	      regKeyRef.current = null;
	    };
	  }, []);
	  React.useEffect(() => {
	    if (!registry || regKeyRef.current == null) return;
	    registry.update(regKeyRef.current, {
	      minSize,
	      initialSize,
	      growWeight,
	      shrinkPriority,
	      shrinkWeight,
	      lockAtMin,
	      participatesInResize
	    });
	  }, [
	    registry,
	    minSize,
	    initialSize,
	    growWeight,
	    shrinkPriority,
	    shrinkWeight,
	    lockAtMin,
	    participatesInResize
	  ]);
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    "div",
	    {
	      ref: hostRef,
	      role: "region",
	      className: clsx(panel, className),
	      ...props,
	      children
	    }
	  );
	});
	const ResizablePanel = ResizablePanelRoot;

	var root$1 = 'AppSidebar_root__1nmrnq00';

	var root = 'FetishBar_root__1yvtfh00';
	var buttons = 'FetishBar_buttons__1yvtfh01';
	var rightButtons = 'FetishBar_rightButtons__1yvtfh02 FetishBar_buttons__1yvtfh01';

	var group = createRuntimeFn({defaultClassName:'ToggleGroup_group__1yharhu0',variantClassNames:{variant:{'default':'ToggleGroup_group_variant_default__1yharhu1',outline:'ToggleGroup_group_variant_outline__1yharhu2',primary:'ToggleGroup_group_variant_primary__1yharhu3'},size:{xs:'ToggleGroup_group_size_xs__1yharhu4',sm:'ToggleGroup_group_size_sm__1yharhu5','default':'ToggleGroup_group_size_default__1yharhu6',lg:'ToggleGroup_group_size_lg__1yharhu7'}},defaultVariants:{variant:'default',size:'default'},compoundVariants:[]});
	var itemAdjust = 'ToggleGroup_itemAdjust__1yharhu8';

	var toggle = createRuntimeFn({defaultClassName:'Toggle_toggle__ruo0ma0',variantClassNames:{variant:{'default':'Toggle_toggle_variant_default__ruo0ma1',outline:'Toggle_toggle_variant_outline__ruo0ma2',primary:'Toggle_toggle_variant_primary__ruo0ma3'},size:{xs:'Toggle_toggle_size_xs__ruo0ma4',sm:'Toggle_toggle_size_sm__ruo0ma5','default':'Toggle_toggle_size_default__ruo0ma6',lg:'Toggle_toggle_size_lg__ruo0ma7'}},defaultVariants:{variant:'default',size:'default'},compoundVariants:[]});

	const ToggleGroupContext = React__namespace.createContext({
	  size: "default",
	  variant: "default"
	});
	function ToggleGroup({
	  className,
	  variant = "default",
	  size = "default",
	  children,
	  ...props
	}) {
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    ToggleGroupPrimitive__namespace.Root,
	    {
	      "data-slot": "toggle-group",
	      "data-variant": variant,
	      "data-size": size,
	      className: clsx(group({ variant, size }), className),
	      ...props,
	      children: /* @__PURE__ */ jsxRuntime.jsx(ToggleGroupContext.Provider, { value: { variant, size }, children })
	    }
	  );
	}
	function ToggleGroupItem({
	  className,
	  children,
	  variant,
	  size,
	  ...props
	}) {
	  const ctx = React__namespace.useContext(ToggleGroupContext);
	  const v = ctx.variant ?? variant ?? "default";
	  const s = ctx.size ?? size ?? "default";
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    ToggleGroupPrimitive__namespace.Item,
	    {
	      "data-slot": "toggle-group-item",
	      "data-variant": v,
	      "data-size": s,
	      className: clsx(
	        // 개별 토글의 시각(색/상태/크기)은 Toggle recipe 재사용
	        toggle({ variant: v, size: s }),
	        // 그룹 안에서만 필요한 보정(rounded-none, focus z, border join)
	        itemAdjust,
	        className
	      ),
	      ...props,
	      children
	    }
	  );
	}

	function Toggle({
	  className,
	  variant = "default",
	  size = "default",
	  ...props
	}) {
	  return /* @__PURE__ */ jsxRuntime.jsx(
	    TogglePrimitive__namespace.Root,
	    {
	      "data-slot": "toggle",
	      className: clsx(toggle({ variant, size }), className),
	      ...props
	    }
	  );
	}

	function FetishBar({}) {
	  const [syncMode, setSyncMode] = jotai.useAtom(syncModeAtom);
	  const [whitespaceHandling, setWhitespaceHandling] = jotai.useAtom(whitespaceHandlingAtom);
	  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: clsx(root), style: {
	    // "--accent": "var(--primary)",
	    // "--accent-foreground": "var(--primary-foreground)"
	  }, children: [
	    /* @__PURE__ */ jsxRuntime.jsx("div", { className: clsx(buttons), children: /* @__PURE__ */ jsxRuntime.jsx(Toggle, { pressed: syncMode, onPressedChange: setSyncMode, size: "xs", children: /* @__PURE__ */ jsxRuntime.jsx(BookOpen, {}) }) }),
	    /* @__PURE__ */ jsxRuntime.jsx("div", { className: clsx(rightButtons), children: /* @__PURE__ */ jsxRuntime.jsx(ModeSelector, { value: whitespaceHandling, onChange: (v) => setWhitespaceHandling(v) }) })
	  ] });
	}
	function ModeSelector({ value, onChange }) {
	  const onValueChange = React.useCallback((v) => v && onChange(v), [onChange]);
	  return /* @__PURE__ */ jsxRuntime.jsxs(ToggleGroup, { variant: "default", type: "single", size: "xs", value, onValueChange, className: "", style: {
	    "--accent": "var(--primary)",
	    "--accent-foreground": "var(--primary-foreground)"
	  }, children: [
	    /* @__PURE__ */ jsxRuntime.jsx(ToggleGroupItem, { value: "ignore", "aria-label": "Ignore whitespace", title: "Ignore whitespace", children: /* @__PURE__ */ jsxRuntime.jsx(EqualApproximately, { size: 14 }) }),
	    /* @__PURE__ */ jsxRuntime.jsx(ToggleGroupItem, { value: "onlyAtEdge", "aria-label": "Ignore whitespace only at edge", title: "Ignore whitespace only at edge", children: /* @__PURE__ */ jsxRuntime.jsx(WrapText, { size: 14 }) }),
	    /* @__PURE__ */ jsxRuntime.jsx(ToggleGroupItem, { value: "normalize", "aria-label": "Normalize whitespace", title: "Normalize whitespace", children: /* @__PURE__ */ jsxRuntime.jsx(Space, { size: 14 }) })
	  ] });
	}

	function AppSidebar() {
	  return /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: clsx(root$1), children: [
	    /* @__PURE__ */ jsxRuntime.jsxs(ResizablePanelGroup, { direction: "vertical", children: [
	      /* @__PURE__ */ jsxRuntime.jsx(ResizablePanel, { initialSize: "50%", minSize: 25, children: /* @__PURE__ */ jsxRuntime.jsx(DiffListPanel, {}) }),
	      /* @__PURE__ */ jsxRuntime.jsx(ResizablePanel, { initialSize: "25%", minSize: 25, children: /* @__PURE__ */ jsxRuntime.jsx(TrailViewPanel, {}) }),
	      /* @__PURE__ */ jsxRuntime.jsx(ResizablePanel, { initialSize: "25%", minSize: 25, children: /* @__PURE__ */ jsxRuntime.jsx(InlineDiffViewPanel, {}) })
	    ] }),
	    /* @__PURE__ */ jsxRuntime.jsx(FetishBar, {})
	  ] });
	}

	function matchesShortcut(event, shortcut) {
	  const parts = shortcut.split("+");
	  const key = parts[parts.length - 1];
	  const hasCtrl = parts.includes("Ctrl");
	  const hasAlt = parts.includes("Alt");
	  const hasShift = parts.includes("Shift");
	  const hasMeta = parts.includes("Meta") || parts.includes("Cmd");
	  return event.key === key && event.ctrlKey === hasCtrl && event.altKey === hasAlt && event.shiftKey === hasShift && event.metaKey === hasMeta;
	}
	function useKeyboardShortcuts() {
	  const { diffController, leftEditor, rightEditor } = useDiffControllerContext();
	  const setEditorLayout = jotai.useSetAtom(editorPanelLayoutAtom);
	  React.useEffect(() => {
	    const handleKeyDown = (e) => {
	      if (matchesShortcut(e, KEYBOARD_SHORTCUTS.TOGGLE_SYNC_MODE)) {
	        e.preventDefault();
	        diffController.syncMode = !diffController.syncMode;
	        return;
	      }
	      if (matchesShortcut(e, KEYBOARD_SHORTCUTS.TOGGLE_LAYOUT)) {
	        e.preventDefault();
	        setEditorLayout((current) => current === "horizontal" ? "vertical" : "horizontal");
	        diffController.alignEditors();
	        diffController.renderer.invalidateAll();
	        return;
	      }
	      if (matchesShortcut(e, KEYBOARD_SHORTCUTS.PASTE_BOMB_LEFT)) {
	        e.preventDefault();
	        leftEditor.pasteBomb();
	        return;
	      }
	      if (matchesShortcut(e, KEYBOARD_SHORTCUTS.PASTE_BOMB_RIGHT)) {
	        e.preventDefault();
	        rightEditor.pasteBomb();
	        return;
	      }
	      if (matchesShortcut(e, KEYBOARD_SHORTCUTS.CLEAR_ALL_CONTENT)) {
	        e.preventDefault();
	        (async () => {
	          await leftEditor.setContent({ text: "", asHTML: false });
	          await rightEditor.setContent({ text: "", asHTML: false });
	        })();
	        return;
	      }
	    };
	    window.addEventListener("keydown", handleKeyDown);
	    return () => {
	      window.removeEventListener("keydown", handleKeyDown);
	    };
	  }, [diffController, leftEditor, rightEditor, setEditorLayout]);
	}

	var appLayout = 'App_appLayout__1bg21ve0';

	const store = jotai.getDefaultStore();
	function App() {
	  const { diffController, leftEditor, rightEditor } = useDiffControllerContext();
	  const syncMode = jotai.useAtomValue(syncModeAtom);
	  const isInitialized = React.useRef(false);
	  useKeyboardShortcuts();
	  React.useEffect(() => {
	    if (isInitialized.current) return;
	    const initializeApp = async () => {
	      try {
	        await new Promise((resolve) => setTimeout(resolve, 0));
	        await loadDemoContent();
	        isInitialized.current = true;
	        console.log(APP_MESSAGES.INIT_SUCCESS);
	      } catch (error) {
	        console.error(APP_MESSAGES.INIT_ERROR, error);
	      }
	    };
	    initializeApp();
	  }, [diffController]);
	  const loadDemoContent = async () => {
	    {
	      await loadFallbackContent();
	    }
	  };
	  const loadFallbackContent = async () => {
	    const leftContent = `<p><img src="file:///D:/KINGrinderK6_Settings.png" /></p>`;
	    const rightContent = `<p><img src="file:///D:/KINGrinderK6_Settings2.png" /></p>`;
	    await leftEditor.setContent({ text: leftContent, asHTML: true });
	    await rightEditor.setContent({ text: rightContent, asHTML: true });
	  };
	  React.useEffect(() => {
	    const unsubscribe = [];
	    unsubscribe.push(diffController.onDiffWorkflowStart(() => {
	    }));
	    unsubscribe.push(diffController.onDiffComputing((_e) => {
	    }));
	    unsubscribe.push(diffController.onDiffWorkflowDone((_diffContext) => {
	    }));
	    unsubscribe.push(diffController.onSyncModeChange((syncMode2) => {
	      store.set(syncModeAtom, syncMode2);
	    }));
	    unsubscribe.push(diffController.onDiffVisibilityChanged((_changes) => {
	      store.set(visibleDiffsAtom, diffController.getVisibleDiffs());
	    }));
	    unsubscribe.push(diffController.onHoveredDiffIndexChange((_diffIndex) => {
	    }));
	    unsubscribe.push(diffController.onTextSelection((e) => {
	      store.set(editorTextSelectionAtom, e.selection ?? null);
	    }));
	    unsubscribe.push(store.sub(hoveredDiffIndexAtom, () => {
	    }));
	    return () => {
	      for (const off of unsubscribe) off();
	    };
	  }, [diffController]);
	  React.useEffect(() => {
	    diffController.syncMode = syncMode;
	  }, [diffController, syncMode]);
	  return /* @__PURE__ */ jsxRuntime.jsx("div", { children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: clsx(appLayout), children: /* @__PURE__ */ jsxRuntime.jsxs(ResizablePanelGroup, { direction: "horizontal", children: [
	    /* @__PURE__ */ jsxRuntime.jsx(ResizablePanel, { minSize: UI_CONSTANTS.MAIN_PANEL_MIN_SIZE, children: /* @__PURE__ */ jsxRuntime.jsx(EditorPanel, {}) }, "main"),
	    /* @__PURE__ */ jsxRuntime.jsx(ResizablePanel, { minSize: UI_CONSTANTS.SIDEBAR_MIN_SIZE, initialSize: UI_CONSTANTS.SIDEBAR_INITIAL_SIZE, children: /* @__PURE__ */ jsxRuntime.jsx(AppSidebar, {}) }, "side")
	  ] }) }) });
	}

	client.createRoot(document.getElementById("root")).render(
	  /* @__PURE__ */ jsxRuntime.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntime.jsx(DiffControllerProvider, { children: /* @__PURE__ */ jsxRuntime.jsx(App, {}) }) })
	);

})(Vendor.ReactJSXRuntime, Vendor.ReactDOM, Vendor.React, Vendor.clsx, Vendor.jotai, Vendor.jotaiUtils, Vendor.RadixUI.Slot, Vendor.VanillaExtractDynamic, Vendor.RadixUI.DropdownMenuPrimitive, Vendor.RadixUI.ToggleGroupPrimitive, Vendor.RadixUI.TogglePrimitive);
