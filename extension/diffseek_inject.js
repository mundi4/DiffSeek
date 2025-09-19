console.log("DiffSeekExt: diffseek_inject.js loaded");
window.extensionEnabled = true;

if (window.DiffSeek) {
	console.log("DiffSeekExt: window.DiffSeek available, enabling extension features");
	window.DiffSeek.setExtensionEnabled(true);
}

window.addEventListener("message", function (event) {
	if (!event.data || event.source !== window) return;
	const msg = event.data;
	if (msg && msg.type === "setContent" && msg.payload) {
		if (window.DiffSeek) {
			window.DiffSeek.setContent(msg.payload.side || "left", msg.payload.content, true);
			console.log("[DiffSeekExt] setContent called:", msg.payload);
			window.postMessage({ status: "ok", action: "setContent", content: msg.payload.content }, "*");
		} else {
			console.log("[DiffSeekExt] window.DiffSeek.setContent not available");
		}
	}

});

