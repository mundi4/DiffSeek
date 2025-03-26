// 인접한 색과 60이상 차이나게
const DIFF_COLOR_HUES = [30, 180, 300, 120, 240, 60, 270]; //[60, 240, 120, 300, 180];//[60, 120, 180, 240, 300];
const NUM_DIFF_COLORS = DIFF_COLOR_HUES.length;

const LINE_TAG = "DIV";
const ANCHOR_TAG = "HR";
const DIFF_ELEMENT_NAME = "MARK";
const LINE_HEIGHT = 20;
const TOPBAR_HEIGHT = 20;
const COMPUTE_DEBOUNCE_TIME = 200;

const PROCESSING_MESSAGES = [
	"한땀한땀 비교 중...",
	"인내심 테스트 중...",
	"생각 중...",
	"COME ON, TARS!",
	"재부팅 준비 중...",
	"무한 루프 중...",
	"머리 긁는 중...",
	"흰머리 뽑는 중...",
    "DIFFSEEKING...",
    "시스템 침투 중...",
    "ANALYZING...",
    "3... 2... 1...",
    "SYSTEM MALFUNCTION...",
];

