import re
from datetime import date as _date
from flask import Flask, render_template, jsonify, request
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
) # 졸라많네

app = Flask(__name__)

# 타격
def _hitting_stats(s):
    return [
        {"Info": "경기 수", "Record": str(s.get("gamesPlayed", 0))},
        {"Info": "타수",    "Record": s.get("atBats", "0")},
        {"Info": "타율",    "Record": s.get("avg", ".000")},
        {"Info": "안타",    "Record": s.get("hits", 0)},
        {"Info": "타점",    "Record": s.get("rbi", 0)},
        {"Info": "홈런",    "Record": s.get("homeRuns", 0)},
        {"Info": "득점",    "Record": s.get("runs", 0)},
        {"Info": "볼넷",    "Record": s.get("baseOnBalls", 0)},
        {"Info": "도루",    "Record": s.get("stolenBases", 0)},
        {"Info": "OPS",     "Record": s.get("ops", ".000")},
        {"Info": "OBP",     "Record": s.get("obp", ".000")},
    ]

# 투구
def _pitching_stats(s):
    return [
        {"Info": "경기 수", "Record": str(s.get("gamesPlayed", 0))},
        {"Info": "이닝",    "Record": s.get("inningsPitched", "0.0")},
        {"Info": "ERA",     "Record": s.get("era", "-")},
        {"Info": "승",      "Record": s.get("wins", 0)},
        {"Info": "패",      "Record": s.get("losses", 0)},
        {"Info": "탈삼진",  "Record": s.get("strikeOuts", 0)},
        {"Info": "볼넷",    "Record": s.get("baseOnBalls", 0)},
        {"Info": "WHIP",    "Record": s.get("whip", "-")},
        {"Info": "피홈런",  "Record": s.get("homeRuns", 0)},
        {"Info": "세이브",  "Record": s.get("saves", 0)},
    ]
# 추가 할만한거... 

# ── 라우트 ─────────────────────────────────────────────────────────
@app.route("/")
def index(): return render_template("main.html")

@app.route("/api/teams")
def api_teams():
    all_teams = get_all_teams(2026)
    all_teams = sorted(all_teams, key=lambda x: x.get('abbreviation', ''))
    al_teams  = [t for t in all_teams if t.get('league', {}).get('id') == 103]
    nl_teams  = [t for t in all_teams if t.get('league', {}).get('id') == 104]
    return jsonify({"american": al_teams, "national": nl_teams})

_IL_LABEL = {'D7':'IL-7','D10':'IL-10','D15':'IL-15','D60':'IL-60','ILF':'IL','RA':'재활'}
_SHOW_CODES = {'A','D7','D10','D15','D60','ILF','RA'}  # RM(마이너파견), DEV(개발리스트) 제외

@app.route("/api/roster/<int:team_id>")
def api_roster(team_id):
    roster = get_team_roster(team_id, 2026)
    roster = [item for item in roster if item.get('status',{}).get('code','A') in _SHOW_CODES]

    names      = [item["person"]["fullName"] for item in roster]
    korean_map = get_korean_names_batch(names)
    for item in roster:
        item["person"]["koreanName"] = korean_map.get(item["person"]["fullName"], "")
        code           = item.get('status',{}).get('code','A')
        item["isIL"]   = code != 'A'
        item["ilLabel"] = _IL_LABEL.get(code, 'IL') if code != 'A' else ''
        item["ilNote"]  = item.get('note', '')
    return jsonify({"roster": roster})

@app.route("/api/player/<int:player_id>")
def api_player_detail(player_id):
    info          = get_player_info(player_id)
    position_type = info.get("primaryPosition", {}).get("type", "")
    is_pitcher    = (position_type == "Pitcher")
    is_twp        = (position_type == "Two-Way Player")
    player_img    = f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{player_id}/headshot/67/current"

    # 아오 오타니
    if is_twp:
        hitting_stats  = _hitting_stats(get_player_stats(player_id, 2026, "hitting"))
        pitching_stats = _pitching_stats(get_player_stats(player_id, 2026, "pitching"))
        stats          = hitting_stats
    elif is_pitcher:
        stats          = _pitching_stats(get_player_stats(player_id, 2026, "pitching"))
        hitting_stats  = None
        pitching_stats = None
    else:
        stats          = _hitting_stats(get_player_stats(player_id, 2026, "hitting"))
        hitting_stats  = None
        pitching_stats = None

    return jsonify({
        "info":           info,
        "stats":          stats,
        "is_pitcher":     is_pitcher,
        "is_twoway":      is_twp,
        "hitting_stats":  hitting_stats,
        "pitching_stats": pitching_stats,
        "playerId":       player_id,
        "imageUrl":       player_img,
        "korean_name":    get_korean_name(info.get("fullName", "")),
    })

@app.route("/api/player/<int:player_id>/career")
def api_player_career(player_id):
    info          = get_player_info(player_id)
    position_type = info.get("primaryPosition", {}).get("type", "")
    is_pitcher    = (position_type == "Pitcher")
    is_twp        = (position_type == "Two-Way Player")

    if is_twp:
        hitting_stats  = _hitting_stats(get_player_career_stats(player_id, "hitting"))
        pitching_stats = _pitching_stats(get_player_career_stats(player_id, "pitching"))
        return jsonify({
            "stats":          hitting_stats,
            "is_twoway":      True,
            "hitting_stats":  hitting_stats,
            "pitching_stats": pitching_stats,
        })
    elif is_pitcher:
        return jsonify({
            "stats":     _pitching_stats(get_player_career_stats(player_id, "pitching")),
            "is_twoway": False,
        })
    else:
        return jsonify({
            "stats":     _hitting_stats(get_player_career_stats(player_id, "hitting")),
            "is_twoway": False,
        })

_MAJOR_AWARD_IDS = {
    'ALMVP','NLMVP','WSMVP','WBCMVP','WBCMVPB',
    'ALCY','NLCY', # 싸이영
    'ALGG','NLGG', # 골글
    'ALSS','NLSS', # 도루
    'ALROY','NLROY', # 신인
    'ALAS','NLAS', # 올스타
    'WSCHAMP', # 월시우승
    'ALCSMVP','NLCSMVP', # 아메/내셔널 챔피언십 mvp
    'ALHAA','NLHAA', # 행크애런상
    'MLBPCPOY','MLBPCALOP','MLBPCNLOP', # 올해의 선수
    'DHOY', # 지명타자
}

@app.route("/api/player/<int:player_id>/awards")
def api_player_awards(player_id):
    try:
        awards = get_player_awards(player_id)
        grouped = {}
        for a in awards:
            aid = a.get("id", "")
            if aid not in _MAJOR_AWARD_IDS:
                continue
            if aid not in grouped:
                grouped[aid] = {"name": a.get("name", ""), "seasons": []}
            season = a.get("season", "")
            if season and season not in grouped[aid]["seasons"]:
                grouped[aid]["seasons"].append(season)
        result = []
        for aid, info in grouped.items():
            info["seasons"].sort()
            result.append({
                "id":    aid,
                "name":  info["name"],
                "count": len(info["seasons"]),
                "years": ", ".join(info["seasons"]),
            })
        result.sort(key=lambda x: x["count"], reverse=True)
        return jsonify({"awards": result})
    except Exception as e:
        return jsonify({"awards": [], "error": str(e)})

@app.route("/api/player/<int:player_id>/yearly")
def api_player_yearly(player_id):
    info          = get_player_info(player_id)
    position_type = info.get("primaryPosition", {}).get("type", "")
    is_pitcher    = (position_type == "Pitcher")
    group         = "pitching" if is_pitcher else "hitting"
    splits        = get_player_yearly_stats(player_id, group)
    result = []
    for s in splits:
        stat   = s.get("stat", {})
        season = s.get("season", "")
        if not season:
            continue
        if is_pitcher:
            result.append({"season": season, "era": stat.get("era", "-"), "strikeOuts": stat.get("strikeOuts", 0), "wins": stat.get("wins", 0), "whip": stat.get("whip", "-")})
        else:
            result.append({"season": season, "avg": stat.get("avg", ".000"), "homeRuns": stat.get("homeRuns", 0), "rbi": stat.get("rbi", 0), "ops": stat.get("ops", ".000")})
    return jsonify({"data": result, "is_pitcher": is_pitcher})

@app.route("/api/player/<int:player_id>/gamelog")
def api_player_gamelog(player_id):
    info          = get_player_info(player_id)
    position_type = info.get("primaryPosition", {}).get("type", "")
    is_pitcher    = (position_type == "Pitcher")
    group         = "pitching" if is_pitcher else "hitting"
    splits        = get_player_game_log(player_id, 2026, group)

    recent = splits[-10:][::-1]
    games  = []
    for split in recent:
        stat      = split.get("stat", {})
        opp       = split.get("opponent", {})
        game_date = split.get("date", "")[:10]
        opp_name  = opp.get("name", "?")
        if is_pitcher:
            games.append({
                "date":           game_date,
                "opponent":       opp_name,
                "inningsPitched": stat.get("inningsPitched", "0.0"),
                "era":            stat.get("era", "-"),
                "strikeOuts":     stat.get("strikeOuts", 0),
                "baseOnBalls":    stat.get("baseOnBalls", 0),
                "hits":           stat.get("hits", 0),
            })
        else:
            games.append({
                "date":     game_date,
                "opponent": opp_name,
                "atBats":   stat.get("atBats", 0),
                "hits":     stat.get("hits", 0),
                "homeRuns": stat.get("homeRuns", 0),
                "rbi":      stat.get("rbi", 0),
                "avg":      stat.get("avg", ".000"),
            })
    return jsonify({"games": games})

def _is_korean(text: str) -> bool:
    return bool(re.search('[가-힣]', text))

@app.route("/api/search")
def api_search():
    name = request.args.get('name', '')
    if not name:
        return jsonify([])
    try:
        search_name = translate_ko_to_en(name) if _is_korean(name) else name
        results = search_players(search_name)
        # 번역 결과로 못 찾으면 성(last word)만으로 재시도 (Otani → Otani 단독)
        if not results and _is_korean(name):
            last_word = search_name.split()[-1] if search_name else search_name
            if last_word != search_name:
                results = search_players(last_word)
        if results:
            korean_map = get_korean_names_batch([p.get('fullName', '') for p in results])
            for p in results:
                p['koreanName'] = korean_map.get(p.get('fullName', ''), '')
        return jsonify(results)
    except Exception as e:
        print(f"Search Error: {e}")
        return jsonify([]), 500

@app.route("/api/standings/divisions")
def api_divisions():
    al_records = get_division_standings(103)
    nl_records = get_division_standings(104)
    return jsonify(al_records + nl_records)

# 상단 경기 일정/결과 
@app.route("/api/schedule")
def api_schedule():
    date = request.args.get('date', str(_date.today()))
    try:
        games = get_schedule(date)
    except Exception:
        return jsonify([])

    result = []
    for g in games:
        away     = g.get('teams', {}).get('away', {})
        home     = g.get('teams', {}).get('home', {})
        ls       = g.get('linescore', {})
        state    = g.get('status', {}).get('abstractGameState', 'Preview')
        detailed = g.get('status', {}).get('detailedState', '')
        has_score = state in ('Live', 'Final')
        result.append({
            'gamePk':      g.get('gamePk'),
            'status':      state,
            'detailedState': detailed,
            'away': {
                'id':    away.get('team', {}).get('id'),
                'name':  away.get('team', {}).get('teamName', ''),
                'score': away.get('score') if has_score else None,
            },
            'home': {
                'id':    home.get('team', {}).get('id'),
                'name':  home.get('team', {}).get('teamName', ''),
                'score': home.get('score') if has_score else None,
            },
            'inning':     ls.get('currentInning', ''),
            'inningHalf': ls.get('inningHalf', ''),
            'gameDate':   g.get('gameDate', ''),
        })
    return jsonify(result)

# ── 스탯 리더보드 ──────────────────────────────────────────────────
@app.route("/api/leaders")
def api_leaders():
    stat  = request.args.get('stat', 'homeRuns')
    group = request.args.get('group', 'hitting')
    limit = int(request.args.get('limit', 15))
    try:
        leaders = get_stat_leaders(stat, group, 2026, limit)
    except Exception:
        return jsonify([])

    result = []
    for l in leaders:
        person = l.get('person', {})
        team   = l.get('team', {})
        result.append({
            'rank':      l.get('rank'),
            'value':     l.get('value'),
            'playerId':  person.get('id'),
            'fullName':  person.get('fullName', ''),
            'teamId':    team.get('id'),
            'teamName':  team.get('name', ''),
        })
    if result:
        korean_map = get_korean_names_batch([r['fullName'] for r in result])
        for r in result:
            r['koreanName'] = korean_map.get(r['fullName'], '')
    return jsonify(result)

# ── 팀 비교 ────────────────────────────────────────────────────────
@app.route("/api/compare")
def api_compare():
    try:
        t1 = int(request.args.get('team1', 0))
        t2 = int(request.args.get('team2', 0))
        if not t1 or not t2: # 
            return jsonify({"error": "team1, team2 필요"}), 400
        return jsonify({
            "team1": {"id": t1, "hitting": get_team_stats(t1, 2026, "hitting"), "pitching": get_team_stats(t1, 2026, "pitching")},
            "team2": {"id": t2, "hitting": get_team_stats(t2, 2026, "hitting"), "pitching": get_team_stats(t2, 2026, "pitching")},
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    import os
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug, host="0.0.0.0", port=5001)
