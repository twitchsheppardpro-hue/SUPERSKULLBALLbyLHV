filename:app.js
document.addEventListener('DOMContentLoaded', () => {
    const app = {
        state: {
            teams: [],
            schedule: [],
            results: {}, 
            rules: { win: 3, draw: 1, loss: 0, bonus: true, boMargin: 3, bdMargin: 1, duration: 15 },
            liveMatch: { id: null, timer: null, timeLeft: 900, status: 'upcoming', teamA: null, teamB: null, scoreA: 0, scoreB: 0, scorers: [] }
        },
        
        init() {
            this.loadState();
            this.setupEventListeners();
            this.fetchData();
        },
        
        fetchData() {
            fetch('./data/team.json')
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    this.state.teams = data.teams;
                    this.state.liveMatch.timeLeft = this.state.rules.duration * 60;
                    this.generateSchedule();
                    this.renderAll();
                    document.getElementById('error-banner').classList.add('hidden');
                })
                .catch(error => {
                    console.error('Fetch error:', error);
                    document.getElementById('error-banner').classList.remove('hidden');
                });
        },

        saveState() {
            localStorage.setItem('skullball:v1', JSON.stringify({ rules: this.state.rules, results: this.state.results }));
        },

        loadState() {
            const savedState = JSON.parse(localStorage.getItem('skullball:v1'));
            if (savedState) {
                this.state.rules = { ...this.state.rules, ...savedState.rules };
                this.state.results = savedState.results || {};
            }
        },
        
        setupEventListeners() {
            document.querySelector('.main-nav').addEventListener('click', e => this.handleTabClick(e, '.pill', '.tab-content', document.querySelector('.main-nav')));
            document.querySelector('.admin-pill').addEventListener('click', e => this.handleTabClick(e, '.pill', '.tab-content', document.querySelector('.main-nav')));
            document.querySelector('#tab-classement .sub-nav').addEventListener('click', e => this.handleTabClick(e, '.sub-pill', '.sub-tab-content', document.querySelector('#tab-classement .sub-nav')));
            document.getElementById('rules-form').addEventListener('change', () => this.updateRules());
            document.getElementById('retry-fetch').addEventListener('click', () => this.fetchData());
            document.getElementById('generate-schedule-fallback').addEventListener('click', () => { this.generateSchedule(); this.renderAll(); });
            document.getElementById('generate-playoffs-fallback').addEventListener('click', () => this.renderPlayoffs());
            document.getElementById('live-match-container').addEventListener('click', e => this.handleLiveMatchClick(e));
        },

        handleTabClick(e, pillSelector, contentSelector, navElement) {
            if (e.target.closest(pillSelector)) {
                const button = e.target.closest(pillSelector);
                const tabId = button.dataset.tab || button.dataset.subTab;
                navElement.querySelector('.active').classList.remove('active');
                button.classList.add('active');
                document.querySelectorAll(contentSelector).forEach(tab => tab.classList.toggle('active', tab.id.includes(tabId)));
            }
        },

        generateSchedule() {
            const teams = [...this.state.teams];
            if (teams.length === 0) return;
            if (teams.length % 2 !== 0) teams.push({ id: 'bye', name: 'BYE' });
            
            this.state.schedule = [];
            const rounds = teams.length - 1;
            for (let i = 0; i < rounds; i++) {
                const round = { day: i + 1, matches: [] };
                for (let j = 0; j < teams.length / 2; j++) {
                    const teamA = teams[j];
                    const teamB = teams[teams.length - 1 - j];
                    if (teamA.id !== 'bye' && teamB.id !== 'bye') {
                        round.matches.push({ id: `d${i+1}m${j+1}`, teamAId: teamA.id, teamBId: teamB.id });
                    }
                }
                this.state.schedule.push(round);
                teams.splice(1, 0, teams.pop());
            }
             if (this.state.schedule.length > 0 && this.state.schedule[0].matches.length > 0) {
                const firstMatchId = this.findNextMatchId();
                this.setLiveMatch(firstMatchId);
             }
        },

        renderAll() {
            this.renderStandings();
            this.renderPlayoffs();
            this.renderScorers();
            this.renderLiveMatch();
            this.renderFinishedMatches();
            this.renderAdminForm();
        },

        renderStandings() {
            const body = document.getElementById('standings-body');
            if (!body) return;
            
            const stats = this.calculateStandings();
            stats.sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp || a.name.localeCompare(b.name));

            body.innerHTML = stats.map((s, index) => {
                let rankClass = '';
                if (index < 2) rankClass = 'rank-gold';
                else if (index < 6) rankClass = 'rank-bronze';
                
                return `<tr class="${rankClass}"><td class="pos">${index + 1}</td><td class="team-col"><div class="team-cell"><img src="${s.logo}" alt=""><span>${s.name}</span></div></td><td>${s.j}</td><td>${s.g}</td><td>${s.n}</td><td>${s.p}</td><td>${s.bp}</td><td>${s.bc}</td><td>${s.diff}</td><td>${s.bo}</td><td>${s.bd}</td><td class="pts"><b>${s.pts}</b></td></tr>`;
            }).join('');
        },

        renderPlayoffs() { /* Simplified */ document.querySelector('.playoffs-grid').innerHTML = '<p class="caption">La phase finale sera affichée ici.</p>'; },
        
        renderScorers() {
            const body = document.getElementById('scorers-body');
            if (!body) return;
            const allScorers = {};
            Object.values(this.state.results).forEach(result => {
                (result.scorers || []).forEach(scorer => {
                    const p = this.getPlayerByName(scorer.teamId, scorer.name);
                    const key = p ? p.name : scorer.name;
                    if (!allScorers[key]) {
                        allScorers[key] = { name: key, goals: 0, teamId: scorer.teamId };
                    }
                    allScorers[key].goals++;
                });
            });
            const sortedScorers = Object.values(allScorers).sort((a, b) => b.goals - a.goals);
            body.innerHTML = sortedScorers.map((s, index) => {
                const team = this.getTeamById(s.teamId);
                return `<tr><td class="pos">${index + 1}</td><td class="player-col">${s.name}</td><td class="club-col"><img src="${team.logo}" alt="${team.name}"></td><td class="goals-col">${s.goals}</td></tr>`;
            }).join('');
        },

        renderLiveMatch() {
            const container = document.getElementById('live-match-container');
            const { id, teamA, teamB, scoreA, scoreB, scorers, timeLeft, status } = this.state.liveMatch;
            if (!id || !teamA || !teamB) {
                container.innerHTML = '<div class="panel"><p>Aucun match en direct sélectionné.</p></div>'; return;
            }
            const day = this.findMatchDay(id);
            const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
            const renderP = t => (t.players || []).map(p => (!p || p.toLowerCase() === 'nul') ? '' : `<button class="player-btn" data-team-id="${t.id}" data-player="${p}">${p}</button>`).join('');
            const renderS = side => scorers.filter(s => s.teamId === (side === 'A' ? teamA.id : teamB.id)).map(s => `${s.name} ${s.minute}'`).join(', ');

            container.innerHTML = `
                <div class="live-card-wrapper">
                    <div class="live-team-panel">
                        <div class="live-team-header team-a"><img src="${teamA.logo}" alt="" class="logo"><span class="name">${teamA.name}</span></div>
                        <div class="scorers-overlay">⚽ ${renderS('A')}</div>
                        <div class="player-grid">${renderP(teamA)}</div>
                        <div class="side-controls"><button class="minus-btn" data-action="remove-goal" data-team-side="A">-</button><button class="forfeit-btn" data-action="forfeit" data-team-side="A">F</button></div>
                    </div>
                    <div class="live-center-panel">
                        <span class="live-status">${{upcoming: 'À VENIR', live: 'EN DIRECT', finished: 'TERMINÉ'}[status]}</span>
                        <div class="live-score">${scoreA} - ${scoreB}</div>
                        <div class="live-timer">${formatTime(timeLeft)}</div>
                        <span class="live-day">Journée ${day}</span>
                        <div class="live-controls"><div class="main-controls"><button data-action="play" aria-label="Play">▶</button><button data-action="pause" aria-label="Pause">❚❚</button><button data-action="reset" aria-label="Reset">↻</button></div><button class="finish-match-btn" data-action="finish">Match terminé</button></div>
                    </div>
                    <div class="live-team-panel">
                        <div class="live-team-header team-b"><span class="name">${teamB.name}</span><img src="${teamB.logo}" alt="" class="logo"></div>
                        <div class="scorers-overlay">⚽ ${renderS('B')}</div>
                        <div class="player-grid">${renderP(teamB)}</div>
                        <div class="side-controls"><button class="minus-btn" data-action="remove-goal" data-team-side="B">-</button><button class="forfeit-btn" data-action="forfeit" data-team-side="B">F</button></div>
                    </div>
                </div>`;
        },
        
        renderFinishedMatches() { /* ... */ },
        renderAdminForm() { /* ... */ },

        handleLiveMatchClick(e) {
            const button = e.target.closest('button');
            if (!button) return;
            const { action, player, teamId, teamSide } = button.dataset;
            if (player) this.addGoal(teamId, player);
            else if (action && typeof this[action] === 'function') this[action](teamSide);
        },
        
        setLiveMatch(matchId) {
            const match = this.findMatchById(matchId);
            if (!match) return;
            this.state.liveMatch = { id: matchId, teamA: this.getTeamById(match.teamAId), teamB: this.getTeamById(match.teamBId), scoreA: 0, scoreB: 0, scorers: [], timer: null, timeLeft: this.state.rules.duration * 60, status: 'upcoming' };
            this.renderLiveMatch();
        },
        
        play() {
            if (this.state.liveMatch.timer || this.state.liveMatch.status === 'finished') return;
            this.state.liveMatch.status = 'live';
            this.state.liveMatch.timer = setInterval(() => {
                if (this.state.liveMatch.timeLeft > 0) this.state.liveMatch.timeLeft--; else this.finish();
                document.querySelector('.live-timer').textContent = `${String(Math.floor(this.state.liveMatch.timeLeft/60)).padStart(2,'0')}:${String(this.state.liveMatch.timeLeft%60).padStart(2,'0')}`;
            }, 1000);
            document.querySelector('.live-status').textContent = 'EN DIRECT';
        },
        pause() { clearInterval(this.state.liveMatch.timer); this.state.liveMatch.timer = null; },
        reset() { this.pause(); this.state.liveMatch.timeLeft = this.state.rules.duration * 60; this.renderLiveMatch(); },
        
        addGoal(teamId, playerName) {
            const minute = Math.floor((this.state.rules.duration * 60 - this.state.liveMatch.timeLeft) / 60);
            this.state.liveMatch.scorers.push({ name: playerName, minute, teamId });
            if (teamId == this.state.liveMatch.teamA.id) this.state.liveMatch.scoreA++; else this.state.liveMatch.scoreB++;
            this.renderLiveMatch();
        },
        
        removeGoal(teamSide) {
             const teamIdToRemove = teamSide === 'A' ? this.state.liveMatch.teamA.id : this.state.liveMatch.teamB.id;
             const lastGoalIndex = this.state.liveMatch.scorers.map(s => s.teamId).lastIndexOf(teamIdToRemove);
             if (lastGoalIndex > -1) {
                this.state.liveMatch.scorers.splice(lastGoalIndex, 1);
                if (teamSide === 'A') this.state.liveMatch.scoreA--; else this.state.liveMatch.scoreB--;
                this.renderLiveMatch();
             }
        },
        
        forfeit(teamSide) {
            if (teamSide === 'A') { this.state.liveMatch.scoreA = 0; this.state.liveMatch.scoreB = 3; }
            if (teamSide === 'B') { this.state.liveMatch.scoreA = 3; this.state.liveMatch.scoreB = 0; }
            this.finish();
        },

        finish() {
            this.pause();
            this.state.liveMatch.status = 'finished';
            this.state.results[this.state.liveMatch.id] = { ga: this.state.liveMatch.scoreA, gb: this.state.liveMatch.scoreB, scorers: this.state.liveMatch.scorers };
            this.saveState();
            this.renderAll();
            const nextMatchId = this.findNextMatchId();
            if (nextMatchId) this.setLiveMatch(nextMatchId); else this.state.liveMatch.id = null;
            this.renderLiveMatch();
        },
        
        calculateStandings() {
            const stats = {};
            this.state.teams.forEach(t => { stats[t.id] = { id: t.id, name: t.name, logo: t.logo, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, diff: 0, bo: 0, bd: 0, pts: 0 }; });
            this.state.schedule.forEach(round => round.matches.forEach(match => {
                const result = this.state.results[match.id]; if (!result) return;
                const { teamAId, teamBId } = match; const { ga, gb } = result;
                const sA = stats[teamAId]; const sB = stats[teamBId];
                sA.j++; sB.j++; sA.bp += ga; sB.bp += gb
