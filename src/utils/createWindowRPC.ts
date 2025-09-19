export type WindowRPCMethods = Record<string, (...args: any[]) => any>;

export interface WindowRPCRequest {
    rpcRequest: true;
    id: number;
    method: string;
    params?: any[];
    source: string;
}

export interface WindowRPCResponse {
    rpcResponse: true;
    id: number;
    result?: any;
    error?: string;
    source: string;
}

// 개선: 제공 함수와 원격 호출 함수 타입을 분리 + call에서 transfer 지원
export function createWindowRPC<
    LocalMethods extends WindowRPCMethods,
    RemoteMethods extends WindowRPCMethods
>(
    { target = window, timeout: defaultTimeout = 3000, source = "rpc" }: {
        target?: Window,
        timeout?: number,
        source?: string
    } = {}
) {
    let id = 1;
    const pending = new Map<number, {
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
        timer: ReturnType<typeof setTimeout>;
    }>();

    function call<K extends keyof RemoteMethods>(
        method: K,
        params: Parameters<RemoteMethods[K]>,
        timeout: number = defaultTimeout,
        transfer?: Transferable[]
    ): Promise<ReturnType<RemoteMethods[K]>> {
        return new Promise((resolve, reject) => {
            const reqId = id++;
            const timer = setTimeout(() => {
                pending.delete(reqId);
                reject(new Error("RPC timeout"));
            }, timeout);
            pending.set(reqId, { resolve, reject, timer });
            if (transfer && transfer.length > 0) {
                target.postMessage({ rpcRequest: true, id: reqId, method, params, source }, "*", transfer);
            } else {
                target.postMessage({ rpcRequest: true, id: reqId, method, params, source }, "*");
            }
        });
    }

    function handle(methods: LocalMethods) {
        window.addEventListener("message", async (event: MessageEvent) => {
            const msg = event.data;
            if (
                msg &&
                msg.rpcRequest &&
                msg.source !== source &&
                typeof methods[msg.method] === "function"
            ) {
                try {
                    const result = await methods[msg.method](...(msg.params || []));
                    // result가 {result, transfer} 형태면 transfer list 지원
                    if (result && result.transfer) {
                        target.postMessage(
                            { rpcResponse: true, id: msg.id, result: result.result, source },
                            result.transfer
                        );
                    } else {
                        target.postMessage({ rpcResponse: true, id: msg.id, result, source }, "*");
                    }
                } catch (error: any) {
                    target.postMessage({ rpcResponse: true, id: msg.id, error: error?.message ?? String(error), source }, "*");
                }
            } else if (msg && msg.rpcResponse && pending.has(msg.id)) {
                const { resolve, reject, timer } = pending.get(msg.id)!;
                clearTimeout(timer);
                pending.delete(msg.id);
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
            }
        });
    }

    return { call, handle };
}