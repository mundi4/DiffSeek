import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { editorPanelLayoutAtom } from '../states/atoms';
import { useDiffControllerContext } from './useDiffController';
import { KEYBOARD_SHORTCUTS } from '../constants/appConstants';

/**
 * 키보드 단축키 문자열을 파싱하여 이벤트와 매칭하는 함수
 */
function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.split('+');
    const key = parts[parts.length - 1];
    
    const hasCtrl = parts.includes('Ctrl');
    const hasAlt = parts.includes('Alt');
    const hasShift = parts.includes('Shift');
    const hasMeta = parts.includes('Meta') || parts.includes('Cmd');
    
    return (
        event.key === key &&
        event.ctrlKey === hasCtrl &&
        event.altKey === hasAlt &&
        event.shiftKey === hasShift &&
        event.metaKey === hasMeta
    );
}

/**
 * Custom hook to handle keyboard shortcuts for the DiffSeek application
 */
export function useKeyboardShortcuts() {
    const { diffController, leftEditor, rightEditor } = useDiffControllerContext();
    const setEditorLayout = useSetAtom(editorPanelLayoutAtom);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F2: Toggle sync mode
            if (matchesShortcut(e, KEYBOARD_SHORTCUTS.TOGGLE_SYNC_MODE)) {
                e.preventDefault();
                diffController.syncMode = !diffController.syncMode;
                return;
            }

            // F10: Toggle layout (horizontal/vertical)
            if (matchesShortcut(e, KEYBOARD_SHORTCUTS.TOGGLE_LAYOUT)) {
                e.preventDefault();
                setEditorLayout(current => current === 'horizontal' ? 'vertical' : 'horizontal');
                diffController.alignEditors();
                diffController.renderer.invalidateAll();
                return;
            }

            // Ctrl+1: Paste bomb to left editor
            if (matchesShortcut(e, KEYBOARD_SHORTCUTS.PASTE_BOMB_LEFT)) {
                e.preventDefault();
                leftEditor.pasteBomb();
                return;
            }

            // Ctrl+2: Paste bomb to right editor
            if (matchesShortcut(e, KEYBOARD_SHORTCUTS.PASTE_BOMB_RIGHT)) {
                e.preventDefault();
                rightEditor.pasteBomb();
                return;
            }

            // Ctrl+R: Clear all content from both editors
            if (matchesShortcut(e, KEYBOARD_SHORTCUTS.CLEAR_ALL_CONTENT)) {
                e.preventDefault();
                (async () => {
                    await leftEditor.setContent({ text: '', asHTML: false });
                    await rightEditor.setContent({ text: '', asHTML: false });
                })();
                return;
            }

            // Add more shortcuts here as needed
            // Example: Ctrl+D for diff options, etc.
        };

        window.addEventListener("keydown", handleKeyDown);
        
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [diffController, leftEditor, rightEditor, setEditorLayout]);
}
