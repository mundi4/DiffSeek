////// manual inject  // DiffSeekExt: manual.kbstar.com 전용 inject script
console.log("DiffSeekExt: manual.kbstar.com inject loaded");
// 확장 메시지를 window로 전달 (예시)
window.addEventListener("message", function (event) {
	// 필요시 메시지 처리 로직 추가
	if (!event.data || event.source !== window) return;
	const msg = event.data;
	if (msg && msg.type === "callFunc" && typeof msg.name === "string") {
		console.log(`[DiffSeekExt] window.${msg.name}() called by message`);
		try {
			window[msg.name]();
		} catch {}
	}
});
