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
            // Main navigation
            mainNav: document.getElementById('mainNav'),
            tabs: document.querySelectorAll('main > section'),
            // Header
            leagueTitle: document.getElementById('leagueTitle'),
            eventLogo: document.getElementById('eventLogo'),
            // Classement Page
            subnav: document.querySelector('.subnav'),
            subTabViews: document.querySelectorAll('#tab-classement > div[id^="view-"]'),
            standingsTableBody: document.querySelector('#standings-table tbody'),
            standingsTableHeader: document.querySelector('#standings-table thead'),
            scorersTableBody: document.querySelector('#scorers-table tbody'),
            bracketContainer: document.getElementById('bracket-container'),
            // Live Page
            liveMatchesList: document.getElementById('live-matches-list'),
            // Finished Page
            finishedMatchesList: document.getElementById('finished-matches-list'),
            finishedFilter: document.getElementById('finished-filter'),
            // Admin Page
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
            // Toast
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
                // Merge saved settings and matches, but not teams/config from JSON
                this.state.settings = parsed.settings || this.state.settings;
                this.state.matches = parsed.matches || this.state.matches;
                this.state.ui = parsed.ui || this.state.ui;
            }
        },

        // --- EVENT LISTENERS ---
        setupEventListeners() {
            this.elements.mainNav.addEventListener('click', e => {
                if (e.target.matches('.pill')) this.setActiveTab(e.target.dataset.tab);
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
            this.elements.mainNav.querySelectorAll('.pill').forEach(pill => {
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
            return this.state.teams.find(t => t.id == id) || { name: 'N/A', logo: '' };
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

            // Filter out existing league matches before generating new ones
            this.state.matches = this.state.matches.filter(m => m.stage !== 'league');

            if (teams.length % 2 !== 0) teams.push({ id: null, name: 'BYE' }); // Add a bye
            
            const numRounds = teams.length - 1;
            const matchesPerRound = teams.length / 2;
            const rounds = [];

            for (let i = 0; i < numRounds; i++) {
                const round = [];
                for (let j = 0; j < matchesPerRound; j++) {
                    const team1 = teams[j];
                    const team2 = teams[teams.length - 1 - j];
                    if (team1.id && team2.id) { // Don't create match for a bye
                        round.push({ a: team1.id, b: team2.id });
                    }
                }
                rounds.push(round);
                // Rotate teams
                teams.splice(1, 0, teams.pop());
            }

            const isHomeAway = this.elements.homeAwayCheck.checked;
            rounds.forEach((round, i) => {
                round.forEach(match => {
                    this.addMatch(match.a, match.b, i + 1, 'league');
                });
            });

            if (isHomeAway) {
                rounds.forEach((round, i) => {
                    round.forEach(match => {
                        this.addMatch(match.b, match.a, i + 1 + numRounds, 'league');
                    });
                });
            }

            this.saveState();
            this.renderAll();
            this.showToast('Matchs de championnat générés !');
        },

        generateKnockouts() {
            const standings = this.getStandings();
            if (standings.length < 6) {
                this.showToast('Il faut au moins 6 équipes classées.', 'error');
                return;
            }

            // Clear existing K.O. matches
            this.state.matches = this.state.matches.filter(m => m.stage !== 'ko');

            const [t1, t2, t3, t4, t5, t6] = standings.map(s => s.id);
            
            // Barrages
            this.addMatch(t3, t6, 'Barrage 1', 'ko');
            this.addMatch(t4, t5, 'Barrage 2', 'ko');
            // Demi-finales
            this.addMatch(t1, null, 'Demi-finale 1', 'ko');
            this.addMatch(t2, null, 'Demi-finale 2', 'ko');
            // Finale
            this.addMatch(null, null, 'Finale', 'ko');
            
            this.saveState();
            this.renderAll();
            this.showToast('Phases finales générées !');
        },

        addMatch(teamA, teamB, round, stage) {
            this.state.matches.push({
                id: this.uid(),
                a: teamA,
                b: teamB,
                ga: 0,
                gb: 0,
                status: 'upcoming',
                round, // e.g., 1, 2, "Barrage", "Demi-finale"
                stage, // 'league' or 'ko'
                duration: this.state.settings.defaultDuration,
                timeLeft: this.state.settings.defaultDuration,
                scorers: [],
            });
        },

        // --- CORE LOGIC: STANDINGS, SCORERS, BRACKET ---
        getStandings() {
            const stats = {};
            this.state.teams.forEach(t => {
                stats[t.id] = { id: t.id, J: 0, G: 0, N: 0, P: 0, BP: 0, BC: 0, Diff: 0, BO: 0, BD: 0, Pts: 0 };
            });

            const finishedLeagueMatches = this.state.matches.filter(m => m.stage === 'league' && m.status === 'finished');
            
            for (const m of finishedLeagueMatches) {
                const sA = stats[m.a];
                const sB = stats[m.b];
                if (!sA || !sB) continue;

                sA.J++; sB.J++;
                sA.BP += m.ga; sA.BC += m.gb;
                sB.BP += m.gb; sB.BC += m.ga;
                
                const diff = m.ga - m.gb;
                if (diff > 0) { // A wins
                    sA.G++; sB.P++;
                    sA.Pts += this.state.settings.points.win;
                    sB.Pts += this.state.settings.points.loss;
                    if (this.state.settings.bonus.enabled) {
                        if (diff >= this.state.settings.bonus.boMargin) { sA.BO++; sA.Pts += this.state.settings.bonus.boPoints; }
                        if (-diff <= this.state.settings.bonus.bdMargin) { sB.BD++; sB.Pts += this.state.settings.bonus.bdPoints; }
                    }
                } else if (diff < 0) { // B wins
                    sB.G++; sA.P++;
                    sB.Pts += this.state.settings.points.win;
                    sA.Pts += this.state.settings.points.loss;
                    if (this.state.settings.bonus.enabled) {
                        if (-diff >= this.state.settings.bonus.boMargin) { sB.BO++; sB.Pts += this.state.settings.bonus.boPoints; }
                        if (diff <= this.state.settings.bonus.bdMargin) { sA.BD++; sA.Pts += this.state.settings.bonus.bdPoints; }
                    }
                } else { // Draw
                    sA.N++; sB.N++;
                    sA.Pts += this.state.settings.points.draw;
                    sB.Pts += this.state.settings.points.draw;
                }
            }

            const standings = Object.values(stats);
            standings.forEach(s => s.Diff = s.BP - s.BC);

            // Sorting
            standings.sort((a, b) => {
                // Pts
                if (b.Pts !== a.Pts) return b.Pts - a.Pts;
                // Diff
                if (b.Diff !== a.Diff) return b.Diff - a.Diff;
                // Head-to-head
                let h2hPtsA = 0, h2hPtsB = 0;
                finishedLeagueMatches.forEach(m => {
                    if ((m.a === a.id && m.b === b.id) || (m.a === b.id && m.b === a.id)) {
                        const scoreA = m.a === a.id ? m.ga : m.gb;
                        const scoreB = m.a === a.id ? m.gb : m.ga;
                        if(scoreA > scoreB) h2hPtsA += this.state.settings.points.win;
                        else if (scoreB > scoreA) h2hPtsB += this.state.settings.points.win;
                        else { h2hPtsA += this.state.settings.points.draw; h2hPtsB += this.state.settings.points.draw; }
                    }
                });
                if(h2hPtsB !== h2hPtsA) return h2hPtsB - h2hPtsA;
                // BP
                return b.BP - a.BP;
            });

            return standings;
        },

        renderStandings() {
            const standings = this.getStandings();
            const { bonus } = this.state.settings;
            
            const headerRow = `<tr>
                <th class="pos">#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th>
                <th>BP</th><th>BC</th><th>Diff</th>
                ${bonus.enabled ? '<th>BO</th><th>BD</th>' : ''}
                <th class="pts">Pts</th>
            </tr>`;
            this.elements.standingsTableHeader.innerHTML = headerRow;

            const bodyHtml = standings.map((s, i) => {
                const team = this.getTeamById(s.id);
                let rankClass = '';
                if (i < 2) rankClass = 'rank-1-2';
                else if (i < 6) rankClass = 'rank-3-6';

                return `<tr class="${rankClass}">
                    <td class="pos">${i + 1}</td>
                    <td><div class="team-cell"><img class="logo" src="data/logos/${team.logo}" alt="${team.name}"><span>${team.name}</span></div></td>
                    <td>${s.J}</td><td>${s.G}</td><td>${s.N}</td><td>${s.P}</td>
                    <td>${s.BP}</td><td>${s.BC}</td><td>${s.Diff}</td>
                    ${bonus.enabled ? `<td>${s.BO}</td><td>${s.BD}</td>` : ''}
                    <td class="pts"><strong>${s.Pts}</strong></td>
                </tr>`;
            }).join('');
            this.elements.standingsTableBody.innerHTML = bodyHtml;
        },
        
        getScorers() {
             const scorerMap = {};
            this.state.matches
                .filter(m => m.status === 'finished')
                .forEach(m => {
                    (m.scorers || []).forEach(scorer => {
                        const team = this.getTeamById(scorer.teamId);
                        const player = (team.players || []).find(p => p === scorer.playerName);
                        if(player) {
                            if (!scorerMap[player]) {
                                scorerMap[player] = { name: player, teamName: team.name, teamLogo: team.logo, goals: 0 };
                            }
                            scorerMap[player].goals++;
                        }
                    });
                });
            return Object.values(scorerMap).sort((a, b) => b.goals - a.goals);
        },

        renderScorers() {
             const scorers = this.getScorers();
             this.elements.scorersTableBody.innerHTML = scorers.map((s, i) => `
                <tr>
                    <td class="pos">${i + 1}</td>
                    <td><strong>${s.name}</strong></td>
                    <td><div class="team-cell"><img class="logo" src="data/logos/${s.teamLogo}" alt="${s.teamName}"></div></td>
                    <td class="pts">${s.goals}</td>
                </tr>
            `).join('');
        },

        renderBracket() {
            // This logic is complex, requires updating KO matches based on previous results
            // For now, it will render the current state of KO matches
            const koMatches = this.state.matches.filter(m => m.stage === 'ko');
            const rounds = { 'Barrage': [], 'Demi-finale': [], 'Finale': [] };
            
            koMatches.forEach(m => {
                 if(m.round.startsWith('Barrage')) rounds['Barrage'].push(m);
                 else if (m.round.startsWith('Demi-finale')) rounds['Demi-finale'].push(m);
                 else if (m.round.startsWith('Finale')) rounds['Finale'].push(m);
            });
            
            const renderMatch = (m) => {
                const teamA = m.a ? this.getTeamById(m.a) : {name: 'À déterminer', logo: ''};
                const teamB = m.b ? this.getTeamById(m.b) : {name: 'À déterminer', logo: ''};
                const winner = (m.status === 'finished') ? (m.ga > m.gb ? 'a' : (m.gb > m.ga ? 'b' : null)) : null;

                return `
                <div class="bracket-match">
                    <div class="teamline ${winner === 'a' ? 'winner' : ''} ${!m.a ? 'placeholder' : ''}">
                        <div class="teamL"><img src="data/logos/${teamA.logo}"><span>${teamA.name}</span></div>
                        <div class="scoreR">${m.status === 'finished' ? m.ga : '-'}</div>
                    </div>
                    <div class="teamline ${winner === 'b' ? 'winner' : ''} ${!m.b ? 'placeholder' : ''}">
                        <div class="teamL"><img src="data/logos/${teamB.logo}"><span>${teamB.name}</span></div>
                        <div class="scoreR">${m.status === 'finished' ? m.gb : '-'}</div>
                    </div>
                </div>`;
            };

            this.elements.bracketContainer.innerHTML = `
                <div class="bracket-col"><h3>Barrages</h3><div class="bracket-list">${rounds['Barrage'].map(renderMatch).join('')}</div></div>
                <div class="bracket-col"><h3>Demi-finales</h3><div class="bracket-list">${rounds['Demi-finale'].map(renderMatch).join('')}</div></div>
                <div class="bracket-col"><h3>Finale</h3><div class="bracket-list">${rounds['Finale'].map(renderMatch).join('')}</div></div>
            `;
        },

        updateKnockoutProgression() {
            const koMatches = this.state.matches.filter(m => m.stage === 'ko');
            
            // Barrages -> Demis
            const barrages = koMatches.filter(m => m.round.startsWith('Barrage') && m.status === 'finished');
            const demis = koMatches.filter(m => m.round.startsWith('Demi-finale'));
            
            if (barrages.length >= 2 && demis.length >= 2) {
                const winnerB1 = barrages[0].ga > barrages[0].gb ? barrages[0].a : barrages[0].b; // 3v6 winner
                const winnerB2 = barrages[1].ga > barrages[1].gb ? barrages[1].a : barrages[1].b; // 4v5 winner

                demis[0].b = winnerB2; // 1er vs (4v5)
                demis[1].b = winnerB1; // 2e vs (3v6)
            }
            
            // Demis -> Finale
            const finishedDemis = demis.filter(m => m.status === 'finished');
            const finale = koMatches.find(m => m.round.startsWith('Finale'));

            if(finishedDemis.length >= 2 && finale) {
                const winnerD1 = finishedDemis[0].ga > finishedDemis[0].gb ? finishedDemis[0].a : finishedDemis[0].b;
                const winnerD2 = finishedDemis[1].ga > finishedDemis[1].gb ? finishedDemis[1].a : finishedDemis[1].b;
                finale.a = winnerD1;
                finale.b = winnerD2;
            }

            this.saveState();
            this.renderBracket();
        },

        // --- LIVE & FINISHED MATCHES RENDERING ---
        renderLiveMatches() {
            const liveAndUpcoming = this.state.matches.filter(m => ['upcoming', 'live'].includes(m.status));
            this.renderMatchList(this.elements.liveMatchesList, liveAndUpcoming, true);
        },
        
        renderFinishedMatches() {
            const finished = this.state.matches.filter(m => m.status === 'finished');
            this.renderMatchList(this.elements.finishedMatchesList, finished, false);
            this.renderFinishedFilter(finished);
        },

        renderMatchList(container, matches, isLive) {
            container.innerHTML = '';
            const groupedByRound = matches.reduce((acc, match) => {
                const round = match.round;
                if (!acc[round]) acc[round] = [];
                acc[round].push(match);
                return acc;
            }, {});

            Object.entries(groupedByRound).forEach(([round, roundMatches]) => {
                const title = document.createElement('h3');
                title.className = 'journee-title';
                title.textContent = typeof round === 'number' ? `Journée N° ${round}` : round;
                container.appendChild(title);
                roundMatches.forEach(m => {
                    const card = isLive ? this.createLiveGameCard(m) : this.createFinishedGameCard(m);
                    container.appendChild(card);
                });
            });
        },
        
        createLiveGameCard(match) {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.dataset.matchId = match.id;

            const teamA = this.getTeamById(match.a);
            const teamB = this.getTeamById(match.b);
            
            const playersA = teamA.players || [];
            const playersB = teamB.players || [];

            const formatTime = (seconds) => {
                const min = String(Math.floor(seconds / 60)).padStart(2, '0');
                const sec = String(seconds % 60).padStart(2, '0');
                return `${min}:${sec}`;
            };

            const statusText = {
                upcoming: 'À VENIR',
                live: 'EN DIRECT',
            };

            const scorersLogHTML = (scorers) => {
                return (scorers || []).map(s => `<span>${s.playerName} ${s.minute}'</span>`).join(', ');
            };

            card.innerHTML = `
                <div class="card-main">
                    <div class="team-bg" style="background-image: linear-gradient(90deg, ${teamA.color} 0%, transparent 100%)"></div>
                    <div class="team-bg" style="background-image: linear-gradient(270deg, ${teamB.color} 0%, transparent 100%)"></div>

                    <!-- TEAM A -->
                    <div class="card-team left">
                        <div class="team-header"><img src="data/logos/${teamA.logo}" class="logo"><span class="name">${teamA.name}</span></div>
                        <div class="player-buttons">
                            ${playersA.map(p => `<button class="player-btn ${p === '0 N U 2 L' ? 'hidden' : ''}" data-action="goal" data-team="a" data-player="${p}">${p}</button>`).join('')}
                        </div>
                        <div class="scorers-log">${scorersLogHTML(match.scorers.filter(s => s.teamId === match.a))}</div>
                        <div class="team-controls">
                            <button class="team-btn" data-action="undo-goal" data-team="a">−</button>
                            <button class="team-btn forfeit" data-action="forfeit" data-team="a">Forfait</button>
                        </div>
                    </div>

                    <!-- CENTER -->
                    <div class="card-center">
                        <div class="meta-badge">${statusText[match.status]}</div>
                        <div class="score">${match.ga} – ${match.gb}</div>
                        <div class="timer">${formatTime(match.timeLeft)}</div>
                        <div class="center-controls">
                            <button class="center-btn" data-action="play">▶</button>
                            <button class="center-btn" data-action="pause">⏸</button>
                            <button class="center-btn" data-action="reset">↺</button>
                        </div>
                        <button class="finish-match-btn" data-action="finish">Match terminé</button>
                    </div>

                    <!-- TEAM B -->
                    <div class="card-team right">
                        <div class="team-header"><span class="name">${teamB.name}</span><img src="data/logos/${teamB.logo}" class="logo"></div>
                        <div class="player-buttons">
                            ${playersB.map(p => `<button class="player-btn ${p === '0 N U 2 L' ? 'hidden' : ''}" data-action="goal" data-team="b" data-player="${p}">${p}</button>`).join('')}
                        </div>
                        <div class="scorers-log">${scorersLogHTML(match.scorers.filter(s => s.teamId === match.b))}</div>
                        <div class="team-controls">
                             <button class="team-btn forfeit" data-action="forfeit" data-team="b">Forfait</button>
                            <button class="team-btn" data-action="undo-goal" data-team="b">−</button>
                        </div>
                    </div>
                </div>`;

            card.addEventListener('click', e => this.handleMatchAction(e, match.id));
            return card;
        },
        
        createFinishedGameCard(match) {
            const card = document.createElement('div');
            card.className = 'finished-card';
            
            const teamA = this.getTeamById(match.a);
            const teamB = this.getTeamById(match.b);
            
            card.innerHTML = `
                <div class="sidecell left"><img src="data/logos/${teamA.logo}"><span>${teamA.name}</span></div>
                <div class="center">${match.ga} – ${match.gb}</div>
                <div class="sidecell right"><span>${teamB.name}</span><img src="data/logos/${teamB.logo}"></div>
                <div class="finished-card-footer">
                    <button class="undo-btn" data-match-id="${match.id}">Annuler le résultat</button>
                </div>
            `;
            card.querySelector('.undo-btn').addEventListener('click', e => this.undoResult(e.target.dataset.matchId));
            return card;
        },

        renderFinishedFilter(finishedMatches) {
            const rounds = ['all', ...new Set(finishedMatches.map(m => m.round))].sort();
            this.elements.finishedFilter.innerHTML = rounds.map(r => `
                <button class="chip ${this.state.ui.finishedFilter === r ? 'active' : ''}" data-filter="${r}">
                    ${r === 'all' ? 'Toutes' : (typeof r === 'number' ? `J${r}` : r)}
                </button>
            `).join('');

            this.elements.finishedFilter.addEventListener('click', e => {
                if(e.target.matches('.chip')) {
                    this.state.ui.finishedFilter = e.target.dataset.filter;
                    this.renderFinishedMatches();
                }
            });

            // Apply filter
            const filter = this.state.ui.finishedFilter;
            const filteredMatches = filter === 'all' ? finishedMatches : finishedMatches.filter(m => String(m.round) === filter);
            this.renderMatchList(this.elements.finishedMatchesList, filteredMatches, false);
        },

        // --- MATCH ACTIONS ---
        handleMatchAction(e, matchId) {
            const action = e.target.dataset.action;
            if (!action) return;

            const match = this.state.matches.find(m => m.id === matchId);
            if (!match) return;

            switch (action) {
                case 'play': this.startTimer(match); break;
                case 'pause': this.pauseTimer(match); break;
                case 'reset': this.resetMatch(match); break;
                case 'finish': this.finishMatch(match); break;
                case 'goal':
                    const { team, player } = e.target.dataset;
                    this.addGoal(match, team, player);
                    break;
                case 'undo-goal':
                    this.undoGoal(match, e.target.dataset.team);
                    break;
                case 'forfeit':
                    this.forfeitMatch(match, e.target.dataset.team);
                    break;
            }
            this.saveState();
            this.renderAll();
        },

        addGoal(match, team, playerName) {
            const minute = Math.floor((match.duration - match.timeLeft) / 60);
            match.scorers.push({ teamId: team === 'a' ? match.a : match.b, playerName, minute });
            if (team === 'a') match.ga++;
            else match.gb++;
            this.pauseTimer(match); // Pause on goal as requested
        },
        
        undoGoal(match, team) {
            const teamId = team === 'a' ? match.a : match.b;
            const lastGoalIndex = match.scorers.map(s => s.teamId).lastIndexOf(teamId);
            if(lastGoalIndex > -1) {
                match.scorers.splice(lastGoalIndex, 1);
                if (team === 'a' && match.ga > 0) match.ga--;
                else if (team === 'b' && match.gb > 0) match.gb--;
            }
        },

        forfeitMatch(match, forfeitingTeam) {
            if (forfeitingTeam === 'a') {
                match.ga = 0;
                match.gb = 3;
            } else {
                match.ga = 3;
                match.gb = 0;
            }
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
                // Reset stats for undo
                match.ga = 0;
                match.gb = 0;
                match.scorers = [];
                match.timeLeft = match.duration;
                if (match.stage === 'ko') this.updateKnockoutProgression();
                this.saveState();
                this.renderAll();
                this.showToast('Résultat annulé.');
            }
        },

        resetMatch(match) {
            this.pauseTimer(match);
            match.status = 'upcoming';
            match.ga = 0;
            match.gb = 0;
            match.timeLeft = match.duration;
            match.scorers = [];
        },

        // --- TIMER LOGIC ---
        startTimer(match) {
            if (this.timers[match.id]) return; // Already running
            match.status = 'live';
            this.timers[match.id] = setInterval(() => {
                if (match.timeLeft > 0) {
                    match.timeLeft--;
                    this.updateTimerDisplay(match.id, match.timeLeft);
                } else {
                    this.finishMatch(match);
                    this.saveState();
                    this.renderAll();
                }
            }, 1000);
        },

        pauseTimer(match) {
            clearInterval(this.timers[match.id]);
            delete this.timers[match.id];
        },
        
        updateTimerDisplay(matchId, timeLeft) {
            const timerEl = document.querySelector(`[data-match-id="${matchId}"] .timer`);
            if (timerEl) {
                const min = String(Math.floor(timeLeft / 60)).padStart(2, '0');
                const sec = String(timeLeft % 60).padStart(2, '0');
                timerEl.textContent = `${min}:${sec}`;
            }
        },
    };

    App.init();
});
