# DiffSeek Architecture: Core/UI Separation

이 문서는 DiffSeek의 core와 UI 레이어 분리 구조를 설명합니다.

## 개요

DiffSeek는 다음과 같이 세 개의 명확한 레이어로 구성됩니다:

```
┌─────────────────────────────────────┐
│  App Layer (React Integration)     │  ← React components, Jotai state
│  src/components, src/hooks          │
├─────────────────────────────────────┤
│  UI Integration (Framework Bridge)  │  ← DiffControllerProvider
│  src/hooks/DiffControllerProvider   │
├─────────────────────────────────────┤
│  Core Layer (Framework Independent) │  ← Pure DOM/Canvas
│  src/core/                          │     No React dependency
└─────────────────────────────────────┘
```

## Core Layer (src/core/)

### 특징
- **React에 의존하지 않음**: 순수 DOM API와 Canvas만 사용
- **프레임워크 독립적**: React, Vue, Angular 등 어떤 프레임워크와도 통합 가능
- **독립적으로 사용 가능**: DiffSeekApp 클래스로 standalone 사용 가능

### 주요 구성요소

#### DiffSeekApp (진입점)
Core를 standalone으로 사용하기 위한 high-level API 제공

#### Editor
contenteditable 기반 에디터, 내용 변경시 자동 토큰화

#### Renderer
Canvas 기반 diff 하이라이트 렌더링

#### DiffController
Editor와 Renderer 조율, Web Worker를 통한 diff 계산

## UI Layer (src/components/, src/hooks/)

### 특징
- React 컴포넌트
- Jotai를 통한 상태 관리
- Core 인스턴스를 mount/unmount하여 사용

### 주요 구성요소

#### DiffControllerProvider
Core 인스턴스 생성 및 라이프사이클 관리

#### EditorShell / RendererShell
Core의 Editor와 Renderer를 React 컴포넌트로 래핑

## 장점

1. **관심사의 분리**: Core는 비즈니스 로직, UI는 인터페이스
2. **테스트 용이성**: Core를 독립적으로 테스트 가능
3. **재사용성**: 다른 프레임워크에서 Core 재사용 가능
4. **성능**: Core는 Web Worker 사용, React 리렌더링과 독립적

자세한 내용은 src/core/README.md를 참조하세요.
