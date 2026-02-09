export type EventMap = {
    [key: string]: any;
};

export type Handler<T> = (data: T) => void;

export class EventEmitter<T extends EventMap> {
    // 내부 저장소도 Handler<any>로 수정
    private listeners: Record<string, Set<Handler<any>>> = {};

    on<K extends keyof T>(event: K, handler: Handler<T[K]>): void {
        const name = event as string;
        if (!this.listeners[name]) this.listeners[name] = new Set();
        this.listeners[name].add(handler as Handler<any>);
    }

    emit<K extends keyof T>(event: K, data: T[K]): void {
        const name = event as string;
        this.listeners[name]?.forEach(h => h(data));
    }
}