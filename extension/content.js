//import { chrome } from "process";
//import { createRPC } from "./rpc.js";

// DiffSeekExt content script
console.log("DiffSeekExt content script loaded.");

if (location.href === "http://manual.kbstar.com/" || location.href.startsWith("http://localhost:8000")) {
	(function injectManualScript() {
		if (document.getElementById("manual-inject-script")) return;
		const script = document.createElement("script");
		script.id = "manual-inject-script";
		script.src = chrome.runtime.getURL("manual_inject.js");
		script.onload = function () {
			this.remove();
		};
		(document.head || document.documentElement).appendChild(script);
	})();

	window.addEventListener("keydown", function (e) {
		if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
			// document.querySelector('iframe').contentDocument.body
			const bodyHTML = document.body ? document.body.innerHTML : "";
			chrome.runtime.sendMessage(
				{
					source: "DiffSeekExt",
					type: "legacyBizContent",
					payload: { content: bodyHTML, side: e.key === "1" ? "left" : "right" },
				},
				function (response) {
					//console.log("Sent body HTML to extension. Response:", response);
				}
			);
		} else if (e.ctrlKey && e.key === "3") {
			window.postMessage(
				{
					type: "callFunc",
					name: "funcName",
				},
				"*"
			);
		}
	});

	// 익스텐션에서 메시지 받기
	function onExtensionMessage(callback) {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			callback(request, sender, sendResponse);
		});
	}

	// 예시: 메시지 수신 핸들러 등록
	onExtensionMessage((msg) => {
		//console.debug("Received from extension:", msg);
	});
}

// ----------------------------------------
// diffseek content script
// ----------------------------------------
if (/localhost:5173/.test(location.href) || /diffseek\.html$/i.test(location.href)) {
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

	// 확장 메시지를 inject로 전달
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request.type === "setContent") {
			window.postMessage(request, "*");
		}
	});
}
