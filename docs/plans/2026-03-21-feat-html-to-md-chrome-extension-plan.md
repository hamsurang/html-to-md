---
title: "feat: HTML-to-MD Chrome Extension"
type: feat
status: active
date: 2026-03-21
origin: docs/brainstorms/2026-03-21-html-to-md-chrome-extension-brainstorm.md
---

# feat: HTML-to-MD Chrome Extension

## Enhancement Summary

**Deepened on:** 2026-03-21
**Sections enhanced:** 6
**Research agents used:** Turndown Token Optimization, Chrome Extension UX, esbuild Config, Performance Oracle, Security Sentinel

### Key Improvements
1. **4단계 파이프라인**: Readability → DOM pre-clean (속성 제거) → Turndown (custom rules) → 후처리 (공백 정규화)
2. **성능 최적화**: site-specific rules에서 `outerHTML` 직접 사용 (cloneNode 우회), Readability subtree cloning, storage 캐싱
3. **보안 강화**: Readability→Turndown 사이 HTML sanitization (on* 속성 제거), form 요소 제거, `<base>` 태그 무시
4. **빌드 개선**: esbuild iife format, libs/ 제거 (node_modules 직접 번들), dist/ 출력 구조
5. **토큰 절약 벤치마크**: Raw HTML ~16K → Turndown default ~5K → **Turndown optimized ~3K tokens** (80% 절감)

### New Considerations Discovered
- `document.cloneNode(true)`의 메모리 스파이크 (대형 페이지에서 50-100MB)
- Turndown이 내부적으로 `innerHTML`을 사용하여 `on*` event handler가 실행될 수 있는 보안 리스크
- `chrome.storage.sync` 읽기 지연 (30-80ms)이 변환 파이프라인에 영향
- GFM plugin에서 `tables`만 실제로 필요 (strikethrough, taskListItems는 선택적)

## Overview

웹페이지의 HTML DOM을 읽어서 정제된 Markdown으로 변환하는 Chrome Extension.
AI agent에게 웹페이지 컨텍스트를 제공할 때 토큰을 절약하는 것이 주된 목표.
아이콘 원클릭으로 현재 페이지의 메인 콘텐츠를 추출하여 클립보드에 복사한다.

## Problem Statement / Motivation

AI agent에게 웹페이지 내용을 전달할 때 raw HTML을 그대로 붙여넣으면:
- nav, footer, sidebar, ads 등 노이즈가 토큰의 대부분을 차지
- HTML 태그 자체가 불필요한 토큰을 소비
- agent가 구조를 파악하기 어려움

Clean Markdown으로 변환하면:
- 토큰 소비 20~30% 감소 (aggressive stripping 시 최대 92% 감소)
- semantic heading 구조로 agent가 내용을 쉽게 파악
- RAG retrieval 정확도 최대 35% 향상

## Proposed Solution

**Readability + Turndown 2단계 파이프라인** (see brainstorm: docs/brainstorms/2026-03-21-html-to-md-chrome-extension-brainstorm.md)

1. **Content Extraction**: @mozilla/readability 0.6.0으로 메인 콘텐츠 자동 감지 및 노이즈 제거
2. **MD Conversion**: Turndown 7.2.0 + GFM plugin으로 HTML → Markdown 변환
3. **Site-specific Rules**: GitHub, Stack Overflow, Medium/Substack에 대한 맞춤 추출 규칙 (Readability를 완전히 우회)
4. **URL Resolution**: 모든 상대 URL을 절대 URL로 변환 (agent가 링크를 따라갈 수 있도록)

> **Brainstorm 결정 조정**: 원래 "직접 MD 변환기 구현"으로 결정했으나, 리서치 결과 Turndown.js가 브라우저 네이티브, 경량, custom rules 확장 가능하여 변경. 토큰 절약의 핵심은 Readability의 노이즈 제거이지 MD 변환기 자체가 아님.

### Site-Specific Rules Architecture

사이트별 규칙은 **Readability를 완전히 우회**한다 (Option A):

```
hostname 감지 → 매칭되는 사이트 규칙이 있으면?
  ├─ YES → 사이트 전용 CSS selector로 직접 추출 → Turndown 변환
  │         └─ selector가 빈 결과 반환 시 → Readability fallback
  └─ NO  → Readability로 콘텐츠 감지 → Turndown 변환
            └─ Readability가 null 반환 시 → document.body fallback + 토스트 경고
```

이유: Readability는 "아티클" 감지에 최적화되어 있어, GitHub Issue 스레드나 SO 다중 답변 같은 비아티클 구조에서는 잘못된 영역을 선택할 수 있음.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────┐
│ User clicks extension icon / keyboard shortcut  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ Service Worker (background.js)                  │
│  - chrome.action.onClicked listener             │
│  - chrome.scripting.executeScript() 동적 주입     │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ Content Script (content.js)                     │
│  1. document.cloneNode(true) — DOM 복제          │
│  2. Site detection — hostname 기반 분기           │
│  3. DOM pre-clean (속성/form 요소 제거)           │
│  4. Site-specific selector OR Readability 추출   │
│  5. Turndown 변환 (custom rules 적용)            │
│  6. 메타데이터 (제목 + URL) 상단 삽입              │
│  7. 후처리 (공백 정규화)                           │
│  8. navigator.clipboard.writeText()             │
│  9. 결과 메시지 → popup / service worker          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Popup (popup.html + popup.js) — 변환 + 설정      │
│  - 열리면 자동으로 현재 탭에 변환 트리거             │
│  - 변환 결과 상태 표시 (성공/실패/토큰 수)          │
│  - 하단: 설정 (커스텀 selector, 토글 등)           │
└─────────────────────────────────────────────────┘
```

### File Structure

```
html-to-md/
├── src/
│   ├── background.js          # Service worker
│   ├── content.js             # DOM 추출 + 변환 진입점
│   ├── converter/
│   │   ├── readability-extractor.js  # Readability 래퍼
│   │   ├── turndown-converter.js     # Turndown 설정 + custom rules
│   │   ├── dom-cleaner.js            # DOM pre-clean (속성 제거, sanitization)
│   │   └── site-rules/
│   │       ├── index.js              # 사이트 감지 + 라우팅
│   │       ├── github.js             # GitHub 전용 추출
│   │       ├── stackoverflow.js      # SO 전용 추출
│   │       └── medium-substack.js    # Medium/Substack 전용 추출
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── utils/
│       ├── clipboard.js       # Clipboard API + fallback
│       ├── metadata.js        # 제목/URL 추출
│       └── post-process.js    # 공백 정규화, Unicode 정리
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── dist/                      # esbuild 출력 (gitignore)
├── package.json
└── esbuild.config.js          # 빌드 설정
```

> **Research Insight (Build):** `libs/` 디렉토리 불필요 — esbuild가 `node_modules`에서 `@mozilla/readability`, `turndown`, `turndown-plugin-gfm`을 직접 번들링하여 `dist/`에 출력. 모든 entry point는 `iife` format (content script 필수). 예상 번들: content.js ~120-180KB, background.js ~3KB, popup.js ~5KB. 총 500KB 미만.

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "HTML to MD",
  "version": "1.0.0",
  "description": "Convert web pages to clean Markdown for AI agents",
  "permissions": ["activeTab", "clipboardWrite", "scripting", "storage"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "commands": {
    "convert-page": {
      "suggested_key": {
        "default": "Ctrl+Shift+M",
        "mac": "Command+Shift+M"
      },
      "description": "Convert current page to Markdown"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

> **Research Insight (UX Architecture):**
> - `default_popup`이 설정되면 `action.onClicked` 이벤트 발생 안 함 → **popup이 열리면서 자동 변환 트리거**
> - 키보드 단축키는 popup을 열지 않으므로 `chrome.commands.onCommand` 리스너 별도 필요 → service worker에서 `convertPage(tab)` 직접 호출
> - `Ctrl+Shift+M`은 Windows/Linux에서 DevTools 기기 모드와 충돌 가능 — 사용자가 `chrome://extensions/shortcuts`에서 변경 가능
> - 토스트: **closed Shadow DOM** + `z-index: 2147483647` + `all: initial` 리셋 필수
> - 토스트 duration 차등: 성공 2초, 경고 3초, 에러 4-5초
> - 첫 변환 시 "Tip: 설정은 아이콘 클릭 후 하단에서" 안내 토스트 (onboarding 페이지 불필요)

### Implementation Phases

#### Phase 1: Core Pipeline (MVP)

기본 변환 파이프라인 구축. Popup 열림 → 자동 변환 → 클립보드 복사.

**Tasks:**
- [ ] 프로젝트 초기화 (package.json, esbuild 설정, manifest.json)
- [ ] Popup: 열리면 `chrome.scripting.executeScript()`로 현재 탭에 content script 동적 주입
- [ ] Service worker: `chrome.commands.onCommand` 리스너로 키보드 단축키 처리 (popup 우회)
- [ ] Readability extractor: DOM clone → Readability parse → cleaned HTML
- [ ] Turndown converter: cleaned HTML → Markdown (기본 규칙)
- [ ] Turndown custom rules: 토큰 최적화 (공백 정리, 빈 줄 축소, 속성 제거)
- [ ] Turndown custom rules: `<details>/<summary>` → bold heading + 내용 펼침
- [ ] URL resolver: 모든 상대 URL (href, src)을 절대 URL로 변환
- [ ] 메타데이터 삽입: `# {title}\n\nSource: {url}\n\n` 상단 추가
- [ ] Clipboard 쓰기 + HTTP/file:// fallback (`execCommand('copy')`)
- [ ] 토스트 알림: Shadow DOM으로 격리, 하단 우측 고정, 2초 후 자동 해제
- [ ] 로딩 표시: 변환 중 extension badge에 "..." 표시
- [ ] 에러 처리: Readability null → document.body fallback + 경고 토스트
- [ ] 에러 처리: 제한 페이지(chrome://, about:) → "이 페이지에서는 사용할 수 없습니다" 토스트
- [ ] 에러 처리: 빈 결과 → "변환할 내용이 없습니다" 토스트
- [ ] 중복 실행 방지: 변환 중 추가 클릭 무시 (debounce)
- [ ] 키보드 단축키 (`Ctrl+Shift+M` / `Cmd+Shift+M`)

**Success Criteria:**
- 일반 블로그/뉴스 사이트에서 clean MD 출력
- nav, footer, sidebar, ads 제거됨
- heading 계층, 링크, 이미지, 코드 블록, 테이블 정확히 변환
- 원클릭 복사 완료까지 < 1초

### Research Insights: Core Pipeline

**4단계 변환 파이프라인 (최적화된):**

```
1. Content Extraction  → Readability.parse() 또는 site-specific selector
2. DOM Pre-Clean       → 속성 제거 (class, style, data-*, aria-*, on*) + form 요소 제거 + <base> 태그 제거
3. Turndown Conversion → custom rules 적용 (토큰 최적화 규칙)
4. Post-Processing     → 공백 정규화 (3+ 줄바꿈 → 2), trailing whitespace 제거, Unicode 정리
```

**Turndown 최적 설정:**
- `headingStyle: 'atx'`, `bulletListMarker: '-'`, `codeBlockStyle: 'fenced'`, `hr: '---'`
- GFM plugin: `tables`만 사용 (strikethrough, taskListItems 불필요)
- `remove()`: script, style, noscript, iframe, nav, footer, aside, svg, canvas, form, input, select, textarea, button, video, audio

**핵심 Custom Rules:**
- **이미지**: `![alt](url)` 대신 `[Image: alt]`로 변환 (설정으로 토글 가능, 토큰 15-25개 절약/이미지)
- **링크**: URL 제거하고 anchor text만 유지 (설정으로 토글 가능, 30개 링크 기준 400-800 토큰 절약)
- **h5/h6**: `**bold**`로 평탄화 (LLM에게 과도한 heading depth 불필요)
- **BR 체인**: 연속 `<br>` → 단일 줄바꿈으로 축소
- **빈 요소**: textContent가 빈 요소 자동 제거

**보안 필수사항 (P1 — 릴리스 전 구현):**
- Readability 출력과 Turndown 입력 사이에 **HTML sanitization** 필수
  - 모든 `on*` 속성 제거 (onerror, onload 등이 Turndown의 innerHTML 파싱 시 실행 가능)
  - `javascript:` URI 제거
  - `<script>`, `<iframe>`, `<object>`, `<embed>` 제거
- `document.cloneNode(true)` 후 **form 요소 제거** (autofill된 패스워드, CSRF 토큰 노출 방지)
  - `<input>`, `<select>`, `<textarea>`, `[type="hidden"]` 모두 제거
- `<base>` 태그 제거 후 URL resolution (악성 페이지의 open redirect 방지)

**성능 최적화:**
- **URL resolution은 DOM 속성 사용**: `el.href`/`el.src`가 자동으로 절대 URL 반환 (regex보다 빠름)
- **Readability subtree cloning**: `<article>`, `<main>`, `[role="main"]` 감지 시 해당 subtree만 clone (전체 document clone 대비 30-70% 절약)
- **Readability 파라미터 튜닝**: `nbTopCandidates: 3`, `charThreshold: 1000` (10-30% 파싱 속도 향상)
- **DOM 크기 가드**: `querySelectorAll('*').length > 50000`이면 경고 토스트

**토큰 절약 벤치마크:**

| 최적화 단계 | 예상 토큰 절약 |
|---|---|
| Readability 추출 (nav/footer/sidebar 제거) | 30-50% |
| Turndown HTML→MD 변환 | 20-30% |
| URL 제거 (링크) | 5-10% |
| 이미지 URL 제거 | 2-5% |
| 공백 정규화 | 5-15% |
| **총 절약 (raw HTML 대비)** | **~80%** |

#### Phase 2: Site-Specific Rules

주요 사이트별 맞춤 추출 규칙 추가. (see brainstorm: Key Decision #10)

**Tasks:**
- [ ] Site detection: `window.location.hostname` 기반 라우터
- [ ] GitHub 규칙:
  - README/파일: `article.markdown-body`
  - Issue/PR description: `.js-comment-body .markdown-body` (첫 번째 comment)
  - Issue/PR comments: `.timeline-comment .comment-body` (전체 스레드, 작성자 포함)
    - 출력 형식: `### @{author}\n\n{body}\n\n---` 로 각 코멘트 구분
  - Code blob (`/blob/` URL): `.blob-wrapper .highlight` → 코드 블록으로 변환
  - Release notes: `.markdown-body` within release container
- [ ] Stack Overflow 규칙:
  - 질문 제목: `#question-header h1 a`
  - 질문 본문: `#question .s-prose`
  - 답변: `#answers .answer` 각각 개별 추출
    - 출력 형식: `## Answer (Score: {vote}) {accepted ? "✓ Accepted" : ""}` + 본문
    - 답변 간 `---` 구분선
  - 코드 블록: `pre code` 언어 감지
- [ ] Medium/Substack 규칙:
  - Medium: `article` 또는 `[data-testid="storyTitle"]` + `pw-post-body`
  - Substack: `.available-content` 또는 `.body.markup`
- [ ] Fallback: 사이트 규칙의 selector가 빈 결과 반환 시 Readability로 자동 전환

**Success Criteria:**
- GitHub README가 원본 Markdown과 거의 동일하게 변환
- SO 질문+답변이 구조화된 MD로 출력 (질문/답변 구분, vote 표시)
- Medium/Substack 아티클이 깔끔하게 변환

### Research Insights: Site-Specific Performance

**핵심 최적화: site-specific rules에서 `cloneNode` 우회**

Site-specific 경로에서는 `document.cloneNode(true)` 대신 `element.outerHTML`을 Turndown에 직접 전달:
- Turndown은 HTML string을 직접 받을 수 있음 (`turndownService.turndown(htmlString)`)
- 전체 DOM clone 대비 **50-200ms 절약** (대형 GitHub Issue, SO 페이지)
- 메모리 스파이크 방지 (100+ 코멘트 GitHub Issue에서 50-100MB → 5-10MB)

**다중 요소 추출 (SO 답변, GH 코멘트): 점진적 처리**
- 각 요소를 개별 변환 후 Markdown string 연결
- 각 clone이 변환 직후 GC 가능 → 피크 메모리 감소

**사이트별 DOM 안정성 참고:**
- GitHub `.markdown-body`: 가장 안정적인 selector (수년간 유지)
- SO `#question`, `#answers`: ID 기반으로 안정적
- Medium: class가 자주 변경됨 → `article`, `data-testid` 속성이 더 안정적
- Substack: 비교적 전통적 HTML 구조로 안정적

#### Phase 3: Settings & Customization

사용자 설정 UI + 커스텀 필터링. (see brainstorm: Key Decision #4)

**Tasks:**
- [ ] Popup UI: 설정 페이지 구현
  - 커스텀 CSS selector 추가/제거 (**도메인별 스코핑** — 글로벌 규칙도 지원)
  - CSS selector 유효성 검증 (입력 시 `document.querySelector` 테스트)
  - 사이트별 규칙 on/off 토글
  - 메타데이터 포함 여부 토글
  - 이미지 포함 여부 토글
- [ ] `chrome.storage.sync`로 설정 저장 (디바이스 간 동기화, quota 초과 시 `local` fallback)
- [ ] 설정 적용: content script에서 저장된 설정 로드 후 변환에 반영
- [ ] 링크 URL 포함 여부 토글 (기본: 제거하여 토큰 절약)

### Research Insights: Settings & Security

**CSS selector 보안 강화:**
- 최대 50개 selector, 각 최대 200자 제한
- `[value`, `[checked`, `:has()` 패턴 거부 (데이터 탈취/DoS 방지)
- `querySelectorAll()` 호출을 try/catch + 100ms 타임아웃으로 보호
- 도메인 스코핑 저장 구조: `{ domain: "example.com", selector: ".ads" }`

**Storage 성능 최적화:**
- `chrome.storage.sync.get()`은 30-80ms 지연 → 변환마다 읽지 않기
- Service worker에서 설정을 읽고 `executeScript()` args로 content script에 전달
- 또는 content script에서 한 번 읽고 캐싱 + `chrome.storage.onChanged` 리스너로 갱신

**Privacy policy 필수 (Chrome Web Store):**
- 데이터 수집 없음, 네트워크 전송 없음 명시
- 클립보드 쓰기는 로컬 전용
- `storage.sync`는 설정만 포함 (사용자 콘텐츠 아님)

**Success Criteria:**
- 사용자가 추가한 CSS selector로 특정 요소 제거 가능
- 설정이 디바이스 간 동기화됨
- 설정 변경 후 즉시 다음 변환에 반영

## Alternative Approaches Considered

(see brainstorm: docs/brainstorms/2026-03-21-html-to-md-chrome-extension-brainstorm.md)

1. **DOM 직접 순회**: 완전한 제어 가능하지만 노이즈 필터링을 처음부터 구현해야 함. Readability의 검증된 로직 활용이 더 효율적
2. **직접 MD 변환기 구현**: 완전한 제어력이지만 Turndown이 이미 브라우저 네이티브 + 커스텀 룰 확장 가능. 개발 비용 대비 이점 불명확
3. **Turndown 단독 (Readability 없이)**: raw HTML에 Turndown만 적용하면 노이즈가 그대로 남음. Readability의 콘텐츠 감지가 핵심

## System-Wide Impact

### Interaction Graph

**경로 A — 아이콘 클릭:**
1. User clicks icon → popup opens → popup.js 실행
2. popup.js → `chrome.scripting.executeScript()` → content script 주입
3. Content script: DOM pre-clean → site detection → extraction → Turndown → clipboard write
4. Content script → `chrome.runtime.sendMessage()` → popup.js (결과 표시)

**경로 B — 키보드 단축키 (`Cmd+Shift+M`):**
1. User presses shortcut → `chrome.commands.onCommand` (service worker)
2. Service worker → `chrome.scripting.executeScript()` → content script 주입
3. Content script: (경로 A와 동일 파이프라인)
4. Content script → 토스트 알림 (popup 없으므로 페이지 내 표시)

### Error & Failure Propagation

| Error | Layer | Handling |
|---|---|---|
| Readability returns null | Content script | `document.body` fallback + "메인 콘텐츠 감지 실패, 전체 페이지 캡처" 경고 토스트 |
| Clipboard API 실패 (HTTP/file://) | Content script | `execCommand('copy')` fallback |
| Site-specific selector 빈 결과 | Content script | Readability fallback으로 자동 전환 (사용자 인지 불필요) |
| Content script 주입 실패 | Service worker | `executeScript` reject catch → "이 페이지에서는 사용할 수 없습니다" 토스트 |
| 변환 결과가 비어있음 | Content script | "변환할 내용이 없습니다" 토스트, 클립보드에 쓰지 않음 |
| 변환 중 예외 발생 | Content script | try/catch로 감싸고 에러 메시지 토스트 |
| 중복 클릭 (변환 중 재클릭) | Service worker | 변환 진행 중 플래그로 추가 실행 무시 |
| 페이지 로딩 중 클릭 | Content script | `document.readyState` 체크, 로딩 중이면 `DOMContentLoaded` 대기 |

### State Lifecycle Risks

- **설정 데이터**: `chrome.storage.sync`에 저장. 확장 프로그램 제거 시 자동 삭제됨. 별도 export/import 기능 필요 없음 (V1)
- **DOM clone**: 변환 완료 후 GC에 의해 자동 해제. 메모리 누수 위험 없음 (일회성 작업)
- **Service worker idle**: MV3 service worker는 30초 후 sleep. 상태를 유지할 필요 없음 (stateless 설계)

### API Surface Parity

- 아이콘 클릭과 키보드 단축키가 동일한 변환 로직 실행
- Popup은 설정 전용 — 변환 트리거와 독립

### Integration Test Scenarios

1. **GitHub Issue 페이지**: description + 전체 comment 스레드가 작성자별로 구분되어 변환되는지
2. **GitHub Code blob**: `/blob/` URL에서 코드가 fenced code block으로 변환되는지
3. **SO 질문 페이지**: 질문/답변이 구분되고, vote score와 accepted answer가 표시되는지
4. **Medium 유료 아티클**: paywall 이전 콘텐츠만 추출되는지
5. **상대 URL 포함 페이지**: 모든 링크/이미지가 절대 URL로 변환되는지
6. **Readability 실패 페이지** (대시보드, 웹앱): document.body fallback + 경고 토스트
7. **HTTP localhost 페이지**: clipboard fallback (`execCommand`)이 작동하는지
8. **chrome:// 페이지**: "사용할 수 없습니다" 에러 메시지가 표시되는지
9. **`<details>` 포함 GitHub README**: 접힌 콘텐츠가 펼쳐져서 변환되는지

## Acceptance Criteria

### Functional Requirements

- [ ] 아이콘 클릭 시 현재 페이지의 메인 콘텐츠가 MD로 변환되어 클립보드에 복사됨
- [ ] `Ctrl+Shift+M` (Mac: `Cmd+Shift+M`) 단축키로 동일 기능 동작
- [ ] 변환된 MD 상단에 `# {title}` + `Source: {url}` 메타데이터 포함
- [ ] nav, header, footer, sidebar, ads, cookie banner 자동 제거
- [ ] heading(h1-h6), 링크, 이미지, 리스트, 테이블, 코드 블록(언어 감지), bold, italic, blockquote 정확히 변환
- [ ] GitHub README/Issue/PR에서 `.markdown-body` 기반 추출
- [ ] Stack Overflow에서 질문/답변 구조화 추출
- [ ] Medium/Substack에서 아티클 본문 추출
- [ ] 사이트별 규칙 실패 시 Readability fallback
- [ ] 사용자가 CSS selector로 커스텀 요소 제거 가능
- [ ] 설정이 `chrome.storage.sync`로 디바이스 간 동기화

### Non-Functional Requirements

- [ ] 변환 완료까지 < 1초 (일반적인 블로그 페이지 기준)
- [ ] Extension 번들 크기 < 500KB
- [ ] HTTPS 및 HTTP 페이지 모두 지원 (clipboard fallback)
- [ ] chrome://, edge://, about: 등 제한 페이지에서 명확한 에러 메시지
- [ ] Manifest V3 준수, Chrome Web Store 정책 준수

### Quality Gates

- [ ] 주요 5개 사이트 (블로그, GitHub, SO, Medium, Substack)에서 수동 테스트 통과
- [ ] 각 HTML element → MD 변환 규칙에 대한 단위 테스트
- [ ] Readability null 반환, clipboard 실패 등 에러 경로 테스트

## Success Metrics

- **토큰 절약률**: raw HTML 대비 변환된 MD의 토큰 수 비교 (목표: 50%+ 절약)
- **변환 정확도**: 주요 사이트에서 heading 계층, 코드 블록, 테이블이 정확히 보존되는지
- **사용성**: 원클릭으로 변환 완료, 추가 조작 불필요

## Dependencies & Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| @mozilla/readability | 0.6.0 | 메인 콘텐츠 추출 |
| turndown | 7.2.0 | HTML → Markdown 변환 |
| turndown-plugin-gfm | 1.0.2 (pinned) | tables만 사용 (strikethrough, taskListItems 선택적) |
| esbuild | (latest) | 빌드/번들링 |

- Chrome 116+ (MV3 완전 지원)
- Node.js 18+ (빌드 환경)

## Risk Analysis & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| 사이트 DOM 구조 변경 | 사이트별 규칙 실패 | High | Readability fallback 자동 전환 |
| Readability가 콘텐츠 감지 실패 | 빈 결과 또는 잘못된 추출 | Medium | `nbTopCandidates: 3`, `charThreshold: 1000` 튜닝 + document.body fallback |
| SPA 동적 로딩 | 콘텐츠 미포함 | Medium | document_idle 시점 주입 + 사용자 재시도 안내 |
| **Turndown HTML 파싱 시 on* 핸들러 실행** | **XSS** | **Medium** | **DOM pre-clean에서 on* 속성, javascript: URI 제거 (P1)** |
| **대형 페이지 메모리 스파이크** | **탭 크래시/지연** | **Medium** | **subtree cloning, DOM 크기 가드 (50K nodes), site rules에서 outerHTML 사용** |
| **form 데이터 클립보드 노출** | **민감 정보 유출** | **Medium** | **cloneNode 후 input/select/textarea/hidden 요소 제거 (P1)** |
| 의존성 supply chain 공격 | 악성 코드 주입 | Low | 버전 고정, `npm audit`, 주기적 검토 |
| HTTP 페이지 clipboard 실패 | 복사 안됨 | Low | `execCommand('copy')` fallback |
| Chrome Web Store 심사 거부 | 배포 지연 | Low | 최소 권한, 원격 코드 없음, privacy policy 포함 |

## Resource Requirements

- **개발**: 1인 개발자 기준
- **Phase 1 (MVP)**: 핵심 파이프라인
- **Phase 2 (Site Rules)**: 사이트별 규칙
- **Phase 3 (Settings)**: 설정 UI

## Future Considerations

- 선택 영역만 변환 (텍스트 선택 후 우클릭 컨텍스트 메뉴)
- 변환 결과 미리보기 팝업 (토글 가능)
- 추가 사이트별 규칙 (Reddit, HN, 문서 사이트 등)
- 토큰 카운트 표시 (tiktoken 등 활용)
- Firefox/Edge 크로스 브라우저 지원
- 변환 히스토리 저장

## Documentation Plan

- README.md: 설치 방법, 사용법, 설정 가이드
- CONTRIBUTING.md: 사이트별 규칙 추가 방법
- Chrome Web Store 설명 및 스크린샷

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-21-html-to-md-chrome-extension-brainstorm.md](docs/brainstorms/2026-03-21-html-to-md-chrome-extension-brainstorm.md) — Key decisions carried forward: Readability 기반 콘텐츠 감지, 아이콘 즉시 복사, V1 사이트별 규칙 (GitHub/SO/Medium/Substack)

### External References

- [@mozilla/readability GitHub](https://github.com/mozilla/readability)
- [Turndown GitHub](https://github.com/mixmark-io/turndown)
- [Chrome MV3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Extension Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [LLMFeeder (reference implementation)](https://github.com/jatinkrmalik/LLMFeeder)

### Deepen Research References

- [Cloudflare: Markdown for Agents (2026)](https://blog.cloudflare.com/markdown-for-agents/) — 80% 토큰 절감 벤치마크 (16,180 → 3,150 tokens)
- [The Hidden Cost of Readability (arXiv:2508.13666)](https://arxiv.org/html/2508.13666v1) — newlines = 14.6-17.5% of tokens
- [esbuild API Reference](https://esbuild.github.io/api/) — 빌드 설정 상세
- [Chrome Offscreen Documents](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3) — clipboard fallback 패턴
- [chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) — 동적 주입 상세

### Related Work

- [Markdownload extension](https://github.com/deathau/markdownload) — Readability 기반 MD 변환, 참고용
- [mdream](https://github.com/harlan-zw/mdream) — LLM 최적화 HTML-to-MD 변환기
