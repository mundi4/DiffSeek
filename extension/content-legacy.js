console.log("DiffSeekExt content script loaded.");

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
		const bodyHTML = document.body ? document.body.innerHTML : "";
		chrome.runtime.sendMessage(
			{
				source: "DiffSeekExt",
				type: "legacyBizContent",
				payload: { content: bodyHTML, side: e.key === "1" ? "left" : "right" },
			},
			function () {}
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

chrome.runtime.onMessage.addListener(function () {});
