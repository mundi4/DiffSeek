type EditorCallbacks = {
	onDiffVisibilityChanged: (entries: VisibilityChangeEntry[]) => void;
	onContentChanged: () => void;
	onScroll: (scrollTop: number, scrollLeft: number) => void;
	onRender: () => void;
};

type VisibilityChangeEntry = {
	item: number | string;
	isVisible: boolean;
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
	const { onContentChanged, onScroll } = callbacks;
	const _visibleAnchors = new Set<HTMLElement>();

	let _tokens: RichToken[] = [];
	let _containers: Map<HTMLElement, RichTokenContainer> | null = null;
	const _diffAnchorElements: HTMLElement[] = [];

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
      <p>자동화된 비교는 일간성 있는 결과를 제공합니다.</p>
      <p>생산성과 정확성을 동시에 높일 수 있읍니다.</p>

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
	  <p>(현행과 같음)</p>
      <p>이 문서는 문서 비교 시스템을 테스트하기 위해 작성되었습니다.</p>
	  <p>(삭제)</p>
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
      <p>자동화된 비교는 일간성 있는 결과를 제공합니다.</p>
      <p>생산성과 정확성을 동시에 높일 수 있읍니다.</p>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top;">
      <h2>3. 시스템 구성</h2>
    </td>
    <td>
      <h3>가. 입력</h3>
      <p>HTML 문서를 입력받아 필요한 <img src="xxx"> 내용만 추출합니다.</p>

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
  <p>hello world!</p>
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
  <p>HTML 문서를 입력받아 필요한 <img src="yyy"> 내용만 추출합니다.</p>

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

	wrapper.addEventListener("scroll", () => {
		// renderer.markDirty(RenderFlags.DIFF);
		onScroll(wrapper.scrollTop, wrapper.scrollLeft);

		// const scrollTop = wrapper.scrollTop;
		// const scrollLeft = wrapper.scrollLeft;

		// console.log(editorName, "WRAPPER", wrapper.getBoundingClientRect(), "scrollTop", scrollTop, "scrollLeft", scrollLeft);
		const visibleRect = wrapper.getBoundingClientRect();
	});

	// *** HTML 붙여넣기를 허용할 때만 사용할 코드 ***
	// 지금은 관련 코드를 다 지워버렸고 복구하려면 깃허브에서 이전 코드를 뒤져야함...
	const { observeEditor, unobserveEditor } = (() => {
		const mutationObserver = new MutationObserver((mutations) => {
			if (editor.childNodes.length === 0) {
				editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
				return;
			}
		});

		function observeEditor() {
			mutationObserver.observe(editor, {
				childList: true,
				// subtree: true,
				// attributes: true,
				// characterData: true,
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
		onContentChanged();
	}

	// temp
	setTimeout(onChange, 0);

	// 앵커를 어떤식으로 추가할지
	// 1. classList에 넣고 anchor:before
	// 2. <a> 태그를 넣는다

	const tokenize = (function () {
		const _TIMEOUT = 200;

		let _callbackId: number | null = null;
		let _currentContext: TokinizeContext | null = null;

		return () => {
			if (_callbackId !== null) {
				// 아직 실행되지 않고 대기 중인 콜백 취소
				cancelIdleCallback(_callbackId);
				_callbackId = null;
			}

			if (_currentContext) {
				// 이미 콜백이 실행 중이라면 다음 step에서 취소처리해야하므로...
				_currentContext.cancelled = true;
			}

			const startTime = performance.now();
			const ctx: TokinizeContext = (_currentContext = {
				cancelled: false,
				content: editor,
			});

			// 여기서 바로 generator를 생성을 해버리면 idleDeadline을 바로 넘겨줄 수가 없다.
			// generator 내부에서 idleDeadline을 획득하려면 "성급하게" yield를 해야되는데 그러면 황금같은 유휴시간을 한번 낭비하게 됨.
			let generator: ReturnType<typeof tokenizer> | null = null;
			const step = (idleDeadline: IdleDeadline) => {
				_callbackId = null;

				if (ctx.cancelled) {
					// 어차피 단일쓰레드이므로 콜백이 실행되는 도중에는 cancelled 값이 바뀔 수는 없음!
					// 그래서 next()를 호출하기 전에나 한번씩 확인해주면 됨.
					// 다만 generator 내부에서 주기적으로 yield을 해주지 않으면 토큰화가 끝날때까지 멈출 수 없음.
					console.debug(editorName, "tokenize cancelled");
					return;
				}

				if (generator === null) {
					generator = tokenizer(ctx, idleDeadline);
				}

				const { done, value } = generator.next(idleDeadline);
				if (done) {
					const endTime = performance.now();
					({ tokens: _tokens, containers: _containers } = value);
					console.log(editorName, "tokenize done", Math.ceil(endTime - startTime) + "ms", value);
					onTokenizeDone();
				} else {
					_callbackId = requestIdleCallback(step, { timeout: _TIMEOUT });
				}
			};
			_callbackId = requestIdleCallback(step, { timeout: _TIMEOUT });
		};
	})();

	function getOrInsertStartAnchor(tokenIndex: number): HTMLElement | null {
		const token = _tokens[tokenIndex];
		let container: Node = token.range.startContainer;
		let beforeNode: Node;
		if (container.nodeType === 3) {
			beforeNode = container;
			container = container.parentElement!;
		} else {
			container = token.range.startContainer.parentNode!;
			beforeNode = token.range.startContainer;
		}

		do {
			if (BLOCK_ELEMENTS[container.nodeName]) {
				if (beforeNode) {
					let anchor = beforeNode.previousSibling;
					if (!anchor || anchor.nodeName !== "A") {
						anchor = document.createElement("A");
						container.insertBefore(anchor, beforeNode);
					}
					return anchor as HTMLElement;
				}
			}
			beforeNode = container;
			container = container.parentNode!;
		} while (container);
		return null;
	}

	// function getOrCreateDiffAnchorFromInsertionPoint(point: AnchorInsertionPoint, diffIndex: number): Range {
	// 	if (point.existingAnchor) {
	// 		const range = document.createRange();
	// 		range.selectNode(point.existingAnchor);
	// 		return range;
	// 	}

	// 	if (point.container.nodeType === 3) {
	// 		const range = document.createRange();
	// 		range.setStart(point.container, point.offset);
	// 		range.collapse(true);
	// 		return range;
	// 	}

	// 	const range = document.createRange();
	// 	range.setStart(point.container, point.offset);
	// 	range.collapse(true);

	// 	const diffAnchorEl = document.createElement("a");
	// 	diffAnchorEl.classList.add("anchor", "diff-anchor");
	// 	diffAnchorEl.dataset.diff = String(diffIndex);
	// 	range.insertNode(diffAnchorEl);
	// 	range.selectNode(diffAnchorEl);

	// 	_diffAnchorElements[diffIndex] = diffAnchorEl;
	// 	console.warn(editorName, "created diff anchor", diffAnchorEl, point);
	// 	return range;
	// }

	return {
		name: editorName,
		getOrInsertStartAnchor,
		wrapper,
		editor,
		createTokenRange,
		scrollToOffset,
		scrollByOffset,
		yieldAnchorPointsInRange,
		// getOrCreateDiffAnchorFromInsertionPoint,
		contains: wrapper.contains.bind(wrapper),
		findTokenOverlapIndices,
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

		if (prevToken && nextToken && prevToken.range.endContainer === nextToken.range.startContainer && prevToken.range.endContainer.nodeType === 3) {
			yield* createPoint(prevToken.range.endContainer, prevToken.range.endOffset!);
			return;
		}

		if (prevToken) {
			container = prevToken.range.endContainer;
			childIndex = prevToken.range.endOffset;
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
			endContainer = nextToken.range.startContainer;
			endOffset = nextToken.range.startOffset;
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

		while (container) {
			if (!TEXTLESS_ELEMENTS[container.nodeName]) {
				yield* createPoint(container, childIndex);
			}

			if (container === endContainer && childIndex >= endOffset) {
				break;
			}

			let current: Node = container.childNodes[childIndex];
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

				const comparePrev = prevToken ? container.compareDocumentPosition(prevToken.range.endContainer) : 0;
				const compareNext = nextToken ? container.compareDocumentPosition(nextToken.range.startContainer) : 0;

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

	function createTokenRange(index: number, count: number = 1) {
		const range = document.createRange();
		if (count === 1 && index >= 0 && index < _tokens.length) {
			const token = _tokens[index];
			range.setStart(token.range.startContainer, token.range.startOffset);
			range.setEnd(token.range.endContainer, token.range.endOffset);
		} else if (count > 0) {
			const startToken = _tokens[index];
			const endToken = _tokens[index + count - 1];
			if (startToken) {
				range.setStart(startToken.range.startContainer, startToken.range.startOffset);
			} else {
				range.setStart(editor, 0);
			}
			if (endToken) {
				range.setEnd(endToken.range.endContainer, endToken.range.endOffset);
			} else {
				range.setEnd(editor, editor.childNodes.length);
			}
		} else {
			const prevToken = _tokens[index - 1];
			const nextToken = _tokens[index];
			if (prevToken) {
				range.setStart(prevToken.range.endContainer, prevToken.range.endOffset);
			} else {
				range.setStart(editor, 0);
			}
			if (nextToken) {
				range.setEnd(nextToken.range.startContainer, nextToken.range.startOffset);
			} else {
				range.setEnd(editor, editor.childNodes.length);
			}
		}
		return range;
	}

	function findTokenOverlapIndices(range: Range): [number, number] {
		let low = 0;
		let high = _tokens.length - 1;
		let startIndex = -1;
		let endIndex = -1;

		// console.debug(editorName, "findTokenOverlapIndices", { range, text: range.toString() });

		/*
		comparePoint(referenceNode, offset) 
			returns
				-1 if the point specified by the referenceNode and offset is before the start of this Range.
				0 if the point specified by the referenceNode and offset is within this Range (including the start and end points of the range).
				1 if the point specified by the referenceNode and offset is after the end of this Range.
		
		compareBoundaryPoints(how, otherRange)
			how
				Range.END_TO_END compares the end boundary-point of this Range to the end boundary-point of otherRange.
				Range.END_TO_START compares the start boundary-point of this Range to the end boundary-point of otherRange.
				Range.START_TO_END compares the end boundary-point of this Range to the start boundary-point of otherRange.
				Range.START_TO_START compares the start boundary-point of this Range to the start boundary-point of otherRange.
			returns
				-1 if the specified boundary-point of this Range is before the specified boundary-point of otherRange.
				0 if the specified boundary-point of this Range is the same as the specified boundary-point of otherRange.
				1 if the specified boundary-point of this Range is after the specified boundary-point of otherRange.
		*/
		const tokenRange = document.createRange();

		while (low <= high) {
			const mid = (low + high) >> 1;
			const token = _tokens[mid].range;
			tokenRange.setStart(token.startContainer, token.startOffset);
			tokenRange.setEnd(token.endContainer, token.endOffset);

			const c = range.compareBoundaryPoints(Range.END_TO_START, tokenRange);
			// console.debug(mid, _tokens[mid].text, c, _tokens[mid]);
			if (c < 0) {
				const c2 = range.compareBoundaryPoints(Range.START_TO_START, tokenRange);
				console.debug(">>", mid, _tokens[mid].text, c2, _tokens[mid]);
				startIndex = mid;
				high = mid - 1; // 왼쪽으로
			} else {
				low = mid + 1; // 오른쪽으로
			}
		}

		if (startIndex !== -1) {
			low = endIndex = startIndex;
			high = _tokens.length - 1;
			while (low <= high) {
				const mid = (low + high) >> 1;
				const token = _tokens[mid].range;
				tokenRange.setStart(token.startContainer, token.startOffset);
				tokenRange.setEnd(token.endContainer, token.endOffset);
				const c = range.compareBoundaryPoints(Range.START_TO_END, tokenRange);
				if (c > 0) {
					endIndex = mid + 1;
					low = mid + 1; // 오른쪽으로
				} else {
					high = mid - 1; // 왼쪽으로
				}
			}
		}
		// console.debug(editorName, "findTokenOverlapIndices", { range, text: range.toString(), startIndex, endIndex });
		return [startIndex, endIndex];
	}
}

type Editor = ReturnType<typeof createEditor>;
type EditorName = Editor["name"];

const INITIAL_EDITOR_HTML = document.createElement("P");
INITIAL_EDITOR_HTML.appendChild(document.createElement("BR"));

class Editor2 {
	#editorName: EditorName;
	#container: HTMLElement;
	#wrapper = document.createElement("div");
	#editor = document.createElement("div");
	#mutationObserver: MutationObserver;

	#tokens: RichToken[] = [];
	#tokenizeContext: TokinizeContext | null = null;
	#tokenizeCallbackId: number | null = null;
	#callbacks: EditorCallbacks;

	constructor(container: HTMLElement, editorName: "left" | "right", callbacks: EditorCallbacks) {
		this.#editorName = editorName;
		this.#container = container;
		this.#callbacks = callbacks;

		this.#editor.id = editorName + "Editor";
		this.#editor.classList.add("editor");
		this.#editor.contentEditable = "true";
		this.#editor.spellcheck = false;
		this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));

		this.#wrapper.id = editorName + "EditorWrapper";
		this.#wrapper.classList.add("editor-wrapper");
		this.#wrapper.appendChild(this.#editor);

		this.#container.appendChild(this.#wrapper);

		this.#mutationObserver = new MutationObserver((mutations) => this.onMutation(mutations));
		this.observeMutation();

		this.#wrapper.addEventListener("scroll", (e) => this.onScroll(e));
		this.#editor.addEventListener("paste", (e) => this.onPaste(e));
		this.#editor.addEventListener("input", () => this.onContentChange());

		setTimeout(() => this.tokenize(), 0);
	}

	get name(): EditorName {
		return this.#editorName;
	}

	get wrapper() {
		return this.#wrapper;
	}

	get editor() {
		return this.#editor;
	}

	get tokens(): readonly RichToken[] {
		return this.#tokens;
	}

	get scrollTop(): number {
		return this.#wrapper.scrollTop;
	}

	set scrollTop(value: number) {
		this.#wrapper.scrollTop = value;
	}

	get scrollLeft(): number {
		return this.#wrapper.scrollLeft;
	}

	set scrollLeft(value: number) {
		this.#wrapper.scrollLeft = value;
	}

	scrollToOffset(offset: number) {
		this.#wrapper.scrollTop = offset;
	}

	scrollByOffset(offset: number) {
		this.#wrapper.scrollTop += offset;
	}

	private onScroll(e: Event) {}

	private onContentChange() {
		this.tokenize();
	}

	private onMutation(mutations: MutationRecord[]) {
		if (this.#editor.childNodes.length === 0) {
			this.#editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
		}
	}

	private observeMutation() {
		this.#mutationObserver.observe(this.#wrapper, {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true,
		});
	}

	private unobserveMutation() {
		this.#mutationObserver.disconnect();
	}

	private onPaste(e: ClipboardEvent) {
		// 비교적 무거운 작업이지만 뒤로 미루면 안되는 작업이기 때문에 UI blocking을 피할 뾰족한 수가 없다.
		// 붙여넣기 이후 바로 추가 입력 => 붙여넣기를 뒤로 미루면 입력이 먼저 될테니까.
		console.time("paste");
		e.preventDefault();

		let rawHTML = e.clipboardData?.getData("text/html") ?? "";
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
			sanitized = formatPlaintext(e.clipboardData?.getData("text/plain") ?? "");
		}

		// 자존심 상하지만 document.execCommand("insertHTML",...)를 써야한다.
		// 1. 브라우저가 undo/redo 히스토리 관리를 할 수 있음.
		// 2. 필요한 경우 브라우저가 알아서 DOM을 수정해 줌.
		// 	예: 인라인 엘러먼트 안에 블럭 엘러먼트를 붙여넣는 경우 브라우저가 알아서 인라인 요소를 반으로 갈라서 블럭 엘러먼트를 밖으로 꺼내준다. 믿음직한가? 아니오.
		const div = document.createElement("DIV");
		div.appendChild(sanitized);
		this.unobserveMutation();
		document.execCommand("insertHTML", false, div.innerHTML);
		this.observeMutation();
		console.timeEnd("paste");
	}

	// 	const { observeEditor, unobserveEditor } = (() => {
	// 	const mutationObserver = new MutationObserver((mutations) => {
	// 		if (editor.childNodes.length === 0) {
	// 			editor.appendChild(INITIAL_EDITOR_HTML.cloneNode(true));
	// 			return;
	// 		}
	// 	});

	// 	function observeEditor() {
	// 		mutationObserver.observe(editor, {
	// 			childList: true,
	// 			// subtree: true,
	// 			// attributes: true,
	// 			// characterData: true,
	// 		});
	// 	}

	// 	function unobserveEditor() {
	// 		mutationObserver.disconnect();
	// 	}

	// 	return { observeEditor, unobserveEditor };
	// })();
	// observeEditor();

	findTokenOverlapIndices(range: Range): [number, number] {
		let low = 0;
		let high = this.#tokens.length - 1;
		let startIndex = -1;
		let endIndex = -1;
		// console.debug(editorName, "findTokenOverlapIndices", { range, text: range.toString() });

		/*
		comparePoint(referenceNode, offset)
			returns
				-1 if the point specified by the referenceNode and offset is before the start of this Range.
				0 if the point specified by the referenceNode and offset is within this Range (including the start and end points of the range).
				1 if the point specified by the referenceNode and offset is after the end of this Range.

		compareBoundaryPoints(how, otherRange)
			how
				Range.END_TO_END compares the end boundary-point of this Range to the end boundary-point of otherRange.
				Range.END_TO_START compares the start boundary-point of this Range to the end boundary-point of otherRange.
				Range.START_TO_END compares the end boundary-point of this Range to the start boundary-point of otherRange.
				Range.START_TO_START compares the start boundary-point of this Range to the start boundary-point of otherRange.
			returns
				-1 if the specified boundary-point of this Range is before the specified boundary-point of otherRange.
				0 if the specified boundary-point of this Range is the same as the specified boundary-point of otherRange.
				1 if the specified boundary-point of this Range is after the specified boundary-point of otherRange.
		*/
		const tokenRange = document.createRange();

		while (low <= high) {
			const mid = (low + high) >> 1;
			const token = this.#tokens[mid].range;
			tokenRange.setStart(token.startContainer, token.startOffset);
			tokenRange.setEnd(token.endContainer, token.endOffset);

			const c = range.compareBoundaryPoints(Range.END_TO_START, tokenRange);
			// console.debug(mid, this.#tokens[mid].text, c, this.#tokens[mid]);
			if (c < 0) {
				const c2 = range.compareBoundaryPoints(Range.START_TO_START, tokenRange);
				console.debug(">>", mid, this.#tokens[mid].text, c2, this.#tokens[mid]);
				startIndex = mid;
				high = mid - 1; // 왼쪽으로
			} else {
				low = mid + 1; // 오른쪽으로
			}
		}

		if (startIndex !== -1) {
			low = endIndex = startIndex;
			high = this.#tokens.length - 1;
			while (low <= high) {
				const mid = (low + high) >> 1;
				const token = this.#tokens[mid].range;
				tokenRange.setStart(token.startContainer, token.startOffset);
				tokenRange.setEnd(token.endContainer, token.endOffset);
				const c = range.compareBoundaryPoints(Range.START_TO_END, tokenRange);
				if (c > 0) {
					endIndex = mid + 1;
					low = mid + 1; // 오른쪽으로
				} else {
					high = mid - 1; // 왼쪽으로
				}
			}
		}
		// console.debug(editorName, "findTokenOverlapIndices", { range, text: range.toString(), startIndex, endIndex });
		return [startIndex, endIndex];
	}

	createTokenRange(index: number, count: number = 1) {
		const range = document.createRange();
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
			const nextToken = this.#tokens[index];
			if (prevToken) {
				range.setStart(prevToken.range.endContainer, prevToken.range.endOffset);
			} else {
				range.setStart(this.#editor, 0);
			}
			if (nextToken) {
				range.setEnd(nextToken.range.startContainer, nextToken.range.startOffset);
			} else {
				range.setEnd(this.#editor, this.#editor.childNodes.length);
			}
		}
		return range;
	}

	private tokenize() {
		const _TIMEOUT = 200;

		if (this.#tokenizeCallbackId !== null) {
			// 아직 실행되지 않고 대기 중인 콜백 취소
			cancelIdleCallback(this.#tokenizeCallbackId);
			this.#tokenizeCallbackId = null;
		}

		if (this.#tokenizeContext) {
			// 이미 콜백이 실행 중이라면 다음 step에서 취소처리해야하므로...
			this.#tokenizeContext.cancelled = true;
		}

		const startTime = performance.now();
		const ctx: TokinizeContext = (this.#tokenizeContext = {
			cancelled: false,
			content: this.#editor,
		});

		// 여기서 바로 generator를 생성을 해버리면 idleDeadline을 바로 넘겨줄 수가 없다.
		// generator 내부에서 idleDeadline을 획득하려면 "성급하게" yield를 해야되는데 그러면 황금같은 유휴시간을 한번 낭비하게 됨.
		let generator: ReturnType<typeof tokenizer> | null = null;
		const step = (idleDeadline: IdleDeadline) => {
			this.#tokenizeCallbackId = null;

			if (ctx.cancelled) {
				// 어차피 단일쓰레드이므로 콜백이 실행되는 도중에는 cancelled 값이 바뀔 수는 없음!
				// 그래서 next()를 호출하기 전에나 한번씩 확인해주면 됨.
				// 다만 generator 내부에서 주기적으로 yield을 해주지 않으면 토큰화가 끝날때까지 멈출 수 없음.
				console.debug(this.#editorName, "tokenize cancelled");
				return;
			}

			if (generator === null) {
				generator = tokenizer(ctx, idleDeadline);
			}

			const { done, value } = generator.next(idleDeadline);
			if (done) {
				const endTime = performance.now();
				({ tokens: this.#tokens } = value);
				console.log(this.#editorName, "tokenize done", Math.ceil(endTime - startTime) + "ms", value);
				this.onTokenizeDone();
			} else {
				this.#tokenizeCallbackId = requestIdleCallback(step, { timeout: _TIMEOUT });
			}
		};
		this.#tokenizeCallbackId = requestIdleCallback(step, { timeout: _TIMEOUT });
	}

	private onTokenizeDone() {
		this.#callbacks.onContentChanged();
	}

	getOrInsertStartAnchor(tokenIndex: number): HTMLElement | null {
		const token = this.#tokens[tokenIndex];
		let container: Node = token.range.startContainer;
		let beforeNode: Node;
		if (container.nodeType === 3) {
			beforeNode = container;
			container = container.parentElement!;
		} else {
			container = token.range.startContainer.parentNode!;
			beforeNode = token.range.startContainer;
		}

		do {
			if (BLOCK_ELEMENTS[container.nodeName]) {
				if (beforeNode) {
					let anchor = beforeNode.previousSibling;
					if (!anchor || anchor.nodeName !== "A") {
						anchor = document.createElement("A");
						container.insertBefore(anchor, beforeNode);
					}
					return anchor as HTMLElement;
				}
			}
			beforeNode = container;
			container = container.parentNode!;
		} while (container);
		return null;
	}

	*yieldAnchorPointsInRange(tokenIndex: number) {
		const prevToken = this.#tokens[tokenIndex - 1];
		const nextToken = this.#tokens[tokenIndex];

		let endContainer: Node;
		let endOffset: number;
		// let endNode: Node;
		let lastYielded: AnchorInsertionPoint | null = null;
		// console.log(editorName, "generateInsertionPointsInRange", { tokenIndex, prevToken, nextToken });

		let container: Node;
		let childIndex: number;
		const indexStack: number[] = [];

		if (prevToken && nextToken && prevToken.range.endContainer === nextToken.range.startContainer && prevToken.range.endContainer.nodeType === 3) {
			yield* createPoint(prevToken.range.endContainer, prevToken.range.endOffset!);
			return;
		}

		if (prevToken) {
			container = prevToken.range.endContainer;
			childIndex = prevToken.range.endOffset;
			if (container.nodeType === 3) {
				// 텍스트노드는 컨테이너로 지정되지 않음!
				yield* createPoint(container, childIndex);
				childIndex = Array.prototype.indexOf.call(container.parentNode!.childNodes, container) + 1;
				container = container.parentNode!;
			}
		} else {
			container = this.#editor;
			childIndex = 0;
		}

		if (nextToken) {
			endContainer = nextToken.range.startContainer;
			endOffset = nextToken.range.startOffset;
		} else {
			endContainer = this.#editor;
			endOffset = this.#editor.childNodes.length;
		}

		if (container === endContainer) {
			if (container.nodeType === 3) {
				yield* createPoint(container, childIndex);
				return;
			}
		}

		while (container) {
			if (!TEXTLESS_ELEMENTS[container.nodeName]) {
				yield* createPoint(container, childIndex);
			}

			if (container === endContainer && childIndex >= endOffset) {
				break;
			}

			let current: Node = container.childNodes[childIndex];
			if (!current) {
				current = container;
				container = container.parentNode!;
				if (indexStack.length > 0) {
					childIndex = indexStack.pop()!;
				} else {
					if (!container || !container.childNodes) {
						console.warn(this.#editorName, "No childNodes in container", current, container, prevToken, nextToken);
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

		function* createPoint(container: Node, offset: number, flags: number = 0) {
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

				const comparePrev = prevToken ? container.compareDocumentPosition(prevToken.range.endContainer) : 0;
				const compareNext = nextToken ? container.compareDocumentPosition(nextToken.range.startContainer) : 0;

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
}
