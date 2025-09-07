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
            this.render();
        },

        // =============== EVENT LISTENERS ===============
        setupEventListeners() {
            document.getElementById('mainNav').addEventListener('click', e => {
                if (e.target.matches('.pill')) this.handleTabSwitch(e, '#mainNav', 'section');
            });
             document.getElementById('adminBtn').addEventListener('click', e => {
                if (e.target.matches('.pill')) this.handleTabSwitch(e, '#mainNav, .admin', 'section');
            });

            document.querySelector('#tab-classement .subnav').addEventListener('click', e => {
                if (e.target.matches('.pill.sub')) this.handleTabSwitch(e, '.subnav', 'view');
            });
            
            document.body.addEventListener('click', e => {
                const target = e.target;
                if (target.closest('.control-btn')) this.handleLiveMatchControls(target.closest('.control-btn'));
                if (target.matches('.finish-btn')) this.handleLiveMatchControls(target);
                if (target.closest('.player-btn, .action-btn')) this.handlePlayerAction(target.closest('.player-btn, .action-btn'));
                if (target.id === 'save-rules-btn') this.handleSaveRules();
                if (target.id === 'generate-matches-btn') this.handleGenerateMatches();
                if (target.id === 'generate-playoffs-btn') this.handleGeneratePlayoffs();
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

        renderPhaseFinale() {
            const container = document.getElementById('view-bracket');
            const { barrages, demis, finale } = this.getPlayoffMatches();
            const createMatchHTML = (match) => {
                if (!match) return '<div class="bracket-match placeholder"></div>';
                const teamA = this.state.teams.find(t => t.id === match.teamA) || { name: 'À déterminer', logo: '' };
                const teamB = this.state.teams.find(t => t.id === match.teamB) || { name: 'À déterminer', logo: '' };
                const isFinished = match.status === 'finished';
                let winnerA = '', winnerB = '';
                if(isFinished) {
                    if (match.scoreA > match.scoreB) winnerA = 'winner';
                    if (match.scoreB > match.scoreA) winnerB = 'winner';
                }
                return `
                    <div class="bracket-match">
                        <div class="bracket-team ${winnerA}">
                            <img src="${teamA.logo}" class="logo"><span class="bracket-team-name">${teamA.name}</span>
                            <span class="bracket-team-score">${isFinished ? match.scoreA : '-'}</span>
                        </div>
                        <div class="bracket-team ${winnerB}">
                            <img src="${teamB.logo}" class="logo"><span class="bracket-team-name">${teamB.name}</span>
                            <span class="bracket-team-score">${isFinished ? match.scoreB : '-'}</span>
                        </div>
                    </div>`;
            };
            container.innerHTML = `
                <div class="bracket-grid">
                    <div class="bracket-column"><h3>Barrages</h3>${barrages.map(createMatchHTML).join('') || createMatchHTML(null)}</div>
                    <div class="bracket-column"><h3>Demi-finales</h3>${demis.map(createMatchHTML).join('') || createMatchHTML(null)}</div>
                    <div class="bracket-column"><h3>Finale</h3>${createMatchHTML(finale)}</div>
                </div>`;
        },

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
                    <thead><tr><th class="pos">#</th><th>Joueur</th><th>Club</th><th>Buts</th></tr></thead>
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

        renderLiveMatches() {
           const container = document.getElementById('tab-live');
            container.innerHTML = '';
            const matchesByDay = {};
            this.state.matches
                .filter(m => m.status === 'upcoming' || m.status === 'live')
                .sort((a, b) => a.day - b.day || (a.round || '').localeCompare(b.round || ''))
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

        renderFinishedMatches(filter = 'Toutes') {
            const listContainer = document.getElementById('finished-list');
            const filterbar = document.getElementById('finishedFilter');
            listContainer.innerHTML = '';
            const finishedMatches = this.state.matches.filter(m => m.status === 'finished');
            
            const days = ['Toutes', ...new Set(finishedMatches.filter(m => m.type === 'league').map(m => `J${m.day}`)), ...new Set(finishedMatches.filter(m => m.type === 'playoff').map(m => m.round))];
            filterbar.innerHTML = [...new Set(days)].map(d => `<button class="chip ${filter === d ? 'active' : ''}" data-filter="${d}">${d}</button>`).join('');

            const matchesToDisplay = finishedMatches.filter(m => {
                if (filter === 'Toutes') return true;
                if (filter.startsWith('J')) return `J${m.day}` === filter;
                return m.round === filter;
            });
            
            if (matchesToDisplay.length > 0) {
                 matchesToDisplay.forEach(match => {
                    const teamA = this.state.teams.find(t => t.id === match.teamA);
                    const teamB = this.state.teams.find(t => t.id === match.teamB);
                    const card = document.createElement('div');
                    card.className = 'finished-card';
                    card.innerHTML = `
                        <div class="team team-a"><img class="logo" src="${teamA.logo}"> ${teamA.name}</div>
                        <div class="score">${match.scoreA} - ${match.scoreB}</div>
                        <div class="team team-b">${teamB.name} <img class="logo" src="${teamB.logo}"></div>
                        <div class="details">
                            <strong>Buteurs:</strong> 
                            ${[...(match.scorersA || []), ...(match.scorersB || [])].map(s => `${s.name} (${s.minute}')`).join(', ') || 'Aucun'}
                        </div>
                        <button class="revert-btn" data-match-id="${match.id}">Annuler le résultat</button>`;
                    listContainer.appendChild(card);
                });
            } else {
                listContainer.innerHTML = `<p>Aucun match terminé pour cette sélection.</p>`;
            }
        },
        
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
                <button id="save-rules-btn" class="admin-btn">Sauvegarder Règles</button>`;
            matchesContainer.innerHTML = `
                <div class="form-group checkbox-group"><input type="checkbox" id="allerRetour"><label for="allerRetour">Matchs Aller/Retour</label></div>
                <button id="generate-matches-btn" class="admin-btn">Générer les Matchs</button>
                <button id="generate-playoffs-btn" class="admin-btn">Générer les Phases Finales</button>`;
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
                return Object.entries(grouped)
                    .map(([name, times]) => `<span>⚽ ${name} (${times.join(', ')})</span>`)
                    .join('');
            };
        
            const createPlayerButtons = (team) => {
                let buttonsHTML = '';
                for (let i = 0; i < 6; i++) {
                    const player = team.players[i];
                    if (player && player.trim().toUpperCase() !== "0NULL") {
                        buttonsHTML += `<button class="player-btn" data-player-name="${player}" data-team-id="${team.id}">${player}</button>`;
                    } else {
                        buttonsHTML += `<button class="player-btn hidden" disabled></button>`;
                    }
                }
                return buttonsHTML;
            };
        
            card.innerHTML = `
                <div class="game-card-main">
                    <div class="team-bg-gradient" style="background: linear-gradient(90deg, ${teamA.color}30 0%, rgba(12,19,27,0) 50%, ${teamB.color}30 100%);"></div>
                    <div class="game-team team-a">
                        <div class="team-info"><img src="${teamA.logo}" class="logo"><span class="name">${teamA.name}</span></div>
                        <div class="scorers-log">${formatScorers(match.scorersA)}</div>
                        <div class="player-buttons">${createPlayerButtons(teamA)}</div>
                        <div class="team-actions">
                            <button class="action-btn minus" data-team-id="${teamA.id}">-</button>
                            <button class="action-btn forfeit" data-team-id="${teamA.id}">F</button>
                        </div>
                    </div>
                    <div class="game-center">
                        <div class="game-day">${match.type === 'playoff' ? match.round : `Journée ${match.day}`}</div>
                        <div class="game-status ${match.status}">${match.status === 'live' ? 'EN DIRECT' : 'À VENIR'}</div>
                        <div class="game-score">${match.scoreA}&nbsp;-&nbsp;${match.scoreB}</div>
                        <div class="game-timer">${String(Math.floor(match.timer / 60)).padStart(2, '0')}:${String(match.timer % 60).padStart(2, '0')}</div>
                        <div class="center-controls">
                            <button class="control-btn play" data-action="play">▶</button>
                            <button class="control-btn pause" data-action="pause">⏸</button>
                            <button class="control-btn reset" data-action="reset">↺</button>
                        </div>
                        <button class="finish-btn" data-action="finish">Match Terminé</button>
                    </div>
                    <div class="game-team team-b">
                        <div class="team-info"><span class="name">${teamB.name}</span><img src="${teamB.logo}" class="logo"></div>
                        <div class="scorers-log">${formatScorers(match.scorersB)}</div>
                        <div class="player-buttons">${createPlayerButtons(teamB)}</div>
                        <div class="team-actions">
                            <button class="action-btn minus" data-team-id="${teamB.id}">-</button>
                            <button class="action-btn forfeit" data-team-id="${teamB.id}">F</button>
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
                    const sA = stats[m.teamA], sB = stats[m.teamB];
                    if(!sA || !sB) return;
                    sA.J++; sB.J++;
                    sA.BP += m.scoreA; sA.BC += m.scoreB;
                    sB.BP += m.scoreB; sB.BC += m.scoreA;
                    if (m.scoreA > m.scoreB) {
                        sA.G++; sB.P++; sA.Pts += this.state.settings.points.win; sB.Pts += this.state.settings.points.loss;
                        if (this.state.settings.bonus.enabled) {
                            if ((m.scoreA - m.scoreB) >= this.state.settings.bonus.boMargin) { sA.BO++; sA.Pts += this.state.settings.bonus.boPoints; }
                            if ((m.scoreA - m.scoreB) <= this.state.settings.bonus.bdMargin) { sB.BD++; sB.Pts += this.state.settings.bonus.bdPoints; }
                        }
                    } else if (m.scoreB > m.scoreA) {
                        sB.G++; sA.P++; sB.Pts += this.state.settings.points.win; sA.Pts += this.state.settings.points.loss;
                         if (this.state.settings.bonus.enabled) {
                            if ((m.scoreB - m.scoreA) >= this.state.settings.bonus.boMargin) { sB.BO++; sB.Pts += this.state.settings.bonus.boPoints; }
                            if ((m.scoreB - m.scoreA) <= this.state.settings.bonus.bdMargin) { sA.BD++; sA.Pts += this.state.settings.bonus.bdPoints; }
                        }
                    } else { sA.N++; sB.N++; sA.Pts += this.state.settings.points.draw; sB.Pts += this.state.settings.points.draw; }
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
            const tabId = viewPrefix === 'section' ? `tab-${button.dataset.tab}` : `view-${button.dataset.sub}`;
            if (viewPrefix === 'section') {
                document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
                document.getElementById(tabId)?.classList.remove('hidden');
            } else {
                document.querySelectorAll('#tab-classement > div').forEach(v => v.classList.add('hidden'));
                document.getElementById(tabId)?.classList.remove('hidden');
            }
        },

       handleLiveMatchControls(button) {
            const action = button.dataset.action;
            const matchId = button.closest('.game-card').dataset.matchId;
            const match = this.state.matches.find(m => m.id === matchId);
            if (!match) return;
            if (action === 'play') {
                if (match.status === 'upcoming') match.status = 'live';
                if (this.state.timers[matchId]) return;
                this.state.timers[matchId] = setInterval(() => {
                    if (match.timer > 0) { match.timer--; this.renderLiveMatches(); } 
                    else { clearInterval(this.state.timers[matchId]); delete this.state.timers[matchId]; }
                }, 1000);
            } else if (action === 'pause') {
                clearInterval(this.state.timers[matchId]);
                delete this.state.timers[matchId];
            } else if (action === 'reset') {
                clearInterval(this.state.timers[matchId]);
                delete this.state.timers[matchId];
                Object.assign(match, { status: 'upcoming', scoreA: 0, scoreB: 0, scorersA: [], scorersB: [], timer: this.state.settings.matchDuration * 60 });
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
            if (!match || match.status === 'finished') return;
            const teamId = button.dataset.teamId;
            if (button.matches('.player-btn')) {
                const playerName = button.dataset.playerName;
                const totalDuration = this.state.settings.matchDuration * 60;
                const minute = Math.floor((totalDuration - match.timer) / 60) + 1;
                const scorer = { name: playerName, minute: Math.max(1, minute), teamId };
                if (teamId === match.teamA) {
                    match.scoreA = (match.scoreA || 0) + 1;
                    match.scorersA.push(scorer);
                } else {
                    match.scoreB = (match.scoreB || 0) + 1;
                    match.scorersB.push(scorer);
                }
            } else if (button.matches('.action-btn.minus')) {
                if (teamId === match.teamA && match.scoreA > 0) { match.scoreA--; match.scorersA.pop(); } 
                else if (teamId === match.teamB && match.scoreB > 0) { match.scoreB--; match.scorersB.pop(); }
            } else if (button.matches('.action-btn.forfeit')) {
                if (confirm(`Confirmer le forfait ? Le score sera de 3-0 pour l'adversaire.`)) {
                    Object.assign(match, { status: 'finished', scoreA: teamId === match.teamA ? 0 : 3, scoreB: teamId === match.teamB ? 0 : 3, scorersA: [], scorersB: [] });
                    clearInterval(this.state.timers[matchId]);
                    delete this.state.timers[matchId];
                    this.updatePlayoffsWithWinner(match);
                }
            }
            this.saveState();
        },
        
        handleSaveRules() {
            const s = this.state.settings;
            s.points = { win: parseInt(document.getElementById('ptsWin').value), draw: parseInt(document.getElementById('ptsDraw').value), loss: parseInt(document.getElementById('ptsLoss').value) };
            s.matchDuration = parseInt(document.getElementById('matchDuration').value);
            s.bonus = { enabled: document.getElementById('bonusEnabled').checked, boPoints: parseInt(document.getElementById('boPoints').value), boMargin: parseInt(document.getElementById('boMargin').value), bdPoints: parseInt(document.getElementById('bdPoints').value), bdMargin: parseInt(document.getElementById('bdMargin').value) };
            this.saveState();
        },

        handleGenerateMatches() {
            this.state.matches = this.state.matches.filter(m => m.type !== 'league');
            const teams = [...this.state.teams];
            if (teams.length < 2) return alert("Il faut au moins 2 équipes.");
            if (teams.length % 2 !== 0) teams.push({ id: 'bye' });
            const numRounds = teams.length - 1;
            for (let i = 0; i < numRounds; i++) {
                for (let j = 0; j < teams.length / 2; j++) {
                    const teamA = teams[j], teamB = teams[teams.length - 1 - j];
                    if (teamA.id !== 'bye' && teamB.id !== 'bye') {
                        this.state.matches.push(this.createMatchObject(teamA.id, teamB.id, i + 1, 'league'));
                    }
                }
                teams.splice(1, 0, teams.pop());
            }
            if(document.getElementById('allerRetour').checked) {
                const roundRobinMatches = this.state.matches.filter(m=>m.type === 'league');
                roundRobinMatches.forEach(m => {
                    this.state.matches.push(this.createMatchObject(m.teamB, m.teamA, m.day + numRounds, 'league'));
                });
            }
            this.saveState();
        },
        
        handleGeneratePlayoffs() {
            this.state.matches = this.state.matches.filter(m => m.type !== 'playoff');
            const standings = this.calculateStats();
            if (standings.length < 6) return alert("Il faut au moins 6 équipes.");
            const [t1, t2, t3, t4, t5, t6] = standings.map(s => s.id);
            this.state.matches.push(this.createMatchObject(t3, t6, 1, 'playoff', 'Barrage'));
            this.state.matches.push(this.createMatchObject(t4, t5, 1, 'playoff', 'Barrage'));
            this.state.matches.push(this.createMatchObject(t1, null, 1, 'playoff', 'Demi-finale'));
            this.state.matches.push(this.createMatchObject(t2, null, 1, 'playoff', 'Demi-finale'));
            this.state.matches.push(this.createMatchObject(null, null, 1, 'playoff', 'Finale'));
            this.saveState();
        },

        handleRevertMatch(matchId) {
            const match = this.state.matches.find(m => m.id === matchId);
            if(match) {
                Object.assign(match, { status: 'upcoming', scoreA: 0, scoreB: 0, scorersA: [], scorersB: [], timer: this.state.settings.matchDuration * 60 });
                this.saveState();
            }
        },

        handleFilterFinished(button) {
            this.renderFinishedMatches(button.dataset.filter);
        },

        // =============== UTILITY FUNCTIONS ===============
        createMatchObject(teamA, teamB, day, type, round = '') {
            return {
                id: `m${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
                teamA, teamB, day, type, round,
                status: 'upcoming', scoreA: 0, scoreB: 0,
                scorersA: [], scorersB: [],
                timer: this.state.settings.matchDuration * 60,
            };
        },

        updatePlayoffsWithWinner(finishedMatch) {
            if (finishedMatch.type !== 'playoff') return;
            const winnerId = finishedMatch.scoreA > finishedMatch.scoreB ? finishedMatch.teamA : finishedMatch.teamB;
            const standings = this.calculateStats();
            const [t1, t2, t3, t4, t5, t6] = standings.map(s => s.id);
            if (finishedMatch.round === 'Barrage') {
                const demi1 = this.state.matches.find(m => m.round === 'Demi-finale' && m.teamA === t1);
                const demi2 = this.state.matches.find(m => m.round === 'Demi-finale' && m.teamA === t2);
                if ((finishedMatch.teamA === t4 && finishedMatch.teamB === t5) || (finishedMatch.teamA === t5 && finishedMatch.teamB === t4)) { if (demi1) demi1.teamB = winnerId; } 
                else { if (demi2) demi2.teamB = winnerId; }
            }
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
