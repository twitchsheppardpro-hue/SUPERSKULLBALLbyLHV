// REMPLACEZ la fonction createGameCard existante par celle-ci
createGameCard(match) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.matchId = match.id;

    const teamA = this.state.teams.find(t => t.id === match.teamA);
    const teamB = this.state.teams.find(t => t.id === match.teamB);

    // Fonction pour générer la liste des buteurs
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

    // Fonction pour créer la grille de 6 boutons joueurs
    const createPlayerButtons = (team) => {
        let buttonsHTML = '';
        for (let i = 0; i < 6; i++) {
            const player = team.players[i];
            // Si le joueur est "0NULL" ou n'existe pas, le bouton est caché mais occupe l'espace
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
            <div class="team-bg-gradient" style="background: linear-gradient(90deg, ${teamA.color} 0%, rgba(12,19,27,0) 50%, ${teamB.color} 100%);"></div>
            <div class="team-bg-logo left" style="background-image: url('${teamA.logo}')"></div>
            <div class="team-bg-logo right" style="background-image: url('${teamB.logo}')"></div>

            <!-- ===== Équipe A (Gauche) ===== -->
            <div class="game-team team-a">
                <div class="team-info">
                    <img src="${teamA.logo}" class="logo" alt="${teamA.name}">
                    <span class="name">${teamA.name}</span>
                </div>
                <div class="scorers-log">${formatScorers(match.scorersA)}</div>
                <div class="player-buttons">${createPlayerButtons(teamA)}</div>
                <div class="team-actions">
                    <button class="action-btn minus" data-team-id="${teamA.id}">-</button>
                    <button class="action-btn forfeit" data-team-id="${teamA.id}">F</button>
                </div>
            </div>

            <!-- ===== Centre (Score, Chrono, Contrôles) ===== -->
            <div class="game-center">
                <div class="game-day">Journée ${match.day}</div>
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

            <!-- ===== Équipe B (Droite) ===== -->
            <div class="game-team team-b">
                <div class="team-info">
                    <span class="name">${teamB.name}</span>
                    <img src="${teamB.logo}" class="logo" alt="${teamB.name}">
                </div>
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

// REMPLACEZ la fonction handlePlayerAction existante par celle-ci
handlePlayerAction(button) {
    const matchId = button.closest('.game-card').dataset.matchId;
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match || match.status === 'finished') return;

    const teamId = button.dataset.teamId;

    // Clic sur un bouton joueur
    if (button.matches('.player-btn')) {
        const playerName = button.dataset.playerName;
        const totalDuration = this.state.settings.matchDuration * 60;
        const minute = Math.floor((totalDuration - match.timer) / 60) + 1; // +1 pour commencer à 1'
        const scorer = { name: playerName, minute: Math.max(1, minute), teamId: teamId };
        
        if (teamId === match.teamA) {
            match.scoreA = (match.scoreA || 0) + 1;
            match.scorersA = match.scorersA || [];
            match.scorersA.push(scorer);
        } else {
            match.scoreB = (match.scoreB || 0) + 1;
            match.scorersB = match.scorersB || [];
            match.scorersB.push(scorer);
        }
    }
    // Clic sur le bouton Moins (-)
    else if (button.matches('.action-btn.minus')) {
        if (teamId === match.teamA && match.scoreA > 0) {
            match.scoreA--;
            if (match.scorersA && match.scorersA.length > 0) {
                match.scorersA.pop(); // Retire le dernier buteur
            }
        } else if (teamId === match.teamB && match.scoreB > 0) {
            match.scoreB--;
            if (match.scorersB && match.scorersB.length > 0) {
                match.scorersB.pop();
            }
        }
    }
    // Clic sur le bouton Forfait (F)
    else if (button.matches('.action-btn.forfeit')) {
        if (confirm(`Confirmer le forfait de l'équipe ? Le score sera de 3-0 pour l'équipe adverse.`)) {
            if (teamId === match.teamA) {
                match.scoreA = 0;
                match.scoreB = 3;
            } else {
                match.scoreA = 3;
                match.scoreB = 0;
            }
            match.status = 'finished';
            match.scorersA = [];
            match.scorersB = [];
            clearInterval(this.state.timers[matchId]);
            delete this.state.timers[matchId];
            this.updatePlayoffsWithWinner(match);
        }
    }
    this.saveState();
},
