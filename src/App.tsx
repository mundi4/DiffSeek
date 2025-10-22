import { useEffect, useRef } from 'react'
import EditorPanel from './components/EditorPanel'
import { AppSidebar } from './components/AppSidebar'
import { getDefaultStore, useAtomValue } from 'jotai'
import { editorTextSelectionAtom, hoveredDiffIndexAtom, syncModeAtom, visibleDiffsAtom } from './states/atoms'
import { useDiffControllerContext } from './hooks/useDiffController';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import * as styles from './App.css';
import { ResizablePanelGroup } from './components/resizable/ResizablePanelGroup';
import { ResizablePanel } from './components/resizable/ResizablePanel';
import { UI_CONSTANTS, APP_MESSAGES } from './constants/appConstants';
import clsx from 'clsx';
import { diffOptionsAtom } from './states/diffOptionsAtom'
import type { Editor } from './core'
import { ImageTooltipLayer } from './components/ImageTooltip'

const store = getDefaultStore();
const loadDemoContent = async (leftEditor: Editor, rightEditor: Editor) => {
	await loadFallbackContent(leftEditor, rightEditor);
	// 개발 환경에서만 데모 콘텐츠 로드
	// if (import.meta.env.DEV) {
	// 	try {
	// 		const [leftModule, rightModule] = await Promise.all([
	// 			import('@/assets/leftDemoContent.html?raw'),
	// 			import('@/assets/rightDemoContent.html?raw')
	// 		]);
	// 		await leftEditor.setContent({ text: leftModule.default, asHTML: true });
	// 		await rightEditor.setContent({ text: rightModule.default, asHTML: true });
	// 	} catch (error) {
	// 		console.error('Failed to load demo content:', error);
	// 		// fallback to default content
	// 		await loadFallbackContent(leftEditor, rightEditor);
	// 	}
	// } else {
	// 	// production에서는 빈 에디터 또는 기본 콘텐츠
	// 	await loadFallbackContent(leftEditor, rightEditor);
	// }
};

const loadFallbackContent = async (leftEditor: Editor, rightEditor: Editor) => {
	// const leftContent = `<p><img src="file:///D:/KINGrinderK6_Settings.png" /></p>`;
	// const rightContent = `<p><img src="file:///D:/KINGrinderK6_Settings2.png" /></p>`;
	const leftContent = `
	<br/><br/><br/>
	<p><img
  alt="Diffseek Icon"
  width="24"
  height="24"
  src="data:image/svg+xml;utf8,
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <rect width='64' height='64' rx='12' fill='%23101010'/>
    <rect x='8' y='12' width='20' height='40' rx='4' fill='%230078ff'/>
    <rect x='36' y='12' width='20' height='40' rx='4' fill='%23ff3d7f'/>
    <rect x='31' y='12' width='2' height='40' fill='%23ffffff'/>
  </svg>"
/> Diffseek</p>
	<br/>
	<h3>1. 덩치 큰 워드 문서가 복사-붙여넣기가 안될 때가 있어요.</h3>
	<p>가. 이건 전적으로 MS 워드(혹은 DRM?)의 문제인데</p>
	<p>나. ctrl-v를 누르기도 전 ctrl-c 단계에서 발생하는 증상이고 이 때 워드는 정신 못차리고 바보 상태...</p>
	<p>다. 워드가 정신 차릴 때까지 붙여넣기 하세요. 그게 과학 입니다.</p>
	<br/><br/><br/>
	<h3>2. F2를 누르면 긴 문서를 그나마 좀 편하게 볼 수 있어요.</h3>
	<p>가. 이때 편집은 불가능.</p>
	<p>나. <strong>F2</strong>로 껐다 켰다 하면 돼요.</p>
	<br/><br/><br/>
	<h3>3. 공백</h3>
	<p>공백은 기본적으로 무시하지만, 오른쪽 아래 설정버튼 눌러보시면...</p>


	<br/><br/><br/>
	<p><em style="color:red">문서에 그림이 나오는 순간... 아무 것도 믿지 마세요.</em></p>
	<br/>
	<h4>🧹 CTRL-R로 내용 지우기</h4>
	`;

	const rightContent = `
	<p><img
  alt="Diffseek Icon"
  width="24"
  height="24"
  src="data:image/svg+xml;utf8,
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <rect width='64' height='64' rx='12' fill='%23101010'/>
    <rect x='8' y='12' width='20' height='40' rx='4' fill='%230078ff'/>
    <rect x='36' y='12' width='20' height='40' rx='4' fill='%23ff3d7f'/>
    <rect x='31' y='12' width='2' height='40' fill='%23ffffff'/>
  </svg>"
/> Diffseek</p>
	<br/>
	<h3>1. 덩치 큰 워드 문서가 복사-붙여넣기가 잘 안될 때가 있어요.</h3>
	<p>가. 이건 전적으로 M$ 워드(혹은 DRM?)의 문제인데</p>
	<p>나. ctrl-v를 누르기도 전 ctrl-c 단계에서 발생하는 증상이고 이 때 워드는 정신 못차리고 바보 상태...</p>
	<p>다. 그냥 될 때까지 붙여넣기 하세요. 그게 science 입니다.</p>
	<br/>
	<h3>2. F2를 누르면 큰 문서를 그나마 좀 편하게 볼 수 있어요.</h3>
	<p>가. 이때 편집은 불가능.</p>
	<p>나. <strong>F2</strong>로 껐다 켰다 하면 돼요.</p>
	<br/>
	
	<h3>3. 공백</h3>
	<p>공백은 기본적으로 무시하지만, 오른쪽 아래 설정버튼 눌러보시면...</p>

	<br/>
	<p><em style="color:red">문서에 그림이 나오는 순간... 아무 것도 믿지 마세요.</em></p>
	<br/><br/>
	<h2>🧹 CTRL-R로 지우기</h2>
	`;

	await leftEditor.setContent({ text: leftContent, asHTML: true });
	await rightEditor.setContent({ text: rightContent, asHTML: true });
};

function App() {
	const hideWelcome = localStorage.getItem('hideWelcome') === 'true';

	const { diffController, leftEditor, rightEditor } = useDiffControllerContext();
	const syncMode = useAtomValue(syncModeAtom);
	const isInitialized = useRef(false);
	useKeyboardShortcuts();

	// 앱 초기화
	useEffect(() => {
		if (isInitialized.current) return;

		const initializeApp = async () => {
			try {
				// DOM이 준비될 때까지 기다림
				await new Promise(resolve => setTimeout(resolve, 0));

				// 데모 콘텐츠 로드 (async)
				if (!hideWelcome) {
					await loadDemoContent(leftEditor, rightEditor);
					//await loadFallbackContent();
				}

				isInitialized.current = true;
				console.log(APP_MESSAGES.INIT_SUCCESS);
			} catch (error) {
				console.error(APP_MESSAGES.INIT_ERROR, error);
			}
		};

		(window as any).DiffSeek = (window as any).DiffSeek || {};
		(window as any).DiffSeek.setContent = (side: 'left' | 'right', text: string, asHTML = false) => {
			if (side === 'left') {
				return leftEditor.setContent({ text, asHTML });
			} else {
				return rightEditor.setContent({ text, asHTML });
			}
		};
		(window as any).DiffSeek.setOptions = (options: Partial<DiffOptions>) => {
			if (!options || typeof options !== "object") return;
			store.set(diffOptionsAtom, prev => ({
				...prev,
				...options,
			}));
		};

		(window as any).DiffSeek.dumpTokens = (options: Partial<DiffOptions>) => {
			const arr = [leftEditor.tokens, rightEditor.tokens];
			for (let i = 0; i < arr.length; i++) {
				for (let j = 0; j < arr[i].length; j++) {
					const token = arr[i][j];
					console.log(`--- Editor ${i} Token ${j} ---`);
					console.log(token);
				}
			}
		};
		(window as any).DiffSeek.setExtensionEnabled = (enable: boolean = true) => {
			window.extensionEnabled = enable;
		}

		initializeApp();
	}, [diffController, leftEditor, rightEditor]);



	useEffect(() => {
		const unsubscribe: (() => void)[] = [];

		unsubscribe.push(diffController.onDiffWorkflowStart(() => {
			//console.log("Diff workflow started");
		}));

		unsubscribe.push(diffController.onDiffComputing(() => {
			//console.log("Diff computing started", e);
		}));

		unsubscribe.push(diffController.onDiffWorkflowDone(() => {
			//console.log("Diff workflow done", diffContext);
		}));

		unsubscribe.push(diffController.onSyncModeChange((syncMode) => {
			store.set(syncModeAtom, syncMode);
		}));

		unsubscribe.push(diffController.onDiffVisibilityChanged(() => {
			store.set(visibleDiffsAtom, diffController.getVisibleDiffs());
		}));

		unsubscribe.push(diffController.onHoveredDiffIndexChange(() => {
			// console.log("Hovered diff index changed to", diffIndex);
		}));

		unsubscribe.push(diffController.onTextSelection((e) => {
			store.set(editorTextSelectionAtom, e.selection ?? null);
		}));

		unsubscribe.push(store.sub(hoveredDiffIndexAtom, () => {

		}));


		return () => {
			for (const off of unsubscribe) off();
		}
	}, [diffController]);

	useEffect(() => {
		diffController.syncMode = syncMode;
	}, [diffController, syncMode]);

	return (
		<div>
			<div className={clsx(styles.appLayout)}>
				<ResizablePanelGroup direction='horizontal'>
					<ResizablePanel minSize={UI_CONSTANTS.MAIN_PANEL_MIN_SIZE} key="main">
						<EditorPanel />
					</ResizablePanel>
					<ResizablePanel minSize={UI_CONSTANTS.SIDEBAR_MIN_SIZE} key="side" initialSize={UI_CONSTANTS.SIDEBAR_INITIAL_SIZE}>
						<AppSidebar />
					</ResizablePanel>
				</ResizablePanelGroup >
			</div>
			<ImageTooltipLayer />
		</div >
	)
}

export default App
