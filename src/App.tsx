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

const store = getDefaultStore();

function App() {
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
				await loadDemoContent();
				//await loadFallbackContent();

				isInitialized.current = true;
				console.log(APP_MESSAGES.INIT_SUCCESS);
			} catch (error) {
				console.error(APP_MESSAGES.INIT_ERROR, error);
			}
		};

		initializeApp();
	}, [diffController]);

	const loadDemoContent = async () => {
		// 개발 환경에서만 데모 콘텐츠 로드
		if (import.meta.env.DEV) {
			try {
				const [leftModule, rightModule] = await Promise.all([
					import('@/assets/leftDemoContent.html?raw'),
					import('@/assets/rightDemoContent.html?raw')
				]);

				await leftEditor.setContent({ text: leftModule.default, asHTML: true });
				await rightEditor.setContent({ text: rightModule.default, asHTML: true });
			} catch (error) {
				console.error('Failed to load demo content:', error);
				// fallback to default content
				await loadFallbackContent();
			}


		} else {
			// production에서는 빈 에디터 또는 기본 콘텐츠
			await loadFallbackContent();
		}
	};

	const loadFallbackContent = async () => {
		// const leftContent = `<p><img src="file:///D:/KINGrinderK6_Settings.png" /></p>`;
		// const rightContent = `<p><img src="file:///D:/KINGrinderK6_Settings2.png" /></p>`;
		const leftContent = ``;
		const rightContent = ``;
		await leftEditor.setContent({ text: leftContent, asHTML: true });
		await rightEditor.setContent({ text: rightContent, asHTML: true });
	};

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
		</div >
	)
}

export default App
