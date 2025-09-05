// filename:app.js
document.addEventListener('DOMContentLoaded', () => {
    const API = {
        DATA_URL: './data/team.json',
        STORAGE_KEY: 'skullball:v2',
    };

    const state = {
        teams: [],
        schedule: [],
        knockout: [],
        results: {},
        settings: {
            points: { win: 3, draw: 1, loss: 0 },
            bonus: { enabled: true, boThreshold: 3, bdThreshold: 1 },
            matchDuration: 15,
            forfeitScore: 3,
        },
        liveMatch: {
            id: null,
            timerInterval: null,
            remainingTime: 0,
            homeScore: 0,
            awayScore: 0,
            homeLog: [],
            awayLog: [],
            status: 'upcoming'
        },
    };

    const dom = {
        mainNav: document.querySelector('.main-nav'),
        tabs: document.querySelectorAll('.tab-content'),
        classementSubNav: document.querySelector('#tab-classement .sub-nav'),
        subTabs: document.querySelectorAll('.sub-tab-content'),
        standingsBody: document.getElementById('standings-body'),
        scorersBody: document.getElementById('scorers-body'),
        knockoutContainer: document.getElementById('knockout-container'),
        liveMatchCard: document.getElementById('live-match-card'),
        liveMatchPlaceholder: document.getElementById('live-match-placeholder'),
        finishedList: document.getElementById('finished-list'),
        finishedFilters: document.getElementById('finished-filters'),
        adminForm: document.getElementById('admin-form'),
        errorBanner: document.getElementById('error-banner'),
        retryFetchBtn: document.getElementById('retry-fetch'),
    };

    // --- INITIALIZATION ---
    async function init() {
        setupEventListeners();
        loadState();
        try {
            await fetchData();
            dom.errorBanner.hidden = true;
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            dom.errorBanner.hidden = false;
            return;
        }
        
        if (!state.schedule || state.schedule.length === 0) generateSchedule();
        if (!state.knockout || state.knockout.length === 0) generateKnockout();

        renderAll();
        showTab('classement');
    }

    // --- DATA & STATE MANAGEMENT ---
    function loadState() {
        try {
            const savedState = localStorage.getItem(API.STORAGE_KEY);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                state.schedule = parsed.schedule || [];
                state.knockout = parsed.knockout || [];
                state.results = parsed.results || {};
                state.settings = { ...state.settings, ...parsed.settings };
            }
        } catch (e) {
            console.error("Could not load state from localStorage", e);
        }
        updateAdminForm();
    }

    function saveState() {
        const stateToSave = { 
            schedule: state.schedule,
            knockout: state.knockout,
            results: state.results,
            settings: state.settings,
        };
        localStorage.setItem(API.STORAGE_KEY, JSON.stringify(stateToSave));
    }

    async function fetchData() {
        const response = await fetch(API.DATA_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        state.teams = data.teams;
    }
    
    // --- EVENT LISTENERS & NAVIGATION ---
    function setupEventListeners() {
        dom.mainNav.addEventListener('click', e => handleNavigation(e, 'tab', showTab));
        dom.classementSubNav.addEventListener('click', e => handleNavigation(e, 'sub-tab', showSubTab));
        dom.finishedFilters.addEventListener('click', e => handleFinishedFilter(e));
        document.getElementById('save-settings').addEventListener('click', saveSettings);
        document.getElementById('generate-schedule').addEventListener('click', () => { generateSchedule(true); renderAll(); });
        document.getElementById('generate-knockout').addEventListener('click', () => { generateKnockout(true); renderAll(); });
        document.getElementById('reset-app').addEventListener('click', resetApplication);
        dom.retryFetchBtn.addEventListener('click', init);
        document.body.addEventListener('click', handleMatchSelection);
    }
    
    function handleNavigation(e, dataAttr, showFn) {
        const pill = e.target.closest('.pill');
        if (pill && pill.dataset[dataAttr]) {
            const parentNav = pill.closest('nav');
            parentNav.querySelector('.active').classList.remove('active');
            pill.classList.add('active');
            showFn(pill.dataset[dataAttr]);
        }
    }

    function showTab(tabId) { dom.tabs.forEach(tab => tab.hidden = tab.id !== `tab-${tabId}`); }
    function showSubTab(subTabId) { dom.subTabs.forEach(tab => tab.hidden = tab.id !== subTabId); }
    
    function handleFinishedFilter(e) {
        const pill = e.target.closest('.pill');
        if (pill && pill.dataset.filter) {
            dom.finishedFilters.querySelector('.active')?.classList.remove('active');
            pill.classList.add('active');
            renderFinishedMatches(pill.dataset.filter);
        }
    }
    
    function handleMatchSelection(e) {
        const matchElement = e.target.closest('[data-match-id]');
        if (matchElement) {
            const matchId = matchElement.dataset.matchId;
            if (matchId && !state.results[matchId]) {
                startLiveMatch(matchId);
                showTab('live');
                const livePill = document.querySelector('.main-nav .pill[data-tab="live"]');
                if (livePill) {
                    document.querySelector('.main-nav .active').classList.remove('active');
                    livePill.classList.add('active');
                }
            }
        }
    }

    // --- RENDERING ---
    function renderAll() {
        renderStandings();
        renderScorers();
        renderKnockout();
        renderFinishedFilters();
        renderFinishedMatches();
    }

    function renderStandings() {
        const stats = calculateStandings();
        const sortedTeams = Object.values(stats).sort((a, b) => 
            b.pts - a.pts || b.diff - a.diff || b.bp - a.bp || a.name.localeCompare(b.name)
        );

        dom.standingsBody.innerHTML = sortedTeams.map((s, index) => `
            <tr data-match-id="${findNextMatchForTeam(s.id)?.id || ''}">
                <td>${index + 1}</td>
                <td><div class="team-cell"><img src="${s.logo}" alt=""><span>${s.name}</span></div></td>
                <td>${s.j}</td><td>${s.g}</td><td>${s.n}</td><td>${s.p}</td>
                <td>${s.bp}</td><td>${s.bc}</td><td>${s.diff}</td>
                <td>${s.bo}</td><td>${s.bd}</td><td class="col-pts">${s.pts}</td>
            </tr>
        `).join('');
    }

    function renderScorers() {
        const scorerStats = {};
        Object.values(state.results).forEach(result => {
            [...(result.aLog || []), ...(result.bLog || [])].forEach(goal => {
                if (!scorerStats[goal.name]) {
                    const playerTeam = state.teams.find(t => t.players.includes(goal.name));
                    scorerStats[goal.name] = { name: goal.name, goals: 0, team: playerTeam };
                }
                scorerStats[goal.name].goals++;
            });
        });
        const sortedScorers = Object.values(scorerStats).sort((a, b) => b.goals - a.goals);
        dom.scorersBody.innerHTML = sortedScorers.map((s, i) => `
            <tr>
                <td>${i + 1}</td>
                <td class="col-player">${s.name}</td>
                <td class="col-club">${s.team ? `<img class="club-logo" src="${s.team.logo}" alt="">` : ''}</td>
                <td class="col-goals">${s.goals}</td>
            </tr>`).join('');
    }
    
    function renderKnockout() {
        const standings = Object.values(calculateStandings()).sort((a, b) => 
            b.pts - a.pts || b.diff - a.diff || b.bp - a.bp || a.name.localeCompare(b.name)
        );
        
        const getTeamForMatch = (match, side) => {
            const seedKey = `${side}Seed`;
            const idKey = `${side}Id`;
            if (match[seedKey] && standings[match[seedKey] - 1]) return standings[match[seedKey] - 1];
            if (String(match[idKey]).startsWith('winner_')) {
                const sourceId = match[idKey].replace('winner_', '');
                const sourceResult = state.results[sourceId];
                return sourceResult ? getTeam(sourceResult.homeGoals > sourceResult.awayGoals ? sourceResult.homeId : sourceResult.awayId) : null;
            }
            return getTeam(match[idKey]);
        };
        
        const stages = { barrage: [], demi: [], finale: [] };
        state.knockout.forEach(m => stages[m.type]?.push(m));

        let html = '';
        ['barrage', 'demi', 'finale'].forEach(type => {
            if (stages[type].length > 0) {
                const title = { barrage: 'Barrages', demi: 'Demi-finales', finale: 'Finale' }[type];
                html += `<div class="knockout-round"><h3 class="round-title">${title}</h3>`;
                stages[type].forEach(match => {
                    const home = getTeamForMatch(match, 'home');
                    const away = getTeamForMatch(match, 'away');
                    const result = state.results[match.id];
                    let homeWinner = result && result.homeGoals > result.awayGoals;
                    let awayWinner = result && result.awayGoals > result.homeGoals;
                    
                    html += `
                    <div class="knockout-match" data-match-id="${match.id}">
                        <div class="match-team ${homeWinner ? 'winner-team': ''}">
                            <div class="team-info">${home ? `<img src="${home.logo}"><span>${home.name}</span>` : '<i>À déterminer</i>'}</div>
                            <span class="team-score">${result ? result.homeGoals : '-'}</span>
                        </div>
                        <div class="match-team ${awayWinner ? 'winner-team' : ''}">
                            <div class="team-info">${away ? `<img src="${away.logo}"><span>${away.name}</span>` : '<i>À déterminer</i>'}</div>
                            <span class="team-score">${result ? result.awayGoals : '-'}</span>
                        </div>
                    </div>`;
                });
                html += `</div>`;
            }
        });
        dom.knockoutContainer.innerHTML = html;
        const winnerMatches = dom.knockoutContainer.querySelectorAll('.winner-team');
        winnerMatches.forEach(el => el.closest('.knockout-match').classList.add('winner'));
    }

    function renderLiveMatchCard() {
        const match = findMatchById(state.liveMatch.id);
        if (!match) { dom.liveMatchCard.hidden = true; dom.liveMatchPlaceholder.hidden = false; return; }

        const homeTeam = getTeam(match.homeId);
        const awayTeam = getTeam(match.awayId);
        
        const createPlayerPad = (team, side) => {
            const pads = team.players.map(p => 
                (p && p.toLowerCase() !== 'nul') ? `<button class="player-btn" data-player="${p}">${p}</button>` : `<div></div>`
            ).join('');
            return `<div class="player-pads" data-team="${side}">${pads.slice(0,3)}<button class="action-btn minus-btn" data-action="remove-goal" data-team="${side}">-</button>${pads.slice(3,5)}<button class="action-btn forfeit-btn" data-action="forfeit" data-team="${side}">F</button>${pads.slice(5,6)}</div>`;
        }

        const createScorersLog = log => log.map(g => `<span class="scorer-entry"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm.88,4.38a1.5,1.5,0,1,1-1.76,0L12,2.32Z" transform="translate(-0.5 -0.5) scale(1.04)"/></svg>${g.name} ${g.minute}'</span>`).join('');
        const matchLabel = match.type === 'poule' ? `Journée ${match.round}` : { barrage: 'Barrage', demi: 'Demi-finale', finale: 'Finale' }[match.type];

        dom.liveMatchCard.innerHTML = `
            <div class="live-team-panel team-a">
                <div class="team-bar"><div class="team-identity"><img src="${homeTeam.logo}" class="team-bar-logo"><span class="team-bar-name">${homeTeam.name}</span></div><div class="scorers-log">${createScorersLog(state.liveMatch.homeLog)}</div></div>
                ${createPlayerPad(homeTeam, 'home')}
            </div>
            <div class="live-center-panel">
                <div class="live-match-info">${matchLabel}</div>
                <div class="live-status-pill">${state.liveMatch.status.toUpperCase()}</div>
                <div class="live-score">${state.liveMatch.homeScore} - ${state.liveMatch.awayScore}</div>
                <div class="live-timer">${formatTime(state.liveMatch.remainingTime)}</div>
                <div class="live-controls">
                    <div class="main-controls">
                        <button data-action="play" aria-label="Play">▶</button>
                        <button data-action="pause" aria-label="Pause">⏸</button>
                        <button data-action="reset" aria-label="Reset">↻</button>
                    </div>
                    <button class="finish-btn" data-action="finish">Match terminé</button>
                </div>
            </div>
            <div class="live-team-panel team-b">
                <div class="team-bar"><div class="team-identity"><span class="team-bar-name">${awayTeam.name}</span><img src="${awayTeam.logo}" class="team-bar-logo"></div><div class="scorers-log">${createScorersLog(state.liveMatch.awayLog)}</div></div>
                ${createPlayerPad(awayTeam, 'away')}
            </div>`;
        
        dom.liveMatchCard.hidden = false;
        dom.liveMatchPlaceholder.hidden = true;
        dom.liveMatchCard.removeEventListener('click', handleLiveMatchActions);
        dom.liveMatchCard.addEventListener('click', handleLiveMatchActions);
    }
    
    function renderFinishedMatches(filter = 'all') {
        const finished = Object.values(state.results).reverse();
        const filtered = finished.filter(m => {
            if (filter === 'all') return true;
            if (filter.startsWith('J')) return m.type === 'poule' && m.round == filter.slice(1);
            return m.type === filter;
        });
        dom.finishedList.innerHTML = filtered.map(m => {
            const home = getTeam(m.homeId), away = getTeam(m.awayId);
            const scorerLog = log => log.map(g => `${g.name} ${g.minute}'`).join(', ');
            return `
            <div class="finished-card">
                <div class="finished-card-main">
                    <div class="finished-card-team team-a"><img src="${home.logo}"><span>${home.name}</span></div>
                    <div class="finished-card-score">${m.homeGoals} - ${m.awayGoals}</div>
                    <div class="finished-card-team team-b"><span>${away.name}</span><img src="${away.logo}"></div>
                </div>
                <div class="finished-card-scorers"><span>${scorerLog(m.aLog)}</span><span>${scorerLog(m.bLog)}</span></div>
            </div>`;
        }).join('');
    }
    
    function renderFinishedFilters() {
        const rounds = new Set(state.schedule.map(m => m.round));
        const stages = new Set(state.knockout.map(m => m.type));
        let filtersHTML = '<button class="pill active" data-filter="all">Tous</button>';
        [...rounds].sort((a,b)=>a-b).forEach(r => filtersHTML += `<button class="pill" data-filter="J${r}">J${r}</button>`);
        ['barrage', 'demi', 'finale'].forEach(s => {
            if(stages.has(s)) filtersHTML += `<button class="pill" data-filter="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</button>`
        });
        dom.finishedFilters.innerHTML = filtersHTML;
    }

    // --- LOGIC ---
    function calculateStandings() {
        const stats = {};
        state.teams.forEach(t => {
            stats[t.id] = { id: t.id, name: t.name, logo: t.logo, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, diff: 0, bo: 0, bd: 0, pts: 0 };
        });
        Object.values(state.results).filter(r => r.type === 'poule').forEach(m => {
            const home = stats[m.homeId], away = stats[m.awayId];
            if (!home || !away) return;
            home.j++; away.j++;
            home.bp += m.homeGoals; away.bp += m.awayGoals;
            home.bc += m.awayGoals; away.bc += m.homeGoals;
            const diff = m.homeGoals - m.awayGoals;

            if (diff > 0) {
                home.g++; away.p++;
                home.pts += state.settings.points.win;
                away.pts += state.settings.points.loss;
                if (state.settings.bonus.enabled) {
                    if (diff >= state.settings.bonus.boThreshold) home.bo++;
                    if (Math.abs(diff) <= state.settings.bonus.bdThreshold) away.bd++;
                }
            } else if (diff < 0) {
                away.g++; home.p++;
                away.pts += state.settings.points.win;
                home.pts += state.settings.points.loss;
                 if (state.settings.bonus.enabled) {
                    if (Math.abs(diff) >= state.settings.bonus.boThreshold) away.bo++;
                    if (Math.abs(diff) <= state.settings.bonus.bdThreshold) home.bd++;
                }
            } else {
                home.n++; away.n++;
                home.pts += state.settings.points.draw;
                away.pts += state.settings.points.draw;
            }
        });
        Object.values(stats).forEach(s => s.diff = s.bp - s.bc);
        return stats;
    }

    function generateSchedule(force = false) {
        if (state.schedule.length > 0 && !force) return;
        const teams = [...state.teams];
        if (teams.length < 2) return;
        if (teams.length % 2 !== 0) teams.push({ id: 'bye' });

        const schedule = [];
        const numRounds = teams.length - 1;
        for (let round = 0; round < numRounds; round++) {
            for (let i = 0; i < teams.length / 2; i++) {
                const home = teams[i], away = teams[teams.length - 1 - i];
                if (home.id !== 'bye' && away.id !== 'bye') {
                    schedule.push({ id: `p_${round+1}_${i+1}`, round: round + 1, type: 'poule', homeId: home.id, awayId: away.id });
                }
            }
            teams.splice(1, 0, teams.pop());
        }
        state.schedule = schedule;
        if (force) { state.results = {}; alert("Calendrier et résultats réinitialisés."); }
        saveState();
    }
    
    function generateKnockout(force = false) {
        if (state.knockout.length > 0 && !force) return;
        const numTeams = state.teams.length;
        state.knockout = [];
        if (numTeams >= 6) {
            state.knockout.push({id: 'k_b1', type: 'barrage', homeSeed: 3, awaySeed: 6});
            state.knockout.push({id: 'k_b2', type: 'barrage', homeSeed: 4, awaySeed: 5});
            state.knockout.push({id: 'k_s1', type: 'demi', homeSeed: 1, awayId: 'winner_k_b2'});
            state.knockout.push({id: 'k_s2', type: 'demi', homeSeed: 2, awayId: 'winner_k_b1'});
            state.knockout.push({id: 'k_f1', type: 'finale', homeId: 'winner_k_s1', awayId: 'winner_k_s2'});
        } else if (numTeams >= 4) {
             state.knockout.push({id: 'k_s1', type: 'demi', homeSeed: 1, awaySeed: 4});
             state.knockout.push({id: 'k_s2', type: 'demi', homeSeed: 2, awaySeed: 3});
             state.knockout.push({id: 'k_f1', type: 'finale', homeId: 'winner_k_s1', awayId: 'winner_k_s2'});
        } else if (numTeams >= 2) {
            state.knockout.push({id: 'k_f1', type: 'finale', homeSeed: 1, awaySeed: 2});
        }
        if (force) alert("Phases finales regénérées.");
        saveState();
    }

    // --- LIVE MATCH ACTIONS ---
    function startLiveMatch(matchId) {
        if (state.liveMatch.timerInterval) clearInterval(state.liveMatch.timerInterval);
        state.liveMatch = {
            id: matchId, timerInterval: null, remainingTime: state.settings.matchDuration * 60,
            homeScore: 0, awayScore: 0, homeLog: [], awayLog: [], status: 'upcoming'
        };
        renderLiveMatchCard();
    }

    function handleLiveMatchActions(e) {
        const target = e.target.closest('button[data-action], button[data-player]');
        if (!target) return;
        const { action, player, team } = target.dataset;
        if (player) addGoal(team, player);
        else if (action) {
            const actions = {
                play: () => { if (state.liveMatch.status !== 'live') { state.liveMatch.status = 'live'; state.liveMatch.timerInterval = setInterval(timerTick, 1000); }},
                pause: () => { if (state.liveMatch.status === 'live') { state.liveMatch.status = 'paused'; clearInterval(state.liveMatch.timerInterval); }},
                reset: () => { clearInterval(state.liveMatch.timerInterval); startLiveMatch(state.liveMatch.id); },
                finish: finishMatch,
                'remove-goal': () => removeLastGoal(team),
                forfeit: () => forfeitMatch(team)
            };
            actions[action]?.();
            renderLiveMatchCard();
        }
    }

    function timerTick() {
        state.liveMatch.remainingTime = Math.max(0, state.liveMatch.remainingTime - 1);
        document.querySelector('.live-timer').textContent = formatTime(state.liveMatch.remainingTime);
        if (state.liveMatch.remainingTime === 0) finishMatch();
    }
    
    function addGoal(side, player) {
        const elapsed = state.settings.matchDuration * 60 - state.liveMatch.remainingTime;
        const minute = Math.floor(elapsed / 60);
        const log = { name: player, minute };
        if (side === 'home') { state.liveMatch.homeScore++; state.liveMatch.homeLog.push(log); } 
        else { state.liveMatch.awayScore++; state.liveMatch.awayLog.push(log); }
        renderLiveMatchCard();
    }
    
    function removeLastGoal(side) {
        if (side === 'home' && state.liveMatch.homeScore > 0) { state.liveMatch.homeScore--; state.liveMatch.homeLog.pop(); } 
        else if (side === 'away' && state.liveMatch.awayScore > 0) { state.liveMatch.awayScore--; state.liveMatch.awayLog.pop(); }
        renderLiveMatchCard();
    }

    function finishMatch(forfeitData = null) {
        clearInterval(state.liveMatch.timerInterval);
        state.liveMatch.status = 'finished';
        const match = findMatchById(state.liveMatch.id);
        state.results[match.id] = {
            id: match.id, type: match.type, round: match.round,
            homeId: match.homeId, awayId: match.awayId,
            homeGoals: forfeitData ? forfeitData.homeScore : state.liveMatch.homeScore,
            awayGoals: forfeitData ? forfeitData.awayScore : state.liveMatch.awayScore,
            aLog: state.liveMatch.homeLog, bLog: state.liveMatch.awayLog,
            forfeit: forfeitData ? forfeitData.forfeitingTeam : null
        };
        state.liveMatch.id = null;
        saveState();
        renderAll();
        showTab('finished');
        handleNavigation({ target: document.querySelector('.main-nav .pill[data-tab="finished"]') }, 'tab', showTab);
    }
    
    function forfeitMatch(side) {
        finishMatch({
            forfeitingTeam: side,
            homeScore: side === 'home' ? 0 : state.settings.forfeitScore,
            awayScore: side === 'away' ? 0 : state.settings.forfeitScore,
        });
    }

    // --- ADMIN ---
    function saveSettings() {
        state.settings.points = {
            win: parseInt(document.getElementById('points-win').value),
            draw: parseInt(document.getElementById('points-draw').value),
            loss: parseInt(document.getElementById('points-loss').value),
        };
        state.settings.bonus = {
            enabled: document.getElementById('bonus-enabled').value === 'true',
            boThreshold: parseInt(document.getElementById('bo-threshold').value),
            bdThreshold: parseInt(document.getElementById('bd-threshold').value),
        };
        state.settings.matchDuration = parseInt(document.getElementById('match-duration').value);
        state.settings.forfeitScore = parseInt(document.getElementById('forfeit-score').value);
        saveState();
        renderAll();
        alert('Règles sauvegardées !');
    }
    
    function updateAdminForm() {
        document.getElementById('points-win').value = state.settings.points.win;
        document.getElementById('points-draw').value = state.settings.points.draw;
        document.getElementById('points-loss').value = state.settings.points.loss;
        document.getElementById('bonus-enabled').value = state.settings.bonus.enabled;
        document.getElementById('bo-threshold').value = state.settings.bonus.boThreshold;
        document.getElementById('bd-threshold').value = state.settings.bonus.bdThreshold;
        document.getElementById('match-duration').value = state.settings.matchDuration;
        document.getElementById('forfeit-score').value = state.settings.forfeitScore;
    }
    
    function resetApplication() {
        if (confirm("Réinitialiser tout le tournoi ? Cette action est irréversible.")) {
            localStorage.removeItem(API.STORAGE_KEY);
            window.location.reload();
        }
    }

    // --- UTILS ---
    const getTeam = id => state.teams.find(t => t.id === id);
    const findMatchById = id => [...state.schedule, ...state.knockout].find(m => m.id === id);
    const findNextMatchForTeam = id => state.schedule.find(m => (m.homeId === id || m.awayId === id) && !state.results[m.id]);
    const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

    init();
});
