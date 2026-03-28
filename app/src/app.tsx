import '@core/core.css';
import { DiffseekEngine, type DiffOptions, type EditorName } from '@core';
import '@mantine/core/styles.css';
import { getDefaultStore, Provider, useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { DiffseekProvider } from './bridge/diffseek-provider';
import { AppHeader } from './components/app-header';
import { DiffList } from './components/diff-list';
import { OutlineModal } from './components/outline-modal';
import { BusyIndicator } from "./components/busy-indicator";
import { diffWorkflowStatusAtom, extensionEnabledAtom } from './states/core-atoms';
import './app.css';

declare global {
    interface Window {
        DiffSeek: {
            setContent(side: EditorName, content: string, asHTML?: boolean): void;
            setExtensionEnabled(enabled: boolean): void;
        };
    }
}

const engine = new DiffseekEngine();

window.DiffSeek = {
    setContent(side, content, asHTML = true) {
        engine.setContent(side, content, asHTML);
    },
    setExtensionEnabled(enabled) {
        engine.setExtensionEnabled(enabled);
        atomStore.set(extensionEnabledAtom, enabled);
    },
};

engine.replaceDiffOptions({
    useCoarseSplit: false,
    whitespace: "collapse",
    // ...
} as Partial<DiffOptions>);

const atomStore = getDefaultStore();
export function App() {
    const hostRef = useRef<HTMLDivElement>(null);
    const diffWorkflowStatus = useAtomValue(diffWorkflowStatusAtom);
    const [outlineOpened, setOutlineOpened] = useState(false);

    useEffect(() => {
        hostRef.current!.appendChild(engine.workspaceEl);

        const keyDown = (e: KeyboardEvent) => {
            if (e.key === "F9" && !(e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setOutlineOpened(true);
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
                {/* <div className="app-header-container"><AppHeader /></div> */}
                <main id="diffseek-host" ref={hostRef} />
                <aside>
                    <DiffList />
                    <AppHeader />
                </aside>
                <OutlineModal opened={outlineOpened} onClose={() => setOutlineOpened(false)} />
                {/* <BusyIndicator busy={diffWorkflowStatus.phase !== "idle"} /> */}
            </Provider>
        </DiffseekProvider>
    )
}


