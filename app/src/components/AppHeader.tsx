import { useDiffseekActions } from "@/bridge/DiffseekProvider";
import { useCoreActions } from "@/bridge/useCoreActions";
import { syncModeAtom, whitespaceHandlingAtom } from "@/states/viewAtoms";
import type { WhitespaceHandling } from "@core/types";
import { ActionIcon, Box, Button, Group, Kbd, Menu, Popover, rem, SegmentedControl, Switch, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconBook, IconCheck, IconLink, IconLinkOff, IconSettings } from "@tabler/icons-react";
import { getDefaultStore, useAtom, useAtomValue, useStore } from "jotai";

export function AppHeader() {
    const syncMode = useAtomValue(syncModeAtom);
    const whitespaceHandling = useAtomValue(whitespaceHandlingAtom);

    const { setSyncMode, setWhitespaceMode } = useDiffseekActions();

    return (
        <header className="app-header">
            <Group align="center">
                <MiniSyncButton isSync={syncMode} onClick={() => setSyncMode(!syncMode)} />

                <WhitespaceModeSelector mode={whitespaceHandling} onChange={(mode) => setWhitespaceMode(mode)} />
            </Group>
            <Box>
                <Group justify="end">
                    <ActionIcon size="sm" variant={syncMode ? "filled" : "subtle"} color="dark">
                        <IconSettings width="80%" />
                    </ActionIcon>
                </Group>
            </Box>
        </header>
    );
}

export function MiniSyncButton({ isSync, onClick }: { isSync: boolean; onClick: () => void }) {
    const tooltipContent = (
        <>
            <Text size="sm">양쪽 문서의 위치와 스크롤 위치를 동기화합니다.</Text>
            <Text size="xs">활성화 된 경우 편집이 불가능합니다.</Text>
            <Group align="center" >
                <Text size="xs">단축키: <kbd >F2</kbd></Text>
            </Group>
        </>
    )
    const [opened, { close, open }] = useDisclosure(false);
    return (
        <Popover opened={opened}>
            <Popover.Target>
                <Button
                    onMouseEnter={open} onMouseLeave={close}
                    size="compact-xs"
                    variant={isSync ? "outline" : "subtle"}
                    color={isSync ? "blue" : "dark"}
                    onClick={() => onClick()}
                >
                    좌우 동기화: {isSync ? "켜짐" : "꺼짐"}
                </Button>
            </Popover.Target>
            <Popover.Dropdown>
                {tooltipContent}
            </Popover.Dropdown>
        </Popover>
    );
}

const whitespaceOptions = [
    { label: '기본', value: 'collapse', desciption: '연속된 공백을 하나로 취급' },
    { label: '모두', value: 'ignore', desciption: '모든 공백 무시(줄바꿈/띄어쓰기 비교 안함)' },
    { label: '줄바꿈', value: 'ignoreAtEdge', desciption: '단어 중간에서의 줄바꿈 무시' }
];

export function WhitespaceModeSelector({ mode, onChange }: { mode: WhitespaceHandling; onChange: (mode: WhitespaceHandling) => void }) {
    const current = whitespaceOptions.find(d => d.value === mode)!;

    return (
        <Menu position="bottom-start" withArrow>
            <Menu.Target>
                <Button size="compact-xs" variant={mode !== "collapse" ? "outline" : "subtle"} color={mode !== "collapse" ? "blue" : "dark"}>공백 무시: {current.label}</Button>
            </Menu.Target>
            <Menu.Dropdown>
                {whitespaceOptions.map(d => (
                    <Menu.Item key={d.value} onClick={() => onChange(d.value as WhitespaceHandling)}>
                        <Box>
                            <Text size="sm" fw={d === current ? 700 : "normal"}>{d.label}</Text>
                            <Text size="xs" c="dimmed">{d.desciption}</Text>
                        </Box>
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}