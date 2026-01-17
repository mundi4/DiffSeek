import { DiffseekEngine, type InternalDiffseekEventMap } from './DiffseekEngine';

export type Handler<T> = (data: T) => void;

export function CreateDiffseek() {
    let _containerEl: HTMLElement | null = null;
    const engine = new DiffseekEngine({});
    let _stateChanged = false;

    let _stateCache: Diffseek['state'] = {
        syncMode: engine.syncMode,
    };

    engine.syncModeChanged.on(() => {
        _stateChanged = true;
    });
    engine.diffContextChanged.on(() => {
        _stateChanged = true;
    });

    const instance: Diffseek = {
        mount(el: HTMLElement) {
            this.unmount();
            el.appendChild(engine.workspaceEl);
            _containerEl = el;
        },

        unmount() {
            if (_containerEl) {
                _containerEl.removeChild(engine.workspaceEl);
                _containerEl = null;
            }
        },

        get syncMode(): boolean {
            return engine.syncMode;
        },

        set syncMode(value: boolean) {
            if (engine.syncMode === value) {
                return;
            }
            engine.syncMode = value;
        },

        get state() {
            if (_stateChanged) {
                _stateCache = {
                    syncMode: engine.syncMode,
                };
                _stateChanged = false;
            }
            return _stateCache;
        },

        on<K extends keyof DiffseekEventMap>(event: K, handler: Handler<DiffseekEventMap[K]>) {
            engine.on(event, handler);
        },

        off<K extends keyof DiffseekEventMap>(event: K, handler: Handler<DiffseekEventMap[K]>) {
            engine.off(event, handler);
        },
    };

    return instance;
}



export interface Diffseek {
    mount(el: HTMLElement): void;
    unmount(): void;

    on<K extends keyof DiffseekEventMap>(
        event: K,
        handler: (data: DiffseekEventMap[K]) => void
    ): void;

    off<K extends keyof DiffseekEventMap>(
        event: K,
        handler: (data: DiffseekEventMap[K]) => void
    ): void;

    get syncMode(): boolean;
    set syncMode(value: boolean);

    readonly state: {
        readonly syncMode: boolean;
    };
}

export type DiffseekEventMap = Exclude<InternalDiffseekEventMap, "diffContextChanged">;