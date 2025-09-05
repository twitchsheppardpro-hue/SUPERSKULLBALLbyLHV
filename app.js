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
                return sourceResult ? get
