const enum InsertionPointFlags {
	// FirstChild = 1 << 0, // 첫번째 자식 1
	// LastChild = 1 << 1, // 마지막 자식 2
	BeforeTable = 1 << 2, // 테이블 이전 4
	AfterTable = 1 << 3, // 테이블 다음 8
	ContainerStart = 1 << 4, // 컨테이너 시작 16
	ContainerEnd = 1 << 5, // 컨테이너 끝 32
	BlockStart = 1 << 6, // 블럭 시작 64
	BlockEnd = 1 << 7, // 블럭 끝 128
	TableCellStart = 1 << 8, // 테이블 셀 시작 256
	TableCellEnd = 1 << 9, // 테이블 셀 끝 512
	TableRowStart = 1 << 10, // 테이블 행 시작 1024
	TableRowEnd = 1 << 11, // 테이블 행 끝 2048
	LineStart = 1 << 12, // 줄 시작 4096
	LineEnd = 1 << 13, // 줄 끝 8192
}

type EditorCallbacks = {
	onDiffVisibilityChanged: (entries: VisibilityChangeEntry[]) => void;
	onTextChanged: () => void;
	onScroll: (scrollTop: number, scrollLeft: number) => void;
};

type VisibilityChangeEntry = {
	item: number | string;
	isVisible: boolean;
};

type DiffItem = {
	tokenIndex: number;
	tokenCount: number;
	flags: number;
	preferBlockStart: boolean;
	preferBlockEnd: boolean;
};

const enum DiffFlags {
	PreferBlockStart = 1 << 0,
	PreferBlockEnd = 1 << 1,
	PreferAfterTable = 1 << 2,
	PreferBeforeTable = 1 << 3,
}

type DiffRenderItem2 = {
	ranges: Range[];
	fill: string;
	stroke: string;
	geometry: RectSet | null;
};

type AnchorItem = {
	tokenIndex?: number;
	diffIndex?: number;
	type: "start" | "end";
};

const TEXT_SELECTION_HIGHLIGHT_FILL_STYLE = "hsl(210 100% 40%)";

/*
contenteditable 요소에 임의로 앵커 같은 태그를 삽입하거나 제거하는 것은 가능하지만
어떤 경우에도 텍스트노드 자체를 조작하면 안됨!
 - 텍스트노드를 다른 요소로 감싸거나
 - 텍스트노드를 다른 위치로 이동시키거나
 - 텍스트노드를 쪼개서 사이에 태그를 집어넣거나
 - 등등
모두 재앙으로 가는 길임.

태그를 삽입할 때에도 절대 태그가 텍스트를 가져서는 안됨.
눈에 보이지 않는 zws 같은 것도 실제로는 문자가 존재하기 때문에 지우거나 커서를 이동할 때 키를 한번 더 눌러야되고
다른 텍스트 노드에 묻어버리면 짜증남.

참고: 삽입하는 태그에 contenteditable="false" 속성을 넣어버리면 커서가 제대로 통과하지 못함.
*/
function createEditor(container: HTMLElement, editorName: "left" | "right", callbacks: EditorCallbacks) {
	const { onDiffVisibilityChanged, onScroll, onTextChanged } = callbacks;

	const _visibleAnchors = new Set<HTMLElement>();
	const _visibleDiffIndices = new Set<number>();

	const _tokens: RichToken[] = [];
	const _diffRanges: Range[] = [];

	//const _ranges: Range[] = [];
	const _diffRenderItems: DiffRenderItem2[] = [];
	const _diffLineRects: Rect[] = [];
	const _diffVisibilities: boolean[] = [];
	const _anchorElements: HTMLElement[] = [];
	const _diffAnchorElements: HTMLElement[] = [];

	let _diffRectsDirty = true;
	let _hasRenderedAny = false;
	let _editMode = false;
	let _canvasWidth = 0;
	let _canvasHeight = 0;
	let _canvasOffsetX = 0;
	let _canvasOffsetY = 0;

	const wrapper = document.createElement("div");
	wrapper.id = editorName + "EditorWrapper";
	wrapper.classList.add("editor-wrapper");

	const INITIAL_EDITOR_HTML = document.createElement("P");
	INITIAL_EDITOR_HTML.appendChild(document.createElement("BR"));
	const editor = document.createElement("div");
	editor.id = editorName + "Editor";
	editor.classList.add("editor");
	editor.contentEditable = "true";
	editor.spellcheck = false;
	if (true) {
		// editor.innerHTML = `<table><tbody><tr><td><p>하나 은행</p></td><td><p>국민 은행</p></td><td><p>신한 은행</p></td></tr><tr><td><p>산업 은행</p></td><td><p>카카오 뱅크</p></td><td rowspan="2"><p>케이 뱅크</p></td></tr><tr><td><p>우리 은행</p></td><td><p>우체국</p></td></tr></tbody></table>hello`;
		if (editorName === "right") {
			const WTF = false;
			if (WTF) {
				editor.innerHTML = `<table border="1">
  <tr>
    <td>
      <h2>1. 서론</h2>
      <p></p>
      <p></p>
      <p></p>
      <p></p>

      <h2>2. 배경</h2>
      <p></p>
      <p></p>
      <p></p>
      <p></p>
      <p></p>
      <p></p>
      <p></p>

      <h2>3. 시스템 구성</h2>
      <p></p>
      <p></p>
      <p></p>
      <p></p>
      <p></p>
      <p></p>
      <p></p>
      <p></p>

      <h2>4. 적용 사례</h2>
      <p></p>
      <p></p>
      <p></p>

      <h2>5. 결론</h2>
      <p></p>
      <p></p>
    </td>
    <td>
      <p>이 문서는 문서 비교 시스템을 테스트하기 위해 작성되었습니다.</p>
      <p>문서 간의 차이점을 정확하게 파악하고, 시각적으로 비교할 수 있는 기능이 요구됩니다.</p>
      <p>비교 알고리즘의 성능 및 정밀도도 주요한 관심사입니다.</p>
      <p>테스트 환경을 위한 충분한 입력이 필요합니다.</p>

      <h3>가. 기존 방법의 한계</h3>
      <p>수작업 비교는 시간 소모적이며 오류 발생 확률이 높습니다.</p>

      <h3>나. 자동화 필요성</h3>
      <p>자동화된 비교는 일관성 있는 결과를 제공합니다.</p>
      <p>생산성과 정확성을 동시에 높일 수 있습니다.</p>

      <h3>가. 입력</h3>
      <p>HTML 문서를 입력받아 필요한 내용만 추출합니다.</p>

      <h3>나. 전처리</h3>
      <p>토큰화와 스타일 제거 등 필요한 정리를 수행합니다.</p>
      <p>앵커 삽입을 통해 위치 추적이 가능해집니다.</p>

      <h3>다. 비교</h3>
      <p>구조 및 텍스트 내용을 비교하여 차이점을 시각화합니다.</p>
      <p>좌우 에디터 간 정렬 기준이 중요합니다.</p>

      <h3>가. 법률 문서</h3>
      <p>법령 개정안 비교에 효과적입니다.</p>

      <h3>나. 논문 버전</h3>
      <p>버전 간 변경점이 많아 정밀한 비교가 요구됩니다.</p>
      <p>단락 이동, 삽입/삭제 감지를 지원해야 합니다.</p>

      <p>시스템 정밀도, 속도, 직관적인 UI는 핵심 요소입니다.</p>
      <p>지속적인 테스트와 개선이 필요합니다.</p>
    </td>
  </tr>
</table>

`;
			} else {
				editor.innerHTML = `<table style="width: 100%; table-layout: fixed; border-collapse: collapse;" border="1">
  <tr>
    <td style="vertical-align: top; width: 25%;">
      <h2>1. 서론</h2>
    </td>
    <td>
      <p>이 문서는 문서 비교 시스템을 테스트하기 위해 작성되었습니다.</p>
      <p>문서 간의 차이점을 정확하게 파악하고, 시각적으로 비교할 수 있는 기능이 요구됩니다.</p>
      <p>비교 알고리즘의 성능 및 정밀도도 주요한 관심사입니다.</p>
      <p>테스트 환경을 위한 충분한 입력이 필요합니다.</p>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top;">
      <h2>2. 배경</h2>
    </td>
    <td>
      <h3>가. 기존 방법의 한계</h3>
      <p>수작업 비교는 시간 소모적이며 오류 발생 확률이 높습니다.</p>

      <h3>나. 자동화 필요성</h3>
      <p>자동화된 비교는 일관성 있는 결과를 제공합니다.</p>
      <p>생산성과 정확성을 동시에 높일 수 있습니다.</p>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top;">
      <h2>3. 시스템 구성</h2>
    </td>
    <td>
      <h3>가. 입력</h3>
      <p>HTML 문서를 입력받아 필요한 내용만 추출합니다.</p>

      <h3>나. 전처리</h3>
      <p>토큰화와 스타일 제거 등 필요한 정리를 수행합니다.</p>
      <p>앵커 삽입을 통해 위치 추적이 가능해집니다.</p>

      <h3>다. 비교</h3>
      <p>구조 및 텍스트 내용을 비교하여 차이점을 시각화합니다.</p>
      <p>좌우 에디터 간 정렬 기준이 중요합니다.</p>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top;">
      <h2>4. 적용 사례</h2>
    </td>
    <td>
      <h3>가. 법률 문서</h3>
      <p>법령 개정안 비교에 효과적입니다.</p>

      <h3>나. 논문 버전</h3>
      <p>버전 간 변경점이 많아 정밀한 비교가 요구됩니다.</p>
      <p>단락 이동, 삽입/삭제 감지를 지원해야 합니다.</p>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top;">
      <h2>5. 결론</h2>
    </td>
    <td>
      <p>시스템 정밀도, 속도, 직관적인 UI는 핵심 요소입니다.</p>
      <p>지속적인 테스트와 개선이 필요합니다.</p>
    </td>
  </tr>
</table>

`;
			}
		} else {
			editor.innerHTML = `<div>
  <h2>1. 서론</h2>
  <p>이 문서는 문서 비교 시스템을 테스트하기 위해 작성되었습니다.</p>
  <p>문서 간의 차이점을 정확하게 파악하고, 시각적으로 비교할 수 있는 기능이 요구됩니다.</p>
  <p>비교 알고리즘의 성능 및 정밀도도 주요한 관심사입니다.</p>
  <p>테스트 환경을 위한 충분한 입력이 필요합니다.</p>

  <h2>2. 배경</h2>
  <h3>가. 기존 방법의 한계</h3>
  <p>수작업 비교는 시간 소모적이며 오류 발생 확률이 높습니다.</p>

  <h3>나. 자동화 필요성</h3>
  <p>자동화된 비교는 일관성 있는 결과를 제공합니다.</p>
  <p>생산성과 정확성을 동시에 높일 수 있습니다.</p>

  <h2>3. 시스템 구성</h2>
  <h3>가. 입력</h3>
  <p>HTML 문서를 입력받아 필요한 내용만 추출합니다.</p>

  <h3>나. 전처리</h3>
  <p>토큰화와 스타일 제거 등 필요한 정리를 수행합니다.</p>
  <p>앵커 삽입을 통해 위치 추적이 가능해집니다.</p>

  <h3>다. 비교</h3>
  <p>구조 및 텍스트 내용을 비교하여 차이점을 시각화합니다.</p>
  <p>좌우 에디터 간 정렬 기준이 중요합니다.</p>

  <h2>4. 적용 사례</h2>
  <h3>가. 법률 문서</h3>
  <p>법령 개정안 비교에 효과적입니다.</p>

  <h3>나. 논문 버전</h3>
  <p>버전 간 변경점이 많아 정밀한 비교가 요구됩니다.</p>
  <p>단락 이동, 삽입/삭제 감지를 지원해야 합니다.</p>

  <h2>5. 결론</h2>
  <p>시스템 정밀도, 속도, 직관적인 UI는 핵심 요소입니다.</p>
  <p>지속적인 테스트와 개선이 필요합니다.</p>
</div>
`;
		}
	}

	wrapper.appendChild(editor);
	container.appendChild(wrapper);

	const renderer = (() => {
		const DIFF_EXPAND_X = 2;
		const DIFF_EXPAND_Y = 0;
		const DIFF_LINE_EXPAND_Y = 1;
		const DIFF_LINE_FILL_STYLE = "hsl(0 100% 95%)";
		const DIFF_LINE_HEIGHT_MULTIPLIER = 1.1;

		const diffCanvas = document.createElement("canvas");
		const diffCanvasCtx = diffCanvas.getContext("2d")!;
		wrapper.appendChild(diffCanvas);

		const highlightCanvas = document.createElement("canvas");
		const highlightCanvasCtx = highlightCanvas.getContext("2d")!;
		wrapper.appendChild(highlightCanvas);

		const _newlyShownDiffIndices: number[] = [];
		const _newlyHiddenDiffIndices: number[] = [];

		let _renderPending = false;
		let _dirtyFlags = 0;

		function updateLayout() {
			const { x, y, width, height } = wrapper.getBoundingClientRect();
			diffCanvas.width = highlightCanvas.width = _canvasWidth = width;
			diffCanvas.height = highlightCanvas.height = _canvasHeight = height;
			_canvasOffsetX = x;
			_canvasOffsetY = y;
			markDirty(RenderFlags.ALL);
		}

		function markDirty(flags: RenderFlags = RenderFlags.ALL) {
			_dirtyFlags |= flags;
			if (!_renderPending) {
				_renderPending = true;
				requestAnimationFrame(() => {
					doRender();
					_renderPending = false;
				});
			}
		}

		function buildDiffGeometries() {
			const scrollTop = wrapper.scrollTop;
			const scrollLeft = wrapper.scrollLeft;
			const offsetX = -_canvasOffsetX + scrollLeft;
			const offsetY = -_canvasOffsetY + scrollTop;

			const allDiffRects: Rect[] = [];
			for (let diffIndex = 0; diffIndex < _diffRenderItems.length; diffIndex++) {
				const item = _diffRenderItems[diffIndex];
				const rawRects: Rect[] = [];
				for (const range of item.ranges) {
					const clientRects = range.getClientRects();
					for (let i = 0; i < clientRects.length; ++i) {
						const rect = {
							x: clientRects[i].x + offsetX - DIFF_EXPAND_X,
							y: clientRects[i].y + offsetY - DIFF_EXPAND_Y,
							width: clientRects[i].width + DIFF_EXPAND_X * 2,
							height: clientRects[i].height + DIFF_EXPAND_Y * 2,
						};
						rawRects.push(rect);
						allDiffRects.push(rect);
					}
				}
				item.geometry = mergeRects(rawRects, 1, 1);
			}

			buildDiffLineRects(allDiffRects);
		}

		function buildDiffLineRects(diffRects: Rect[]) {
			const TOLERANCE = 1;

			diffRects.sort((a, b) => a.y - b.y);
			const rects: Rect[] = [];

			let lineRect: Rect | null = null;
			for (const rect of diffRects) {
				const y = rect.y - DIFF_LINE_EXPAND_Y;
				const height = rect.height * DIFF_LINE_HEIGHT_MULTIPLIER + DIFF_LINE_EXPAND_Y * 2;
				//const height = rect.height + lineExpand * 2;
				if (lineRect === null || y > lineRect.y + lineRect.height) {
					lineRect = {
						x: 0,
						y: y,
						width: _canvasWidth - 2,
						height: height,
					};
					rects.push(lineRect);
				} else {
					lineRect.height = y + height - lineRect.y;
				}
			}

			_diffLineRects.length = 0;
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
		}

		function doRender() {
			const scrollTop = wrapper.scrollTop;
			const scrollLeft = wrapper.scrollLeft;
			const offsetX = -_canvasOffsetX + scrollLeft;
			const offsetY = -_canvasOffsetY + scrollTop;

			// console.log(editorName, "doRender", _dirtyFlags);
			if (_dirtyFlags & RenderFlags.DIFF) {
				if ((_dirtyFlags & RenderFlags.DIFF_GEOMETRY) !== 0) {
					buildDiffGeometries();
				}

				diffCanvasCtx.clearRect(0, 0, _canvasWidth, _canvasHeight);
				_newlyShownDiffIndices.length = 0;
				_newlyHiddenDiffIndices.length = 0;

				diffCanvasCtx.fillStyle = DIFF_LINE_FILL_STYLE;
				for (const rect of _diffLineRects!) {
					const x = Math.floor(rect.x - scrollLeft),
						y = Math.floor(rect.y - scrollTop),
						width = Math.ceil(rect.width),
						height = Math.ceil(rect.height);

					if (y > _canvasHeight) break;
					if (y + height < 0) continue;

					diffCanvasCtx.fillRect(x, y, width, height);
				}

				for (let diffIndex = 0; diffIndex < _diffRenderItems.length; diffIndex++) {
					const item = _diffRenderItems[diffIndex];
					const geometry = item.geometry!;
					let rendered = false;

					if (
						// 빠른 체크
						!(
							geometry.maxY - scrollTop < 0 ||
							geometry.minY - scrollTop > _canvasHeight ||
							geometry.maxX - scrollLeft < 0 ||
							geometry.minX - scrollLeft > _canvasWidth
						)
					) {
						diffCanvasCtx.fillStyle = item.fill;
						diffCanvasCtx.strokeStyle = item.stroke;

						for (const rect of geometry.rects) {
							const x = Math.floor(rect.x - scrollLeft),
								y = Math.floor(rect.y - scrollTop),
								width = Math.ceil(rect.width),
								height = Math.ceil(rect.height);

							if (y + height < 0 || y > _canvasHeight) continue;
							if (x + width < 0 || x > _canvasWidth) continue;

							diffCanvasCtx.fillRect(x, y, width, height);
							diffCanvasCtx.strokeRect(x, y, width, height);
							rendered = true;
						}
					}

					if (rendered) {
						if (!_diffVisibilities[diffIndex]) {
							_diffVisibilities[diffIndex] = true;
							_newlyShownDiffIndices.push(diffIndex);
						}
					} else {
						if (_diffVisibilities[diffIndex]) {
							_diffVisibilities[diffIndex] = false;
							_newlyHiddenDiffIndices.push(diffIndex);
						}
					}
				}
			}

			_dirtyFlags = 0;

			if (_newlyShownDiffIndices.length > 0 || _newlyHiddenDiffIndices.length > 0) {
				// console.log(editorName, "onDiffVisibilityChanged", _newlyShownDiffIndices, _newlyHiddenDiffIndices);
				const entries: VisibilityChangeEntry[] = [];
				for (const index of _newlyShownDiffIndices) {
					entries.push({ item: index, isVisible: true });
				}
				for (const index of _newlyHiddenDiffIndices) {
					entries.push({ item: index, isVisible: false });
				}
				onDiffVisibilityChanged(entries);
			}
		}

		return {
			updateLayout,
			markDirty,
		};
	})();

	wrapper.addEventListener("scroll", () => {
		renderer.markDirty(RenderFlags.DIFF);
		onScroll(wrapper.scrollTop, wrapper.scrollLeft);
	});

	const resizeObserver = new ResizeObserver(() => {
		renderer.updateLayout();
	});
	resizeObserver.observe(wrapper);

	// *** HTML 붙여넣기를 허용할 때만 사용할 코드 ***
	// 지금은 관련 코드를 다 지워버렸고 복구하려면 깃허브에서 이전 코드를 뒤져야함...
	const { observeEditor, unobserveEditor } = (() => {
		const mutationObserver = new MutationObserver((mutations) => {
			if (editor.childNodes.length === 0) {
				editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
				return;
			}
			// if (editor.childNodes.length === 0) {
			// 	editor.innerHTML = INITIAL_EDITOR_HTML;
			// 	return;
			// }
			// for (const mutation of mutations) {
			// 	if (mutation.type === "childList") {
			// 		if (mutation.addedNodes.length > 0) {
			// 			for (const node of mutation.addedNodes) {
			// 				if (node.nodeType === 1) {
			// 					const el = node as HTMLElement;
			// 					if (el.classList.contains("anchor")) {
			// 						el.classList.remove("anchor", "padtop");
			// 						el.style.removeProperty("--padding");
			// 					}
			// 				}
			// 			}
			// 		}
			// 	}
			// }
		});

		function observeEditor() {
			mutationObserver.observe(editor, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true,
			});
		}

		function unobserveEditor() {
			mutationObserver.disconnect();
		}

		return { observeEditor, unobserveEditor };
	})();
	observeEditor();

	function formatPlaintext(plaintext: string) {
		const lines = plaintext.split("\n");

		const fragment = document.createDocumentFragment();
		for (const line of lines) {
			const p = document.createElement("p");
			p.textContent = line;
			fragment.appendChild(p);
		}

		return fragment;
	}

	editor.addEventListener("paste", (e) => {
		// 비교적 무거운 작업이지만 뒤로 미루면 안되는 작업이기 때문에 UI blocking을 피할 뾰족한 수가 없다.
		// 붙여넣기 이후 바로 추가 입력 => 붙여넣기를 뒤로 미루면 입력이 먼저 될테니까.
		console.time("paste");
		e.preventDefault();

		let rawHTML = e.clipboardData?.getData("text/html");
		let sanitized: Node;
		if (rawHTML) {
			const START_TAG = "<!--StartFragment-->";
			const END_TAG = "<!--EndFragment-->";
			const startIndex = rawHTML.indexOf(START_TAG);
			if (startIndex >= 0) {
				const endIndex = rawHTML.lastIndexOf(END_TAG);
				if (endIndex >= 0) {
					rawHTML = rawHTML.slice(startIndex + START_TAG.length, endIndex);
				} else {
					rawHTML = rawHTML.slice(startIndex + START_TAG.length);
				}
			}
			sanitized = sanitizeHTML(rawHTML);
		} else {
			sanitized = formatPlaintext(e.clipboardData?.getData("text/plain") || "");
		}

		// 자존심 상하지만 document.execCommand("insertHTML",...)를 써야한다.
		// 1. 브라우저가 undo/redo 히스토리 관리를 할 수 있음.
		// 2. 필요한 경우 브라우저가 알아서 DOM을 수정해 줌.
		// 	예: 인라인 엘러먼트 안에 블럭 엘러먼트를 붙여넣는 경우 브라우저가 알아서 인라인 요소를 반으로 갈라서 블럭 엘러먼트를 밖으로 꺼내준다.
		const div = document.createElement("DIV");
		div.appendChild(sanitized);
		unobserveEditor();
		document.execCommand("insertHTML", false, div.innerHTML);
		observeEditor();
		console.log("insertHTML", div.innerHTML);

		console.timeEnd("paste");
	});

	editor.addEventListener("input", onChange);

	function onChange() {
		tokenize();
	}

	function onTokenizeDone() {
		onTextChanged();
	}

	function getVisibleAnchors() {
		return Array.from(_visibleAnchors).sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos));
	}

	function scrollToDiff(diffIndex: number) {
		// const diffRects = _diffRects[diffIndex];
		// if (!diffRects) {
		// 	return;
		// }
		// const diffRect = diffRects.rects[0];
		// if (!diffRect) {
		// 	return;
		// }
		// wrapper.scrollTop = diffRect.y - SCROLL_MARGIN;
	}

	// temp
	setTimeout(onChange, 0);

	// 앵커를 어떤식으로 추가할지
	// 1. classList에 넣고 anchor:before
	// 2. <a> 태그를 넣는다

	const { tokenize } = (function () {
		const _TIMEOUT = 200;
		let _callbackId: number | null = null;
		let _startTime = 0;
		let _currentContext: TokinizeContext | null = null;

		return {
			tokenize: () => {
				if (_currentContext) {
					_currentContext.cancelled = true;
				}
				_startTime = performance.now();

				const ctx: TokinizeContext = (_currentContext = {
					cancelled: false,
					content: editor,
					tokens: _tokens,
				});

				const generator = tokenize2(ctx);

				// const generator = tokenizeGenerator(ctx);
				const step = (idleDeadline: IdleDeadline) => {
					_callbackId = null;
					try {
						const { done } = generator.next(idleDeadline);
						if (done) {
							const endTime = performance.now();
							console.log(editorName, "tokenize done", Math.ceil(endTime - _startTime) + "ms", { _tokens });
							onTokenizeDone();
						} else {
							if (!ctx.cancelled) {
								_callbackId = requestIdleCallback(step, { timeout: _TIMEOUT });
							} else {
								console.debug(editorName, "tokenize cancelled");
							}
						}
					} catch (e) {
						if ((e as Error).message !== "cancelled") {
							console.error(editorName, "tokenize error", e);
						}
					}
				};
				_callbackId = requestIdleCallback(step, { timeout: _TIMEOUT });
			},
		};
	})();

	function update({ diffs, anchors }: { diffs: DiffItem[]; anchors: AnchorItem[] }) {
		const unusedAnchors = new Set<HTMLElement>();
		for (const anchorEl of _diffAnchorElements) {
			if (anchorEl) {
				unusedAnchors.add(anchorEl);
			}
		}
		for (const anchorEl of _anchorElements) {
			if (anchorEl) {
				unusedAnchors.add(anchorEl);
			}
		}

		// console.log(editorName, "update", { diffs, anchors, unusedAnchors, prevAnchors: Array.from(_anchorElements) });

		_diffRenderItems.length = diffs.length;
		_diffAnchorElements.length = diffs.length;
		_anchorElements.length = anchors.length;
		_diffVisibilities.length = diffs.length;
		_diffVisibilities.fill(false);

		function getOrCreateDiffAnchorFromInsertionPoint(point: AnchorInsertionPoint, diffIndex: number): Range {
			if (point.existingAnchor) {
				unusedAnchors.delete(point.existingAnchor);
				const range = document.createRange();
				range.selectNode(point.existingAnchor);
				return range;
			}

			if (point.container.nodeType === 3) {
				const range = document.createRange();
				range.setStart(point.container, point.offset);
				range.collapse(true);
				return range;
			}

			const range = document.createRange();
			range.setStart(point.container, point.offset);
			range.collapse(true);

			const diffAnchorEl = document.createElement("a");
			diffAnchorEl.classList.add("anchor", "diff-anchor");
			diffAnchorEl.dataset.diff = String(diffIndex);
			range.insertNode(diffAnchorEl);
			range.selectNode(diffAnchorEl);

			_diffAnchorElements[diffIndex] = diffAnchorEl;
			console.warn(editorName, "created diff anchor", diffAnchorEl, point);
			return range;
		}

		function getInsertionPointFlagStrings(flags: number) {
			const flagStrings: string[] = [];
			if (flags & InsertionPointFlags.BeforeTable) flagStrings.push("beforeTable");
			if (flags & InsertionPointFlags.AfterTable) flagStrings.push("afterTable");
			if (flags & InsertionPointFlags.ContainerStart) flagStrings.push("containerStart");
			if (flags & InsertionPointFlags.ContainerEnd) flagStrings.push("containerEnd");
			if (flags & InsertionPointFlags.BlockStart) flagStrings.push("blockStart");
			if (flags & InsertionPointFlags.BlockEnd) flagStrings.push("blockEnd");
			if (flags & InsertionPointFlags.TableCellStart) flagStrings.push("tableCellStart");
			if (flags & InsertionPointFlags.TableCellEnd) flagStrings.push("tableCellEnd");
			if (flags & InsertionPointFlags.TableRowStart) flagStrings.push("tableRowStart");
			if (flags & InsertionPointFlags.TableRowEnd) flagStrings.push("tableRowEnd");
			if (flags & InsertionPointFlags.LineStart) flagStrings.push("lineStart");
			if (flags & InsertionPointFlags.LineEnd) flagStrings.push("lineEnd");

			return flagStrings.join(", ");
		}

		for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
			const diff = diffs[diffIndex];
			let range: Range | null = null;

			if (diff.tokenCount === 0) {
				console.warn(editorName, "diff with no tokens", diff);
				let bestInsertionPoint: AnchorInsertionPoint | null = null;
				let bestScore = -1;
				for (const point of yieldAnchorPointsInRange(diff.tokenIndex)) {
					let score = 0;
					if (diff.preferBlockStart && point.flags & InsertionPointFlags.BlockStart) {
						score += 1;
					}
					if (diff.preferBlockEnd && point.flags & InsertionPointFlags.BlockEnd) {
						score += 1;
					}
					if (score > bestScore || (score === bestScore && bestInsertionPoint === null)) {
						bestInsertionPoint = point;
						bestScore = score;
					}
				}
				if (bestInsertionPoint) {
					range = getOrCreateDiffAnchorFromInsertionPoint(bestInsertionPoint, diffIndex);
					const anchorEl = _diffAnchorElements[diffIndex];
					if (anchorEl) {
						anchorEl.classList.toggle("diff-anchor-block", diff.preferBlockStart && diff.preferBlockEnd);
					}
				}
			}
			if (!range) {
			}
			range = createTokenRange(diff.tokenIndex, diff.tokenCount);
			_diffRanges[diffIndex] = range;

			const rectRanges = extractTextRanges(range);
			console.debug(editorName, "diff rect ranges", diffIndex, rectRanges);
			if (diff.tokenCount === 0 && rectRanges.length > 1) {
				rectRanges.length = 1;
			}
			const hue = DIFF_COLOR_HUES[diffIndex % NUM_DIFF_COLORS];
			const item: DiffRenderItem2 = {
				ranges: rectRanges,
				fill: `hsl(${hue} 100% 80%)`,
				stroke: `hsl(${hue} 100% 40% / 0.5)`,
				geometry: null,
			};
			_diffRenderItems[diffIndex] = item;
		}

		let lastAnchorEl: HTMLElement | null = null;
		for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
			const anchor = anchors[anchorIndex];
			let anchorEl: HTMLElement | null = null;
			if (anchor.diffIndex !== undefined) {
				// const diff = diffs[anchor.diffIndex!];
				// let range: Range;
				// if (diff.tokenCount > 0) {
				// 	range = _ranges[diff.tokenIndex + diff.tokenCount - 1];
				// } else {
				// 	range = getRangeForToken(diff.tokenIndex, 0);
				// }
				// if (!range) {
				// 	console.warn("No range found for diff", diff, _ranges);
				// 	continue;
				// }
				// anchorEl = locateOrInsertAnchor(range, anchor.type);
				// anchorEl = addAnchorClassToBlockElement(range, "end");
			} else if (anchor.tokenIndex !== undefined) {
				anchorEl = insertStartAnchor(anchor.tokenIndex);
				// const range = getRangeForToken(anchor.tokenIndex);
				// if (!range) {
				// 	console.warn("No range found for token", anchor.tokenIndex, _ranges);
				// 	continue;
				// }
				// anchorEl = locateOrInsertAnchor(range, anchor.type);
			} else {
				continue;
			}

			if (anchorEl) {
				// if (lastAnchorEl !== anchorEl) {
				// 	anchorEl.classList.add("anchor");
				// }
				unusedAnchors.delete(anchorEl);
				_anchorElements[anchorIndex] = lastAnchorEl = anchorEl;
			}
		}

		// console.log("unusedAnchors", unusedAnchors, _anchorElements);
		const numRemoveAnchors = removeAnchors(unusedAnchors);
		console.warn(editorName, "removed anchors", numRemoveAnchors, unusedAnchors);

		renderer.markDirty(RenderFlags.DIFF | RenderFlags.DIFF_GEOMETRY);
		console.log(editorName, "update", { anchors: _anchorElements, diffs: _diffRenderItems });
	}

	return {
		name: editorName,
		update,
		markDirty: renderer.markDirty,
		insertStartAnchor,
		removeAnchors,
		wrapper,
		editor,
		// updateText,
		// setText,
		scrollToDiff,
		// saveCaret,
		// restoreCaret,
		getVisibleAnchors,
		getRangeForToken: createTokenRange,
		scrollToOffset,
		scrollByOffset,
		get anchors(): readonly (HTMLElement | null)[] {
			return _anchorElements;
		},

		get visibleAnchors() {
			return _visibleAnchors;
		},
		get visibleDiffIndices() {
			return _visibleDiffIndices;
		},
		get tokens(): readonly RichToken[] {
			return _tokens;
		},
		get scrollTop() {
			return wrapper.scrollTop;
		},
		set scrollTop(value: number) {
			wrapper.scrollTop = value;
		},
		get scrollLeft() {
			return wrapper.scrollLeft;
		},
		set scrollLeft(value: number) {
			wrapper.scrollLeft = value;
		},
	};

	type AnchorInsertionPoint = {
		container: Node;
		offset: number;
		flags: number;
		existingAnchor: HTMLElement | null;
	};

	function* yieldAnchorPointsInRange(tokenIndex: number): Generator<AnchorInsertionPoint> {
		const prevToken = _tokens[tokenIndex - 1];
		const nextToken = _tokens[tokenIndex];

		let endContainer: Node;
		let endOffset: number;
		// let endNode: Node;
		let lastYielded: AnchorInsertionPoint | null = null;
		// console.log(editorName, "generateInsertionPointsInRange", { tokenIndex, prevToken, nextToken });

		let container: Node;
		let childIndex: number;
		const indexStack: number[] = [];

		if (prevToken && nextToken && prevToken.endContainer === nextToken.startContainer && prevToken.endContainer.nodeType === 3) {
			yield* createPoint(prevToken.endContainer, prevToken.endOffset!);
			return;
		}

		if (prevToken) {
			container = prevToken.endContainer;
			childIndex = prevToken.endOffset;
			if (container.nodeType === 3) {
				// 텍스트노드는 컨테이너로 지정되지 않음!
				yield* createPoint(container, childIndex);
				childIndex = Array.prototype.indexOf.call(container.parentNode!.childNodes, container) + 1;
				container = container.parentNode!;
			}
		} else {
			container = editor;
			childIndex = 0;
		}

		if (nextToken) {
			endContainer = nextToken.startContainer;
			endOffset = nextToken.startOffset;
		} else {
			endContainer = editor;
			endOffset = editor.childNodes.length;
		}

		if (container === endContainer) {
			if (container.nodeType === 3) {
				yield* createPoint(container, childIndex);
				return;
			}
		}

		// 문제 prevToken.endNode와 nextToken.startNode가 같은 경우
		//
		// console.log(
		// 	editorName,
		// 	"startingContainer:",
		// 	container,
		// 	"childIndex:",
		// 	childIndex,
		// 	"current:",
		// 	container.childNodes[childIndex],
		// 	endContainer,
		// 	endOffset
		// );

		while (container) {
			if (!TEXTLESS_ELEMENTS[container.nodeName]) {
				yield* createPoint(container, childIndex);
			}

			if (container === endContainer && childIndex >= endOffset) {
				break;
			}

			let current: Node = container.childNodes[childIndex];

			// console.log(
			// 	editorName,
			// 	"current:",
			// 	current,
			// 	"container:",
			// 	container,
			// 	"childIndex:",
			// 	childIndex,
			// 	"endContainer:",
			// 	endContainer,
			// 	"endOffset:",
			// 	endOffset,
			// 	"prevToken:",
			// 	prevToken,
			// 	"nextToken:",
			// 	nextToken
			// );
			if (!current) {
				current = container;
				container = container.parentNode!;
				if (indexStack.length > 0) {
					childIndex = indexStack.pop()!;
				} else {
					if (!container || !container.childNodes) {
						console.warn(editorName, "No childNodes in container", current, container, prevToken, nextToken);
					}
					childIndex = Array.prototype.indexOf.call(container.childNodes, current);
				}
				childIndex++;
				continue;
			}

			if (current.nodeType === 1 && !VOID_ELEMENTS[current.nodeName]) {
				// 주어진 childIndex에 해당하는 자식으로 들어가기
				if (current.firstChild) {
					indexStack.push(childIndex);
					container = current;
					childIndex = 0;
					continue;
				} else {
					// 자식이 없더라도 요소 안에 하나의 point는 만들어야함.
					// firstChild 조건 체크 없이 container=current, childIndex=0으로 설정해두고 continue 해버려도 되지만
					// 일단 그냥 여기서 처리하고 루프 한바퀴 건너뛰자.
					if (!TEXTLESS_ELEMENTS[current.nodeName]) {
						yield* createPoint(current, 0);
					}
				}
			} else if (current.nodeType === 3) {
				if (current === endContainer) {
					yield* createPoint(current, endOffset);
					break;
				}
			}

			childIndex++;
		}

		function* createPoint(container: Node, offset: number, flags: number = 0): Generator<AnchorInsertionPoint> {
			if (lastYielded && lastYielded.container === container && lastYielded.offset === offset) {
				return;
			}

			let existingAnchor: HTMLElement | null = null;
			if (container.nodeType === 3) {
				//
			} else {
				existingAnchor = (container.childNodes[offset] as HTMLElement) || null;
				if (existingAnchor && existingAnchor.nodeName !== "A") {
					existingAnchor = null;
				}

				const comparePrev = prevToken ? container.compareDocumentPosition(prevToken.endContainer) : 0;
				const compareNext = nextToken ? container.compareDocumentPosition(nextToken.startContainer) : 0;

				if (offset === 0 || !(comparePrev & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
					if (TEXT_FLOW_CONTAINERS[container.nodeName]) {
						flags |= InsertionPointFlags.ContainerStart;
					}
					if (BLOCK_ELEMENTS[container.nodeName]) {
						flags |= InsertionPointFlags.BlockStart;
					}
					if (container.nodeName === "TD" || container.nodeName === "TH") {
						flags |= InsertionPointFlags.TableCellStart;
						if (container.parentNode!.firstElementChild === container) {
							flags |= InsertionPointFlags.TableRowStart;
						}
					}
				}

				if (offset === container.childNodes.length || !(compareNext & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
					if (TEXT_FLOW_CONTAINERS[container.nodeName]) {
						flags |= InsertionPointFlags.ContainerEnd;
					}
					if (BLOCK_ELEMENTS[container.nodeName]) {
						flags |= InsertionPointFlags.BlockEnd;
					}
					if (container.nodeName === "TD" || container.nodeName === "TH") {
						flags |= InsertionPointFlags.TableCellEnd;
						if (container.parentNode!.lastElementChild === container) {
							flags |= InsertionPointFlags.TableRowEnd;
						}
					}
				}

				if (offset > 0) {
					const prevSibling = container.childNodes[offset - 1];
					if (prevSibling && prevSibling.nodeName === "TABLE") {
						flags |= InsertionPointFlags.AfterTable;
					}
				}

				let nextSibling = existingAnchor ? existingAnchor.nextSibling : container.childNodes[offset];
				if (nextSibling) {
					if (nextSibling.nodeName === "TABLE") {
						flags |= InsertionPointFlags.BeforeTable;
					}
				}
			}

			lastYielded = { container: container, offset, flags, existingAnchor };
			yield lastYielded;
		}
	}

	function scrollToOffset(offset: number) {
		wrapper.scrollTop = offset;
	}

	function scrollByOffset(offset: number) {
		wrapper.scrollTop += offset;
	}

	function removeAnchors(anchorElements: Iterable<HTMLElement>) {
		let count = 0;
		for (const anchorEl of anchorElements) {
			if (anchorEl) {
				if (anchorEl.nodeName === "A") {
					anchorEl.remove();
				} else {
					anchorEl.classList.remove("anchor");
					anchorEl.style.removeProperty("--padding");
				}
				count++;
			}
		}
		return count;
	}

	function insertStartAnchor(tokenIndex: number): HTMLElement | null {
		let bestPoint: AnchorInsertionPoint | null = null;
		let bestScore = -1;

		for (const point of yieldAnchorPointsInRange(tokenIndex)) {
			if (point.existingAnchor) {
				// 이미 앵커가 있는 경우
				return point.existingAnchor;
			}
			let score = 0;
			if (point.flags & InsertionPointFlags.ContainerStart) {
				score += 3;
			} else if (point.flags & InsertionPointFlags.BlockStart) {
				score += 2;
			} else if (point.flags & InsertionPointFlags.LineStart) {
				score += 1;
			}

			if (score >= bestScore) {
				// last anchor wins! 토큰의 시작지점과 가장 가까운 앵커 선택
				bestPoint = point;
				bestScore = score;
			}
		}

		if (!bestPoint) {
			return null;
		}

		// const el = bestPoint.container.childNodes[bestPoint.offset] as HTMLElement;
		// if (el && BLOCK_ELEMENTS[el.nodeName]) {
		// 	el.classList.add("anchor");
		// 	return el; // 이미 블럭 엘리먼트가 있는 경우, 해당 엘리먼트를 앵커로 사용
		// }

		const anchorEl = document.createElement("A");
		anchorEl.classList.add("anchor");

		const range = document.createRange();
		range.setStart(bestPoint.container, bestPoint.offset);
		range.collapse(true);
		range.insertNode(anchorEl);
		return anchorEl;
	}

	// args는 startIndex, endIndex가 아님!
	// args는 startIndex, count임 => 두 토큰 사이의 빈 range를 가져올 때 count = 0으로 설정
	// 0, 0 => 토큰[0]의 앞부분
	// 1, 0 => 토큰[0]과 토큰[1] 사이
	// 좀 모호해보이지만...
	function createTokenRange(index: number, count: number = 1) {
		const range = document.createRange();
		if (count === 1 && index >= 0 && index < _tokens.length) {
			const token = _tokens[index];
			range.setStart(token.startContainer, token.startOffset);
			range.setEnd(token.endContainer, token.endOffset);
		} else if (count > 0) {
			const startToken = _tokens[index];
			const endToken = _tokens[index + count - 1];
			if (startToken) {
				range.setStart(startToken.startContainer, startToken.startOffset);
			} else {
				range.setStart(editor, 0);
			}
			if (endToken) {
				range.setEnd(endToken.endContainer, endToken.endOffset);
			} else {
				range.setEnd(editor, editor.childNodes.length);
			}
		} else {
			const prevToken = _tokens[index - 1];
			const nextToken = _tokens[index];
			if (prevToken) {
				range.setStart(prevToken.endContainer, prevToken.endOffset);
			} else {
				range.setStart(editor, 0);
			}
			if (nextToken) {
				range.setEnd(nextToken.startContainer, nextToken.startOffset);
			} else {
				range.setEnd(editor, editor.childNodes.length);
			}
		}
		return range;
	}

	// editor 외부로 노출되지 않는 함수이므로 range를 clone하거나 기타 등등 할 필요 없음.
	function extractTextRanges(sourceRange: Range): Range[] {
		console.log(editorName, "extractTextRanges", sourceRange);
		// 하나의 텍스트노드 안에 범위가 있는 경우 그대로 리턴.
		const result: Range[] = [];
		if (sourceRange.startContainer.nodeType === 3) {
			if (sourceRange.startContainer === sourceRange.endContainer) {
				result.push(sourceRange);
				return result;
			}
			const r = document.createRange();
			r.setStart(sourceRange.startContainer, sourceRange.startOffset);
			r.setEnd(sourceRange.startContainer, sourceRange.startContainer.nodeValue!.length);
			result.push(r);
		}

		const root = sourceRange.commonAncestorContainer;
		const walker = document.createTreeWalker(sourceRange.commonAncestorContainer, NodeFilter.SHOW_ALL);

		const endContainer = sourceRange.endContainer;
		const endOffset = sourceRange.endOffset;
		let endNode: Node;
		if (endContainer.nodeType === 3) {
			endNode = endContainer;
		} else {
			endNode = endContainer.childNodes[endOffset];
			if (!endNode) {
				endNode = advanceNode(endContainer, root, true)!;
			}
		}

		if (sourceRange.startContainer.nodeType === 3) {
			walker.currentNode = advanceNode(sourceRange.startContainer, null, false)!;
		} else {
			let startNode: Node | null = sourceRange.startContainer.childNodes[sourceRange.startOffset];
			if (!startNode) {
				startNode = advanceNode(sourceRange.startContainer, null, true);
				if (!startNode) {
					return result;
				}
			}
			walker.currentNode = startNode;
		}

		if (!walker.currentNode) {
			console.warn(editorName, "extractTextRanges: No currentNode in walker", sourceRange);
			return result;
		}

		do {
			const currentNode = walker.currentNode;
			if (currentNode === endNode) {
				if (currentNode.nodeType === 3) {
					const r = document.createRange();
					r.setStart(endNode, 0);
					r.setEnd(endNode, endOffset);
					result.push(r);
				}
				break;
			}

			if (currentNode.nodeType === 3) {
				const r = document.createRange();
				r.setStart(currentNode, 0);
				r.setEnd(currentNode, currentNode.nodeValue!.length);
				result.push(r);
			} else if (currentNode.nodeName === "BR") {
				const r = document.createRange();
				r.selectNode(currentNode);
				result.push(r);
			} else if (currentNode.nodeName === "A") {
				if (currentNode.childNodes.length === 0) {
					// const text = document.createTextNode("");
					// currentNode.appendChild(text); // 빈 텍스트 노드 추가
					// const r = document.createRange();
					// r.selectNodeContents(text);
					// result.push(r);
				} else {
					// if ((currentNode as HTMLElement).classList.contains("anchor")) {
					// 	const r = document.createRange();
					// 	r.selectNode(currentNode);
					// 	result.push(r);
					// }
				}
			}
		} while (walker.nextNode());

		return result;
	}
}

type Editor = ReturnType<typeof createEditor>;
type EditorName = Editor["name"];
