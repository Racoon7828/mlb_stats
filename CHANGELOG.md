# CHANGELOG

## [2026-06-23] 프로필 레이아웃 & 로스터 그리드 개선

### 변경
- 선수 프로필 히어로 레이아웃을 2등분 그리드로 전환
  - 좌측 50%: 선수 사진 + 기본 정보
  - 우측 50%: 수상 경력 박스 (스크롤, max-height 220px)
- 로스터 그리드를 한 줄 8명으로 변경 (`repeat(8, 1fr)`)
- 선수 카드 전체 크기 축소 (패딩, 폰트, 배지, 별 버튼)

---

## [2026-06-22] 수상 경력 기능 추가

### 추가
- `crawler.py`: `get_player_awards()` 함수 — MLB Stats API `/people/{id}/awards` 호출
- `app.py`: `/api/player/<id>/awards` 엔드포인트
  - MVP, Cy Young, Gold Glove, Silver Slugger, All-Star, ROY, WS Championship 등 주요 수상만 필터링 (`_MAJOR_AWARD_IDS` 집합)
  - 동일 수상을 연도별로 그룹핑하여 반환 (예: `AL MVP · 2회, 2021, 2023`)
- 선수 프로필 로딩 시 `Promise.all`로 수상 데이터 병렬 fetch
- 프로필 히어로 우측에 수상 경력 섹션 표시 (최대 7개, 수상 없으면 "수상 기록 없음")

### 제거
- 스탯 탭의 "수상 경력" 탭 버튼 및 페인 제거

---

## [2026-06] 연도별 추이 차트 추가 & 차트 전반 개선

### 추가
- `crawler.py`: `get_player_yearly_stats()` 함수 — `yearByYear` 스탯 조회
- `app.py`: `/api/player/<id>/yearly` 엔드포인트
- 통산 스탯 탭 하단에 연도별 선 그래프 추가
  - 타자: 타율 / 홈런 / 타점 / OPS
  - 투수: ERA / 탈삼진 / 승 / WHIP
- 차트 범례 클릭으로 항목별 ON/OFF 토글

### 변경
- 모든 차트 애니메이션 제거 (`animation: false`)
- `devicePixelRatio` 명시로 원형 포인트 타원 버그 수정
- x축 연도 폰트 크기 2배 확대
- 포인트 크기 조정 (`pointRadius: 7`)
- 빨간 선(ERA, 타율) fill 제거

---

## [2026-06] 최근 10경기 탭 추가

### 추가
- `crawler.py`: `get_player_game_log()` 함수 — `gameLog` 스탯 조회
- `app.py`: `/api/player/<id>/gamelog` 엔드포인트 (최근 10경기, 역순 정렬)
- 스탯 탭에 "최근 10경기" 추가
  - 경기 기록 테이블
  - 타자: 안타·홈런·타점 바 차트
  - 투수: 탈삼진 바 + ERA 라인 혼합 차트

---

## [2026-06] UI/UX 전반 개선

### 변경
- 신장 / 체중 단위 한국식 변환 (피트→cm, 파운드→kg)
- 즐겨찾기를 사이드바 내비 버튼 하단에 별도 버튼으로 분리
- 즐겨찾기 별 버튼 활성 색상 노란색(`#f5c518`)으로 변경
- 다크/라이트 테마 버튼 우측 하단 고정 (`position: fixed`) + 단색 SVG 아이콘
- 검색창 SVG 아이콘 적용, Search 버튼 wrapper 외부 배치 (잘림 방지)
- 선수 프로필 사진 크기 조정 (160×200px, object-position: top center)
- 사이드바 폰트 크기 px 고정 (html 150% 스케일 영향 차단)

---

## [2026-06] 팀 비교 개선

### 변경
- 항목별 수치 양쪽 동시 표시 + 비율 바 시각화

---

## [2026-06] 경기 배너 추가

### 추가
- 상단 배너에 당일 경기 스코어 가로 스크롤 표시
- 날짜 이동 버튼 (전날 / 다음날)

---

## [2026-06] 리더보드 추가

### 추가
- `crawler.py`: `get_stat_leaders()` 함수
- `app.py`: `/api/leaders` 엔드포인트
- 타격·투구 카테고리 선택, 리그 상위 15인 표시

---

## [2026-06] 초기 기능 구현

### 추가
- Flask 서버 (`app.py`) + MLB Stats API 연동 (`crawler.py`)
- 팀 목록 사이드바 (AL/NL 30팀)
- 지구별 순위표
- 팀 로스터 조회 (활성 로스터 + IL 표시)
- 선수 프로필 (2026 시즌 스탯 / 통산 스탯)
- 선수 검색 (한글 이름 → 영문 자동 변환 후 검색)
- 즐겨찾기 (`localStorage` 저장)
- 다크/라이트 테마
- 이름 한글 자동 번역 (`deep-translator`, `ThreadPoolExecutor` 병렬 처리)
- `run.bat`: Anaconda `PY_10` 가상환경 자동 활성화 후 서버 실행
