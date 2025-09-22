//import { chrome } from "process";//import { createRPC } from "./rpc.js";
// // DiffSeekExt content script
//

console.log("DiffSeekExt content script loaded.");
if (/http:\/\/10\.38\.135\.76:8080\//.test(location.href) || /http:\/\/manual\.kbstar\.com\//.test(location.href)) {
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

	// 구biz 경로 microsoft-edge:http://manual.____.com/BzR//Law/User/PopUp/ViewManualPopUp.aspx?ManualOID=1250324150536115024

	// 회사에서 메모장으로 손댄걸 집으로 옮겨온거고 옮기다가 줄바꿈 다 날아간걸 복구한거라 난장판인데 이런 이런 느낌
	// 신biz는 iframe을 쓰고 있기 때문에 단축키를 누를 땐 iframe이 아닌 곳에 마우스가 올라가 있어야함. 매뉴얼의 제목이나 페이지 상단 구석 등등이 안전지대임
	// iframe 좋지 않아요.
	const isNewBiz = /http:\/\/10\.38\.135\.76:8080\//.test(location.href);
	const isLegacyBiz = /http:\/\/manual\.kbstar\.com\//.test(location.href);

	window.addEventListener("keydown", function (e) {


		// 신biz에서 alt+1 => 구biz 매뉴얼 팝업
		if (isNewBiz) {
			if (e.altKey && e.key === "1") {
				e.preventDefault();
				const contentWrap = document.querySelector("#area_content");
				const popupLink = contentWrap && contentWrap.querySelector(".btnGroup3 a");
				if (popupLink && popupLink.href) {
					const m = popupLink.href.match(/-?\d+/);
					if (m) {
						window.open(`http://manual.kbstar.com/BzR//Law/User/PopUp/ViewManualPopUp.aspx?ManualOID=${m[0]}`, "_blank", "width=1000,height=800");
					}
				}
				return;
			}
		}

		// 구biz에서 ctrl+3 => 전문파일 다운로드
		if (isLegacyBiz) {
			if (e.ctrlKey && e.key === "3") {
				e.preventDefault();
				window.postMessage({ type: "callFunc", name: "onDownAttachWord" }, "*");
				return;
			}
		}

		// 신/구biz에서 ctrl+1, ctrl+2 => diffseek로 내용 전송
		if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
			e.preventDefault();
			let contentHTML;
			if (isNewBiz) {
				const contentWrap = document.querySelector("#area_content");
				if (contentWrap) {
					// 제목 영역
					const hd = contentWrap.querySelector(".sub_title_wrap");
					// 본문 영역. iframe? really?
					const contentFrame = document.getElementById("lawDetailContent");

					if (hd && contentFrame) {
						const hdClone = hd.cloneNode(true);
						const bodyClone = contentFrame.contentDocument.body.cloneNode(true);

						// 제목 영역에서 이미지 제거.
						hdClone.querySelectorAll("img").forEach((img) => {
							img.remove();
							// 회사에서 왜 내가 경로로 필터링을 했는지 모르겠는데 제목영역에 들어간 이미지는 이미 다 노이즈라고 봐도 무방할 듯?
							// if (img.getAttribute("src").startsWith("/lmxsrv/images/")) {
							// } else {
							// 	img.setAttribute("src", img.src);
							// }
						});
						// 제목 영역에서 버튼처럼 생긴 링크들 제거
						hdClone.querySelectorAll("a").forEach((img) => {
							img.remove();
						});

						// 본문 영역에서 고정적인 경로 '/lmxsrv/images/...'의 이미지는 제거한 후 남은 img들의 src를 절대경로로 바꿈
						bodyClone.querySelectorAll("img").forEach((img) => {
							if (img.getAttribute("src").startsWith("/lmxsrv/images/")) {
								img.remove();
							} else {
								img.setAttribute("src", img.src);
							}
						});

						contentHTML = hdClone.innerHTML + bodyClone.innerHTML;
					}
				}
			} else if (isLegacyBiz) {
				const manualWrap = document.getElementById("ManualWrap") || document.getElementById("LawWrap");
				if (manualWrap) {
					const bodyClone = manualWrap.cloneNode(true);
					bodyClone.querySelectorAll("img").forEach((img) => {
						img.setAttribute("src", img.src);
					});
					contentHTML = bodyClone.innerHTML;
				}
			}

			if (contentHTML) {
				chrome.runtime.sendMessage({
					source: isNewBiz ? "BizPlatformNew" : "BizPlatformLegacy",
					type: "setContent",
					payload: {
						content: contentHTML,
						side: e.key === "1" ? "left" : "right",
					},
				});
			}

			return;
		}
	});
}

// ----------------------------------------
// diffseek content script
//----------------------------------------

if (/localhost:5173/.test(location.href) || /diffseek\.html$/i.test(location.href)) {
	//console.log("DiffSeekExt: diffseek content script active");
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

	// const port = chrome.runtime.connect({ name: "diffseek" });
	// const rpc = createRPC(port);
	// rpc.handle({});
	// setInterval(() => {
	// 	port.postMessage("ping");
	// }, 20_000);

	const windowRPC = createWindowRPC({ source: "content", timeout: 3000 });
	windowRPC.handle({
		fetchImageData: async (url) => {
			// console.log("fetchImageData called for", url);
			return new Promise((resolve, reject) => {
				chrome.runtime.sendMessage({ type: "fetchImageData", url }, (response) => {
					if (chrome.runtime.lastError) {
						console.warn("lastError:", chrome.runtime.lastError.message, response);
						return;
					}

					// console.log("fetchImageData response:", response);
					if (response && response.status === "ok" && response.data) {
						resolve(response.data);
					} else {
						reject({ error: response && response.error ? response.error : "Failed to fetch image data" });
					}
				});
			});
		},
	});

	// 비즈플랫폼 내용을 diffseek의 에디터에 넣기
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request.type === "setContent") {
			window.postMessage(request, "*");
		}
	});
}
