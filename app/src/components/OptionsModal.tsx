import { useEffect, useRef, useState } from 'preact/hooks';
import { appState } from '../states/appState';
import { getDefaultDiffOptions } from '../core/renderer/DiffOptions';
import type { DiffOptions } from '../../../core/src/types';

function useDraftOptions(open: boolean) {
    const [draft, setDraft] = useState<DiffOptions>(getDefaultDiffOptions());

    useEffect(() => {
        if (!open) {
            return;
        }
        const runtime = appState.diffseekRuntime;
        if (runtime) {
            setDraft(runtime.getDiffOptions());
        } else {
            setDraft(getDefaultDiffOptions());
        }
    }, [open]);

    return [draft, setDraft] as const;
}

export function OptionsModal() {
    const open = appState.optionsModalOpen.value;
    const [draft, setDraft] = useDraftOptions(open);
    const modalRef = useRef<HTMLDivElement>(null);
    const initialFocusRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        const previouslyFocused = document.activeElement as HTMLElement | null;

        const getFocusable = () => {
            const root = modalRef.current;
            if (!root) {
                return [] as HTMLElement[];
            }
            const focusable = root.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            return Array.from(focusable).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
        };

        const focusFirst = () => {
            if (initialFocusRef.current) {
                initialFocusRef.current.focus();
                return;
            }
            const focusable = getFocusable();
            if (focusable.length > 0) {
                focusable[0].focus();
            }
        };

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                appState.optionsModalOpen.value = false;
                return;
            }

            if (e.key === 'Tab') {
                const focusable = getFocusable();
                if (focusable.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first || document.activeElement === modalRef.current) {
                        last.focus();
                        e.preventDefault();
                    }
                } else if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        };
        window.addEventListener('keydown', handleKeydown);

        requestAnimationFrame(() => {
            focusFirst();
        });

        return () => {
            window.removeEventListener('keydown', handleKeydown);
            previouslyFocused?.focus();
        };
    }, [open]);

    if (!open) {
        return null;
    }

    const updateField = <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const apply = () => {
        const runtime = appState.diffseekRuntime;
        runtime?.setDiffOptions(draft);
        appState.diffOptions.value = draft;
        runtime?.runDiffWorkflow();
        appState.optionsModalOpen.value = false
    };

    const reset = () => {
        const defaults = getDefaultDiffOptions();
        setDraft(defaults);
        appState.diffseekRuntime?.setDiffOptions(null);
        appState.diffOptions.value = defaults;
    };

    return (
        <div
            className="options-modal-backdrop"
            onClick={(e) => {
                if (e.currentTarget === e.target) {
                    appState.optionsModalOpen.value = false;
                }
            }}
        >
            <div ref={modalRef} className="options-modal" role="dialog" aria-modal="true" aria-label="Options">
                <header className="options-modal-header">
                    <div className="options-modal-header-content">
                        <h2 className="options-modal-title">설정</h2>
                        <p className="options-modal-subtitle">비교 결과에 영향을 주는 핵심 옵션</p>
                    </div>
                    <button
                        className="options-modal-close"
                        onClick={() => (appState.optionsModalOpen.value = false)}
                        aria-label="Close options"
                    >
                        ×
                    </button>
                </header>

                <section className="options-modal-body">
                    <div className="options-section">
                        <div className="options-section-header">
                            <h3>공백 처리</h3>
                            <span className="options-section-caption">띄어쓰기/줄바꿈 처리 방식</span>
                        </div>
                        <div className="options-grid">
                            <label htmlFor="opt-whitespace">공백 처리 방식</label>
                            <select
                                id="opt-whitespace"
                                ref={initialFocusRef}
                                value={draft.whitespace}
                                onChange={(e) => updateField('whitespace', (e.target as HTMLSelectElement).value as DiffOptions['whitespace'])}
                            >
                                <option value="collapse">일반(공백 축약)</option>
                                <option value="ignore">공백 무시</option>
                                <option value="ignoreAtEdge">줄 경계의 공백만 무시</option>
                            </select>
                        </div>
                    </div>

                    <div className="options-section">
                        <div className="options-section-header">
                            <h3>비교 단위</h3>
                            <span className="options-section-caption">문장 내 연속 토큰 기반</span>
                        </div>
                        <div className="options-grid">
                            <label htmlFor="opt-use-grams">그램(연속 토큰) 사용</label>
                            <input
                                id="opt-use-grams"
                                type="checkbox"
                                checked={draft.useGrams}
                                onChange={(e) => updateField('useGrams', (e.target as HTMLInputElement).checked)}
                            />

                            <label htmlFor="opt-max-gram">최대 그램 길이</label>
                            <input
                                id="opt-max-gram"
                                type="number"
                                min={1}
                                max={12}
                                value={draft.maxGram}
                                onChange={(e) => updateField('maxGram', Number((e.target as HTMLInputElement).value))}
                            />
                        </div>
                    </div>

                    <div className="options-section">
                        <div className="options-section-header">
                            <h3>보정값</h3>
                            <span className="options-section-caption">매칭 우선순위 보정</span>
                        </div>
                        <div className="options-grid">
                            <label htmlFor="opt-length-bonus">길이 보너스 사용</label>
                            <input
                                id="opt-length-bonus"
                                type="checkbox"
                                checked={draft.useLengthBonus}
                                onChange={(e) => updateField('useLengthBonus', (e.target as HTMLInputElement).checked)}
                            />

                            <label htmlFor="opt-length-mult">길이 보너스 강도</label>
                            <input
                                id="opt-length-mult"
                                type="number"
                                step={0.1}
                                value={draft.lengthBonusMultiplier}
                                onChange={(e) => updateField('lengthBonusMultiplier', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-length-max">그램당 최대 길이</label>
                            <input
                                id="opt-length-max"
                                type="number"
                                min={1}
                                value={draft.maxLengthPerGramForBonus}
                                onChange={(e) => updateField('maxLengthPerGramForBonus', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-line-start">줄 시작 보너스 사용</label>
                            <input
                                id="opt-line-start"
                                type="checkbox"
                                checked={draft.useLineStartBonus}
                                onChange={(e) => updateField('useLineStartBonus', (e.target as HTMLInputElement).checked)}
                            />

                            <label htmlFor="opt-line-start-mult">줄 시작 보너스 강도</label>
                            <input
                                id="opt-line-start-mult"
                                type="number"
                                step={0.1}
                                value={draft.lineStartBonusMultiplier}
                                onChange={(e) => updateField('lineStartBonusMultiplier', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-unique">고유성 보너스 사용</label>
                            <input
                                id="opt-unique"
                                type="checkbox"
                                checked={draft.useUniqueBonus}
                                onChange={(e) => updateField('useUniqueBonus', (e.target as HTMLInputElement).checked)}
                            />

                            <label htmlFor="opt-unique-mult">고유성 보너스 강도</label>
                            <input
                                id="opt-unique-mult"
                                type="number"
                                step={0.1}
                                value={draft.uniqueBonusMultiplier}
                                onChange={(e) => updateField('uniqueBonusMultiplier', Number((e.target as HTMLInputElement).value))}
                            />
                        </div>
                    </div>

                    <div className="options-section">
                        <div className="options-section-header">
                            <h3>대략 분할</h3>
                            <span className="options-section-caption">큰 문서의 성능 최적화</span>
                        </div>
                        <div className="options-grid">
                            <label htmlFor="opt-coarse">대략 분할 사용</label>
                            <input
                                id="opt-coarse"
                                type="checkbox"
                                checked={draft.useCoarseSplit}
                                onChange={(e) => updateField('useCoarseSplit', (e.target as HTMLInputElement).checked)}
                            />

                            <label htmlFor="opt-coarse-mode">앵커 모드</label>
                            <select
                                id="opt-coarse-mode"
                                value={draft.coarseAnchorMode}
                                onChange={(e) => updateField('coarseAnchorMode', (e.target as HTMLSelectElement).value as DiffOptions['coarseAnchorMode'])}
                            >
                                <option value="line">줄 전체</option>
                                <option value="linePrefix">줄 앞부분</option>
                                <option value="fixedWindow">고정 윈도우</option>
                            </select>

                            <label htmlFor="opt-coarse-min-tokens">앵커 최소 토큰 수</label>
                            <input
                                id="opt-coarse-min-tokens"
                                type="number"
                                min={1}
                                value={draft.coarseAnchorMinTokens}
                                onChange={(e) => updateField('coarseAnchorMinTokens', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-coarse-window">앵커 토큰 윈도우</label>
                            <input
                                id="opt-coarse-window"
                                type="number"
                                min={1}
                                value={draft.coarseAnchorTokenWindow}
                                onChange={(e) => updateField('coarseAnchorTokenWindow', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-coarse-wordlike">앵커 최소 단어형 토큰</label>
                            <input
                                id="opt-coarse-wordlike"
                                type="number"
                                min={0}
                                value={draft.coarseAnchorMinWordLikeTokens}
                                onChange={(e) => updateField('coarseAnchorMinWordLikeTokens', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-coarse-chars">앵커 최소 유효 글자수</label>
                            <input
                                id="opt-coarse-chars"
                                type="number"
                                min={0}
                                value={draft.coarseAnchorMinEffectiveChars}
                                onChange={(e) => updateField('coarseAnchorMinEffectiveChars', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-split-min-tokens">분할 최소 토큰 수</label>
                            <input
                                id="opt-split-min-tokens"
                                type="number"
                                min={1}
                                value={draft.coarseSplitMinTokens}
                                onChange={(e) => updateField('coarseSplitMinTokens', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-split-min-side">분할 최소 편 토큰</label>
                            <input
                                id="opt-split-min-side"
                                type="number"
                                min={1}
                                value={draft.coarseSplitMinSideTokens}
                                onChange={(e) => updateField('coarseSplitMinSideTokens', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-split-gain">분할 최소 이득 비율</label>
                            <input
                                id="opt-split-gain"
                                type="number"
                                step={0.01}
                                value={draft.coarseSplitMinGainRatio}
                                onChange={(e) => updateField('coarseSplitMinGainRatio', Number((e.target as HTMLInputElement).value))}
                            />

                            <label htmlFor="opt-split-max-anchors">분할 최대 고유 앵커 수</label>
                            <input
                                id="opt-split-max-anchors"
                                type="number"
                                min={1}
                                value={draft.coarseSplitMaxUniqueAnchors}
                                onChange={(e) => updateField('coarseSplitMaxUniqueAnchors', Number((e.target as HTMLInputElement).value))}
                            />
                        </div>
                    </div>
                </section>

                <footer className="options-modal-footer">
                    <button className="options-button" onClick={reset}>초기화</button>
                    <div className="options-modal-spacer" />
                    <button className="options-button" onClick={() => (appState.optionsModalOpen.value = false)}>닫기</button>
                    <button className="options-button options-button-primary" onClick={apply}>적용</button>
                </footer>
            </div>
        </div>
    );
}
