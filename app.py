from flask import Flask, render_template, jsonify, request
from crawler import (
    get_all_teams,
    get_team_roster,
    get_player_info,
    get_player_stats,
    search_players,
    get_division_standings,
)

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("main.html")

@app.route("/api/teams")
def api_teams():
    all_teams = get_all_teams(2026)
    
    # 약자(abbreviation) 기준으로 알파벳 순 정렬
    all_teams = sorted(all_teams, key=lambda x: x.get('abbreviation', ''))
    
    # 리그별 분류 (AL: 103, NL: 104)
    al_teams = [t for t in all_teams if t.get('league', {}).get('id') == 103]
    nl_teams = [t for t in all_teams if t.get('league', {}).get('id') == 104]
    
    return jsonify({
        "american": al_teams,
        "national": nl_teams
    })

@app.route("/api/roster/<int:team_id>")
def api_roster(team_id):
    roster = get_team_roster(team_id, 2026)
    return jsonify({"roster":roster})

@app.route("/api/player/<int:player_id>")
def api_player_detail(player_id):
    info = get_player_info(player_id)    
    position_type = info.get("primaryPosition", {}).get("type", "")
    is_pitcher = (position_type == "Pitcher")
    is_twp = (position_type == "Two-Way Player")
    
    group = "pitching" if is_pitcher else "hitting"
    s = get_player_stats(player_id, 2026, group)

    player_img = f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{player_id}/headshot/67/current"
    
    if is_pitcher :
        detailed_stats = [
            {"Info": "경기 수", "Record": str(s.get("gamesPlayed", 0))},
            {"Info": "이닝", "Record": s.get("inningsPitched", "0.0")},
            {"Info": "ERA", "Record": s.get("era", "-")},
            {"Info": "승", "Record": s.get("wins", 0)},
            {"Info": "패", "Record": s.get("losses", 0)},
            {"Info": "탈삼진", "Record": s.get("strikeOuts", 0)},
            {"Info": "볼넷", "Record": s.get("baseOnBalls", 0)},
            {"Info": "WHIP", "Record": s.get("whip", "-")},
            {"Info": "피홈런", "Record": s.get("homeRuns", 0)},
        ]
    
    elif is_twp :
        detailed_stats = [
            {"Info": "경기 수", "Record": str(s.get("gamesPlayed", 0))},
            {"Info": "타수", "Record": s.get("ab", "0")},
            {"Info": "타율", "Record": s.get("avg", ".000")},
            {"Info": "안타", "Record": s.get("hits", 0)},
            {"Info": "타점", "Record": s.get("rbi", 0)},
            {"Info": "홈런", "Record": s.get("homeRuns", 0)},
            {"Info": "득점", "Record": s.get("runs", 0)},
            {"Info": "볼넷", "Record": s.get("baseOnBalls", 0)},
            {"Info": "도루", "Record": s.get("stolenBases", 0)},
            {"Info": "OPS", "Record": s.get("ops", ".000")},
            {"Info": "OBP", "Record": s.get("obp", ".000")},
            {"Info": "Pitching", "Record": ""},
            {"Info": "이닝", "Record": s.get("inningsPitched", "0.0")},
            {"Info": "ERA", "Record": s.get("era", "-")},
            {"Info": "승", "Record": s.get("wins", 0)},
            {"Info": "패", "Record": s.get("losses", 0)},
            {"Info": "탈삼진", "Record": s.get("strikeOuts", 0)},
            {"Info": "볼넷", "Record": s.get("baseOnBalls", 0)},
            {"Info": "WHIP", "Record": s.get("whip", "-")},
            {"Info": "피홈런", "Record": s.get("homeRuns", 0)},
        ]
    
    else:
        detailed_stats = [
            {"Info": "경기 수", "Record": str(s.get("gamesPlayed", 0))},
            {"Info": "타수", "Record": s.get("atBats", "0")},
            {"Info": "타율", "Record": s.get("avg", ".000")},
            {"Info": "안타", "Record": s.get("hits", 0)},
            {"Info": "타점", "Record": s.get("rbi", 0)},
            {"Info": "홈런", "Record": s.get("homeRuns", 0)},
            {"Info": "득점", "Record": s.get("runs", 0)},
            {"Info": "볼넷", "Record": s.get("baseOnBalls", 0)},
            {"Info": "도루", "Record": s.get("stolenBases", 0)},
            {"Info": "OPS", "Record": s.get("ops", ".000")},
            {"Info": "OBP", "Record": s.get("obp", ".000")},
        ]
    
    return jsonify({
        "info": info,
        "stats": detailed_stats,
        "is_pitcher": is_pitcher,
        "playerId": player_id,
        "imageUrl": player_img,
    })

@app.route("/api/search")
def api_search():
    name = request.args.get('name', '')
    if not name:
        return jsonify([])
    try:
        # crawler.py에 정의된 search_players 함수 호출
        results = search_players(name)
        return jsonify(results)
    except Exception as e:
        print(f"Search Error: {e}")
        return jsonify([]), 500

@app.route("/api/standings/divisions")
def api_divisions():
    # AL(103)과 NL(104) 데이터를 모두 가져와서 합칩니다.
    al_records = get_division_standings(103)
    nl_records = get_division_standings(104)
    return jsonify(al_records + nl_records)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
