# Paste 아키텍처 계획

## 문제

익스텐션이 이미지를 async로 fetch하는 동안 에디터가 열려 있으면:
- 사용자가 타이핑하면 (붙여넣기 내용)(입력 내용) 순서 역전 발생
- 이미지 로드 후 에디터 높이 변동 → sync mode 앵커 패딩 틀어짐
- diff 워크플로우가 이미지 로드 전에 먼저 실행됨

## 해결 방향: 조건부 모달

paste 내용에 따라 경로를 분기한다.

### 경로 A — 기존 sync 경로 (모달 없음)

조건: 텍스트만 포함 + 짧은 내용

- 기존 동작 그대로
- `execCommand("insertHTML")` 또는 직접 삽입

### 경로 B — 모달 + async 경로

조건: **이미지 URL 포함 AND `engine.extensionEnabled === true`**

흐름:
```
Ctrl+V
  → 클립보드 HTML 파싱
  → 조건 확인
  → 모달 표시 ("붙여넣는 중...")  ← 에디터 입력 차단
  → 이미지 fetch (async, 익스텐션 RPC) — 익스텐션 없으면 skip
  → sanitizeHTML (sync)
  → 에디터 삽입
  → 모달 닫기
  → sync mode 재계산 트리거
```

## 구현 위치

- 분기 로직: `core/src/editor/editor.ts` paste 핸들러
- 모달 UI: `app/src/` (React)
- 이미지 fetch 요청: `engine.extensionEnabled`가 true일 때만 시도
- 이미지 URL 패턴 감지: `core/src/sanitize/` 또는 editor 레벨

## 미결 사항

- 사내 인증 이미지 URL 패턴을 어떻게 감지할 것인가
  (file:// 은 명확하지만 사내 URL은 도메인 패턴이 환경마다 다름)
- 모달 중 사용자가 ESC 누르면? → 이미지 없이 그냥 삽입하는 fallback
- 익스텐션 없는 환경에서 이미지 포함 붙여넣기 → 경로 A 그대로, 엑박 감수
