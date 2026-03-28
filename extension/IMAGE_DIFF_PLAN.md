# 이미지 비교 구현 계획

## 배경

Word 붙여넣기 시 `file://` 임시 이미지 경로가 포함됨.
익스텐션(background.js `fetchImageData`)이 이 이미지를 fetch → base64로 변환 → DiffSeek에 전달.

원래 의도는 pixelmatch로 픽셀 대 픽셀 비교였으나 결과가 불만족스러움:

- 이미지 리사이즈, 압축률 차이만으로도 픽셀 diff가 과도하게 발생
- 문서 diff 맥락에는 부적합

## 채택 방향: Perceptual Hash (pHash / dHash)

### 이유

- 리사이즈·압축률 차이에 강함 (같은 그림을 다르게 저장 → 동일 판정)
- 브라우저 `<canvas>` API만으로 구현 가능 (외부 라이브러리 불필요)
- 빠름, core에서 직접 처리 가능

### 알고리즘 (dHash 기준)

1. 이미지를 `<canvas>`에 렌더링
2. 9×8 (또는 8×8)로 다운샘플
3. 인접 픽셀 밝기 차이로 64비트 해시 생성
4. 두 해시의 해밍 거리로 유사도 판정
   - 거리 0: 동일
   - 거리 ≤ 10 (임계값 조정 필요): 유사
   - 거리 > 10: 다름

### 판정 결과 활용

- 동일 → diff 없음 (기존 img 태그 처리와 동일)
- 변경됨 → 이미지 블록을 diff 항목으로 마킹 (텍스트 diff와 동일한 하이라이트)

## 구현 위치

- 해시 계산: `core/src/sanitize/` 또는 `core/src/utils/` 신규 파일 `image-hash.ts`
- 엔진 연동: `engine.extensionEnabled`가 true일 때만 이미지 해시 비교 활성화
- 익스텐션 연동: `content-diffseek.js`의 `fetchImageData` RPC 결과(base64)를 받아 해시 계산

## 전제 조건

- `engine.extensionEnabled` 상태 구현 완료 ✅
- `background.js`의 `fetchImageData` (base64 변환) 구현 완료 ✅
- Phase 2: `host_permissions: ["file:///*"]` 추가 필요 (현재 fetch 실패 중) → Phase 2에서 처리

## 미해결 과제

- 엄청 큰 문서에 엄청 많은 그림이 있을 때 문서 비교가 3만년 걸리게 하고 싶진 않은데...

- **이미지 로딩 타이밍 문제**: 익스텐션의 이미지 fetch는 paste 이후 async로 처리됨
  (paste 순서 보장을 위해 sync로 처리할 수 없음 — Ctrl+V 후 즉시 타이핑하면 순서 역전 발생)
  → 이미지가 base64로 교체되기 전에 diff 워크플로우가 먼저 실행될 수 있음
  → **현재는 이미지 비교 기능이 없으므로 diff 결과는 영향 없음** (img src는 diff 대상이 아님)
  → 단, 이미지 로드 후 에디터 높이가 변하므로 **레이아웃 재계산은 필요**
  → 특히 sync mode에서는 앵커 패딩 계산이 틀어짐 — 이미지 `load` 이벤트 후 re-layout 트리거 필요
  → 이미지 해시 비교 구현 시 타이밍 문제도 함께 재검토 필요
