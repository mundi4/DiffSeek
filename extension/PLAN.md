# DiffSeekExt 개선 계획

## 현황 파악 (분석 완료)

### 파일 구성
- `manifest.json` — MV3, permissions: tabs only
- `background.js` — Service Worker. createRPC 인라인 정의 + fetchImageData + legacyBizContent 핸들러
- `rpc.js` — content script용 createRPC (background.js와 동일 코드 중복)
- `rpc-window.js` — window.postMessage 기반 createWindowRPC (별도 구현)
- `content.js` — manual.kbstar.com 로직 + diffseek 로직이 한 파일에 혼재
- `diffseek_inject.js` — DiffSeek 페이지에 inject되어 window.DiffSeek API 호출
- `manual_inject.js` — kbstar 전용, 사실상 빈 껍데기
- `popup.html / popup.js` — 껍데기 (nothing here)

### 이 익스텐션이 하는 일 (핵심 목적)
1. **file:// 이미지 fetch** — Word 붙여넣기 시 `file://` 임시 이미지를 SW가 fetch → base64로 변환 → DiffSeek에 전달 (http:// 환경에서 file:// 이미지 표시 문제 해결)
2. **legacyBizContent** — kbstar 같은 레거시 사이트에서 Ctrl+1/2로 HTML을 DiffSeek에 전송

---

## 문제 목록

### 버그 (동작 안 함)
- [ ] **#3 [CRITICAL] content scripts `type: "module"` 인데 전역 함수 참조**
  - `rpc.js`의 `createRPC`, `rpc-window.js`의 `createWindowRPC`가 ES 모듈 스코프라서 `content.js`에서 접근 불가
  - 현재 content script 전체가 동작하지 않음
- [ ] **#4 [CRITICAL] `host_permissions` 누락**
  - `fetchImageData`가 `file://` URL을 fetch하는데 manifest에 권한 없음
  - fetch 조용히 실패
- [ ] **#5 포트 하드코딩 오류**
  - manifest matches, background.js legacyBizContent 핸들러 모두 `localhost:5173` 등 구버전 포트
  - 현재 dev 포트: `8200`

### 구조 문제
- [ ] **#1 `createRPC` 코드 중복**
  - `background.js`와 `rpc.js`에 동일 코드
- [ ] **#2 RPC 구현이 두 종류 (port vs window.postMessage)**
  - 인터페이스가 미묘하게 달라 혼란
- [ ] **#6 transfer 로직 무의미**
  - `fetchImageData` 결과는 base64 string → transferable 아님 → transfer 코드 dead code
- [ ] **#7 `content.js`에 두 가지 완전히 다른 역할 혼재**
  - kbstar 전용 로직 + diffseek 전용 로직을 if로 분기
- [ ] **#10 Service Worker 단절 시 재연결 없음**
  - MV3 SW는 idle 시 종료됨. port 끊어지면 재연결 로직 없음

### 지저분한 것
- [ ] **#8 주석 처리된 dead code 다수** (background.js: decodeDataURL, 구버전 fetchImageData)
- [ ] **#9 `window.DiffSeek` API 연결 확인 필요**
  - `diffseek_inject.js`가 `window.DiffSeek.setExtensionEnabled()`, `setContent()` 호출
  - 현재 DiffSeek 앱에 이 API가 노출되어 있는지 확인 필요
- [ ] **#11 popup 껍데기** (기능 없음)

---

## 개선 계획

### Phase 1 — 모듈 구조 정리 (기반 작업)

**목표:** ES 모듈로 통일, 중복 제거, content script 분리

1. `rpc.js` → `export function createRPC(...)` 추가
2. `rpc-window.js` → `export function createWindowRPC(...)` 추가
3. `background.js` → `import { createRPC } from './rpc.js'` + 인라인 createRPC 제거
4. `content.js` → `import { createRPC } from './rpc.js'` + `import { createWindowRPC } from './rpc-window.js'`
5. `manifest.json` background에 `"type": "module"` 추가
6. `content.js`를 역할별로 분리:
   - `content-diffseek.js` — diffseek 전용
   - `content-legacy.js` — kbstar 전용
   - manifest matches도 각각 별도 entry로 분리

### Phase 2 — 버그 수정

1. `manifest.json`에 `host_permissions: ["file:///*"]` 추가
2. 포트 하드코딩 정리 → `localhost:8200` 반영 (또는 `*://localhost/*`로 와일드카드)
3. transfer dead code 제거 (base64 string은 그냥 postMessage)
4. SW 재연결 로직 추가 (port disconnect → reconnect)

### Phase 3 — 기능 검증 및 정리

1. `window.DiffSeek` API 현황 확인
   - DiffSeek 앱에서 `window.DiffSeek` 노출 여부
   - `setExtensionEnabled()`, `setContent()` 구현 여부
   - 없으면 앱 쪽에 추가하거나 inject 방식 재설계
2. dead code 제거 (주석 블록들)
3. `manual_inject.js` — 기능 추가하거나 제거
4. `popup.html` — 익스텐션 상태 표시 등 최소한의 UI

---

## 파일 구조 목표 (Phase 완료 후)

```
extension/
├── manifest.json
├── background.js          # SW, module, import from rpc.js
├── rpc.js                 # export createRPC (port-based)
├── rpc-window.js          # export createWindowRPC (postMessage-based)
├── content-diffseek.js    # diffseek 페이지 전용
├── content-legacy.js      # kbstar 등 레거시 전용
├── diffseek_inject.js     # DiffSeek 페이지 world에서 실행
├── manual_inject.js       # kbstar 페이지 world에서 실행
└── popup.html / popup.js
```
