import "@core/core.css";
import { DiffseekEngine, type DiffOptions, type EditorName } from "@core";
import { getDefaultStore, Provider, useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { DiffseekProvider } from "./bridge/diffseek-provider";
import { SidebarFooter } from "./components/sidebar-footer";
import { DiffList } from "./components/diff-list";
import { InlineDiffPopover } from "./components/inline-diff-popover";
import { Toast } from "./components/toast";
// import { OutlineModal } from './components/outline-modal';
import { diffWorkflowStatusAtom, extensionEnabledAtom, toastAtom } from "./states/core-atoms";
import "./app.css";

declare global {
	interface Window {
		DiffSeek: {
			setContent(side: EditorName, content: string, asHTML?: boolean): void;
			setExtensionEnabled(enabled: boolean): void;
		};
		__diffseekExtEnabled?: boolean;
		__diffseekFetchImage?: (url: string) => Promise<{ contentType: string; data: string } | null>;
	}
}

const engine = new DiffseekEngine();
const atomStore = getDefaultStore();

// ──────────────────────────────────────────────
// 파일 드롭 → 변환 서버 (Windows 로컬, localhost)
// DRM 문서는 서버의 Word COM 으로만 열 수 있어 무조건 서버 경유한다.
// 확장자별 엔드포인트: POST /api/convert/<fmt>-html
// ──────────────────────────────────────────────
// dev 서버는 4484, 프로덕션 빌드는 4483 (Vite가 빌드 시 정적 치환 → 죽은 가지 제거)
const CONVERT_API_PORT = import.meta.env.DEV ? 4484 : 4483;
const CONVERT_ENDPOINTS: Record<string, string> = {
	doc: "word-html",
	docx: "word-html",
	md: "md-html",
	markdown: "md-html",
};

let toastSeq = 0;
function showToast(variant: "loading" | "error", message: string): number {
	const id = ++toastSeq;
	atomStore.set(toastAtom, { id, message, variant });
	return id;
}
// 자기 토스트(id 일치)일 때만 해제 — 다른 에디터의 드롭이 띄운 토스트를 지우지 않도록.
function clearToast(id: number) {
	const current = atomStore.get(toastAtom);
	if (current && current.id === id) {
		atomStore.set(toastAtom, null);
	}
}

engine.setFileConvertFn(async (file) => {
	const ext = file.name.toLowerCase().split(".").pop() ?? "";
	const endpoint = CONVERT_ENDPOINTS[ext];
	if (!endpoint) {
		showToast("error", `지원하지 않는 형식입니다: ${file.name}`);
		return null;
	}

	const loadingToastId = showToast("loading", `${file.name} 변환 중…`);
	try {
		const res = await fetch(
			`http://localhost:${CONVERT_API_PORT}/api/convert/${endpoint}?filename=${encodeURIComponent(file.name)}`,
			{ method: "POST", body: file },
		);
		if (!res.ok) {
			let message = `변환 실패 (${res.status})`;
			try {
				const body = await res.json();
				if (body?.error) message = body.error;
			} catch {
				/* 에러 본문이 JSON이 아니면 기본 메시지 유지 */
			}
			showToast("error", message);
			return null;
		}
		clearToast(loadingToastId);
		return await res.text();
	} catch {
		showToast("error", `변환 서버에 연결할 수 없습니다 (localhost:${CONVERT_API_PORT})`);
		return null;
	}
});

const debugFixtures: { left?: string; right?: string } = {};
if (import.meta.env.DEV) {
	try {
		debugFixtures.left = (await import("./left.html?raw")).default;
	} catch {
		/* no fixture */
	}
	try {
		debugFixtures.right = (await import("./right.html?raw")).default;
	} catch {
		/* no fixture */
	}
}

function enableExtension() {
	engine.setExtensionEnabled(true);
	engine.setImageFetchFn(async (url) => {
		if (!window.__diffseekFetchImage) return null;
		try {
			const result = await window.__diffseekFetchImage(url);
			return result?.data ?? null;
		} catch {
			return null;
		}
	});
	atomStore.set(extensionEnabledAtom, true);
}

window.DiffSeek = {
	setContent(side, content, asHTML = true) {
		engine.setContent(side, content, asHTML);
	},
	setExtensionEnabled(enabled) {
		if (enabled) enableExtension();
	},
};

// 확장 감지: inject가 먼저 로드된 경우 플래그 확인, 나중에 로드되면 이벤트 수신
if (window.__diffseekExtEnabled) {
	enableExtension();
} else {
	window.addEventListener("diffseek-extension-ready", () => enableExtension(), { once: true });
}

engine.replaceDiffOptions({
	useCoarseSplit: false,
	whitespace: "collapse",
	// ...
} as Partial<DiffOptions>);

export function App() {
	const hostRef = useRef<HTMLDivElement>(null);
	const diffWorkflowStatus = useAtomValue(diffWorkflowStatusAtom);
	const [debugHtmlOpened, setDebugHtmlOpened] = useState(false);
	const debugTextareaRef = useRef<HTMLTextAreaElement>(null);
	const debugDialogRef = useRef<HTMLDialogElement>(null);

	const injectHtml = useCallback((side: EditorName) => {
		const html = debugTextareaRef.current?.value ?? "";
		engine.setContent(side, html, true);
		setDebugHtmlOpened(false);
	}, []);

	useEffect(() => {
		if (debugHtmlOpened) {
			debugDialogRef.current?.showModal();
			debugTextareaRef.current?.focus();
		} else {
			debugDialogRef.current?.close();
		}
	}, [debugHtmlOpened]);

	useEffect(() => {
		hostRef.current!.appendChild(engine.workspaceEl);

		const keyDown = (e: KeyboardEvent) => {
			if (e.key === "F9" && !(e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				setDebugHtmlOpened((v) => !v);
			} else if (e.key === "F2" && !(e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				engine.syncMode = !engine.syncMode;
			} else if ((e.key === "1" || e.key === "2") && e.altKey) {
				e.preventDefault();
				engine.pasteBomb(e.key === "1" ? "left" : "right");
			} else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				engine.scrollNudge("current", e.key === "ArrowUp" ? "up" : "down");
			}
		};

		window.addEventListener("keydown", keyDown);

		if (debugFixtures.left) engine.setContent("left", debugFixtures.left, true);
		if (debugFixtures.right) engine.setContent("right", debugFixtures.right, true);

		return () => {
			window.removeEventListener("keydown", keyDown);
			engine.workspaceEl.remove();
		};
	}, []);

	// useEffect(() => {
	//     const handleKeydown = (e: KeyboardEvent) => {
	//         if ((e.ctrlKey || e.metaKey) && e.key === ',') {
	//             e.preventDefault();
	//             appState.optionsModalOpen.value = !appState.optionsModalOpen.value;
	//         }
	//     };
	//     window.addEventListener('keydown', handleKeydown);
	//     return () => window.removeEventListener('keydown', handleKeydown);
	// }, []);

	return (
		<DiffseekProvider engine={engine}>
			<Provider store={atomStore}>
				{/* <div className="sidebar-footer-container"><SidebarFooter /></div> */}
				<main id="diffseek-host" ref={hostRef} />
				<aside>
					<DiffList />
					<SidebarFooter />
				</aside>
				<InlineDiffPopover hostRef={hostRef} />
				<Toast />
				<dialog
					ref={debugDialogRef}
					onClose={() => setDebugHtmlOpened(false)}
					style={{ width: 520, padding: 16, borderRadius: 8, border: "1px solid #888" }}
				>
					<h3 style={{ margin: "0 0 8px" }}>Debug HTML Inject</h3>
					<textarea
						ref={debugTextareaRef}
						rows={10}
						style={{ width: "100%", fontFamily: "monospace", fontSize: 13, boxSizing: "border-box" }}
						defaultValue="<p>b</p><p><br></p>"
					/>
					<div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
						<button onClick={() => injectHtml("left")}>Left</button>
						<button onClick={() => injectHtml("right")}>Right</button>
						<button onClick={() => setDebugHtmlOpened(false)}>Close</button>
					</div>
				</dialog>
				{/* <BusyIndicator busy={diffWorkflowStatus.phase !== "idle"} /> */}
			</Provider>
		</DiffseekProvider>
	);
}
