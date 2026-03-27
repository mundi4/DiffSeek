import { commonOutlineAtom } from "@/states/coreAtoms";
import { Badge, Group, Modal, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { useAtomValue } from "jotai";

export function OutlineModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
    const outline = useAtomValue(commonOutlineAtom);

    return (
        <Modal opened={opened} onClose={onClose} title="아웃라인(철저히 디버깅 용도)" centered size="xl">
            {outline.length === 0 ? (
                <Text size="xl" c="dimmed">공허하네요...</Text>
            ) : (
                <ScrollArea.Autosize mah={520}>
                    <Table striped highlightOnHover withTableBorder withColumnBorders>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th w={56}>#</Table.Th>
                                <Table.Th>왼쪽</Table.Th>
                                <Table.Th>오른쪽</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {outline.map((item) => (
                                <Table.Tr key={`${item.leftTokenIndex}:${item.rightTokenIndex}:${item.index}`}

                                >
                                    <Table.Td>{item.index + 1}</Table.Td>
                                    <Table.Td>
                                        <Stack gap={4}>
                                            <Text size="sm" fw={500} lineClamp={1}>{item.leftLabel || "(empty)"}</Text>
                                            <Group gap={6}>
                                                <Badge size="xs" variant="light">token {item.leftTokenIndex}</Badge>
                                            </Group>
                                        </Stack>
                                    </Table.Td>
                                    <Table.Td>
                                        <Stack gap={4}>
                                            <Text size="sm" fw={500} lineClamp={1}>{item.rightLabel || "(empty)"}</Text>
                                            <Group gap={6}>
                                                <Badge size="xs" variant="light">token {item.rightTokenIndex}</Badge>
                                            </Group>
                                        </Stack>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </ScrollArea.Autosize>
            )}
        </Modal>
    );
}
