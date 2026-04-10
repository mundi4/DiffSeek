import { useDiffseekActions } from "@/bridge/diffseek-provider";
import { useT } from "@/i18n";
import { syncModeAtom, whitespaceHandlingAtom } from "@/states/core-atoms";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { OptionsModal } from "./options-modal";
import type { DiffOptions } from "@core";
import { BookIcon, EqualIcon } from "./icons";
import { DiffStatusIndicator } from "./diff-status-indicator";
import css from "./sidebar-footer.module.css";

function StatusOn() {
    const t = useT();
    return <span className={css.statusOn}>{t.statusOn}</span>;
}

function StatusOff() {
    const t = useT();
    return <span className={css.statusOff}>{t.statusOff}</span>;
}

export function SidebarFooter() {
    const syncMode = useAtomValue(syncModeAtom);
    const whitespaceHandling = useAtomValue(whitespaceHandlingAtom);
    const { setSyncMode, setWhitespaceMode } = useDiffseekActions();
    const [optionsOpened, setOptionsOpened] = useState(false);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === ",") {
                e.preventDefault();
                setOptionsOpened(true);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <>
            <header className="sidebar-footer">
                <div className={css.footer}>
                    <div className={css.btnGroup}>
                        <MiniSyncButton isSync={syncMode} onClick={() => setSyncMode(!syncMode)} />
                        <WhitespaceModeSelector mode={whitespaceHandling} onClick={() => setWhitespaceMode(whitespaceHandling === "ignore" ? "collapse" : "ignore")} />
                    </div>
                    <DiffStatusIndicator />
                </div>
            </header>
            <OptionsModal opened={optionsOpened} onClose={() => setOptionsOpened(false)} />
        </>
    );
}

function ToggleIconButton({ onClick, onEnter, onLeave, active, children, ref }: {
    onClick: () => void; onEnter: () => void; onLeave: () => void; active: boolean; children: React.ReactNode;
    ref?: React.Ref<HTMLButtonElement>;
}) {
    return (
        <button
            ref={ref}
            type="button"
            className={`${css.toggleBtn} ${active ? css.toggleBtnActive : ""}`}
            onClick={onClick}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
        >
            {children}
        </button>
    );
}

function usePopoverPosition(hovered: boolean) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState<{ right: number; top: number } | null>(null);

    useEffect(() => {
        if (hovered && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPos({ right: window.innerWidth - r.right, top: r.top });
        } else {
            setPos(null);
        }
    }, [hovered]);

    return { btnRef, pos };
}

export function MiniSyncButton({ isSync, onClick }: { isSync: boolean; onClick: () => void }) {
    const t = useT();
    const [hovered, setHovered] = useState(false);
    const { btnRef, pos } = usePopoverPosition(hovered);

    return (
        <>
            <ToggleIconButton ref={btnRef} active={isSync} onClick={onClick} onEnter={() => setHovered(true)} onLeave={() => setHovered(false)}>
                <BookIcon size={16} />
            </ToggleIconButton>
            {pos && (
                <div className={css.popover} style={{ position: "fixed", right: pos.right, top: pos.top, transform: "translateY(calc(-100% - 6px))" }}>
                    <div className={css.popoverTitle}>{t.syncModeLabel} {isSync ? <StatusOn /> : <StatusOff />}</div>
                    <div className={css.popoverDesc}>{t.syncModeDesc}</div>
                    <div className={css.popoverDesc}>{t.syncModeOnWarn}</div>
                    <div className={css.popoverRow}>
                        <span>{t.shortcutLabel}</span><kbd>F2</kbd>
                    </div>
                </div>
            )}
        </>
    );
}

export function WhitespaceModeSelector({ mode, onClick }: { mode: DiffOptions["whitespace"]; onClick: () => void }) {
    const t = useT();
    const [hovered, setHovered] = useState(false);
    const { btnRef, pos } = usePopoverPosition(hovered);

    return (
        <>
            <ToggleIconButton ref={btnRef} active={mode === "ignore"} onClick={onClick} onEnter={() => setHovered(true)} onLeave={() => setHovered(false)}>
                <EqualIcon size={16} />
            </ToggleIconButton>
            {pos && (
                <div className={css.popover} style={{ position: "fixed", right: pos.right, top: pos.top, transform: "translateY(calc(-100% - 6px))" }}>
                    <div className={css.popoverTitle}>{t.whitespaceModeLabel} {mode === "ignore" ? <StatusOn /> : <StatusOff />}</div>
                    <div className={css.popoverDesc}>{t.whitespaceModeDesc}</div>
                </div>
            )}
        </>
    );
}
