import requests
# main_url = "https://statsapi.mlb.com/api/v1"

# 팀 정보
# 믈브 전체 팀의 id와 이름 가져오기
def get_all_teams(season: int = 2026) -> list:
    url = "https://statsapi.mlb.com/api/v1/teams" # 팀 url
    params = {"sportId":1,"season": season}       # url 파라미터
    response = requests.get(url, params=params)   # url + 파라미터로 api 요청
    response.raise_for_status()                   # 오류 검사 함수 (200 OK가 아닐 경우 예외 발생)
    return response.json().get("teams",[])        # json 데이터로 리스트 받아오기
    
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

# stats_data = get_player_stats(660271)
# print(f"홈런: {stats_data.get('homeRuns', 0)}")
# print(f"안타: {stats_data.get('hits', 0)}")
# print(f"타점: {stats_data.get('rbi', 0)}")

# 선수 검색 (선수 이름 입력)
def search_players(name: str) -> list:
    url = "https://statsapi.mlb.com/api/v1/people/search"
    params = {"names": name, "sportId": 1}
    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()
    return data.get("people", [])

# API 예) = https://statsapi.mlb.com/api/v1/people/search?names=Paul%20Goldschmid

# 팀 순위 leagueId = 103(아메리칸) 104(내셔널) / divisionId = 서부/중부/동부 200/202/201 (아메리칸) | 서부/중부/동부 204/205/203 (내셔널)
def get_division_standings(league_id: int):
    url = "https://statsapi.mlb.com/api/v1/standings"
    params = {"leagueId": league_id, "season": 2026, "hydrate": "team"}
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json().get("records", []) # 지구별 리스트 그대로 반환