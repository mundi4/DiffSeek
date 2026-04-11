import '@core/core.css';
import { DiffseekEngine, type DiffOptions, type EditorName } from '@core';
import { getDefaultStore, Provider, useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DiffseekProvider } from './bridge/diffseek-provider';
import { SidebarFooter } from './components/sidebar-footer';
import { DiffList } from './components/diff-list';
import { InlineDiffPopover } from './components/inline-diff-popover';
// import { OutlineModal } from './components/outline-modal';
import { diffWorkflowStatusAtom, extensionEnabledAtom } from './states/core-atoms';
import './app.css';

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

const debugFixtures: { left?: string; right?: string } = {};
if (import.meta.env.DEV) {
    try {
        debugFixtures.left = (await import("./left.html?raw")).default;
    } catch { /* no fixture */ }
    try {
        debugFixtures.right = (await import("./right.html?raw")).default;
    } catch { /* no fixture */ }
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
                setDebugHtmlOpened(v => !v);
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
                <dialog ref={debugDialogRef} onClose={() => setDebugHtmlOpened(false)}
                    style={{ width: 520, padding: 16, borderRadius: 8, border: '1px solid #888' }}>
                    <h3 style={{ margin: '0 0 8px' }}>Debug HTML Inject</h3>
                    <textarea ref={debugTextareaRef} rows={10}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, boxSizing: 'border-box' }}
                        defaultValue="<p>b</p><p><br></p>" />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => injectHtml("left")}>Left</button>
                        <button onClick={() => injectHtml("right")}>Right</button>
                        <button onClick={() => setDebugHtmlOpened(false)}>Close</button>
                    </div>
                </dialog>
                {/* <BusyIndicator busy={diffWorkflowStatus.phase !== "idle"} /> */}
            </Provider>
        </DiffseekProvider>
    )
}


