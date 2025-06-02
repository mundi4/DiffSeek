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
] as const;
const NUM_DIFF_COLORS = DIFF_COLOR_HUES.length;

const LINE_TAG = "DIV";
const ANCHOR_TAG = "HR";
const DIFF_ELEMENT_NAME = "MARK";
const EDITOR_PADDING = 8;
const LINE_HEIGHT = 1.5;
const TOPBAR_HEIGHT = 0;
const SCROLL_MARGIN = LINE_HEIGHT * 4;

const COMPUTE_DEBOUNCE_TIME = 200; // ms
const FORCE_RENDER_TIMEOUT = 100; // ms

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
] as const;

const HANGUL_ORDER = "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허";

const VOID_ELEMENTS: Record<string, boolean> = {
	AREA: true,
	BASE: true,
	BR: true,
	COL: true,
	COMMAND: true,
	EMBED: true,
	HR: true,
	IMG: true,
	INPUT: true,
	LINK: true,
	META: true,
	PARAM: true,
	SOURCE: true,
	TRACK: true,
	WBR: true,
} as const;

const TEXTLESS_ELEMENTS: Record<string, boolean> = {
	...VOID_ELEMENTS,
	VIDEO: true,
	AUDIO: true,
	OBJECT: true,
	CANVAS: true,
	SVG: true,
	TABLE: true,
	THEAD: true,
	TBODY: true,
	TFOOT: true,
	TR: true,
	OL: true,
	UL: true,
	DL: true,
	STYLE: true,
	HEAD: true,
	TITLE: true,
	SCRIPT: true,
	"#document-fragment": true,
};

const LINE_ELEMENTS: Record<string, boolean> = {
	P: true,
	H1: true,
	H2: true,
	H3: true,
	H4: true,
	H5: true,
	H6: true,
};

// 많은 요소들이 있지만 다 무시하고 root와 td/th만 생각함.
// 다른 요소들은 어차피 레이아웃과 무관
const TEXT_FLOW_CONTAINERS: Record<string, boolean> = {
	DIV: true,
	PRE: true,
	BLOCKQUOTE: true,
	LI: true,
	TD: true,
	TH: true,
	SECTION: true,
	ARTICLE: true,
	HEADER: true,
	FOOTER: true,
	ASIDE: true,
	MAIN: true,
	CAPTION: true,
	FIGURE: true,
	FIGCAPTION: true,
};