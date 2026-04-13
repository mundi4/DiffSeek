import { useDiffseekActions } from "@/bridge/diffseek-provider";
import { localeAtom, useT } from "@/i18n";
import type { Locale, Messages } from "@/i18n";
import { diffseekOptionsAtom } from "@/states/core-atoms";
import { type DiffOptions, type DiffseekOptions, getDefaultDiffseekOptions } from "@core";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import css from "./options-modal.module.css";

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

function OptionSwitch({
	label,
	checked,
	onChange,
	description,
}: {
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
	description?: string;
}) {
	return (
		<div className={css.field}>
			<label className={css.switchLabel}>
				<input
					type="checkbox"
					className={css.switchInput}
					checked={checked}
					onChange={(e) => onChange(e.currentTarget.checked)}
				/>
				<span className={css.switchTrack} />
				{label}
			</label>
			{description && <span className={css.fieldDesc}>{description}</span>}
		</div>
	);
}

function OptionNumber({
	label,
	description,
	value,
	onChange,
	min,
	step,
}: {
	label: string;
	description?: string;
	value: number;
	onChange: (v: number) => void;
	min?: number;
	step?: number;
}) {
	return (
		<div className={css.field}>
			<label className={css.fieldLabel}>{label}</label>
			{description && <span className={css.fieldDesc}>{description}</span>}
			<input
				type="number"
				className={css.numberInput}
				value={value}
				min={min}
				step={step}
				onChange={(e) => onChange(Number(e.currentTarget.value) || (min ?? 0))}
			/>
		</div>
	);
}

function OptionText({
	label,
	description,
	value,
	onChange,
}: {
	label: string;
	description?: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className={css.field}>
			<label className={css.fieldLabel}>{label}</label>
			{description && <span className={css.fieldDesc}>{description}</span>}
			<input
				type="text"
				className={css.textInput}
				value={value}
				onChange={(e) => onChange(e.currentTarget.value)}
			/>
		</div>
	);
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
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (opened && !dialog.open) {
			dialog.showModal();
		} else if (!opened && dialog.open) {
			dialog.close();
		}
	}, [opened]);

	// backdrop 클릭으로 닫기
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		const handleClick = (e: MouseEvent) => {
			if (e.target === dialog) onClose();
		};
		dialog.addEventListener("click", handleClick);
		return () => dialog.removeEventListener("click", handleClick);
	}, [onClose]);

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

	const setDiff = (patch: Partial<DiffOptions>) => {
		setDraft((prev) => ({ ...prev, diff: { ...prev.diff, ...patch } }));
	};

	const parseNumberArray = (s: string): number[] | null => {
		const parts = s
			.split(",")
			.map((p) => p.trim())
			.filter(Boolean);
		if (parts.length === 0) return null;
		const nums = parts.map(Number);
		if (nums.some(Number.isNaN)) return null;
		return nums;
	};

	const activeCat = categories.find((c) => c.key === activeCategory);

	const renderContent = () => {
		switch (activeCategory) {
			case "general":
				return (
					<div className={css.stack}>
						<div className={css.field}>
							<span className={css.fieldLabel}>{t.language}</span>
							<div className={css.radioRow}>
								<label className={css.radioLabel}>
									<input
										type="radio"
										name="locale"
										value="ko"
										checked={locale === "ko"}
										onChange={() => setLocale("ko" as Locale)}
									/>
									한국어
								</label>
								<label className={css.radioLabel}>
									<input
										type="radio"
										name="locale"
										value="en"
										checked={locale === "en"}
										onChange={() => setLocale("en" as Locale)}
									/>
									English
								</label>
							</div>
							<span className={css.fieldDesc}>{t.languageDesc}</span>
						</div>

						<OptionSwitch
							label={t.editableInSyncMode}
							checked={draft.editableInSyncMode}
							onChange={(v) => setDraft((prev) => ({ ...prev, editableInSyncMode: v }))}
							description={t.editableInSyncModeDesc}
						/>

						<div className={css.field}>
							<span className={css.fieldLabel}>{t.whitespace}</span>
							<div className={css.radioGroup}>
								<label className={css.radioLabel}>
									<input
										type="radio"
										name="whitespace"
										value="collapse"
										checked={draft.diff.whitespace === "collapse"}
										onChange={() => setDiff({ whitespace: "collapse" })}
									/>
									{t.whitespaceCollapse}
								</label>
								<label className={css.radioLabel}>
									<input
										type="radio"
										name="whitespace"
										value="ignore"
										checked={draft.diff.whitespace === "ignore"}
										onChange={() => setDiff({ whitespace: "ignore" })}
									/>
									{t.whitespaceIgnore}
								</label>
							</div>
						</div>

						<OptionSwitch
							label={t.stackEmptyDiffMarkers}
							checked={draft.diff.stackEmptyDiffMarkers}
							onChange={(v) => setDiff({ stackEmptyDiffMarkers: v })}
							description={t.stackEmptyDiffMarkersDesc}
						/>
					</div>
				);

			case "tokens":
				return (
					<div className={css.stack}>
						<OptionSwitch
							label={t.mergeNonWordTokens}
							checked={draft.diff.mergeNonWordTokens}
							onChange={(v) => setDiff({ mergeNonWordTokens: v })}
							description={t.mergeNonWordTokensDesc}
						/>
						<OptionSwitch
							label={t.mergeLetterNumberBoundary}
							checked={draft.diff.mergeLetterNumberBoundary}
							onChange={(v) => setDiff({ mergeLetterNumberBoundary: v })}
							description={t.mergeLetterNumberBoundaryDesc}
						/>
						<OptionSwitch
							label={t.allowStandaloneLawArticle}
							checked={draft.diff.allowStandaloneLawArticle}
							onChange={(v) => setDiff({ allowStandaloneLawArticle: v })}
							description={t.allowStandaloneLawArticleDesc}
						/>
					</div>
				);

			case "patience":
				return (
					<div className={css.stack}>
						<OptionSwitch
							label={t.usePatience}
							checked={draft.diff.usePatience}
							onChange={(v) => setDiff({ usePatience: v })}
							description={t.usePatienceDesc}
						/>
						<OptionNumber
							label={t.patienceMinLines}
							description={t.patienceMinLinesDesc}
							value={draft.diff.patienceMinLines}
							onChange={(v) => setDiff({ patienceMinLines: v })}
							min={1}
							step={1}
						/>
						<OptionNumber
							label={t.patienceMinTokens}
							description={t.patienceMinTokensDesc}
							value={draft.diff.patienceMinTokens}
							onChange={(v) => setDiff({ patienceMinTokens: v })}
							min={1}
							step={50}
						/>
						<OptionNumber
							label={t.patienceMinTokenCount}
							description={t.patienceMinTokenCountDesc}
							value={draft.diff.patienceMinTokenCount}
							onChange={(v) => setDiff({ patienceMinTokenCount: v })}
							min={1}
							step={1}
						/>
						<OptionNumber
							label={t.patienceMinTextLen}
							description={t.patienceMinTextLenDesc}
							value={draft.diff.patienceMinTextLen}
							onChange={(v) => setDiff({ patienceMinTextLen: v })}
							min={1}
							step={1}
						/>
					</div>
				);

			case "structural":
				return (
					<div className={css.stack}>
						<OptionNumber
							label={t.structuralTokenLength}
							description={t.structuralTokenLengthDesc}
							value={draft.diff.structuralTokenLength}
							onChange={(v) => setDiff({ structuralTokenLength: v })}
							min={0}
							step={1}
						/>
						<OptionText
							label={t.structuralOnlyMultipliers}
							description={t.structuralOnlyMultipliersDesc}
							value={draft.diff.structuralOnlyMultipliers.join(", ")}
							onChange={(v) => {
								const arr = parseNumberArray(v);
								if (arr) setDiff({ structuralOnlyMultipliers: arr });
							}}
						/>
						<OptionText
							label={t.structuralLevelBonuses}
							description={t.structuralLevelBonusesDesc}
							value={draft.diff.structuralLevelBonuses.join(", ")}
							onChange={(v) => {
								const arr = parseNumberArray(v);
								if (arr) setDiff({ structuralLevelBonuses: arr });
							}}
						/>
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<dialog ref={dialogRef} className={css.dialog} onClose={onClose}>
			<div className={css.header}>
				<span className={css.title}>{t.optionsTitle}</span>
				<button type="button" className={css.closeBtn} onClick={onClose}>
					<svg width="14" height="14" viewBox="0 0 14 14">
						<path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				</button>
			</div>

			<div className={css.body}>
				<nav className={css.nav}>
					{categories.map((cat) => (
						<button
							key={cat.key}
							type="button"
							className={`${css.navBtn} ${activeCategory === cat.key ? css.navBtnActive : ""}`}
							onClick={() => {
								setActiveCategory(cat.key);
								contentRef.current?.scrollTo(0, 0);
							}}
						>
							{cat.label}
						</button>
					))}
				</nav>

				<div ref={contentRef} className={css.content}>
					<div className={css.sectionTitle}>{activeCat?.label}</div>
					<div className={css.sectionDesc}>{activeCat?.description}</div>
					{renderContent()}
				</div>
			</div>

			<div className={css.footer}>
				<button type="button" className={`${css.btn} ${css.btnSubtle}`} onClick={reset}>
					{t.resetDefaults}
				</button>
				<div className={css.footerRight}>
					<button type="button" className={css.btn} onClick={onClose}>
						{t.cancel}
					</button>
					<button
						type="button"
						className={`${css.btn} ${css.btnPrimary}`}
						onClick={apply}
						disabled={!canApply}
					>
						{t.apply}
					</button>
				</div>
			</div>
		</dialog>
	);
}
