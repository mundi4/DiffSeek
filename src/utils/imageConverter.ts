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
  if (!window.electronAPI) {
    console.warn('electronAPI not available, returning original path');
    return filePath;
  }

  try {
    // file:// URL인 경우 파일 경로로 변환
    const actualPath = fileUrlToPath(filePath);
    const dataUrl = await window.electronAPI.fileToDataUrl(actualPath);
    return dataUrl;
  } catch (error) {
    console.error('Failed to convert file to data URL:', error);
    return filePath; // 실패 시 원본 경로 반환
  }
}