export const KEYBOARD_SHORTCUTS = {
    TOGGLE_SYNC_MODE: "F2",
    TOGGLE_LAYOUT: "F10",
    PASTE_BOMB_LEFT: "Ctrl+1",
    PASTE_BOMB_RIGHT: "Ctrl+2",
    CLEAR_ALL_CONTENT: "Ctrl+r",
} as const;

// 키보드 단축키 파싱을 위한 유틸리티 타입
export type KeyboardShortcut = {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean; // Cmd on Mac, Windows key on Windows
};

// 더 정교한 키보드 단축키 정의 (필요시 사용)
export const DETAILED_KEYBOARD_SHORTCUTS = {
    TOGGLE_SYNC_MODE: { key: "F2" },
    TOGGLE_LAYOUT: { key: "F10" },
    PASTE_BOMB_LEFT: { key: "1", ctrl: true },
    PASTE_BOMB_RIGHT: { key: "2", ctrl: true },
    // 추가 단축키 예시:
    // COPY: { key: "c", ctrl: true },
    // PASTE: { key: "v", ctrl: true },
    // SELECT_ALL: { key: "a", ctrl: true },
} as const satisfies Record<string, KeyboardShortcut>;

export const UI_CONSTANTS = {
    SIDEBAR_MIN_SIZE: 170,
    MAIN_PANEL_MIN_SIZE: 400,
    SIDEBAR_INITIAL_SIZE: "250px",
} as const;

export const APP_MESSAGES = {
    INIT_SUCCESS: "DiffSeek app initialized",
    INIT_ERROR: "Failed to initialize DiffSeek app:",
    CONTEXT_ERROR: "useDiffControllerContext must be used within a DiffControllerProvider",
} as const;
