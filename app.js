document.addEventListener('DOMContentLoaded', () => {
    const App = {
        // --- STATE ---
        state: {
            teams: [],
            leagueName: 'Ligue Skullball',
            eventLogo: '',
            matches: [],
            settings: {
                points: { win: 3, draw: 1, loss: 0 },
                bonus: { boPoints: 1, boMargin: 3, bdPoints: 1, bdMargin: 1, enabled: true },
                defaultDuration: 15 * 60,
            },
            ui: {
                activeTab: 'classement',
                activeSubTab: 'tableau',
                finishedFilter: 'all',
            }
        },

        // --- ELEMENTS ---
        elements: {
            header: document.querySelector('header.head'),
            tabs: document.querySelectorAll('main > section'),
            leagueTitle: document.getElementById('leagueTitle'),
            eventLogo: document.getElementById('eventLogo'),
            subnav: document.querySelector('.subnav'),
            subTabViews: document.querySelectorAll('#tab-classement > div[id^="view-"]'),
            standingsTableBody: document.querySelector('#standings-table tbody'),
            standingsTableHeader: document.querySelector('#standings-table thead'),
            scorersTableBody: document.querySelector('#scorers-table tbody'),
            bracketContainer: document.getElementById('bracket-container'),
            liveMatchesList: document.getElementById('live-matches-list'),
            finishedMatchesList: document.getElementById('finished-matches-list'),
            finishedFilter: document.getElementById('finished-filter'),
            ptsWin: document.getElementById('ptsWin'),
            ptsDraw: document.getElementById('ptsDraw'),
            ptsLoss: document.getElementById('ptsLoss'),
            bonusEnabled: document.getElementById('bonusEnabled'),
            boPoints: document.getElementById('boPoints'),
            boMargin: document.getElementById('boMargin'),
            bdPoints: document.getElementById('bdPoints'),
            bdMargin: document.getElementById('bdMargin'),
            defaultDuration: document.getElementById('defaultDuration'),
            saveRulesBtn: document.getElementById('saveRules'),
            genRRBtn: document.getElementById('genRR'),
            homeAwayCheck: document.getElementById('homeAway'),
            genKOBtn: document.getElementById('genKO'),
            toast: document.getElementById('toast'),
        },
        
        timers: {},

        // --- INITIALIZATION ---
        async init() {
            this.loadState();
            await this.fetchData();
            this.setupEventListeners();
            this.renderAll();
        },

        async fetchData() {
            try {
                const response = await fetch('data/team.json');
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                
                this.state.teams = data.teams || [];
                this.state.leagueName = data.leagueName || 'Ligue Skullball';
                this.state.eventLogo = data.eventLogo ? `data/logos/${data.eventLogo}` : '';

                this.elements.leagueTitle.textContent = this.state.leagueName;
                if (this.state.eventLogo) {
                    this.elements.eventLogo.src = this.state.eventLogo;
                    this.elements.eventLogo.style.display = 'block';
                } else {
                    this.elements.eventLogo.style.display = 'none';
                }

            } catch (error) {
                console.error('Failed to fetch team data:', error);
                this.showToast('Erreur: impossible de charger team.json', 'error');
            }
        },

        // --- STATE & STORAGE ---
        saveState() {
            localStorage.setItem('skullball_state', JSON.stringify(this.state));
        },

        loadState() {
            const savedState = localStorage.getItem('skullball_state');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                this.state.settings = parsed.settings || this.state.settings;
                this.state.matches = parsed.matches || [];
                this.state.ui = parsed.ui || this.state.ui;
            }
        },

        // --- EVENT LISTENERS ---
        setupEventListeners() {
            this.elements.header.addEventListener('click', e => {
                const pill = e.target.closest('.pill[data-tab]');
                if (pill) this.setActiveTab(pill.dataset.tab);
            });
            this.elements.subnav.addEventListener('click', e => {
                if (e.target.matches('.pill.sub')) this.setActiveSubTab(e.target.dataset.sub);
            });
            this.elements.saveRulesBtn.addEventListener('click', () => this.saveRules());
            this.elements.genRRBtn.addEventListener('click', () => this.generateRoundRobin());
            this.elements.genKOBtn.addEventListener('click', () => this.generateKnockouts());
        },

        // --- UI & NAVIGATION ---
        setActiveTab(tabId) {
            this.state.ui.activeTab = tabId;
            this.elements.tabs.forEach(tab => tab.hidden = (tab.id !== `tab-${tabId}`));
            this.elements.header.querySelectorAll('.pill[data-tab]').forEach(pill => {
                pill.classList.toggle('active', pill.dataset.tab === tabId);
            });
            this.saveState();
        },

        setActiveSubTab(subTabId) {
            this.state.ui.activeSubTab = subTabId;
            this.elements.subTabViews.forEach(view => view.hidden = (view.id !== `view-${subTabId}`));
            this.elements.subnav.querySelectorAll('.pill.sub').forEach(pill => {
                pill.classList.toggle('active', pill.dataset.sub === subTabId);
            });
            this.saveState();
        },
        
        showToast(message, type = 'success') {
            const el = this.elements.toast;
            el.textContent = message;
            el.className = type === 'error' ? 'error' : '';
            el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 3000);
        },

        // --- RENDER ALL ---
        renderAll() {
            this.renderStandings();
            this.renderScorers();
            this.renderBracket();
            this.renderLiveMatches();
            this.renderFinishedMatches();
            this.updateAdminSettings();
            this.setActiveTab(this.state.ui.activeTab);
            this.setActiveSubTab(this.state.ui.activeSubTab);
        },
        
        // --- UTILS ---
        getTeamById(id) {
            return this.state.teams.find(t => t.id == id) || { name: 'N/A', logo: '', players: [] };
        },

        uid() { return Math.random().toString(36).substr(2, 9); },

        // --- ADMIN & RULES ---
        saveRules() {
            this.state.settings = {
                points: {
                    win: parseInt(this.elements.ptsWin.value),
                    draw: parseInt(this.elements.ptsDraw.value),
                    loss: parseInt(this.elements.ptsLoss.value),
                },
                bonus: {
                    enabled: this.elements.bonusEnabled.value === '1',
                    boPoints: parseInt(this.elements.boPoints.value),
                    boMargin: parseInt(this.elements.boMargin.value),
                    bdPoints: parseInt(this.elements.bdPoints.value),
                    bdMargin: parseInt(this.elements.bdMargin.value),
                },
                defaultDuration: parseInt(this.elements.defaultDuration.value) * 60,
            };
            this.saveState();
            this.renderAll();
            this.showToast('Règles sauvegardées !');
        },

        updateAdminSettings() {
            const { settings } = this.state;
            this.elements.ptsWin.value = settings.points.win;
            this.elements.ptsDraw.value = settings.points.draw;
            this.elements.ptsLoss.value = settings.points.loss;
            this.elements.bonusEnabled.value = settings.bonus.enabled ? '1' : '0';
            this.elements.boPoints.value = settings.bonus.boPoints;
            this.elements.boMargin.value = settings.bonus.boMargin;
            this.elements.bdPoints.value = settings.bonus.bdPoints;
            this.elements.bdMargin.value = settings.bonus.bdMargin;
            this.elements.defaultDuration.value = settings.defaultDuration / 60;
        },

        // --- MATCH GENERATION ---
        generateRoundRobin() {
            const teams = this.state.teams.slice();
            if (teams.length < 2) {
                this.showToast('Il faut au moins 2 équipes.', 'error');
                return;
            }
            this.state.matches = this.state.matches.filter(m => m.stage !== 'league');
            if (teams.length % 2 !== 0) teams.push({ id: null, name: 'BYE' });
            
            const numRounds = teams.length - 1;
            let schedule = [];
            for (let i = 0; i < numRounds; i++) {
                for (let j = 0; j < teams.length / 2; j++) {
                    const team1 = teams[j];
                    const team2 = teams[teams.length - 1 - j];
                    if (team1.id && team2.id) {
                        schedule.push({ a: team1.id, b: team2.id, round: i + 1 });
                    }
                }
                teams.splice(1, 0, teams.pop());
            }
            schedule.forEach(match => this.addMatch(match.a, match.b, match.round, 'league'));
            if (this.elements.homeAwayCheck.checked) {
                schedule.forEach(match => this.addMatch(match.b, match.a, match.round + numRounds, 'league'));
            }

            this.saveState(); this.renderAll();
            this.showToast('Matchs de championnat générés !');
        },

        generateKnockouts() {
            const standings = this.getStandings();
            if (standings.length < 6) { return this.showToast('Il faut au moins 6 équipes classées.', 'error'); }
            this.state.matches = this.state.matches.filter(m => m.stage !== 'ko');
            const [t1, t2, t3, t4, t5, t6] = standings.map(s => s.id);
            this.addMatch(t3, t6, 'Barrage', 'ko');
            this.addMatch(t4, t5, 'Barrage', 'ko');
            this.addMatch(t1, null, 'Demi-finale', 'ko');
            this.addMatch(t2, null, 'Demi-finale', 'ko');
            this.addMatch(null, null, 'Finale', 'ko');
            this.saveState(); this.renderAll();
            this.showToast('Phases finales générées !');
        },

        addMatch(teamA, teamB, round, stage) {
            this.state.matches.push({
                id: this.uid(), a: teamA, b: teamB, ga: 0, gb: 0,
                status: 'upcoming', round, stage,
                duration: this.state.settings.defaultDuration,
                timeLeft: this.state.settings.defaultDuration, scorers: [],
            });
        },

        // --- CORE LOGIC: STANDINGS, SCORERS, BRACKET ---
        getStandings() {
            const stats = {};
            this.state.teams.forEach(t => { stats[t.id] = { id: t.id, J: 0, G: 0, N: 0, P: 0, BP: 0, BC: 0, Diff: 0, BO: 0, BD: 0, Pts: 0 }; });
            const finished = this.state.matches.filter(m => m.stage === 'league' && m.status === 'finished');
            for (const m of finished) {
                const sA = stats[m.a], sB = stats[m.b];
                if (!sA || !sB) continue;
                sA.J++; sB.J++; sA.BP += m.ga; sA.BC += m.gb; sB.BP += m.gb; sB.BC += m.ga;
                const diff = m.ga - m.gb;
                if (diff > 0) { sA.G++; sB.P++; sA.Pts += this.state.settings.points.win; sB.Pts += this.state.settings.points.loss;
                    if (this.state.settings.bonus.enabled) {
                        if (diff >= this.state.settings.bonus.boMargin) { sA.BO++; sA.Pts += this.state.settings.bonus.boPoints; }
                        if (-diff <= this.state.settings.bonus.bdMargin) { sB.BD++; sB.Pts += this.state.settings.bonus.bdPoints; }
                    }
                } else if (diff < 0) { sB.G++; sA.P++; sB.Pts += this.state.settings.points.win; sA.Pts += this.state.settings.points.loss;
                    if (this.state.settings.bonus.enabled) {
                        if (-diff >= this.state.settings.bonus.boMargin) { sB.BO++; sB.Pts += this.state.settings.bonus.boPoints; }
                        if (diff <= this.state.settings.bonus.bdMargin) { sA.BD++; sA.Pts += this.state.settings.bonus.bdPoints; }
                    }
                } else { sA.N++; sB.N++; sA.Pts += this.state.settings.points.draw; sB.Pts += this.state.settings.points.draw; }
            }
            const standings = Object.values(stats);
            standings.forEach(s => s.Diff = s.BP - s.BC);
            standings.sort((a, b) => b.Pts - a.Pts || b.Diff - a.Diff || b.BP - a.BP); // Simplified sort
            return standings;
        },

        renderStandings() {
            const standings = this.getStandings();
            const { bonus } = this.state.settings;
            this.elements.standingsTableHeader.innerHTML = `<tr><th class="pos">#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th><th>BP</th><th>BC</th><th>Diff</th>${bonus.enabled ? '<th>BO</th><th>BD</th>' : ''}<th class="pts">Pts</th></tr>`;
            this.elements.standingsTableBody.innerHTML = standings.map((s, i) => {
                const team = this.getTeamById(s.id);
                let rankClass = i < 2 ? 'rank-1-2' : (i < 6 ? 'rank-3-6' : '');
                return `<tr class="${rankClass}"><td class="pos">${i + 1}</td><td><div class="team-cell"><img class="logo" src="data/logos/${team.logo}" alt="${team.name}"><span>${team.name}</span></div></td><td>${s.J}</td><td>${s.G}</td><td>${s.N}</td><td>${s.P}</td><td>${s.BP}</td><td>${s.BC}</td><td>${s.Diff}</td>${bonus.enabled ? `<td>${s.BO}</td><td>${s.BD}</td>` : ''}<td class="pts"><strong>${s.Pts}</strong></td></tr>`;
            }).join('');
        },
        
        getScorers() {
            const scorerMap = {};
            this.state.matches.filter(m => m.status === 'finished').forEach(m => {
                (m.scorers || []).forEach(scorer => {
                    if (!scorer.playerName || scorer.playerName === '0 N U 2 L') return;
                    if (!scorerMap[scorer.playerName]) {
                        const team = this.getTeamById(scorer.teamId);
                        scorerMap[scorer.playerName] = { name: scorer.playerName, teamName: team.name, teamLogo: team.logo, goals: 0 };
                    }
                    scorerMap[scorer.playerName].goals++;
                });
            });
            return Object.values(scorerMap).sort((a, b) => b.goals - a.goals);
        },

        renderScorers() {
            const scorers = this.getScorers();
            this.elements.scorersTableBody.innerHTML = scorers.map((s, i) => `<tr><td class="pos">${i + 1}</td><td><strong>${s.name}</strong></td><td><div class="team-cell"><img class="logo" src="data/logos/${s.teamLogo}" alt="${s.teamName}"></div></td><td class="pts">${s.goals}</td></tr>`).join('');
        },

        renderBracket() {
            const ko = this.state.matches.filter(m => m.stage === 'ko');
            const rounds = { 'Barrage': [], 'Demi-finale': [], 'Finale': [] };
            ko.forEach(m => {
                if (rounds[m.round]) rounds[m.round].push(m);
                else { // Handle Barrage 1, Barrage 2
                    const key = m.round.replace(/\s\d/,'');
                    if(rounds[key]) rounds[key].push(m);
                }
            });
            const renderMatch = m => {
                const teamA = m.a ? this.getTeamById(m.a) : { name: 'À déterminer', logo: '' };
                const teamB = m.b ? this.getTeamById(m.b) : { name: 'À déterminer', logo: '' };
                const winner = m.status === 'finished' ? (m.ga > m.gb ? 'a' : (m.gb > m.ga ? 'b' : null)) : null;
                return `<div class="bracket-match"><div class="teamline ${winner==='a'?'winner':''} ${!m.a?'placeholder':''}"><div class="teamL"><img src="data/logos/${teamA.logo}"><span>${teamA.name}</span></div><div class="scoreR">${m.status==='finished'?m.ga:'-'}</div></div><div class="teamline ${winner==='b'?'winner':''} ${!m.b?'placeholder':''}"><div class="teamL"><img src="data/logos/${teamB.logo}"><span>${teamB.name}</span></div><div class="scoreR">${m.status==='finished'?m.gb:'-'}</div></div></div>`;
            };
            this.elements.bracketContainer.innerHTML = `<div class="bracket-col"><h3>Barrages</h3><div class="bracket-list">${rounds.Barrage.map(renderMatch).join('')}</div></div><div class="bracket-col"><h3>Demi-finales</h3><div class="bracket-list">${rounds['Demi-finale'].map(renderMatch).join('')}</div></div><div class="bracket-col"><h3>Finale</h3><div class="bracket-list">${rounds.Finale.map(renderMatch).join('')}</div></div>`;
        },

        updateKnockoutProgression() {
            const ko = this.state.matches.filter(m => m.stage === 'ko');
            const finishedBarrages = ko.filter(m => m.round.startsWith('Barrage') && m.status === 'finished');
            const demis = ko.filter(m => m.round.startsWith('Demi-finale'));
            if (finishedBarrages.length >= 2 && demis.length >= 2) {
                const winnerB1 = finishedBarrages[0].ga > finishedBarrages[0].gb ? finishedBarrages[0].a : finishedBarrages[0].b;
                const winnerB2 = finishedBarrages[1].ga > finishedBarrages[1].gb ? finishedBarrages[1].a : finishedBarrages[1].b;
                demis.find(d => d.a === this.getStandings()[0].id).b = winnerB2; // 1er vs vainqueur 4-5
                demis.find(d => d.a === this.getStandings()[1].id).b = winnerB1; // 2e vs vainqueur 3-6
            }
            const finishedDemis = demis.filter(m => m.status === 'finished');
            const finale = ko.find(m => m.round === 'Finale');
            if (finishedDemis.length >= 2 && finale) {
                finale.a = finishedDemis[0].ga > finishedDemis[0].gb ? finishedDemis[0].a : finishedDemis[0].b;
                finale.b = finishedDemis[1].ga > finishedDemis[1].gb ? finishedDemis[1].a : finishedDemis[1].b;
            }
            this.saveState(); this.renderBracket();
        },

        // --- LIVE & FINISHED MATCHES RENDERING ---
        renderLiveMatches() {
            this.renderMatchList(this.elements.liveMatchesList, this.state.matches.filter(m => ['upcoming', 'live'].includes(m.status)), true);
        },
        
        renderFinishedMatches() {
            const finished = this.state.matches.filter(m => m.status === 'finished');
            this.renderFinishedFilter(finished);
        },

        renderMatchList(container, matches, isLive) {
            container.innerHTML = '';
            const grouped = matches.reduce((acc, m) => { (acc[m.round] = acc[m.round] || []).push(m); return acc; }, {});
            Object.entries(grouped).forEach(([round, roundMatches]) => {
                const title = document.createElement('h3');
                title.className = 'journee-title';
                title.textContent = typeof round === 'number' ? `Journée N° ${round}` : round.replace(/\s\d/, '');
                container.appendChild(title);
                roundMatches.forEach(m => container.appendChild(isLive ? this.createLiveGameCard(m) : this.createFinishedGameCard(m)));
            });
        },
        
        createLiveGameCard(match) {
            const card = document.createElement('div');
            card.className = 'game-card'; card.dataset.matchId = match.id;
            const teamA = this.getTeamById(match.a); const teamB = this.getTeamById(match.b);
            const statusText = { upcoming: 'À VENIR', live: 'EN DIRECT' };
            const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
            const scorersLine = (teamId) => {
                return (match.scorers || []).filter(s => s.teamId === teamId)
                    .map(s => `${s.playerName} ${s.minute}'`).join(', ');
            };
            card.innerHTML = `
                <!-- TEAM A -->
                <div class="card-team left">
                    <div class="team-header">
                        <img src="data/logos/${teamA.logo}" class="logo">
                        <div class="team-name-info">
                            <div class="name">${teamA.name}</div>
                            <div class="scorers-line">${scorersLine(match.a)}</div>
                        </div>
                    </div>
                    <div class="player-buttons">${(teamA.players||[]).map(p=>`<button class="player-btn ${p==='0 N U 2 L'?'hidden':''}" data-action="goal" data-team="a" data-player="${p}">${p}</button>`).join('')}</div>
                    <div class="team-controls">
                        <button class="team-btn undo" data-action="undo-goal" data-team="a">−</button>
                        <button class="team-btn forfeit" data-action="forfeit" data-team="a">Forfait</button>
                    </div>
                </div>
                <!-- CENTER -->
                <div class="card-center">
                    <div class="meta-badge">${statusText[match.status]}</div>
                    <div class="score">${match.ga} – ${match.gb}</div>
                    <div class="timer">${formatTime(match.timeLeft)}</div>
                    <div class="center-controls">
                        <button class="center-btn" data-action="play"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                        <button class="center-btn" data-action="pause"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></button>
                        <button class="center-btn" data-action="reset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg></button>
                    </div>
                    <button class="finish-match-btn" data-action="finish">Match terminé</button>
                </div>
                <!-- TEAM B -->
                <div class="card-team right">
                    <div class="team-header">
                        <div class="team-name-info">
                            <div class="name">${teamB.name}</div>
                            <div class="scorers-line">${scorersLine(match.b)}</div>
                        </div>
                        <img src="data/logos/${teamB.logo}" class="logo">
                    </div>
                    <div class="player-buttons">${(teamB.players||[]).map(p=>`<button class="player-btn ${p==='0 N U 2 L'?'hidden':''}" data-action="goal" data-team="b" data-player="${p}">${p}</button>`).join('')}</div>
                    <div class="team-controls">
                        <button class="team-btn forfeit" data-action="forfeit" data-team="b">Forfait</button>
                        <button class="team-btn undo" data-action="undo-goal" data-team="b">−</button>
                    </div>
                </div>`;
            card.addEventListener('click', e => {
                const target = e.target.closest('[data-action]');
                if (target) this.handleMatchAction(target.dataset, match.id);
            });
            return card;
        },
        
        createFinishedGameCard(match) {
            const card = document.createElement('div'); card.className = 'finished-card';
            const teamA = this.getTeamById(match.a), teamB = this.getTeamById(match.b);
            card.innerHTML = `<div class="sidecell left"><img src="data/logos/${teamA.logo}"><span>${teamA.name}</span></div><div class="center">${match.ga} – ${match.gb}</div><div class="sidecell right"><span>${teamB.name}</span><img src="data/logos/${teamB.logo}"></div><div class="finished-card-footer"><button class="undo-btn" data-match-id="${match.id}">Annuler le résultat</button></div>`;
            card.querySelector('.undo-btn').addEventListener('click', e => this.undoResult(e.target.dataset.matchId));
            return card;
        },

        renderFinishedFilter(finished) {
            const rounds = ['all', ...new Set(finished.map(m => m.round).sort((a,b) => (typeof a === 'number' && typeof b === 'number') ? a - b : String(a).localeCompare(String(b))))];
            this.elements.finishedFilter.innerHTML = rounds.map(r => `<button class="chip ${this.state.ui.finishedFilter == r ? 'active' : ''}" data-filter="${r}">${r === 'all' ? 'Toutes' : (typeof r === 'number' ? `J${r}` : r.replace(/\s\d/, ''))}</button>`).join('');
            this.elements.finishedFilter.onclick = e => { if (e.target.matches('.chip')) { this.state.ui.finishedFilter = e.target.dataset.filter; this.renderFinishedMatches(); } };
            const filter = this.state.ui.finishedFilter;
            const filtered = filter === 'all' ? finished : finished.filter(m => String(m.round) === filter);
            this.renderMatchList(this.elements.finishedMatchesList, filtered, false);
        },

        // --- MATCH ACTIONS ---
        handleMatchAction(dataset, matchId) {
            const { action, team, player } = dataset;
            const match = this.state.matches.find(m => m.id === matchId);
            if (!match) return;
            switch (action) {
                case 'play': this.startTimer(match); break;
                case 'pause': this.pauseTimer(match); break;
                case 'reset': this.resetMatch(match); break;
                case 'finish': this.finishMatch(match); break;
                case 'goal': this.addGoal(match, team, player); break;
                case 'undo-goal': this.undoGoal(match, team); break;
                case 'forfeit': this.forfeitMatch(match, team); break;
            }
            this.saveState(); this.renderAll();
        },

        addGoal(match, team, playerName) {
            const minute = Math.floor((match.duration - match.timeLeft) / 60);
            match.scorers.push({ teamId: team === 'a' ? match.a : match.b, playerName, minute });
            team === 'a' ? match.ga++ : match.gb++;
            this.pauseTimer(match);
        },
        
        undoGoal(match, team) {
            const teamId = team === 'a' ? match.a : match.b;
            let lastGoalIndex = -1;
            for(let i = match.scorers.length - 1; i >= 0; i--) {
                if(match.scorers[i].teamId === teamId) { lastGoalIndex = i; break; }
            }
            if(lastGoalIndex > -1) {
                match.scorers.splice(lastGoalIndex, 1);
                if (team === 'a' && match.ga > 0) match.ga--;
                else if (team === 'b' && match.gb > 0) match.gb--;
            }
        },

        forfeitMatch(match, forfeitingTeam) {
            if (forfeitingTeam === 'a') { match.ga = 0; match.gb = 3; }
            else { match.ga = 3; match.gb = 0; }
            this.finishMatch(match);
        },

        finishMatch(match) {
            this.pauseTimer(match);
            match.status = 'finished';
            if (match.stage === 'ko') this.updateKnockoutProgression();
        },
        
        undoResult(matchId) {
            const match = this.state.matches.find(m => m.id === matchId);
            if (match) {
                match.status = 'upcoming';
                match.ga = 0; match.gb = 0; match.scorers = [];
                match.timeLeft = match.duration;
                if (match.stage === 'ko') this.updateKnockoutProgression();
                this.saveState(); this.renderAll();
                this.showToast('Résultat annulé.');
            }
        },

        resetMatch(match) {
            this.pauseTimer(match);
            match.status = 'upcoming';
            match.ga = 0; match.gb = 0; match.scorers = [];
            match.timeLeft = match.duration;
        },

        // --- TIMER LOGIC ---
        startTimer(match) {
            if (this.timers[match.id] || match.status === 'finished') return;
            match.status = 'live';
            this.timers[match.id] = setInterval(() => {
                if (match.timeLeft > 0) {
                    match.timeLeft--;
                    this.updateTimerDisplay(match.id, match.timeLeft);
                } else {
                    this.finishMatch(match); this.saveState(); this.renderAll();
                }
            }, 1000);
        },

        pauseTimer(match) {
            clearInterval(this.timers[match.id]);
            delete this.timers[match.id];
        },
        
        updateTimerDisplay(matchId, timeLeft) {
            const timerEl = document.querySelector(`.game-card[data-match-id="${matchId}"] .timer`);
            if (timerEl) {
                const min = String(Math.floor(timeLeft/60)).padStart(2,'0');
                const sec = String(timeLeft%60).padStart(2,'0');
                timerEl.textContent = `${min}:${sec}`;
            }
        },
    };

    App.init();
});
