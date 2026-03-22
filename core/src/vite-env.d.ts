/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare global {
    interface Scheduler {
        yield(): Promise<void>;
    }

    var scheduler: Scheduler;
}

export { };