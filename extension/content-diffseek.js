import { createRPC } from './rpc.js';
import { createWindowRPC } from './rpc-window.js';

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
chrome.runtime.onMessage.addListener(function (request) {
	if (request.type === "setContent") {
		window.postMessage(request, "*");
	}
});
