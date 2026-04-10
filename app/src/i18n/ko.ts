export const ko = {
    // ── diff-status-indicator ──
    phaseTokenizing: "잘게 쪼개기",
    phaseDiffing: "다른 곳 찾기",
    phaseProcessing: "뒷정리",
    total: "전체",
    tokens: "단어 조각",
    diffs: "다른 곳",

    // ── options-modal: categories ──
    catGeneral: "일반",
    catGeneralDesc: "기본 설정",
    catTokens: "토큰 처리",
    catTokensDesc: "토큰 병합 옵션",
    catPatience: "Patience Diff",
    catPatienceDesc: "Patience Diff 알고리즘",
    catStructural: "Structural",
    catStructuralDesc: "구조 토큰 (HTML 태그) 설정",
    catAdvanced: "고급",
    catAdvancedDesc: "추가 알고리즘 설정",

    // ── options-modal: general ──
    language: "언어 (Language)",
    languageDesc: "변경 시 페이지가 새로고침됩니다.",
    editableInSyncMode: "동기 모드에서 편집 활성화",
    editableInSyncModeDesc: "양쪽 정렬 모드에서도 문서 편집을 허용합니다.",
    whitespace: "공백 처리",
    whitespaceCollapse: "연속된 공백을 하나로 취급",
    whitespaceIgnore: "모든 공백 무시",
    stackEmptyDiffMarkers: "빈 diff 마커 쌓기",
    stackEmptyDiffMarkersDesc: "내용 없는 diff 마커를 겹쳐서 표시합니다.",

    // ── options-modal: tokens ──
    mergeNonWordTokens: "비단어 토큰 병합",
    mergeNonWordTokensDesc: "연속된 비단어(문장부호 등)를 하나로 묶어서 비교합니다.",
    mergeLetterNumberBoundary: "문자-숫자 경계 병합",
    mergeLetterNumberBoundaryDesc: '문자와 숫자가 붙어있는 경우 하나의 토큰으로 취급합니다. (예: "제1조" → 하나의 토큰)',
    allowStandaloneLawArticle: "법조문 번호 독립 토큰",
    allowStandaloneLawArticleDesc: '"제○조", "제○항" 등 법조문 번호를 독립된 토큰으로 인식합니다.',

    // ── options-modal: patience ──
    usePatience: "Patience Diff 사용",
    usePatienceDesc: "고유한 내용을 가진 줄끼리 우선적으로 매칭을 시도합니다. 비교 속도가 향상됩니다.",
    patienceMinLines: "최소 줄 수",
    patienceMinLinesDesc: "Patience Diff를 적용할 최소 줄 개수",
    patienceMinTokens: "최소 토큰 수",
    patienceMinTokensDesc: "Patience Diff를 적용할 최소 토큰 개수",
    patienceMinTokenCount: "최소 토큰 카운트",
    patienceMinTokenCountDesc: "앵커로 인정할 최소 토큰 개수",
    patienceMinTextLen: "최소 텍스트 길이",
    patienceMinTextLenDesc: "앵커로 인정할 최소 텍스트 길이 (char)",

    // ── options-modal: structural ──
    structuralTokenLength: "Structural Token Length",
    structuralTokenLengthDesc: "구조 토큰으로 인식할 최소 길이",
    structuralOnlyMultipliers: "Structural Only Multipliers",
    structuralOnlyMultipliersDesc: "structural 토큰만으로 이루어진 앵커의 score multiplier (쉼표 구분). index = 매칭 토큰 수",
    structuralLevelBonuses: "Structural Level Bonuses",
    structuralLevelBonusesDesc: "structural level별 추가 배율 (쉼표 구분). index: 0=unused, 1=TD/TH, 2=TR, 3=TABLE",

    // ── options-modal: footer ──
    optionsTitle: "비교 옵션",
    resetDefaults: "기본값 복원",
    cancel: "취소",
    apply: "적용",

    // ── sidebar-footer ──
    statusOn: "(켜짐)",
    statusOff: "(꺼짐)",
    syncModeLabel: "나란히 보기",
    syncModeDesc: "양쪽을 가지런히 맞춰 놓고 같이 스크롤해요.",
    syncModeOnWarn: "켜면 구경만 할 수 있어요.",
    shortcutLabel: "단축키:",
    whitespaceModeLabel: "빈칸 무시",
    whitespaceModeDesc: "띄어쓰기 차이는 못 본 척해요.",

    // ── inline-diff-popover ──
    diffButton: "여기만 비교",
    selectionDiffTitle: "선택 영역 비교",
    viewModeInline: "겹쳐서",
    viewModeSideBySide: "좌우",
    viewModeStacked: "위아래",

    // ── outline-modal ──
    outlineTitle: "아웃라인(철저히 디버깅 용도)",
    outlineEmpty: "공허하네요...",
    outlineLeft: "왼쪽",
    outlineRight: "오른쪽",
    outlineEmptyCell: "(empty)",
};
