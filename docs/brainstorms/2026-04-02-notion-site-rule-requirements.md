---
date: 2026-04-02
topic: notion-site-rule
---

# Notion Site Rule

## Problem Frame

Notion 페이지를 변환하면 구조가 완전히 손실된다. 현재 Notion 전용 site rule이 없어 Readability fallback으로 처리되는데, Notion의 깊은 div 중첩 DOM을 Readability가 파싱하지 못해 모든 콘텐츠가 평면 텍스트로 출력된다.

실제 발생하는 문제:
- 헤딩 계층이 사라짐 (h1/h2/h3 → 평문)
- 리스트가 인라인 `•` 텍스트로 변환됨 (마크다운 `- item` 아님)
- 제목에 `(9+)` 알림 카운터와 `| Notion` 접미사가 포함됨
- 섹션 구분선(`---`)이 반영되지 않음
- 대괄호가 불필요하게 이스케이프됨 (`\[text\]`)

## Requirements

- R1. `notion.so`와 `*.notion.site` 도메인을 감지하여 Notion site rule을 적용한다
- R2. 페이지 제목에서 `(N+)` 알림 카운터와 `| Notion` 접미사를 제거한다
- R3. 헤딩 블록(h1/h2/h3)을 마크다운 헤딩 계층으로 정확히 변환한다
- R4. 불릿 리스트, 넘버 리스트, 체크리스트를 마크다운 리스트로 변환한다 (중첩 포함)
- R5. 테이블 및 간단한 데이터베이스 뷰를 GFM 테이블로 변환한다
- R6. 토글 블록을 콘텐츠를 펼친 상태로 변환한다 (헤딩이 있으면 헤딩으로, 없으면 볼드 + 내용)
- R7. 콜아웃 블록을 blockquote로 변환한다 (아이콘 이모지 포함)
- R8. 코드 블록을 언어 정보와 함께 fenced code block으로 변환한다
- R9. 컬럼 레이아웃을 순차적 콘텐츠로 평탄화한다
- R10. 구분선(divider) 블록을 `---`로 변환한다
- R11. 외부 임베드(YouTube, 트윗 등)에서 URL을 추출하여 링크로 변환한다
- R12. Notion 앱과 공개 페이지 모두에서 동작한다 (DOM 구조 차이 대응)

## Success Criteria

- 예시 페이지(함수랑산악회 모집 페이지)를 변환했을 때 헤딩, 리스트, 섹션 구분이 원본 구조와 일치
- 기존 site rule(GitHub, SO, Medium)과 동일한 패턴으로 구현되어 설정에서 on/off 가능
- Readability fallback 대비 구조 보존율이 명확히 향상됨

## Scope Boundaries

- Notion 데이터베이스의 복잡한 뷰(캘린더, 보드, 갤러리)는 1차 범위 외. 테이블 뷰만 지원
- Notion API 연동 없음 — DOM 기반 추출만 사용
- Notion 내부 링크(`/page-id`)를 외부 URL로 변환하는 것은 범위 외
- 댓글, 변경 이력 등 메타 콘텐츠는 추출하지 않음

## Key Decisions

- **DOM 기반 추출**: Notion API 대신 DOM 직접 파싱. API는 인증이 필요하고 Chrome Extension 컨텍스트에 부적합
- **토글 펼침**: 토글을 `<details>` 대신 펼친 상태로 변환. LLM 입력 시 접힌 콘텐츠는 무의미
- **컬럼 평탄화**: 마크다운에 컬럼 개념이 없으므로 좌→우 순서로 순차 배치
- **제목 정리**: `(N+)` 패턴과 `| Notion` 접미사를 정규식으로 제거

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R12][Needs research] Notion 앱과 공개 페이지의 DOM 구조 차이 파악. `data-block-id`, 블록 타입 식별자 등 셀렉터 조사 필요
- [Affects R5][Needs research] 데이터베이스 테이블 뷰의 DOM 구조 — 일반 `<table>`인지 커스텀 div 기반인지 확인
- [Affects R8][Technical] 코드 블록의 언어 정보가 DOM 어디에 있는지 확인
- [Affects R4][Technical] 중첩 리스트의 DOM 깊이 표현 방식 파악

## Next Steps

→ `/ce:plan` for structured implementation planning
