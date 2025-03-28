// DIFF 색(HUE). 0(빨)은 DIFF 배경색으로 쓰이니 패스
// 완전한 색상 코드보다 HUE만 사용하면 용도에 따라 색을 조절하기 쉬움.
// 인접한 색상과 너무 가깝지 않도록 아주 CAREFULLY하게 고른 순서
const DIFF_COLOR_HUES = [30, 180, 300, 120, 240, 60, 270]; //[60, 240, 120, 300, 180];//[60, 120, 180, 240, 300];
const NUM_DIFF_COLORS = DIFF_COLOR_HUES.length;

const LINE_TAG = "DIV";
const ANCHOR_TAG = "HR";
const DIFF_ELEMENT_NAME = "MARK";
const EDITOR_PADDING = 9;
const LINE_HEIGHT = 20;
const TOPBAR_HEIGHT = 32;
const SCROLL_MARGIN = 15;
const COMPUTE_DEBOUNCE_TIME = 200;

const PROCESSING_MESSAGES = [
	"한땀한땀 비교 중...",
	"인내심 테스트 중...",
	"생각 중...",
	"재부팅 준비 중...",
	"무한 루프 중...",
	"머리 긁는 중...",
	"흰머리 뽑는 중...",
    "DIFFSEEKING...",
	"COME ON, TARS!",
    "3... 2... 1...",
	"99... 98... 97...",
];

