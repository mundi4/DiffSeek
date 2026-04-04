// DiffSeek 확장 감지 + 이미지 fetch RPC 클라이언트
// page world에서 실행됨 (ES module import 불가)
(function () {
	window.__diffseekExtEnabled = true;

	// content script의 windowRPC(source: "content")와 통신하는 minimal RPC caller
	let rpcId = 0;
	window.__diffseekFetchImage = (url) => {
		return new Promise((resolve, reject) => {
			const id = ++rpcId;
			const timeout = setTimeout(() => {
				window.removeEventListener("message", handler);
				reject(new Error("fetchImage timeout"));
			}, 15000);
			const handler = (event) => {
				const msg = event.data;
				if (msg && msg.rpcResponse && msg.id === id) {
					window.removeEventListener("message", handler);
					clearTimeout(timeout);
					if (msg.error) reject(new Error(msg.error));
					else resolve(msg.result);
				}
			};
			window.addEventListener("message", handler);
			window.postMessage({
				rpcRequest: true, id, method: "fetchImageData",
				params: [url], source: "page"
			}, "*");
		});
	};

	if (window.DiffSeek) {
		window.DiffSeek.setExtensionEnabled(true);
	} else {
		window.dispatchEvent(new CustomEvent("diffseek-extension-ready"));
	}
})();
