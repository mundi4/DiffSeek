// === createRPC (port-based, inlined from rpc.js) ===
function createRPC(port, { timeout = 3000 } = {}) {
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

// === createWindowRPC (postMessage-based, inlined from rpc-window.js) ===
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
						target.postMessage(
							{ rpcResponse: true, id: msg.id, result: result.result, source },
							result.transfer,
						);
					} else {
						target.postMessage({ rpcResponse: true, id: msg.id, result, source }, "*");
					}
				} catch (error) {
					target.postMessage({ rpcResponse: true, id: msg.id, error: error.message, source }, "*");
				}
			} else if (msg && msg.rpcResponse && pending.has(msg.id)) {
				const { resolve, reject, timer } = pending.get(msg.id);
				clearTimeout(timer);
				pending.delete(msg.id);
				if (msg.error) reject(msg.error);
				else resolve(msg.result);
			}
		});
	}

	return { call, handle };
}

// === content script 본체 ===
console.log("DiffSeekExt: diffseek content script active");

(function injectScript() {
	if (document.getElementById("diffseek-inject-script")) return;
	const script = document.createElement("script");
	script.id = "diffseek-inject-script";
	script.src = chrome.runtime.getURL("diffseek_inject.js");
	script.onload = function () {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(script);
})();

const port = chrome.runtime.connect({ name: "diffseek" });
const rpc = createRPC(port);
rpc.handle({});

const windowRPC = createWindowRPC({ source: "content", timeout: 3000 });
windowRPC.handle({
	fetchImageData: async (url) => {
		const result = await rpc.call("fetchImageData", [url]);
		return { result, transfer: result && result.data ? [result.data] : [] };
	},
});
