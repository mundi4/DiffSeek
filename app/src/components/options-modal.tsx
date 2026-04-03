import { useDiffseekActions } from "@/bridge/diffseek-provider";
import { diffseekOptionsAtom } from "@/states/core-atoms";
import { type DiffOptions, type DiffseekOptions, getDefaultDiffseekOptions } from "@core";
import { Box, Button, Flex, Group, Modal, NumberInput, Radio, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";

type CategoryKey = "general" | "tokens" | "patience" | "structural" | "advanced";

interface Category {
    key: CategoryKey;
    label: string;
    description: string;
}

const categories: Category[] = [
    { key: "general", label: "일반", description: "기본 설정" },
    { key: "tokens", label: "토큰 처리", description: "토큰 병합 옵션" },
    { key: "patience", label: "Patience Diff", description: "Patience Diff 알고리즘" },
    { key: "structural", label: "Structural", description: "구조 토큰 (HTML 태그) 설정" },
    { key: "advanced", label: "고급", description: "추가 알고리즘 설정" },
];

export function OptionsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
    const current = useAtomValue(diffseekOptionsAtom);
    const { applyOptions, resetOptions } = useDiffseekActions();
    const [draft, setDraft] = useState<DiffseekOptions>(current);
    const [activeCategory, setActiveCategory] = useState<CategoryKey>("general");
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (opened) {
            setDraft(current);
            setActiveCategory("general");
        }
    }, [opened, current]);

    const canApply = useMemo(() => {
        return JSON.stringify(draft) !== JSON.stringify(current);
    }, [draft, current]);

    const apply = () => {
        applyOptions(draft);
        onClose();
    };

    const reset = () => {
        const defaults = getDefaultDiffseekOptions();
        resetOptions();
        setDraft(defaults);
    };

    // draft.diff의 필드를 업데이트하는 헬퍼
    const setDiff = (patch: Partial<DiffOptions>) => {
        setDraft((prev) => ({ ...prev, diff: { ...prev.diff, ...patch } }));
    };

    const parseNumberArray = (s: string): number[] | null => {
        const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
        if (parts.length === 0) return null;
        const nums = parts.map(Number);
        if (nums.some(Number.isNaN)) return null;
        return nums;
    };

    const renderContent = () => {
        switch (activeCategory) {
            case "general":
                return (
                    <Stack gap="lg">
                        <Box>
                            <Switch
                                label="동기 모드에서 편집 활성화"
                                checked={draft.editableInSyncMode}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDraft((prev) => ({ ...prev, editableInSyncMode: checked }));
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                양쪽 정렬 모드에서도 문서 편집을 허용합니다.
                            </Text>
                        </Box>

                        <Box>
                            <Radio.Group
                                label="공백 처리"
                                value={draft.diff.whitespace}
                                onChange={(v) => setDiff({ whitespace: v as DiffOptions["whitespace"] })}
                            >
                                <Stack gap="xs" mt="xs">
                                    <Radio value="collapse" label="연속된 공백을 하나로 취급" />
                                    <Radio value="ignore" label="모든 공백 무시" />
                                </Stack>
                            </Radio.Group>
                        </Box>

                        <Box>
                            <Switch
                                label="빈 diff 마커 쌓기"
                                checked={draft.diff.stackEmptyDiffMarkers}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ stackEmptyDiffMarkers: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                내용 없는 diff 마커를 겹쳐서 표시합니다.
                            </Text>
                        </Box>
                    </Stack>
                );

            case "tokens":
                return (
                    <Stack gap="lg">
                        <Box>
                            <Switch
                                label="비단어 토큰 병합"
                                checked={draft.diff.mergeNonWordTokens}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ mergeNonWordTokens: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                연속된 비단어(문장부호 등)를 하나로 묶어서 비교합니다.
                            </Text>
                        </Box>

                        <Box>
                            <Switch
                                label="문자-숫자 경계 병합"
                                checked={draft.diff.mergeLetterNumberBoundary}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ mergeLetterNumberBoundary: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                문자와 숫자가 붙어있는 경우 하나의 토큰으로 취급합니다. (예: "제1조" → 하나의 토큰)
                            </Text>
                        </Box>

                        <Box>
                            <Switch
                                label="법조문 번호 독립 토큰"
                                checked={draft.diff.allowStandaloneLawArticle}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ allowStandaloneLawArticle: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                "제○조", "제○항" 등 법조문 번호를 독립된 토큰으로 인식합니다.
                            </Text>
                        </Box>
                    </Stack>
                );

            case "patience":
                return (
                    <Stack gap="lg">
                        <Box>
                            <Switch
                                label="Patience Diff 사용"
                                checked={draft.diff.usePatience}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ usePatience: checked });
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
                            value={draft.diff.patienceMinLines}
                            onChange={(v) => setDiff({ patienceMinLines: Number(v) || 1 })}
                        />

                        <NumberInput
                            label="최소 토큰 수"
                            description="Patience Diff를 적용할 최소 토큰 개수"
                            min={1}
                            step={50}
                            value={draft.diff.patienceMinTokens}
                            onChange={(v) => setDiff({ patienceMinTokens: Number(v) || 1 })}
                        />

                        <NumberInput
                            label="최소 토큰 카운트"
                            description="앵커로 인정할 최소 토큰 개수"
                            min={1}
                            step={1}
                            value={draft.diff.patienceMinTokenCount}
                            onChange={(v) => setDiff({ patienceMinTokenCount: Number(v) || 1 })}
                        />

                        <NumberInput
                            label="최소 텍스트 길이"
                            description="앵커로 인정할 최소 텍스트 길이 (char)"
                            min={1}
                            step={1}
                            value={draft.diff.patienceMinTextLen}
                            onChange={(v) => setDiff({ patienceMinTextLen: Number(v) || 1 })}
                        />
                    </Stack>
                );

            case "structural":
                return (
                    <Stack gap="lg">
                        <NumberInput
                            label="Structural Token Length"
                            description="구조 토큰으로 인식할 최소 길이"
                            min={0}
                            step={1}
                            value={draft.diff.structuralTokenLength}
                            onChange={(v) => setDiff({ structuralTokenLength: Number(v) || 0 })}
                        />

                        <TextInput
                            label="Structural Only Multipliers"
                            description="structural 토큰만으로 이루어진 앵커의 score multiplier (쉼표 구분). index = 매칭 토큰 수 h"
                            value={draft.diff.structuralOnlyMultipliers.join(", ")}
                            onChange={(e) => {
                                const arr = parseNumberArray(e.currentTarget.value);
                                if (arr) setDiff({ structuralOnlyMultipliers: arr });
                            }}
                        />

                        <TextInput
                            label="Structural Level Bonuses"
                            description="structural level별 추가 배율 (쉼표 구분). index: 0=unused, 1=TD/TH, 2=TR, 3=TABLE"
                            value={draft.diff.structuralLevelBonuses.join(", ")}
                            onChange={(e) => {
                                const arr = parseNumberArray(e.currentTarget.value);
                                if (arr) setDiff({ structuralLevelBonuses: arr });
                            }}
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
                        value={draft.diff.localSAHybridRatio}
                        onChange={(v) => {
                            const num = Math.max(0, Math.min(1, Number(v) || 0));
                            setDiff({ localSAHybridRatio: num });
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
