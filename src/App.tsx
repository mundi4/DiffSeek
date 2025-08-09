import { useEffect } from 'react'

// import './style.css'
import './reset.css';
import EditorPanel from './components/EditorPanel'
import { AppSidebar } from './components/AppSidebar'
import { getDefaultStore, useAtomValue, useSetAtom } from 'jotai'
import { editorPanelLayoutAtom, editorTextSelectionAtom, hoveredDiffIndexAtom, magnifierEnabledAtom, syncModeAtom, visibleDiffsAtom } from './states/atoms'
import { useDiffControllerContext } from './hooks/useDiffController';
import { diffOptionsAtom } from './states/diffOptionsAtom';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from './lib/utils';

const store = getDefaultStore();

function App() {
	const { diffController, leftEditor, rightEditor } = useDiffControllerContext();
	const setEditorLayout = useSetAtom(editorPanelLayoutAtom);
	const setMagnifierEnabled = useSetAtom(magnifierEnabledAtom);
	const syncMode = useAtomValue(syncModeAtom);

	useEffect(() => {
		const unsubscribe: (() => void)[] = [];

		unsubscribe.push(diffController.onDiffWorkflowStart(() => {
			console.log("Diff workflow started");
		}));

		unsubscribe.push(diffController.onDiffComputing((e) => {
			console.log("Diff computing started", e);
		}));

		unsubscribe.push(diffController.onDiffWorkflowDone((diffContext) => {
			console.log("Diff workflow done", diffContext);
		}));

		unsubscribe.push(diffController.onSyncModeChange((syncMode) => {
			store.set(syncModeAtom, syncMode);
		}));

		// unsubscribe.push(diffEngine.onDiffError((error) => {
		// 	console.error("Diff error:", error);
		// 	toast.error("Diffing failed: " + error.message, { id: DIFF_WORKFLOW_TOAST_ID });
		// }));		

		unsubscribe.push(diffController.onDiffVisibilityChanged((_changes) => {
			store.set(visibleDiffsAtom, diffController.getVisibleDiffs());
		}));

		unsubscribe.push(diffController.onHoveredDiffIndexChange((_diffIndex) => {
			// console.log("Hovered diff index changed to", diffIndex);
		}));

		unsubscribe.push(store.sub(diffOptionsAtom, () => {
			diffController.updateDiffOptions(store.get(diffOptionsAtom));
		}));

		unsubscribe.push(diffController.onTextSelection((e) => {
			store.set(editorTextSelectionAtom, e.selection ?? null);
		}));

		unsubscribe.push(store.sub(hoveredDiffIndexAtom, () => {

		}));





		setTimeout(() => {
			diffController.leftEditor.setContent(`
    <table>
  <tr>
    <td style="width: 200px;">
      <p>1. 개요</p>
      <p><br></p>
      <p>2. <span style="color:red;">작업 흐름</span></p>
      <p><br></p>
      <p>3. 역할과 권한</p>
      <p><br></p>
      <p>4. 프로세스 세부 단계</p>
      <p><br></p>
      <p>5. 문서화 및 보관</p>
      <p><br></p>
    </td>
    <td style="width: 800px;">
      <p>이 문서는 우리 회사의 전반적인 업무 흐름을 이해하는 데 도움을 주기 위한 가이드입니다.</p>
      <p>부서 간 업무 방식의 기준을 명확히 하여 협업을 효율적으로 돕는 것을 목표로 합니다.</p>
      <p>전체 프로세스는 구조적으로 짜여져 있으며, 각 단계마다 구체적인 역할과 책임이 부여되어 있습니다.</p>
      <p>이를 통해 오류를 줄이고 협업의 시너지를 높일 수 있습니다.</p>
      <p>내용은 실무자가 바로 이해하고 적용할 수 있도록 정리되었으며, 업무 수행 중 참고 자료로 활용 가능합니다.</p>
      <p>또한 실무상 마주할 수 있는 다양한 이슈에 대한 대응책도 포함되어 있어 업무에 실질적인 도움이 됩니다.</p>
      <p><br></p>
      <p>1) 작업 시작 전, 필요한 자료와 도구를 준비하고 체크리스트를 확인합니다.</p>
      <p>2) 정해진 단계별 지침에 따라 업무를 수행하며, 문제 발생 시 즉각적으로 대응합니다.</p>
      <p>3) 중간 결과는 일정 주기마다 검토하여 품질을 유지합니다.</p>
      <p>4) 최종 산출물은 상급자의 확인을 거쳐 공식 문서로 정리합니다.</p>
      <p>5) 추가 조치가 필요한 경우, 관련 부서와 협력하여 빠르게 처리합니다.</p>
      <p>6) 전체 진행 과정은 기록으로 남겨 개선 및 보고에 활용합니다.</p>
      <p><br></p>
      <p>가. 모든 부서는 고유의 책임과 권한을 갖고 있습니다.</p>
      <p>나. 발생하는 문제는 해당 책임 부서에서 신속히 처리합니다.</p>
      <p>다. 업무 권한은 회사 방침 및 관련 규정에 따라 부여되며, 반드시 이를 준수해야 합니다.</p>
      <p>라. 담당자는 자신에게 부여된 권한 범위 내에서만 의사결정을 할 수 있습니다.</p>
      <p><br></p>
      <p>(1) 사전 준비</p>
      <p>- 업무 범위 설정 및 자원 점검</p>
      <p>- 관련 법규 및 사내 정책 검토</p>
      <p>(2) 실행</p>
      <p>- 계획에 따라 작업 수행</p>
      <p>- 이슈 발생 시 실시간 대응</p>
      <p>(3) 종료</p>
      <p>- 결과 검토 및 문서화</p>
      <p>- 산출물 보관 및 후속 관리</p>
      <p><br></p>
      <p>가. 모든 업무 기록은 정해진 기준에 따라 정리되고 관리되어야 합니다.</p>
      <p>나. 문서의 생성에서 폐기까지 전 과정은 절차에 맞춰 처리합니다.</p>
      <p>다. 디지털과 인쇄 문서 모두 접근 제한과 보안을 철저히 관리합니다.</p>
      <p>라. 버전 관리를 통해 문서가 항상 최신 상태를 유지하도록 합니다.</p>
    </td>
  </tr>
</table>
`);
			diffController.rightEditor.setContent(`
       <table> <tr> <td><p>1. 개요</p></td> <td> <p>이 문서는 우리 회사의 전반적인 업무 흐르믈 이해하는 데 도움을 주기 위한 가이드입니다. 부서 간 업무 방식의 기준을 명확히 하여 협업을 효율적으로 돕는 것을 목표로 합니다.</p> <p>전체 프로세스는 구조적으로 짜여져 있으며, 각 단계마다 구체적인 역할과 책임이 부여되어 있습니다. 이를 통해 오류를 줄이고 협업의 시너지를 높일 수 있습니다.</p> <p>내용은 실무자가 바로 이해하고 적용할 수 있도록 정리되었으며, 업무 수행 중 참고 자료로 활용 가능합니다.</p> <p>또한 실무상 마주할 수 있는 다양한 이슈에 대한 대응책도 포함되어 있어 업무에 실질적인 도움이 됩니다.</p> </td> </tr> <tr> <td><p>2. 작업 흐름</p></td> <td> <p>1) 작업 시작 전, 필요한 자료와 도구를 준비하고 체크리스트를 확인합니다.</p> <p>2) 정해진 단계별 지침에 따라 업무를 수행하며, 문제 발생 시 즉각적으로 대응합니다.</p> <p>3) 중간 결과는 일정 주기마다 검토하여 품질을 유지합니다.</p> <p>4) 최종 산출물은 상급자의 확인을 거쳐 공식 문서로 정리합니다.</p> <p>5) 추가 조치가 필요한 경우, 관련 부서와 협력하여 빠르게 처리합니다.</p> <p>6) 전체 진행 과정은 기록으로 남겨 개선 및 보고에 활용합니다.</p> </td> </tr> <tr> <td><p>3. 역할과 권한</p></td> <td> <p>가. 모든 부서는 고유의 책임과 권한을 갖고 있습니다.</p> <p>나. 발생하는 문제는 해당 책임 부서에서 신속히 처리합니다.</p> <p>다. 업무 권한은 회사 방침 및 관련 규정에 따라 부여되며, 반드시 이를 준수해야 합니다.</p> <p>라. 담당자는 자신에게 부여된 권한 범위 내에서만 의사결정을 할 수 있습니다.</p> </td> </tr> <tr> <td><p>4. 프로세스 세부 단계</p></td> <td> <p>(1) 사전 준비</p> <p>- 업무 범위 설정 및 자원 점검</p> <p>- 관련 법규 및 사내 정책 검토</p> <p>(2) 실행</p> <p>- 계획에 따라 작업 수행</p> <p>- 이슈 발생 시 실시간 대응</p> <p>(3) 종료</p> <p>- 결과 검토 및 문서화</p> <p>- 산출물 보관 및 후속 관리</p> </td> </tr> <tr> <td><p>5. 문서화 및 보관</p></td> <td> <p>가. 모든 업무 기록은 정해진 기준에 따라 정리되고 관리되어야 합니다.</p> <p>나. 문서의 생성에서 폐기까지 전 과정은 절차에 맞춰 처리합니다.</p> <p>다. 디지털과 인쇄 문서 모두 접근 제한과 보안을 철저히 관리합니다.</p> <p>라. 버전 관리를 통해 문서가 항상 최신 상태를 유지하도록 합니다.</p> </td> </tr> </table>
`);
		}, 0);

		return () => {
			for (const off of unsubscribe) off();
			//diffEngineRef.current = null;
		}
	}, []);

	useEffect(() => {
		diffController.syncMode = syncMode;
	}, [syncMode]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "F2") {
				e.preventDefault();
				diffController.syncMode = !diffController.syncMode;
			}

			if (e.key === "F3") {
				e.preventDefault();
				setMagnifierEnabled(current => !current);
			}

			if (e.key === "F10") {
				e.preventDefault();
				setEditorLayout(current => current === 'horizontal' ? 'vertical' : 'horizontal');
				diffController.alignEditors();
				diffController.renderer.invalidateAll();
			}

			if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
				e.preventDefault();
				const editor = e.key === "1" ? leftEditor : rightEditor;
				editor.pasteBomb();




			}
		};
		window.addEventListener("keydown", handleKeyDown);



		return () => {
			window.removeEventListener("keydown", handleKeyDown);

		};
	}, []);

	return (
		<div>
			<div className={cn("w-screen h-screen grid grid-cols-[1fr_auto]")}>

				<ResizablePanelGroup direction='horizontal'>
					<ResizablePanel defaultSize={80}>
						<EditorPanel />
					</ResizablePanel>
					<ResizableHandle />
					<ResizablePanel defaultSize={20} minSize={7} maxSize={50}>
						<AppSidebar />
					</ResizablePanel>
				</ResizablePanelGroup >
				{/* <div className={styles.main}>
				</div> */}
			</div>
		</div >
	)
}

export default App
