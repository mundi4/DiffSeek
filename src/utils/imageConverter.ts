/**
 * Electron 환경에서 이미지 파일 경로를 data URL로 변환하는 유틸리티
 */

/**
 * 파일 경로가 로컬 파일인지 확인 (HTTP URL이 아닌지 체크)
 */
export function isLocalFilePath(src: string): boolean {
	// HTTP/HTTPS URL이 아니고, data URL도 아닌 경우
	return !src.startsWith('http://') &&
		!src.startsWith('https://') &&
		!src.startsWith('data:') &&
		!src.startsWith('blob:');
}

/**
 * file:// URL을 일반 파일 경로로 변환
 */
export function fileUrlToPath(fileUrl: string): string {
	if (fileUrl.startsWith('file:///')) {
		// file:///D:/path -> D:/path
		return fileUrl.substring(8);
	} else if (fileUrl.startsWith('file://')) {
		// file://path -> path
		return fileUrl.substring(7);
	}
	return fileUrl;
}

/**
 * 파일 경로를 data URL로 변환
 */
export async function convertFileToDataUrl(filePath: string): Promise<string> {
	// Electron 환경에서만 작동
	if (typeof window !== 'undefined' && window.electronAPI) {
		try {
			// file:// URL인 경우 파일 경로로 변환
			const actualPath = fileUrlToPath(filePath);
			const dataUrl = await window.electronAPI.fileToDataUrl(actualPath);
			return dataUrl;
		} catch (error) {
			console.error('Failed to convert file to data URL (electron):', error);
			return filePath; // 실패 시 원본 경로 반환
		}
	}

	// 브라우저 환경: 주소창이 http(s)로 시작하면 파이썬 서버에 요청
	if (typeof window !== 'undefined' && window.location &&
		(window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
		// 이미 data:로 시작하면 그대로 반환
		if (filePath.startsWith('data:')) return filePath;
		// file:// 또는 file:///로 시작하면 실제 경로로 변환
		let actualPath = filePath;
		if (filePath.startsWith('file:///')) {
			actualPath = filePath.substring(8);
		} else if (filePath.startsWith('file://')) {
			actualPath = filePath.substring(7);
		}
		const url = `/convertimg?path=${encodeURIComponent(actualPath)}`;
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error('Server error');
			const json = await res.json();
			return json.data_url || filePath;
		} catch (e) {
			console.error('convertFileToDataUrl (server) error:', e);
			return filePath;
		}
	}

	// 기타 환경(로컬 file:// 등)에서는 변환하지 않고 원본 반환
	return filePath;
}

/**
 * 서버에 이미지 경로를 보내 data-url을 받아오는 함수 (브라우저 환경)
 */
export async function fetchDataUrlFromServer(imagePath: string, serverUrl = "http://localhost:5000/dataurl"): Promise<string> {
	// 이미 data:로 시작하면 그대로 반환
	if (imagePath.startsWith('data:')) return imagePath;

	// file:// 또는 file:///로 시작하면 실제 경로로 변환
	let actualPath = imagePath;
	if (imagePath.startsWith('file:///')) {
		actualPath = imagePath.substring(8);
	} else if (imagePath.startsWith('file://')) {
		actualPath = imagePath.substring(7);
	}

	// 서버에 GET 요청
	const url = `${serverUrl}?path=${encodeURIComponent(actualPath)}`;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error('Server error');
		const json = await res.json();
		return json.data_url || imagePath;
	} catch (e) {
		console.error('fetchDataUrlFromServer error:', e);
		return imagePath;
	}
}