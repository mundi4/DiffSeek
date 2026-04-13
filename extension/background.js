import { createRPC } from "./rpc.js";

chrome.runtime.onInstalled.addListener(() => {
	console.log("DiffSeekExt background loaded");
});

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
