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
  
