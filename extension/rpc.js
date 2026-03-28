function createRPC(port, { timeout: timeout = 3000 } = {}) {
    let id = 1;
    const pending = new Map();

    port.onMessage.addListener((msg) => {
        if (msg.rpcResponse && pending.has(msg.id)) {
            const { resolve, reject, timer } = pending.get(msg.id);
            clearTimeout(timer);
            pending.delete(msg.id);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
        }
    });

    function call(method, params, timeoutOverride = timeout) {
        return new Promise((resolve, reject) => {
            const reqId = id++;
            const timer = setTimeout(() => {
                pending.delete(reqId);
                reject(new Error("RPC timeout"));
            }, timeoutOverride);
            pending.set(reqId, { resolve, reject, timer });
            port.postMessage({ rpcRequest: true, id: reqId, method, params });
        });
    }

    function handle(methods) {
        port.onMessage.addListener(async (msg) => {
            if (msg.rpcRequest && typeof methods[msg.method] === "function") {
                try {
                    const result = await methods[msg.method](...(msg.params || []));
                    port.postMessage({ rpcResponse: true, id: msg.id, result });
                } catch (error) {
                    port.postMessage({ rpcResponse: true, id: msg.id, error: error.message });
                }
            }
        });
    }

    return { call, handle };
}