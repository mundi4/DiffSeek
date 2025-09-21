export const KEYBOARD_SHORTCUTS = {
    TOGGLE_SYNC_MODE: "F2",
    TOGGLE_LAYOUT: "F10",
    TOGGLE_SETTINGS: "F1",
    PASTE_BOMB_LEFT: "Ctrl+1",
    PASTE_BOMB_RIGHT: "Ctrl+2",
    CLEAR_ALL_CONTENT: "Ctrl+r",
} as const;

export type KeyboardShortcut = {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
};

export const DETAILED_KEYBOARD_SHORTCUTS = {
    TOGGLE_SYNC_MODE: { key: "F2" },
    TOGGLE_LAYOUT: { key: "F10" },
    TOGGLE_SETTINGS: { key: "F1" },
    CLEAR_ALL_CONTENT: { key: "r", ctrl: true },
    PASTE_BOMB_LEFT: { key: "1", ctrl: true },
    PASTE_BOMB_RIGHT: { key: "2", ctrl: true },
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
