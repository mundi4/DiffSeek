function createWindowRPC({ target = window, timeout: defaultTimeout = 3000, source = "rpc" } = {}) {
	let id = 1;
	const pending = new Map();

	function call(method, params, timeout = defaultTimeout, transferList) {
		return new Promise((resolve, reject) => {
			const reqId = id++;
			const timer = setTimeout(() => {
				pending.delete(reqId);
				reject(new Error("RPC timeout"));
			}, timeout);
			pending.set(reqId, { resolve, reject, timer });
			
			if (transferList) {
				target.postMessage({ rpcRequest: true, id: reqId, method, params, source }, "*", transferList);
			} else {
				target.postMessage({ rpcRequest: true, id: reqId, method, params, source }, "*");
			}
		});
	}

	function handle(methods) {
		window.addEventListener("message", async (event) => {
			const msg = event.data;
			if (msg && msg.rpcRequest && msg.source !== source && typeof methods[msg.method] === "function") {
				try {
					const result = await methods[msg.method](...(msg.params || []));
					if (result && result.transfer) {
						target.postMessage({ rpcResponse: true, id: msg.id, result: result.result, source }, result.transfer);
					} else {
						target.postMessage({ rpcResponse: true, id: msg.id, result, source }, "*");
					}
				} catch (error) {
					target.postMessage({ rpcResponse: true, id: msg.id, error: error.message, source }, "*");
				}
			} else if (msg && msg.rpcResponse && pending.has(msg.id)) {
				const { resolve, reject, timer } = pending.get(msg.id);
				clearTimeout(timer);
				console.log("response received", msg);
				pending.delete(msg.id);
				if (msg.error) reject(msg.error);
				else resolve(msg.result);
			}
		});
	}

	return { call, handle };
}
