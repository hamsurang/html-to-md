---
title: "feat: Add Notion site rule for structure-preserving conversion"
type: feat
status: active
date: 2026-04-02
deepened: 2026-04-02
origin: docs/brainstorms/2026-04-02-notion-site-rule-requirements.md
---

# feat: Add Notion site rule for structure-preserving conversion

## Enhancement Summary

**Deepened on:** 2026-04-02
**Agents used:** Architecture Strategist, Performance Oracle, Pattern Recognition Specialist, Frontend Races Reviewer

### Key Improvements
1. **Interface design 변경** — extractor 반환 타입을 `string|null`로 유지. 제목 정리는 별도 메커니즘으로 분리 (아키텍처 리뷰)
2. **성능 최적화 패턴** — single-pass 순회, `el.style` 직접 접근, 리스트 accumulator 패턴 (성능 리뷰)
3. **Block handler map 패턴** — if/else 체인 대신 핸들러 레지스트리로 확장성 확보 (아키텍처 + 패턴 리뷰)
4. **Race condition 대응** — `window.__htmlToMdRunning` 전역 가드 추가 (프론트엔드 리뷰)
5. **Sequencing invariant 문서화** — extractor → parseAndClean 순서 보장 코멘트 추가

### New Considerations Discovered
- `postProcess()`의 Dingbats 제거를 완전 삭제 대신 범위 축소가 더 안전
- Turndown의 `unwrapWrappers` 규칙이 잔여 `<div>`를 평탄화하므로, extractor 출력에 div가 남으면 안 됨
- `removeEmpty` 규칙이 빈 wrapper 요소를 제거하므로, 토글/콜아웃의 빈 컨테이너 주의

---

## Overview

Notion 페이지를 변환할 때 헤딩, 리스트, 테이블 등 문서 구조가 완전히 손실되는 문제를 해결한다. Notion 전용 site rule을 추가하여, Notion의 div 기반 DOM을 시맨틱 HTML로 재구성한 뒤 Turndown에 전달하는 방식으로 구조를 보존한다.

## Problem Statement / Motivation

현재 Notion 페이지는 Readability fallback으로 처리된다. Notion의 DOM은 모든 블록이 `<div>` 태그로 구성된 비시맨틱 구조이므로, Readability가 문서 구조를 인식하지 못하고 평면 텍스트로 출력한다. (see origin: `docs/brainstorms/2026-04-02-notion-site-rule-requirements.md`)

실제 발생하는 증상:
- 헤딩이 평문으로 변환 (h1/h2/h3 구분 없음)
- 리스트가 인라인 `•` 텍스트로 변환 (마크다운 리스트 아님)
- 제목에 `(9+)` 알림 카운터와 `| Notion` 접미사 포함
- 코드 블록, 테이블, 토글 등 리치 블록 구조 소실

## Proposed Solution

기존 site rule 패턴(GitHub, SO, Medium)과 동일한 구조로 `notion.js` 사이트 룰을 추가한다. 핵심 차이는 다른 site rule이 이미 시맨틱 HTML인 영역을 스코핑하는 것과 달리, Notion extractor는 **DOM-to-semantic-HTML 변환기** 역할을 수행한다는 점이다.

```
Notion DOM (.notion-page-content)
  ↓ [Notion extractor: div soup → semantic HTML]
Semantic HTML string (<h1>, <ul>, <blockquote>, <pre>, <table>, ...)
  ↓ [parseAndClean: 속성 정리]
Clean DOM
  ↓ [Turndown: HTML → Markdown]
Markdown output
```

## Technical Considerations

### 핵심 아키텍처 결정: Semantic HTML 재구성

Notion의 DOM은 `notion-{block_type}-block` 클래스로 블록 타입을 구분한다. 하지만 `dom-cleaner.js`가 모든 `class`, `data-*`, `style` 속성을 제거하므로, extractor가 반드시 **클리닝 전에** 시맨틱 HTML로 변환해야 한다.

> **Sequencing Invariant (반드시 문서화):** Notion extractor는 완전한 시맨틱 HTML을 반환해야 한다. `parseAndClean()`이 모든 class/style/data-* 속성을 제거하므로, extractor 출력 시점에 구조 정보가 HTML 태그 자체에 인코딩되어 있어야 한다. 이 불변 조건을 extractor 함수와 content.js의 parseAndClean 호출부에 코멘트로 명시할 것.

#### Research Insights

**Turndown `unwrapWrappers` 규칙 주의:**
Turndown의 `unwrapWrappers` 규칙(`turndown-converter.js:124`)이 `DIV`, `SPAN`, `SECTION` 등을 내용만 남기고 제거한다. Notion extractor 출력에 잔여 `<div>` 래퍼가 남으면 블록 구분이 소실된다. 모든 블록은 반드시 시맨틱 태그(`<h1>`, `<p>`, `<ul>`, `<blockquote>`, `<pre>`, `<table>`, `<hr>`)로 변환해야 한다.

**`removeEmpty` 규칙 주의:**
Turndown의 `removeEmpty` 규칙이 `textContent.trim() === ''`인 요소를 제거한다. 토글/콜아웃의 빈 컨테이너가 이 규칙에 걸릴 수 있으므로, extractor에서 빈 블록은 출력하지 않는다.

블록 타입 → 시맨틱 HTML 매핑:

| Notion Class | Target HTML | Notes |
|---|---|---|
| `notion-header-block` | `<h1>` | |
| `notion-sub_header-block` | `<h2>` | |
| `notion-sub_sub_header-block` | `<h3>` | |
| `notion-text-block` | `<p>` | |
| `notion-bulleted_list-block` | `<ul><li>` | 연속 아이템을 `<ul>`로 감쌈 |
| `notion-numbered_list-block` | `<ol><li>` | 연속 아이템을 `<ol>`로 감쌈 |
| `notion-to_do-block` | `<ul><li>` | `[ ]` / `[x]` 프리픽스 추가 |
| `notion-code-block` | `<pre><code>` | 언어 라벨 텍스트에서 lang 추출 |
| `notion-callout-block` | `<blockquote>` | 이모지 아이콘 프리픽스 |
| `notion-quote-block` | `<blockquote>` | |
| `notion-divider-block` | `<hr>` | |
| `notion-toggle-block` | `<strong>` + children | 펼친 상태로 변환 |
| `notion-column_list-block` | 순차 콘텐츠 | 좌→우 평탄화 |
| `notion-table-block` | `<table>` | 이미 `<table>` 포함 가능 |
| `notion-collection_view-block` | `<table>` | 테이블 뷰만 지원 |
| `notion-image-block` | `<img>` | |
| `notion-bookmark-block` | `<a>` | URL + 제목 추출 |
| `notion-embed-block` | `<a>` | iframe에서 URL 추출 (dom-cleaner 전) |

### Block Handler Map 패턴

if/else 체인 대신 handler map으로 구현하여 확장성과 테스트 용이성을 확보한다. 기존 `EXTRACTORS` 패턴과 일관성을 유지한다.

```javascript
const BLOCK_HANDLERS = {
  'notion-header-block':         (el) => `<h1>${getInlineHTML(el)}</h1>`,
  'notion-sub_header-block':     (el) => `<h2>${getInlineHTML(el)}</h2>`,
  'notion-sub_sub_header-block': (el) => `<h3>${getInlineHTML(el)}</h3>`,
  'notion-text-block':           (el) => `<p>${getInlineHTML(el)}</p>`,
  'notion-divider-block':        ()   => '<hr>',
  'notion-quote-block':          (el) => `<blockquote>${getInlineHTML(el)}</blockquote>`,
  'notion-image-block':          extractImage,
  'notion-code-block':           extractCode,
  'notion-callout-block':        extractCallout,
  'notion-toggle-block':         extractToggle,
  'notion-bookmark-block':       extractBookmark,
  'notion-embed-block':          extractEmbed,
  // ... 기타 블록
};

function identifyBlockType(classList) {
  for (const cls of classList) {
    if (BLOCK_HANDLERS[cls]) return cls;
  }
  return null;
}
```

### 인라인 포맷팅 처리

#### Research Insights — Performance Critical

**`el.style` 직접 접근 사용 (getComputedStyle 금지):**
Notion은 인라인 `style` 속성으로 포맷팅을 표현한다. `getComputedStyle()`은 호출마다 동기적 레이아웃 계산을 강제하여, 2000-5000개 span이 있는 페이지에서 400-1000ms의 layout thrashing을 발생시킨다. `el.style` 프로퍼티는 O(1)이며 레이아웃 비용이 없다.

```javascript
function wrapInlineFormatting(span) {
  let html = span.innerHTML;
  const s = span.style;
  if (s.fontWeight === '600' || s.fontWeight === '700' || s.fontWeight === 'bold') {
    html = `<strong>${html}</strong>`;
  }
  if (s.fontStyle === 'italic') {
    html = `<em>${html}</em>`;
  }
  if (s.textDecoration && s.textDecoration.includes('line-through')) {
    html = `<s>${html}</s>`;
  }
  return html;
}
```

| Notion Style | Target HTML |
|---|---|
| `font-weight: 600/700/bold` | `<strong>` |
| `font-style: italic` | `<em>` |
| `text-decoration: line-through` | `<s>` |
| 인라인 `<code>` | `<code>` (보존) |
| `<a href>` | `<a>` (보존) |

텍스트 색상, 하이라이트 색상은 마크다운에 대응하는 표현이 없으므로 무시한다.

### 제목 정리: Extractor 반환 타입 유지

#### Research Insights — Architecture

**Extractor 반환 타입을 `string|null`로 유지한다.** `{html, title}` 객체 반환은 기존 계약을 깨뜨린다. `parseAndClean(raw)`이 HTML 문자열을 기대하는데, 객체가 전달되면 `[object Object]`가 파싱되어 **무성 실패**가 발생한다.

대신 제목 정리는 `content.js`에서 사이트별로 처리한다:

```javascript
// content.js — Notion 제목 정리 (extractor 반환 타입 변경 없음)
if (site === 'notion') {
  const cleanTitle = document.title
    .replace(/^\(\d+\+?\)\s*/, '')
    .replace(/\s*\|\s*Notion$/, '')
    .trim();
  // buildMetadata에서 cleanTitle 사용
}
```

이 방식은:
- 기존 extractor 인터페이스(`string|null`) 보존
- `extractSiteContent()` 호출부 변경 불필요
- 제목 정리 로직이 Notion에 국한됨

### postProcess() 유니코드 스트리핑 수정

#### Research Insights

**Dingbats 범위를 완전 제거하지 말고 축소한다.** U+2700-U+27BF 전체를 제거하면 다른 사이트에서도 유의미한 이모지가 사라질 수 있다. Notion 콜아웃 아이콘에 흔히 사용되는 문자(✏️ U+270F, ✅ U+2705, ✂️ U+2702 등)를 보존하면서, 실제 장식용 문자(예: ✦ ✧ 등 특정 별표/기하 문양)만 대상으로 좁힌다.

구체적 수정 방법은 구현 시 post-process.js의 현재 정규식을 확인하여 결정.

### Single-Pass 순회와 리스트 그룹핑

#### Research Insights — Performance

**블록 타입별 querySelectorAll 금지.** 15개 블록 타입에 각각 querySelectorAll을 실행하면 10K+ 노드 트리를 15번 순회한다(15-45ms). 대신 `.notion-page-content`의 자식을 **한 번만 순회**하며 `classList.contains()`(O(1) 해시 룩업)로 타입을 식별한다.

**리스트 그룹핑은 accumulator 패턴으로 구현:**

```javascript
function groupAndConvertBlocks(children) {
  const parts = [];
  let currentList = null;
  let currentListTag = null;

  for (const child of children) {
    const type = identifyBlockType(child.classList);
    const listTag = type === 'notion-bulleted_list-block' ? 'ul'
                  : type === 'notion-numbered_list-block' ? 'ol'
                  : null;

    if (listTag && listTag === currentListTag) {
      currentList.push(convertListItem(child));
    } else {
      if (currentList) {
        parts.push(`<${currentListTag}>${currentList.join('')}</${currentListTag}>`);
        currentList = null;
        currentListTag = null;
      }
      if (listTag) {
        currentList = [convertListItem(child)];
        currentListTag = listTag;
      } else {
        const handler = type ? BLOCK_HANDLERS[type] : null;
        parts.push(handler ? handler(child) : child.textContent);
      }
    }
  }
  if (currentList) {
    parts.push(`<${currentListTag}>${currentList.join('')}</${currentListTag}>`);
  }
  return parts.join('\n');
}
```

이 패턴은 O(n) single-pass로 블록 순회와 리스트 그룹핑을 동시에 처리한다.

### Lazy Loading 대응

Notion은 긴 페이지에서 블록을 lazy load한다. 이는 race condition이 아니라 **콘텐츠 가용성 문제**이다. 블록이 뷰포트에 진입하기 전에는 DOM에 존재하지 않으므로, 타이밍으로 해결할 수 없다.

v1에서는 DOM에 존재하는 블록만 변환한다. 자동 스크롤은 범위 외 (완료 판단 자체가 또 다른 race condition).

### 도메인 감지

```javascript
// matchHost() 확장
if (hostname === 'notion.so' || hostname === 'www.notion.so') return 'notion';
if (hostname.endsWith('.notion.site')) return 'notion';
```

앱(notion.so)과 공개 페이지(*.notion.site) 모두 동일한 React 렌더러를 사용하므로, `.notion-page-content` 셀렉터와 `notion-*-block` 클래스 패턴이 동일하게 적용된다.

### Race Condition 대응

#### Research Insights — Frontend Races

**기존 코드의 `running` 가드가 무효하다.** `content.js`는 매 변환마다 `chrome.scripting.executeScript`로 새로 주입되므로, 각 주입마다 새 클로저 스코프의 `running` 변수가 생성된다. 사용자가 popup과 단축키를 동시에 누르면 두 extraction이 경쟁하여 이중 클립보드 쓰기 + 이중 토스트가 발생한다.

**수정: window-level 전역 가드 사용:**

```javascript
;(() => {
  if (window.__htmlToMdRunning) return;
  window.__htmlToMdRunning = true;

  async function convert() {
    try {
      // ... 기존 로직 ...
    } finally {
      window.__htmlToMdRunning = false;
    }
  }

  convert();
})();
```

이 수정은 Notion에만 국한되지 않는 기존 버그이지만, Notion 페이지가 특히 무겁기 때문에 경쟁 창이 더 넓다. Phase 1에서 같이 수정한다.

## Acceptance Criteria

### Functional Requirements

- [ ] `notion.so`와 `*.notion.site` 도메인에서 Notion site rule이 자동 적용됨
- [ ] 제목에서 `(N+)` 카운터와 `| Notion` 접미사가 제거됨
- [ ] h1/h2/h3 헤딩이 `#` / `##` / `###`로 정확히 변환됨
- [ ] 불릿/넘버/체크 리스트가 마크다운 리스트로 변환됨 (중첩 포함)
- [ ] 코드 블록이 언어 정보와 함께 fenced code block으로 변환됨
- [ ] 콜아웃이 이모지 아이콘 포함 blockquote로 변환됨
- [ ] 토글이 펼친 상태로 변환됨
- [ ] 테이블이 GFM 테이블로 변환됨
- [ ] 컬럼 레이아웃이 좌→우 순서로 평탄화됨
- [ ] 구분선이 `---`로 변환됨
- [ ] 임베드/북마크에서 URL이 링크로 추출됨
- [ ] 이미지 블록이 `![alt](src)`로 변환됨
- [ ] 인라인 포맷팅(볼드, 이탤릭, 취소선, 인라인 코드, 링크)이 보존됨
- [ ] 설정에서 Notion rule on/off 토글 가능

### Quality Gates

- [ ] `pnpm run build && pnpm test` 통과
- [ ] 함수랑산악회 모집 페이지에서 구조가 원본과 일치하는지 수동 검증
- [ ] 기존 site rule(GitHub, SO, Medium) 동작에 영향 없음
- [ ] Notion 페이지 500+ 블록에서 변환 시간 < 500ms

## Implementation Phases

### Phase 1: Infrastructure (site detection + race condition fix)

파일 변경:
- **Create** `src/converter/site-rules/notion.js` — 빈 extractor 스캐폴드 (`extractNotion()` → `null`)
- **Edit** `src/converter/site-rules/index.js` — import, `SITE_MAP`, `matchHost()`, `EXTRACTORS` 추가 + `SITE_LABELS` export 추가 (cohesion 개선)
- **Edit** `src/utils/defaults.js` — `siteRules`에 `notion: true` 추가
- **Edit** `src/content.js` — `SITE_LABELS`를 site-rules/index.js에서 import, Notion 제목 정리 로직 추가, `window.__htmlToMdRunning` 전역 가드로 교체

검증: Notion 페이지에서 확장 프로그램 클릭 시 "Notion mode"로 감지되고, Readability fallback으로 동작 확인

### Phase 2: Basic blocks (text, headings, lists, dividers, quotes)

파일 변경:
- **Edit** `src/converter/site-rules/notion.js` — 핵심 추출 로직 구현

구현 내용:
1. `.notion-page-content` 컨테이너 탐색
2. BLOCK_HANDLERS map 정의
3. `groupAndConvertBlocks()` — single-pass 순회 + accumulator 리스트 그룹핑
4. `getInlineHTML()` — 인라인 포맷팅 변환 (`el.style` 직접 접근, getComputedStyle 금지)
5. 텍스트 → `<p>`, 헤딩 → `<h1>`/`<h2>`/`<h3>`, 인용 → `<blockquote>`, 구분선 → `<hr>`
6. 리스트 → 연속 아이템 그룹핑 + 중첩 재귀
7. 체크리스트 → `[ ]`/`[x]` 프리픽스
8. 미지원 블록은 `textContent` fallback

검증: 텍스트, 헤딩, 리스트, 인용, 구분선이 포함된 Notion 페이지에서 구조 보존 확인

### Phase 3: Rich blocks (code, callouts, toggles, columns, tables)

파일 변경:
- **Edit** `src/converter/site-rules/notion.js` — 리치 블록 핸들러 추가
- **Edit** `src/utils/post-process.js` — Dingbats 범위 축소

구현 내용:
1. 코드 블록 → `<pre><code class="language-{lang}">`, 언어 라벨 텍스트에서 lang 추출
2. 콜아웃 → `<blockquote>` + 이모지 아이콘 프리픽스
3. 토글 → 제목을 `<strong>` (또는 헤딩이면 해당 레벨), 자식 블록 재귀 펼침
4. 컬럼 레이아웃 → `notion-column_list-block` 내 `notion-column-block`을 좌→우 순차 처리
5. 테이블 → `notion-table-block` 내 `<table>` 보존, `notion-collection_view-block`(DB 테이블뷰)에서 헤더/행 추출
6. postProcess() Dingbats 범위 축소 (완전 삭제 아님)

검증: 코드+콜아웃+토글+컬럼+테이블이 포함된 복합 Notion 페이지에서 수동 검증

### Phase 4: Embeds, images, bookmarks + 마무리

파일 변경:
- **Edit** `src/converter/site-rules/notion.js` — 임베드/이미지/북마크 핸들러 추가

구현 내용:
1. 이미지 블록 → `<img>` (src, alt 추출)
2. 북마크 블록 → `<a>` (URL, 제목 추출)
3. 임베드 블록 → iframe/embed에서 URL 추출 후 `<a>`로 변환 (dom-cleaner가 iframe 제거하기 전에)
4. 미지원 블록 타입은 `textContent` fallback으로 처리
5. 함수랑산악회 페이지로 전체 통합 테스트

검증: 다양한 블록 타입이 혼합된 실제 Notion 페이지 3개 이상에서 수동 검증

## Dependencies & Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Notion DOM 구조 변경 시 extractor 깨짐 | High (inherent) | `classList.contains()` 부분 매칭, null 반환 시 Readability fallback |
| Lazy loading으로 긴 페이지 콘텐츠 누락 | Medium | v1은 DOM 스냅샷만 변환, 문서화로 안내 |
| DB 테이블 뷰 DOM이 예상과 다를 수 있음 | Medium | 실제 DOM 조사 후 구현, 실패 시 textContent fallback |
| postProcess() 범위 축소가 다른 사이트에 영향 | Low | 축소 후 GitHub/SO/Medium 변환 결과 비교 검증 |
| Turndown unwrapWrappers가 잔여 div 제거 | Low | Extractor에서 모든 블록을 시맨틱 태그로 변환하여 방지 |

**Dependencies:** 없음. 모든 변경은 프로젝트 내부에서 완결.

## Performance Budget

| Metric | Target | Typical (50 blocks) | Heavy (500 blocks) |
|---|---|---|---|
| 추출 시간 | < 200ms | < 50ms | < 200ms |
| 전체 파이프라인 | < 500ms | < 100ms | < 500ms |
| 메모리 (추출 중) | < 10MB | ~1MB | ~5MB |

핵심 규칙:
- `getComputedStyle()` 사용 금지 — `el.style` 직접 접근만 허용
- 블록 타입별 `querySelectorAll` 금지 — single-pass 순회만 허용
- 재귀 각 레벨에서 `parts[]` 배열 사용 — 문자열 연결 O(n^2) 방지

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-04-02-notion-site-rule-requirements.md](docs/brainstorms/2026-04-02-notion-site-rule-requirements.md) — Key decisions: DOM 기반 추출 (API 아님), 토글 펼침, 컬럼 평탄화, 구조 보존 우선

### Internal References

- Site rule 패턴: `src/converter/site-rules/github.js`
- Site detection: `src/converter/site-rules/index.js`
- DOM cleaner: `src/converter/dom-cleaner.js`
- Turndown rules: `src/converter/turndown-converter.js` (unwrapWrappers :124, removeEmpty :109)
- Post-process: `src/utils/post-process.js` (stripUnicodeDecoration Dingbats 범위)
- Content pipeline: `src/content.js` (running guard :13, pipeline :36-111)
- Settings: `src/utils/defaults.js`

### External References

- Notion DOM class pattern: `notion-selectable notion-{block_type}-block`
- Content container: `.notion-page-content`
- Notion Enhancer CSS selectors: https://notion-enhancer.github.io/advanced/tweaks/
- Notion data model: https://www.notion.com/blog/data-model-behind-notion
- Notion CSS gist (s1kee): Block class reference
- Notiondipity blog: `.notion-page-content` selector validation
