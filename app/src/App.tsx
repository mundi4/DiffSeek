import '@mantine/core/styles.css';
import { useEffect, useRef } from 'react'
import { DiffseekEngine } from '@core/DiffseekEngine';
import './App.css';
import '@core/core.css';
import { diffsAtom, visibleDiffIndexesAtom } from './states/diffAtoms';
import { getDefaultStore, Provider, useSetAtom, useStore } from 'jotai';
import { DiffList } from './components/DiffList';
import { AppHeader } from './components/AppHeader';
import { syncModeAtom } from './states/viewAtoms';
import { DiffseekProvider } from './bridge/DiffseekProvider';
import type { DiffOptions } from '@core/types';

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

        if (hostRef.current!.firstElementChild) {
            return;
        }
        hostRef.current!.appendChild(engine.workspaceEl);
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


