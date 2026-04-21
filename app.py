from flask import Flask, render_template, jsonify, request
from crawler import (
    get_all_teams,
    get_team_roster,
    get_player_info,
    get_player_stats,
    search_players,
)
import time

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
    
    group = "pitching" if is_pitcher else "hitting"
    s = get_player_stats(player_id, 2026, group)
    
    if is_pitcher:
        detailed_stats = [
            {"label": "ERA", "val": s.get("era", "-")},
            {"label": "승", "val": s.get("wins", 0)},
            {"label": "패", "val": s.get("losses", 0)},
            {"label": "탈삼진", "val": s.get("strikeOuts", 0)},
            {"label": "이닝", "val": s.get("inningsPitched", "0.0")},
            {"label": "WHIP", "val": s.get("whip", "-")},
            {"label": "피홈런", "val": s.get("homeRuns", 0)},
            {"label": "볼넷", "val": s.get("baseOnBalls", 0)}
        ]
    else:
        detailed_stats = [
            {"label": "타율", "val": s.get("avg", ".000")},
            {"label": "홈런", "val": s.get("homeRuns", 0)},
            {"label": "타점", "val": s.get("rbi", 0)},
            {"label": "OPS", "val": s.get("ops", ".000")},
            {"label": "안타", "val": s.get("hits", 0)},
            {"label": "도루", "val": s.get("stolenBases", 0)},
            {"label": "볼넷", "val": s.get("baseOnBalls", 0)},
            {"label": "득점", "val": s.get("runs", 0)}
        ]
    
    return jsonify({
        "info": info,
        "stats": detailed_stats,
        "is_pitcher": is_pitcher,
        "playerId": player_id,
        "imageUrl": f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{player_id}/headshot/67/current",
    })

@app.route("/api/search")
def api_search():
    pass

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
