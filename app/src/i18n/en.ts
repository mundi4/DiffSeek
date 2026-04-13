import type { Messages } from "./types";

export const en: Messages = {
	// ── diff-status-indicator ──
	phaseTokenizing: "Chopping up",
	phaseDiffing: "Spot the diff",
	phaseProcessing: "Wrapping up",
	total: "Total",
	tokens: "Pieces",
	diffs: "Differences",

	// ── options-modal: categories ──
	catGeneral: "General",
	catGeneralDesc: "Basic settings",
	catTokens: "Token handling",
	catTokensDesc: "Token merge options",
	catPatience: "Patience Diff",
	catPatienceDesc: "Patience Diff algorithm",
	catStructural: "Structural",
	catStructuralDesc: "Structural token (HTML tag) settings",
	catAdvanced: "Advanced",
	catAdvancedDesc: "Additional algorithm settings",

	// ── options-modal: general ──
	language: "Language (언어)",
	languageDesc: "Page will reload on change.",
	editableInSyncMode: "Enable editing in sync mode",
	editableInSyncModeDesc: "Allow document editing while in alignment mode.",
	whitespace: "Whitespace handling",
	whitespaceCollapse: "Collapse consecutive whitespace",
	whitespaceIgnore: "Ignore all whitespace",
	stackEmptyDiffMarkers: "Stack empty diff markers",
	stackEmptyDiffMarkersDesc: "Stack diff markers that have no content.",

	// ── options-modal: tokens ──
	mergeNonWordTokens: "Merge non-word tokens",
	mergeNonWordTokensDesc: "Merge consecutive non-word characters (punctuation, etc.) into a single token.",
	mergeLetterNumberBoundary: "Merge letter-number boundary",
	mergeLetterNumberBoundaryDesc: 'Treat adjacent letters and numbers as a single token (e.g. "Art1" → one token).',
	allowStandaloneLawArticle: "Standalone law article numbers",
	allowStandaloneLawArticleDesc: "Recognize Korean law article numbers (제○조, 제○항, etc.) as independent tokens.",

	// ── options-modal: patience ──
	usePatience: "Use Patience Diff",
	usePatienceDesc: "Prioritize matching unique lines first. Improves diff speed.",
	patienceMinLines: "Min lines",
	patienceMinLinesDesc: "Minimum number of lines to activate Patience Diff",
	patienceMinTokens: "Min tokens",
	patienceMinTokensDesc: "Minimum number of tokens to activate Patience Diff",
	patienceMinTokenCount: "Min token count",
	patienceMinTokenCountDesc: "Minimum token count to qualify as an anchor",
	patienceMinTextLen: "Min text length",
	patienceMinTextLenDesc: "Minimum text length (chars) to qualify as an anchor",

	// ── options-modal: structural ──
	structuralTokenLength: "Structural Token Length",
	structuralTokenLengthDesc: "Minimum length to recognize as a structural token",
	structuralOnlyMultipliers: "Structural Only Multipliers",
	structuralOnlyMultipliersDesc:
		"Score multiplier for anchors with only structural tokens (comma-separated). index = matched token count",
	structuralLevelBonuses: "Structural Level Bonuses",
	structuralLevelBonusesDesc:
		"Bonus multiplier per structural level (comma-separated). index: 0=unused, 1=TD/TH, 2=TR, 3=TABLE",

	// ── options-modal: footer ──
	optionsTitle: "Diff Options",
	resetDefaults: "Reset defaults",
	cancel: "Cancel",
	apply: "Apply",

	// ── sidebar-footer ──
	statusOn: "(on)",
	statusOff: "(off)",
	syncModeLabel: "Sync mode",
	syncModeDesc: "Align both documents side-by-side and synchronize scrolling.",
	syncModeOnWarn: "Editing is disabled while sync mode is on.",
	shortcutLabel: "Shortcut:",
	whitespaceModeLabel: "Ignore whitespace",
	whitespaceModeDesc: "Compare while ignoring whitespace.",

	// ── inline-diff-popover ──
	diffButton: "Diff this",
	selectionDiffTitle: "Selection Diff",
	viewModeInline: "Overlaid",
	viewModeSideBySide: "Side by side",
	viewModeStacked: "Stacked",

	// ── outline-modal ──
	outlineTitle: "Outline (debug only)",
	outlineEmpty: "Nothing to see here...",
	outlineLeft: "Left",
	outlineRight: "Right",
	outlineEmptyCell: "(empty)",
};
