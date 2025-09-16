chrome.runtime.onInstalled.addListener(() => {
	console.log("DiffSeekExt background loaded");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	//console.log("DiffSeekExt background received message:", message, "from", sender);
	if (message && message.type === "legacyBizContent") {
		// 여기서 html 내용을 처리
		// console.log("[DiffSeekExt] legacyBizContent received:", message.payload && message.payload.content);

		chrome.tabs.query({}, function (tabs) {
			console.log("tabs:", tabs);
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
});
