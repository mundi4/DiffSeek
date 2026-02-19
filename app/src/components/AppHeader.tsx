import { useDiffseekActions } from "@/bridge/DiffseekProvider";
import { diffWorkflowStatusAtom, syncModeAtom, whitespaceHandlingAtom } from "@/states/coreAtoms";
import { Button, Group, Popover, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { BusyIndicator } from "./BusyIndicator";
import type { DiffOptions } from "@core";

export function AppHeader() {
    const syncMode = useAtomValue(syncModeAtom);
    const whitespaceHandling = useAtomValue(whitespaceHandlingAtom);
    const { setSyncMode, setWhitespaceMode } = useDiffseekActions();
    const diffWorkflowStatus = useAtomValue(diffWorkflowStatusAtom);


    return (
        <header className="app-header">
            <Group align="center">
                <MiniSyncButton isSync={syncMode} onClick={() => setSyncMode(!syncMode)} />

                <WhitespaceModeSelector mode={whitespaceHandling} onClick={() => setWhitespaceMode(whitespaceHandling === "ignore" ? "collapse" : "ignore")} />
            </Group>
            <Group align="center" justify="end">
                <BusyIndicator busy={diffWorkflowStatus.phase !== "idle"} />
            </Group>
        </header>
    );
}

export function MiniSyncButton({ isSync, onClick }: { isSync: boolean; onClick: () => void }) {
    const tooltipContent = (
        <>
            <Text size="sm">양쪽 문서를 정렬하고 위치를 동기화합니다.</Text>
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

// const whitespaceOptions = [
//     { label: '기본', value: 'collapse', desciption: '연속된 공백을 하나로 취급' },
//     { label: '모두', value: 'ignore', desciption: '모든 공백 무시(줄바꿈/띄어쓰기 비교 안함)' },
//     { label: '줄바꿈', value: 'ignoreAtEdge', desciption: '단어 중간에서의 줄바꿈 무시' }
// ];

export function WhitespaceModeSelector({ mode, onClick }: { mode: DiffOptions["whitespace"]; onClick: () => void }) {
    const tooltipContent = (
        <>
            <Text size="sm">공백을 무시하고 비교합니다.</Text>
            <Text size="xs">활성화 되지 않은 경우 연속된 공백은 하나로 취급됩니다.</Text>
            {/* <Group align="center" >
                <Text size="xs">단축키: <kbd >F3</kbd></Text>
            </Group> */}
        </>
    )
    const [opened, { close, open }] = useDisclosure(false);

    return (
        <Popover opened={opened}>
            <Popover.Target>
                <Button
                    onMouseEnter={open} onMouseLeave={close}
                    size="compact-xs"
                    variant={mode === "ignore" ? "outline" : "subtle"}
                    color={mode === "ignore" ? "blue" : "dark"}
                    onClick={() => onClick()}
                >
                    공백 무시: {mode === "ignore" ? "켜짐" : "꺼짐"}
                </Button>
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