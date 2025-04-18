"use strict";
// DIFF 색(HUE). 0(빨)은 DIFF 배경색으로 쓰이니 패스
// 완전한 색상 코드보다 HUE만 사용하면 용도에 따라 색을 조절하기 쉬움.
// 인접한 색상과 너무 가깝지 않도록 아주 CAREFUL하게 고른 순서. 과학이다.
const DIFF_COLOR_HUES = [
    30, // 주황?
    180, // cyan
    300, // 핑크?
    120, // 초록
    240, // 파랑
    60, // 노랑
    270, // 보라?
];
const NUM_DIFF_COLORS = DIFF_COLOR_HUES.length;
const LINE_TAG = "DIV";
const ANCHOR_TAG = "HR";
const DIFF_ELEMENT_NAME = "MARK";
const EDITOR_PADDING = 8;
const LINE_HEIGHT = 20;
const TOPBAR_HEIGHT = 0;
const SCROLL_MARGIN = LINE_HEIGHT * 4;
// 어차피 백그라운드에서 처리되고 기존 작업이 취소시킨 후에 시작되니 너무 크게 잡을 필요는 없을 듯
const COMPUTE_DEBOUNCE_TIME = 100; // ms
const FORCE_RENDER_TIMEOUT = 300; // ms
// 문장부호나 특수문자를 정규화 하기 위해서...
// 따옴표, 중간점 등등등 문자코드는 다르지만 같다고 처리해야 될 문자들이 많음.
// length===1인 문자는 그냥 문자
// 숫자는 charCode
// &로 시작하면 html 엔티티
// TODO: 각종 화살표 특수문자들...
const NORMALIZE_CHARS = [
    ['"', "“", "”"],
    ["'", "‘", "’"],
    ["-", "–", "—"],
    [".", "․"],
    ["⋅", "·", "•"], // &middot;과 &bullet;(&bull;)은 다른 걸로 여겨야하지 않을까? middot대신 bullet을 쓰면 점이 너무 왕점이라 보기 흉한데...
    ["…", "⋯"],
    ["(", "（"], // 이런 걸 굳이 특수문자로 사용하는 사람이 있다고?? 믿기 힘들지만 있더라...
    [")", "）"],
    ["[", "［"],
    ["]", "］"],
    ["{", "｛"],
    ["}", "｝"],
    ["<", "＜"],
    [">", "＞"],
    ["-", "－"], // 왜 굳이... 이런 문자를...? 수식편집기 같은 것에서 이런 문자를 뱉어내는 건가...?
    ["=", "＝"],
    ["+", "＋"],
    ["*", "＊", "✱", "x"], // x와 *을 같은 문자로 취급하는 건 조금 위험하지만 같은 위치에 이 문자가 각각 사용된다면 곱셈 기호로 사용하려는 의도는 뻔하지 않은가?
    ["/", "／", "÷"], // 마찬가지
    ["\\", "＼", "₩"], // 역시 마찬가지. 고정폭이 아닌 대부분의 한글 폰트에서는 원화 마크로 표시되고 아마 문서에서도 그 의도로 사용됐을 것임!
    ["&", "＆"],
    ["#", "＃"],
    ["@", "＠"],
    ["$", "＄"],
    ["%", "％"],
    ["^", "＾"],
    ["~", "～"],
    ["`", "｀"],
    ["|", "｜"],
];
const PROCESSING_MESSAGES = [
    "한땀한땀 비교 중...",
    "인내심 테스트 중...",
    "생각 중...",
    "재부팅 준비 중...",
    "무한 루프 중...",
    "머리 긁는 중...",
    "DIFFSEEKING...",
    "COME ON, TARS!",
    "3... 2... 1...",
    "99... 98... 97...",
    "퇴근 준비 중...",
];
const DIFF_ALGORITHM = {
    myers: "myers",
    lcs: "lcs",
};
const TOKENIZATION = {
    char: 1,
    word: 2,
    line: 3,
};
//# sourceMappingURL=constants.js.map