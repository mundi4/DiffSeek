import { useDiffseekActions } from "@/bridge/DiffseekProvider";
import { diffOptionsAtom, editableInSyncModeAtom } from "@/states/coreAtoms";
import { type DiffOptions, getDefaultDiffOptions } from "@core";
import { Box, Button, Flex, Group, Modal, NumberInput, Radio, Stack, Switch, Text } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";

type CategoryKey = "general" | "tokens" | "patience" | "advanced";

interface Category {
    key: CategoryKey;
    label: string;
    description: string;
}

const categories: Category[] = [
    { key: "general", label: "일반", description: "기본 설정" },
    { key: "tokens", label: "토큰 처리", description: "토큰 병합 옵션" },
    { key: "patience", label: "Patience Diff", description: "Patience Diff 알고리즘" },
    { key: "advanced", label: "고급", description: "추가 알고리즘 설정" },
];

export function OptionsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
    const current = useAtomValue(diffOptionsAtom);
    const currentEditableInSyncMode = useAtomValue(editableInSyncModeAtom);
    const { updateDiffOptions, resetDiffOptions, setEditableInSyncMode } = useDiffseekActions();
    const [draft, setDraft] = useState<DiffOptions>(current);
    const [draftEditableInSyncMode, setDraftEditableInSyncMode] = useState<boolean>(currentEditableInSyncMode);
    const [activeCategory, setActiveCategory] = useState<CategoryKey>("general");
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (opened) {
            setDraft(current);
            setDraftEditableInSyncMode(currentEditableInSyncMode);
            setActiveCategory("general");
        }
    }, [opened, current, currentEditableInSyncMode]);

    const canApply = useMemo(() => {
        return JSON.stringify(draft) !== JSON.stringify(current)
            || draftEditableInSyncMode !== currentEditableInSyncMode;
    }, [draft, current, draftEditableInSyncMode, currentEditableInSyncMode]);

    const apply = () => {
        updateDiffOptions(draft);
        setEditableInSyncMode(draftEditableInSyncMode);
        onClose();
    };

    const reset = () => {
        resetDiffOptions();
        setDraft(getDefaultDiffOptions());
        setEditableInSyncMode(false);
        setDraftEditableInSyncMode(false);
    };

    const renderContent = () => {
        switch (activeCategory) {
            case "general":
                return (
                    <Stack gap="lg">
                        <Box>
                            <Switch
                                label="동기 모드에서 편집 활성화"
                                checked={draftEditableInSyncMode}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDraftEditableInSyncMode(checked);
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                양쪽 정렬 모드에서도 문서 편집을 허용합니다.
                            </Text>
                        </Box>

                        <Box>
                            <Radio.Group
                                label="공백 처리"
                                value={draft.whitespace}
                                onChange={(v) => {
                                    setDraft((prev) => ({ ...prev, whitespace: v as DiffOptions["whitespace"] }));
                                }}
                            >
                                <Stack gap="xs" mt="xs">
                                    <Radio value="collapse" label="연속된 공백을 하나로 취급" />
                                    <Radio value="ignore" label="모든 공백 무시" />
                                </Stack>
                            </Radio.Group>
                        </Box>
                    </Stack>
                );

            case "tokens":
                return (
                    <Box>
                        <Switch
                            label="비단어 토큰 병합"
                            checked={draft.mergeNonWordTokens}
                            onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                setDraft((prev) => ({ ...prev, mergeNonWordTokens: checked }));
                            }}
                        />
                        <Text size="sm" c="dimmed" mt="xs">
                            연속된 비단어(문장부호 등)를 하나로 묶어서 비교합니다.
                        </Text>
                    </Box>
                );

            case "patience":
                return (
                    <Stack gap="lg">
                        <Box>
                            <Switch
                                label="Patience Diff 사용"
                                checked={draft.usePatience}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDraft((prev) => ({ ...prev, usePatience: checked }));
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                고유한 내용을 가진 줄끼리 우선적으로 매칭을 시도합니다. 비교 속도가 향상됩니다.
                            </Text>
                        </Box>

                        <NumberInput
                            label="최소 줄 수"
                            description="Patience Diff를 적용할 최소 줄 개수"
                            min={1}
                            step={1}
                            value={draft.patienceMinLines}
                            onChange={(v) => setDraft((prev) => ({ ...prev, patienceMinLines: Number(v) || 1 }))}
                        />

                        <NumberInput
                            label="최소 토큰 수"
                            description="Patience Diff를 적용할 최소 토큰 개수"
                            min={1}
                            step={50}
                            value={draft.patienceMinTokens}
                            onChange={(v) => setDraft((prev) => ({ ...prev, patienceMinTokens: Number(v) || 1 }))}
                        />
                    </Stack>
                );

            case "advanced":
                return (
                    <NumberInput
                        label="Local SA Hybrid Ratio"
                        description="Local sequence alignment 가중치 (0 ~ 1)"
                        min={0}
                        max={1}
                        step={0.05}
                        decimalScale={2}
                        value={draft.localSAHybridRatio}
                        onChange={(v) => {
                            const num = Math.max(0, Math.min(1, Number(v) || 0));
                            setDraft((prev) => ({ ...prev, localSAHybridRatio: num }));
                        }}
                    />
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="비교 옵션"
            centered
            size="xl"
            styles={{ body: { display: "flex", flexDirection: "column", gap: "1rem" } }}
        >
            <Flex gap="md" style={{ flex: 1, minHeight: "400px" }}>
                {/* Left Sidebar */}
                <Stack gap={0} style={{ width: "150px", flexShrink: 0, borderRight: "1px solid var(--mantine-color-gray-3)" }}>
                    {categories.map((cat) => (
                        <Button
                            key={cat.key}
                            variant={activeCategory === cat.key ? "filled" : "subtle"}
                            justify="flex-start"
                            fullWidth
                            radius={0}
                            onClick={() => {
                                setActiveCategory(cat.key);
                                contentRef.current?.scrollTo(0, 0);
                            }}
                            styles={{ section: { marginRight: "0.5rem" } }}
                        >
                            {cat.label}
                        </Button>
                    ))}
                </Stack>

                {/* Right Content */}
                <Box
                    ref={contentRef}
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        paddingRight: "1rem",
                        maxHeight: "400px",
                    }}
                >
                    <Stack gap="md">
                        <Box>
                            <Text fw={600} size="lg" mb="xs">
                                {categories.find((c) => c.key === activeCategory)?.label}
                            </Text>
                            <Text size="sm" c="dimmed" mb="md">
                                {categories.find((c) => c.key === activeCategory)?.description}
                            </Text>
                        </Box>
                        {renderContent()}
                    </Stack>
                </Box>
            </Flex>

            {/* Footer */}
            <Group justify="space-between" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
                <Button variant="subtle" color="gray" onClick={reset}>
                    기본값 복원
                </Button>
                <Group>
                    <Button variant="default" onClick={onClose}>취소</Button>
                    <Button onClick={apply} disabled={!canApply}>적용</Button>
                </Group>
            </Group>
        </Modal>
    );
}
