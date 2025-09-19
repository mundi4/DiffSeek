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

	// transfer 관련 코드 제거
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

chrome.runtime.onInstalled.addListener(() => {
	console.log("DiffSeekExt background loaded");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	//console.log("DiffSeekExt background received message:", message, "from", sender);
	if (message) {
		if (message && message.type === "legacyBizContent") {
			// 여기서 html 내용을 처리
			// console.log("[DiffSeekExt] legacyBizContent received:", message.payload && message.payload.content);

			chrome.tabs.query({}, function (tabs) {
				for (const tab of tabs) {
					if (tab.url && (/localhost:5173/.test(tab.url) || /diffseek\.html$/i.test(tab.url))) {
						chrome.tabs.sendMessage(
							tab.id,
							{
								source: "DiffSeekExt",
								type: "setContent",
								payload: { content: message.payload.content, side: message.payload.side || "left" },
							},
							function (response) {
								// console.log("Sent setContent to tab", tab.id, "response:", response);
							}
						);
						// console.log("Sent message to tab", tab.id, "url:", tab.url);
					}
				}
			});
			sendResponse({ status: "ok", received: true });
		} else {
			sendResponse({ status: "received" });
		}
	}
});

// function decodeDataURL(url) {
// 	const match = url.match(/^data:([^;]+);base64,(.*)$/);
// 	if (!match) throw new Error("Only base64-encoded data URLs are supported");

// 	const data = match[2];
// 	const binary = atob(data.trim());
// 	const bytes = new Uint8Array(binary.length);
// 	for (let i = 0; i < binary.length; i++) {
// 		bytes[i] = binary.charCodeAt(i);
// 	}
// 	return bytes;
// }

chrome.runtime.onConnect.addListener((port) => {
	if (port.name === "diffseek") {
		console.log("DiffSeekExt: diffseek port connected");
		const rpc = createRPC(port);
		rpc.handle({
			fetchImageData: async (url) => {
				return fetchImageData(url);
			},
		});
	}
});

// // returns { mimeType, data }
// async function fetchImageData(url) {
// 	const response = await fetch(url);
// 	if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
// 	const blob = await response.blob();
// 	const arrayBuffer = await blob.arrayBuffer();
// 	return {
// 		contentType: blob.type,
// 		data: new Uint32Array(arrayBuffer),
// 	};
// }

async function fetchImageData(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
	const blob = await response.blob();
	const reader = new FileReader();

	return new Promise((resolve, reject) => {
		reader.onloadend = () => {
			resolve({
				contentType: blob.type,
				data: reader.result,
			});
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}
