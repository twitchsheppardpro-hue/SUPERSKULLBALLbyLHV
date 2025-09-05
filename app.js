filename:app.js
document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // STATE
        state: {
            teams: [],
            schedule: [],
            playoffs: [],
            results: {}, // { matchId: { ga, gb, scorers: [] } }
            rules: {
                win: 3, draw: 1, loss: 0,
                bonus: true,
                boMargin: 3,
                bdMargin: 1,
                duration: 15
            },
            liveMatch: {
                id: null,
                teamA: null, teamB: null,
                scoreA: 0, scoreB: 0,
                scorersA: [], scorersB: [],
                timer: null, timeLeft: 900,
                status: 'upcoming' // upcoming, live, finished
            }
        },
        
        // DOM ELEMENTS
        elements: {
            mainNav: document.querySelector('.main-nav'),
            tabs: document.querySelectorAll('.tab-content'),
            subTabs: document.querySelectorAll('.sub-tab-content'),
            // ... more elements fetched as needed
        },

        // INITIALIZATION
        init() {
            this.loadState();
            this.setupEventListeners();
            this.fetchData();
        },
        
        // DATA & PERSISTENCE
        fetchData() {
            fetch('./data/team.json')
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
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
        
        // EVENT LISTENERS
        setupEventListeners() {
            // Main tabs
            this.elements.mainNav.addEventListener('click', e => {
                if (e.target.matches('.pill')) {
                    const tabId = e.target.dataset.tab;
                    this.elements.mainNav.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    this.elements.tabs.forEach(tab => tab.classList.toggle('active', tab.id === `tab-${tabId}`));
                }
            });
            document.querySelector('.admin-pill').addEventListener('click', e => this.elements.mainNav.dispatchEvent(new Event('click', {bubbles:true})));
            
            // Sub-tabs
            document.querySelector('#tab-classement .sub-nav').addEventListener('click', e => {
                 if (e.target.matches('.sub-pill')) {
                    const subTabId = e.target.dataset.subTab;
                    document.querySelector('#tab-classement .sub-nav .active').classList.remove('active');
                    e.target.classList.add('active');
                    document.querySelectorAll('#tab-classement .sub-tab-content').forEach(subTab => subTab.classList.toggle('active', subTab.id === `view-${subTabId}`));
                }
            });
            
            // Admin form
            document.getElementById('rules-form').addEventListener('change', () => this.updateRules());
            document.getElementById('retry-fetch').addEventListener('click', () => this.fetchData());
            document.getElementById('generate-schedule-fallback').addEventListener('click', () => this.generateSchedule() && this.renderAll());
            document.getElementById('generate-playoffs-fallback').addEventListener('click', () => this.renderPlayoffs());
        },

        // SCHEDULING
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
                // Rotate teams
                teams.splice(1, 0, teams.pop());
            }
             if (this.state.schedule.length > 0 && this.state.schedule[0].matches.length > 0) {
                const firstMatch = this.state.schedule[0].matches[0];
                this.setLiveMatch(firstMatch.id);
             }
        },

        // RENDER FUNCTIONS
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
                
                return `
                    <tr class="${rankClass}">
                        <td class="pos">${index + 1}</td>
                        <td class="team-col"><div class="team-cell"><img src="${s.logo}" alt="${s.name}"><span>${s.name}</span></div></td>
                        <td>${s.j}</td><td>${s.g}</td><td>${s.n}</td><td>${s.p}</td>
                        <td>${s.bp}</td><td>${s.bc}</td><td>${s.diff}</td><td>${s.bo}</td><td>${s.bd}</td><td class="pts">${s.pts}</td>
                    </tr>
                `;
            }).join('');
        },

        renderPlayoffs() {
            const container = document.querySelector('.playoffs-grid');
            if (!container) return;
            
            const standings = this.calculateStandings();
            standings.sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp || a.name.localeCompare(b.name));
            
            let html = '';
            // This part should be dynamically built based on team count and playoff structure
            // Simplified example for >= 6 teams
            if (standings.length >= 6) {
                // Mock playoff structure, would be dynamically generated
                html = `
                    <div class="playoff-column"><h3>Barrages</h3>...</div>
                    <div class="playoff-column"><h3>Demi-finales</h3>...</div>
                    <div class="playoff-column"><h3>Finale</h3>...</div>
                `;
            } else if (standings.length >= 4) {
                 html = `
                    <div class="playoff-column"><h3>Demi-finales</h3>...</div>
                    <div class="playoff-column"><h3>Finale</h3>...</div>
                `;
            } else if (standings.length >= 2) {
                 html = `<div class="playoff-column"><h3>Finale</h3>...</div>`;
            }

            container.innerHTML = html || '<p class="caption">Pas assez d\'équipes pour la phase finale.</p>';
        },

        renderScorers() {
            const body = document.getElementById('scorers-body');
            if (!body) return;

            const allScorers = {};
            Object.values(this.state.results).forEach(result => {
                (result.scorers || []).forEach(scorer => {
                    if (!allScorers[scorer.name]) {
                        allScorers[scorer.name] = { name: scorer.name, goals: 0, teamId: scorer.teamId };
                    }
                    allScorers[scorer.name].goals++;
                });
            });

            const sortedScorers = Object.values(allScorers).sort((a, b) => b.goals - a.goals);

            body.innerHTML = sortedScorers.map((s, index) => {
                const team = this.getTeamById(s.teamId);
                return `
                    <tr>
                        <td class="pos">${index + 1}</td>
                        <td class="player-col">${s.name}</td>
                        <td class="club-col"><img src="${team.logo}" alt="${team.name}"></td>
                        <td class="goals-col">${s.goals}</td>
                    </tr>
                `;
            }).join('');
        },

        renderLiveMatch() {
            const container = document.getElementById('live-match-container');
            if (!container || !this.state.liveMatch.id) {
                if (container) container.innerHTML = '<div class="panel"><p>Aucun match en direct.</p></div>';
                return;
            }

            const { id, teamA, teamB, scoreA, scoreB, scorersA, scorersB, timeLeft, status } = this.state.liveMatch;
            const day = this.findMatchDay(id);

            const formatTime = (seconds) => {
                const min = Math.floor(seconds / 60).toString().padStart(2, '0');
                const sec = (seconds % 60).toString().padStart(2, '0');
                return `${min}:${sec}`;
            };
            
            const renderPlayerButtons = (team) => {
                if (!team || !team.players) return '';
                return team.players.map(player => {
                    if (!player || player.toLowerCase() === 'nul') return '';
                    return `<button class="player-btn" data-team-id="${team.id}" data-player="${player}">${player}</button>`;
                }).join('');
            };
            
            const renderScorersList = (scorers) => scorers.map(s => `<span>${s.name} ${s.minute}'</span>`).join(', ');

            container.innerHTML = `
                <div class="live-card">
                    <div class="live-team team-a">
                        <div class="team-header"><img src="${teamA.logo}" alt="" class="logo"><span class="name">${teamA.name}</span></div>
                         <div class="scorers-overlay">⚽ ${renderScorersList(scorersA)}</div>
                    </div>
                    <div class="live-center">
                        <span class="live-status">${status.toUpperCase()}</span>
                        <div class="live-score">${scoreA} - ${scoreB}</div>
                        <div class="live-timer">${formatTime(timeLeft)}</div>
                        <span class="live-day">Journée ${day}</span>
                        <div class="live-controls">
                            <div class="main-controls">
                                <button data-action="play">▶</button>
                                <button data-action="pause">❚❚</button>
                                <button data-action="reset">↻</button>
                            </div>
                            <button class="finish-match-btn" data-action="finish">Match terminé</button>
                        </div>
                    </div>
                     <div class="live-team team-b">
                        <div class="team-header"><span class="name">${teamB.name}</span><img src="${teamB.logo}" alt="" class="logo"></div>
                        <div class="scorers-overlay">⚽ ${renderScorersList(scorersB)}</div>
                    </div>
                </div>
                 <div class="player-packs">
                    <div class="player-grid">${renderPlayerButtons(teamA)}</div>
                    <div class="side-controls">
                        <button class="minus-btn" data-action="remove-goal" data-team-side="A">-</button>
                        <button class="forfeit-btn" data-action="forfeit" data-team-side="A">F</button>
                    </div>
                    <div class="side-controls">
                        <button class="minus-btn" data-action="remove-goal" data-team-side="B">-</button>
                        <button class="forfeit-btn" data-action="forfeit" data-team-side="B">F</button>
                    </div>
                    <div class="player-grid">${renderPlayerButtons(teamB)}</div>
                </div>
            `;
            this.setupLiveMatchListeners();
        },

        renderFinishedMatches() { /* ... Implementation ... */ },
        renderAdminForm() {
            document.getElementById('pts-win').value = this.state.rules.win;
            document.getElementById('pts-draw').value = this.state.rules.draw;
            document.getElementById('pts-loss').value = this.state.rules.loss;
            document.getElementById('bonus-enabled').value = this.state.rules.bonus;
            document.getElementById('bo-margin').value = this.state.rules.boMargin;
            document.getElementById('bd-margin').value = this.state.rules.bdMargin;
            document.getElementById('match-duration').value = this.state.rules.duration;
        },
        
        // LIVE MATCH LOGIC
        setupLiveMatchListeners() {
            const container = document.getElementById('live-match-container');
            if (!container) return;
            container.addEventListener('click', e => {
                const action = e.target.dataset.action;
                const player = e.target.dataset.player;

                if (player) {
                    this.addGoal(e.target.dataset.teamId, player);
                } else if (action) {
                    this[action]?.(e.target.dataset.teamSide); // Call action method
                }
            });
        },
        
        setLiveMatch(matchId) {
            const match = this.findMatchById(matchId);
            if (!match) return;

            this.state.liveMatch = {
                id: matchId,
                teamA: this.getTeamById(match.teamAId),
                teamB: this.getTeamById(match.teamBId),
                scoreA: 0, scoreB: 0,
                scorersA: [], scorersB: [],
                timer: null, timeLeft: this.state.rules.duration * 60,
                status: 'upcoming'
            };
        },
        
        play() {
            if (this.state.liveMatch.timer || this.state.liveMatch.status === 'finished') return;
            this.state.liveMatch.status = 'live';
            this.state.liveMatch.timer = setInterval(() => {
                this.state.liveMatch.timeLeft--;
                if (this.state.liveMatch.timeLeft <= 0) {
                    this.state.liveMatch.timeLeft = 0;
                    this.finish();
                }
                this.renderLiveMatch();
            }, 1000);
            this.renderLiveMatch();
        },
        pause() { clearInterval(this.state.liveMatch.timer); this.state.liveMatch.timer = null; },
        reset() { this.pause(); this.state.liveMatch.timeLeft = this.state.rules.duration * 60; this.renderLiveMatch(); },
        
        addGoal(teamId, playerName) {
            const minute = Math.floor((this.state.rules.duration * 60 - this.state.liveMatch.timeLeft) / 60);
            const scorer = { name: playerName, minute: minute, teamId: teamId };
            
            if (teamId == this.state.liveMatch.teamA.id) {
                this.state.liveMatch.scoreA++;
                this.state.liveMatch.scorersA.push(scorer);
            } else {
                this.state.liveMatch.scoreB++;
                this.state.liveMatch.scorersB.push(scorer);
            }
            this.renderLiveMatch();
        },
        
        removeGoal(teamSide) {
             if (teamSide === 'A' && this.state.liveMatch.scoreA > 0) {
                this.state.liveMatch.scoreA--;
                this.state.liveMatch.scorersA.pop();
            } else if (teamSide === 'B' && this.state.liveMatch.scoreB > 0) {
                this.state.liveMatch.scoreB--;
                this.state.liveMatch.scorersB.pop();
            }
            this.renderLiveMatch();
        },
        
        forfeit(teamSide) {
            if (teamSide === 'A') { this.state.liveMatch.scoreA = 0; this.state.liveMatch.scoreB = 3; }
            if (teamSide === 'B') { this.state.liveMatch.scoreA = 3; this.state.liveMatch.scoreB = 0; }
            this.finish();
        },

        finish() {
            this.pause();
            this.state.liveMatch.status = 'finished';
            
            this.state.results[this.state.liveMatch.id] = {
                ga: this.state.liveMatch.scoreA,
                gb: this.state.liveMatch.scoreB,
                scorers: [...this.state.liveMatch.scorersA, ...this.state.liveMatch.scorersB]
            };
            this.saveState();
            this.renderAll();
        },
        
        // CALCULATIONS & UTILS
        calculateStandings() {
            const stats = {};
            this.state.teams.forEach(t => {
                stats[t.id] = { id: t.id, name: t.name, logo: t.logo, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, diff: 0, bo: 0, bd: 0, pts: 0 };
            });

            this.state.schedule.forEach(round => round.matches.forEach(match => {
                const result = this.state.results[match.id];
                if (!result) return;
                
                const { teamAId, teamBId } = match;
                const sA = stats[teamAId];
                const sB = stats[teamBId];
                const { ga, gb } = result;
                
                sA.j++; sB.j++;
                sA.bp += ga; sB.bp += gb;
                sA.bc += gb; sB.bc += ga;
                sA.diff = sA.bp - sA.bc; sB.diff = sB.bp - sB.bc;

                if (ga > gb) {
                    sA.g++; sB.p++;
                    sA.pts += this.state.rules.win;
                    if (this.state.rules.bonus && (ga - gb) >= this.state.rules.boMargin) sA.bo++;
                    if (this.state.rules.bonus && (ga - gb) <= this.state.rules.bdMargin) sB.bd++;
                } else if (gb > ga) {
                    sB.g++; sA.p++;
                    sB.pts += this.state.rules.win;
                     if (this.state.rules.bonus && (gb - ga) >= this.state.rules.boMargin) sB.bo++;
                    if (this.state.rules.bonus && (gb - ga) <= this.state.rules.bdMargin) sA.bd++;
                } else {
                    sA.n++; sB.n++;
                    sA.pts += this.state.rules.draw;
                }
            }));
            return Object.values(stats);
        },

        updateRules() {
            this.state.rules.win = parseInt(document.getElementById('pts-win').value);
            this.state.rules.draw = parseInt(document.getElementById('pts-draw').value);
            this.state.rules.loss = parseInt(document.getElementById('pts-loss').value);
            this.state.rules.bonus = document.getElementById('bonus-enabled').value === 'true';
            this.state.rules.boMargin = parseInt(document.getElementById('bo-margin').value);
            this.state.rules.bdMargin = parseInt(document.getElementById('bd-margin').value);
            this.state.rules.duration = parseInt(document.getElementById('match-duration').value);
            this.saveState();
            this.renderStandings(); // Recalculate standings with new rules
        },
        
        getTeamById(id) { return this.state.teams.find(t => t.id == id); },
        findMatchById(id) { 
            for (const round of this.state.schedule) {
                const match = round.matches.find(m => m.id === id);
                if (match) return match;
            }
            return null;
        },
        findMatchDay(matchId) {
            const round = this.state.schedule.find(r => r.matches.some(m => m.id === matchId));
            return round ? round.day : '?';
        }
    };

    app.init();
});