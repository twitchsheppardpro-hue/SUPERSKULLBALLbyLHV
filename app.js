// filename:app.js
document.addEventListener('DOMContentLoaded', () => {
    const API = {
        DATA_URL: './data/team.json',
        STORAGE_KEY: 'skullball:v13',
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
            status: 'upcoming' // upcoming, live, paused, finished
        },
    };

    const dom = {
        mainNav: document.querySelector('.main-nav'),
        tabs: document.querySelectorAll('.tab-content'),
        classementSubNav: document.querySelector('#tab-classement .sub-nav'),
        subTabs: document.querySelectorAll('.sub-tab-content'),
        standingsBody: document.getElementById('standings-body'),
        scorersBody: document.getElementById('scorers-body'),
        knockoutContainer: document.getElementById('knockout-grid-container'),
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
        
        if (!state.schedule || state.schedule.length === 0) {
            generateSchedule();
        }
        if (!state.knockout || state.knockout.length === 0) {
            generateKnockout();
        }

        renderAll();
        // Activate default tab
        showTab('classement');
    }

    // --- DATA & STATE MANAGEMENT ---
    function loadState() {
        const savedState = localStorage.getItem(API.STORAGE_KEY);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            // Merge saved state, but don't overwrite teams array which comes from JSON
            state.schedule = parsed.schedule || [];
            state.knockout = parsed.knockout || [];
            state.results = parsed.results || {};
            state.settings = parsed.settings || state.settings;
        }
        updateAdminForm();
    }

    function saveState() {
        const stateToSave = { ...state, teams: undefined, liveMatch: undefined };
        localStorage.setItem(API.STORAGE_KEY, JSON.stringify(stateToSave));
    }

    async function fetchData() {
        const response = await fetch(API.DATA_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        state.teams = data.teams;
    }
    
    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        dom.mainNav.addEventListener('click', handleTabNavigation);
        dom.classementSubNav.addEventListener('click', handleSubTabNavigation);
        dom.adminForm.addEventListener('change', () => saveSettings());
        document.getElementById('save-settings').addEventListener('click', saveSettings);
        document.getElementById('generate-schedule').addEventListener('click', () => { generateSchedule(); renderAll(); });
        document.getElementById('generate-knockout').addEventListener('click', () => { generateKnockout(); renderAll(); });
        document.getElementById('reset-app').addEventListener('click', resetApplication);
        dom.finishedFilters.addEventListener('click', handleFinishedFilter);
        dom.retryFetchBtn.addEventListener('click', init);
        document.getElementById('standings-body').addEventListener('click', handleMatchSelection);
    }
    
    // --- NAVIGATION ---
    function handleTabNavigation(e) {
        const pill = e.target.closest('.pill');
        if (pill && pill.dataset.tab) {
            showTab(pill.dataset.tab);
        }
    }

    function showTab(tabId) {
        dom.tabs.forEach(tab => tab.hidden = tab.id !== `tab-${tabId}`);
        document.querySelectorAll('.main-nav .pill').forEach(p => {
            p.classList.toggle('active', p.dataset.tab === tabId);
        });
        if(tabId === 'live' && !state.liveMatch.id) {
            dom.liveMatchCard.hidden = true;
            dom.liveMatchPlaceholder.hidden = false;
        }
    }

    function handleSubTabNavigation(e) {
        const pill = e.target.closest('.pill');
        if (pill && pill.dataset.subTab) {
            showSubTab(pill.dataset.subTab);
        }
    }

    function showSubTab(subTabId) {
        dom.subTabs.forEach(tab => tab.hidden = tab.id !== subTabId);
        document.querySelectorAll('#tab-classement .sub-nav .pill').forEach(p => {
            p.classList.toggle('active', p.dataset.subTab === subTabId);
        });
    }

    function handleFinishedFilter(e) {
        const pill = e.target.closest('.pill');
        if (pill && pill.dataset.filter) {
            document.querySelectorAll('#finished-filters .pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderFinishedMatches(pill.dataset.filter);
        }
    }
    
    function handleMatchSelection(e) {
        const matchRow = e.target.closest('[data-match-id]');
        if(matchRow) {
            const matchId = matchRow.dataset.matchId;
            const isFinished = !!state.results[matchId];
            if(!isFinished) {
                startLiveMatch(matchId);
                showTab('live');
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
        const sortedTeams = Object.values(stats).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.diff !== a.diff) return b.diff - a.diff;
            if (b.bp !== a.bp) return b.bp - a.bp;
            return a.name.localeCompare(b.name);
        });

        dom.standingsBody.innerHTML = sortedTeams.map((s, index) => {
            const match = findNextMatchForTeam(s.id);
            return `
                <tr data-match-id="${match ? match.id : ''}" ${!match || state.results[match.id] ? '' : 'style="cursor: pointer;"'}>
                    <td>${index + 1}</td>
                    <td>
                        <div class="team-cell">
                            <img src="${s.logo}" alt="${s.name} logo">
                            <span>${s.name}</span>
                        </div>
                    </td>
                    <td>${s.j}</td>
                    <td>${s.g}</td>
                    <td>${s.n}</td>
                    <td>${s.p}</td>
                    <td>${s.bp}</td>
                    <td>${s.bc}</td>
                    <td>${s.diff}</td>
                    <td>${s.bo}</td>
                    <td>${s.bd}</td>
                    <td class="pts-cell">${s.pts}</td>
                </tr>
            `;
        }).join('');
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
                <td>${s.name}</td>
                <td class="club-cell">
                    ${s.team ? `<img src="${s.team.logo}" class="club-logo" alt="${s.team.name}">` : ''}
                </td>
                <td>${s.goals}</td>
            </tr>
        `).join('');
    }
    
    function renderKnockout() {
        const standings = calculateStandings(true); // Get full standings for seeding
        const knockoutHtml = {};
        state.knockout.forEach(stage => {
            if (!knockoutHtml[stage.type]) {
                const title = { 'barrage': 'Barrages', 'demi': 'Demi-finales', 'finale': 'Finale' }[stage.type];
                knockoutHtml[stage.type] = `<div class="knockout-round"><h3 class="round-title">${title}</h3>`;
            }
            
            const home = getTeam(stage.homeSeed ? standings[stage.homeSeed - 1]?.id : stage.homeId);
            const away = getTeam(stage.awaySeed ? standings[stage.awaySeed - 1]?.id : stage.awayId);
            const result = state.results[stage.id];
            
            let winnerClass = '';
            if (result) {
                if (result.homeGoals > result.awayGoals) winnerClass = 'winner';
            }

            knockoutHtml[stage.type] += `
                <div class="knockout-match ${winnerClass}" data-match-id="${stage.id}" ${!result ? 'style="cursor:pointer;"' : ''}>
                    <div class="match-team">
                        <div class="team-info">
                            ${home ? `<img src="${home.logo}" alt=""><span>${home.name}</span>` : '<i>À déterminer</i>'}
                        </div>
                        <span class="team-score">${result ? result.homeGoals : '-'}</span>
                    </div>
                    <div class="match-team">
                        <div class="team-info">
                            ${away ? `<img src="${away.logo}" alt=""><span>${away.name}</span>` : '<i>À déterminer</i>'}
                        </div>
                        <span class="team-score">${result ? result.awayGoals : '-'}</span>
                    </div>
                </div>
            `;
        });
        Object.keys(knockoutHtml).forEach(key => knockoutHtml[key] += '</div>');
        dom.knockoutContainer.innerHTML = Object.values(knockoutHtml).join('');
        dom.knockoutContainer.removeEventListener('click', handleMatchSelection);
        dom.knockoutContainer.addEventListener('click', handleMatchSelection);
    }

    function renderLiveMatchCard() {
        const match = findMatchById(state.liveMatch.id);
        if (!match) {
            dom.liveMatchCard.hidden = true;
            dom.liveMatchPlaceholder.hidden = false;
            return;
        }

        const homeTeam = getTeam(match.homeId);
        const awayTeam = getTeam(match.awayId);

        const createPlayerButtons = (players) => 
            players.map(p => (p && p.toLowerCase() !== 'nul') ? `<button class="player-btn" data-player="${p}">${p}</button>` : `<div></div>`).join('');

        const createScorersLog = (log) => log.map(g => `<div class="scorer-entry">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15-3-3 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z"></path></svg>
            ${g.name} ${g.minute}'
        </div>`).join('');
        
        const matchLabel = match.type === 'poule' ? `Journée ${match.round}` : { 'barrage': 'Barrage', 'demi': 'Demi-finale', 'finale': 'Finale' }[match.type];

        dom.liveMatchCard.innerHTML = `
            <div class="live-team-panel team-a">
                <div class="team-bar" style="background-color: ${homeTeam.color || '#333'}">
                    <div class="team-identity">
                        <img src="${homeTeam.logo}" alt="${homeTeam.name}" class="team-bar-logo">
                        <span class="team-bar-name">${homeTeam.name}</span>
                    </div>
                    <div class="scorers-log">${createScorersLog(state.liveMatch.homeLog)}</div>
                </div>
                <div class="player-pads" data-team="home">
                    ${createPlayerButtons(homeTeam.players.slice(0, 3))}
                    <button class="action-btn minus-btn" data-action="remove-goal" data-team="home">-</button>
                    ${createPlayerButtons(homeTeam.players.slice(3, 5))}
                    <button class="action-btn forfeit-btn" data-action="forfeit" data-team="home">F</button>
                     ${createPlayerButtons(homeTeam.players.slice(5, 6))}
                </div>
            </div>

            <div class="live-center-panel">
                <div class="live-match-info">${matchLabel}</div>
                <div class="live-status-pill">${state.liveMatch.status.toUpperCase()}</div>
                <div class="live-score">${state.liveMatch.homeScore} - ${state.liveMatch.awayScore}</div>
                <div class="live-timer">${formatTime(state.liveMatch.remainingTime)}</div>
                <div class="live-controls">
                    <div class="main-controls">
                        <button data-action="play">▶</button>
                        <button data-action="pause">⏸</button>
                        <button data-action="reset">↻</button>
                    </div>
                    <button class="finish-btn" data-action="finish">Match terminé</button>
                </div>
            </div>

            <div class="live-team-panel team-b">
                <div class="team-bar" style="background-color: ${awayTeam.color || '#333'}">
                    <div class="team-identity">
                        <img src="${awayTeam.logo}" alt="${awayTeam.name}" class="team-bar-logo">
                        <span class="team-bar-name">${awayTeam.name}</span>
                    </div>
                    <div class="scorers-log">${createScorersLog(state.liveMatch.awayLog)}</div>
                </div>
                <div class="player-pads" data-team="away">
                    ${createPlayerButtons(awayTeam.players.slice(0, 3))}
                    <button class="action-btn minus-btn" data-action="remove-goal" data-team="away">-</button>
                    ${createPlayerButtons(awayTeam.players.slice(3, 5))}
                    <button class="action-btn forfeit-btn" data-action="forfeit" data-team="away">F</button>
                    ${createPlayerButtons(awayTeam.players.slice(5, 6))}
                </div>
            </div>
        `;
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
            const home = getTeam(m.homeId);
            const away = getTeam(m.awayId);
            const scorerLog = (log) => log.map(g => `${g.name} ${g.minute}'`).join(', ');

            return `
                <div class="finished-card">
                    <div class="finished-card-team team-a">
                        <img src="${home.logo}" alt="">
                        <span>${home.name}</span>
                    </div>
                    <div class="finished-card-score">${m.homeGoals} - ${m.awayGoals}</div>
                    <div class="finished-card-team team-b">
                        <img src="${away.logo}" alt="">
                        <span>${away.name}</span>
                    </div>
                    <div class="finished-card-scorers">
                        <span>${scorerLog(m.aLog)}</span>
                        <span>${scorerLog(m.bLog)}</span>
                    </div>
                </div>`;
        }).join('');
    }
    
    function renderFinishedFilters() {
        const rounds = new Set(state.schedule.map(m => m.round));
        const stages = new Set(state.knockout.map(m => m.type));
        
        let filtersHTML = '<button class="pill active" data-filter="all">Tous</button>';
        [...rounds].sort((a,b) => a-b).forEach(r => filtersHTML += `<button class="pill" data-filter="J${r}">J${r}</button>`);
        ['barrage', 'demi', 'finale'].forEach(s => {
            if(stages.has(s)) filtersHTML += `<button class="pill" data-filter="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</button>`
        });
        
        dom.finishedFilters.innerHTML = filtersHTML;
    }


    // --- LOGIC ---
    function calculateStandings(includeKnockout = false) {
        const stats = {};
        state.teams.forEach(t => {
            stats[t.id] = { id: t.id, name: t.name, logo: t.logo, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, diff: 0, bo: 0, bd: 0, pts: 0 };
        });

        const matchesToConsider = Object.values(state.results)
            .filter(r => includeKnockout || r.type === 'poule');

        matchesToConsider.forEach(m => {
            const home = stats[m.homeId];
            const away = stats[m.awayId];
            if (!home || !away) return;
            
            home.j++; away.j++;
            home.bp += m.homeGoals; away.bp += m.awayGoals;
            home.bc += m.awayGoals; away.bc += m.homeGoals;

            if (m.homeGoals > m.awayGoals) {
                home.g++; away.p++;
                home.pts += state.settings.points.win;
                away.pts += state.settings.points.loss;
                if (state.settings.bonus.enabled) {
                    if (m.homeGoals - m.awayGoals >= state.settings.bonus.boThreshold) home.bo++;
                    if (m.awayGoals - m.homeGoals <= state.settings.bonus.bdThreshold) away.bd++;
                }
            } else if (m.awayGoals > m.homeGoals) {
                away.g++; home.p++;
                away.pts += state.settings.points.win;
                home.pts += state.settings.points.loss;
                 if (state.settings.bonus.enabled) {
                    if (m.awayGoals - m.homeGoals >= state.settings.bonus.boThreshold) away.bo++;
                    if (m.homeGoals - m.awayGoals <= state.settings.bonus.bdThreshold) home.bd++;
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

    function generateSchedule() {
        const teams = [...state.teams];
        if (teams.length < 2) return;
        if (teams.length % 2 !== 0) {
            teams.push({ id: 'bye', name: 'BYE' });
        }

        const schedule = [];
        const numRounds = teams.length - 1;
        for (let round = 0; round < numRounds; round++) {
            for (let i = 0; i < teams.length / 2; i++) {
                const home = teams[i];
                const away = teams[teams.length - 1 - i];
                if (home.id !== 'bye' && away.id !== 'bye') {
                    schedule.push({
                        id: `p_${round + 1}_${i + 1}`,
                        round: round + 1,
                        type: 'poule',
                        homeId: home.id,
                        awayId: away.id
                    });
                }
            }
            // Rotate teams
            teams.splice(1, 0, teams.pop());
        }
        state.schedule = schedule;
        saveState();
    }
    
    function generateKnockout() {
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
        
        // Resolve winner dependencies
        state.knockout.forEach(match => {
            if(String(match.homeId).startsWith('winner_')) {
                const sourceMatchId = match.homeId.replace('winner_','');
                const sourceResult = state.results[sourceMatchId];
                if(sourceResult) {
                    match.homeId = sourceResult.homeGoals > sourceResult.awayGoals ? sourceResult.homeId : sourceResult.awayId;
                } else {
                    match.homeId = null; // not determined yet
                }
            }
             if(String(match.awayId).startsWith('winner_')) {
                const sourceMatchId = match.awayId.replace('winner_','');
                const sourceResult = state.results[sourceMatchId];
                if(sourceResult) {
                    match.awayId = sourceResult.homeGoals > sourceResult.awayGoals ? sourceResult.homeId : sourceResult.awayId;
                } else {
                    match.awayId = null;
                }
            }
        });
        saveState();
    }


    // --- LIVE MATCH ---
    function startLiveMatch(matchId) {
        if (state.liveMatch.timerInterval) clearInterval(state.liveMatch.timerInterval);

        state.liveMatch = {
            id: matchId,
            timerInterval: null,
            remainingTime: state.settings.matchDuration * 60,
            homeScore: 0,
            awayScore: 0,
            homeLog: [],
            awayLog: [],
            status: 'upcoming'
        };
        renderLiveMatchCard();
    }

    function handleLiveMatchActions(e) {
        const target = e.target.closest('button');
        if (!target) return;

        const action = target.dataset.action;
        const teamSide = target.dataset.team;
        const playerName = target.dataset.player;

        if (playerName) {
            addGoal(teamSide, playerName);
        } else if (action) {
            switch (action) {
                case 'play':
                    if (state.liveMatch.status !== 'live') {
                       state.liveMatch.status = 'live';
                       state.liveMatch.timerInterval = setInterval(timerTick, 1000);
                    }
                    break;
                case 'pause':
                    if (state.liveMatch.status === 'live') {
                       state.liveMatch.status = 'paused';
                       clearInterval(state.liveMatch.timerInterval);
                    }
                    break;
                case 'reset':
                    clearInterval(state.liveMatch.timerInterval);
                    startLiveMatch(state.liveMatch.id);
                    break;
                case 'finish':
                    finishMatch();
                    break;
                case 'remove-goal':
                    removeLastGoal(teamSide);
                    break;
                case 'forfeit':
                    forfeitMatch(teamSide);
                    break;
            }
            renderLiveMatchCard();
        }
    }

    function timerTick() {
        state.liveMatch.remainingTime--;
        if (state.liveMatch.remainingTime <= 0) {
            state.liveMatch.remainingTime = 0;
            finishMatch();
        }
        document.querySelector('.live-timer').textContent = formatTime(state.liveMatch.remainingTime);
    }
    
    function addGoal(teamSide, playerName) {
        const totalDuration = state.settings.matchDuration * 60;
        const elapsedSeconds = totalDuration - state.liveMatch.remainingTime;
        const minute = Math.floor(elapsedSeconds / 60) + 1;
        
        if (teamSide === 'home') {
            state.liveMatch.homeScore++;
            state.liveMatch.homeLog.push({ name: playerName, minute });
        } else {
            state.liveMatch.awayScore++;
            state.liveMatch.awayLog.push({ name: playerName, minute });
        }
        renderLiveMatchCard();
    }
    
    function removeLastGoal(teamSide) {
        if (teamSide === 'home' && state.liveMatch.homeScore > 0) {
            state.liveMatch.homeScore--;
            state.liveMatch.homeLog.pop();
        } else if (teamSide === 'away' && state.liveMatch.awayScore > 0) {
            state.liveMatch.awayScore--;
            state.liveMatch.awayLog.pop();
        }
        renderLiveMatchCard();
    }

    function finishMatch(forfeitData = null) {
        clearInterval(state.liveMatch.timerInterval);
        state.liveMatch.status = 'finished';
        
        const match = findMatchById(state.liveMatch.id);
        const result = {
            id: match.id,
            type: match.type,
            round: match.round,
            homeId: match.homeId,
            awayId: match.awayId,
            homeGoals: forfeitData ? forfeitData.homeScore : state.liveMatch.homeScore,
            awayGoals: forfeitData ? forfeitData.awayScore : state.liveMatch.awayScore,
            aLog: state.liveMatch.homeLog,
            bLog: state.liveMatch.awayLog,
            forfeit: forfeitData ? forfeitData.forfeitingTeam : null
        };
        
        state.results[match.id] = result;
        state.liveMatch.id = null; // Clear live match
        
        saveState();
        generateKnockout(); // re-resolve dependencies
        renderAll();
        
        showTab('finished');
    }
    
    function forfeitMatch(forfeitingTeam) {
        const forfeitScore = state.settings.forfeitScore;
        const forfeitData = {
            forfeitingTeam: forfeitingTeam,
            homeScore: forfeitingTeam === 'home' ? 0 : forfeitScore,
            awayScore: forfeitingTeam === 'away' ? 0 : forfeitScore
        };
        finishMatch(forfeitData);
    }

    // --- ADMIN ---
    function saveSettings() {
        state.settings = {
            points: {
                win: parseInt(document.getElementById('points-win').value),
                draw: parseInt(document.getElementById('points-draw').value),
                loss: parseInt(document.getElementById('points-loss').value),
            },
            bonus: {
                enabled: document.getElementById('bonus-enabled').value === 'true',
                boThreshold: parseInt(document.getElementById('bo-threshold').value),
                bdThreshold: parseInt(document.getElementById('bd-threshold').value),
            },
            matchDuration: parseInt(document.getElementById('match-duration').value),
            forfeitScore: parseInt(document.getElementById('forfeit-score').value),
        };
        saveState();
        renderStandings(); // Recalculate with new rules
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
        if (confirm("Êtes-vous sûr de vouloir réinitialiser tout le tournoi ? Cette action est irréversible.")) {
            localStorage.removeItem(API.STORAGE_KEY);
            // Reset state object to defaults without reloading the page
            state.schedule = [];
            state.knockout = [];
            state.results = {};
            // Keep default settings
            generateSchedule();
            generateKnockout();
            renderAll();
            alert("Tournoi réinitialisé.");
        }
    }


    // --- UTILS ---
    function getTeam(id) {
        return state.teams.find(t => t.id === id);
    }
    
    function findMatchById(id) {
        return [...state.schedule, ...state.knockout].find(m => m.id === id);
    }
    
    function findNextMatchForTeam(teamId) {
        return state.schedule.find(m => (m.homeId === teamId || m.awayId === teamId) && !state.results[m.id]);
    }

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }

    // --- START ---
    init();
});
