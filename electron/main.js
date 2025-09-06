import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 개발 모드 감지 개선: NODE_ENV 또는 명령행 인수 확인
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev') || !app.isPackaged;

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // file:// 프로토콜 지원
      preload: path.resolve(__dirname, 'preload.js') // 절대 경로로 명시
    },
    icon: path.join(__dirname, '../public/favicon.ico'), // 아이콘 추가
    titleBarStyle: 'default',
    show: false // 준비되면 표시
  });

  // 창이 준비되면 표시
  win.once('ready-to-show', () => {
    win.show();
  });

  // 디버깅 정보
  console.log('isDev:', isDev);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('__dirname:', __dirname);

  if (isDev) {
    // 개발 서버 URL 시도 (5173, 5174 순서로)
    const devUrls = ['http://localhost:5173', 'http://localhost:5174'];
    let loaded = false;
    
    for (const url of devUrls) {
      try {
        console.log(`Trying to load development URL: ${url}`);
        await win.loadURL(url);
        console.log(`Successfully loaded: ${url}`);
        loaded = true;
        break;
      } catch (error) {
        console.log(`Failed to load ${url}, trying next...`);
      }
    }
    
    if (!loaded) {
      console.error('Failed to load any development URL');
      // 개발 서버가 없으면 빌드된 파일 로드
      const buildPath = path.join(__dirname, '../build/index.html');
      await win.loadFile(buildPath);
    }
    
    win.webContents.openDevTools();
  } else {
    const buildPath = path.join(__dirname, '../dist/diffseek.html');
    console.log('Loading production file:', buildPath);
    win.loadFile(buildPath);
  }

  // 로딩 실패 시 이벤트 처리
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  // 메뉴바 제거 (선택적)
  // win.setMenuBarVisibility(false);
}

// IPC 핸들러: 파일 경로를 data URL로 변환
ipcMain.handle('file-to-data-url', async (event, filePath) => {
  try {
    // file:// URL을 일반 파일 경로로 변환
    let actualPath = filePath;
    if (filePath.startsWith('file:///')) {
      actualPath = filePath.substring(8); // file:///D:/path -> D:/path
    } else if (filePath.startsWith('file://')) {
      actualPath = filePath.substring(7); // file://path -> path
    }

    // 파일이 존재하는지 확인
    if (!fs.existsSync(actualPath)) {
      throw new Error(`File does not exist: ${actualPath}`);
    }

    // 파일 확장자로 MIME 타입 결정
    const ext = path.extname(actualPath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon'
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    // 파일 읽기
    const fileBuffer = await readFile(actualPath);
    
    // data URL 생성
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    console.log(`Successfully converted file to data URL: ${actualPath}`);
    return dataUrl;
  } catch (error) {
    console.error('Error converting file to data URL:', error);
    throw error;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});