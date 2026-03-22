# Brainstorm: HTML-to-MD Chrome Extension

**Date:** 2026-03-21
**Status:** Draft

## What We're Building

웹페이지의 HTML DOM을 읽어서 정제된 Markdown 텍스트로 변환하는 Chrome Extension.
AI agent에게 웹페이지 컨텍스트를 제공할 때 토큰을 절약하는 것이 주된 목표.

### Core Features

- **자동 콘텐츠 감지**: Readability 알고리즘 기반으로 메인 콘텐츠 영역을 자동 식별
- **노이즈 자동 제거**: nav, header, footer, sidebar, ads, cookie banner 등 비본문 요소 자동 제거
- **사용자 커스텀 필터**: CSS selector 기반으로 제거할 요소를 사용자가 추가 설정 가능
- **Semantic MD 변환**: heading 계층, 리스트, 테이블, 코드 블록 등을 Markdown 문법으로 정확히 변환
- **클립보드 복사**: 버튼 클릭 한 번으로 변환된 MD를 클립보드에 복사

### Conversion Rules

| HTML Element | MD Output |
|---|---|
| h1-h6 | # ~ ###### (heading 계층 유지) |
| p | 일반 텍스트 + 빈 줄 |
| a | [text](url) |
| img | ![alt](src) |
| ul/ol > li | - item / 1. item |
| table | MD 테이블 (\| col \| col \|) |
| pre/code | ``` + 언어 자동 감지 |
| strong/b | **bold** |
| em/i | *italic* |
| blockquote | > quote |

### Expected Output Example

**Input** (블로그 포스트 페이지):
```html
<html>
<head><title>Understanding Async/Await</title></head>
<body>
  <nav>...</nav>
  <article>
    <h1>Understanding Async/Await</h1>
    <p>JavaScript의 <strong>async/await</strong>는 비동기 코드를 동기적으로 작성할 수 있게 합니다.</p>
    <h2>Basic Usage</h2>
    <pre><code class="language-javascript">async function fetchData() {
  const res = await fetch('/api');
  return res.json();
}</code></pre>
    <p>자세한 내용은 <a href="https://mdn.io/async">MDN 문서</a>를 참고하세요.</p>
  </article>
  <footer>...</footer>
</body>
</html>
```

**Output** (변환된 MD):
```markdown
# Understanding Async/Await

Source: https://example.com/blog/async-await

JavaScript의 **async/await**는 비동기 코드를 동기적으로 작성할 수 있게 합니다.

## Basic Usage

\```javascript
async function fetchData() {
  const res = await fetch('/api');
  return res.json();
}
\```

자세한 내용은 [MDN 문서](https://mdn.io/async)를 참고하세요.
```

**핵심 포인트**: nav, footer 제거 / heading 계층 보존 / 코드 블록 언어 감지 / 메타데이터(제목+URL) 상단 삽입

## Why This Approach

**Readability 알고리즘 기반 + 직접 MD 변환기** 방식을 선택.

- **Readability 알고리즘**: Mozilla가 Firefox Reader View에서 검증한 콘텐츠 감지 로직. 대부분의 웹사이트에서 메인 콘텐츠를 안정적으로 추출
- **직접 MD 변환기**: Turndown.js 같은 범용 라이브러리 대신 토큰 절약에 최적화된 변환 로직을 직접 구현. 불필요한 공백, 빈 줄, 장식 요소를 적극적으로 제거

### 검토했지만 선택하지 않은 방식

- **DOM 직접 순회**: 완전한 제어가 가능하지만 노이즈 필터링을 처음부터 구현해야 함. Readability의 검증된 로직을 활용하는 것이 더 효율적
- **Turndown.js 래핑**: 빠른 구현이 가능하지만 토큰 절약 최적화에 제한적이고 번들 크기가 증가

## Key Decisions

1. **사용 시나리오**: AI agent 컨텍스트 제공 전용 (토큰 절약이 최우선)
2. **출력 방식**: 클립보드 복사 (원클릭)
3. **변환 범위**: 페이지 전체 (메인 콘텐츠 자동 감지)
4. **노이즈 필터링**: 자동 제거 + 사용자 CSS selector 커스텀
5. **이미지/링크**: 모두 MD 형식으로 보존
6. **테이블**: MD 테이블 문법으로 변환
7. **코드 블록**: 언어 자동 감지 + MD 코드 블록 변환
8. **접근 방식**: Readability 알고리즘 기반 콘텐츠 감지 + 직접 MD 변환기
9. **Extension UI**: 아이콘 클릭 시 즉시 변환 + 클립보드 복사, 토스트로 성공 알림
10. **사이트별 규칙 (V1 대상)**: GitHub (README, Issues, PR), Stack Overflow (질문/답변), Medium/Substack (블로그 본문)
11. **메타데이터**: MD 상단에 페이지 제목 + 출처 URL만 포함 (agent가 출처를 알 수 있도록)

## Resolved Questions

1. **Extension UI**: 즉시 복사 선택. 이유: 팝업 미리보기는 agent 컨텍스트 제공 워크플로우에 불필요한 마찰
2. **사이트별 규칙**: V1부터 포함. 이유: GitHub, SO 등은 구조가 특수하여 범용 Readability만으로는 노이즈 제거 불충분
3. **메타데이터**: 제목 + URL만. 이유: 날짜/저자는 토큰 대비 agent에게 주는 가치가 낮음
