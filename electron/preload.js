const { contextBridge, ipcRenderer } = require('electron');

/**
 * Renderer 프로세스에서 사용할 수 있는 안전한 API 노출
 * @typedef {Object} ElectronAPI
 * @property {function(string): Promise<string>} fileToDataUrl - 파일 경로를 data URL로 변환
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // 파일 경로를 data URL로 변환
  fileToDataUrl: (filePath) => ipcRenderer.invoke('file-to-data-url', filePath),
  
  // 향후 다른 기능들도 여기에 추가 가능
  // getVersion: () => ipcRenderer.invoke('get-version'),
  // openFile: () => ipcRenderer.invoke('open-file-dialog'),
});
