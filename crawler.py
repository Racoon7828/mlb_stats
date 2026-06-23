import requests
from deep_translator import GoogleTranslator
from concurrent.futures import ThreadPoolExecutor

# 번역 결과 메모리 캐시 저장용
_name_cache: dict = {}

def get_korean_name(name: str) -> str:
    # 영어 이름 > 한글로
    if not name: return name
    if name in _name_cache: return _name_cache[name]
    try:
        result = GoogleTranslator(source='en', target='ko').translate(name)
        _name_cache[name] = result
    except Exception:
        _name_cache[name] = name  # 실패하면 원본을 저장함
    return _name_cache[name]

def translate_ko_to_en(name: str) -> str:
    """한글 이름 → 영문 변환 (검색용)"""
    try:
        return GoogleTranslator(source='ko', target='en').translate(name)
    except Exception:
        return name

def get_korean_names_batch(names: list) -> dict:
    """여러 이름을 병렬 번역 (로스터 전체 처리용)"""
    unique = list(dict.fromkeys(names))  # 중복 제거, 순서 유지
    uncached = [n for n in unique if n not in _name_cache]

    if uncached:
        with ThreadPoolExecutor(max_workers=8) as executor:
            list(executor.map(get_korean_name, uncached))  # 캐시에 저장됨

    return {n: _name_cache.get(n, n) for n in names}

# main_url = "https://statsapi.mlb.com/api/v1" # 써놓고 안썻노

# 팀 정보
# 믈브 전체 팀의 id와 이름 가져오기
def get_all_teams(season: int = 2026) -> list:
    url = "https://statsapi.mlb.com/api/v1/teams" # 팀 url
    params = {"sportId":1,"season": season}
    response = requests.get(url, params=params)   # url + 파라미터로 api 요청
    response.raise_for_status()                   # 오류 검사용 (200 아니면 터짐)
    return response.json().get("teams",[])        # json 데이터로 팀 리스트 받기
    
# 데이터 받아오는지 확인용
# for team in get_all_teams():
#     print(f"ID: {team['id']} | Name: {team['name']}")

# 팀 로스터
# 전체 팀 로스터 받아오기
def get_team_roster(team_id: int, season: int = 2026) -> list:
    url = f"https://statsapi.mlb.com/api/v1/teams/{team_id}/roster" 
    params = {"season":season,"rosterType": "active"} # 현재 년도 활동중인 팀
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json().get("roster",[])

# 다저스 = 119
# for team in get_team_roster(119):
#     print(f"person: {team['person']['fullName']}")

# 선수 정보 (리그 전체)
def get_player_info(player_id: int) -> dict:
    url = f"https://statsapi.mlb.com/api/v1/people/{player_id}"
    params = {"hydrate": "currentTeam"} # 타자/투수
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    players = data.get("people", [])
    if players: return players[0]
    return {}

# 오오타니    
# player_info = get_player_info(660271)
# current_team = player_info.get("currentTeam")
# print(f"현재 팀 정보: {current_team}")
# for i in get_player_info(660271).items():
#     print(f"info: {i}")

# 선수 스탯 (특정 선수 한 명 정보 끌어오기)
def get_player_stats(player_id: int, season: int = 2026, group: str = "hitting") -> dict:
    url = f"https://statsapi.mlb.com/api/v1/people/{player_id}/stats"
    params = {"stats": "season", "group":  group, "season":season} # 

    response = requests.get(url, params=params)
    response.raise_for_status()
    stats = response.json().get("stats",[])    

    # 데이터 없을경우 에러방지
    if not stats or not stats[0].get("splits"): return {}
    return stats[0].get("splits")[0].get("stat", {})

# 선수정보 양식 : https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season&group=hitting&season=2026
#                                                      선수id /        시즌 스탯  & 타격 정보     & 2026년 시즌 

# 오타니꺼
# stats_data = get_player_stats(660271)
# print(f"홈런: {stats_data.get('homeRuns', 0)}")
# print(f"안타: {stats_data.get('hits', 0)}")
# print(f"타점: {stats_data.get('rbi', 0)}")

# 선수 검색
def search_players(name: str) -> list:
    url = "https://statsapi.mlb.com/api/v1/people/search"
    params = {"names": name, "sportId": 1}
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    return data.get("people", [])

# 검색 양식 = https://statsapi.mlb.com/api/v1/people/search?names=Paul%20Goldschmid

# 검색 되나 확인
# result = search_players("Ohtani")
# print(result[0]['fullName'], result[0]['id'])

# 팀 순위 
# leagueId = 103(아메리칸) 104(내셔널) 
# divisionId = 서부/중부/동부 200/202/201 (아메리칸) | 서부/중부/동부 204/205/203 (내셔널)
def get_division_standings(league_id: int):
    url = "https://statsapi.mlb.com/api/v1/standings"
    params = {"leagueId": league_id, "season": 2026, "hydrate": "team"}
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json().get("records", []) # 지구별 리스트 받아옴

# AL 순위 확인
# records = get_division_standings(103)
# print(records[0]['teamRecords'][0]['team']['name'])

# 그래프 그릴 선수 통산 스탯
def get_player_career_stats(player_id: int, group: str = "hitting") -> dict:
    url = f"https://statsapi.mlb.com/api/v1/people/{player_id}/stats"
    params = {"stats": "career", "group": group} # stats=career = 통산 누적 스탯
    response = requests.get(url, params=params)
    response.raise_for_status()
    stats = response.json().get("stats", [])
    if not stats or not stats[0].get("splits"): return {}
    return stats[0].get("splits")[0].get("stat", {})

# 양식 = https://statsapi.mlb.com/api/v1/people/660271/stats?stats=career&group=hitting

# 오타니 통산
# career = get_player_career_stats(660271)
# print(f"통산 홈런: {career.get('homeRuns', 0)}")
# print(f"통산 타율: {career.get('avg', '-')}")

# 선수 수상 경력
def get_player_awards(player_id: int) -> list:
    url = f"https://statsapi.mlb.com/api/v1/people/{player_id}/awards"
    response = requests.get(url)
    response.raise_for_status()
    return response.json().get("awards", [])

# 오타니 상 받은거
# awards = get_player_awards(660271)
# for a in awards[:3]:
#     print(a.get('name'), a.get('season'))

# 선수 연도별 기록들
def get_player_yearly_stats(player_id: int, group: str = "hitting") -> list:
    url = f"https://statsapi.mlb.com/api/v1/people/{player_id}/stats"
    params = {"stats": "yearByYear", "group": group}
    response = requests.get(url, params=params)
    response.raise_for_status()
    stats = response.json().get("stats", [])
    if not stats or not stats[0].get("splits"): return []
    return stats[0].get("splits", [])

# 연도별 홈런 확인
# yearly = get_player_yearly_stats(660271)
# for s in yearly[-3:]:
#     print(s['season'], s['stat'].get('homeRuns'))

# 선수뱔 경기 기록
def get_player_game_log(player_id: int, season: int = 2026, group: str = "hitting") -> list:
    url = f"https://statsapi.mlb.com/api/v1/people/{player_id}/stats"
    params = {"stats": "gameLog", "group": group, "season": season} # stats=gameLog : 경기별 스탯 목록
    response = requests.get(url, params=params)
    response.raise_for_status()
    stats = response.json().get("stats", [])
    if not stats or not stats[0].get("splits"): return [] # 데이터 없을 경우 에러 방지
    return stats[0].get("splits", []) # 경기별 스탯 리스트 반환

# 양식) = https://statsapi.mlb.com/api/v1/people/660271/stats?stats=gameLog&group=hitting&season=2026

# 최근 경기 뜨나
# log = get_player_game_log(660271, 2026)
# print(log[-1]['date'], log[-1]['stat'].get('homeRuns'))

# 경기 일정 및 결과
def get_schedule(date: str) -> list:
    url = "https://statsapi.mlb.com/api/v1/schedule"
    params = {"sportId": 1, "date": date, "hydrate": "team,linescore"}
    response = requests.get(url, params=params)
    response.raise_for_status()
    dates = response.json().get("dates", [])
    if not dates:
        return []
    return dates[0].get("games", [])

# 오늘 경기 뜨나
# games = get_schedule("2026-06-01")
# for g in games:
#     print(g['teams']['away']['team']['name'], 'vs', g['teams']['home']['team']['name'])

# 리그 스탯 상위 선수 목록 
# leaderCategories = homeRuns, battingAverage, strikeouts, earnedRunAverage 등등 받아옴
def get_stat_leaders(stat_category: str, group: str = "hitting", season: int = 2026, limit: int = 15) -> list:
    url = "https://statsapi.mlb.com/api/v1/stats/leaders"
    params = {
        "leaderCategories": stat_category,
        "statGroup": group,
        "season": season,
        "sportId": 1,
        "limit": limit,
        "hydrate": "person,team",
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    leaders = response.json().get("leagueLeaders", [])
    if not leaders:
        return []
    return leaders[0].get("leaders", [])

# 홈런 순위 확인
# leaders = get_stat_leaders("homeRuns")
# for l in leaders[:5]:
#     print(l['rank'], l['person']['fullName'], l['value'])

# 팀 시즌 스탯 (타격 / 투구)
def get_team_stats(team_id: int, season: int = 2026, group: str = "hitting") -> dict:
    url = f"https://statsapi.mlb.com/api/v1/teams/{team_id}/stats"
    params = {"stats": "season", "group": group, "season": season}
    response = requests.get(url, params=params)
    response.raise_for_status()
    stats = response.json().get("stats", [])
    if not stats or not stats[0].get("splits"):
        return {}
    return stats[0]["splits"][0].get("stat", {})

# 다저스 팀 스탯
# stats = get_team_stats(119)
# print(f"팀 타율: {stats.get('avg')}")
# print(f"팀 홈런: {stats.get('homeRuns')}")
