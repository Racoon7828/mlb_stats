let currentTeamId = null;

// 1. 페이지 로드 시 팀 목록 가져오기
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/teams')
        .then(res => res.json())
        .then(data => {
            const createItem = (team) => `
                <div onclick="showTeamDetail(${team.id})" 
                     style="padding: 10px; cursor: pointer; border-radius: 4px; display: flex; justify-content: space-between; transition: 0.3s;"
                     onmouseover="this.style.backgroundColor='#343a40'" 
                     onmouseout="this.style.backgroundColor='transparent'">
                    <span style="color: #20c997; font-weight: bold;">${team.abbreviation}</span>
                    <span>${team.name}</span>
                </div>`;
            
            document.getElementById('al-list').innerHTML = data.american.map(createItem).join('');
            document.getElementById('nl-list').innerHTML = data.national.map(createItem).join('');
        });
});

// 2. 팀 로스터 출력
function showTeamDetail(teamId) {
    currentTeamId = teamId;
    const display = document.getElementById('main-content');
    display.innerHTML = '<div class="text-center" style="margin-top:100px;"><div class="spinner-border text-primary"></div></div>';

    fetch(`/api/roster/${teamId}`)
        .then(res => res.json())
        .then(data => {
            const rows = data.roster.map(item => `
                <tr onclick="showPlayerStats(${item.person.id})" style="cursor:pointer;">
                    <td>${item.jerseyNumber || '-'}</td>
                    <td class="fw-bold">${item.person.fullName}</td>
                    <td>${item.position.name}</td>
                    <td><span class="badge bg-light text-dark border">${item.position.type}</span></td>
                </tr>`).join('');

            display.innerHTML = `
                <div class="container-fluid">
                    <h2 class="mb-4 text-center fw-bold">📋 Active Roster</h2>
                    <table class="table table-hover">
                        <thead class="table-dark">
                            <tr><th>#</th><th>Name</th><th>Position</th><th>Type</th></tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            window.scrollTo(0, 0);
        });
}

// ── 선수 상세 정보 표시 함수 ─────────────────────────────────────────────
async function loadPlayerDetail(playerId) {
  $('rosterView').style.display = 'none';
  $('detailView').classList.add('active');
  $('detailView').innerHTML = `<div class="loading"><div class="spinner"></div><span>선수 정보 불러오는 중...</span></div>`;

  const res = await fetch(`/api/player/${playerId}`);
  const p = await res.json();

  const hitting = p.hitting || {};
  const pitching = p.pitching || {};
  const isP = p.position === 'P' || p.position === 'TWP';
  const hasHitting = Object.keys(hitting).length > 0;
  const hasPitching = Object.keys(pitching).length > 0;

  // 스탯 키 정의 (hitStatKeys, pitStatKeys는 기존과 동일)
  const hitStatKeys = [
    { key: 'avg', label: 'AVG', hi: v => parseFloat(v) >= 0.300 },
    { key: 'homeRuns', label: 'HR', hi: v => parseInt(v) >= 30 },
    { key: 'rbi', label: 'RBI', hi: v => parseInt(v) >= 100 },
    { key: 'ops', label: 'OPS', hi: v => parseFloat(v) >= 0.900 },
    { key: 'obp', label: 'OBP', hi: v => parseFloat(v) >= 0.370 },
    { key: 'slg', label: 'SLG', hi: v => parseFloat(v) >= 0.500 },
    { key: 'hits', label: 'H', hi: () => false },
    { key: 'doubles', label: '2B', hi: () => false },
    { key: 'triples', label: '3B', hi: () => false },
    { key: 'stolenBases', label: 'SB', hi: v => parseInt(v) >= 30 },
    { key: 'strikeOuts', label: 'K', hi: () => false },
    { key: 'baseOnBalls', label: 'BB', hi: () => false },
  ];

  const pitStatKeys = [
    { key: 'era', label: 'ERA', hi: v => parseFloat(v) <= 3.00 },
    { key: 'strikeOuts', label: 'K', hi: v => parseInt(v) >= 200 },
    { key: 'wins', label: 'W', hi: v => parseInt(v) >= 15 },
    { key: 'losses', label: 'L', hi: () => false },
    { key: 'whip', label: 'WHIP', hi: v => parseFloat(v) <= 1.10 },
    { key: 'inningsPitched', label: 'IP', hi: v => parseFloat(v) >= 180 },
    { key: 'saves', label: 'SV', hi: v => parseInt(v) >= 30 },
    { key: 'blownSaves', label: 'BS', hi: () => false },
    { key: 'holds', label: 'HLD', hi: () => false },
    { key: 'strikeoutWalkRatio', label: 'K/BB', hi: () => false },
    { key: 'groundOutsToAirouts', label: 'GO/AO', hi: () => false },
    { key: 'gamesStarted', label: 'GS', hi: () => false },
  ];

  const renderStats = (keys, stats) => keys
    .filter(s => stats[s.key] !== undefined && stats[s.key] !== null && stats[s.key] !== '')
    .map(s => `
      <div class="stat-box">
        <div class="stat-val ${s.hi(stats[s.key]) ? 'highlight' : ''}">${stats[s.key] ?? '—'}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('');

  $('detailView').innerHTML = `
    <div class="back-btn" onclick="goBack()">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      ${currentTeam ? escHtml(currentTeam.name) : '목록으로'}
    </div>

    <div class="player-hero">
      <img class="hero-img" src="${p.imageUrl}" alt="${escHtml(p.fullName)}"
           style="object-fit: contain !important; padding: 5px; background: var(--surface);"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><rect fill=%22%23161b22%22 width=%22160%22 height=%22160%22/><text fill=%22%237d8590%22 font-size=%2248%22 x=%2280%22 y=%2295%22 text-anchor=%22middle%22>?</text></svg>'">
      <div class="hero-info">
        <h1>${escHtml(p.fullName)}</h1>
        <div class="hero-team">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          ${escHtml(p.currentTeam || '—')}
          ${p.jerseyNumber ? `<span class="jersey">&nbsp;#${p.jerseyNumber}</span>` : ''}
          &nbsp;·&nbsp; ${escHtml(p.positionName || p.position || '—')}
        </div>
        <div class="meta-chips">
          ${p.birthDate ? `<div class="chip">🎂 <strong>${p.birthDate}</strong></div>` : ''}
          ${p.birthCountry ? `<div class="chip">🌍 <strong>${p.birthCity ? p.birthCity + ', ' : ''}${p.birthCountry}</strong></div>` : ''}
          ${p.height ? `<div class="chip">📏 <strong>${p.height} / ${p.weight} lbs</strong></div>` : ''}
          ${p.batSide ? `<div class="chip">🏏 <strong>타 ${p.batSide}</strong></div>` : ''}
          ${p.pitchHand ? `<div class="chip">⚾ <strong>투 ${p.pitchHand}</strong></div>` : ''}
          ${p.mlbDebutDate ? `<div class="chip">🗓 데뷔 <strong>${p.mlbDebutDate}</strong></div>` : ''}
        </div>
      </div>
    </div>

    ${hasHitting ? `
      <div class="stats-section">
        <div class="stats-title">⚾ 2026 타격 스탯</div>
        <div class="stats-grid">${renderStats(hitStatKeys, hitting)}</div>
      </div>
    ` : ''}

    ${hasPitching ? `
      <div class="stats-section">
        <div class="stats-title">🥊 2026 투구 스탯</div>
        <div class="stats-grid">${renderStats(pitStatKeys, pitching)}</div>
      </div>
    ` : ''}

    ${!hasHitting && !hasPitching ? `
      <div class="empty"><p>아직 2026 시즌 스탯이 없습니다</p></div>
    ` : ''}
  `;
}