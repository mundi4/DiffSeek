import { useDiffseekActions } from "@/bridge/diffseek-provider";
import { diffWorkflowStatusAtom, syncModeAtom, whitespaceHandlingAtom } from "@/states/core-atoms";
import { ActionIcon, Group, Kbd, Popover, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { forwardRef, useEffect } from "react";
import { OptionsModal } from "./options-modal";

import type { DiffOptions } from "@core";
import { IconBook, IconEqual, IconSettings } from "@tabler/icons-react";
import { DiffStatusIndicator } from "./diff-status-indicator";

function StatusOn() {
    return (
        <Text span c="teal.8" fw={600}>(켜짐)</Text>
    )
}

function StatusOff() {
    return (
        <Text span c="dimmed" fw={600}>(꺼짐)</Text>
    )
}

export function AppHeader() {
    const syncMode = useAtomValue(syncModeAtom);
    const whitespaceHandling = useAtomValue(whitespaceHandlingAtom);
    const { setSyncMode, setWhitespaceMode } = useDiffseekActions();
    const [optionsOpened, optionsHandlers] = useDisclosure(false);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === ",") {
                e.preventDefault();
                optionsHandlers.open();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [optionsHandlers]);

    return (
        <>
            <header className="app-header">
                <Group justify="space-between" align="center" px={4}>
                    <Group align="center" px={0} gap={4}>
                        <MiniSyncButton isSync={syncMode} onClick={() => setSyncMode(!syncMode)} />
                        <WhitespaceModeSelector mode={whitespaceHandling} onClick={() => setWhitespaceMode(whitespaceHandling === "ignore" ? "collapse" : "ignore")} />
                    </Group>
                    <DiffStatusIndicator />

                </Group>
            </header>
            <OptionsModal opened={optionsOpened} onClose={optionsHandlers.close} />
        </>
    );
}

const ToggleIconButton = forwardRef<HTMLButtonElement, { onClick: () => void; onEnter: () => void; onLeave: () => void; active: boolean; Icon: React.FC }>(function ToggleIconButton({ onClick, onEnter, onLeave, active, Icon }, ref) {
    const color = active ? "blue" : "gray";
    const variant = active ? "light" : "subtle";
    return (
        <ActionIcon ref={ref} size="sm" variant={variant} c={color} onClick={() => onClick()} onMouseEnter={onEnter} onMouseLeave={onLeave}>
            <Icon />
        </ActionIcon>
    );
});

export function MiniSyncButton({ isSync, onClick }: { isSync: boolean; onClick: () => void }) {
    const tooltipContent = (
        <>
            <Text size="sm" fw={600}>줄맞춤 모드 {isSync ? <StatusOn /> : <StatusOff />}</Text>
            <Text size="xs">양쪽 문서를 나란히 정렬하고 스크롤을 동기화합니다.</Text>
            <Text size="xs"><Text span c="teal.8">켜진</Text> 상태에서는 편집이 불가능합니다.</Text>
            <Group align="center" gap={8}>
                <Text size="xs">단축키:</Text><Kbd size="xs">F2</Kbd>
            </Group>
        </>
    )
    const [opened, { close, open }] = useDisclosure(false);

    return (

        <Popover opened={opened} position="bottom">
            <Popover.Target>
                <ToggleIconButton active={isSync} Icon={IconBook} onClick={onClick} onEnter={open} onLeave={close} />
            </Popover.Target>
            <Popover.Dropdown>
                {tooltipContent}
            </Popover.Dropdown>
        </Popover>
    );
}

// const whitespaceOptions = [
//     { label: '기본', value: 'collapse', desciption: '연속된 공백을 하나로 취급' },
//     { label: '모두', value: 'ignore', desciption: '모든 공백 무시(줄바꿈/띄어쓰기 비교 안함)' },
//     { label: '줄바꿈', value: 'ignoreAtEdge', desciption: '단어 중간에서의 줄바꿈 무시' }
// ];

export function WhitespaceModeSelector({ mode, onClick }: { mode: DiffOptions["whitespace"]; onClick: () => void }) {
    const tooltipContent = (
        <>
            <Text size="sm" fw={600}>공백 무시 {mode === "ignore" ? <StatusOn /> : <StatusOff />}</Text>
            <Text size="xs">공백을 무시하고 비교합니다.</Text>
            <Text size="xs"><Text span c="dimmed">꺼진</Text> 상태에서는 연속된 공백은 하나로 취급됩니다.</Text>
            {/* <Group align="center" >
                <Text size="xs">단축키: <kbd >F3</kbd></Text>
            </Group> */}
        </>
    )
    const [opened, { close, open }] = useDisclosure(false);

    return (
        <Popover opened={opened}>
            <Popover.Target>
                <ToggleIconButton active={mode === "ignore"} Icon={IconEqual} onClick={onClick} onEnter={open} onLeave={close} />
                {/* <Button
                    onMouseEnter={open} onMouseLeave={close}
                    size="compact-xs"
                    variant={mode === "ignore" ? "outline" : "subtle"}
                    color={mode === "ignore" ? "blue" : "dark"}
                    onClick={() => onClick()}
                >
                    공백 무시: {mode === "ignore" ? "켜짐" : "꺼짐"}
                </Button> */}
            </Popover.Target>
            <Popover.Dropdown>
                {tooltipContent}
            </Popover.Dropdown>
        </Popover>

        // <Menu position="bottom-start" withArrow>
        //     <Menu.Target>
        //         <Button size="compact-xs" variant={mode !== "collapse" ? "outline" : "subtle"} color={mode !== "collapse" ? "blue" : "dark"}>공백 무시: {current.label}</Button>
        //     </Menu.Target>
        //     <Menu.Dropdown>
        //         {whitespaceOptions.map(d => (
        //             <Menu.Item key={d.value} onClick={() => onChange(d.value as WhitespaceHandling)}>
        //                 <Box>
        //                     <Text size="sm" fw={d === current ? 700 : "normal"}>{d.label}</Text>
        //                     <Text size="xs" c="dimmed">{d.desciption}</Text>
        //                 </Box>
        //             </Menu.Item>
        //         ))}
        //     </Menu.Dropdown>
        // </Menu>
    );
}