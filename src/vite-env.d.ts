/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

// Electron API 타입 정의
interface Window {
  electronAPI?: {
    fileToDataUrl: (filePath: string) => Promise<string>;
  };
}