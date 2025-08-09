import { appSidebarCollapsedAtom, magnifierEnabledAtom, syncModeAtom } from "@/states/atoms";
import * as styles from "./FetishBar.css";
import { useAtom } from "jotai";
import BookIcon from "@/assets/book-16.svg?react";
import ReportIcon from "@/assets/report-16.svg?react";
import DashIcon from "@/assets/dash-16.svg?react";
import { BookOpen, PanelRightClose, PanelRightOpen, ScanSearch, SearchCode, Space, WrapText } from 'lucide-react';
import { ToggleButton, TriStateToggleButton } from '../ToggleButton';
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { whitespaceHandlingAtom } from '@/states/diffOptionsAtom';

interface FetishBarProps {

}

function OverflowMenu() {
    const [syncMode, setSyncMode] = useAtom(syncModeAtom);
    const [magnifierEnabled, setMagnifierEnabled] = useAtom(magnifierEnabledAtom);

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button className={styles.overflowMenuTrigger} aria-label="More options">⋯</button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    side="top"         // 아래가 아니라 위로
                    align="end"        // 오른쪽 정렬
                    sideOffset={4}
                    alignOffset={0}
                    avoidCollisions={true}      // ✅ 자동 충돌 회피
                    collisionPadding={8}
                    className={styles.overflowMenuContent}
                >
                    <DropdownMenu.Item asChild >
                        <ToggleButton checked={syncMode} onChange={setSyncMode} size="sm">
                            <BookIcon />
                        </ToggleButton>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild>
                        <ToggleButton checked={magnifierEnabled} onChange={setMagnifierEnabled} size="sm">
                            <ReportIcon />
                        </ToggleButton>
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

export function FetishBar({ }: FetishBarProps) {
    const [syncMode, setSyncMode] = useAtom(syncModeAtom);
    const [magnifierEnabled, setMagnifierEnabled] = useAtom(magnifierEnabledAtom);
    const [appSidebarCollapsed, setAppSidebarCollapsed] = useAtom(appSidebarCollapsedAtom);
    const [whitespaceHandling, setWhitespaceHandling] = useAtom(whitespaceHandlingAtom);
    const whitespaceHandlingOptions: [string, string, string] = ["ignore", "onlyAtEdge", "normalize"];
    // const [diffOptions, setDiffOptions] = useAtom(diffOptionsAtom);
    // const setWhitespaceHandling2 = useCallback((value: WhitespaceHandling) => {
    //     diffController.updateDiffOptions({
    //         ignoreWhitespace: value
    //     });
    //     setWhitespaceHandling(value);
    // }, [setWhitespaceHandling, diffController]);




    return (
        <div className={styles.bar}>
            <div className={styles.leftGroup}>
                {appSidebarCollapsed
                    ? <OverflowMenu />
                    : <>
                        <ToggleButton checked={syncMode} onChange={setSyncMode} size="sm">
                            <BookOpen />
                        </ToggleButton>
                        <ToggleButton checked={magnifierEnabled} onChange={setMagnifierEnabled} size="sm">
                            {/* <ReportIcon /> */}
                            <SearchCode size={24} />
                        </ToggleButton>
                        <TriStateToggleButton values={whitespaceHandlingOptions} currentValue={whitespaceHandling} onChange={(v) => setWhitespaceHandling(v as WhitespaceHandling)} size="sm">
                            {whitespaceHandling === "onlyAtEdge" ? <WrapText /> : <Space />}
                        </TriStateToggleButton>
                    </>}

            </div>
            <div className={styles.rightGroup}>
                <ToggleButton checked={!appSidebarCollapsed} onChange={(v) => setAppSidebarCollapsed(!v)} size="sm">
                    {appSidebarCollapsed ? <PanelRightClose /> : <PanelRightOpen />}

                </ToggleButton>
            </div>

            {/* <button
                className={styles.toggleButton({ active: syncMode })}
                onClick={() => setSyncMode(current => !current)}
                title="스크롤 동기화"
            >
                🔄 Sync
            </button> */}
            {/* <button
                className={styles.toggleButton({ active: magnifierEnabled })}
                onClick={() => setMagnifierEnabled(current => !current)}
                title="돋보기"
            >
                🔍 Magnifier
            </button> */}
        </div>
    );
}
