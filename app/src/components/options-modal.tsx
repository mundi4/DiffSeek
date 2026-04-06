import { useDiffseekActions } from "@/bridge/diffseek-provider";
import { localeAtom, useT } from "@/i18n";
import type { Locale, Messages } from "@/i18n";
import { diffseekOptionsAtom } from "@/states/core-atoms";
import { type DiffOptions, type DiffseekOptions, getDefaultDiffseekOptions } from "@core";
import { Box, Button, Flex, Group, Modal, NumberInput, Radio, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";

type CategoryKey = "general" | "tokens" | "patience" | "structural" | "advanced";

interface Category {
    key: CategoryKey;
    label: string;
    description: string;
}

function getCategories(t: Messages): Category[] {
    return [
        { key: "general", label: t.catGeneral, description: t.catGeneralDesc },
        { key: "tokens", label: t.catTokens, description: t.catTokensDesc },
        { key: "patience", label: t.catPatience, description: t.catPatienceDesc },
        { key: "structural", label: t.catStructural, description: t.catStructuralDesc },
        { key: "advanced", label: t.catAdvanced, description: t.catAdvancedDesc },
    ];
}

export function OptionsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
    const t = useT();
    const locale = useAtomValue(localeAtom);
    const setLocale = useSetAtom(localeAtom);
    const categories = getCategories(t);
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
                            <Radio.Group
                                label={t.language}
                                value={locale}
                                onChange={(v) => setLocale(v as Locale)}
                            >
                                <Group gap="md" mt="xs">
                                    <Radio value="ko" label="한국어" />
                                    <Radio value="en" label="English" />
                                </Group>
                            </Radio.Group>
                            <Text size="sm" c="dimmed" mt="xs">
                                {t.languageDesc}
                            </Text>
                        </Box>

                        <Box>
                            <Switch
                                label={t.editableInSyncMode}
                                checked={draft.editableInSyncMode}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDraft((prev) => ({ ...prev, editableInSyncMode: checked }));
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                {t.editableInSyncModeDesc}
                            </Text>
                        </Box>

                        <Box>
                            <Radio.Group
                                label={t.whitespace}
                                value={draft.diff.whitespace}
                                onChange={(v) => setDiff({ whitespace: v as DiffOptions["whitespace"] })}
                            >
                                <Stack gap="xs" mt="xs">
                                    <Radio value="collapse" label={t.whitespaceCollapse} />
                                    <Radio value="ignore" label={t.whitespaceIgnore} />
                                </Stack>
                            </Radio.Group>
                        </Box>

                        <Box>
                            <Switch
                                label={t.stackEmptyDiffMarkers}
                                checked={draft.diff.stackEmptyDiffMarkers}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ stackEmptyDiffMarkers: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                {t.stackEmptyDiffMarkersDesc}
                            </Text>
                        </Box>
                    </Stack>
                );

            case "tokens":
                return (
                    <Stack gap="lg">
                        <Box>
                            <Switch
                                label={t.mergeNonWordTokens}
                                checked={draft.diff.mergeNonWordTokens}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ mergeNonWordTokens: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                {t.mergeNonWordTokensDesc}
                            </Text>
                        </Box>

                        <Box>
                            <Switch
                                label={t.mergeLetterNumberBoundary}
                                checked={draft.diff.mergeLetterNumberBoundary}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ mergeLetterNumberBoundary: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                {t.mergeLetterNumberBoundaryDesc}
                            </Text>
                        </Box>

                        <Box>
                            <Switch
                                label={t.allowStandaloneLawArticle}
                                checked={draft.diff.allowStandaloneLawArticle}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ allowStandaloneLawArticle: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                {t.allowStandaloneLawArticleDesc}
                            </Text>
                        </Box>
                    </Stack>
                );

            case "patience":
                return (
                    <Stack gap="lg">
                        <Box>
                            <Switch
                                label={t.usePatience}
                                checked={draft.diff.usePatience}
                                onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setDiff({ usePatience: checked });
                                }}
                            />
                            <Text size="sm" c="dimmed" mt="xs">
                                {t.usePatienceDesc}
                            </Text>
                        </Box>

                        <NumberInput
                            label={t.patienceMinLines}
                            description={t.patienceMinLinesDesc}
                            min={1}
                            step={1}
                            value={draft.diff.patienceMinLines}
                            onChange={(v) => setDiff({ patienceMinLines: Number(v) || 1 })}
                        />

                        <NumberInput
                            label={t.patienceMinTokens}
                            description={t.patienceMinTokensDesc}
                            min={1}
                            step={50}
                            value={draft.diff.patienceMinTokens}
                            onChange={(v) => setDiff({ patienceMinTokens: Number(v) || 1 })}
                        />

                        <NumberInput
                            label={t.patienceMinTokenCount}
                            description={t.patienceMinTokenCountDesc}
                            min={1}
                            step={1}
                            value={draft.diff.patienceMinTokenCount}
                            onChange={(v) => setDiff({ patienceMinTokenCount: Number(v) || 1 })}
                        />

                        <NumberInput
                            label={t.patienceMinTextLen}
                            description={t.patienceMinTextLenDesc}
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
                            label={t.structuralTokenLength}
                            description={t.structuralTokenLengthDesc}
                            min={0}
                            step={1}
                            value={draft.diff.structuralTokenLength}
                            onChange={(v) => setDiff({ structuralTokenLength: Number(v) || 0 })}
                        />

                        <TextInput
                            label={t.structuralOnlyMultipliers}
                            description={t.structuralOnlyMultipliersDesc}
                            value={draft.diff.structuralOnlyMultipliers.join(", ")}
                            onChange={(e) => {
                                const arr = parseNumberArray(e.currentTarget.value);
                                if (arr) setDiff({ structuralOnlyMultipliers: arr });
                            }}
                        />

                        <TextInput
                            label={t.structuralLevelBonuses}
                            description={t.structuralLevelBonusesDesc}
                            value={draft.diff.structuralLevelBonuses.join(", ")}
                            onChange={(e) => {
                                const arr = parseNumberArray(e.currentTarget.value);
                                if (arr) setDiff({ structuralLevelBonuses: arr });
                            }}
                        />
                    </Stack>
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={t.optionsTitle}
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
                    {t.resetDefaults}
                </Button>
                <Group>
                    <Button variant="default" onClick={onClose}>{t.cancel}</Button>
                    <Button onClick={apply} disabled={!canApply}>{t.apply}</Button>
                </Group>
            </Group>
        </Modal>
    );
}
