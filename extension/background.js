// function createRPC(port, { timeout: timeout = 10_000 } = {}) {
// 	let id = 1;
// 	const pending = new Map();
// 	port.onMessage.addListener((msg) => {
// 		if (msg.rpcResponse && pending.has(msg.id)) {
// 			const { resolve, reject, timer } = pending.get(msg.id);
// 			clearTimeout(timer);
// 			pending.delete(msg.id);
// 			if (msg.error) reject(msg.error);
// 			else resolve(msg.result);
// 		} else if (msg === "ping") {
// 			console.log(new Date(), "got ping.");
// 			port.postMessage("pong");
// 		} else if (msg === "pong") {
// 			console.log(new Date(), "got pong.");
// 		}
// 	});
// 	function call(method, params, timeoutOverride = timeout) {
// 		return new Promise((resolve, reject) => {
// 			const reqId = id++;
// 			const timer = setTimeout(() => {
// 				pending.delete(reqId);
// 				reject(new Error("RPC timeout"));
// 			}, timeoutOverride);
// 			pending.set(reqId, { resolve, reject, timer });
// 			port.postMessage({ rpcRequest: true, id: reqId, method, params });
// 		});
// 	}
// 	function handle(methods) {
// 		port.onMessage.addListener(async (msg) => {
// 			if (msg.rpcRequest && typeof methods[msg.method] === "function") {
// 				try {
// 					const result = await methods[msg.method](...(msg.params || []));
// 					port.postMessage({ rpcResponse: true, id: msg.id, result });
// 				} catch (error) {
// 					port.postMessage({ rpcResponse: true, id: msg.id, error: error.message });
// 				}
// 			}
// 		});
// 	}
// 	return { call, handle };
// }

// chrome.runtime.onConnect.addListener((port) => {
// 	if (port.name === "diffseek") {
// 		const rpc = createRPC(port);
// 		rpc.handle({
// 			fetchImageData: async (url) => {
// 				return await fetchImageData(url);
// 			},
// 		});
// 	}
// });

chrome.runtime.onInstalled.addListener(() => {
	console.log("DiffSeekExt background loaded");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	//console.log("DiffSeekExt background received message:", message, "from", sender);
	if (message) {
		console.log("DiffSeekExt background received message:", message, "from", sender);
		// from diffseek.

		if (message.type === "fetchImageData") {
			console.log("type:", message.type, "url:", message.url);
			fetchImageData(message.url)
				.then((dataUrl) => {
					console.log("fetchImageData success for", message.url, dataUrl?.slice(0, 30) + "...");
					sendResponse({ status: "ok", data: dataUrl });
				})
				.catch((error) => {
					console.error("fetchImageData error for", message.url, error);
					sendResponse({ status: "error", error: error?.message || "Unknown error" });
				});
			
			// 비동기로 응답하는 경우 반드시 true를 보내줘야 함!!
			return true;
		}

		if (message.type === "setContent") {
			chrome.tabs.query({}, function (tabs) {
				for (const tab of tabs) {
					if (tab.url && (/localhost:5173/.test(tab.url) || /diffseek\.html$/i.test(tab.url))) {
						//console.log("Sent message to tab", tab.id, "url:", tab.url);
						chrome.tabs.sendMessage(tab.id, {
							source: "DiffSeek",
							type: "setContent",
							payload: { content: message.payload.content, side: message.payload.side || "left" },
						});
					}
				}
			});
			return false;
		}
	}

	sendResponse({ status: "received" });
	return false;
});

/*이미지 파일을 읽어서 data url로 돌려준다.위험할 수 있다. 파일을 가리지 않는다. 크기도 가리지 않는다. c:\동영상\토익_XXX-313.mp4 같은 것도 읽어버릴 수 있다.*/
async function fetchImageData(url) {
	const response = await fetch(url, { credentials: "include" });

	if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
	const blob = await response.blob();
	const reader = new FileReader();
	return new Promise((resolve, reject) => {
		reader.onloadend = () => {
			resolve(reader.result);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}
