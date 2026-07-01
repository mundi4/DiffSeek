# AlignAnchor 면밀 조사 (Deep Investigation)

> 조사 대상: sync mode(F2) 정렬을 담당하는 **anchor** 파이프라인.
> 조사 일자: 2026-07-01 · 대상 브랜치: `claude/alignanchor-investigation-0e5jj4`
> 기준 커밋: `d551207` (Merge #120)

이 문서는 DiffSeek의 "anchor" 정렬 메커니즘을 코드 레벨에서 끝까지 추적한 결과다.
파일:라인 참조는 모두 위 기준 커밋 기준.

---

## 0. 핵심 요약 (TL;DR)

- **"anchor"라는 이름은 두 개의 완전히 다른 개념에 재사용된다.**
  1. `DiffAnchor` — diff 알고리즘 레벨. 매칭된 **토큰 범위**. (`core/src/diff/types.ts:87`)
  2. `AnchorPair` — 렌더/정렬 레벨. 두 에디터의 **DOM 요소 쌍**과 픽셀 delta. (`core/src/engine/types.ts:48`)
  둘은 이름만 공유할 뿐 자료구조·목적·수명주기가 다르다. "alignanchor"가 가리키는 것은 **후자(`AnchorPair` + `align-anchors.ts`)** 이다.
- 정렬은 `<DS-ANCHOR>` 요소의 `::before` pseudo-element 높이(`--ds-adjust`)를 조절해 **한 쪽 에디터에 세로 패딩을 주입**하는 방식이다. Canvas가 아니라 실제 레이아웃을 건드린다.
- 알고리즘은 **위→아래 단일 패스**로, 각 pair의 raw `getBoundingClientRect().y` 차이를 delta로 삼는다. 반복(fixpoint) 없음 — 위쪽 조정이 아래쪽 측정에 이미 반영되므로 한 패스로 대체로 수렴한다.
- 과거 회귀의 대부분은 **gBCR 보정(correction) 로직**에서 나왔고, 현재는 보정을 전부 제거하고 raw 값을 쓰는 것이 정답으로 확정됐다 (`d266a41`). 여기에 손대면 안 된다.
- 발견된 이슈: (A) 문서 stale 참조, (B) `AnchorPair`의 4개 write-only 필드, (C) `delta==0` 재조정 시 0px `ds-padded` 잔존, (D) `processSegmentsWithAnchors`의 gap suffix-trim 비대칭, (E) Y 단조성 가정의 다단 레이아웃 취약성. 상세는 §6.

---

## 1. 두 개의 "anchor" 개념

### 1.1 `DiffAnchor` — 토큰 범위 (diff 워커 내부)

```ts
// core/src/diff/types.ts:87
export type DiffAnchor = { lhsStart; lhsEnd; rhsStart; rhsEnd; };  // 토큰 인덱스
```

- 생성: `buildPatienceAnchors()` (`core/src/diff/patience-diff.ts:10`)
- 소비: `processSegmentsWithAnchors(ctx, lhs, rhs, anchors)` (`core/src/diff/process-segments-with-anchors.ts:20`)
- 역할: patience 경로에서 "확실히 일치하는 토큰 구간"을 앵커로 고정하고, 앵커 **사이의 gap만** `runHistogramDiff`로 재diff. 앵커 구간 자체는 `markUnchanged`로 UNCHANGED 처리.
- 호출 위치: 워커 `core/src/diff-worker/worker.ts:157-159`.

즉 이건 **diff 정확도/성능용 내부 최적화**이며 sync mode와 무관하다.

### 1.2 `AnchorPair` — DOM 요소 쌍 (엔진/렌더)

```ts
// core/src/engine/types.ts:48
export type AnchorPair = {
  index: number;
  leftEl: HTMLElement;         // <DS-ANCHOR> 또는 borrow된 블록
  rightEl: HTMLElement;
  diffIndex: number | null;
  leftContainerIndex: number;
  rightContainerIndex: number;
  delta: number;               // 현재 적용된 패딩(px), 부호 = 방향
};
```

- 생성: `processDiffElements()` → `addAnchorPair()` (`core/src/engine/process-diff-elements.ts:314`)
- 저장: `DiffContext.anchorPairs` (`core/src/engine/types.ts:28`)
- 소비: `alignAnchors()` (`core/src/engine/align-anchors.ts:10`)

이하 문서에서 "anchor"는 이 `AnchorPair`를 의미한다.

---

## 2. 정렬용 anchor의 생성 (`process-diff-elements.ts`)

diff 결과 버퍼를 순회(`:577`)하며 청크 단위로 UNCHANGED/DIFF를 구분(`extendOrFlush`/`flushChunk`)하고, 두 경로에서 anchor를 만든다.

- **UNCHANGED 라인** → `handleCommon()` (`:352`)
  - 양쪽 첫 토큰이 **둘 다 `LINE_START`** 일 때만 (`:355`) 앵커 쌍 생성.
  - `getAnchorElForLine()` (`:286`)로 각 줄 시작 위치에 `<DS-ANCHOR>` 확보 → `addAnchorPair(…, diffIndex=null, …)`.
- **DIFF 라인** → `handleDiff()` (`:364`)
  - 양쪽 다 내용 있음: 양쪽 `LINE_START`면 앵커 쌍 생성(`:488`).
  - 한 쪽 empty/structural-only: 빈 쪽에 `<DS-DIFF>` 마커를 만들고(`getDiffMarkerEl`), 채워진 쪽 줄 시작에 앵커를 확보해 **빈 쪽은 `<DS-DIFF>`를 borrow**해서 쌍을 만든다(`:414-433`).

### 2.1 `addAnchorPair`의 delta seeding (연속성)

```
// process-diff-elements.ts:314
leftAdjust  = prevMarkerElements?.get(leftEl)?.adjust  ?? 0
rightAdjust = prevMarkerElements?.get(rightEl)?.adjust ?? 0
```

이전 run에서 재사용된 요소의 패딩값을 그대로 `delta` 초기값으로 물려받아, 다음 `alignAnchors`가 "이미 맞춰진 상태"에서 시작하도록 한다. → diff run마다 정렬이 깜빡이는 것을 방지.
- 양쪽 모두 adjust가 있으면(서로 다른 pair 출신) delta=0으로 리셋하고 양쪽 패딩 제거(`:326-332`).

### 2.2 마커 요소 수명주기

- `<DS-ANCHOR>`(`ANCHOR_TAG_NAME`), `<DS-DIFF>`(`DIFF_TAG_NAME`)는 run 간 **재사용**된다. `markerElements`(현재 run) / `prevMarkerElements`(직전 run) 두 맵으로 관리.
- `beginMarkerUpdate`/`endMarkerUpdate`(`diffseek-engine.ts:687,695`)가 스왑·정리. `cleanupUnusedMarkers`(`:186`)가 미재사용 마커 제거 및 borrow된 블록의 class/style/dataset 정리.
- borrow: `afterbegin`일 때 컨테이너 자체(예: `<td>`)를 앵커로 빌려 DOM 삽입 없이 사용(`:61`).

이 수명주기는 회귀 다발 지점이며 전용 테스트로 잠겨 있다 (`marker-and-anchor-dom.test.ts`, #111 회귀).

---

## 3. 정렬 실행 (`align-anchors.ts`)

`alignAnchors({anchorPairs, leftEditor, rightEditor, markerElements, signal, scrollRestore})`.

### 3.1 측정과 delta

각 pair에 대해 (`:73`):

```
leftY  = leftEl.gBCR().y  + leftScrollTop  - leftEditorTop
rightY = rightEl.gBCR().y + rightScrollTop - rightEditorTop
delta  = round(leftY - rightY)      // :98  raw, 보정 없음
```

- `delta > 0` → 왼쪽이 더 아래 → **오른쪽에** `|delta|` 패딩.
- `delta < 0` → **왼쪽에** 패딩.
- `applyDeltaToPair`(`:183`)가 반대쪽 패딩 제거 후 `--ds-adjust`/`ds-padded`(+`ds-striped`) 부여, `markerElements[el].adjust` 갱신.

**중요 불변식**: `::before` 패딩은 요소 top(gBCR.y)에 영향을 주지 않으므로 별도 보정이 필요 없다. 과거 보정 로직이 이 사실을 오해해 delta 부호를 뒤집는 버그를 냈다(§5).

### 3.2 방어 가드 (모두 최근 추가, `e0e8e38`)

1. **가시성 가드**(`:63`): `!isConnected || offsetParent===null`이면 skip. display:none 조상 하에서 gBCR이 0을 반환해 발산 패딩을 만드는 것을 차단.
2. **단조성 가드**(`:79`): `leftY < prevLeftY || rightY < prevRightY`면 skip. anchor가 문서 순서상 아래인데 화면 Y가 역전되면, 적용 시 다음 pair가 이전 pair로 역피드백되어 발산 → 방지.
3. **임계값**(`:100`): `|delta - pair.delta| <= MIN_DELTA(1)`이면 재조정 안 함(steady-state no-op).

### 3.3 스크롤 앵커링 보정

- 패딩을 뷰포트 위 요소에 주입하면 브라우저가 `scrollTop`을 자동 조정한다. 그래서 적용 직후 `scrollTop`을 다시 읽는다(`:104-105`).
- `adjustedAboveViewportBottom`이면 프레임 yield 시점에 저장된 스크롤로 복원(`:141`, `:156`).
- yield 전후 `scrollTop` 비교로 **사용자 스크롤을 감지하면 복원 포기**(`:129-139`).

### 3.4 높이 보정 (마지막 단계, `:163`)

두 에디터의 `contentElement.offsetHeight`를 비교해 짧은 쪽 `heightBoostElement.style.height`로 하단을 채워 스크롤 범위를 맞춘다.

### 3.5 배치/yield

`BATCH_SIZE=16`, 10ms(`IDLE_THRESHOLD`) 넘으면 `nextAnimationFrame`으로 양보. `AbortSignal`로 취소 가능.

---

## 4. 트리거 & 오케스트레이션 (`diffseek-engine.ts`)

`alignAnchors`(엔진 private, `:842`)는 abort controller로 감싸 3곳에서 호출:

1. **F2 토글 ON** — `set syncMode`(`:397`) → rAF 안에서 `alignAnchors(preSaved)` (`:422`). 사전에 스크롤 저장(`:407`), 읽기 전용 전환.
2. **diff workflow 종료 후** — `startDiffWorkflow`(`:815-817`) `syncMode`면 재정렬.
3. **에디터 리사이즈** — `handleEditorResize`(`:368-369`) 폭 변화 시.

취소: `cancelOngoingOperations`(`:677`)에서 abort. sync scroll은 별도(`syncScroll`, `:338`)로 rAF 디바운스.

전체 파이프라인:

```
tokenize → diff worker(buildPatienceAnchors→processSegmentsWithAnchors)
        → processDiffElements() → DiffContext.anchorPairs
        → (syncMode?) alignAnchors() → <DS-ANCHOR>.style --ds-adjust → CSS ::before 패딩
```

---

## 5. 회귀 이력 (왜 지금 코드가 이렇게 생겼나)

| 커밋 | 문제 | 해결 | 테스트 |
|---|---|---|---|
| `489f244` (#100) | ::before 보정 **부호 반전** → 재실행마다 누적 드리프트 | 부호 뒤집음(임시) | — (후속에 의해 대체) |
| `d266a41` | 위 보정 자체가 근본적으로 틀림(gBCR.y는 ::before 무관). 부호 뒤집힘 + borrow 블록에서 비대칭 | **보정 전면 제거**, raw `leftY-rightY` 사용 | `align-anchors.test.ts:255,291` (회귀 잠금) |
| `e0e8e38` | 무효 측정/비단조 Y → 화면을 채우는 발산 패딩 | 가시성·단조성 가드 추가 | `align-anchors.test.ts:362-487` |
| `6669270` (#111) | 2회차 run에서 `<DS-ANCHOR>`가 `<DS-DIFF>` 앞에 옴 | `beforebegin` 역방향 walk | `marker-and-anchor-dom.test.ts:514` |
| `4fb0e8f` | 비인접 empty-side diff가 하나로 병합 | 인접성 체크 추가 | `process-diff-elements.test.ts:951` |
| `7403134` | structural-only일 때 left/right range 스왑 | `leftCount===0 || leftStructuralOnly` | `process-diff-elements.test.ts:203` |
| `2f2a63c`/`00280a9` | sync mode 스크롤 드리프트 / 사용자 스크롤 중 복원 | 스크롤 save/restore 정리 | — |

**교훈(반복 금지):** `align-anchors.ts`의 delta는 **절대 gBCR 보정하지 말 것**. 보정처럼 보이는 코드를 다시 넣으면 §5의 `d266a41` 회귀 테스트가 잡는다.

---

## 6. 발견 사항 (Findings)

정확도 순. 대부분 저위험이지만 정리해 둔다.

### (A) 문서 stale 참조 — `CLAUDE.md` [문서]
`CLAUDE.md`의 Key Source Files 표와 "Architecture Patterns"는 정렬 로직을
`core/src/engine/anchor-manager.ts`("Identifies matching line pairs")로 기술하지만
**그 파일은 존재하지 않는다.** 실제 구현은 `align-anchors.ts`(정렬) + `process-diff-elements.ts`(앵커 생성)로 분리돼 있다.
→ 신규 기여자가 잘못된 파일을 찾게 만든다. 표 갱신 권장.

### (B) `AnchorPair`의 write-only 필드 4개 — `types.ts:48` [죽은 데이터]
`index`, `diffIndex`, `leftContainerIndex`, `rightContainerIndex`는 `addAnchorPair`에서 **채워지지만 소스 어디에서도 읽히지 않는다**(grep 확인: `core/src/**` 내 읽는 곳 0). `alignAnchors`가 쓰는 것은 `leftEl`, `rightEl`, `delta`뿐.
- `diffIndex`는 요소의 `dataset.diffIndex`로는 쓰이지만(`activateAnchorEl`) pair 필드로는 안 읽힘.
- `containerIndex`는 앵커를 컨테이너(td) 경계별로 그루핑하려던 **미완/유보 기능의 흔적**으로 보인다.
→ 향후 계획이 없다면 제거해 자료구조를 단순화하거나, 계획이 있으면 주석으로 의도를 남길 것.

### (C) `delta==0`일 때 0px `ds-padded` 잔존 — `align-anchors.ts:100,183` [사소]
`pair.delta`가 예: 2였다가 이번에 0이 되면 `deltadelta=-2`로 `applyDeltaToPair(pair, 0, …)` 호출.
`delta>0`가 false → else 분기에서 `theEl=leftEl`에 `--ds-adjust:0px` + `ds-padded` 부여(높이 0). `ds-striped`는 `0>=1` 실패로 안 붙음.
→ 시각적 영향 없음(0px). 다만 `ds-padded` class가 불필요하게 남는다. `delta===0`이면 양쪽 패딩만 제거하도록 조기 처리하면 깔끔.

### (D) gap suffix-trim 비대칭 — `process-segments-with-anchors.ts:103-148` [정합성]
`whitespace:ignore`에서 **마지막 tail gap**은 `matchSuffixTokens`로 교차경계 접미 매칭을 하지만(`:129-147`), **앵커 사이 중간 gap**의 동일 로직은 **주석 처리**돼 있다(`:103-114`). 중간 gap은 `diff()`(→`runHistogramDiff` + n\*m fallback)에 위임한다.
→ 기능상으로는 fallback이 커버하므로 결과는 맞을 가능성이 높지만, "tail만 특별대우"라는 비대칭은 의도인지 확인 필요. 의도라면 주석으로 근거를 남기고, 아니라면 죽은 주석 블록 제거.

### (E) Y 단조성 가정 — `align-anchors.ts:48-51,79` [설계 가정]
가드는 "diff 단조성 → anchor의 화면 Y도 단조 증가"를 전제한다. 하지만 앵커는 문서 순서로 push되고, **다단/표 레이아웃**(좌우로 배치된 셀)에서는 문서 순서와 화면 Y 순서가 어긋날 수 있다. 이 경우 정상적인 pair도 비단조로 판정돼 **skip**된다(정렬 누락) — 발산보다는 안전한 실패지만, 표가 많은 한국 법령 문서에서 일부 줄이 정렬 안 될 수 있다.
→ 현재는 "안전하게 포기"라 버그는 아니지만, 표 중심 문서에서 정렬 품질 저하 가능성으로 기록.

### (F) `alignAnchors`는 단일 패스 — [설계 확인, 이슈 아님]
fixpoint 반복이 아니다. 위→아래로 가며 상단 조정이 하단 측정에 반영되므로 한 패스로 수렴한다. 리사이즈/스크롤/diff 이벤트로만 재실행. 의도된 설계로 확인됨.

---

## 7. 테스트 커버리지 평가

| 파일 | 대상 | 상태 |
|---|---|---|
| `align-anchors.test.ts` (489L) | delta 계산, borrow 블록 혼합, 방향 전환, 4개 방어 가드 | 견고. `.skip`/`.only`/TODO 없음. jsdom gBCR을 mock. |
| `marker-and-anchor-dom.test.ts` (593L) | `getOrCreateAnchor`/`getOrCreateEmptyDiffMarker`/`cleanupUnusedMarkers`, #111 회귀 | 견고. DOM 수명주기 커버. |
| `process-diff-elements.test.ts` (1399L) | structural-only 스왑, 비인접 병합 방지, empty-side, 분기 커버 | 견고. |

**커버 안 되는 영역(권장 보강):**
1. **다중 pair의 순차 상호작용** — 위 pair 패딩이 아래 pair 측정에 미치는 영향을 실제 레이아웃으로 검증하는 테스트가 없다(가드 테스트는 mock Y라 상호작용 없음). jsdom 한계상 e2e/브라우저 필요.
2. **스크롤 앵커링/복원 경로**(`:104-159`) — mock 에디터에서 `scrollTop` 변화 시나리오 미검증.
3. **height boost**(`:163-174`) — 결과 높이 산출 미검증.
4. **엔진 트리거 3경로**(F2/diff후/resize)와 abort 취소의 결합 — 통합 테스트 부재.

---

## 8. 권장 조치 (우선순위)

1. **[문서]** `CLAUDE.md`의 `anchor-manager.ts` 참조를 `align-anchors.ts` + `process-diff-elements.ts`로 정정. (즉시, 무위험) — §6-A
2. **[정리]** `AnchorPair`의 미사용 4필드 제거 또는 의도 주석. — §6-B
3. **[미세]** `delta===0` 조기 처리로 0px `ds-padded` 잔존 제거. — §6-C
4. **[확인]** `process-segments-with-anchors.ts`의 주석 처리된 중간 gap suffix-trim이 의도인지 원작자 확인 후 주석/삭제. — §6-D
5. **[테스트]** 다중 pair 순차 상호작용 및 스크롤 복원 경로에 대한 통합/브라우저 테스트 추가. — §7

> ⚠️ **하지 말 것:** `align-anchors.ts`의 raw delta에 gBCR 보정 재도입(§5 회귀), 가시성/단조성 가드 제거(§3.2), 마커 재사용 로직 단순화(§2.2 #111 회귀). 모두 전용 회귀 테스트가 지키고 있으며 과거에 실제로 깨졌다.
