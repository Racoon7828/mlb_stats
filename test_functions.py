"""
crawler.py 함수 + app.py Flask 라우트 연결 확인용 테스트
실행: python test_functions.py
"""
import sys
from crawler import (
    get_all_teams,
    get_team_roster,
    get_player_info,
    get_player_stats,
    search_players,
    get_division_standings,
    get_player_career_stats,
    get_player_game_log,
    get_korean_name,
    get_korean_names_batch,
    translate_ko_to_en,
    get_schedule,
    get_stat_leaders,
    get_team_stats,
    get_player_yearly_stats,
    get_player_awards,
)

OHTANI = 660271   # 오타니 ID
DODGERS = 119     # 다저스 ID
TODAY = "2026-06-28"

PASS = "\033[92m[OK]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"

def check(label, fn, validator=None):
    try:
        result = fn()
        if validator and not validator(result):
            print(f"{FAIL} {label} → 값 이상함: {result!r}")
            return False
        print(f"{PASS} {label}")
        return True
    except Exception as e:
        print(f"{FAIL} {label} → {e}")
        return False

results = []

# ── crawler.py 함수들 ──────────────────────────────────────────────
results.append(check(
    "get_all_teams()",
    lambda: get_all_teams(2026),
    lambda r: isinstance(r, list) and len(r) > 0
))

results.append(check(
    "get_team_roster(119)",
    lambda: get_team_roster(DODGERS, 2026),
    lambda r: isinstance(r, list) and len(r) > 0
))

results.append(check(
    "get_player_info(오타니)",
    lambda: get_player_info(OHTANI),
    lambda r: isinstance(r, dict) and r.get("fullName") == "Shohei Ohtani"
))

results.append(check(
    "get_player_stats(오타니, hitting)",
    lambda: get_player_stats(OHTANI, 2026, "hitting"),
    lambda r: isinstance(r, dict) and "homeRuns" in r
))

results.append(check(
    "get_player_stats(오타니, pitching)",
    lambda: get_player_stats(OHTANI, 2026, "pitching"),
    lambda r: isinstance(r, dict)
))

results.append(check(
    "search_players('Ohtani')",
    lambda: search_players("Ohtani"),
    lambda r: isinstance(r, list) and any(p.get("id") == OHTANI for p in r)
))

results.append(check(
    "get_division_standings(103 AL)",
    lambda: get_division_standings(103),
    lambda r: isinstance(r, list) and len(r) > 0
))

results.append(check(
    "get_division_standings(104 NL)",
    lambda: get_division_standings(104),
    lambda r: isinstance(r, list) and len(r) > 0
))

results.append(check(
    "get_player_career_stats(오타니, hitting)",
    lambda: get_player_career_stats(OHTANI, "hitting"),
    lambda r: isinstance(r, dict) and "homeRuns" in r
))

results.append(check(
    "get_player_game_log(오타니)",
    lambda: get_player_game_log(OHTANI, 2026, "hitting"),
    lambda r: isinstance(r, list)
))

results.append(check(
    "get_player_yearly_stats(오타니)",
    lambda: get_player_yearly_stats(OHTANI, "hitting"),
    lambda r: isinstance(r, list) and len(r) > 0
))

results.append(check(
    "get_player_awards(오타니)",
    lambda: get_player_awards(OHTANI),
    lambda r: isinstance(r, list)
))

results.append(check(
    "get_schedule(오늘)",
    lambda: get_schedule(TODAY),
    lambda r: isinstance(r, list)
))

results.append(check(
    "get_stat_leaders('homeRuns')",
    lambda: get_stat_leaders("homeRuns", "hitting", 2026, 5),
    lambda r: isinstance(r, list) and len(r) > 0
))

results.append(check(
    "get_team_stats(다저스, hitting)",
    lambda: get_team_stats(DODGERS, 2026, "hitting"),
    lambda r: isinstance(r, dict) and "avg" in r
))

# ── 번역 함수 ──────────────────────────────────────────────────────
results.append(check(
    "get_korean_name('Shohei Ohtani')",
    lambda: get_korean_name("Shohei Ohtani"),
    lambda r: isinstance(r, str) and len(r) > 0
))

results.append(check(
    "get_korean_names_batch()",
    lambda: get_korean_names_batch(["Shohei Ohtani", "Freddie Freeman"]),
    lambda r: isinstance(r, dict) and len(r) == 2
))

results.append(check(
    "translate_ko_to_en('오타니')",
    lambda: translate_ko_to_en("오타니"),
    lambda r: isinstance(r, str) and len(r) > 0
))

# ── app.py Flask 라우트 ────────────────────────────────────────────
print(f"\n── app.py 라우트 테스트 ──")
import json
from app import app as flask_app
client = flask_app.test_client()

def check_route(label, path, validator=None):
    try:
        res = client.get(path)
        if res.status_code != 200:
            print(f"{FAIL} {label} → HTTP {res.status_code}")
            return False
        data = json.loads(res.data)
        if validator and not validator(data):
            print(f"{FAIL} {label} → 값 이상함: {str(data)[:80]}")
            return False
        print(f"{PASS} {label}")
        return True
    except Exception as e:
        print(f"{FAIL} {label} → {e}")
        return False

results.append(check_route(
    "GET /api/teams",
    "/api/teams",
    lambda d: "american" in d and "national" in d
))

results.append(check_route(
    "GET /api/roster/119 (다저스)",
    "/api/roster/119",
    lambda d: "roster" in d and len(d["roster"]) > 0
))

results.append(check_route(
    "GET /api/player/660271 (오타니)",
    "/api/player/660271",
    lambda d: d.get("is_twoway") is True and "stats" in d
))

results.append(check_route(
    "GET /api/player/660271/career",
    "/api/player/660271/career",
    lambda d: "stats" in d and d.get("is_twoway") is True
))

results.append(check_route(
    "GET /api/player/660271/awards",
    "/api/player/660271/awards",
    lambda d: "awards" in d
))

results.append(check_route(
    "GET /api/player/660271/yearly",
    "/api/player/660271/yearly",
    lambda d: "data" in d and len(d["data"]) > 0
))

results.append(check_route(
    "GET /api/player/660271/gamelog",
    "/api/player/660271/gamelog",
    lambda d: "games" in d
))

results.append(check_route(
    "GET /api/search?name=Ohtani",
    "/api/search?name=Ohtani",
    lambda d: isinstance(d, list) and len(d) > 0
))

results.append(check_route(
    "GET /api/search?name=오타니 (한글→번역 검색, 결과 없어도 OK)",
    "/api/search?name=%EC%98%A4%ED%83%80%EB%8B%88",
    lambda d: isinstance(d, list)  # 번역 품질에 따라 결과 없을 수 있음
))

results.append(check_route(
    "GET /api/standings/divisions",
    "/api/standings/divisions",
    lambda d: isinstance(d, list) and len(d) > 0
))

results.append(check_route(
    f"GET /api/schedule?date={TODAY}",
    f"/api/schedule?date={TODAY}",
    lambda d: isinstance(d, list)
))

results.append(check_route(
    "GET /api/leaders?stat=homeRuns",
    "/api/leaders?stat=homeRuns&group=hitting&limit=5",
    lambda d: isinstance(d, list) and len(d) > 0
))

results.append(check_route(
    "GET /api/compare?team1=119&team2=147 (다저스 vs 양키스)",
    "/api/compare?team1=119&team2=147",
    lambda d: "team1" in d and "team2" in d
))

# ── 결과 요약 ──────────────────────────────────────────────────────
passed = sum(results)
total  = len(results)
print(f"\n{'='*40}")
print(f"결과: {passed}/{total} 통과")
if passed < total:
    print(f"FAIL {total - passed}개 — 위 항목 확인")
else:
    print("모든 항목 정상")
