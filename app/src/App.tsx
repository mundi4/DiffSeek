import '@core/core.css';
import { DiffseekEngine, type DiffOptions } from '@core';
import '@mantine/core/styles.css';
import { getDefaultStore, Provider } from 'jotai';
import { useEffect, useRef } from 'react';
import './App.css';
import { DiffseekProvider } from './bridge/DiffseekProvider';
import { AppHeader } from './components/AppHeader';
import { DiffList } from './components/DiffList';

const engine = new DiffseekEngine({});
engine.replaceDiffOptions({
    useCoarseSplit: false,
    whitespace: "collapse",
    // ...
} as Partial<DiffOptions>);

const atomStore = getDefaultStore();
export function App() {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log("mounting DiffseekRuntime...");

        if (!hostRef.current!.firstElementChild) {
            hostRef.current!.appendChild(engine.workspaceEl);
        }

        const keyDown = (e: KeyboardEvent) => {
            if (e.key === "F2" && !(e.ctrlKey || e.metaKey)) {
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
                <header>
                    <AppHeader />
                </header>
                <main id="diffseek-host" ref={hostRef} />
                <aside>
                    <DiffList />
                </aside>
            </Provider>
        </DiffseekProvider>
    )
}


