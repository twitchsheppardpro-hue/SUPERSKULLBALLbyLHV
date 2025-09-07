document.addEventListener('DOMContentLoaded', () => {
    const App = {
        // =============== STATE MANAGEMENT ===============
        state: {
            teams: [],
            matches: [],
            settings: {
                points: { win: 3, draw: 1, loss: 0 },
                bonus: { enabled: true, boPoints: 1, boMargin: 3, bdPoints: 1, bdMargin: 1 },
                matchDuration: 15, // in minutes
            },
            timers: {}, // To hold setInterval instances
        },
        
        // =============== INITIALIZATION ===============
        async init() {
            this.loadState();
            await this.fetchData();
            this.setupEventListeners();
            this.render();
        },

        async fetchData() {
            try {
                const response = await fetch('data/team.json');
                const data = await response.json();
                this.state.teams = data.teams;
                document.getElementById('leagueTitle').textContent = data.leagueName;
                document.getElementById('eventLogo').src = data.eventLogo;
            } catch (error) {
                console.error("Failed to load team.json:", error);
            }
        },
        
        loadState() {
            const savedMatches = localStorage.getItem('skullball_matches');
            const savedSettings = localStorage.getItem('skullball_settings');
            if (savedMatches) this.state.matches = JSON.parse(savedMatches);
            if (savedSettings) this.state.settings = JSON.parse(savedSettings);
        },

        saveState() {
            localStorage.setItem('skullball_matches', JSON.stringify(this.state.matches));
            localStorage.setItem('skullball_settings', JSON.stringify(this.state.settings));
            this.render(); // Re-render on every state change
        },

        // =============== EVENT LISTENERS ===============
        setupEventListeners() {
            // Main tab navigation
            document.getElementById('mainNav').addEventListener('click', e => {
                if (e.target.matches('.pill')) this.handleTabSwitch(e, 'mainNav', 'section');
            });
             document.getElementById('adminBtn').addEventListener('click', e => {
                if (e.target.matches('.pill')) this.handleTabSwitch(e, 'mainNav', 'section');
            });

            // Sub-tab navigation in "Classement"
            document.querySelector('#tab-classement .subnav').addEventListener('click', e => {
                if (e.target.matches('.pill.sub')) this.handleTabSwitch(e, '.subnav', 'view');
            });
            
            // Delegated event listeners for dynamic content
            document.body.addEventListener('click', e => {
                const target = e.target;
                // Live match controls
                if (target.closest('.control-btn')) this.handleLiveMatchControls(target.closest('.control-btn'));
                if (target.matches('.finish-btn')) this.handleLiveMatchControls(target);
                if (target.closest('.player-btn')) this.handlePlayerAction(target.closest('.player-btn'));
                if (target.closest('.action-btn')) this.handlePlayerAction(target.closest('.action-btn'));
                // Admin actions
                if (target.id === 'save-rules-btn') this.handleSaveRules();
                if (target.id === 'generate-matches-btn') this.handleGenerateMatches();
                if (target.id === 'generate-playoffs-btn') this.handleGeneratePlayoffs();
                 // Finished matches
                if (target.matches('.revert-btn')) this.handleRevertMatch(target.dataset.matchId);
                if (target.matches('.filterbar .chip')) this.handleFilterFinished(target);
            });
        },

        // =============== RENDER FUNCTIONS ===============
        render() {
            this.renderClassement();
            this.renderPhaseFinale();
            this.renderButeurs();
            this.renderLiveMatches();
            this.renderFinishedMatches();
            this.renderAdminPanel();
        },

        // Render Standings Table
        renderClassement() {
            const container = document.getElementById('view-tableau');
            const stats = this.calculateStats();
            
            const bonusEnabled = this.state.settings.bonus.enabled;
            let tableHTML = `
                <table class="table">
                    <thead><tr>
                        <th class="pos">#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th>
                        <th>BP</th><th>BC</th><th>Diff</th>
                        ${bonusEnabled ? '<th>BO</th><th>BD</th>' : ''}
                        <th>Pts</th>
                    </tr></thead>
                    <tbody>`;
            
            stats.forEach((s, index) => {
                tableHTML += `
                    <tr>
                        <td class="pos">${index + 1}</td>
                        <td><div class="team"><img class="logo" src="${s.logo}" alt="${s.name}"><span>${s.name}</span></div></td>
                        <td>${s.J}</td><td>${s.G}</td><td>${s.N}</td><td>${s.P}</td>
                        <td>${s.BP}</td><td>${s.BC}</td><td>${s.Diff > 0 ? '+' : ''}${s.Diff}</td>
                        ${bonusEnabled ? `<td>${s.BO}</td><td>${s.BD}</td>` : ''}
                        <td><strong>${s.Pts}</strong></td>
                    </tr>`;
            });
            
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        },

        // Render Playoff Bracket
        renderPhaseFinale() {
            const container = document.getElementById('view-bracket');
             const { barrages, demis, finale } = this.getPlayoffMatches();

            const createMatchHTML = (match) => {
                if (!match) return '<div class="bracket-match placeholder"></div>';
                const teamA = this.state.teams.find(t => t.id === match.teamA) || { name: 'TBD', logo: '' };
                const teamB = this.state.teams.find(t => t.id === match.teamB) || { name: 'TBD', logo: '' };
                const isFinished = match.status === 'finished';
                let winnerA = '', winnerB = '';
                if(isFinished) {
                    if (match.scoreA > match.scoreB) winnerA = 'winner';
                    if (match.scoreB > match.scoreA) winnerB = 'winner';
                }

                return `
                    <div class="bracket-match">
                        <div class="bracket-team ${winnerA}">
                            <img src="${teamA.logo}" class="logo">
                            <span class="bracket-team-name">${teamA.name}</span>
                            <span class="bracket-team-score">${isFinished ? match.scoreA : '-'}</span>
                        </div>
                        <div class="bracket-team ${winnerB}">
                            <img src="${teamB.logo}" class="logo">
                            <span class="bracket-team-name">${teamB.name}</span>
                            <span class="bracket-team-score">${isFinished ? match.scoreB : '-'}</span>
                        </div>
                    </div>`;
            };

            container.innerHTML = `
                <div class="bracket-grid">
                    <div class="bracket-column">
                        <h3>Barrages</h3>
                        ${barrages.map(createMatchHTML).join('')}
                    </div>
                    <div class="bracket-column">
                        <h3>Demi-finales</h3>
                        ${demis.map(createMatchHTML).join('')}
                    </div>
                    <div class="bracket-column">
                        <h3>Finale</h3>
                        ${createMatchHTML(finale)}
                    </div>
                </div>`;
        },

        // Render Top Scorers Table
        renderButeurs() {
            const container = document.getElementById('view-buteurs');
            const scorers = {};
            this.state.matches.forEach(m => {
                if (m.status === 'finished') {
                    [...(m.scorersA || []), ...(m.scorersB || [])].forEach(scorer => {
                        if (!scorers[scorer.name]) {
                            scorers[scorer.name] = { name: scorer.name, goals: 0, teamId: scorer.teamId };
                        }
                        scorers[scorer.name].goals++;
                    });
                }
            });

            const sortedScorers = Object.values(scorers).sort((a, b) => b.goals - a.goals);

            let tableHTML = `
                <table class="table">
                    <thead><tr>
                        <th class="pos">#</th><th>Joueur</th><th>Club</th><th>Buts</th>
                    </tr></thead>
                    <tbody>`;
            
            sortedScorers.forEach((s, index) => {
                const team = this.state.teams.find(t => t.id === s.teamId) || {};
                tableHTML += `
                    <tr>
                        <td class="pos">${index + 1}</td>
                        <td><div class="team">${s.name}</div></td>
                        <td><img class="scorers-club-logo" src="${team.logo}" alt="${team.name}"></td>
                        <td><strong>${s.goals}</strong></td>
                    </tr>`;
            });

            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
        },

        // Render Live Matches
        renderLiveMatches() {
           const container = document.getElementById('tab-live');
            container.innerHTML = ''; // Clear previous content

            const matchesByDay = {};
            this.state.matches
                .filter(m => m.status === 'upcoming' || m.status === 'live')
                .forEach(m => {
                    const key = m.type === 'playoff' ? `Phase Finale - ${m.round}` : `Journée N° ${m.day}`;
                    if (!matchesByDay[key]) matchesByDay[key] = [];
                    matchesByDay[key].push(m);
                });

            for (const day in matchesByDay) {
                const header = document.createElement('h2');
                header.className = 'journee-header';
                header.textContent = day;
                container.appendChild(header);
                matchesByDay[day].forEach(m => container.appendChild(this.createGameCard(m)));
            }
        },

        // Render Finished Matches
        renderFinishedMatches(filter = 'Toutes') {
            const container = document.getElementById('finished-list');
            const filterbar = document.getElementById('finishedFilter');
            container.innerHTML = '';
            
            const finishedMatches = this.state.matches.filter(m => m.status === 'finished');
            
            // Create filters
            const days = ['Toutes', ...new Set(finishedMatches.map(m => `J${m.day}`)), 'Barrage', 'Demi-finale', 'Finale'].filter((v, i, a) => a.indexOf(v) === i);
            filterbar.innerHTML = days.map(d => `<button class="chip ${filter === d ? 'active' : ''}" data-filter="${d}">${d}</button>`).join('');

            // Filter and display
             finishedMatches
                .filter(m => {
                    if (filter === 'Toutes') return true;
                    if (filter.startsWith('J')) return `J${m.day}` === filter;
                    return m.round === filter;
                })
                .forEach(match => {
                const teamA = this.state.teams.find(t => t.id === match.teamA);
                const teamB = this.state.teams.find(t => t.id === match.teamB);

                const scorersA = (match.scorersA || []).map(s => `${s.name} (${s.minute}')`).join(', ');
                const scorersB = (match.scorersB || []).map(s => `${s.name} (${s.minute}')`).join(', ');
                
                const card = document.createElement('div');
                card.className = 'finished-card';
                card.innerHTML = `
                    <div class="team"><img class="logo" src="${teamA.logo}"> ${teamA.name}</div>
                    <div class="score">${match.scoreA} - ${match.scoreB}</div>
                    <div class="team" style="justify-content: flex-end;"><img class="logo" src="${teamB.logo}"> ${teamB.name}</div>
                    <div class="scorers-log">
                        <p><strong>Buteurs ${teamA.name}:</strong> ${scorersA || 'Aucun'}</p>
                        <p><strong>Buteurs ${teamB.name}:</strong> ${scorersB || 'Aucun'}</p>
                    </div>
                    <button class="revert-btn" data-match-id="${match.id}">Annuler le résultat</button>
                `;
                container.appendChild(card);
            });
        },
        
        // Render Admin Panel
        renderAdminPanel() {
            const rulesContainer = document.getElementById('rules-options-form');
            const matchesContainer = document.getElementById('matches-generation-form');
            const s = this.state.settings;

            rulesContainer.innerHTML = `
                <div class="form-grid">
                    <div class="form-group"><label>Points victoire</label><input type="number" id="ptsWin" value="${s.points.win}"></div>
                    <div class="form-group"><label>Points nul</label><input type="number" id="ptsDraw" value="${s.points.draw}"></div>
                    <div class="form-group"><label>Points défaite</label><input type="number" id="ptsLoss" value="${s.points.loss}"></div>
                    <div class="form-group"><label>Durée match (min)</label><input type="number" id="matchDuration" value="${s.matchDuration}"></div>
                    <div class="form-group full-width checkbox-group"><input type="checkbox" id="bonusEnabled" ${s.bonus.enabled ? 'checked' : ''}><label for="bonusEnabled">Activer bonus (BO/BD)</label></div>
                    <div class="form-group"><label>BO (+ points)</label><input type="number" id="boPoints" value="${s.bonus.boPoints}"></div>
                    <div class="form-group"><label>Seuil BO (écart ≥)</label><input type="number" id="boMargin" value="${s.bonus.boMargin}"></div>
                    <div class="form-group"><label>BD (+ points)</label><input type="number" id="bdPoints" value="${s.bonus.bdPoints}"></div>
                    <div class="form-group"><label>Seuil BD (écart ≤ défaite)</label><input type="number" id="bdMargin" value="${s.bonus.bdMargin}"></div>
                </div>
                <button id="save-rules-btn" class="admin-btn">Sauvegarder Règles</button>
            `;
            
            matchesContainer.innerHTML = `
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="allerRetour"><label for="allerRetour">Matchs Aller/Retour</label>
                </div>
                <button id="generate-matches-btn" class="admin-btn">Générer les Matchs</button>
                <button id="generate-playoffs-btn" class="admin-btn">Générer les Phases Finales</button>
            `;
        },

        // =============== UI COMPONENTS ===============
        createGameCard(match) {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.dataset.matchId = match.id;

            const teamA = this.state.teams.find(t => t.id === match.teamA);
            const teamB = this.state.teams.find(t => t.id === match.teamB);

            const formatScorers = (scorers) => {
                const grouped = {};
                (scorers || []).forEach(s => {
                    if (!grouped[s.name]) grouped[s.name] = [];
                    grouped[s.name].push(s.minute + "'");
                });
                return Object.entries(grouped).map(([name, times]) => `<span>⚽ ${name} ${times.join(', ')}</span>`).join('');
            };

            const createPlayerButtons = (team) => {
                let buttons = '';
                for (let i = 0; i < 6; i++) {
                    const player = team.players[i];
                    if (player && player !== "0NULL") {
                        buttons += `<button class="player-btn" data-player-name="${player}" data-team-id="${team.id}">${player}</button>`;
                    }
                }
                return buttons;
            };

            card.innerHTML = `
                <div class="game-card-main" style="background: linear-gradient(90deg, ${teamA.color} 0%, var(--bg-dark) 50%, ${teamB.color} 100%);">
                    <!-- Team A -->
                    <div class="game-team team-a">
                        <div class="team-header"><img src="${teamA.logo}" class="logo"><span class="name">${teamA.name}</span></div>
                        <div class="scorers-log">${formatScorers(match.scorersA)}</div>
                        <div class="player-buttons">${createPlayerButtons(teamA)}</div>
                        <div class="team-actions">
                            <button class="action-btn minus" data-team-id="${teamA.id}">-1 But</button>
                            <button class="action-btn forfeit" data-team-id="${teamA.id}">Forfait</button>
                        </div>
                    </div>
                    <!-- Center -->
                    <div class="game-center">
                        <div class="game-status ${match.status}">${match.status === 'live' ? 'En Direct' : 'À venir'}</div>
                        <div class="game-score">${match.scoreA} - ${match.scoreB}</div>
                        <div class="game-timer">${Math.floor(match.timer / 60)}:${('0' + match.timer % 60).slice(-2)}</div>
                        <div class="center-controls">
                            <button class="control-btn play" data-action="play">▶</button>
                            <button class="control-btn pause" data-action="pause">⏸</button>
                            <button class="control-btn reset" data-action="reset">↺</button>
                        </div>
                        <button class="finish-btn" data-action="finish">Match Terminé</button>
                    </div>
                    <!-- Team B -->
                    <div class="game-team team-b">
                        <div class="team-header"><span class="name">${teamB.name}</span><img src="${teamB.logo}" class="logo"></div>
                        <div class="scorers-log">${formatScorers(match.scorersB)}</div>
                        <div class="player-buttons">${createPlayerButtons(teamB)}</div>
                        <div class="team-actions">
                            <button class="action-btn minus" data-team-id="${teamB.id}">-1 But</button>
                            <button class="action-btn forfeit" data-team-id="${teamB.id}">Forfait</button>
                        </div>
                    </div>
                </div>`;
            return card;
        },

        // =============== LOGIC & CALCULATIONS ===============
        calculateStats() {
            const stats = {};
            this.state.teams.forEach(t => {
                stats[t.id] = { id: t.id, name: t.name, logo: t.logo, J: 0, G: 0, N: 0, P: 0, BP: 0, BC: 0, Diff: 0, BO: 0, BD: 0, Pts: 0 };
            });

            this.state.matches.forEach(m => {
                if (m.status === 'finished' && m.type === 'league') {
                    const sA = stats[m.teamA];
                    const sB = stats[m.teamB];
                    sA.J++; sB.J++;
                    sA.BP += m.scoreA; sA.BC += m.scoreB;
                    sB.BP += m.scoreB; sB.BC += m.scoreA;

                    if (m.scoreA > m.scoreB) { // A wins
                        sA.G++; sB.P++;
                        sA.Pts += this.state.settings.points.win;
                        sB.Pts += this.state.settings.points.loss;
                        if (this.state.settings.bonus.enabled) {
                            if ((m.scoreA - m.scoreB) >= this.state.settings.bonus.boMargin) { sA.BO++; sA.Pts += this.state.settings.bonus.boPoints; }
                            if ((m.scoreA - m.scoreB) <= this.state.settings.bonus.bdMargin) { sB.BD++; sB.Pts += this.state.settings.bonus.bdPoints; }
                        }
                    } else if (m.scoreB > m.scoreA) { // B wins
                        sB.G++; sA.P++;
                        sB.Pts += this.state.settings.points.win;
                        sA.Pts += this.state.settings.points.loss;
                         if (this.state.settings.bonus.enabled) {
                            if ((m.scoreB - m.scoreA) >= this.state.settings.bonus.boMargin) { sB.BO++; sB.Pts += this.state.settings.bonus.boPoints; }
                            if ((m.scoreB - m.scoreA) <= this.state.settings.bonus.bdMargin) { sA.BD++; sA.Pts += this.state.settings.bonus.bdPoints; }
                        }
                    } else { // Draw
                        sA.N++; sB.N++;
                        sA.Pts += this.state.settings.points.draw;
                        sB.Pts += this.state.settings.points.draw;
                    }
                }
            });

            Object.values(stats).forEach(s => s.Diff = s.BP - s.BC);
            return Object.values(stats).sort((a, b) => b.Pts - a.Pts || b.Diff - a.Diff || b.BP - a.BP);
        },

        getPlayoffMatches() {
            const playoffs = this.state.matches.filter(m => m.type === 'playoff');
            return {
                barrages: playoffs.filter(m => m.round === 'Barrage'),
                demis: playoffs.filter(m => m.round === 'Demi-finale'),
                finale: playoffs.find(m => m.round === 'Finale'),
            };
        },
        
        // =============== HANDLERS ===============
        handleTabSwitch(e, navSelector, viewPrefix) {
            const button = e.target.closest('.pill');
            if (!button) return;

            document.querySelectorAll(`${navSelector} .pill`).forEach(p => p.classList.remove('active'));
            button.classList.add('active');

            const tabId = `tab-${button.dataset.tab}`;
            const subId = `${viewPrefix}-${button.dataset.sub}`;

            if (viewPrefix === 'section') {
                document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
                document.getElementById(tabId)?.classList.remove('hidden');
            } else { // sub-view
                document.querySelectorAll(`#tab-classement > div`).forEach(v => v.classList.add('hidden'));
                document.getElementById(subId)?.classList.remove('hidden');
            }
        },

       handleLiveMatchControls(button) {
            const action = button.dataset.action;
            const matchId = button.closest('.game-card').dataset.matchId;
            const match = this.state.matches.find(m => m.id === matchId);
            if (!match) return;

            if (action === 'play') {
                if (match.status === 'upcoming') match.status = 'live';
                if (this.state.timers[matchId]) return; // Already running
                this.state.timers[matchId] = setInterval(() => {
                    if (match.timer > 0) {
                        match.timer--;
                        this.renderLiveMatches();
                    } else {
                        clearInterval(this.state.timers[matchId]);
                        delete this.state.timers[matchId];
                    }
                }, 1000);
            } else if (action === 'pause') {
                clearInterval(this.state.timers[matchId]);
                delete this.state.timers[matchId];
            } else if (action === 'reset') {
                clearInterval(this.state.timers[matchId]);
                delete this.state.timers[matchId];
                match.status = 'upcoming';
                match.scoreA = 0; match.scoreB = 0;
                match.scorersA = []; match.scorersB = [];
                match.timer = this.state.settings.matchDuration * 60;
            } else if (action === 'finish') {
                clearInterval(this.state.timers[matchId]);
                delete this.state.timers[matchId];
                match.status = 'finished';
                 this.updatePlayoffsWithWinner(match);
            }
            this.saveState();
        },

        handlePlayerAction(button) {
            const matchId = button.closest('.game-card').dataset.matchId;
            const match = this.state.matches.find(m => m.id === matchId);
            const teamId = button.dataset.teamId;

            if (button.matches('.player-btn')) {
                const playerName = button.dataset.playerName;
                const minute = Math.floor((this.state.settings.matchDuration * 60 - match.timer) / 60);
                const scorer = { name: playerName, minute: minute, teamId: teamId };
                
                if (teamId === match.teamA) {
                    match.scoreA++;
                    match.scorersA.push(scorer);
                } else {
                    match.scoreB++;
                    match.scorersB.push(scorer);
                }
            } else if (button.matches('.minus')) {
                if (teamId === match.teamA && match.scoreA > 0) {
                    match.scoreA--;
                    match.scorersA.pop();
                } else if (teamId === match.teamB && match.scoreB > 0) {
                    match.scoreB--;
                    match.scorersB.pop();
                }
            } else if (button.matches('.forfeit')) {
                match.status = 'finished';
                if (teamId === match.teamA) { match.scoreA = 0; match.scoreB = 3; } 
                else { match.scoreB = 0; match.scoreA = 3; }
                this.updatePlayoffsWithWinner(match);
            }
            this.saveState();
        },
        
        handleSaveRules() {
            const s = this.state.settings;
            s.points.win = parseInt(document.getElementById('ptsWin').value);
            s.points.draw = parseInt(document.getElementById('ptsDraw').value);
            s.points.loss = parseInt(document.getElementById('ptsLoss').value);
            s.matchDuration = parseInt(document.getElementById('matchDuration').value);
            s.bonus.enabled = document.getElementById('bonusEnabled').checked;
            s.bonus.boPoints = parseInt(document.getElementById('boPoints').value);
            s.bonus.boMargin = parseInt(document.getElementById('boMargin').value);
            s.bonus.bdPoints = parseInt(document.getElementById('bdPoints').value);
            s.bonus.bdMargin = parseInt(document.getElementById('bdMargin').value);
            this.saveState();
        },

        handleGenerateMatches() {
            this.state.matches = this.state.matches.filter(m => m.type !== 'league');
            const teams = [...this.state.teams];
            if (teams.length % 2 !== 0) teams.push({ id: 'bye' }); // Handle odd number of teams

            const numRounds = teams.length - 1;
            const matchesPerRound = teams.length / 2;

            for (let i = 0; i < numRounds; i++) {
                for (let j = 0; j < matchesPerRound; j++) {
                    const teamA = teams[j];
                    const teamB = teams[teams.length - 1 - j];
                    if (teamA.id !== 'bye' && teamB.id !== 'bye') {
                        this.state.matches.push(this.createMatchObject(teamA.id, teamB.id, i + 1, 'league'));
                    }
                }
                // Rotate teams
                teams.splice(1, 0, teams.pop());
            }

            if(document.getElementById('allerRetour').checked) {
                const roundRobinMatches = [...this.state.matches];
                roundRobinMatches.forEach(m => {
                    this.state.matches.push(this.createMatchObject(m.teamB, m.teamA, m.day + numRounds, 'league'));
                });
            }
            
            this.saveState();
        },
        
        handleGeneratePlayoffs() {
            this.state.matches = this.state.matches.filter(m => m.type !== 'playoff');
            const standings = this.calculateStats();
            if (standings.length < 6) return alert("Il faut au moins 6 équipes pour générer les phases finales.");

            const [t1, t2, t3, t4, t5, t6] = standings.map(s => s.id);
            
            // Barrages
            this.state.matches.push(this.createMatchObject(t3, t6, 1, 'playoff', 'Barrage'));
            this.state.matches.push(this.createMatchObject(t4, t5, 1, 'playoff', 'Barrage'));
            
            // Demis (winners TBD)
            this.state.matches.push(this.createMatchObject(t1, null, 1, 'playoff', 'Demi-finale'));
            this.state.matches.push(this.createMatchObject(t2, null, 1, 'playoff', 'Demi-finale'));

            // Finale (winners TBD)
            this.state.matches.push(this.createMatchObject(null, null, 1, 'playoff', 'Finale'));

            this.saveState();
        },

        handleRevertMatch(matchId) {
            const match = this.state.matches.find(m => m.id === matchId);
            if(match) {
                Object.assign(match, {
                    status: 'upcoming',
                    scoreA: 0, scoreB: 0,
                    scorersA: [], scorersB: [],
                    timer: this.state.settings.matchDuration * 60
                });
                this.saveState();
                this.renderFinishedMatches(document.querySelector('.filterbar .chip.active')?.dataset.filter || 'Toutes');
            }
        },

        handleFilterFinished(button) {
            this.renderFinishedMatches(button.dataset.filter);
        },

        // =============== UTILITY FUNCTIONS ===============
        createMatchObject(teamA, teamB, day, type, round = '') {
            return {
                id: `m${Date.now()}${Math.random()}`,
                teamA, teamB, day, type, round,
                status: 'upcoming',
                scoreA: 0, scoreB: 0,
                scorersA: [], scorersB: [],
                timer: this.state.settings.matchDuration * 60,
            };
        },

        updatePlayoffsWithWinner(finishedMatch) {
            if (finishedMatch.type !== 'playoff') return;

            const winnerId = finishedMatch.scoreA > finishedMatch.scoreB ? finishedMatch.teamA : finishedMatch.teamB;
            const loserId = finishedMatch.scoreA < finishedMatch.scoreB ? finishedMatch.teamA : finishedMatch.teamB;
            const standings = this.calculateStats();
            const [t1, t2] = standings.map(s => s.id);

            // Update Demis
            if (finishedMatch.round === 'Barrage') {
                const demi1 = this.state.matches.find(m => m.round === 'Demi-finale' && m.teamA === t1);
                const demi2 = this.state.matches.find(m => m.round === 'Demi-finale' && m.teamA === t2);

                // Assuming 3v6 and 4v5, and 1st plays winner of 4v5
                if (finishedMatch.teamA === standings[3].id || finishedMatch.teamB === standings[3].id) { // This is 4v5
                     if (demi1) demi1.teamB = winnerId;
                } else { // This is 3v6
                     if (demi2) demi2.teamB = winnerId;
                }
            }
            // Update Finale
            else if (finishedMatch.round === 'Demi-finale') {
                const finale = this.state.matches.find(m => m.round === 'Finale');
                if (finale) {
                    if (!finale.teamA) finale.teamA = winnerId;
                    else if (!finale.teamB) finale.teamB = winnerId;
                }
            }
        }
    };

    App.init();
});
