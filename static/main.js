// ── 전역 상태 ────────────────────────────────────────────────────
let currentTeamId   = null;  // 현재 보고 있는 팀 id
let searchTimer     = null;  // 검색 디바운스 타이머
let recentChartInst = null;  // 최근 경기 차트 인스턴스 (재생성 전에 destroy 해야 함)
const tabLoaded     = {};    // 탭 캐시 - 이미 불러온 탭 다시 안 불러오게
let allTeams        = {};    // 팀 id → 팀 정보 맵
let leaderCache     = {};    // 리더보드 캐시


// ── 페이지 로드 ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadScoreBanner();

    // 팀 목록 불러와서 사이드바 채우기
    fetch('/api/teams')
        .then(r => r.json())
        .then(data => {
            [...data.american, ...data.national].forEach(t => allTeams[t.id] = t);

            const mkItem = t => `
                <div class="sb-team" id="sb-${t.id}" onclick="showTeamDetail(${t.id})">
                    <img src="https://www.mlbstatic.com/team-logos/${t.id}.svg" width="22" height="22">
                    <span>${t.name}</span>
                </div>`;
            document.getElementById('al-list').innerHTML = data.american.map(mkItem).join('');
            document.getElementById('nl-list').innerHTML = data.national.map(mkItem).join('');
        });

    showStandings();

    // 검색창 밖 클릭하면 드롭다운 닫기
    document.addEventListener('click', e => {
        if (!document.getElementById('search-wrapper').contains(e.target)) closeDropdown();
    });
});


// ── 테마 ─────────────────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem('mlb_theme') || 'dark';
    document.documentElement.dataset.theme = saved === 'light' ? 'light' : '';
    updateThemeIcon(saved === 'light');
}

function updateThemeIcon(isLight) {
    document.getElementById('theme-icon-dark').style.display  = isLight ? 'none' : '';
    document.getElementById('theme-icon-light').style.display = isLight ? '' : 'none';
}

function toggleTheme() {
    const isLight = document.documentElement.dataset.theme === 'light';
    const next = isLight ? 'dark' : 'light';
    document.documentElement.dataset.theme = next === 'light' ? 'light' : '';
    updateThemeIcon(next === 'light');
    localStorage.setItem('mlb_theme', next);
}


// ── 상단 스코어 배너 ─────────────────────────────────────────────
let bannerDateStr = '';

// 최근 완료된 경기가 있는 날짜 찾아서 배너 채우기
async function loadScoreBanner() {
    for (let i = 0; i <= 3; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA');
        const r   = await fetch(`/api/schedule?date=${dateStr}`);
        const all = await r.json();
        if (all.filter(g => g.status === 'Final').length) {
            await loadBannerForDate(dateStr);
            return;
        }
    }
    // 3일 다 뒤져도 없으면
    document.getElementById('score-banner').innerHTML =
        `<span style="color:var(--text-3); font-size:0.75rem;">최근 경기 없음</span>`;
}

async function loadBannerForDate(dateStr) {
    const banner = document.getElementById('score-banner');
    banner.innerHTML = `<span style="color:var(--text-3); font-size:0.75rem;">로딩 중...</span>`;
    try {
        const r   = await fetch(`/api/schedule?date=${dateStr}`);
        const all = await r.json();
        bannerDateStr = dateStr;
        updateBannerNav();
        if (!all.length) {
            banner.innerHTML = `<span style="color:var(--text-3); font-size:0.75rem;">해당 날짜 경기 없음</span>`;
            return;
        }
        renderBannerGames(all, dateStr);
    } catch(e) { banner.innerHTML = ''; }
}

// 배너 날짜 이동 - 스크롤 끝 도달하면 날짜 바뀜
function shiftBanner(dir) {
    const banner = document.getElementById('score-banner');
    const scrollAmt = banner.clientWidth * 0.7;
    const atLeft  = banner.scrollLeft <= 0;
    const atRight = banner.scrollLeft + banner.clientWidth >= banner.scrollWidth - 2;
    if (dir === -1 && !atLeft) { banner.scrollLeft -= scrollAmt; return; }
    if (dir ===  1 && !atRight) { banner.scrollLeft += scrollAmt; return; }

    if (!bannerDateStr) return;
    const [y, m, d] = bannerDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + dir);
    const newDate = date.toLocaleDateString('en-CA');
    const today   = new Date().toLocaleDateString('en-CA');
    if (newDate > today) return; // 미래는 안됨
    loadBannerForDate(newDate);
}

function updateBannerNav() {
    const today   = new Date().toLocaleDateString('en-CA');
    const nextBtn = document.getElementById('banner-next');
    if (nextBtn) nextBtn.disabled = (bannerDateStr >= today);
}

function renderBannerGames(games, dateStr) {
    const banner = document.getElementById('score-banner');
    const label  = `<span style="color:var(--text-3); font-size:0.7rem; white-space:nowrap; flex-shrink:0; margin-right:4px;">${dateStr}</span>`;
    banner.innerHTML = label + games.map(g => {
        const isFinal  = g.status === 'Final';
        const isLive   = g.status === 'Live';
        const hasScore = isFinal || isLive;
        const awayWin  = isFinal && g.away.score > g.home.score;
        const homeWin  = isFinal && g.home.score > g.away.score;
        let statusLabel = '예정';
        if (isFinal) statusLabel = '종료';
        else if (isLive) statusLabel = `${g.inning}회 ${g.inningHalf === 'Top' ? '▲' : '▼'}`;
        return `<div class="score-game">
            <div class="score-team">
                <img src="https://www.mlbstatic.com/team-logos/${g.away.id}.svg" width="18" height="18">
                <span style="color:var(--text-2); font-size:0.75rem;">${g.away.name}</span>
                ${hasScore ? `<span class="score-num ${awayWin ? 'win' : ''}">${g.away.score}</span>` : ''}
            </div>
            <span class="score-sep">–</span>
            <div class="score-team">
                ${hasScore ? `<span class="score-num ${homeWin ? 'win' : ''}">${g.home.score}</span>` : ''}
                <span style="color:var(--text-2); font-size:0.75rem;">${g.home.name}</span>
                <img src="https://www.mlbstatic.com/team-logos/${g.home.id}.svg" width="18" height="18">
            </div>
            <span class="score-status ${isLive ? 'live' : ''}">${statusLabel}</span>
        </div>`;
    }).join('');
}


// ── 사이드바 ─────────────────────────────────────────────────────
// 팀 이름으로 사이드바 필터링
function filterTeams(q) {
    q = q.toLowerCase();
    document.querySelectorAll('.sb-team').forEach(el => {
        el.style.display = el.querySelector('span').textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

function setActiveTeam(id) {
    document.querySelectorAll('.sb-team').forEach(el => el.classList.remove('active'));
    if (id) document.getElementById(`sb-${id}`)?.classList.add('active');
}

function setActiveNav(which) {
    document.querySelectorAll('.sb-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.nav === which);
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
}


// ── 선수 검색 드롭다운 ───────────────────────────────────────────
// 타이핑 멈추고 280ms 후에 검색 (너무 자주 요청 안 하려고)
function onSearchInput(val) {
    clearTimeout(searchTimer);
    if (val.length < 2) { closeDropdown(); return; }
    searchTimer = setTimeout(async () => {
        try {
            const r = await fetch(`/api/search?name=${encodeURIComponent(val)}`);
            const list = await r.json();
            if (!list.length) { closeDropdown(); return; }
            const dd = document.getElementById('search-dropdown');
            dd.innerHTML = list.slice(0, 8).map(p => `
                <div class="s-item" onclick="selectPlayer(${p.id})">
                    <span>
                        ${p.koreanName || p.fullName || ''}
                        <span style="color:var(--text-3); font-size:0.75rem; margin-left:5px;">${p.koreanName ? p.fullName : ''}</span>
                    </span>
                    <span class="s-pos">${p.primaryPosition?.abbreviation || ''}</span>
                </div>`).join('');
            dd.style.display = 'block';
        } catch(e) {}
    }, 280);
}

function selectPlayer(id) {
    document.getElementById('player-search').value = '';
    closeDropdown();
    showPlayerStats(id);
}
function closeDropdown() {
    document.getElementById('search-dropdown').style.display = 'none';
}

// 엔터 또는 Search 버튼 클릭 시 첫 번째 결과로 이동
async function searchAndGo() {
    const name = document.getElementById('player-search').value.trim();
    if (!name) return;
    try {
        const r = await fetch(`/api/search?name=${encodeURIComponent(name)}`);
        const list = await r.json();
        if (list?.length) {
            showPlayerStats(list[0].id);
            document.getElementById('player-search').value = '';
        }
    } catch(e) {}
}


// ── 순위표 ───────────────────────────────────────────────────────
async function showStandings() {
    setActiveTeam(null);
    setActiveNav('standings');
    closeSidebar();
    const display = document.getElementById('content-display');
    // 로딩 중 스켈레톤 6개
    display.innerHTML = `<div class="standings-grid">${[...Array(6)].map(() =>
        `<div class="skel" style="height:240px;"></div>`).join('')}</div>`;

    const res  = await fetch('/api/standings/divisions');
    const data = await res.json();

    // 지구 id → 이름
    const divNames = {
        200:"AL East", 202:"AL Central", 201:"AL West",
        203:"NL East", 205:"NL Central", 204:"NL West"
    };
    const alIds = [200, 201, 202];

    const cards = data.map(div => {
        const isAL  = alIds.includes(div.division.id);
        const badge = `<span class="league-badge ${isAL ? 'al-badge' : 'nl-badge'}">${isAL ? 'AL' : 'NL'}</span>`;
        const rows  = div.teamRecords.map(t => {
            const pct = parseFloat(t.winningPercentage || 0);
            return `
                <tr>
                    <td class="rank-cell">${t.divisionRank}</td>
                    <td>
                        <div class="team-cell" onclick="showTeamDetail(${t.team.id})">
                            <img src="https://www.mlbstatic.com/team-logos/${t.team.id}.svg" width="20" height="20">
                            <span>${t.team.teamName}</span>
                        </div>
                    </td>
                    <td>${t.wins}</td>
                    <td>${t.losses}</td>
                    <td>
                        <span class="wpct-val">${t.winningPercentage}</span>
                        <span class="wpct-bar-bg"><span class="wpct-bar-fill" style="width:${Math.round(pct*100)}%;"></span></span>
                    </td>
                    <td class="gb-cell">${t.gamesBack}</td>
                </tr>`;
        }).join('');

        return `
            <div class="div-card">
                <div class="div-head">${badge}${divNames[div.division.id] || div.division.name}</div>
                <table class="s-table">
                    <thead><tr><th>#</th><th>팀</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }).join('');

    display.innerHTML = `
        <p class="page-title">2026 지구별 순위</p>
        <div class="standings-grid">${cards}</div>`;
}


// ── 스탯 리더보드 ────────────────────────────────────────────────
async function showLeaderboard() {
    setActiveTeam(null);
    setActiveNav('leaderboard');
    closeSidebar();
    const display = document.getElementById('content-display');
    display.innerHTML = `
        <p class="page-title">스탯 리더보드</p>
        <div class="stat-tabs" style="margin-bottom:0;">
            <button class="stat-tab-btn active" id="ltab-hr"  onclick="switchLeaderTab('homeRuns','hitting','hr')">홈런</button>
            <button class="stat-tab-btn"         id="ltab-avg" onclick="switchLeaderTab('battingAverage','hitting','avg')">타율</button>
            <button class="stat-tab-btn"         id="ltab-rbi" onclick="switchLeaderTab('rbi','hitting','rbi')">타점</button>
            <button class="stat-tab-btn"         id="ltab-k"   onclick="switchLeaderTab('strikeouts','pitching','k')">탈삼진</button>
            <button class="stat-tab-btn"         id="ltab-era" onclick="switchLeaderTab('earnedRunAverage','pitching','era')">ERA</button>
        </div>
        <div class="stats-wrap" id="leader-content">
            <div style="padding:24px; text-align:center;"><div class="spinner-border spinner-border-sm text-warning"></div></div>
        </div>`;
    switchLeaderTab('homeRuns', 'hitting', 'hr');
}

async function switchLeaderTab(stat, group, tabId) {
    document.querySelectorAll('[id^="ltab-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`ltab-${tabId}`)?.classList.add('active');

    const content = document.getElementById('leader-content');
    if (!content) return;

    // 이미 캐시된 거면 재사용
    if (leaderCache[stat]) { renderLeaders(leaderCache[stat], stat); return; }

    content.innerHTML = `<div style="padding:24px; text-align:center;"><div class="spinner-border spinner-border-sm text-warning"></div></div>`;
    try {
        const r    = await fetch(`/api/leaders?stat=${stat}&group=${group}&limit=15`);
        const data = await r.json();
        leaderCache[stat] = data;
        renderLeaders(data, stat);
    } catch(e) {
        content.innerHTML = `<div style="padding:16px; color:var(--red);">불러오기 실패</div>`;
    }
}

function renderLeaders(leaders, stat) {
    const content = document.getElementById('leader-content');
    if (!content) return;
    const statLabel = { homeRuns:'홈런', battingAverage:'타율', rbi:'타점', strikeouts:'탈삼진', earnedRunAverage:'ERA' };
    const rankCls   = r => r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '';

    const rows = leaders.map(l => `
        <tr onclick="showPlayerStats(${l.playerId})">
            <td class="leader-rank ${rankCls(l.rank)}">${l.rank}</td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${l.playerId}/headshot/67/current"
                         width="32" height="32" style="border-radius:50%; object-fit:cover; object-position:top; background:var(--bg-card); flex-shrink:0;">
                    <div>
                        <div style="font-weight:600;">${l.koreanName || l.fullName}</div>
                        ${l.koreanName ? `<div style="font-size:0.7rem; color:var(--text-3);">${l.fullName}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:6px;">
                    <img src="https://www.mlbstatic.com/team-logos/${l.teamId}.svg" width="16" height="16">
                    <span style="font-size:0.78rem; color:var(--text-2);">${l.teamName}</span>
                </div>
            </td>
            <td class="leader-val">${l.value}</td>
        </tr>`).join('');

    content.innerHTML = `
        <div style="overflow-x:auto;">
            <table class="leader-table">
                <thead><tr><th>#</th><th>선수</th><th>팀</th><th>${statLabel[stat] || stat}</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}


// ── 팀 비교 ──────────────────────────────────────────────────────
function showCompare() {
    setActiveTeam(null);
    setActiveNav('compare');
    closeSidebar();
    const display = document.getElementById('content-display');

    // allTeams 이미 채워져 있어서 그냥 뽑아 씀
    const opts = Object.values(allTeams)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(t => `<option value="${t.id}">${t.name}</option>`)
        .join('');

    display.innerHTML = `
        <p class="page-title">팀 비교</p>
        <div class="compare-select-row">
            <select class="compare-select" id="cmp-t1">${opts}</select>
            <span style="color:var(--text-3); font-weight:700; flex-shrink:0;">vs</span>
            <select class="compare-select" id="cmp-t2">${opts}</select>
            <button class="compare-btn" onclick="loadCompare()">비교하기</button>
        </div>
        <div id="compare-result">
            <p style="color:var(--text-3); font-size:0.85rem; text-align:center; padding:40px 0;">두 팀을 선택하고 비교하기를 눌러주세요.</p>
        </div>`;
}

async function loadCompare() {
    const t1 = document.getElementById('cmp-t1')?.value;
    const t2 = document.getElementById('cmp-t2')?.value;
    const result = document.getElementById('compare-result');
    if (!t1 || !t2 || t1 === t2) {
        result.innerHTML = `<p style="color:var(--red); font-size:0.85rem;">서로 다른 두 팀을 선택해주세요.</p>`;
        return;
    }
    result.innerHTML = `<p style="color:var(--text-3); font-size:0.85rem; text-align:center; padding:32px 0;">불러오는 중...</p>`;

    try {
        const r    = await fetch(`/api/compare?team1=${t1}&team2=${t2}`);
        const data = await r.json();
        const team1 = allTeams[t1] || {};
        const team2 = allTeams[t2] || {};
        const h1 = data.team1.hitting  || {}, h2 = data.team2.hitting  || {};
        const p1 = data.team1.pitching || {}, p2 = data.team2.pitching || {};

        // 비교 행 하나 만들기 - higherBetter: 높을수록 좋은 스탯인지
        const mkRow = (label, v1, v2, higherBetter = true) => {
            const n1 = parseFloat(v1) || 0, n2 = parseFloat(v2) || 0;
            const total = n1 + n2;
            const pct1  = total > 0 ? (n1 / total * 100).toFixed(1) : 50;
            const pct2  = total > 0 ? (n2 / total * 100).toFixed(1) : 50;
            let c1 = '', c2 = '';
            if (n1 !== n2) {
                const leftBetter = higherBetter ? n1 > n2 : n1 < n2;
                c1 = leftBetter ? 'better' : 'worse';
                c2 = leftBetter ? 'worse'  : 'better';
            }
            return `<div class="compare-row">
                <span class="cmp-val left ${c1}">${v1 || '-'}</span>
                <div class="cmp-bar-wrap">
                    <span class="cmp-bar-label">${label}</span>
                    <div class="cmp-bar-track">
                        <div class="cmp-bar-left"  style="width:${pct1}%"></div>
                        <div class="cmp-bar-right" style="width:${pct2}%"></div>
                    </div>
                </div>
                <span class="cmp-val right ${c2}">${v2 || '-'}</span>
            </div>`;
        };

        result.innerHTML = `
            <div class="compare-grid">
                <div class="compare-team-header">
                    <div class="compare-header">
                        <img src="https://www.mlbstatic.com/team-logos/${t1}.svg" width="36" height="36">
                        <div class="compare-header-name">${team1.name || `Team ${t1}`}</div>
                    </div>
                    <div class="compare-header">
                        <img src="https://www.mlbstatic.com/team-logos/${t2}.svg" width="36" height="36">
                        <div class="compare-header-name">${team2.name || `Team ${t2}`}</div>
                    </div>
                </div>
                <div class="compare-section-label">⚾ 타격</div>
                ${mkRow('팀 타율',  h1.avg,         h2.avg)}
                ${mkRow('홈런',     h1.homeRuns,    h2.homeRuns)}
                ${mkRow('타점',     h1.rbi,         h2.rbi)}
                ${mkRow('득점',     h1.runs,        h2.runs)}
                ${mkRow('안타',     h1.hits,        h2.hits)}
                ${mkRow('OPS',      h1.ops,         h2.ops)}
                ${mkRow('출루율',   h1.obp,         h2.obp)}
                ${mkRow('장타율',   h1.slg,         h2.slg)}
                ${mkRow('도루',     h1.stolenBases, h2.stolenBases)}
                ${mkRow('삼진',     h1.strikeOuts,  h2.strikeOuts, false)}
                <div class="compare-section-label">⚡ 투구</div>
                ${mkRow('ERA',      p1.era,         p2.era,         false)}
                ${mkRow('WHIP',     p1.whip,        p2.whip,        false)}
                ${mkRow('탈삼진',   p1.strikeOuts,  p2.strikeOuts)}
                ${mkRow('승',       p1.wins,        p2.wins)}
                ${mkRow('세이브',   p1.saves,       p2.saves)}
                ${mkRow('피홈런',   p1.homeRuns,    p2.homeRuns,    false)}
                ${mkRow('볼넷 허용',p1.baseOnBalls, p2.baseOnBalls, false)}
            </div>`;
    } catch(e) {
        result.innerHTML = `<div style="color:var(--red);">데이터를 불러오지 못했습니다.</div>`;
    }
}


// ── 즐겨찾기 ─────────────────────────────────────────────────────
// localStorage에 저장
function getFavs()     { try { return JSON.parse(localStorage.getItem('mlb_favs') || '[]'); } catch { return []; } }
function saveFavs(arr) { localStorage.setItem('mlb_favs', JSON.stringify(arr)); }
function isFav(id)     { return getFavs().some(f => f.id === id); }

function toggleFav(e, playerId, fullName, koreanName, teamId) {
    e.stopPropagation(); // 카드 클릭 이벤트 버블링 막기
    const favs = getFavs();
    const idx  = favs.findIndex(f => f.id === playerId);
    if (idx >= 0) favs.splice(idx, 1); // 이미 있으면 제거
    else favs.push({ id: playerId, fullName, koreanName, teamId });
    saveFavs(favs);
    renderFavorites();
    // 카드 별 아이콘 업데이트
    document.querySelectorAll(`.star-btn[data-pid="${playerId}"]`).forEach(btn => {
        btn.classList.toggle('starred', idx < 0);
        btn.textContent = idx < 0 ? '★' : '☆';
    });
    // 프로필 버튼도 업데이트
    const profBtn = document.getElementById('prof-fav-btn');
    if (profBtn && parseInt(profBtn.dataset.pid) === playerId) updateProfFavBtn(playerId);
}

function renderFavorites() {
    // 즐겨찾기 탭이 열려 있을 때만 새로고침
    const isActive = document.querySelector('.sb-nav-btn[data-nav="favorites"]')?.classList.contains('active');
    if (isActive) showFavorites();
}

function showFavorites() {
    setActiveTeam(null);
    setActiveNav('favorites');
    closeSidebar();
    const display = document.getElementById('content-display');
    const favs    = getFavs();

    if (!favs.length) {
        display.innerHTML = `
            <p class="page-title">즐겨찾기</p>
            <p style="color:var(--text-3); text-align:center; padding:60px 0;">
                즐겨찾기한 선수가 없습니다.<br>
                <span style="font-size:0.8rem;">선수 카드의 ☆ 버튼으로 추가하세요.</span>
            </p>`;
        return;
    }

    const cards = favs.map(f => {
        const imgUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${f.id}/headshot/67/current`;
        // 이름에 따옴표 있으면 onclick 깨지니까 이스케이프
        const safeKo = (f.koreanName || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const safeFn = f.fullName.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const teamName = f.teamId ? (allTeams[f.teamId]?.teamName || '') : '';
        return `
            <div class="player-card" onclick="showPlayerStats(${f.id})">
                <img src="${imgUrl}" class="player-card-img" alt="${f.fullName}">
                <button class="star-btn starred" data-pid="${f.id}"
                    onclick="toggleFav(event,${f.id},'${safeFn}','${safeKo}',${f.teamId||0});">★</button>
                <div class="player-card-body">
                    <div class="player-card-name">${f.koreanName || f.fullName}</div>
                    <p class="player-card-sub" style="font-size:0.65rem; opacity:0.6;">${f.fullName}</p>
                    ${f.teamId ? `<p class="player-card-sub" style="display:flex;align-items:center;gap:4px;">
                        <img src="https://www.mlbstatic.com/team-logos/${f.teamId}.svg" width="12" height="12">
                        ${teamName}
                    </p>` : ''}
                </div>
            </div>`;
    }).join('');

    display.innerHTML = `
        <p class="page-title">즐겨찾기</p>
        <p style="color:var(--text-3); font-size:0.8rem; margin-bottom:18px;">${favs.length}명</p>
        <div class="player-grid">${cards}</div>`;
}

function updateProfFavBtn(playerId) {
    const btn = document.getElementById('prof-fav-btn');
    if (!btn) return;
    const starred = isFav(playerId);
    btn.classList.toggle('starred', starred);
    btn.textContent = starred ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기';
}


// ── 포지션 배지 클래스 ───────────────────────────────────────────
function posClass(type) {
    return {
        'Pitcher':          'badge-pitcher',
        'Catcher':          'badge-catcher',
        'Infielder':        'badge-infielder',
        'Outfielder':       'badge-outfielder',
        'Two-Way Player':   'badge-twoway',
        'Designated Hitter':'badge-dh'
    }[type] || '';
}


// ── 팀 로스터 ────────────────────────────────────────────────────
async function showTeamDetail(teamId) {
    currentTeamId = teamId;
    closeSidebar();
    setActiveTeam(teamId);
    setActiveNav(null);
    const display = document.getElementById('content-display');
    // 로딩 스켈레톤 15장
    display.innerHTML = `<div class="player-grid">${[...Array(15)].map(() =>
        `<div class="skel" style="height:215px; border-radius:10px;"></div>`).join('')}</div>`;
    try {
        const res  = await fetch(`/api/roster/${teamId}`);
        const data = await res.json();
        const team = allTeams[teamId] || {};

        const cards = data.roster.map(item => {
            const p      = item.person;
            const imgUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`;
            const ptype   = item.position.type || '';
            const bCls    = posClass(ptype);
            const starred = isFav(p.id);
            const safeKo  = (p.koreanName || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            const safeFn  = p.fullName.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            const isIL    = item.isIL || false;
            const ilBadge = isIL ? `<div class="il-badge">${item.ilLabel}</div>` : '';
            const cardSub = isIL
                ? `<p class="player-card-sub il-note">${item.ilNote || item.ilLabel}</p>`
                : `<p class="player-card-sub">No.${item.jerseyNumber || '-'}</p>`;

            return `
                <div class="player-card" data-pos-type="${ptype}" data-il="${isIL}"
                     style="${isIL ? 'display:none;' : ''}"
                     onclick="showPlayerStats(${p.id})">
                    <img src="${imgUrl}" class="player-card-img" alt="${p.fullName}">
                    ${ilBadge}
                    <div class="player-pos-badge ${bCls}">${item.position.abbreviation}</div>
                    <button class="star-btn ${starred ? 'starred' : ''}" data-pid="${p.id}"
                        onclick="toggleFav(event,${p.id},'${safeFn}','${safeKo}',${teamId})">${starred ? '★' : '☆'}</button>
                    <div class="player-card-body">
                        <div class="player-card-name">${p.koreanName || p.fullName}</div>
                        <p class="player-card-sub" style="font-size:0.65rem; opacity:0.6;">${p.fullName}</p>
                        ${cardSub}
                    </div>
                </div>`;
        }).join('');

        display.innerHTML = `
            <div class="roster-top">
                <button class="back-btn" onclick="showStandings()">← 순위표</button>
                <img src="https://www.mlbstatic.com/team-logos/${teamId}.svg" width="46" height="46">
                <div>
                    <div style="font-family:'Barlow Condensed',sans-serif; font-size:1.93rem; font-weight:700;">${team.name || '팀 로스터'}</div>
                    <div style="font-size:0.75rem; color:var(--text-3);">2026 Active Roster · ${data.roster.length}명</div>
                </div>
            </div>
            <div class="filter-bar">
                <button class="fpill active" data-filter="all"               onclick="filterRoster('all')">전체</button>
                <button class="fpill"         data-filter="Pitcher"           onclick="filterRoster('Pitcher')">투수</button>
                <button class="fpill"         data-filter="Catcher"           onclick="filterRoster('Catcher')">포수</button>
                <button class="fpill"         data-filter="Infielder"         onclick="filterRoster('Infielder')">내야수</button>
                <button class="fpill"         data-filter="Outfielder"        onclick="filterRoster('Outfielder')">외야수</button>
                <button class="fpill"         data-filter="Designated Hitter" onclick="filterRoster('Designated Hitter')">지명타자</button>
            </div>
            <div class="player-grid">${cards}</div>`;
    } catch(e) {
        display.innerHTML = `<p style="color:var(--red);">로스터 정보를 불러오지 못했습니다.</p>`;
    }
}

// 포지션 필터
function filterRoster(type) {
    document.querySelectorAll('.player-card').forEach(card => {
        const isIL    = card.dataset.il === 'true';
        const posType = card.dataset.posType;
        let show;
        if (type === 'IL')       show = isIL;
        else if (type === 'all') show = !isIL;
        else show = !isIL && posType === type;
        card.style.display = show ? '' : 'none';
    });
    document.querySelectorAll('.fpill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === type);
    });
}


// ── 선수 프로필 ──────────────────────────────────────────────────
async function showPlayerStats(playerId) {
    // 이전 차트 정리 안 하면 메모리 누수남
    if (recentChartInst) { recentChartInst.destroy(); recentChartInst = null; }
    delete tabLoaded[`${playerId}-career`];
    delete tabLoaded[`${playerId}-recent`];

    const display = document.getElementById('content-display');
    // 로딩 스켈레톤
    display.innerHTML = `
        <div style="display:flex; gap:20px; margin-bottom:20px;">
            <div class="skel" style="width:130px; height:130px; border-radius:10px; flex-shrink:0;"></div>
            <div style="flex:1; display:flex; flex-direction:column; gap:10px; padding-top:4px;">
                <div class="skel" style="height:32px; width:55%;"></div>
                <div class="skel" style="height:14px; width:25%;"></div>
                <div style="display:flex; gap:14px; margin-top:6px;">
                    ${[...Array(3)].map(() => `<div class="skel" style="height:38px; width:90px;"></div>`).join('')}
                </div>
            </div>
        </div>
        <div class="skel" style="height:300px;"></div>`;

    try {
        // 기본 정보랑 수상 경력 같이 불러오기
        const [res, awardsRes] = await Promise.all([
            fetch(`/api/player/${playerId}`),
            fetch(`/api/player/${playerId}/awards`),
        ]);
        const data       = await res.json();
        const awardsData = await awardsRes.json();
        const player    = data.info;
        const isPitcher = data.is_pitcher;
        const isTwoway  = data.is_twoway;
        const teamId    = player.currentTeam?.id || 0;

        const mkRows = (list) => list.map(item => `
            <div class="stat-row">
                <span class="stat-label">${item.Info}</span>
                <span class="stat-val">${item.Record}</span>
            </div>`).join('');

        // 오타니는 타격/투구 둘 다 보여줘야 함
        const seasonContent = isTwoway ? `
            <div class="twoway-grid">
                <div class="twoway-col">
                    <div class="twoway-col-head bat-head">⚾ Batting</div>
                    ${mkRows(data.hitting_stats)}
                </div>
                <div class="twoway-col">
                    <div class="twoway-col-head pit-head">🎯 Pitching</div>
                    ${mkRows(data.pitching_stats)}
                </div>
            </div>` : mkRows(data.stats);

        const safeKo  = (data.korean_name || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const safeFn  = (player.fullName || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const starred = isFav(playerId);

        // 수상 경력 최대 7개만
        const awardsList = (awardsData.awards || []).slice(0, 7);
        const awardsHtml = `
            <div class="profile-awards">
                <div class="profile-awards-title">수상 경력</div>
                ${awardsList.length ? awardsList.map(a => `
                    <div class="profile-award-item">
                        <span class="award-name">${a.name}</span>
                        <span class="award-years">${a.count > 1 ? `${a.years} · ${a.count}회` : a.years}</span>
                    </div>`).join('') :
                `<div style="padding:16px 0; text-align:center; color:var(--text-3); font-size:0.8rem;">수상 기록 없음</div>`}
            </div>`;

        display.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
                <button class="back-btn" onclick="goBack()">← 로스터</button>
                <button class="profile-fav-btn ${starred ? 'starred' : ''}" id="prof-fav-btn" data-pid="${playerId}"
                    onclick="toggleFav(event,${playerId},'${safeFn}','${safeKo}',${teamId})">${starred ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}</button>
            </div>

            <div class="profile-hero">
                <div class="profile-left">
                    <img src="${data.imageUrl}" class="profile-img" alt="${player.fullName}">
                    <div style="min-width:0;">
                        <div class="profile-name">${data.korean_name || player.fullName}</div>
                        <div style="font-size:0.82rem; color:var(--text-3); margin-bottom:4px;">${player.fullName}</div>
                        <div class="profile-pos">${player.primaryPosition.name} &nbsp;·&nbsp; #${player.primaryNumber || '-'}</div>
                        <div class="profile-meta">
                            <div>
                                <span class="pmeta-label">생년월일</span>
                                <span class="pmeta-val">${player.birthDate || '-'}</span>
                            </div>
                            <div>
                                <span class="pmeta-label">출신지</span>
                                <span class="pmeta-val">${player.birthCity || '-'}</span>
                            </div>
                            <div>
                                <span class="pmeta-label">신장 / 체중</span>
                                <span class="pmeta-val">${fmtHeight(player.height)} / ${fmtWeight(player.weight)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                ${awardsHtml}
            </div>

            <div class="stat-tabs">
                <button class="stat-tab-btn active" id="tab-season"
                    onclick="switchStatTab('season',${playerId},${isPitcher},${isTwoway})">2026 시즌</button>
                <button class="stat-tab-btn" id="tab-career"
                    onclick="switchStatTab('career',${playerId},${isPitcher},${isTwoway})">통산 스탯</button>
                <button class="stat-tab-btn" id="tab-recent"
                    onclick="switchStatTab('recent',${playerId},${isPitcher},${isTwoway})">최근 10경기</button>
            </div>
            <div class="stats-wrap">
                <div id="tab-pane-season" class="stat-tab-pane active">${seasonContent}</div>
                <div id="tab-pane-career" class="stat-tab-pane">
                    <div style="padding:20px; text-align:center; color:var(--text-3); font-size:0.82rem;">탭을 클릭하면 불러옵니다.</div>
                </div>
                <div id="tab-pane-recent" class="stat-tab-pane">
                    <div style="padding:20px; text-align:center; color:var(--text-3); font-size:0.82rem;">탭을 클릭하면 불러옵니다.</div>
                </div>
            </div>`;
    } catch(e) { console.error(e); }
}


// ── 스탯 탭 전환 (시즌 / 통산 / 최근 10경기) ────────────────────
async function switchStatTab(tab, playerId, isPitcher, isTwoway = false) {
    ['season','career','recent'].forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
        document.getElementById(`tab-pane-${t}`)?.classList.toggle('active', t === tab);
    });

    const key  = `${playerId}-${tab}`;
    if (tabLoaded[key]) return; // 이미 불러왔으면 패스
    const pane = document.getElementById(`tab-pane-${tab}`);

    // 통산 스탯 탭
    if (tab === 'career') {
        pane.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-3); font-size:0.85rem;">불러오는 중...</div>`;
        try {
            // 통산 스탯이랑 연도별 차트 데이터 같이 받기
            const [careerRes, yearlyRes] = await Promise.all([
                fetch(`/api/player/${playerId}/career`),
                fetch(`/api/player/${playerId}/yearly`)
            ]);
            const career = await careerRes.json();
            const yearly = await yearlyRes.json();

            const mkRows = (list) => list.map(item => `
                <div class="stat-row">
                    <span class="stat-label">${item.Info}</span>
                    <span class="stat-val">${item.Record}</span>
                </div>`).join('');

            const statsHtml = career.is_twoway ? `
                <div class="twoway-grid">
                    <div class="twoway-col">
                        <div class="twoway-col-head bat-head">Batting</div>${mkRows(career.hitting_stats)}
                    </div>
                    <div class="twoway-col">
                        <div class="twoway-col-head pit-head">Pitching</div>${mkRows(career.pitching_stats)}
                    </div>
                </div>` : mkRows(career.stats);

            // 연도별 데이터 2개 이상일 때만 차트 그림
            let chartHtml = '';
            if (yearly.data?.length > 1) {
                chartHtml = `
                    <div style="padding: 0 16px 8px; color:var(--text-3); font-size:0.68rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; margin-top:18px;">연도별 추이</div>
                    <div class="chart-container"><canvas id="yearly-chart-canvas"></canvas></div>`;
            }

            pane.innerHTML = statsHtml + chartHtml;

            if (yearly.data?.length > 1) {
                const ctx     = document.getElementById('yearly-chart-canvas').getContext('2d');
                const isLight = document.documentElement.dataset.theme === 'light';
                const gridClr = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
                const tickClr = isLight ? '#57606a' : '#8b949e';
                const labels  = yearly.data.map(d => d.season);

                // 투수 / 타자 데이터셋 분리
                const datasets = yearly.is_pitcher ? [
                    { label: 'ERA',    data: yearly.data.map(d => parseFloat(d.era) || 0),  borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.1)',  tension: 0.3, pointRadius: 7, pointHoverRadius: 9 },
                    { label: 'WHIP',   data: yearly.data.map(d => parseFloat(d.whip) || 0), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', tension: 0.3, pointRadius: 7, pointHoverRadius: 9, yAxisID: 'y1' },
                    { label: '탈삼진', data: yearly.data.map(d => d.strikeOuts),             borderColor: '#3fb950', backgroundColor: 'rgba(63,185,80,0.1)',  tension: 0.3, pointRadius: 7, pointHoverRadius: 9, yAxisID: 'y2' },
                ] : [
                    { label: '타율',   data: yearly.data.map(d => parseFloat(d.avg) || 0),  borderColor: '#f5c518', backgroundColor: 'rgba(245,197,24,0.1)', tension: 0.3, pointRadius: 7, pointHoverRadius: 9 },
                    { label: 'OPS',    data: yearly.data.map(d => parseFloat(d.ops) || 0),  borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', tension: 0.3, pointRadius: 7, pointHoverRadius: 9, yAxisID: 'y1' },
                    { label: '홈런',   data: yearly.data.map(d => d.homeRuns),               borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.1)',  tension: 0.3, pointRadius: 7, pointHoverRadius: 9, yAxisID: 'y2' },
                ];

                new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        devicePixelRatio: window.devicePixelRatio,
                        animation: false,
                        scales: {
                            x:  { ticks: { color: tickClr, font: { size: 20 } }, grid: { color: gridClr } },
                            y:  { ticks: { color: tickClr }, grid: { color: gridClr }, beginAtZero: true },
                            y1: { position: 'right', ticks: { color: tickClr }, grid: { drawOnChartArea: false }, beginAtZero: true },
                            y2: { display: false, beginAtZero: true }, // 홈런/삼진은 숨긴 y축
                        },
                        plugins: {
                            legend: {
                                labels: { color: tickClr, font: { size: 14 }, usePointStyle: true, pointStyleWidth: 14 },
                                // 범례 클릭으로 데이터셋 켜고 끄기
                                onClick(e, item, legend) {
                                    const ci = legend.chart;
                                    const meta = ci.getDatasetMeta(item.datasetIndex);
                                    meta.hidden = meta.hidden === null ? !ci.data.datasets[item.datasetIndex].hidden : null;
                                    ci.update();
                                }
                            }
                        }
                    }
                });
            }
            tabLoaded[key] = true;
        } catch(e) {
            pane.innerHTML = `<div style="padding:16px; color:var(--red);">불러오기 실패</div>`;
        }

    // 최근 10경기 탭
    } else if (tab === 'recent') {
        pane.innerHTML = `<div style="padding:20px; text-align:center;"><div class="spinner-border spinner-border-sm text-warning"></div></div>`;
        try {
            const r    = await fetch(`/api/player/${playerId}/gamelog`);
            const data = await r.json();
            if (!data.games?.length) {
                pane.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-3); font-size:0.82rem;">데이터 없음</div>`;
                tabLoaded[key] = true;
                return;
            }

            // 투수 / 타자 테이블 헤더 다름
            const tblHead = isPitcher
                ? `<tr><th>날짜</th><th>상대</th><th>이닝</th><th>ERA</th><th>탈삼진</th><th>볼넷</th><th>피안타</th></tr>`
                : `<tr><th>날짜</th><th>상대</th><th>타수</th><th>안타</th><th>홈런</th><th>타점</th><th>타율</th></tr>`;
            const tblRows = data.games.map(g => isPitcher
                ? `<tr><td>${g.date.slice(5)}</td><td>${g.opponent}</td><td>${g.inningsPitched}</td><td>${g.era}</td><td>${g.strikeOuts}</td><td>${g.baseOnBalls}</td><td>${g.hits}</td></tr>`
                : `<tr><td>${g.date.slice(5)}</td><td>${g.opponent}</td><td>${g.atBats}</td><td>${g.hits}</td><td>${g.homeRuns}</td><td>${g.rbi}</td><td>${g.avg}</td></tr>`
            ).join('');

            pane.innerHTML = `
                <div style="overflow-x:auto; margin-bottom:14px;">
                    <table class="gamelog-table"><thead>${tblHead}</thead><tbody>${tblRows}</tbody></table>
                </div>
                <div class="chart-container"><canvas id="recent-chart-canvas"></canvas></div>`;

            const ctx    = document.getElementById('recent-chart-canvas').getContext('2d');
            const labels = [...data.games].reverse().map(g => g.date.slice(5));
            const isLight = document.documentElement.dataset.theme === 'light';
            const gridClr = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
            const tickClr = isLight ? '#57606a' : '#8b949e';

            let chartCfg;
            if (isPitcher) {
                // 투수 - 탈삼진 바 + ERA 라인
                chartCfg = {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: '탈삼진',
                            data: [...data.games].reverse().map(g => g.strikeOuts),
                            backgroundColor: 'rgba(56,139,253,0.65)',
                            borderColor: 'rgba(56,139,253,1)',
                            borderWidth: 1,
                            yAxisID: 'y',
                        }, {
                            label: 'ERA',
                            data: [...data.games].reverse().map(g => parseFloat(g.era) || 0),
                            type: 'line',
                            borderColor: '#f85149',
                            backgroundColor: 'rgba(248,81,73,0.1)',
                            tension: 0.3,
                            pointRadius: 7,
                            pointHoverRadius: 9,
                            yAxisID: 'y1',
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: {
                            x:  { ticks: { color: tickClr, font: { size: 20 } }, grid: { color: gridClr } },
                            y:  { ticks: { color: tickClr }, grid: { color: gridClr }, beginAtZero: true,
                                  title: { display: true, text: 'K', color: '#388bfd', font: { size: 10 } } },
                            y1: { position: 'right', ticks: { color: '#f85149' }, grid: { drawOnChartArea: false },
                                  beginAtZero: true, title: { display: true, text: 'ERA', color: '#f85149', font: { size: 10 } } },
                        },
                        animation: false,
                        plugins: { legend: { labels: { color: tickClr, font: { size: 14 }, usePointStyle: true, pointStyleWidth: 14 }, onClick(e, item, legend) { const ci = legend.chart; const meta = ci.getDatasetMeta(item.datasetIndex); meta.hidden = meta.hidden === null ? !ci.data.datasets[item.datasetIndex].hidden : null; ci.update(); } } }
                    }
                };
            } else {
                // 타자 - 안타/홈런/타점 바
                chartCfg = {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: '안타',
                            data: [...data.games].reverse().map(g => g.hits),
                            backgroundColor: 'rgba(245,166,35,0.7)',
                            borderColor: 'rgba(245,166,35,1)',
                            borderWidth: 1,
                        }, {
                            label: '홈런',
                            data: [...data.games].reverse().map(g => g.homeRuns),
                            backgroundColor: 'rgba(248,81,73,0.7)',
                            borderColor: 'rgba(248,81,73,1)',
                            borderWidth: 1,
                        }, {
                            label: '타점',
                            data: [...data.games].reverse().map(g => g.rbi),
                            backgroundColor: 'rgba(63,185,80,0.6)',
                            borderColor: 'rgba(63,185,80,1)',
                            borderWidth: 1,
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: {
                            x: { ticks: { color: tickClr, font: { size: 20 } }, grid: { color: gridClr } },
                            y: { ticks: { color: tickClr }, grid: { color: gridClr }, beginAtZero: true },
                        },
                        animation: false,
                        plugins: { legend: { labels: { color: tickClr, font: { size: 14 }, usePointStyle: true, pointStyleWidth: 14 }, onClick(e, item, legend) { const ci = legend.chart; const meta = ci.getDatasetMeta(item.datasetIndex); meta.hidden = meta.hidden === null ? !ci.data.datasets[item.datasetIndex].hidden : null; ci.update(); } } }
                    }
                };
            }

            if (recentChartInst) { recentChartInst.destroy(); }
            recentChartInst = new Chart(ctx, chartCfg);
            tabLoaded[key] = true;
        } catch(e) {
            pane.innerHTML = `<div style="padding:16px; color:var(--red);">불러오기 실패</div>`;
        }
    }
}


// ── 단위 변환 ────────────────────────────────────────────────────
// 피트-인치 → cm
function fmtHeight(h) {
    if (!h) return '-';
    const m = h.match(/(\d+)'\s*(\d+)/);
    if (!m) return h;
    const cm = Math.round((parseInt(m[1]) * 12 + parseInt(m[2])) * 2.54);
    return `${cm}cm`;
}
// 파운드 → kg
function fmtWeight(w) {
    if (!w) return '-';
    const kg = Math.round(parseInt(w) * 0.4536);
    return `${kg}kg`;
}

// 선수 → 팀 로스터로 뒤로가기
function goBack() {
    if (currentTeamId) showTeamDetail(currentTeamId);
    else showStandings();
}
